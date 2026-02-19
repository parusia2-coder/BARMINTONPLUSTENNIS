-- ============================================
-- 참가자 등록 시 희망 파트너 지정 기능 추가
-- ============================================
ALTER TABLE participants ADD COLUMN partner_name TEXT DEFAULT '';
