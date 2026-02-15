import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const matchRoutes = new Hono<{ Bindings: Bindings }>()

// 경기 목록 조회 (종목별)
matchRoutes.get('/:tid/matches', async (c) => {
  const tid = c.req.param('tid')
  const eventId = c.req.query('event_id')
  const db = c.env.DB

  let query = `
    SELECT m.*, e.name as event_name, e.category,
      t1.team_name as team1_name, t2.team_name as team2_name
    FROM matches m
    JOIN events e ON m.event_id = e.id
    LEFT JOIN teams t1 ON m.team1_id = t1.id
    LEFT JOIN teams t2 ON m.team2_id = t2.id
    WHERE m.tournament_id = ?`

  const binds: any[] = [tid]
  if (eventId) {
    query += ` AND m.event_id = ?`
    binds.push(eventId)
  }
  query += ` ORDER BY m.event_id, m.round ASC, m.match_order ASC`

  const stmt = binds.length === 1
    ? db.prepare(query).bind(binds[0])
    : db.prepare(query).bind(binds[0], binds[1])
  const { results } = await stmt.all()

  return c.json({ matches: results })
})

// 점수 업데이트
matchRoutes.put('/:tid/matches/:mid/score', async (c) => {
  const tid = c.req.param('tid')
  const mid = c.req.param('mid')
  const db = c.env.DB
  const body = await c.req.json()
  const { team1_set1, team1_set2, team1_set3, team2_set1, team2_set2, team2_set3, status, winner_team } = body

  const oldMatch = await db.prepare(
    `SELECT * FROM matches WHERE id=? AND tournament_id=?`
  ).bind(mid, tid).first()

  if (!oldMatch) return c.json({ error: '경기를 찾을 수 없습니다.' }, 404)

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

  // 감사 로그
  await db.prepare(
    `INSERT INTO audit_logs (tournament_id, match_id, action, old_value, new_value, updated_by)
     VALUES (?, ?, 'UPDATE_SCORE', ?, ?, 'admin')`
  ).bind(
    tid, mid,
    JSON.stringify({ team1: [oldMatch.team1_set1, oldMatch.team1_set2, oldMatch.team1_set3], team2: [oldMatch.team2_set1, oldMatch.team2_set2, oldMatch.team2_set3] }),
    JSON.stringify({ team1: [team1_set1 || 0, team1_set2 || 0, team1_set3 || 0], team2: [team2_set1 || 0, team2_set2 || 0, team2_set3 || 0] })
  ).run()

  if (status === 'completed' && winner_team) {
    await recalculateStandings(db, parseInt(tid), oldMatch.event_id as number)
  }

  return c.json({ message: '점수가 업데이트되었습니다.' })
})

// 경기 상태 변경
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

// 순위 조회 (종목별)
matchRoutes.get('/:tid/standings', async (c) => {
  const tid = c.req.param('tid')
  const eventId = c.req.query('event_id')
  const db = c.env.DB

  if (eventId) {
    await recalculateStandings(db, parseInt(tid), parseInt(eventId))
  } else {
    // 모든 종목 재계산
    const { results: events } = await db.prepare(`SELECT id FROM events WHERE tournament_id=?`).bind(tid).all()
    for (const ev of (events || [])) {
      await recalculateStandings(db, parseInt(tid), ev.id as number)
    }
  }

  let query = `
    SELECT s.*, t.team_name, e.name as event_name, e.category
    FROM standings s
    JOIN teams t ON s.team_id = t.id
    JOIN events e ON s.event_id = e.id
    WHERE s.tournament_id = ?`
  const binds: any[] = [tid]
  if (eventId) { query += ` AND s.event_id = ?`; binds.push(eventId) }
  query += ` ORDER BY s.event_id, s.points DESC, s.goal_difference DESC, s.score_for DESC`

  const stmt = binds.length === 1 ? db.prepare(query).bind(binds[0]) : db.prepare(query).bind(binds[0], binds[1])
  const { results } = await stmt.all()

  // 종목별 순위 매기기
  const byEvent: Record<number, any[]> = {}
  for (const s of (results || [])) {
    const eid = s.event_id as number
    if (!byEvent[eid]) byEvent[eid] = []
    byEvent[eid].push(s)
  }
  const standings: any[] = []
  for (const arr of Object.values(byEvent)) {
    arr.forEach((s, i) => standings.push({ ...s, rank: i + 1 }))
  }

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
async function recalculateStandings(db: D1Database, tournamentId: number, eventId: number) {
  const { results: matches } = await db.prepare(
    `SELECT * FROM matches WHERE tournament_id=? AND event_id=? AND status='completed'`
  ).bind(tournamentId, eventId).all()

  const { results: teams } = await db.prepare(
    `SELECT id FROM teams WHERE event_id=?`
  ).bind(eventId).all()

  if (!teams || teams.length === 0) return

  const stats: Record<number, { wins: number; losses: number; scoreFor: number; scoreAgainst: number }> = {}
  for (const t of teams) {
    stats[t.id as number] = { wins: 0, losses: 0, scoreFor: 0, scoreAgainst: 0 }
  }

  for (const m of (matches || [])) {
    const match = m as any
    const t1Score = (match.team1_set1 || 0) + (match.team1_set2 || 0) + (match.team1_set3 || 0)
    const t2Score = (match.team2_set1 || 0) + (match.team2_set2 || 0) + (match.team2_set3 || 0)

    if (match.team1_id && stats[match.team1_id]) {
      stats[match.team1_id].scoreFor += t1Score
      stats[match.team1_id].scoreAgainst += t2Score
      if (match.winner_team === 1) stats[match.team1_id].wins++
      else if (match.winner_team === 2) stats[match.team1_id].losses++
    }
    if (match.team2_id && stats[match.team2_id]) {
      stats[match.team2_id].scoreFor += t2Score
      stats[match.team2_id].scoreAgainst += t1Score
      if (match.winner_team === 2) stats[match.team2_id].wins++
      else if (match.winner_team === 1) stats[match.team2_id].losses++
    }
  }

  for (const tid of Object.keys(stats)) {
    const s = stats[parseInt(tid)]
    const points = s.wins * 3
    const goalDiff = s.scoreFor - s.scoreAgainst
    await db.prepare(
      `INSERT INTO standings (tournament_id, event_id, team_id, wins, losses, points, score_for, score_against, goal_difference, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(event_id, team_id) DO UPDATE SET
       wins=?, losses=?, points=?, score_for=?, score_against=?, goal_difference=?, updated_at=datetime('now')`
    ).bind(
      tournamentId, eventId, parseInt(tid), s.wins, s.losses, points, s.scoreFor, s.scoreAgainst, goalDiff,
      s.wins, s.losses, points, s.scoreFor, s.scoreAgainst, goalDiff
    ).run()
  }
}
