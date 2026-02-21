-- 대회 스코어링 설정 컬럼 추가 (테니스 지원)
ALTER TABLE tournaments ADD COLUMN scoring_type TEXT DEFAULT '';
ALTER TABLE tournaments ADD COLUMN target_games INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN deuce_rule TEXT DEFAULT '';
