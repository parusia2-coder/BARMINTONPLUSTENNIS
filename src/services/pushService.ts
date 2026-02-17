// ═══════════════════════════════════════════════
// Push 알림 서비스 — 경기 알림 발송 핵심 로직
// ═══════════════════════════════════════════════

import { sendWebPush, type PushSubscription } from '../utils/crypto'

// ─── 경기 알림 발송 (내부 호출용) ───
// 팀 이름에서 선수 이름을 추출 → 구독자 조회 → 병렬 발송
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
    // 이미 발송했는지 확인 (중복 방지)
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
      url: `/my?tid=${tournamentId}&highlight=${matchId}`,
      matchId,
      courtNumber,
      tournamentId,
      actions: [
        { action: 'open', title: '내 경기 보기' },
        { action: 'dismiss', title: '확인' }
      ]
    })

    // ─── #2 병렬 발송 (Promise.allSettled) ───
    const pushPromises = (subs.results as any[]).map(sub =>
      sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      ).then(() => ({ ok: true, endpoint: sub.endpoint }))
       .catch((e: any) => ({ ok: false, endpoint: sub.endpoint, statusCode: e?.statusCode }))
    )

    const results = await Promise.allSettled(pushPromises)

    // 결과 처리: 성공/실패 카운트 + 만료 구독 삭제
    const expiredEndpoints: string[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const r = result.value
        if (r.ok) {
          sent++
        } else {
          failed++
          if (r.statusCode === 410 || r.statusCode === 404) {
            expiredEndpoints.push(r.endpoint)
          }
        }
      } else {
        failed++
      }
    }

    // 만료된 구독 일괄 삭제
    if (expiredEndpoints.length > 0) {
      await Promise.allSettled(
        expiredEndpoints.map(ep =>
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(ep).run()
        )
      )
    }

    // 발송 로그 기록
    await db.prepare(
      'INSERT OR IGNORE INTO notification_logs (tournament_id, match_id, participant_name, notification_type) VALUES (?, ?, ?, ?)'
    ).bind(tournamentId, matchId, playerName, notificationType).run()
  }

  return { sent, failed }
}
