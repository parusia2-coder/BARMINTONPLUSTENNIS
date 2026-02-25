-- ============================================
-- 장소(Venue) 테이블 추가
-- 한 대회가 여러 장소에서 진행될 수 있도록 지원
-- ============================================

-- 장소 테이블
CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  name TEXT NOT NULL,                     -- 장소명 (예: 안양시민체육관)
  short_name TEXT DEFAULT '',             -- 약칭 (예: 시민관)
  address TEXT DEFAULT '',                -- 주소
  court_start INTEGER NOT NULL DEFAULT 1, -- 이 장소의 시작 코트 번호
  court_end INTEGER NOT NULL DEFAULT 4,   -- 이 장소의 끝 코트 번호
  sort_order INTEGER DEFAULT 0,           -- 정렬 순서
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

-- matches 테이블에 venue_id 추가
ALTER TABLE matches ADD COLUMN venue_id INTEGER DEFAULT NULL REFERENCES venues(id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_venues_tournament ON venues(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_venue ON matches(venue_id);
