-- 부전승(forfeit) 지원 컬럼 추가
-- is_forfeit: 부전승 여부 (0=정상, 1=부전승)
-- forfeit_team: 부전패 팀 (1 또는 2, 해당 팀이 불참/기권)
ALTER TABLE matches ADD COLUMN is_forfeit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN forfeit_team INTEGER DEFAULT NULL;
