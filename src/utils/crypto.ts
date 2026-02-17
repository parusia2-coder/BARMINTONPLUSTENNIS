// ═══════════════════════════════════════════════
// Web Push 암호화 유틸리티
// VAPID JWT + ECE(aes128gcm) — Cloudflare Workers Web Crypto API 순수 구현
// ═══════════════════════════════════════════════

export interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// ─── Base64URL 인코딩/디코딩 ───

export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - str.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function concatBuffers(...buffers: (ArrayBuffer | Uint8Array)[]): Uint8Array {
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

// ─── VAPID JWT 생성 ───

export async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject
  })))

  const signingInput = `${header}.${payload}`

  const rawKey = base64UrlDecode(privateKeyBase64)
  const publicRaw = base64UrlDecode(publicKeyBase64)

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

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`
}

// ─── ECE aes128gcm 페이로드 암호화 ───

export async function encryptPayload(
  plaintext: Uint8Array,
  clientPublicKey: Uint8Array,
  clientAuth: Uint8Array
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  // Ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  const serverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey)
  )

  const clientKey = await crypto.subtle.importKey(
    'raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
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

  // HKDF → IKM
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

  // CEK + Nonce
  const ikmKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])

  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: aes128gcm\0') },
    ikmKey,
    128
  ))

  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: nonce\0') },
    ikmKey,
    96
  ))

  // AES-128-GCM encrypt (with \x02 delimiter for last record)
  const padded = concatBuffers(plaintext, new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, padded
  ))

  // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, plaintext.length + 18 + 1 + 16)
  const headerBuf = concatBuffers(salt, rs, new Uint8Array([serverPublicRaw.length]), serverPublicRaw)

  return {
    ciphertext: concatBuffers(headerBuf, encrypted),
    serverPublicKey: serverPublicRaw,
    salt
  }
}

// ─── Web Push 전송 ───

export async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
  ttl: number = 3600 // 기본 1시간 (경기 알림 특성에 맞게)
): Promise<void> {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`

  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey)

  const clientPublicKey = base64UrlDecode(subscription.keys.p256dh)
  const clientAuth = base64UrlDecode(subscription.keys.auth)
  const plaintext = new TextEncoder().encode(payload)

  const { ciphertext } = await encryptPayload(plaintext, clientPublicKey, clientAuth)

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Content-Length': String(ciphertext.length),
      'TTL': String(ttl),
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
