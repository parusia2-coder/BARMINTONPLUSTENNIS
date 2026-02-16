import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const bracketRoutes = new Hono<{ Bindings: Bindings }>()

// =============================================
// ★ 옵션 기반 대진표 생성 ★
// =============================================
bracketRoutes.post('/:tid/brackets/generate', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  // 옵션들
  const eventId = body.event_id || null
  const bracketFormat: string = body.format || 'auto'
  // format: 'auto' | 'kdk' | 'league' | 'tournament' | 'group_league'
  const avoidSameClub: boolean = body.avoid_same_club !== false
  const gamesPerTeam: number = body.games_per_team || 0  // 0 = 대회 기본 설정
  const groupSize: number = body.group_size || 5

  const tournament = await db.prepare(
    `SELECT * FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first() as any
  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  const courts = tournament.courts || 2
  const defaultGamesPerTeam = gamesPerTeam || tournament.games_per_player || 4

  // 대상 종목 결정
  let eventIds: number[] = []
  if (eventId) {
    eventIds = [eventId]
  } else {
    const { results } = await db.prepare(`SELECT id FROM events WHERE tournament_id=?`).bind(tid).all()
    eventIds = (results || []).map((e: any) => e.id)
  }

  if (eventIds.length === 0) return c.json({ error: '종목이 없습니다. 먼저 종목을 추가해주세요.' }, 400)

  let totalMatches = 0
  const eventResults: any[] = []

  for (const eid of eventIds) {
    // 팀 목록 (클럽 정보 포함)
    const { results: teams } = await db.prepare(
      `SELECT t.*, t.group_num, p1.club as p1_club, p2.club as p2_club
       FROM teams t
       JOIN participants p1 ON t.player1_id = p1.id
       JOIN participants p2 ON t.player2_id = p2.id
       WHERE t.event_id=? ORDER BY t.group_num ASC, t.id ASC`
    ).bind(eid).all()

    if (!teams || teams.length < 2) continue

    // 기존 경기/순위 삭제
    await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(eid).run()
    await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(eid).run()

    // 포맷 자동 결정
    let actualFormat = bracketFormat
    if (actualFormat === 'auto') {
      const teamCount = teams.length
      const hasGroups = teams.some((t: any) => t.group_num && t.group_num > 0)
      if (hasGroups) {
        actualFormat = 'group_league'
      } else if (teamCount <= 5) {
        actualFormat = 'league'
      } else if (teamCount <= 16) {
        actualFormat = 'kdk'
      } else {
        actualFormat = 'kdk'
      }
    }

    let matches: any[] = []

    switch (actualFormat) {
      case 'group_league': {
        // 조별 리그: 같은 조끼리만 풀리그
        const groupMap: Record<number, any[]> = {}
        for (const t of teams) {
          const g = (t as any).group_num || 1
          if (!groupMap[g]) groupMap[g] = []
          groupMap[g].push(t)
        }

        let order = 0
        for (const [groupNum, groupTeams] of Object.entries(groupMap)) {
          const ids = groupTeams.map((t: any) => t.id)
          // 같은 클럽 회피: 대진 순서 조정
          let pairs: { t1: number; t2: number }[] = []
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              pairs.push({ t1: ids[i], t2: ids[j] })
            }
          }

          if (avoidSameClub) {
            pairs = optimizeMatchOrder(pairs, groupTeams, courts)
          } else {
            pairs = shuffle(pairs)
          }

          for (const pair of pairs) {
            order++
            matches.push({
              round: Math.floor((order - 1) / courts) + 1,
              match_order: order,
              court_number: ((order - 1) % courts) + 1,
              team1_id: pair.t1,
              team2_id: pair.t2,
              group_num: parseInt(groupNum as string)
            })
          }
        }
        break
      }

      case 'kdk':
        matches = generateKDK(teams as any[], defaultGamesPerTeam, courts, avoidSameClub)
        break

      case 'league':
        matches = generateLeague(teams as any[], courts, avoidSameClub)
        break

      case 'tournament':
        matches = generateTournament(teams as any[], courts, avoidSameClub)
        break

      default:
        matches = generateKDK(teams as any[], defaultGamesPerTeam, courts, avoidSameClub)
    }

    for (const m of matches) {
      await db.prepare(
        `INSERT INTO matches (tournament_id, event_id, round, match_order, court_number, team1_id, team2_id, group_num, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(tid, eid, m.round, m.match_order, m.court_number, m.team1_id, m.team2_id || null, m.group_num || null).run()
    }

    await db.prepare(`UPDATE events SET status='in_progress' WHERE id=?`).bind(eid).run()
    totalMatches += matches.length
    eventResults.push({ event_id: eid, format: actualFormat, matches: matches.length })
  }

  await db.prepare(
    `UPDATE tournaments SET status='in_progress', updated_at=datetime('now') WHERE id=?`
  ).bind(tid).run()

  await db.prepare(
    `INSERT INTO audit_logs (tournament_id, action, new_value, updated_by)
     VALUES (?, 'GENERATE_BRACKET', ?, 'admin')`
  ).bind(tid, JSON.stringify({ format: bracketFormat, matchCount: totalMatches, events: eventResults })).run()

  return c.json({
    message: '대진표가 생성되었습니다.',
    matchCount: totalMatches,
    events: eventResults,
    options: { format: bracketFormat, avoidSameClub, gamesPerTeam: defaultGamesPerTeam, groupSize }
  })
})

// =============================================
// 대진 생성 알고리즘들
// =============================================

// 같은 클럽 팀끼리 연속 대결 최소화 순서 최적화
function optimizeMatchOrder(pairs: { t1: number; t2: number }[], teams: any[], courts: number): { t1: number; t2: number }[] {
  // 팀별 클럽 정보 맵
  const teamClubs: Record<number, Set<string>> = {}
  for (const t of teams) {
    const clubs = new Set<string>()
    if ((t as any).p1_club) clubs.add((t as any).p1_club)
    if ((t as any).p2_club) clubs.add((t as any).p2_club)
    teamClubs[(t as any).id] = clubs
  }

  // 같은 클럽끼리 대결 여부 체크
  function hasSameClub(t1: number, t2: number): boolean {
    const c1 = teamClubs[t1] || new Set()
    const c2 = teamClubs[t2] || new Set()
    for (const c of c1) { if (c2.has(c)) return true }
    return false
  }

  // 같은 클럽 대결은 뒤로 보내기
  const sameClub: typeof pairs = []
  const diffClub: typeof pairs = []
  for (const p of pairs) {
    if (hasSameClub(p.t1, p.t2)) sameClub.push(p)
    else diffClub.push(p)
  }

  return [...shuffle(diffClub), ...shuffle(sameClub)]
}

// KDK 대진표 (같은 클럽 회피 옵션)
function generateKDK(teams: any[], gamesPerTeam: number, courts: number, avoidSameClub: boolean): any[] {
  const ids = teams.map((t: any) => t.id)
  const n = ids.length

  // 모든 가능한 대전 조합
  const allMatches: { team1: number; team2: number; sameClub: boolean }[] = []
  const teamClubs: Record<number, Set<string>> = {}
  for (const t of teams) {
    const clubs = new Set<string>()
    if (t.p1_club) clubs.add(t.p1_club)
    if (t.p2_club) clubs.add(t.p2_club)
    teamClubs[t.id] = clubs
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let sameClub = false
      if (avoidSameClub) {
        const c1 = teamClubs[ids[i]] || new Set()
        const c2 = teamClubs[ids[j]] || new Set()
        for (const c of c1) { if (c2.has(c)) { sameClub = true; break } }
      }
      allMatches.push({ team1: ids[i], team2: ids[j], sameClub })
    }
  }

  // 같은 클럽끼리 대결은 후순위
  if (avoidSameClub) {
    const diff = shuffle(allMatches.filter(m => !m.sameClub))
    const same = shuffle(allMatches.filter(m => m.sameClub))
    allMatches.length = 0
    allMatches.push(...diff, ...same)
  } else {
    const shuffled = shuffle(allMatches)
    allMatches.length = 0
    allMatches.push(...shuffled)
  }

  const teamGameCount: Record<number, number> = {}
  ids.forEach(id => { teamGameCount[id] = 0 })

  const selected: any[] = []

  for (const m of allMatches) {
    if (teamGameCount[m.team1] < gamesPerTeam && teamGameCount[m.team2] < gamesPerTeam) {
      // 연속 경기 방지
      const last = selected[selected.length - 1]
      if (last && (last.team1_id === m.team1 || last.team1_id === m.team2 || last.team2_id === m.team1 || last.team2_id === m.team2)) {
        if (allMatches.length > selected.length * 2) continue
      }

      teamGameCount[m.team1]++
      teamGameCount[m.team2]++

      selected.push({
        round: Math.floor(selected.length / courts) + 1,
        match_order: selected.length + 1,
        court_number: (selected.length % courts) + 1,
        team1_id: m.team1,
        team2_id: m.team2,
        group_num: null
      })
    }
    if (Object.values(teamGameCount).every(c => c >= gamesPerTeam)) break
  }

  return selected
}

// 풀리그 (같은 클럽 회피 정렬)
function generateLeague(teams: any[], courts: number, avoidSameClub: boolean): any[] {
  const ids = teams.map((t: any) => t.id)
  const matches: any[] = []

  let pairs: { t1: number; t2: number }[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push({ t1: ids[i], t2: ids[j] })
    }
  }

  if (avoidSameClub) {
    pairs = optimizeMatchOrder(pairs, teams, courts)
  } else {
    pairs = shuffle(pairs)
  }

  let order = 0
  for (const p of pairs) {
    order++
    matches.push({
      round: Math.floor((order - 1) / courts) + 1,
      match_order: order,
      court_number: ((order - 1) % courts) + 1,
      team1_id: p.t1,
      team2_id: p.t2,
      group_num: null
    })
  }
  return matches
}

// 싱글 엘리미네이션 토너먼트 (같은 클럽 시드 분리)
function generateTournament(teams: any[], courts: number, avoidSameClub: boolean): any[] {
  let ids: (number | null)[] = []

  if (avoidSameClub) {
    // 시드 배정: 같은 클럽 팀을 반대편 브래킷에 배치
    const teamClubs: Record<number, string[]> = {}
    for (const t of teams) {
      const clubs: string[] = []
      if (t.p1_club) clubs.push(t.p1_club)
      if (t.p2_club) clubs.push(t.p2_club)
      teamClubs[t.id] = clubs
    }

    const shuffledTeams = shuffle([...teams])
    const half1: number[] = []
    const half2: number[] = []
    const usedClubs1 = new Set<string>()
    const usedClubs2 = new Set<string>()

    for (const t of shuffledTeams) {
      const clubs = teamClubs[t.id] || []
      const conflictsH1 = clubs.filter(c => usedClubs1.has(c)).length
      const conflictsH2 = clubs.filter(c => usedClubs2.has(c)).length

      if (conflictsH1 <= conflictsH2 && half1.length <= half2.length) {
        half1.push(t.id)
        clubs.forEach(c => usedClubs1.add(c))
      } else {
        half2.push(t.id)
        clubs.forEach(c => usedClubs2.add(c))
      }
    }

    ids = [...shuffle(half1), ...shuffle(half2)]
  } else {
    ids = shuffle(teams.map((t: any) => t.id))
  }

  // 브래킷 사이즈 계산
  let bracketSize = 1
  while (bracketSize < ids.length) bracketSize *= 2
  while (ids.length < bracketSize) ids.push(null)

  const matches: any[] = []
  let order = 0

  for (let i = 0; i < ids.length; i += 2) {
    order++
    if (ids[i] && ids[i + 1]) {
      matches.push({
        round: 1,
        match_order: order,
        court_number: ((order - 1) % courts) + 1,
        team1_id: ids[i],
        team2_id: ids[i + 1],
        group_num: null
      })
    } else if (ids[i]) {
      matches.push({
        round: 1,
        match_order: order,
        court_number: ((order - 1) % courts) + 1,
        team1_id: ids[i],
        team2_id: null,
        group_num: null
      })
    }
  }
  return matches
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
