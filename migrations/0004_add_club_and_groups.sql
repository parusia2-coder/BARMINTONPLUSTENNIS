-- ============================================
-- 클럽(소속) 필드 및 조(그룹) 시스템 추가
-- ============================================

-- participants 테이블에 클럽(소속) 컬럼 추가
ALTER TABLE participants ADD COLUMN club TEXT DEFAULT '';

-- teams 테이블에 조(그룹) 번호 컬럼 추가
ALTER TABLE teams ADD COLUMN group_num INTEGER DEFAULT NULL;

-- matches 테이블에 조(그룹) 번호 컬럼 추가
ALTER TABLE matches ADD COLUMN group_num INTEGER DEFAULT NULL;

-- 클럽별 참가자 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_participants_club ON participants(tournament_id, club, deleted);
