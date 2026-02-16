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

  // 대회 포맷 정보 포함 (점수 규칙 판단용)
  const tournament = await db.prepare(
    `SELECT format FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first() as any
  const targetScore = tournament?.format === 'tournament' ? 21 : 25

  return c.json({ matches: results, target_score: targetScore, format: tournament?.format })
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

// 코트별 경기 조회 (코트 점수판용)
matchRoutes.get('/:tid/court/:courtNum', async (c) => {
  const tid = c.req.param('tid')
  const courtNum = c.req.param('courtNum')
  const db = c.env.DB

  // 현재 해당 코트에서 진행중인 경기
  const currentMatch = await db.prepare(`
    SELECT m.*, e.name as event_name, e.category,
      t1.team_name as team1_name, t2.team_name as team2_name,
      p1a.name as p1a_name, p1b.name as p1b_name,
      p2a.name as p2a_name, p2b.name as p2b_name
    FROM matches m
    JOIN events e ON m.event_id = e.id
    LEFT JOIN teams t1 ON m.team1_id = t1.id
    LEFT JOIN teams t2 ON m.team2_id = t2.id
    LEFT JOIN participants p1a ON t1.player1_id = p1a.id
    LEFT JOIN participants p1b ON t1.player2_id = p1b.id
    LEFT JOIN participants p2a ON t2.player1_id = p2a.id
    LEFT JOIN participants p2b ON t2.player2_id = p2b.id
    WHERE m.tournament_id = ? AND m.court_number = ? AND m.status = 'playing'
    LIMIT 1
  `).bind(tid, courtNum).first()

  // 다음 대기 경기들 (이 코트)
  const { results: nextMatches } = await db.prepare(`
    SELECT m.*, e.name as event_name, e.category,
      t1.team_name as team1_name, t2.team_name as team2_name
    FROM matches m
    JOIN events e ON m.event_id = e.id
    LEFT JOIN teams t1 ON m.team1_id = t1.id
    LEFT JOIN teams t2 ON m.team2_id = t2.id
    WHERE m.tournament_id = ? AND m.court_number = ? AND m.status = 'pending'
    ORDER BY m.round ASC, m.match_order ASC
    LIMIT 5
  `).bind(tid, courtNum).all()

  // 최근 완료 경기
  const { results: recentMatches } = await db.prepare(`
    SELECT m.*, e.name as event_name,
      t1.team_name as team1_name, t2.team_name as team2_name
    FROM matches m
    JOIN events e ON m.event_id = e.id
    LEFT JOIN teams t1 ON m.team1_id = t1.id
    LEFT JOIN teams t2 ON m.team2_id = t2.id
    WHERE m.tournament_id = ? AND m.court_number = ? AND m.status = 'completed'
    ORDER BY m.updated_at DESC
    LIMIT 3
  `).bind(tid, courtNum).all()

  // 대회 정보 (포맷 포함 - 점수 규칙 판단용)
  const tournament = await db.prepare(
    `SELECT name, courts, format FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first()

  // 점수 규칙: 예선(kdk/league) = 25점, 본선(tournament) = 21점
  const targetScore = (tournament as any)?.format === 'tournament' ? 21 : 25

  return c.json({
    tournament,
    court_number: parseInt(courtNum as string),
    current_match: currentMatch,
    next_matches: nextMatches || [],
    recent_matches: recentMatches || [],
    target_score: targetScore
  })
})

// 코트에서 다음 경기 시작 (자동으로 다음 대기 경기를 playing으로)
matchRoutes.post('/:tid/court/:courtNum/next', async (c) => {
  const tid = c.req.param('tid')
  const courtNum = c.req.param('courtNum')
  const db = c.env.DB

  // 현재 진행중인 경기가 있으면 차단
  const playing = await db.prepare(
    `SELECT id FROM matches WHERE tournament_id=? AND court_number=? AND status='playing' LIMIT 1`
  ).bind(tid, courtNum).first()

  if (playing) return c.json({ error: '현재 진행 중인 경기가 있습니다. 먼저 완료해주세요.' }, 400)

  // 다음 대기 경기 가져오기
  const next = await db.prepare(`
    SELECT m.*, t1.team_name as team1_name, t2.team_name as team2_name, e.name as event_name
    FROM matches m
    LEFT JOIN teams t1 ON m.team1_id = t1.id
    LEFT JOIN teams t2 ON m.team2_id = t2.id
    LEFT JOIN events e ON m.event_id = e.id
    WHERE m.tournament_id=? AND m.court_number=? AND m.status='pending'
    ORDER BY m.round ASC, m.match_order ASC LIMIT 1
  `).bind(tid, courtNum).first()

  if (!next) return c.json({ error: '대기 중인 경기가 없습니다.' }, 404)

  await db.prepare(
    `UPDATE matches SET status='playing', updated_at=datetime('now') WHERE id=?`
  ).bind(next.id).run()

  return c.json({ message: '경기가 시작되었습니다.', match: next })
})

// 코트 전체 현황 (모든 코트 한눈에)
matchRoutes.get('/:tid/courts/overview', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  const tournament = await db.prepare(
    `SELECT name, courts, format FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first() as any

  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  const targetScore = tournament.format === 'tournament' ? 21 : 25

  const courts: any[] = []
  for (let i = 1; i <= (tournament.courts || 2); i++) {
    const currentMatch = await db.prepare(`
      SELECT m.*, e.name as event_name,
        t1.team_name as team1_name, t2.team_name as team2_name
      FROM matches m
      JOIN events e ON m.event_id = e.id
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      WHERE m.tournament_id=? AND m.court_number=? AND m.status='playing'
      LIMIT 1
    `).bind(tid, i).first()

    const pendingCount = await db.prepare(
      `SELECT COUNT(*) as cnt FROM matches WHERE tournament_id=? AND court_number=? AND status='pending'`
    ).bind(tid, i).first() as any

    courts.push({
      court_number: i,
      current_match: currentMatch,
      pending_count: pendingCount?.cnt || 0
    })
  }

  // 전체 통계
  const stats = await db.prepare(`
    SELECT 
      COUNT(CASE WHEN status='playing' THEN 1 END) as playing,
      COUNT(CASE WHEN status='pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
      COUNT(*) as total
    FROM matches WHERE tournament_id=?
  `).bind(tid).first()

  return c.json({ tournament, courts, stats, target_score: targetScore })
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

// =============================================
// ★ 통계 대시보드 API ★
// =============================================
matchRoutes.get('/:tid/dashboard', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  const tournament = await db.prepare(
    `SELECT * FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first() as any
  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  // 전체 경기 통계
  const matchStats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status='playing' THEN 1 END) as playing,
      COUNT(CASE WHEN status='pending' THEN 1 END) as pending
    FROM matches WHERE tournament_id=?
  `).bind(tid).first() as any

  // 종목별 통계
  const { results: eventStats } = await db.prepare(`
    SELECT e.id, e.name, e.category, e.level_group,
      COUNT(m.id) as total_matches,
      COUNT(CASE WHEN m.status='completed' THEN 1 END) as completed_matches,
      COUNT(CASE WHEN m.status='playing' THEN 1 END) as playing_matches,
      (SELECT COUNT(*) FROM teams WHERE event_id=e.id) as team_count
    FROM events e
    LEFT JOIN matches m ON e.id = m.event_id
    WHERE e.tournament_id=?
    GROUP BY e.id
    ORDER BY e.category, e.level_group
  `).bind(tid).all()

  // 코트별 현황
  const courtStats: any[] = []
  for (let i = 1; i <= (tournament.courts || 6); i++) {
    const stats = await db.prepare(`
      SELECT 
        COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status='playing' THEN 1 END) as playing,
        COUNT(CASE WHEN status='pending' THEN 1 END) as pending
      FROM matches WHERE tournament_id=? AND court_number=?
    `).bind(tid, i).first() as any
    courtStats.push({ court_number: i, ...stats })
  }

  // 클럽별 성적 (완료된 경기 기반)
  const { results: clubResults } = await db.prepare(`
    SELECT p.club, 
      COUNT(DISTINCT p.id) as player_count,
      COUNT(DISTINCT t.id) as team_count
    FROM participants p
    LEFT JOIN teams t ON (t.player1_id = p.id OR t.player2_id = p.id)
    WHERE p.tournament_id=? AND p.deleted=0 AND p.club != ''
    GROUP BY p.club
    ORDER BY player_count DESC
  `).bind(tid).all()

  // 클럽별 승패 계산
  const clubWinLoss: Record<string, { wins: number, losses: number }> = {}
  if (clubResults) {
    for (const cr of clubResults) {
      clubWinLoss[cr.club as string] = { wins: 0, losses: 0 }
    }
  }

  const { results: completedMatches } = await db.prepare(`
    SELECT m.winner_team, m.team1_id, m.team2_id,
      t1p1.club as t1p1_club, t1p2.club as t1p2_club,
      t2p1.club as t2p1_club, t2p2.club as t2p2_club
    FROM matches m
    JOIN teams t1 ON m.team1_id = t1.id
    JOIN teams t2 ON m.team2_id = t2.id
    JOIN participants t1p1 ON t1.player1_id = t1p1.id
    JOIN participants t1p2 ON t1.player2_id = t1p2.id
    JOIN participants t2p1 ON t2.player1_id = t2p1.id
    JOIN participants t2p2 ON t2.player2_id = t2p2.id
    WHERE m.tournament_id=? AND m.status='completed' AND m.winner_team IS NOT NULL
  `).bind(tid).all()

  for (const m of (completedMatches || [])) {
    const match = m as any
    const t1Clubs = new Set<string>()
    if (match.t1p1_club) t1Clubs.add(match.t1p1_club)
    if (match.t1p2_club) t1Clubs.add(match.t1p2_club)
    const t2Clubs = new Set<string>()
    if (match.t2p1_club) t2Clubs.add(match.t2p1_club)
    if (match.t2p2_club) t2Clubs.add(match.t2p2_club)

    if (match.winner_team === 1) {
      for (const c of t1Clubs) { if (clubWinLoss[c]) clubWinLoss[c].wins++ }
      for (const c of t2Clubs) { if (clubWinLoss[c]) clubWinLoss[c].losses++ }
    } else if (match.winner_team === 2) {
      for (const c of t2Clubs) { if (clubWinLoss[c]) clubWinLoss[c].wins++ }
      for (const c of t1Clubs) { if (clubWinLoss[c]) clubWinLoss[c].losses++ }
    }
  }

  const clubStatsArr = (clubResults || []).map((cr: any) => ({
    club: cr.club,
    player_count: cr.player_count,
    team_count: cr.team_count,
    wins: clubWinLoss[cr.club]?.wins || 0,
    losses: clubWinLoss[cr.club]?.losses || 0,
    win_rate: (clubWinLoss[cr.club]?.wins || 0) + (clubWinLoss[cr.club]?.losses || 0) > 0
      ? Math.round((clubWinLoss[cr.club]?.wins || 0) / ((clubWinLoss[cr.club]?.wins || 0) + (clubWinLoss[cr.club]?.losses || 0)) * 100)
      : 0
  }))

  // 참가자 통계
  const pStats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN gender='m' THEN 1 END) as male,
      COUNT(CASE WHEN gender='f' THEN 1 END) as female,
      COUNT(CASE WHEN paid=1 THEN 1 END) as paid,
      COUNT(CASE WHEN checked_in=1 THEN 1 END) as checked_in,
      COUNT(CASE WHEN mixed_doubles=1 THEN 1 END) as mixed_doubles
    FROM participants WHERE tournament_id=? AND deleted=0
  `).bind(tid).first()

  // 급수 분포
  const { results: levelDist } = await db.prepare(`
    SELECT level, COUNT(*) as count FROM participants 
    WHERE tournament_id=? AND deleted=0 GROUP BY level ORDER BY level
  `).bind(tid).all()

  return c.json({
    tournament: { id: tournament.id, name: tournament.name, format: tournament.format, courts: tournament.courts, status: tournament.status },
    match_stats: matchStats,
    event_stats: eventStats || [],
    court_stats: courtStats,
    club_stats: clubStatsArr,
    participant_stats: pStats,
    level_distribution: levelDist || [],
    progress: matchStats?.total > 0 ? Math.round((matchStats.completed || 0) / matchStats.total * 100) : 0
  })
})

// =============================================
// ★ 참가자 페이지 API ★
// =============================================
// 참가자 본인 경기 조회 (이름+연락처로 조회)
matchRoutes.get('/:tid/my-matches', async (c) => {
  const tid = c.req.param('tid')
  const name = c.req.query('name') || ''
  const phone = c.req.query('phone') || ''
  const db = c.env.DB

  if (!name) return c.json({ error: '이름을 입력해주세요.' }, 400)

  // 참가자 검색
  let participant: any
  if (phone) {
    participant = await db.prepare(
      `SELECT * FROM participants WHERE tournament_id=? AND name=? AND phone=? AND deleted=0`
    ).bind(tid, name, phone).first()
  }
  if (!participant) {
    participant = await db.prepare(
      `SELECT * FROM participants WHERE tournament_id=? AND name=? AND deleted=0`
    ).bind(tid, name).first()
  }
  if (!participant) return c.json({ error: '참가자를 찾을 수 없습니다.' }, 404)

  // 참가자가 속한 팀 조회
  const { results: teams } = await db.prepare(`
    SELECT t.*, e.name as event_name, e.category, e.level_group, t.group_num,
      p1.name as p1_name, p2.name as p2_name
    FROM teams t
    JOIN events e ON t.event_id = e.id
    JOIN participants p1 ON t.player1_id = p1.id
    JOIN participants p2 ON t.player2_id = p2.id
    WHERE (t.player1_id=? OR t.player2_id=?) AND t.tournament_id=?
  `).bind(participant.id, participant.id, tid).all()

  // 참가자가 속한 팀의 경기 조회
  const teamIds = (teams || []).map((t: any) => t.id)
  let matches: any[] = []
  if (teamIds.length > 0) {
    const placeholders = teamIds.map(() => '?').join(',')
    const { results } = await db.prepare(`
      SELECT m.*, e.name as event_name,
        t1.team_name as team1_name, t2.team_name as team2_name
      FROM matches m
      JOIN events e ON m.event_id = e.id
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      WHERE (m.team1_id IN (${placeholders}) OR m.team2_id IN (${placeholders}))
      ORDER BY m.event_id, m.round, m.match_order
    `).bind(...teamIds, ...teamIds).all()
    matches = results || []
  }

  // 전적 계산
  let wins = 0, losses = 0, totalScore = 0, totalLost = 0
  for (const m of matches) {
    const match = m as any
    if (match.status !== 'completed') continue
    const isTeam1 = teamIds.includes(match.team1_id)
    if ((isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2)) wins++
    else losses++
    totalScore += isTeam1 ? (match.team1_set1 || 0) : (match.team2_set1 || 0)
    totalLost += isTeam1 ? (match.team2_set1 || 0) : (match.team1_set1 || 0)
  }

  return c.json({
    participant: {
      id: participant.id,
      name: participant.name,
      gender: participant.gender,
      level: participant.level,
      club: participant.club,
      birth_year: participant.birth_year,
      paid: participant.paid,
      checked_in: participant.checked_in
    },
    teams: teams || [],
    matches,
    record: { wins, losses, total_score: totalScore, total_lost: totalLost },
    total_matches: matches.length,
    completed_matches: matches.filter((m: any) => m.status === 'completed').length,
    upcoming_matches: matches.filter((m: any) => m.status === 'pending' || m.status === 'playing')
  })
})

// 경기 서명 저장
matchRoutes.put('/:tid/matches/:mid/signature', async (c) => {
  const tid = c.req.param('tid')
  const mid = c.req.param('mid')
  const db = c.env.DB
  const body = await c.req.json()
  const { winner_signature, loser_signature } = body

  const match = await db.prepare(
    `SELECT * FROM matches WHERE id=? AND tournament_id=?`
  ).bind(mid, tid).first()

  if (!match) return c.json({ error: '경기를 찾을 수 없습니다.' }, 404)

  await db.prepare(
    `UPDATE matches SET 
      winner_signature=?, loser_signature=?, signature_at=datetime('now'), updated_at=datetime('now')
     WHERE id=? AND tournament_id=?`
  ).bind(
    winner_signature || null, loser_signature || null, mid, tid
  ).run()

  // 감사 로그
  await db.prepare(
    `INSERT INTO audit_logs (tournament_id, match_id, action, new_value, updated_by)
     VALUES (?, ?, 'SIGNATURE', ?, 'court')`
  ).bind(
    tid, mid,
    JSON.stringify({ has_winner_sig: !!winner_signature, has_loser_sig: !!loser_signature })
  ).run()

  return c.json({ message: '서명이 저장되었습니다.' })
})

// 경기 서명 조회
matchRoutes.get('/:tid/matches/:mid/signature', async (c) => {
  const tid = c.req.param('tid')
  const mid = c.req.param('mid')
  const db = c.env.DB

  const match = await db.prepare(
    `SELECT id, winner_signature, loser_signature, signature_at FROM matches WHERE id=? AND tournament_id=?`
  ).bind(mid, tid).first()

  if (!match) return c.json({ error: '경기를 찾을 수 없습니다.' }, 404)

  return c.json({
    match_id: match.id,
    winner_signature: match.winner_signature,
    loser_signature: match.loser_signature,
    signature_at: match.signature_at
  })
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
    // 1세트 단판: set1만 사용
    const t1Score = match.team1_set1 || 0
    const t2Score = match.team2_set1 || 0

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

// 코트별 타임라인 API — 경량화: 짧은 키 + 완료 경기는 점수만
matchRoutes.get('/:tid/timeline', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  const tournament = await db.prepare(
    'SELECT id, name, courts, format FROM tournaments WHERE id = ? AND deleted = 0'
  ).bind(tid).first()
  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다' }, 404)

  // 최소 필드만 조회 (team_name 은 비완료 경기만 필요하지만, 툴팁에서 쓰이므로 유지)
  const matches = await db.prepare(`
    SELECT m.id, m.match_order as o, m.court_number as c,
      m.team1_set1+m.team1_set2+m.team1_set3 as s1,
      m.team2_set1+m.team2_set2+m.team2_set3 as s2,
      m.status as st, m.winner_team as w, m.group_num as g,
      e.category as cat,
      t1.team_name as t1, t2.team_name as t2
    FROM matches m
    JOIN events e ON m.event_id = e.id
    LEFT JOIN teams t1 ON m.team1_id = t1.id
    LEFT JOIN teams t2 ON m.team2_id = t2.id
    WHERE m.tournament_id = ?
    ORDER BY m.court_number ASC, m.match_order ASC
  `).bind(tid).all()

  // 코트별 그룹핑 — 배열 인덱스 사용
  const numCourts = (tournament as any).courts || 6
  const courts: any[][] = []
  for (let i = 0; i <= numCourts; i++) courts.push([])

  let cntDone = 0, cntPlay = 0, cntPend = 0
  for (const m of (matches.results || []) as any[]) {
    const cn = m.c
    if (cn >= 1 && cn <= numCourts) {
      courts[cn].push([m.st, m.cat, m.s1, m.s2, m.w, m.g, m.t1, m.t2, m.o])
      // idx:               0      1     2    3   4   5   6    7    8
    }
    if (m.st === 'completed') cntDone++
    else if (m.st === 'playing') cntPlay++
    else cntPend++
  }

  return c.json({
    t: { id: (tournament as any).id, n: (tournament as any).name, c: numCourts, f: (tournament as any).format },
    // courts[0] is unused, courts[1..N] are arrays of match-tuples
    d: courts.slice(1),
    s: [cntDone, cntPlay, cntPend]
  })
})
