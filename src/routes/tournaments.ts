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
  const { name, description, format, max_participants, games_per_player, courts, admin_password } = body

  if (!name || !admin_password) {
    return c.json({ error: '대회명과 관리자 비밀번호는 필수입니다.' }, 400)
  }

  const result = await db.prepare(
    `INSERT INTO tournaments (name, description, format, max_participants, games_per_player, courts, admin_password)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    name,
    description || '',
    format || 'kdk',
    max_participants || 32,
    games_per_player || 4,
    courts || 2,
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

  const { name, description, format, status, max_participants, games_per_player, courts } = body
  await db.prepare(
    `UPDATE tournaments SET name=?, description=?, format=?, status=?, max_participants=?, games_per_player=?, courts=?, updated_at=datetime('now')
     WHERE id=? AND deleted=0`
  ).bind(name, description, format, status, max_participants, games_per_player, courts, id).run()

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
