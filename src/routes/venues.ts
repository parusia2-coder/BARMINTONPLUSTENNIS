import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const venueRoutes = new Hono<{ Bindings: Bindings }>()

// ==========================================
// 장소 목록 조회
// ==========================================
venueRoutes.get('/:tid/venues', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT * FROM venues WHERE tournament_id=? ORDER BY sort_order ASC, court_start ASC`
  ).bind(tid).all()
  return c.json({ venues: results || [] })
})

// ==========================================
// 장소 상세 조회
// ==========================================
venueRoutes.get('/:tid/venues/:vid', async (c) => {
  const tid = c.req.param('tid')
  const vid = c.req.param('vid')
  const db = c.env.DB
  const venue = await db.prepare(
    `SELECT * FROM venues WHERE id=? AND tournament_id=?`
  ).bind(vid, tid).first()
  if (!venue) return c.json({ error: '장소를 찾을 수 없습니다.' }, 404)
  return c.json(venue)
})

// ==========================================
// 장소 추가
// ==========================================
venueRoutes.post('/:tid/venues', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json()
  const { name, short_name, address, court_start, court_end, sort_order } = body

  if (!name) return c.json({ error: '장소명은 필수입니다.' }, 400)
  if (!court_start || !court_end || court_end < court_start) {
    return c.json({ error: '코트 번호 범위가 올바르지 않습니다.' }, 400)
  }

  // 코트 번호 겹침 체크
  const overlap = await db.prepare(
    `SELECT id, name, court_start, court_end FROM venues 
     WHERE tournament_id=? AND (
       (court_start <= ? AND court_end >= ?) OR
       (court_start <= ? AND court_end >= ?) OR
       (court_start >= ? AND court_end <= ?)
     )`
  ).bind(tid, court_end, court_start, court_start, court_start, court_start, court_end).first()

  if (overlap) {
    return c.json({ 
      error: `코트 번호가 "${(overlap as any).name}" 장소(${(overlap as any).court_start}~${(overlap as any).court_end}번)와 겹칩니다.` 
    }, 400)
  }

  const result = await db.prepare(
    `INSERT INTO venues (tournament_id, name, short_name, address, court_start, court_end, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(tid, name, short_name || '', address || '', court_start, court_end, sort_order || 0).run()

  // 해당 범위 코트의 기존 경기에 venue_id 자동 매핑
  await db.prepare(
    `UPDATE matches SET venue_id=? WHERE tournament_id=? AND court_number >= ? AND court_number <= ? AND venue_id IS NULL`
  ).bind(result.meta.last_row_id, tid, court_start, court_end).run()

  return c.json({ id: result.meta.last_row_id, message: '장소가 추가되었습니다.' }, 201)
})

// ==========================================
// 장소 수정
// ==========================================
venueRoutes.put('/:tid/venues/:vid', async (c) => {
  const tid = c.req.param('tid')
  const vid = c.req.param('vid')
  const db = c.env.DB
  const body = await c.req.json()
  const { name, short_name, address, court_start, court_end, sort_order } = body

  if (!name) return c.json({ error: '장소명은 필수입니다.' }, 400)

  // 코트 번호 겹침 체크 (자기 자신 제외)
  if (court_start && court_end) {
    const overlap = await db.prepare(
      `SELECT id, name, court_start, court_end FROM venues 
       WHERE tournament_id=? AND id != ? AND (
         (court_start <= ? AND court_end >= ?) OR
         (court_start <= ? AND court_end >= ?) OR
         (court_start >= ? AND court_end <= ?)
       )`
    ).bind(tid, vid, court_end, court_start, court_start, court_start, court_start, court_end).first()

    if (overlap) {
      return c.json({ 
        error: `코트 번호가 "${(overlap as any).name}" 장소와 겹칩니다.` 
      }, 400)
    }
  }

  await db.prepare(
    `UPDATE venues SET name=?, short_name=?, address=?, court_start=?, court_end=?, sort_order=? WHERE id=? AND tournament_id=?`
  ).bind(name, short_name || '', address || '', court_start, court_end, sort_order || 0, vid, tid).run()

  // 해당 범위 코트의 경기에 venue_id 자동 매핑
  await db.prepare(
    `UPDATE matches SET venue_id=? WHERE tournament_id=? AND court_number >= ? AND court_number <= ?`
  ).bind(vid, tid, court_start, court_end).run()

  return c.json({ message: '장소가 수정되었습니다.' })
})

// ==========================================
// 장소 삭제
// ==========================================
venueRoutes.delete('/:tid/venues/:vid', async (c) => {
  const tid = c.req.param('tid')
  const vid = c.req.param('vid')
  const db = c.env.DB

  // 해당 장소의 경기 venue_id 해제
  await db.prepare(
    `UPDATE matches SET venue_id=NULL WHERE tournament_id=? AND venue_id=?`
  ).bind(tid, vid).run()

  await db.prepare(
    `DELETE FROM venues WHERE id=? AND tournament_id=?`
  ).bind(vid, tid).run()

  return c.json({ message: '장소가 삭제되었습니다.' })
})
