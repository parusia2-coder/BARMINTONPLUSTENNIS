import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const bracketRoutes = new Hono<{ Bindings: Bindings }>()

// 종목별 대진표 생성
bracketRoutes.post('/:tid/brackets/generate', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB
  const { event_id } = await c.req.json().catch(() => ({ event_id: null }))

  const tournament = await db.prepare(
    `SELECT * FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first() as any
  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  // 대상 종목 결정
  let eventIds: number[] = []
  if (event_id) {
    eventIds = [event_id]
  } else {
    const { results } = await db.prepare(`SELECT id FROM events WHERE tournament_id=?`).bind(tid).all()
    eventIds = (results || []).map((e: any) => e.id)
  }

  if (eventIds.length === 0) return c.json({ error: '종목이 없습니다. 먼저 종목을 추가해주세요.' }, 400)

  let totalMatches = 0

  for (const eid of eventIds) {
    const { results: teams } = await db.prepare(
      `SELECT * FROM teams WHERE event_id=? ORDER BY id ASC`
    ).bind(eid).all()

    if (!teams || teams.length < 2) continue

    // 기존 경기/순위 삭제
    await db.prepare(`DELETE FROM matches WHERE event_id=?`).bind(eid).run()
    await db.prepare(`DELETE FROM standings WHERE event_id=?`).bind(eid).run()

    let matches: any[] = []
    const courts = tournament.courts || 2

    switch (tournament.format) {
      case 'kdk':
        matches = generateKDKTeams(teams as any[], tournament.games_per_player || 4, courts)
        break
      case 'league':
        matches = generateLeagueTeams(teams as any[], courts)
        break
      case 'tournament':
        matches = generateTournamentTeams(teams as any[], courts)
        break
      default:
        matches = generateKDKTeams(teams as any[], tournament.games_per_player || 4, courts)
    }

    for (const m of matches) {
      await db.prepare(
        `INSERT INTO matches (tournament_id, event_id, round, match_order, court_number, team1_id, team2_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(tid, eid, m.round, m.match_order, m.court_number, m.team1_id, m.team2_id || null).run()
    }

    await db.prepare(`UPDATE events SET status='in_progress' WHERE id=?`).bind(eid).run()
    totalMatches += matches.length
  }

  await db.prepare(
    `UPDATE tournaments SET status='in_progress', updated_at=datetime('now') WHERE id=?`
  ).bind(tid).run()

  await db.prepare(
    `INSERT INTO audit_logs (tournament_id, action, new_value, updated_by)
     VALUES (?, 'GENERATE_BRACKET', ?, 'admin')`
  ).bind(tid, JSON.stringify({ format: tournament.format, matchCount: totalMatches, events: eventIds.length })).run()

  return c.json({ message: '대진표가 생성되었습니다.', matchCount: totalMatches })
})

// KDK - 팀 vs 팀 (랜덤 대진)
function generateKDKTeams(teams: any[], gamesPerTeam: number, courts: number): any[] {
  const ids = teams.map((t: any) => t.id)
  const n = ids.length

  // 모든 팀 대결 조합
  const allMatches: { team1: number; team2: number }[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allMatches.push({ team1: ids[i], team2: ids[j] })
    }
  }
  shuffle(allMatches)

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
        team2_id: m.team2
      })
    }
    if (Object.values(teamGameCount).every(c => c >= gamesPerTeam)) break
  }

  return selected
}

// 풀리그 - 팀 전원 라운드 로빈
function generateLeagueTeams(teams: any[], courts: number): any[] {
  const ids = teams.map((t: any) => t.id)
  const matches: any[] = []
  let order = 0

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      order++
      matches.push({
        round: Math.floor((order - 1) / courts) + 1,
        match_order: order,
        court_number: ((order - 1) % courts) + 1,
        team1_id: ids[i],
        team2_id: ids[j]
      })
    }
  }
  return matches
}

// 토너먼트 - 싱글 엘리미네이션
function generateTournamentTeams(teams: any[], courts: number): any[] {
  const ids = [...teams.map((t: any) => t.id)]
  shuffle(ids)

  let bracketSize = 1
  while (bracketSize < ids.length) bracketSize *= 2
  while (ids.length < bracketSize) ids.push(null as any)

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
        team2_id: ids[i + 1]
      })
    } else if (ids[i]) {
      matches.push({
        round: 1,
        match_order: order,
        court_number: ((order - 1) % courts) + 1,
        team1_id: ids[i],
        team2_id: null
      })
    }
  }
  return matches
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
