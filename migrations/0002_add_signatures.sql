-- ============================================
-- 경기 서명 확인 기능 추가
-- ============================================

-- matches 테이블에 서명 컬럼 추가
ALTER TABLE matches ADD COLUMN winner_signature TEXT DEFAULT NULL;
ALTER TABLE matches ADD COLUMN loser_signature TEXT DEFAULT NULL;
ALTER TABLE matches ADD COLUMN signature_at DATETIME DEFAULT NULL;
