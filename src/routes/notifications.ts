import { sportConfig } from '../config'
import { Hono } from 'hono'
import { sendWebPush } from '../utils/crypto'

type Bindings = {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

export const notificationRoutes = new Hono<{ Bindings: Bindings }>()

// ─── 라우팅 핸들러 ───
// 비즈니스 로직: src/services/pushService.ts
// 암호화 유틸: src/utils/crypto.ts

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

  await c.env.DB.prepare(`
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
    title: sportConfig.notifications.testTitle,
    body: `${name}님, 알림이 정상적으로 작동합니다!`,
    tag: 'test',
    url: `/my?tid=${tid}`
  })

  // 병렬 발송
  const pushPromises = (subs.results as any[]).map(sub =>
    sendWebPush(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      c.env.VAPID_PUBLIC_KEY,
      c.env.VAPID_PRIVATE_KEY,
      c.env.VAPID_SUBJECT
    ).then(() => ({ ok: true, endpoint: sub.endpoint }))
     .catch((e: any) => ({ ok: false, endpoint: sub.endpoint, statusCode: e?.statusCode }))
  )

  const results = await Promise.allSettled(pushPromises)

  let sent = 0, failed = 0
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.ok) {
      sent++
    } else {
      failed++
      // 만료 구독 삭제
      const r = result.status === 'fulfilled' ? result.value : null
      if (r && (r.statusCode === 410 || r.statusCode === 404)) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(r.endpoint).run()
      }
    }
  }

  return c.json({ success: true, sent, failed })
})

// re-export for backward compatibility (matches.ts import)
export { sendMatchNotifications } from '../services/pushService'
