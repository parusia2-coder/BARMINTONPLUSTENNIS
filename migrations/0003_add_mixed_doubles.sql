-- ============================================
-- 참가자 혼합복식 참가 여부 필드 추가
-- ============================================

-- participants 테이블에 혼복 참가 여부 컬럼 추가
-- 0 = 혼복 미참가, 1 = 혼복 참가 희망
ALTER TABLE participants ADD COLUMN mixed_doubles INTEGER DEFAULT 0;

-- 혼복 참가자 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_participants_mixed ON participants(tournament_id, gender, mixed_doubles, deleted);
