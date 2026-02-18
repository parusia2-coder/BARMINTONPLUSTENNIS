import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const eventRoutes = new Hono<{ Bindings: Bindings }>()

const CATEGORY_LABELS: Record<string, string> = { md: '남자복식', wd: '여자복식', xd: '혼합복식' }
const LEVEL_LABELS: Record<string, string> = { s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', all: '전체' }
const LEVEL_ORDER: Record<string, number> = { s: 0, a: 1, b: 2, c: 3, d: 4, e: 5 }

// 종목 목록 조회
eventRoutes.get('/:tid/events', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT * FROM events WHERE tournament_id=? ORDER BY category, age_group, level_group`
  ).bind(tid).all()

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

  const existing = await db.prepare(
    `SELECT id FROM events WHERE tournament_id=? AND category=? AND age_group=? AND level_group=?`
  ).bind(tid, category, age_group || 'open', level_group || 'all').first()
  if (existing) return c.json({ error: '이미 동일한 종목이 존재합니다.' }, 400)

  const result = await db.prepare(
    `INSERT INTO events (tournament_id, category, age_group, level_group, name) VALUES (?, ?, ?, ?, ?)`
  ).bind(tid, category, age_group || 'open', level_group || 'all', name).run()

  return c.json({ id: result.meta.last_row_id, name, message: '종목이 생성되었습니다.' }, 201)
})

// =============================================
// ★ 종목 일괄 생성 (다중 종목 + 다중 연령대 + 다중 급수) ★
// =============================================
eventRoutes.post('/:tid/events/bulk-create', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json()
  const { categories, age_groups, level_groups } = body
  // categories: ['md','wd','xd'], age_groups: ['50대','55대'], level_groups: ['all'] or ['a','b']

  if (!categories || categories.length === 0) return c.json({ error: '종목을 하나 이상 선택해주세요.' }, 400)
  if (!age_groups || age_groups.length === 0) return c.json({ error: '연령대를 하나 이상 선택해주세요.' }, 400)
  const levels = (level_groups && level_groups.length > 0) ? level_groups : ['all']

  const created: any[] = []
  const skipped: string[] = []

  for (const cat of categories) {
    for (const age of age_groups) {
      for (const lv of levels) {
        const catLabel = CATEGORY_LABELS[cat] || cat
        const lvLabel = lv === 'all' ? '전체' : (LEVEL_LABELS[lv] || lv) + '급'
        const ageLabel = age === 'open' ? '오픈' : age
        const name = `${catLabel} ${ageLabel} ${lvLabel}`

        const existing = await db.prepare(
          `SELECT id FROM events WHERE tournament_id=? AND category=? AND age_group=? AND level_group=?`
        ).bind(tid, cat, age, lv).first()

        if (existing) {
          skipped.push(name)
          continue
        }

        const result = await db.prepare(
          `INSERT INTO events (tournament_id, category, age_group, level_group, name) VALUES (?, ?, ?, ?, ?)`
        ).bind(tid, cat, age, lv, name).run()

        created.push({ id: result.meta.last_row_id, name, category: cat, age_group: age, level_group: lv })
      }
    }
  }

  return c.json({
    message: `${created.length}개 종목 생성 완료${skipped.length > 0 ? `, ${skipped.length}개 중복 건너뜀` : ''}`,
    created,
    skipped,
    total_created: created.length
  }, 201)
})

// 조편성 일괄 삭제 (모든 종목의 팀/경기/순위 삭제, 종목은 유지)
eventRoutes.delete('/:tid/events/all/assignments', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  const { results: events } = await db.prepare(
    `SELECT id FROM events WHERE tournament_id=?`
  ).bind(tid).all()

  let deletedTeams = 0
  let deletedMatches = 0
  let deletedStandings = 0

  for (const ev of (events || [])) {
    const teamCount = await db.prepare(`SELECT COUNT(*) as c FROM teams WHERE event_id=?`).bind(ev.id).first() as any
    const matchCount = await db.prepare(`SELECT COUNT(*) as c FROM matches WHERE event_id=?`).bind(ev.id).first() as any
    const standingCount = await db.prepare(`SELECT COUNT(*) as c FROM standings WHERE event_id=?`).bind(ev.id).first() as any

    deletedTeams += teamCount?.c || 0
    deletedMatches += matchCount?.c || 0
    deletedStandings += standingCount?.c || 0

    await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(ev.id).run()
    await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(ev.id).run()
    await db.prepare(`DELETE FROM teams WHERE event_id=?`).bind(ev.id).run()
  }

  return c.json({
    message: '모든 조편성이 삭제되었습니다.',
    deleted: { teams: deletedTeams, matches: deletedMatches, standings: deletedStandings },
    events_count: events?.length || 0
  })
})

// 종목 일괄 삭제 (모든 종목 + 팀/경기/순위 전부 삭제)
eventRoutes.delete('/:tid/events/all/everything', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  const { results: events } = await db.prepare(
    `SELECT id FROM events WHERE tournament_id=?`
  ).bind(tid).all()

  let deletedTeams = 0
  let deletedMatches = 0
  let deletedStandings = 0

  for (const ev of (events || [])) {
    const teamCount = await db.prepare(`SELECT COUNT(*) as c FROM teams WHERE event_id=?`).bind(ev.id).first() as any
    const matchCount = await db.prepare(`SELECT COUNT(*) as c FROM matches WHERE event_id=?`).bind(ev.id).first() as any
    const standingCount = await db.prepare(`SELECT COUNT(*) as c FROM standings WHERE event_id=?`).bind(ev.id).first() as any

    deletedTeams += teamCount?.c || 0
    deletedMatches += matchCount?.c || 0
    deletedStandings += standingCount?.c || 0

    await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(ev.id).run()
    await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(ev.id).run()
    await db.prepare(`DELETE FROM teams WHERE event_id=?`).bind(ev.id).run()
  }

  await db.prepare(`DELETE FROM events WHERE tournament_id=?`).bind(tid).run()

  return c.json({
    message: '모든 종목과 조편성이 삭제되었습니다.',
    deleted: { events: events?.length || 0, teams: deletedTeams, matches: deletedMatches, standings: deletedStandings }
  })
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

  const event = await db.prepare(`SELECT * FROM events WHERE id=? AND tournament_id=?`).bind(eid, tid).first() as any
  if (!event) return c.json({ error: '종목을 찾을 수 없습니다.' }, 404)

  const p1 = await db.prepare(`SELECT * FROM participants WHERE id=? AND tournament_id=? AND deleted=0`).bind(player1_id, tid).first() as any
  const p2 = await db.prepare(`SELECT * FROM participants WHERE id=? AND tournament_id=? AND deleted=0`).bind(player2_id, tid).first() as any
  if (!p1 || !p2) return c.json({ error: '선수 정보를 찾을 수 없습니다.' }, 404)

  if (event.category === 'md' && (p1.gender !== 'm' || p2.gender !== 'm')) return c.json({ error: '남자복식에는 남자 선수만 등록 가능합니다.' }, 400)
  if (event.category === 'wd' && (p1.gender !== 'f' || p2.gender !== 'f')) return c.json({ error: '여자복식에는 여자 선수만 등록 가능합니다.' }, 400)
  if (event.category === 'xd') {
    if (!((p1.gender === 'm' && p2.gender === 'f') || (p1.gender === 'f' && p2.gender === 'm')))
      return c.json({ error: '혼합복식에는 남녀 한 명씩 등록해야 합니다.' }, 400)
  }

  const dup = await db.prepare(
    `SELECT id FROM teams WHERE event_id=? AND ((player1_id=? AND player2_id=?) OR (player1_id=? AND player2_id=?))`
  ).bind(eid, player1_id, player2_id, player2_id, player1_id).first()
  if (dup) return c.json({ error: '이미 등록된 팀 조합입니다.' }, 400)

  const teamName = `${p1.name} · ${p2.name}`
  const result = await db.prepare(
    `INSERT INTO teams (event_id, tournament_id, player1_id, player2_id, team_name) VALUES (?, ?, ?, ?, ?)`
  ).bind(eid, tid, player1_id, player2_id, teamName).run()

  return c.json({ id: result.meta.last_row_id, team_name: teamName, message: '팀이 등록되었습니다.' }, 201)
})

// 종목의 팀 목록 조회 (클럽·조 정보 포함)
eventRoutes.get('/:tid/events/:eid/teams', async (c) => {
  const eid = c.req.param('eid')
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT t.*, t.group_num,
            p1.name as p1_name, p1.level as p1_level, p1.gender as p1_gender, p1.birth_year as p1_birth_year, p1.club as p1_club,
            p2.name as p2_name, p2.level as p2_level, p2.gender as p2_gender, p2.birth_year as p2_birth_year, p2.club as p2_club
     FROM teams t
     JOIN participants p1 ON t.player1_id = p1.id
     JOIN participants p2 ON t.player2_id = p2.id
     WHERE t.event_id=?
     ORDER BY t.group_num ASC, t.created_at ASC`
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

// =============================================
// 헬퍼 함수들
// =============================================
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getLevelFilter(event: any): string {
  if (event.level_group && event.level_group !== 'all' && event.level_group !== 'merged') {
    return `AND level='${event.level_group}'`
  }
  return ''
}

function getAgeFilter(event: any): string {
  const ag = event.age_group
  if (!ag || ag === 'open') return ''
  const currentYear = new Date().getFullYear()
  switch (ag) {
    case '20대': {
      const maxYear = currentYear - 20
      const minYear = currentYear - 29
      return `AND birth_year IS NOT NULL AND birth_year BETWEEN ${minYear} AND ${maxYear}`
    }
    case '30대': {
      const maxYear = currentYear - 30
      const minYear = currentYear - 39
      return `AND birth_year IS NOT NULL AND birth_year BETWEEN ${minYear} AND ${maxYear}`
    }
    case '40대': {
      const maxYear = currentYear - 40
      const minYear = currentYear - 49
      return `AND birth_year IS NOT NULL AND birth_year BETWEEN ${minYear} AND ${maxYear}`
    }
    case '50대': {
      // 50대 초반: 50~54세
      const maxYear = currentYear - 50
      const minYear = currentYear - 54
      return `AND birth_year IS NOT NULL AND birth_year BETWEEN ${minYear} AND ${maxYear}`
    }
    case '55대': {
      // 50대 후반: 55~59세
      const maxYear = currentYear - 55
      const minYear = currentYear - 59
      return `AND birth_year IS NOT NULL AND birth_year BETWEEN ${minYear} AND ${maxYear}`
    }
    case '60대': {
      // 60세 이상
      const maxYear = currentYear - 60
      return `AND birth_year IS NOT NULL AND birth_year <= ${maxYear}`
    }
    default:
      return ''
  }
}

// =============================================
// 팀 편성 옵션 엔진 (핵심!)
// =============================================

// 옵션1: 같은 클럽 우선 팀 편성
function pairWithClubPriority(players: any[]): { p1: any; p2: any }[] {
  const teams: { p1: any; p2: any }[] = []
  const used = new Set<number>()

  // 1단계: 같은 클럽 멤버끼리 우선 매칭
  const byClub: Record<string, any[]> = {}
  for (const p of players) {
    const club = (p.club || '').trim()
    if (club) {
      if (!byClub[club]) byClub[club] = []
      byClub[club].push(p)
    }
  }
  for (const [, members] of Object.entries(byClub)) {
    const shuffled = shuffle(members)
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      teams.push({ p1: shuffled[i], p2: shuffled[i + 1] })
      used.add(shuffled[i].id)
      used.add(shuffled[i + 1].id)
    }
  }

  // 2단계: 남은 선수들 급수 순 매칭
  const remaining = players.filter(p => !used.has(p.id))
  remaining.sort((a, b) => (LEVEL_ORDER[a.level] || 3) - (LEVEL_ORDER[b.level] || 3))
  const shuffledRem = shuffle(remaining)
  shuffledRem.sort((a, b) => (LEVEL_ORDER[a.level] || 3) - (LEVEL_ORDER[b.level] || 3))
  for (let i = 0; i + 1 < shuffledRem.length; i += 2) {
    teams.push({ p1: shuffledRem[i], p2: shuffledRem[i + 1] })
  }
  return teams
}

// 옵션2: 같은 급수끼리 팀 편성 (클럽 무시)
function pairByLevel(players: any[]): { p1: any; p2: any }[] {
  const teams: { p1: any; p2: any }[] = []
  const shuffled = shuffle(players)
  shuffled.sort((a, b) => (LEVEL_ORDER[a.level] || 3) - (LEVEL_ORDER[b.level] || 3))
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    teams.push({ p1: shuffled[i], p2: shuffled[i + 1] })
  }
  return teams
}

// 옵션3: 랜덤 팀 편성
function pairRandom(players: any[]): { p1: any; p2: any }[] {
  const teams: { p1: any; p2: any }[] = []
  const shuffled = shuffle(players)
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    teams.push({ p1: shuffled[i], p2: shuffled[i + 1] })
  }
  return teams
}

// =============================================
// 조 배정 엔진 (같은 클럽 회피)
// =============================================
function assignGroups(teams: any[], groupSize: number, avoidSameClub: boolean, teamsInfo?: any[]): { groupNum: number; teamId: number }[] {
  const n = teams.length
  if (n === 0) return []
  const numGroups = Math.ceil(n / groupSize)
  const groups: any[][] = Array.from({ length: numGroups }, () => [])

  // 팀별 클럽 정보
  const teamClubs: Record<number, Set<string>> = {}
  if (teamsInfo) {
    for (const t of teamsInfo) {
      const clubs = new Set<string>()
      if (t.p1_club) clubs.add(t.p1_club)
      if (t.p2_club) clubs.add(t.p2_club)
      teamClubs[t.id] = clubs
    }
  }

  const shuffledTeams = shuffle(teams)

  for (const team of shuffledTeams) {
    if (avoidSameClub && teamClubs[team.id]?.size > 0) {
      // 같은 클럽이 가장 적은 조에 배정
      let bestGroup = 0
      let minConflict = Infinity
      for (let g = 0; g < numGroups; g++) {
        if (groups[g].length >= groupSize) continue
        let conflict = 0
        for (const existing of groups[g]) {
          const existClubs = teamClubs[existing.id] || new Set()
          const newClubs = teamClubs[team.id] || new Set()
          for (const c of newClubs) { if (existClubs.has(c)) conflict++ }
        }
        if (conflict < minConflict || (conflict === minConflict && groups[g].length < groups[bestGroup].length)) {
          minConflict = conflict
          bestGroup = g
        }
      }
      groups[bestGroup].push(team)
    } else {
      // 가장 적은 조에 배정
      let minGroup = 0
      for (let g = 1; g < numGroups; g++) {
        if (groups[g].length < groups[minGroup].length) minGroup = g
      }
      groups[minGroup].push(team)
    }
  }

  const result: { groupNum: number; teamId: number }[] = []
  for (let g = 0; g < numGroups; g++) {
    for (const team of groups[g]) {
      result.push({ groupNum: g + 1, teamId: team.id })
    }
  }
  return result
}

// =============================================
// ★ 옵션 기반 팀 자동 편성 (단일 종목) ★
// =============================================
eventRoutes.post('/:tid/events/:eid/auto-assign', async (c) => {
  const tid = c.req.param('tid')
  const eid = c.req.param('eid')
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  // 옵션들
  const teamMode: string = body.team_mode || 'club_priority'
  // team_mode: 'club_priority' | 'level_match' | 'random'

  const event = await db.prepare(`SELECT * FROM events WHERE id=? AND tournament_id=?`).bind(eid, tid).first() as any
  if (!event) return c.json({ error: '종목을 찾을 수 없습니다.' }, 404)

  // 기존 팀/경기/순위 삭제
  await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(eid).run()
  await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(eid).run()
  await db.prepare(`DELETE FROM teams WHERE event_id=?`).bind(eid).run()

  let genderFilter = ''
  if (event.category === 'md') genderFilter = `AND gender='m'`
  else if (event.category === 'wd') genderFilter = `AND gender='f'`
  const levelFilter = getLevelFilter(event)
  const ageFilter = getAgeFilter(event)
  const teams: { p1: any; p2: any }[] = []

  if (event.category === 'xd') {
    // 혼합복식
    const { results: males } = await db.prepare(
      `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 AND gender='m' AND mixed_doubles=1 ${levelFilter} ${ageFilter} ORDER BY level, RANDOM()`
    ).bind(tid).all()
    const { results: females } = await db.prepare(
      `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 AND gender='f' AND mixed_doubles=1 ${levelFilter} ${ageFilter} ORDER BY level, RANDOM()`
    ).bind(tid).all()

    if (teamMode === 'club_priority') {
      const usedM = new Set<number>(), usedF = new Set<number>()
      const mList = males || [], fList = females || []
      // 같은 클럽 남녀 우선
      for (const m of mList) {
        if (usedM.has(m.id)) continue
        const club = (m.club || '').trim()
        if (!club) continue
        const partner = fList.find(f => !usedF.has(f.id) && (f.club || '').trim() === club)
        if (partner) { teams.push({ p1: m, p2: partner }); usedM.add(m.id); usedF.add(partner.id) }
      }
      const remM = mList.filter(m => !usedM.has(m.id)), remF = fList.filter(f => !usedF.has(f.id))
      const c2 = Math.min(remM.length, remF.length)
      for (let i = 0; i < c2; i++) { teams.push({ p1: remM[i], p2: remF[i] }) }
    } else if (teamMode === 'level_match') {
      const mSorted = shuffle(males || []).sort((a, b) => (LEVEL_ORDER[a.level] || 3) - (LEVEL_ORDER[b.level] || 3))
      const fSorted = shuffle(females || []).sort((a, b) => (LEVEL_ORDER[a.level] || 3) - (LEVEL_ORDER[b.level] || 3))
      const cnt = Math.min(mSorted.length, fSorted.length)
      for (let i = 0; i < cnt; i++) teams.push({ p1: mSorted[i], p2: fSorted[i] })
    } else {
      const mShuf = shuffle(males || []), fShuf = shuffle(females || [])
      const cnt = Math.min(mShuf.length, fShuf.length)
      for (let i = 0; i < cnt; i++) teams.push({ p1: mShuf[i], p2: fShuf[i] })
    }
  } else {
    // 남복/여복
    const { results: players } = await db.prepare(
      `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 ${genderFilter} ${levelFilter} ${ageFilter} ORDER BY level, RANDOM()`
    ).bind(tid).all()
    if (players && players.length >= 2) {
      if (teamMode === 'club_priority') teams.push(...pairWithClubPriority(players as any[]))
      else if (teamMode === 'level_match') teams.push(...pairByLevel(players as any[]))
      else teams.push(...pairRandom(players as any[]))
    }
  }

  if (teams.length === 0) return c.json({ error: '조건에 맞는 참가자가 부족합니다.', team_count: 0 }, 400)

  let created = 0
  for (const t of teams) {
    const teamName = `${(t.p1 as any).name} · ${(t.p2 as any).name}`
    await db.prepare(
      `INSERT INTO teams (event_id, tournament_id, player1_id, player2_id, team_name) VALUES (?, ?, ?, ?, ?)`
    ).bind(eid, tid, (t.p1 as any).id, (t.p2 as any).id, teamName).run()
    created++
  }

  return c.json({ message: `${created}팀이 자동 편성되었습니다.`, team_count: created, options: { teamMode } })
})

// =============================================
// ★ 전체 종목 옵션 기반 자동 팀 편성 ★
// =============================================
eventRoutes.post('/:tid/events/auto-assign-all', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))
  const teamMode: string = body.team_mode || 'club_priority'

  const { results: events } = await db.prepare(
    `SELECT * FROM events WHERE tournament_id=? ORDER BY category, age_group, level_group`
  ).bind(tid).all()
  if (!events || events.length === 0) return c.json({ error: '종목이 없습니다.' }, 400)

  const results: any[] = []
  let totalTeams = 0

  for (const ev of events) {
    const event = ev as any
    await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(event.id).run()
    await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(event.id).run()
    await db.prepare(`DELETE FROM teams WHERE event_id=?`).bind(event.id).run()

    let genderFilter = ''
    if (event.category === 'md') genderFilter = `AND gender='m'`
    else if (event.category === 'wd') genderFilter = `AND gender='f'`
    const levelFilter = getLevelFilter(event)
    const ageFilter = getAgeFilter(event)
    const teams: { p1: any; p2: any }[] = []

    if (event.category === 'xd') {
      const { results: males } = await db.prepare(
        `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 AND gender='m' AND mixed_doubles=1 ${levelFilter} ${ageFilter} ORDER BY level, RANDOM()`
      ).bind(tid).all()
      const { results: females } = await db.prepare(
        `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 AND gender='f' AND mixed_doubles=1 ${levelFilter} ${ageFilter} ORDER BY level, RANDOM()`
      ).bind(tid).all()
      if (teamMode === 'club_priority') {
        const usedM = new Set<number>(), usedF = new Set<number>()
        const mList = males || [], fList = females || []
        for (const m of mList) {
          if (usedM.has(m.id)) continue
          const club = (m.club || '').trim()
          if (!club) continue
          const partner = fList.find(f => !usedF.has(f.id) && (f.club || '').trim() === club)
          if (partner) { teams.push({ p1: m, p2: partner }); usedM.add(m.id); usedF.add(partner.id) }
        }
        const remM = mList.filter(m => !usedM.has(m.id)), remF = fList.filter(f => !usedF.has(f.id))
        for (let i = 0; i < Math.min(remM.length, remF.length); i++) teams.push({ p1: remM[i], p2: remF[i] })
      } else if (teamMode === 'level_match') {
        const mS = shuffle(males || []).sort((a, b) => (LEVEL_ORDER[a.level] || 3) - (LEVEL_ORDER[b.level] || 3))
        const fS = shuffle(females || []).sort((a, b) => (LEVEL_ORDER[a.level] || 3) - (LEVEL_ORDER[b.level] || 3))
        for (let i = 0; i < Math.min(mS.length, fS.length); i++) teams.push({ p1: mS[i], p2: fS[i] })
      } else {
        const mR = shuffle(males || []), fR = shuffle(females || [])
        for (let i = 0; i < Math.min(mR.length, fR.length); i++) teams.push({ p1: mR[i], p2: fR[i] })
      }
    } else {
      const { results: players } = await db.prepare(
        `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 ${genderFilter} ${levelFilter} ${ageFilter} ORDER BY level, RANDOM()`
      ).bind(tid).all()
      if (players && players.length >= 2) {
        if (teamMode === 'club_priority') teams.push(...pairWithClubPriority(players as any[]))
        else if (teamMode === 'level_match') teams.push(...pairByLevel(players as any[]))
        else teams.push(...pairRandom(players as any[]))
      }
    }

    let created = 0
    for (const t of teams) {
      const teamName = `${(t.p1 as any).name} · ${(t.p2 as any).name}`
      await db.prepare(
        `INSERT INTO teams (event_id, tournament_id, player1_id, player2_id, team_name) VALUES (?, ?, ?, ?, ?)`
      ).bind(event.id, tid, (t.p1 as any).id, (t.p2 as any).id, teamName).run()
      created++
    }
    totalTeams += created
    results.push({ event_id: event.id, event_name: event.name, team_count: created })
  }

  return c.json({ message: `전체 ${totalTeams}팀 자동 편성 완료`, total_teams: totalTeams, events: results })
})

// =============================================
// ★ 조 배정 API (옵션 기반) ★
// =============================================
eventRoutes.post('/:tid/events/:eid/assign-groups', async (c) => {
  const tid = c.req.param('tid')
  const eid = c.req.param('eid')
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  const groupSize = body.group_size || 5
  const avoidSameClub = body.avoid_same_club !== false

  // 종목 팀 조회 (클럽 정보 포함)
  const { results: teams } = await db.prepare(
    `SELECT t.*, p1.club as p1_club, p2.club as p2_club
     FROM teams t
     JOIN participants p1 ON t.player1_id = p1.id
     JOIN participants p2 ON t.player2_id = p2.id
     WHERE t.event_id=?
     ORDER BY t.id`
  ).bind(eid).all()

  if (!teams || teams.length === 0) return c.json({ error: '팀이 없습니다. 먼저 팀 편성을 진행하세요.' }, 400)

  const assignments = assignGroups(teams as any[], groupSize, avoidSameClub, teams as any[])

  for (const a of assignments) {
    await db.prepare(`UPDATE teams SET group_num=? WHERE id=?`).bind(a.groupNum, a.teamId).run()
  }

  const groupStats: Record<number, number> = {}
  for (const a of assignments) {
    groupStats[a.groupNum] = (groupStats[a.groupNum] || 0) + 1
  }

  return c.json({
    message: `${Object.keys(groupStats).length}개 조 배정 완료`,
    groups: Object.entries(groupStats).map(([g, count]) => ({ group: parseInt(g), teams: count })),
    total_teams: teams.length,
    options: { groupSize, avoidSameClub }
  })
})

// =============================================
// ★ 전체 종목 조 배정 (일괄) ★
// =============================================
eventRoutes.post('/:tid/events/assign-groups-all', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  const groupSize = body.group_size || 5
  const avoidSameClub = body.avoid_same_club !== false

  const { results: events } = await db.prepare(
    `SELECT * FROM events WHERE tournament_id=? ORDER BY category, age_group, level_group`
  ).bind(tid).all()
  if (!events || events.length === 0) return c.json({ error: '종목이 없습니다.' }, 400)

  const results: any[] = []
  let totalGroups = 0

  for (const ev of events) {
    const event = ev as any
    const { results: teams } = await db.prepare(
      `SELECT t.*, p1.club as p1_club, p2.club as p2_club
       FROM teams t
       JOIN participants p1 ON t.player1_id = p1.id
       JOIN participants p2 ON t.player2_id = p2.id
       WHERE t.event_id=?
       ORDER BY t.id`
    ).bind(event.id).all()

    if (!teams || teams.length === 0) {
      results.push({ event_id: event.id, event_name: event.name, groups: 0, teams: 0 })
      continue
    }

    const assignments = assignGroups(teams as any[], groupSize, avoidSameClub, teams as any[])
    for (const a of assignments) {
      await db.prepare(`UPDATE teams SET group_num=? WHERE id=?`).bind(a.groupNum, a.teamId).run()
    }

    const numGroups = new Set(assignments.map(a => a.groupNum)).size
    totalGroups += numGroups
    results.push({ event_id: event.id, event_name: event.name, groups: numGroups, teams: teams.length })
  }

  return c.json({ message: `전체 ${totalGroups}개 조 배정 완료`, total_groups: totalGroups, events: results, options: { groupSize, avoidSameClub } })
})

// =============================================
// ★ 시뮬레이션 프리뷰 (팀/조 편성 미리보기) ★
// =============================================
eventRoutes.post('/:tid/events/preview-assignment', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  const teamMode: string = body.team_mode || 'club_priority'
  const groupSize = body.group_size || 5
  const avoidSameClub = body.avoid_same_club !== false

  const { results: events } = await db.prepare(
    `SELECT * FROM events WHERE tournament_id=? ORDER BY category, age_group, level_group`
  ).bind(tid).all()

  if (!events || events.length === 0) return c.json({ error: '종목이 없습니다.' }, 400)

  const preview: any[] = []

  for (const ev of events) {
    const event = ev as any
    let genderFilter = ''
    if (event.category === 'md') genderFilter = `AND gender='m'`
    else if (event.category === 'wd') genderFilter = `AND gender='f'`
    const levelFilter = getLevelFilter(event)
    const ageFilter = getAgeFilter(event)

    let playerCount = 0
    let teamCount = 0

    if (event.category === 'xd') {
      const mCount = await db.prepare(`SELECT COUNT(*) as c FROM participants WHERE tournament_id=? AND deleted=0 AND gender='m' AND mixed_doubles=1 ${levelFilter} ${ageFilter}`).bind(tid).first()
      const fCount = await db.prepare(`SELECT COUNT(*) as c FROM participants WHERE tournament_id=? AND deleted=0 AND gender='f' AND mixed_doubles=1 ${levelFilter} ${ageFilter}`).bind(tid).first()
      playerCount = ((mCount?.c as number) || 0) + ((fCount?.c as number) || 0)
      teamCount = Math.min((mCount?.c as number) || 0, (fCount?.c as number) || 0)
    } else {
      const pCount = await db.prepare(`SELECT COUNT(*) as c FROM participants WHERE tournament_id=? AND deleted=0 ${genderFilter} ${levelFilter} ${ageFilter}`).bind(tid).first()
      playerCount = (pCount?.c as number) || 0
      teamCount = Math.floor(playerCount / 2)
    }

    const numGroups = teamCount > 0 ? Math.ceil(teamCount / groupSize) : 0
    const matchesPerGroup = groupSize <= 5 ? (groupSize * (groupSize - 1)) / 2 : groupSize * 2
    const totalMatches = numGroups * matchesPerGroup

    preview.push({
      event_id: event.id,
      event_name: event.name,
      category: event.category,
      level_group: event.level_group,
      player_count: playerCount,
      team_count: teamCount,
      group_count: numGroups,
      teams_per_group: `${Math.floor(teamCount / (numGroups || 1))}~${Math.ceil(teamCount / (numGroups || 1))}`,
      estimated_matches: Math.round(totalMatches),
      format_suggestion: teamCount <= 5 ? '풀리그' : teamCount <= 10 ? '조별리그+결선' : 'KDK+결선'
    })
  }

  const totalTeams = preview.reduce((s, p) => s + p.team_count, 0)
  const totalMatches = preview.reduce((s, p) => s + p.estimated_matches, 0)

  return c.json({
    preview,
    summary: {
      total_events: preview.length,
      total_teams: totalTeams,
      total_estimated_matches: totalMatches,
      team_mode: teamMode,
      group_size: groupSize,
      avoid_same_club: avoidSameClub
    }
  })
})

// =============================================
// 급수 합병 체크 & 실행
// =============================================
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

  const groups: Record<string, any[]> = {}
  for (const ev of events) {
    const key = `${(ev as any).category}_${(ev as any).age_group}`
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  }

  const merges: any[] = []

  for (const [, groupEvents] of Object.entries(groups)) {
    const underEvents = groupEvents.filter((e: any) => e.team_count < threshold && e.level_group !== 'all' && e.level_group !== 'merged')
    if (underEvents.length < 2) continue

    const levelOrder = ['s', 'a', 'b', 'c', 'd', 'e']
    underEvents.sort((a: any, b: any) => levelOrder.indexOf(a.level_group) - levelOrder.indexOf(b.level_group))

    let i = 0
    while (i < underEvents.length) {
      const group: any[] = [underEvents[i]]
      let totalTeams = (underEvents[i] as any).team_count
      let j = i + 1
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

// 수동 합병 실행 (카테고리/연령대 제한 없이)
eventRoutes.post('/:tid/events/execute-merge', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { event_ids, custom_name } = await c.req.json()

  if (!event_ids || event_ids.length < 2) return c.json({ error: '합병할 종목을 2개 이상 선택해주세요.' }, 400)

  const events: any[] = []
  for (const eid of event_ids) {
    const ev = await db.prepare(`SELECT * FROM events WHERE id=? AND tournament_id=?`).bind(eid, tid).first()
    if (ev) events.push(ev)
  }
  if (events.length < 2) return c.json({ error: '유효한 종목이 부족합니다.' }, 400)

  // 합병명 자동 생성 (카테고리/연령대 다르면 모두 표시)
  let mergedName = custom_name
  if (!mergedName) {
    const cats = [...new Set(events.map((e: any) => e.category))]
    const ages = [...new Set(events.map((e: any) => e.age_group))]
    const levels = [...new Set(events.map((e: any) => e.level_group).filter((l: string) => l !== 'all' && l !== 'merged'))]

    const catStr = cats.map((c: string) => CATEGORY_LABELS[c] || c).join('/')
    const ageStr = ages.map((a: string) => a === 'open' ? '오픈' : a).join('/')
    const levelStr = levels.length > 0 ? ' ' + levels.map((l: string) => LEVEL_LABELS[l] || l).join('+') + '급' : ' 전체'

    mergedName = `${catStr} ${ageStr}${levelStr}`
  }

  const cat = events[0].category as string
  const age = events[0].age_group as string

  const result = await db.prepare(
    `INSERT INTO events (tournament_id, category, age_group, level_group, name, merged_from) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(tid, cat, age, 'merged', mergedName, JSON.stringify(event_ids)).run()
  const newEventId = result.meta.last_row_id

  for (const eid of event_ids) {
    await db.prepare(`UPDATE teams SET event_id=? WHERE event_id=?`).bind(newEventId, eid).run()
    await db.prepare(`DELETE FROM events WHERE id=?`).bind(eid).run()
  }

  return c.json({ id: newEventId, name: mergedName, message: `${events.length}개 종목이 합병되었습니다.` })
})

// 합병 취소 (되돌리기)
eventRoutes.post('/:tid/events/:eid/unmerge', async (c) => {
  const tid = c.req.param('tid')
  const eid = c.req.param('eid')
  const db = c.env.DB

  const mergedEvent = await db.prepare(`SELECT * FROM events WHERE id=? AND tournament_id=?`).bind(eid, tid).first() as any
  if (!mergedEvent) return c.json({ error: '종목을 찾을 수 없습니다.' }, 404)
  if (!mergedEvent.merged_from) return c.json({ error: '합병된 종목이 아닙니다.' }, 400)

  let originalIds: number[]
  try { originalIds = JSON.parse(mergedEvent.merged_from) } catch { return c.json({ error: '합병 정보가 올바르지 않습니다.' }, 400) }

  // 원래 종목 복원
  const restored: any[] = []
  for (const origId of originalIds) {
    // 원래 종목 정보를 이름에서 추출하기 어려우므로 원본 데이터 기반으로 재생성
    // merged_from에 저장된 원래 event_id 기반으로 복원
    const result = await db.prepare(
      `INSERT INTO events (tournament_id, category, age_group, level_group, name) VALUES (?, ?, ?, ?, ?)`
    ).bind(tid, mergedEvent.category, mergedEvent.age_group, 'all', `복원된 종목 #${origId}`).run()
    restored.push({ old_id: origId, new_id: result.meta.last_row_id })
  }

  // 현재 합병 종목의 팀을 첫 번째 복원 종목으로 이동 (팀 재배정 필요)
  if (restored.length > 0) {
    await db.prepare(`UPDATE teams SET event_id=? WHERE event_id=?`).bind(restored[0].new_id, eid).run()
  }

  // 합병 종목 삭제
  await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(eid).run()
  await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(eid).run()
  await db.prepare(`DELETE FROM events WHERE id=?`).bind(eid).run()

  return c.json({
    message: `합병이 취소되었습니다. ${restored.length}개 종목이 복원되었습니다. 팀은 첫 번째 종목으로 이동되었으므로 재편성이 필요합니다.`,
    restored
  })
})

// 합병 기준 실시간 변경
eventRoutes.patch('/:tid/merge-threshold', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { threshold } = await c.req.json()

  if (!threshold || threshold < 1 || threshold > 50) return c.json({ error: '기준값은 1~50 사이여야 합니다.' }, 400)

  await db.prepare(`UPDATE tournaments SET merge_threshold=?, updated_at=datetime('now') WHERE id=? AND deleted=0`).bind(threshold, tid).run()

  return c.json({ message: `합병 기준이 ${threshold}팀으로 변경되었습니다.`, threshold })
})
