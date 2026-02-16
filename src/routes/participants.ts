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
  const { name, phone, gender, birth_year, level, mixed_doubles, club } = body

  if (!name) return c.json({ error: '이름은 필수입니다.' }, 400)
  if (!gender) return c.json({ error: '성별은 필수입니다.' }, 400)

  // 대회 상태 확인
  const tournament = await db.prepare(
    `SELECT status FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first()

  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)
  if (tournament.status !== 'draft' && tournament.status !== 'open') {
    return c.json({ error: '현재 참가 접수가 불가능한 상태입니다.' }, 400)
  }

  // 중복 이름 확인
  const existing = await db.prepare(
    `SELECT id FROM participants WHERE tournament_id=? AND name=? AND deleted=0`
  ).bind(tid, name).first()
  if (existing) return c.json({ error: '이미 등록된 이름입니다.' }, 400)

  const result = await db.prepare(
    `INSERT INTO participants (tournament_id, name, phone, gender, birth_year, level, mixed_doubles, club) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(tid, name, phone || '', gender, birth_year || null, level || 'c', mixed_doubles ? 1 : 0, club || '').run()

  return c.json({ id: result.meta.last_row_id, message: '참가자가 등록되었습니다.' }, 201)
})

// 참가자 일괄 등록
participantRoutes.post('/:tid/participants/bulk', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { participants } = await c.req.json()

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return c.json({ error: '등록할 참가자 목록이 없습니다.' }, 400)
  }

  // 대회 상태 확인
  const tournament = await db.prepare(
    `SELECT status FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first()
  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)
  if (tournament.status !== 'draft' && tournament.status !== 'open') {
    return c.json({ error: '현재 참가 접수가 불가능한 상태입니다.' }, 400)
  }

  // 기존 참가자 이름 조회
  const { results: existing } = await db.prepare(
    `SELECT name FROM participants WHERE tournament_id=? AND deleted=0`
  ).bind(tid).all()
  const existingNames = new Set((existing || []).map((e: any) => e.name))

  const results: any[] = []
  let successCount = 0
  let skipCount = 0
  const errors: string[] = []

  for (const p of participants) {
    const name = (p.name || '').trim()
    if (!name) { errors.push('이름이 비어있는 항목이 있습니다.'); skipCount++; continue }
    const gender = (p.gender || '').toLowerCase()
    if (gender !== 'm' && gender !== 'f') { errors.push(`${name}: 성별이 올바르지 않습니다. (m/f)`); skipCount++; continue }

    if (existingNames.has(name)) { errors.push(`${name}: 이미 등록된 이름입니다.`); skipCount++; continue }

    const level = (p.level || 'c').toLowerCase()
    const validLevels = ['s', 'a', 'b', 'c', 'd', 'e']
    const finalLevel = validLevels.includes(level) ? level : 'c'

    const birthYear = p.birth_year ? parseInt(p.birth_year) : null
    const phone = p.phone || ''

    const mixedDoubles = p.mixed_doubles ? 1 : 0
    const club = (p.club || '').trim()

    try {
      const res = await db.prepare(
        `INSERT INTO participants (tournament_id, name, phone, gender, birth_year, level, mixed_doubles, club) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(tid, name, phone, gender, birthYear, finalLevel, mixedDoubles, club).run()
      existingNames.add(name)
      results.push({ id: res.meta.last_row_id, name })
      successCount++
    } catch (e: any) {
      errors.push(`${name}: 등록 실패 (${e.message})`)
      skipCount++
    }
  }

  return c.json({
    message: `${successCount}명 등록 완료${skipCount > 0 ? `, ${skipCount}명 건너뜀` : ''}`,
    success_count: successCount,
    skip_count: skipCount,
    registered: results,
    errors: errors.length > 0 ? errors : undefined
  }, 201)
})

// 참가자 수정
participantRoutes.put('/:tid/participants/:pid', async (c) => {
  const tid = c.req.param('tid')
  const pid = c.req.param('pid')
  const db = c.env.DB
  const body = await c.req.json()
  const { name, phone, gender, birth_year, level, paid, checked_in, mixed_doubles, club } = body

  await db.prepare(
    `UPDATE participants SET name=?, phone=?, gender=?, birth_year=?, level=?, paid=?, checked_in=?, mixed_doubles=?, club=? WHERE id=? AND tournament_id=? AND deleted=0`
  ).bind(name, phone || '', gender || 'm', birth_year || null, level || 'c', paid ? 1 : 0, checked_in ? 1 : 0, mixed_doubles ? 1 : 0, club || '', pid, tid).run()

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

// 혼복 참가 여부 토글
participantRoutes.patch('/:tid/participants/:pid/mixed-doubles', async (c) => {
  const tid = c.req.param('tid')
  const pid = c.req.param('pid')
  const db = c.env.DB

  const p = await db.prepare(
    `SELECT mixed_doubles FROM participants WHERE id=? AND tournament_id=? AND deleted=0`
  ).bind(pid, tid).first()
  if (!p) return c.json({ error: '참가자를 찾을 수 없습니다.' }, 404)

  await db.prepare(
    `UPDATE participants SET mixed_doubles=? WHERE id=? AND tournament_id=?`
  ).bind(p.mixed_doubles ? 0 : 1, pid, tid).run()

  return c.json({ mixed_doubles: !p.mixed_doubles })
})
