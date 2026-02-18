import { Hono } from 'hono'

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
  return c.json({ tournament })
})

// 대회 생성
tournamentRoutes.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { name, description, format, games_per_player, courts, merge_threshold, admin_password } = body

  if (!name || !admin_password) {
    return c.json({ error: '대회명과 관리자 비밀번호는 필수입니다.' }, 400)
  }

  const result = await db.prepare(
    `INSERT INTO tournaments (name, description, format, games_per_player, courts, merge_threshold, admin_password)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    name,
    description || '',
    format || 'kdk',
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

  const { name, description, format, status, games_per_player, courts, merge_threshold } = body
  await db.prepare(
    `UPDATE tournaments SET name=?, description=?, format=?, status=?, games_per_player=?, courts=?, merge_threshold=?, updated_at=datetime('now')
     WHERE id=? AND deleted=0`
  ).bind(name, description, format, status, games_per_player, courts, merge_threshold || 4, id).run()

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
