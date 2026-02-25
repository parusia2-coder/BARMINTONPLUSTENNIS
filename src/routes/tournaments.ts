import { Hono } from 'hono'
import { sportConfig, badmintonConfig, tennisConfig } from '../config'

type Bindings = { DB: D1Database }

export const tournamentRoutes = new Hono<{ Bindings: Bindings }>()

// 대회 목록 조회
tournamentRoutes.get('/', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT * FROM tournaments WHERE deleted = 0 ORDER BY created_at DESC`
  ).all()
  return c.json({ tournaments: results })
})

// 대회 상세 조회
tournamentRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const tournament = await db.prepare(
    `SELECT * FROM tournaments WHERE id = ? AND deleted = 0`
  ).bind(id).first()
  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  // 장소 목록도 함께 반환
  const { results: venues } = await db.prepare(
    `SELECT * FROM venues WHERE tournament_id=? ORDER BY sort_order ASC, court_start ASC`
  ).bind(id).all()

  return c.json({ tournament, venues: venues || [] })
})

// 대회 생성
tournamentRoutes.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { name, description, format, games_per_player, courts, merge_threshold, admin_password, scoring_type, target_games, deuce_rule, sport } = body

  if (!name || !admin_password) {
    return c.json({ error: '대회명과 관리자 비밀번호는 필수입니다.' }, 400)
  }

  // 선택된 종목에 맞는 config 사용
  const selectedSport = (sport === 'tennis') ? 'tennis' : 'badminton'
  const sc = selectedSport === 'tennis' ? tennisConfig : badmintonConfig

  const result = await db.prepare(
    `INSERT INTO tournaments (name, description, format, sport, scoring_type, target_games, deuce_rule, games_per_player, courts, merge_threshold, admin_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    name,
    description || '',
    format || 'kdk',
    selectedSport,
    scoring_type || (sc.scoring.scoringTypes?.[0]?.value || ''),
    target_games || sc.scoring.defaultTargetScore,
    deuce_rule || (sc.scoring.deuceRules?.[0]?.value || ''),
    games_per_player || 4,
    courts || 2,
    merge_threshold || 4,
    admin_password
  ).run()

  return c.json({ id: result.meta.last_row_id, message: '대회가 생성되었습니다.' }, 201)
})

// 대회 수정
tournamentRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const body = await c.req.json()

  // 관리자 인증
  const tournament = await db.prepare(`SELECT admin_password FROM tournaments WHERE id = ?`).bind(id).first()
  if (!tournament || tournament.admin_password !== body.admin_password) {
    return c.json({ error: '관리자 인증 실패' }, 403)
  }

  const { name, description, format, status, games_per_player, courts, merge_threshold, scoring_type, target_games, deuce_rule, sport } = body

  // 선택된 종목에 맞는 config 사용
  const selectedSport = sport || 'badminton'
  const sc = selectedSport === 'tennis' ? tennisConfig : badmintonConfig

  await db.prepare(
    `UPDATE tournaments SET name=?, description=?, format=?, status=?, sport=?, scoring_type=?, target_games=?, deuce_rule=?, games_per_player=?, courts=?, merge_threshold=?, updated_at=datetime('now')
     WHERE id=? AND deleted=0`
  ).bind(name, description, format, status, selectedSport, scoring_type || '', target_games || sc.scoring.defaultTargetScore, deuce_rule || '', games_per_player, courts, merge_threshold || 4, id).run()

  return c.json({ message: '대회가 수정되었습니다.' })
})

// 대회 상태 변경
tournamentRoutes.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const { status, admin_password } = await c.req.json()

  const tournament = await db.prepare(`SELECT admin_password FROM tournaments WHERE id = ?`).bind(id).first()
  if (!tournament || tournament.admin_password !== admin_password) {
    return c.json({ error: '관리자 인증 실패' }, 403)
  }

  await db.prepare(
    `UPDATE tournaments SET status=?, updated_at=datetime('now') WHERE id=?`
  ).bind(status, id).run()

  return c.json({ message: `대회 상태가 '${status}'로 변경되었습니다.` })
})

// 대회 삭제 (soft delete)
tournamentRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const { admin_password } = await c.req.json()

  const tournament = await db.prepare(`SELECT admin_password FROM tournaments WHERE id = ?`).bind(id).first()
  if (!tournament || tournament.admin_password !== admin_password) {
    return c.json({ error: '관리자 인증 실패' }, 403)
  }

  await db.prepare(
    `UPDATE tournaments SET deleted=1, deleted_at=datetime('now') WHERE id=?`
  ).bind(id).run()

  return c.json({ message: '대회가 삭제되었습니다.' })
})

// 대회 관리자 인증
tournamentRoutes.post('/:id/auth', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const { admin_password } = await c.req.json()

  const tournament = await db.prepare(
    `SELECT id, name, admin_password FROM tournaments WHERE id = ? AND deleted = 0`
  ).bind(id).first()

  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)
  if (tournament.admin_password !== admin_password) return c.json({ error: '비밀번호가 일치하지 않습니다.' }, 403)

  return c.json({ authenticated: true, tournament_name: tournament.name })
})

// 대회 통계
tournamentRoutes.get('/:id/stats', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  const participantCount = await db.prepare(
    `SELECT COUNT(*) as count FROM participants WHERE tournament_id=? AND deleted=0`
  ).bind(id).first()

  const matchStats = await db.prepare(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status='playing' THEN 1 ELSE 0 END) as playing,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending
     FROM matches WHERE tournament_id=?`
  ).bind(id).first()

  return c.json({
    participants: participantCount?.count || 0,
    matches: matchStats || { total: 0, completed: 0, playing: 0, pending: 0 }
  })
})

// =============================================
// 인쇄 전용 통합 API (1회 호출로 모든 데이터 반환)
// =============================================
tournamentRoutes.get('/:id/print-data', async (c) => {
  const tid = c.req.param('id')
  const db = c.env.DB

  // 모든 쿼리를 병렬 실행
  const [tournament, participants, events, matches, teams] = await Promise.all([
    // 대회 정보
    db.prepare(`SELECT * FROM tournaments WHERE id=? AND deleted=0`).bind(tid).first(),
    // 참가자 전체
    db.prepare(`SELECT * FROM participants WHERE tournament_id=? AND deleted=0 ORDER BY club, name`).bind(tid).all(),
    // 종목 전체
    db.prepare(`SELECT * FROM events WHERE tournament_id=? ORDER BY category, age_group, level_group`).bind(tid).all(),
    // 경기 전체 (팀명 JOIN)
    db.prepare(`
      SELECT m.*, e.name as event_name, e.category,
        t1.team_name as team1_name, t2.team_name as team2_name
      FROM matches m
      JOIN events e ON m.event_id = e.id
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      WHERE m.tournament_id=?
      ORDER BY m.court_number, m.round, m.match_order
    `).bind(tid).all(),
    // 팀 전체 (선수 정보 JOIN)
    db.prepare(`
      SELECT t.*, t.group_num,
        p1.name as p1_name, p1.level as p1_level, p1.gender as p1_gender, p1.birth_year as p1_birth_year, p1.club as p1_club,
        p2.name as p2_name, p2.level as p2_level, p2.gender as p2_gender, p2.birth_year as p2_birth_year, p2.club as p2_club
      FROM teams t
      LEFT JOIN participants p1 ON t.player1_id = p1.id
      LEFT JOIN participants p2 ON t.player2_id = p2.id
      WHERE t.tournament_id=?
      ORDER BY t.event_id, t.group_num, t.created_at
    `).bind(tid).all()
  ])

  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  // 팀을 종목별로 그룹핑
  const teamsByEvent: Record<number, any[]> = {}
  for (const t of (teams.results || [])) {
    const eid = t.event_id as number
    if (!teamsByEvent[eid]) teamsByEvent[eid] = []
    teamsByEvent[eid].push(t)
  }

  return c.json({
    tournament,
    participants: participants.results || [],
    events: events.results || [],
    matches: matches.results || [],
    teamsByEvent
  })
})

// =============================================
// 🔴 대회 데이터 전체 내보내기 (JSON Export)
// =============================================
tournamentRoutes.get('/:id/export', async (c) => {
  const tid = c.req.param('id')
  const db = c.env.DB

  const [tournament, participants, events, matches, teams, standings] = await Promise.all([
    db.prepare(`SELECT * FROM tournaments WHERE id=? AND deleted=0`).bind(tid).first(),
    db.prepare(`SELECT * FROM participants WHERE tournament_id=? AND deleted=0 ORDER BY id`).bind(tid).all(),
    db.prepare(`SELECT * FROM events WHERE tournament_id=? ORDER BY id`).bind(tid).all(),
    db.prepare(`SELECT * FROM matches WHERE tournament_id=? ORDER BY id`).bind(tid).all(),
    db.prepare(`SELECT * FROM teams WHERE tournament_id=? ORDER BY id`).bind(tid).all(),
    db.prepare(`SELECT * FROM standings WHERE tournament_id=? ORDER BY event_id, rank`).bind(tid).all()
  ])

  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  const exportData = {
    _meta: {
      version: '3.2',
      exported_at: new Date().toISOString(),
      system: sportConfig.name
    },
    tournament,
    participants: participants.results || [],
    events: events.results || [],
    teams: teams.results || [],
    matches: matches.results || [],
    standings: standings.results || []
  }

  return c.json(exportData)
})

// =============================================
// 🔴 대회 데이터 가져오기 (JSON Import)
// =============================================
tournamentRoutes.post('/import', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()

  if (!body._meta || !body.tournament) {
    return c.json({ error: '유효하지 않은 백업 파일입니다.' }, 400)
  }

  const t = body.tournament
  // 새 대회 생성
  const newT = await db.prepare(
    `INSERT INTO tournaments (name, description, status, format, games_per_player, courts, merge_threshold, admin_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    `[복원] ${t.name}`, t.description || '', t.status || 'draft',
    t.format || 'kdk', t.games_per_player || 4, t.courts || 2,
    t.merge_threshold || 4, t.admin_password || 'admin123'
  ).run()
  const newTid = newT.meta.last_row_id

  // ID 매핑 테이블
  const pMap: Record<number, number> = {}   // old participant id → new
  const eMap: Record<number, number> = {}   // old event id → new
  const tMap: Record<number, number> = {}   // old team id → new

  // 참가자 복원
  for (const p of (body.participants || [])) {
    const r = await db.prepare(
      `INSERT INTO participants (tournament_id, name, phone, gender, birth_year, level, paid, checked_in, club, mixed_doubles)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newTid, p.name, p.phone || '', p.gender || 'm', p.birth_year, p.level || 'c',
      p.paid || 0, p.checked_in || 0, p.club || '', p.mixed_doubles || 0).run()
    pMap[p.id] = r.meta.last_row_id as number
  }

  // 종목 복원
  for (const e of (body.events || [])) {
    const r = await db.prepare(
      `INSERT INTO events (tournament_id, category, age_group, level_group, name, status, merged_from)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(newTid, e.category, e.age_group || 'open', e.level_group || 'all',
      e.name, e.status || 'pending', e.merged_from || null).run()
    eMap[e.id] = r.meta.last_row_id as number
  }

  // 팀 복원
  for (const team of (body.teams || [])) {
    const p1 = pMap[team.player1_id] || team.player1_id
    const p2 = pMap[team.player2_id] || team.player2_id
    const eid = eMap[team.event_id] || team.event_id
    const r = await db.prepare(
      `INSERT INTO teams (event_id, tournament_id, player1_id, player2_id, team_name, group_num)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(eid, newTid, p1, p2, team.team_name || '', team.group_num || null).run()
    tMap[team.id] = r.meta.last_row_id as number
  }

  // 경기 복원
  for (const m of (body.matches || [])) {
    const eid = eMap[m.event_id] || m.event_id
    const t1 = tMap[m.team1_id] || m.team1_id
    const t2 = tMap[m.team2_id] || m.team2_id
    await db.prepare(
      `INSERT INTO matches (tournament_id, event_id, round, match_order, court_number,
        team1_id, team2_id, team1_set1, team1_set2, team1_set3,
        team2_set1, team2_set2, team2_set3, status, winner_team, group_num)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newTid, eid, m.round || 1, m.match_order || 0, m.court_number,
      t1, t2, m.team1_set1 || 0, m.team1_set2 || 0, m.team1_set3 || 0,
      m.team2_set1 || 0, m.team2_set2 || 0, m.team2_set3 || 0,
      m.status || 'pending', m.winner_team || null, m.group_num || null).run()
  }

  // 순위 복원
  for (const s of (body.standings || [])) {
    const eid = eMap[s.event_id] || s.event_id
    const tid2 = tMap[s.team_id] || s.team_id
    await db.prepare(
      `INSERT OR IGNORE INTO standings (tournament_id, event_id, team_id, wins, losses, points, score_for, score_against, goal_difference, rank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newTid, eid, tid2, s.wins || 0, s.losses || 0, s.points || 0,
      s.score_for || 0, s.score_against || 0, s.goal_difference || 0, s.rank || 0).run()
  }

  return c.json({
    message: '대회 데이터 복원 완료!',
    tournament_id: newTid,
    stats: {
      participants: Object.keys(pMap).length,
      events: Object.keys(eMap).length,
      teams: Object.keys(tMap).length,
      matches: (body.matches || []).length
    }
  }, 201)
})
