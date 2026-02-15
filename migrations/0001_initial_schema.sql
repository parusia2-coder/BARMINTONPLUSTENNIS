-- ============================================
-- 배드민턴 대회 운영 시스템 - 초기 스키마
-- ============================================

-- 대회 테이블
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  format TEXT NOT NULL DEFAULT 'kdk' CHECK(format IN ('kdk', 'league', 'tournament')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
  games_per_player INTEGER DEFAULT 4,
  courts INTEGER DEFAULT 2,
  admin_password TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  deleted INTEGER DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL
);

-- 참가자 테이블
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  level TEXT DEFAULT 'c' CHECK(level IN ('s', 'a', 'b', 'c', 'd', 'e')),
  paid INTEGER DEFAULT 0,
  checked_in INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  deleted INTEGER DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

-- 경기 테이블
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  match_order INTEGER NOT NULL DEFAULT 0,
  court_number INTEGER DEFAULT NULL,
  -- 단식: team1_player1만 사용, 복식: team1_player1 + team1_player2
  team1_player1 INTEGER DEFAULT NULL,
  team1_player2 INTEGER DEFAULT NULL,
  team2_player1 INTEGER DEFAULT NULL,
  team2_player2 INTEGER DEFAULT NULL,
  -- 점수 (세트별)
  team1_set1 INTEGER DEFAULT 0,
  team1_set2 INTEGER DEFAULT 0,
  team1_set3 INTEGER DEFAULT 0,
  team2_set1 INTEGER DEFAULT 0,
  team2_set2 INTEGER DEFAULT 0,
  team2_set3 INTEGER DEFAULT 0,
  -- 경기 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'playing', 'completed', 'cancelled')),
  winner_team INTEGER DEFAULT NULL CHECK(winner_team IN (NULL, 1, 2)),
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (team1_player1) REFERENCES participants(id),
  FOREIGN KEY (team1_player2) REFERENCES participants(id),
  FOREIGN KEY (team2_player1) REFERENCES participants(id),
  FOREIGN KEY (team2_player2) REFERENCES participants(id)
);

-- 순위 테이블 (캐싱용)
CREATE TABLE IF NOT EXISTS standings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  score_for INTEGER DEFAULT 0,
  score_against INTEGER DEFAULT 0,
  goal_difference INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (participant_id) REFERENCES participants(id),
  UNIQUE(tournament_id, participant_id)
);

-- 감사 로그 테이블 (수정 이력)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  match_id INTEGER DEFAULT NULL,
  action TEXT NOT NULL,
  old_value TEXT DEFAULT NULL,
  new_value TEXT DEFAULT NULL,
  updated_by TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (match_id) REFERENCES matches(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_participants_tournament ON participants(tournament_id, deleted);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_standings_tournament ON standings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_audit_tournament ON audit_logs(tournament_id);
