-- ============================================
-- 대회 운영 시스템 - 초기 스키마 (멀티스포츠 통합)
-- ============================================

-- 대회 테이블
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
  format TEXT NOT NULL DEFAULT 'kdk' CHECK(format IN ('kdk', 'league', 'tournament')),
  scoring_type TEXT DEFAULT '',
  target_games INTEGER DEFAULT 0,
  deuce_rule TEXT DEFAULT '',
  games_per_player INTEGER DEFAULT 4,
  courts INTEGER DEFAULT 2,
  merge_threshold INTEGER DEFAULT 4,
  admin_password TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  deleted INTEGER DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL
);

-- 종목 테이블
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('ms', 'ws', 'md', 'wd', 'xd')),
  age_group TEXT NOT NULL DEFAULT 'open',
  level_group TEXT NOT NULL DEFAULT 'all',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  merged_from TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

-- 참가자 테이블
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  gender TEXT NOT NULL DEFAULT 'm' CHECK(gender IN ('m', 'f')),
  birth_year INTEGER DEFAULT NULL,
  level TEXT DEFAULT 'c' CHECK(level IN ('s', 'a', 'b', 'c', 'd', 'e')),
  club TEXT DEFAULT '',
  mixed_doubles INTEGER DEFAULT 0,
  paid INTEGER DEFAULT 0,
  checked_in INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  deleted INTEGER DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

-- 팀 테이블 (단식 1인 또는 복식 2인 1팀)
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  player1_id INTEGER NOT NULL,
  player2_id INTEGER,
  team_name TEXT DEFAULT '',
  group_num INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (player1_id) REFERENCES participants(id),
  FOREIGN KEY (player2_id) REFERENCES participants(id)
);

-- 경기 테이블
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  match_order INTEGER NOT NULL DEFAULT 0,
  court_number INTEGER DEFAULT NULL,
  team1_id INTEGER DEFAULT NULL,
  team2_id INTEGER DEFAULT NULL,
  -- 점수 (세트별)
  team1_set1 INTEGER DEFAULT 0,
  team1_set2 INTEGER DEFAULT 0,
  team1_set3 INTEGER DEFAULT 0,
  team2_set1 INTEGER DEFAULT 0,
  team2_set2 INTEGER DEFAULT 0,
  team2_set3 INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'playing', 'completed', 'cancelled')),
  winner_team INTEGER DEFAULT NULL CHECK(winner_team IN (NULL, 1, 2)),
  group_num INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (team1_id) REFERENCES teams(id),
  FOREIGN KEY (team2_id) REFERENCES teams(id)
);

-- 순위 테이블 (팀 기준)
CREATE TABLE IF NOT EXISTS standings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  score_for INTEGER DEFAULT 0,
  score_against INTEGER DEFAULT 0,
  goal_difference INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE(event_id, team_id)
);

-- 감사 로그 테이블
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

-- 푸시 알림 구독 테이블
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  participant_name TEXT DEFAULT '',
  participant_phone TEXT DEFAULT '',
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_events_tournament ON events(tournament_id);
CREATE INDEX IF NOT EXISTS idx_participants_tournament ON participants(tournament_id, deleted);
CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_event ON matches(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_standings_event ON standings(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_tournament ON audit_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_tournament ON push_subscriptions(tournament_id);
