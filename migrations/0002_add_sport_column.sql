-- ============================================
-- 대회별 종목 구분 (badminton / tennis) 지원
-- ============================================
ALTER TABLE tournaments ADD COLUMN sport TEXT NOT NULL DEFAULT 'badminton' CHECK(sport IN ('badminton', 'tennis'));
