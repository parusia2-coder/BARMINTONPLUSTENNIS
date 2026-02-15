import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const eventRoutes = new Hono<{ Bindings: Bindings }>()

const CATEGORY_LABELS: Record<string, string> = { md: '남자복식', wd: '여자복식', xd: '혼합복식' }
const LEVEL_LABELS: Record<string, string> = { s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', all: '전체' }

// 종목 목록 조회
eventRoutes.get('/:tid/events', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT * FROM events WHERE tournament_id=? ORDER BY category, age_group, level_group`
  ).bind(tid).all()

  // 각 종목별 팀 수 포함
  const events = []
  for (const ev of (results || [])) {
    const teamCount = await db.prepare(
      `SELECT COUNT(*) as count FROM teams WHERE event_id=?`
    ).bind(ev.id).first()
    events.push({ ...ev, team_count: teamCount?.count || 0 })
  }

  return c.json({ events })
})

// 종목 생성
eventRoutes.post('/:tid/events', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json()
  const { category, age_group, level_group } = body

  if (!category) return c.json({ error: '종목 유형을 선택해주세요.' }, 400)

  const catLabel = CATEGORY_LABELS[category] || category
  const lvLabel = level_group === 'all' ? '전체' : (LEVEL_LABELS[level_group] || level_group) + '급'
  const ageLabel = age_group === 'open' ? '오픈' : age_group
  const name = `${catLabel} ${ageLabel} ${lvLabel}`

  // 중복 검사
  const existing = await db.prepare(
    `SELECT id FROM events WHERE tournament_id=? AND category=? AND age_group=? AND level_group=?`
  ).bind(tid, category, age_group || 'open', level_group || 'all').first()
  if (existing) return c.json({ error: '이미 동일한 종목이 존재합니다.' }, 400)

  const result = await db.prepare(
    `INSERT INTO events (tournament_id, category, age_group, level_group, name) VALUES (?, ?, ?, ?, ?)`
  ).bind(tid, category, age_group || 'open', level_group || 'all', name).run()

  return c.json({ id: result.meta.last_row_id, name, message: '종목이 생성되었습니다.' }, 201)
})

// 종목 삭제
eventRoutes.delete('/:tid/events/:eid', async (c) => {
  const tid = c.req.param('tid')
  const eid = c.req.param('eid')
  const db = c.env.DB

  await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(eid).run()
  await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(eid).run()
  await db.prepare(`DELETE FROM teams WHERE event_id=?`).bind(eid).run()
  await db.prepare(`DELETE FROM events WHERE id=? AND tournament_id=?`).bind(eid, tid).run()

  return c.json({ message: '종목이 삭제되었습니다.' })
})

// 종목에 팀 등록
eventRoutes.post('/:tid/events/:eid/teams', async (c) => {
  const tid = c.req.param('tid')
  const eid = c.req.param('eid')
  const db = c.env.DB
  const { player1_id, player2_id } = await c.req.json()

  if (!player1_id || !player2_id) return c.json({ error: '두 명의 선수를 선택해주세요.' }, 400)
  if (player1_id === player2_id) return c.json({ error: '서로 다른 선수를 선택해주세요.' }, 400)

  // 종목 정보 확인
  const event = await db.prepare(`SELECT * FROM events WHERE id=? AND tournament_id=?`).bind(eid, tid).first() as any
  if (!event) return c.json({ error: '종목을 찾을 수 없습니다.' }, 404)

  // 선수 정보 확인
  const p1 = await db.prepare(`SELECT * FROM participants WHERE id=? AND tournament_id=? AND deleted=0`).bind(player1_id, tid).first() as any
  const p2 = await db.prepare(`SELECT * FROM participants WHERE id=? AND tournament_id=? AND deleted=0`).bind(player2_id, tid).first() as any
  if (!p1 || !p2) return c.json({ error: '선수 정보를 찾을 수 없습니다.' }, 404)

  // 성별 검증
  if (event.category === 'md' && (p1.gender !== 'm' || p2.gender !== 'm')) {
    return c.json({ error: '남자복식에는 남자 선수만 등록 가능합니다.' }, 400)
  }
  if (event.category === 'wd' && (p1.gender !== 'f' || p2.gender !== 'f')) {
    return c.json({ error: '여자복식에는 여자 선수만 등록 가능합니다.' }, 400)
  }
  if (event.category === 'xd') {
    if (!((p1.gender === 'm' && p2.gender === 'f') || (p1.gender === 'f' && p2.gender === 'm'))) {
      return c.json({ error: '혼합복식에는 남녀 한 명씩 등록해야 합니다.' }, 400)
    }
  }

  // 중복 팀 검사 (같은 종목에 같은 조합)
  const dup = await db.prepare(
    `SELECT id FROM teams WHERE event_id=? AND 
     ((player1_id=? AND player2_id=?) OR (player1_id=? AND player2_id=?))`
  ).bind(eid, player1_id, player2_id, player2_id, player1_id).first()
  if (dup) return c.json({ error: '이미 등록된 팀 조합입니다.' }, 400)

  const teamName = `${p1.name} · ${p2.name}`
  const result = await db.prepare(
    `INSERT INTO teams (event_id, tournament_id, player1_id, player2_id, team_name) VALUES (?, ?, ?, ?, ?)`
  ).bind(eid, tid, player1_id, player2_id, teamName).run()

  return c.json({ id: result.meta.last_row_id, team_name: teamName, message: '팀이 등록되었습니다.' }, 201)
})

// 종목의 팀 목록 조회
eventRoutes.get('/:tid/events/:eid/teams', async (c) => {
  const eid = c.req.param('eid')
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT t.*, p1.name as p1_name, p1.level as p1_level, p1.gender as p1_gender, p1.birth_year as p1_birth_year,
            p2.name as p2_name, p2.level as p2_level, p2.gender as p2_gender, p2.birth_year as p2_birth_year
     FROM teams t
     JOIN participants p1 ON t.player1_id = p1.id
     JOIN participants p2 ON t.player2_id = p2.id
     WHERE t.event_id=?
     ORDER BY t.created_at ASC`
  ).bind(eid).all()
  return c.json({ teams: results || [] })
})

// 팀 삭제
eventRoutes.delete('/:tid/events/:eid/teams/:teamId', async (c) => {
  const eid = c.req.param('eid')
  const teamId = c.req.param('teamId')
  const db = c.env.DB
  await db.prepare(`DELETE FROM teams WHERE id=? AND event_id=?`).bind(teamId, eid).run()
  return c.json({ message: '팀이 삭제되었습니다.' })
})

// 급수 합병 체크 및 실행
eventRoutes.post('/:tid/events/check-merge', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  const tournament = await db.prepare(`SELECT * FROM tournaments WHERE id=? AND deleted=0`).bind(tid).first() as any
  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)
  const threshold = tournament.merge_threshold || 4

  const { results: events } = await db.prepare(
    `SELECT e.*, (SELECT COUNT(*) FROM teams WHERE event_id=e.id) as team_count
     FROM events e WHERE e.tournament_id=? ORDER BY e.category, e.age_group, e.level_group`
  ).bind(tid).all()

  if (!events || events.length === 0) return c.json({ merges: [], message: '종목이 없습니다.' })

  // 카테고리 + 연령대 기준으로 그룹핑
  const groups: Record<string, any[]> = {}
  for (const ev of events) {
    const key = `${(ev as any).category}_${(ev as any).age_group}`
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  }

  const merges: any[] = []

  for (const [groupKey, groupEvents] of Object.entries(groups)) {
    // 팀 부족한 종목들 찾기 (level_group='all' 또는 'merged'는 합병 대상에서 제외)
    const underEvents = groupEvents.filter((e: any) => e.team_count < threshold && e.level_group !== 'all' && e.level_group !== 'merged')
    if (underEvents.length < 2) continue

    // 인접 급수 순서로 정렬
    const levelOrder = ['s', 'a', 'b', 'c', 'd', 'e']
    underEvents.sort((a: any, b: any) => levelOrder.indexOf(a.level_group) - levelOrder.indexOf(b.level_group))

    // 인접 급수들을 합산해서 threshold 이상이 될 때까지 묶기
    let i = 0
    while (i < underEvents.length) {
      const group: any[] = [underEvents[i]]
      let totalTeams = (underEvents[i] as any).team_count
      let j = i + 1
      // 합산 팀 수가 threshold 미만이면 다음 인접 급수도 추가
      while (j < underEvents.length && totalTeams < threshold) {
        group.push(underEvents[j])
        totalTeams += (underEvents[j] as any).team_count
        j++
      }
      if (group.length >= 2) {
        const cat = (group[0] as any).category
        const age = (group[0] as any).age_group
        const levels = group.map((e: any) => LEVEL_LABELS[e.level_group] || e.level_group).join('+')
        const details = group.map((e: any) => `${e.name}: ${e.team_count}팀`).join(', ')
        merges.push({
          events: group,
          combined_teams: totalTeams,
          merged_name: `${CATEGORY_LABELS[cat]} ${age === 'open' ? '오픈' : age} ${levels}급`,
          reason: `팀 수 부족 (${details} < 기준 ${threshold}팀)`
        })
      }
      i = j
    }
  }

  return c.json({ merges, threshold })
})

// 급수 합병 실행
eventRoutes.post('/:tid/events/execute-merge', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { event_ids } = await c.req.json()

  if (!event_ids || event_ids.length < 2) {
    return c.json({ error: '합병할 종목을 2개 이상 선택해주세요.' }, 400)
  }

  // 합병 대상 종목 조회
  const events: any[] = []
  for (const eid of event_ids) {
    const ev = await db.prepare(`SELECT * FROM events WHERE id=? AND tournament_id=?`).bind(eid, tid).first()
    if (ev) events.push(ev)
  }

  if (events.length < 2) return c.json({ error: '유효한 종목이 부족합니다.' }, 400)

  // 새 합병 종목 이름 생성
  const cat = events[0].category as string
  const age = events[0].age_group as string
  const levels = events.map((e: any) => LEVEL_LABELS[e.level_group] || e.level_group).join('+')
  const mergedName = `${CATEGORY_LABELS[cat]} ${age === 'open' ? '오픈' : age} ${levels}급`

  // 새 합병 종목 생성
  const result = await db.prepare(
    `INSERT INTO events (tournament_id, category, age_group, level_group, name, merged_from) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(tid, cat, age, 'merged', mergedName, JSON.stringify(event_ids)).run()
  const newEventId = result.meta.last_row_id

  // 기존 종목의 팀을 새 종목으로 이동
  for (const eid of event_ids) {
    await db.prepare(`UPDATE teams SET event_id=? WHERE event_id=?`).bind(newEventId, eid).run()
    await db.prepare(`DELETE FROM events WHERE id=?`).bind(eid).run()
  }

  return c.json({ id: newEventId, name: mergedName, message: `${events.length}개 종목이 합병되었습니다.` })
})
