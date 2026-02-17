import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

export const notificationRoutes = new Hono<{ Bindings: Bindings }>()

// ─── VAPID 공개키 조회 ───
notificationRoutes.get('/:tid/push/vapid-key', async (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
})

// ─── 푸시 구독 등록 ───
notificationRoutes.post('/:tid/push/subscribe', async (c) => {
  const tid = c.req.param('tid')
  const { subscription, name, phone } = await c.req.json<{
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
    name: string
    phone?: string
  }>()

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth || !name) {
    return c.json({ error: '필수 정보가 누락되었습니다' }, 400)
  }

  const db = c.env.DB

  // 이미 등록된 구독이면 업데이트
  await db.prepare(`
    INSERT INTO push_subscriptions (tournament_id, participant_name, participant_phone, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
    participant_name = ?, participant_phone = ?, p256dh = ?, auth = ?, tournament_id = ?
  `).bind(
    tid, name, phone || '', subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
    name, phone || '', subscription.keys.p256dh, subscription.keys.auth, tid
  ).run()

  return c.json({ success: true, message: '알림 구독이 등록되었습니다' })
})

// ─── 푸시 구독 해제 ───
notificationRoutes.post('/:tid/push/unsubscribe', async (c) => {
  const tid = c.req.param('tid')
  const { endpoint } = await c.req.json<{ endpoint: string }>()
  if (!endpoint) return c.json({ error: 'endpoint 필요' }, 400)

  await c.env.DB.prepare(
    'DELETE FROM push_subscriptions WHERE tournament_id = ? AND endpoint = ?'
  ).bind(tid, endpoint).run()

  return c.json({ success: true })
})

// ─── 구독 상태 확인 ───
notificationRoutes.get('/:tid/push/status', async (c) => {
  const tid = c.req.param('tid')
  const name = c.req.query('name')
  if (!name) return c.json({ subscribed: false })

  const sub = await c.env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE tournament_id = ? AND participant_name = ? LIMIT 1'
  ).bind(tid, name).first()

  return c.json({ subscribed: !!sub })
})

// ─── 테스트 알림 발송 ───
notificationRoutes.post('/:tid/push/test', async (c) => {
  const tid = c.req.param('tid')
  const { name } = await c.req.json<{ name: string }>()
  if (!name) return c.json({ error: '이름이 필요합니다' }, 400)

  const db = c.env.DB
  const subs = await db.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tournament_id = ? AND participant_name = ?'
  ).bind(tid, name).all()

  if (!subs.results?.length) return c.json({ error: '등록된 알림 구독이 없습니다' }, 404)

  const payload = JSON.stringify({
    title: '🏸 알림 테스트',
    body: `${name}님, 알림이 정상적으로 작동합니다!`,
    tag: 'test',
    url: `/my?tid=${tid}`
  })

  let sent = 0, failed = 0
  for (const sub of subs.results as any[]) {
    try {
      await sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        c.env.VAPID_PUBLIC_KEY,
        c.env.VAPID_PRIVATE_KEY,
        c.env.VAPID_SUBJECT
      )
      sent++
    } catch (e) {
      failed++
      // 구독이 만료되었으면 삭제
      if ((e as any)?.statusCode === 410 || (e as any)?.statusCode === 404) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
      }
    }
  }

  return c.json({ success: true, sent, failed })
})

// ─── 경기 알림 발송 (내부 호출용) ───
export async function sendMatchNotifications(
  db: D1Database,
  tournamentId: number,
  matchId: number,
  courtNumber: number,
  team1Name: string,
  team2Name: string,
  notificationType: 'match_starting' | 'match_upcoming',
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ sent: number; failed: number }> {
  // 팀 이름에서 선수 이름 추출 ("김수협 · 이영원" → ["김수협", "이영원"])
  const playerNames = [
    ...team1Name.split('·').map(n => n.trim()),
    ...team2Name.split('·').map(n => n.trim())
  ].filter(n => n)

  let sent = 0, failed = 0

  for (const playerName of playerNames) {
    // 이미 발송했는지 확인
    const alreadySent = await db.prepare(
      'SELECT id FROM notification_logs WHERE match_id = ? AND participant_name = ? AND notification_type = ?'
    ).bind(matchId, playerName, notificationType).first()
    if (alreadySent) continue

    // 해당 선수의 구독 조회
    const subs = await db.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tournament_id = ? AND participant_name = ?'
    ).bind(tournamentId, playerName).all()

    if (!subs.results?.length) continue

    const isStarting = notificationType === 'match_starting'
    const payload = JSON.stringify({
      title: isStarting ? '🏸 경기 시작!' : '🏸 다음 경기 준비',
      body: isStarting
        ? `코트 ${courtNumber}에서 경기가 시작됩니다!\n${team1Name} vs ${team2Name}`
        : `코트 ${courtNumber} 다음 경기에 출전합니다. 준비해주세요!\n${team1Name} vs ${team2Name}`,
      tag: `match-${matchId}`,
      url: `/my?tid=${tournamentId}`,
      matchId,
      courtNumber,
      tournamentId,
      actions: [
        { action: 'open', title: '내 경기 보기' },
        { action: 'dismiss', title: '확인' }
      ]
    })

    for (const sub of subs.results as any[]) {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        )
        sent++
      } catch (e) {
        failed++
        if ((e as any)?.statusCode === 410 || (e as any)?.statusCode === 404) {
          await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
        }
      }
    }

    // 발송 로그 기록
    await db.prepare(
      'INSERT OR IGNORE INTO notification_logs (tournament_id, match_id, participant_name, notification_type) VALUES (?, ?, ?, ?)'
    ).bind(tournamentId, matchId, playerName, notificationType).run()
  }

  return { sent, failed }
}

// ═══════════════════════════════════════════════
// Web Push — Cloudflare Workers 순수 구현
// VAPID JWT + ECE(aes128gcm) encryption via Web Crypto API
// ═══════════════════════════════════════════════

interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - str.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concatBuffers(...buffers: (ArrayBuffer | Uint8Array)[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + (b instanceof Uint8Array ? b.byteLength : b.byteLength), 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const buf of buffers) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    result.set(bytes, offset)
    offset += bytes.byteLength
  }
  return result
}

async function createVapidJwt(audience: string, subject: string, privateKeyBase64: string, publicKeyBase64: string): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject
  })))

  const signingInput = `${header}.${payload}`

  // Import private key
  const rawKey = base64UrlDecode(privateKeyBase64)
  const publicRaw = base64UrlDecode(publicKeyBase64)
  
  // Build JWK from raw keys
  const x = base64UrlEncode(publicRaw.slice(1, 33))
  const y = base64UrlEncode(publicRaw.slice(33, 65))
  const d = base64UrlEncode(rawKey)

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  )

  // Convert DER signature to raw (r||s) format — actually Web Crypto returns raw already for P-256
  const sig = new Uint8Array(signature)
  return `${signingInput}.${base64UrlEncode(sig)}`
}

async function encryptPayload(
  plaintext: Uint8Array,
  clientPublicKey: Uint8Array,
  clientAuth: Uint8Array
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  const serverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey)
  )

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientKey },
      serverKeys.privateKey,
      256
    )
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF to derive IKM
  const authInfo = concatBuffers(
    new TextEncoder().encode('WebPush: info\0'),
    clientPublicKey,
    serverPublicRaw
  )

  const authHkdfKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits'])
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: clientAuth, info: authInfo },
    authHkdfKey,
    256
  ))

  // Derive content encryption key and nonce
  const ikmKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0')
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    ikmKey,
    128
  ))

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0')
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    ikmKey,
    96
  ))

  // Pad plaintext (add delimiter \x02 for last record)
  const padded = concatBuffers(plaintext, new Uint8Array([2]))

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    padded
  ))

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, plaintext.length + 18 + 1 + 16) // record size
  const header = concatBuffers(
    salt,
    rs,
    new Uint8Array([serverPublicRaw.length]),
    serverPublicRaw
  )

  return {
    ciphertext: concatBuffers(header, encrypted),
    serverPublicKey: serverPublicRaw,
    salt
  }
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<void> {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`

  // Create VAPID JWT
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey)

  // Encrypt payload
  const clientPublicKey = base64UrlDecode(subscription.keys.p256dh)
  const clientAuth = base64UrlDecode(subscription.keys.auth)
  const plaintext = new TextEncoder().encode(payload)

  const { ciphertext } = await encryptPayload(plaintext, clientPublicKey, clientAuth)

  // Send push
  const vapidPublicKeyDecoded = base64UrlDecode(vapidPublicKey)

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Content-Length': String(ciphertext.length),
      'TTL': '86400',
      'Urgency': 'high',
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`
    },
    body: ciphertext
  })

  if (!response.ok) {
    const error: any = new Error(`Push failed: ${response.status} ${response.statusText}`)
    error.statusCode = response.status
    throw error
  }
}
