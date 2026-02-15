import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const matchRoutes = new Hono<{ Bindings: Bindings }>()

// 경기 목록 조회
matchRoutes.get('/:tid/matches', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const status = c.req.query('status')

  let query = `
    SELECT m.*,
      p1.name as t1p1_name, p2.name as t1p2_name,
      p3.name as t2p1_name, p4.name as t2p2_name
    FROM matches m
    LEFT JOIN participants p1 ON m.team1_player1 = p1.id
    LEFT JOIN participants p2 ON m.team1_player2 = p2.id
    LEFT JOIN participants p3 ON m.team2_player1 = p3.id
    LEFT JOIN participants p4 ON m.team2_player2 = p4.id
    WHERE m.tournament_id = ?`

  if (status) query += ` AND m.status = '${status}'`
  query += ` ORDER BY m.round ASC, m.match_order ASC`

  const { results } = await db.prepare(query).bind(tid).all()
  return c.json({ matches: results })
})

// 점수 업데이트
matchRoutes.put('/:tid/matches/:mid/score', async (c) => {
  const tid = c.req.param('tid')
  const mid = c.req.param('mid')
  const db = c.env.DB
  const body = await c.req.json()
  const { team1_set1, team1_set2, team1_set3, team2_set1, team2_set2, team2_set3, status, winner_team } = body

  // 현재 점수 조회 (감사 로그용)
  const oldMatch = await db.prepare(
    `SELECT * FROM matches WHERE id=? AND tournament_id=?`
  ).bind(mid, tid).first()

  if (!oldMatch) return c.json({ error: '경기를 찾을 수 없습니다.' }, 404)

  // 점수 업데이트
  await db.prepare(
    `UPDATE matches SET 
      team1_set1=?, team1_set2=?, team1_set3=?,
      team2_set1=?, team2_set2=?, team2_set3=?,
      status=?, winner_team=?, updated_at=datetime('now')
     WHERE id=? AND tournament_id=?`
  ).bind(
    team1_set1 || 0, team1_set2 || 0, team1_set3 || 0,
    team2_set1 || 0, team2_set2 || 0, team2_set3 || 0,
    status || oldMatch.status, winner_team || null,
    mid, tid
  ).run()

  // 감사 로그 기록
  await db.prepare(
    `INSERT INTO audit_logs (tournament_id, match_id, action, old_value, new_value, updated_by)
     VALUES (?, ?, 'UPDATE_SCORE', ?, ?, 'admin')`
  ).bind(
    tid, mid,
    JSON.stringify({
      team1: [oldMatch.team1_set1, oldMatch.team1_set2, oldMatch.team1_set3],
      team2: [oldMatch.team2_set1, oldMatch.team2_set2, oldMatch.team2_set3]
    }),
    JSON.stringify({
      team1: [team1_set1 || 0, team1_set2 || 0, team1_set3 || 0],
      team2: [team2_set1 || 0, team2_set2 || 0, team2_set3 || 0]
    })
  ).run()

  // 경기 완료 시 순위 재계산
  if (status === 'completed' && winner_team) {
    await recalculateStandings(db, parseInt(tid))
  }

  return c.json({ message: '점수가 업데이트되었습니다.' })
})

// 경기 상태 변경 (시작/완료)
matchRoutes.patch('/:tid/matches/:mid/status', async (c) => {
  const tid = c.req.param('tid')
  const mid = c.req.param('mid')
  const db = c.env.DB
  const { status } = await c.req.json()

  await db.prepare(
    `UPDATE matches SET status=?, updated_at=datetime('now') WHERE id=? AND tournament_id=?`
  ).bind(status, mid, tid).run()

  return c.json({ message: `경기 상태가 '${status}'로 변경되었습니다.` })
})

// 순위 조회
matchRoutes.get('/:tid/standings', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  // 순위 재계산
  await recalculateStandings(db, parseInt(tid))

  const { results } = await db.prepare(
    `SELECT s.*, p.name, p.level 
     FROM standings s 
     JOIN participants p ON s.participant_id = p.id 
     WHERE s.tournament_id = ? AND p.deleted = 0
     ORDER BY s.points DESC, s.goal_difference DESC, s.score_for DESC`
  ).bind(tid).all()

  // 순위 할당
  const standings = (results || []).map((s: any, i: number) => ({ ...s, rank: i + 1 }))

  return c.json({ standings })
})

// 감사 로그 조회
matchRoutes.get('/:tid/audit-logs', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT * FROM audit_logs WHERE tournament_id=? ORDER BY created_at DESC LIMIT 100`
  ).bind(tid).all()
  return c.json({ logs: results })
})

// 순위 재계산 함수
async function recalculateStandings(db: D1Database, tournamentId: number) {
  // 완료된 경기 조회
  const { results: matches } = await db.prepare(
    `SELECT * FROM matches WHERE tournament_id=? AND status='completed'`
  ).bind(tournamentId).all()

  // 참가자 목록 조회
  const { results: participants } = await db.prepare(
    `SELECT id FROM participants WHERE tournament_id=? AND deleted=0`
  ).bind(tournamentId).all()

  if (!participants || participants.length === 0) return

  // 참가자별 통계 계산
  const stats: Record<number, { wins: number; losses: number; scoreFor: number; scoreAgainst: number }> = {}

  for (const p of participants) {
    const pid = p.id as number
    stats[pid] = { wins: 0, losses: 0, scoreFor: 0, scoreAgainst: 0 }
  }

  for (const m of (matches || [])) {
    const match = m as any
    const t1Score = (match.team1_set1 || 0) + (match.team1_set2 || 0) + (match.team1_set3 || 0)
    const t2Score = (match.team2_set1 || 0) + (match.team2_set2 || 0) + (match.team2_set3 || 0)

    // 팀1 선수들
    const team1Players = [match.team1_player1, match.team1_player2].filter(Boolean)
    const team2Players = [match.team2_player1, match.team2_player2].filter(Boolean)

    for (const pid of team1Players) {
      if (!stats[pid]) continue
      stats[pid].scoreFor += t1Score
      stats[pid].scoreAgainst += t2Score
      if (match.winner_team === 1) stats[pid].wins++
      else if (match.winner_team === 2) stats[pid].losses++
    }

    for (const pid of team2Players) {
      if (!stats[pid]) continue
      stats[pid].scoreFor += t2Score
      stats[pid].scoreAgainst += t1Score
      if (match.winner_team === 2) stats[pid].wins++
      else if (match.winner_team === 1) stats[pid].losses++
    }
  }

  // standings 테이블 업데이트
  for (const pid of Object.keys(stats)) {
    const s = stats[parseInt(pid)]
    const points = s.wins * 3 // 승점: 승리 3점
    const goalDiff = s.scoreFor - s.scoreAgainst

    await db.prepare(
      `INSERT INTO standings (tournament_id, participant_id, wins, losses, points, score_for, score_against, goal_difference, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(tournament_id, participant_id) DO UPDATE SET
       wins=?, losses=?, points=?, score_for=?, score_against=?, goal_difference=?, updated_at=datetime('now')`
    ).bind(
      tournamentId, parseInt(pid), s.wins, s.losses, points, s.scoreFor, s.scoreAgainst, goalDiff,
      s.wins, s.losses, points, s.scoreFor, s.scoreAgainst, goalDiff
    ).run()
  }
}
