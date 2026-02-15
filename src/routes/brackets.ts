import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const bracketRoutes = new Hono<{ Bindings: Bindings }>()

// 대진표 생성
bracketRoutes.post('/:tid/brackets/generate', async (c) => {
  const tid = c.req.param('tid')
  const db = c.env.DB

  const tournament = await db.prepare(
    `SELECT * FROM tournaments WHERE id=? AND deleted=0`
  ).bind(tid).first() as any

  if (!tournament) return c.json({ error: '대회를 찾을 수 없습니다.' }, 404)

  const { results: participants } = await db.prepare(
    `SELECT * FROM participants WHERE tournament_id=? AND deleted=0 ORDER BY id ASC`
  ).bind(tid).all()

  if (!participants || participants.length < 2) {
    return c.json({ error: '최소 2명의 참가자가 필요합니다.' }, 400)
  }

  // 기존 경기 삭제
  await db.prepare(`DELETE FROM matches WHERE tournament_id=?`).bind(tid).run()
  await db.prepare(`DELETE FROM standings WHERE tournament_id=?`).bind(tid).run()

  let matches: any[] = []

  switch (tournament.format) {
    case 'kdk':
      matches = generateKDK(participants as any[], tournament.games_per_player || 4, tournament.courts || 2)
      break
    case 'league':
      matches = generateLeague(participants as any[], tournament.courts || 2)
      break
    case 'tournament':
      matches = generateTournament(participants as any[], tournament.courts || 2)
      break
    default:
      matches = generateKDK(participants as any[], tournament.games_per_player || 4, tournament.courts || 2)
  }

  // 경기 DB 저장
  for (const m of matches) {
    await db.prepare(
      `INSERT INTO matches (tournament_id, round, match_order, court_number, team1_player1, team1_player2, team2_player1, team2_player2, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(tid, m.round, m.match_order, m.court_number, m.team1_player1, m.team1_player2 || null, m.team2_player1, m.team2_player2 || null).run()
  }

  // 대회 상태 변경
  await db.prepare(
    `UPDATE tournaments SET status='in_progress', updated_at=datetime('now') WHERE id=?`
  ).bind(tid).run()

  // 감사 로그
  await db.prepare(
    `INSERT INTO audit_logs (tournament_id, action, new_value, updated_by)
     VALUES (?, 'GENERATE_BRACKET', ?, 'admin')`
  ).bind(tid, JSON.stringify({ format: tournament.format, matchCount: matches.length, participants: participants.length })).run()

  return c.json({ message: '대진표가 생성되었습니다.', matchCount: matches.length })
})

// ==========================================
// KDK (파트너 랜덤) 대진표 생성
// ==========================================
function generateKDK(participants: any[], gamesPerPlayer: number, courts: number): any[] {
  const ids = participants.map((p: any) => p.id)
  const n = ids.length

  // 1. 모든 가능한 2인 조합 생성 (복식 팀)
  const allTeams: [number, number][] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allTeams.push([ids[i], ids[j]])
    }
  }

  // 2. 셔플
  shuffle(allTeams)

  // 3. 모든 가능한 팀 vs 팀 매치 생성 (같은 선수가 양편에 못 나옴)
  const allMatches: { team1: [number, number]; team2: [number, number] }[] = []
  for (let i = 0; i < allTeams.length; i++) {
    for (let j = i + 1; j < allTeams.length; j++) {
      const t1 = allTeams[i]
      const t2 = allTeams[j]
      // 같은 선수가 양쪽에 있으면 안됨
      if (t1[0] !== t2[0] && t1[0] !== t2[1] && t1[1] !== t2[0] && t1[1] !== t2[1]) {
        allMatches.push({ team1: t1, team2: t2 })
      }
    }
  }

  shuffle(allMatches)

  // 4. 제약 조건 적용: 선수당 경기 수 제한 + 연속 경기 방지
  const playerGameCount: Record<number, number> = {}
  ids.forEach(id => { playerGameCount[id] = 0 })

  const selectedMatches: any[] = []
  const maxGames = gamesPerPlayer

  for (const m of allMatches) {
    const players = [m.team1[0], m.team1[1], m.team2[0], m.team2[1]]

    // 모든 선수의 경기 수가 제한 이내인지
    if (players.every(p => playerGameCount[p] < maxGames)) {
      // 연속 경기 방지: 최근 경기에 참여한 선수 확인
      const lastMatch = selectedMatches[selectedMatches.length - 1]
      let hasConsecutive = false
      if (lastMatch) {
        const lastPlayers = [lastMatch.team1_player1, lastMatch.team1_player2, lastMatch.team2_player1, lastMatch.team2_player2].filter(Boolean)
        hasConsecutive = players.some(p => lastPlayers.includes(p))
      }

      // 연속이면 스킵 (가능한 다른 매치 선택 유도)
      if (hasConsecutive && allMatches.length > selectedMatches.length * 2) continue

      players.forEach(p => { playerGameCount[p]++ })
      
      const round = Math.floor(selectedMatches.length / courts) + 1
      const matchOrder = selectedMatches.length + 1
      const courtNum = (selectedMatches.length % courts) + 1

      selectedMatches.push({
        round,
        match_order: matchOrder,
        court_number: courtNum,
        team1_player1: m.team1[0],
        team1_player2: m.team1[1],
        team2_player1: m.team2[0],
        team2_player2: m.team2[1]
      })
    }

    // 모든 선수가 최소 경기 수에 도달하면 종료
    if (Object.values(playerGameCount).every(c => c >= maxGames)) break
  }

  return selectedMatches
}

// ==========================================
// 풀리그 (Round Robin) 대진표 생성
// ==========================================
function generateLeague(participants: any[], courts: number): any[] {
  const ids = participants.map((p: any) => p.id)
  const matches: any[] = []
  let matchOrder = 0

  // 모든 참가자 조합 (단식)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      matchOrder++
      const round = Math.floor((matchOrder - 1) / courts) + 1
      const courtNum = ((matchOrder - 1) % courts) + 1
      matches.push({
        round,
        match_order: matchOrder,
        court_number: courtNum,
        team1_player1: ids[i],
        team1_player2: null,
        team2_player1: ids[j],
        team2_player2: null
      })
    }
  }

  return matches
}

// ==========================================
// 토너먼트 (Single Elimination) 대진표 생성
// ==========================================
function generateTournament(participants: any[], courts: number): any[] {
  const ids = [...participants.map((p: any) => p.id)]
  shuffle(ids)

  // 2의 제곱으로 바이(bye) 처리
  const n = ids.length
  let bracketSize = 1
  while (bracketSize < n) bracketSize *= 2

  // bye 추가
  while (ids.length < bracketSize) ids.push(null as any)

  const matches: any[] = []
  let matchOrder = 0
  let round = 1

  // 1라운드
  for (let i = 0; i < ids.length; i += 2) {
    matchOrder++
    const courtNum = ((matchOrder - 1) % courts) + 1
    if (ids[i] && ids[i + 1]) {
      matches.push({
        round,
        match_order: matchOrder,
        court_number: courtNum,
        team1_player1: ids[i],
        team1_player2: null,
        team2_player1: ids[i + 1],
        team2_player2: null
      })
    } else if (ids[i]) {
      // bye - 자동 승리
      matches.push({
        round,
        match_order: matchOrder,
        court_number: courtNum,
        team1_player1: ids[i],
        team1_player2: null,
        team2_player1: null,
        team2_player2: null
      })
    }
  }

  // 후속 라운드는 프론트엔드에서 승자를 연결하여 생성
  return matches
}

// 유틸: 셔플
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
