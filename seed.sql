-- 테스트 대회 데이터
INSERT OR IGNORE INTO tournaments (id, name, description, format, status, max_participants, games_per_player, courts, admin_password) VALUES 
  (1, '2026 봄맞이 배드민턴 대회', '동호회 정기 대회입니다. 많은 참가 바랍니다!', 'kdk', 'open', 16, 4, 2, 'admin123');

-- 테스트 참가자 데이터
INSERT OR IGNORE INTO participants (id, tournament_id, name, phone, level, paid, checked_in) VALUES 
  (1, 1, '김민수', '010-1234-5678', 'advanced', 1, 1),
  (2, 1, '이정호', '010-2345-6789', 'intermediate', 1, 1),
  (3, 1, '박서연', '010-3456-7890', 'advanced', 1, 1),
  (4, 1, '최유진', '010-4567-8901', 'intermediate', 1, 0),
  (5, 1, '정다영', '010-5678-9012', 'beginner', 0, 0),
  (6, 1, '한승우', '010-6789-0123', 'advanced', 1, 1),
  (7, 1, '윤지민', '010-7890-1234', 'intermediate', 1, 1),
  (8, 1, '송현우', '010-8901-2345', 'beginner', 1, 0);
