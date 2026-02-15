import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const participantRoutes = new Hono<{ Bindings: Bindings }>()

// 참가자 목록 조회
participantRoutes.get('/:tid/participants', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 ORDER BY created_at ASC`
  ).bind(tid).all()
  return c.json({ participants: results })
})

// 참가자 등록
participantRoutes.post('/:tid/participants', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json()
  const { name, phone, level } = body

  if (!name) return c.json({ error: '이름은 필수입니다.' }, 400)

  // 대회 상태 확인
  const tournament = await db.prepare(
    `SELECT status, max_participants FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first()

  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)
  if (tournament.status !== 'draft' && tournament.status !== 'open') {
    return c.json({ error: '현재 참가 접수가 불가능한 상태입니다.' }, 400)
  }

  // 현재 참가자 수 확인
  const count = await db.prepare(
    `SELECT COUNT(*) as count FROM participants WHERE tournament_id=? AND deleted=0`
  ).bind(tid).first()

  if (count && (count.count as number) >= (tournament.max_participants as number)) {
    return c.json({ error: '참가자 정원이 초과되었습니다.' }, 400)
  }

  // 중복 이름 확인
  const existing = await db.prepare(
    `SELECT id FROM participants WHERE tournament_id=? AND name=? AND deleted=0`
  ).bind(tid, name).first()
  if (existing) return c.json({ error: '이미 등록된 이름입니다.' }, 400)

  const result = await db.prepare(
    `INSERT INTO participants (tournament_id, name, phone, level) VALUES (?, ?, ?, ?)`
  ).bind(tid, name, phone || '', level || 'c').run()

  return c.json({ id: result.meta.last_row_id, message: '참가자가 등록되었습니다.' }, 201)
})

// 참가자 수정
participantRoutes.put('/:tid/participants/:pid', async (c) => {
  const tid = c.req.param('tid')
  const pid = c.req.param('pid')
  const db = c.env.DB
  const body = await c.req.json()
  const { name, phone, level, paid, checked_in } = body

  await db.prepare(
    `UPDATE participants SET name=?, phone=?, level=?, paid=?, checked_in=? WHERE id=? AND tournament_id=? AND deleted=0`
  ).bind(name, phone || '', level || 'c', paid ? 1 : 0, checked_in ? 1 : 0, pid, tid).run()

  return c.json({ message: '참가자 정보가 수정되었습니다.' })
})

// 참가자 삭제 (soft delete)
participantRoutes.delete('/:tid/participants/:pid', async (c) => {
  const tid = c.req.param('tid')
  const pid = c.req.param('pid')
  const db = c.env.DB

  await db.prepare(
    `UPDATE participants SET deleted=1, deleted_at=datetime('now') WHERE id=? AND tournament_id=?`
  ).bind(pid, tid).run()

  return c.json({ message: '참가자가 삭제되었습니다.' })
})

// 참가비 납부 토글
participantRoutes.patch('/:tid/participants/:pid/paid', async (c) => {
  const tid = c.req.param('tid')
  const pid = c.req.param('pid')
  const db = c.env.DB

  const p = await db.prepare(
    `SELECT paid FROM participants WHERE id=? AND tournament_id=? AND deleted=0`
  ).bind(pid, tid).first()

  if (!p) return c.json({ error: '참가자를 찾을 수 없습니다.' }, 404)

  await db.prepare(
    `UPDATE participants SET paid=? WHERE id=? AND tournament_id=?`
  ).bind(p.paid ? 0 : 1, pid, tid).run()

  return c.json({ paid: !p.paid })
})

// 체크인 토글
participantRoutes.patch('/:tid/participants/:pid/checkin', async (c) => {
  const tid = c.req.param('tid')
  const pid = c.req.param('pid')
  const db = c.env.DB

  const p = await db.prepare(
    `SELECT checked_in FROM participants WHERE id=? AND tournament_id=? AND deleted=0`
  ).bind(pid, tid).first()

  if (!p) return c.json({ error: '참가자를 찾을 수 없습니다.' }, 404)

  await db.prepare(
    `UPDATE participants SET checked_in=? WHERE id=? AND tournament_id=?`
  ).bind(p.checked_in ? 0 : 1, pid, tid).run()

  return c.json({ checked_in: !p.checked_in })
})
