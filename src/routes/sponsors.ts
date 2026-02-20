import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const sponsorRoutes = new Hono<{ Bindings: Bindings }>()

// 스폰서 목록 조회 (공개)
sponsorRoutes.get('/:tid/sponsors', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const sponsors = await db.prepare(
    `SELECT id, name, image_url, link_url, position, sort_order FROM sponsors WHERE tournament_id=? AND is_active=1 ORDER BY sort_order ASC, id ASC`
  ).bind(tid).all()
  return c.json(sponsors.results || [])
})

// 스폰서 추가
sponsorRoutes.post('/:tid/sponsors', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { name, image_url, link_url, position, sort_order } = await c.req.json()
  if (!name || !image_url) return c.json({ error: '이름과 이미지 URL은 필수입니다.' }, 400)
  const result = await db.prepare(
    `INSERT INTO sponsors (tournament_id, name, image_url, link_url, position, sort_order) VALUES (?,?,?,?,?,?)`
  ).bind(tid, name, image_url, link_url || '', position || 'all', sort_order || 0).run()
  return c.json({ id: result.meta.last_row_id, name, image_url })
})

// 스폰서 삭제
sponsorRoutes.delete('/:tid/sponsors/:sid', async (c) => {
  const { tid, sid } = c.req.param()
  const db = c.env.DB
  await db.prepare(`DELETE FROM sponsors WHERE id=? AND tournament_id=?`).bind(sid, tid).run()
  return c.json({ success: true })
})

// 스폰서 수정 (활성/비활성 토글 포함)
sponsorRoutes.put('/:tid/sponsors/:sid', async (c) => {
  const { tid, sid } = c.req.param()
  const db = c.env.DB
  const body = await c.req.json()
  const fields: string[] = []
  const vals: any[] = []
  if (body.name !== undefined) { fields.push('name=?'); vals.push(body.name) }
  if (body.image_url !== undefined) { fields.push('image_url=?'); vals.push(body.image_url) }
  if (body.link_url !== undefined) { fields.push('link_url=?'); vals.push(body.link_url) }
  if (body.position !== undefined) { fields.push('position=?'); vals.push(body.position) }
  if (body.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(body.sort_order) }
  if (body.is_active !== undefined) { fields.push('is_active=?'); vals.push(body.is_active) }
  if (fields.length === 0) return c.json({ error: '변경할 필드가 없습니다.' }, 400)
  vals.push(sid, tid)
  await db.prepare(`UPDATE sponsors SET ${fields.join(',')} WHERE id=? AND tournament_id=?`).bind(...vals).run()
  return c.json({ success: true })
})

export { sponsorRoutes }
