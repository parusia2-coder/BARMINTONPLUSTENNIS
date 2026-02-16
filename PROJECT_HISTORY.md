# 배드민턴 대회 운영 시스템 - 프로젝트 히스토리

> 세션이 끊어졌을 때 이 파일을 읽으면 프로젝트 전체 맥락을 복원할 수 있습니다.
> 마지막 업데이트: 2026-02-16

---

## 1. 프로젝트 개요

- **프로젝트명**: 배드민턴 대회 운영 시스템
- **프로젝트 경로**: `/home/user/webapp`
- **기술 스택**: Hono + TypeScript + Cloudflare Workers (D1 SQLite) + Tailwind CSS (CDN)
- **포트**: 3000
- **PM2 프로세스명**: `badminton`
- **관리자 테스트 비밀번호**: `admin123`
- **프로젝트 아카이브**: https://www.genspark.ai/api/files/s/Qkc2iuBA (≈0.9 MB)

### 기기별 역할
| 기기 | URL | 용도 |
|------|-----|------|
| 관리자 노트북 | `/` | 대회관리, 참가자등록, 종목/팀편성, 대진표 |
| 코트 태블릿 | `/court?tid={대회ID}&court={코트번호}&locked=1&autonext=true` | 코트별 실시간 점수 입력 (잠금모드) |
| 대형 모니터 | `/dashboard?tid={대회ID}` | 관중용 실시간 현황 (30초 자동갱신) |
| 참가자 스마트폰 | `/my?tid={대회ID}` | 개인 일정/결과 확인 (QR 접속) |

---

## 2. 파일 구조 (총 6,985줄)

```
/home/user/webapp/
├── src/
│   ├── index.tsx                 (399줄) 메인 Hono 앱, 라우팅, HTML 템플릿, /court /dashboard /my 페이지
│   └── routes/
│       ├── tournaments.ts        (148줄) 대회 CRUD, 인증, 통계
│       ├── participants.ts       (200줄) 참가자 등록/수정/삭제, 일괄등록, 클럽 정보
│       ├── events.ts             (698줄) 종목 관리, 팀 등록, 자동팀편성, 급수합병, 조 배정
│       ├── matches.ts            (640줄) 경기/점수/순위, 코트 점수판 API, 서명, 대시보드, 내경기
│       └── brackets.ts           (668줄) 대진표 생성 (KDK/풀리그/토너먼트), 결선 토너먼트
├── public/static/
│   ├── app.js                    (1,687줄) 메인 프론트엔드 SPA
│   ├── court.js                  (1,471줄) 코트 전용 점수판 프론트엔드
│   ├── style.css                          커스텀 스타일
│   ├── manual.html               (1,074줄) A4 인쇄용 현장 운영 매뉴얼
│   └── test_participants_100.txt          테스트 데이터 100명
├── migrations/
│   ├── 0001_initial_schema.sql            DB 스키마 (기본 테이블)
│   ├── 0002_add_signatures.sql            경기 서명 필드 추가
│   ├── 0003_add_mixed_doubles.sql         혼합복식 참가 필드
│   └── 0004_add_club_and_groups.sql       클럽/조 번호/인덱스 추가
├── seed.sql                               실제 장년부 데이터 (177명, 18개 클럽)
├── ecosystem.config.cjs                   PM2 설정
├── wrangler.jsonc                         Cloudflare 설정
├── vite.config.ts                         Vite 빌드 설정
├── tsconfig.json                          TypeScript 설정
├── package.json                           의존성 및 스크립트
├── generate_test_data.py                  테스트 참가자 생성 스크립트
├── README.md                              개발 문서 (전체 API/스키마/로직 문서화)
└── PROJECT_HISTORY.md                     ← 이 파일
```

---

## 3. DB 스키마 (D1 SQLite) — 4개 마이그레이션

### tournaments (대회)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동증가 |
| name | TEXT | 대회명 |
| description | TEXT | 설명 |
| status | TEXT | draft/open/in_progress/completed/cancelled |
| format | TEXT | kdk/league/tournament |
| games_per_player | INTEGER | KDK 방식 팀당 경기수 (기본 4) |
| courts | INTEGER | 코트 수 (기본 2) |
| merge_threshold | INTEGER | 급수합병 기준 팀수 (기본 4) |
| admin_password | TEXT | 관리자 비밀번호 |
| deleted | INTEGER | 소프트삭제 (0/1) |

### events (종목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동증가 |
| tournament_id | INTEGER FK | 대회 |
| category | TEXT | md(남복)/wd(여복)/xd(혼복) |
| age_group | TEXT | open/20대/30대/40대/50대이상 |
| level_group | TEXT | all/s/a/b/c/d/e 또는 합병시 "merged" |
| name | TEXT | 자동생성 예: "남자복식 오픈 A+B급" |
| status | TEXT | pending/in_progress/completed/cancelled |
| merged_from | TEXT | JSON 배열 (합병 원본 종목 ID들) |

### participants (참가자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동증가 |
| tournament_id | INTEGER FK | 대회 |
| name | TEXT | 이름 |
| phone | TEXT | 연락처 |
| gender | TEXT | m(남)/f(여) |
| birth_year | INTEGER | 출생년도 |
| level | TEXT | s/a/b/c/d/e |
| paid | INTEGER | 참가비 납부 (0/1) |
| checked_in | INTEGER | 체크인 (0/1) |
| deleted | INTEGER | 소프트삭제 |
| **club** | **TEXT** | **소속 클럽 (0004 추가)** |
| **wants_mixed** | **INTEGER** | **혼복 참가 희망 (0003 추가)** |

### teams (팀 - 복식 2인)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동증가 |
| event_id | INTEGER FK | 종목 |
| tournament_id | INTEGER FK | 대회 |
| player1_id | INTEGER FK | 선수1 |
| player2_id | INTEGER FK | 선수2 |
| team_name | TEXT | "선수A · 선수B" 형태 |
| **group_num** | **INTEGER** | **조 번호 (0004 추가)** |

### matches (경기)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동증가 |
| tournament_id | INTEGER FK | 대회 |
| event_id | INTEGER FK | 종목 |
| round | INTEGER | 라운드 번호 |
| match_order | INTEGER | 경기 순서 |
| court_number | INTEGER | 코트 번호 |
| team1_id, team2_id | INTEGER FK | 대진 팀 |
| team1_set1~3, team2_set1~3 | INTEGER | 세트별 점수 |
| status | TEXT | pending/playing/completed/cancelled |
| winner_team | INTEGER | 1 또는 2 (승리팀) |
| **group_num** | **INTEGER** | **조 번호 (0004 추가)** |
| **team1_signature** | **TEXT** | **팀1 서명 데이터 (0002 추가)** |
| **team2_signature** | **TEXT** | **팀2 서명 데이터 (0002 추가)** |
| **signature_at** | **DATETIME** | **서명 시각 (0002 추가)** |

### standings (순위)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| event_id + team_id | UNIQUE | 종목별 팀 순위 |
| wins, losses, points | INTEGER | 승/패/승점 |
| score_for, score_against | INTEGER | 득점/실점 |
| goal_difference | INTEGER | 득실차 |

### audit_logs (감사로그)
- tournament_id, match_id, action, old_value, new_value, updated_by, created_at

### 추가 인덱스 (0004)
- `idx_participants_club` — 클럽별 조회 최적화
- `idx_teams_group_num` — 조별 조회 최적화
- `idx_matches_group_num` — 조별 경기 조회 최적화

---

## 4. API 엔드포인트 전체 목록

모든 API는 `/api/tournaments` 아래에 마운트됩니다.

### 대회 관리 (tournaments.ts)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/tournaments` | 대회 목록 |
| GET | `/api/tournaments/:id` | 대회 상세 |
| POST | `/api/tournaments` | 대회 생성 |
| PUT | `/api/tournaments/:id` | 대회 수정 (비밀번호 필요) |
| PATCH | `/api/tournaments/:id/status` | 상태 변경 |
| DELETE | `/api/tournaments/:id` | 소프트 삭제 |
| POST | `/api/tournaments/:id/auth` | 관리자 인증 |
| GET | `/api/tournaments/:id/stats` | 통계 |

### 참가자 관리 (participants.ts)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/tournaments/:tid/participants` | 참가자 목록 (?club= 클럽 필터) |
| POST | `/api/tournaments/:tid/participants` | 개별 등록 (club 필드 포함) |
| POST | `/api/tournaments/:tid/participants/bulk` | 일괄 등록 (텍스트/CSV) |
| PUT | `/api/tournaments/:tid/participants/:pid` | 수정 |
| DELETE | `/api/tournaments/:tid/participants/:pid` | 삭제 |
| PATCH | `/api/tournaments/:tid/participants/:pid/paid` | 참가비 토글 |
| PATCH | `/api/tournaments/:tid/participants/:pid/checkin` | 체크인 토글 |

### 종목/팀 관리 (events.ts)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/tournaments/:tid/events` | 종목 목록 (팀수 포함) |
| POST | `/api/tournaments/:tid/events` | 종목 생성 |
| DELETE | `/api/tournaments/:tid/events/:eid` | 종목 삭제 |
| POST | `/api/tournaments/:tid/events/:eid/teams` | 팀 수동 등록 |
| GET | `/api/tournaments/:tid/events/:eid/teams` | 팀 목록 |
| DELETE | `/api/tournaments/:tid/events/:eid/teams/:teamId` | 팀 삭제 |
| POST | `/api/tournaments/:tid/events/:eid/auto-assign` | 단일 종목 자동 팀편성 |
| POST | `/api/tournaments/:tid/events/auto-assign-all` | 전체 자동 팀편성 |
| POST | `/api/tournaments/:tid/events/check-merge` | 급수합병 체크 |
| POST | `/api/tournaments/:tid/events/execute-merge` | 급수합병 실행 |
| POST | `/api/tournaments/:tid/events/:eid/assign-groups` | 단일 종목 조 배정 |

### 경기/점수/순위 (matches.ts)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/tournaments/:tid/matches` | 경기 목록 (?event_id= 필터) |
| PUT | `/api/tournaments/:tid/matches/:mid/score` | 점수 업데이트 (감사 로그 기록) |
| PATCH | `/api/tournaments/:tid/matches/:mid/status` | 상태 변경 |
| GET | `/api/tournaments/:tid/standings` | 순위 조회 (자동 재계산) |
| GET | `/api/tournaments/:tid/court/:courtNum` | 코트별 현재 경기/대기/최근 |
| POST | `/api/tournaments/:tid/court/:courtNum/next` | 코트 다음 경기 자동 시작 |
| GET | `/api/tournaments/:tid/courts/overview` | 전체 코트 현황 |
| GET | `/api/tournaments/:tid/audit-logs` | 최근 100건 감사 로그 |
| POST | `/api/tournaments/:tid/matches/:mid/signature` | 경기 서명 저장 |
| GET | `/api/tournaments/:tid/matches/:mid/signature` | 경기 서명 조회 |
| GET | `/api/tournaments/:tid/dashboard` | 통계 대시보드 (전체/종목별/클럽별) |
| GET | `/api/tournaments/:tid/my-matches?name=&phone=` | 참가자 개인 경기 조회 |

### 대진표 (brackets.ts)
| 메서드 | 경로 | 파라미터 | 설명 |
|--------|------|----------|------|
| POST | `/api/tournaments/:tid/brackets/generate` | format, event_id, groups, teamsPerGroup | 예선 대진표 생성 (KDK/풀리그/토너먼트) |
| POST | `/api/tournaments/:tid/brackets/generate-finals` | event_id, topN | 결선 토너먼트 생성 (조별 상위 N팀) |
| GET | `/api/tournaments/:tid/brackets/finals-preview` | event_id, topN | 결선 진출팀 미리보기 |

### 프론트엔드 페이지
| 경로 | 파라미터 | 대상 | 설명 |
|------|----------|------|------|
| `/` | — | 관리자 | 메인 SPA (app.js) |
| `/court` | tid, court, locked, autonext | 코트 심판 | 코트 전용 점수판 (court.js) |
| `/dashboard` | tid | 관중/대형모니터 | 실시간 통계 대시보드 |
| `/my` | tid | 참가자 | 개인 일정/결과 확인 |
| `/static/manual.html` | — | 운영자 | A4 인쇄용 현장 운영 매뉴얼 |
| `/api/health` | — | 시스템 | 헬스체크 |

---

## 5. 핵심 비즈니스 로직

### 종목 구분
- **종류**: 남자복식(md), 여자복식(wd), 혼합복식(xd)
- **연령대**: 오픈(전연령), 20대, 30대, 40대, 50대이상
- **급수**: S, A, B, C, D, E (6단계)

### 자동 팀편성 로직 (events.ts auto-assign)
- 남복: 남자 참가자끼리 급수 비슷한 순으로 2인 1팀
- 여복: 여자 참가자끼리 급수 비슷한 순으로 2인 1팀
- 혼복: 남 1명 + 여 1명 조합, 이미 사용된 선수도 가능 (중복 참가 허용)
- 급수 순서로 정렬 후 인접한 2명씩 묶음

### 급수합병 로직 (events.ts check-merge / execute-merge)
- 같은 종류+연령대 내에서 팀 수가 merge_threshold(기본 4) 미만인 종목 탐지
- 인접 급수끼리 순차 합병 (S→A→B→C→D→E)
- 합산 팀수가 threshold 이상이 될 때까지 계속 합병
- 예: A(1팀) + B(1팀) + C(2팀) → "A+B+C급" (4팀)

### 대진표 생성 (brackets.ts)
- **KDK**: 모든 팀 대결 조합 중 랜덤 선택, 팀당 games_per_player 만큼 배정
- **풀리그**: 라운드 로빈 (모든 팀이 서로 1번씩)
- **토너먼트**: 싱글 엘리미네이션 (단판 토너먼트)
- 코트 번호 자동 배정 (라운드 로빈)
- **조별 대진**: groups 파라미터로 조 수 지정, teamsPerGroup으로 조당 팀수 제한

### 결선 토너먼트 (brackets.ts generate-finals)
1. 종목의 조별 순위 계산 (승점 → 득실차 → 득점 순)
2. 각 조에서 상위 topN 팀 추출
3. 기존 결선 경기 삭제 (round >= 900)
4. 싱글 엘리미네이션 대진표 생성 (round 900번대)
5. 같은 조 팀끼리 초반 대결 회피 (시드 배치)

### 순위 계산 알고리즘
- 승점(승리 시 2점, 패배 시 0점) → 득실차(총득점−총실점) → 총득점 순

### 코트 점수판 (court.js)
- 워크플로우: 코트선택 → 대기화면 → 경기시작 → 점수입력 → 서명확인 → 경기종료 → 자동 다음경기
- 3세트 관리, 세트 탭 전환
- 터치 최적화 (+/- 큰 버튼), 실행취소 기능
- 자동 승자 추천 (세트 승수 기반)
- 10초 자동 새로고침 (대기 화면에서)
- `locked=1`: 읽기 전용 모드 (관중/모니터용)
- `autonext=true`: 경기 종료 후 자동으로 다음 경기 시작

### 통계 대시보드 (matches.ts dashboard)
- 전체 통계: 총 경기수, 완료율, 진행중/대기/완료 수
- 종목별 통계: 각 종목의 진행 현황
- 클럽별 통계: 소속 클럽별 참가자 수, 승률
- 30초 자동 갱신

### 참가자 개인 페이지 (matches.ts my-matches)
- 이름+연락처로 본인 경기 조회
- QR 코드로 빠른 접속
- 진행중/예정/완료 경기 구분 표시

---

## 6. 개발 히스토리 (Git 커밋 순서)

### Phase 1: 기본 시스템 구축 (2026-02-15)
```
61e5496 2026-02-15 13:15 Initial commit: Badminton Tournament Management System
a9949e8 2026-02-15 13:15 Add README documentation
b4488ab 2026-02-15 13:24 Change level system from beginner/intermediate/advanced to S/A/B/C/D/E grades
5d9280e 2026-02-15 13:26 Remove 64-person cap on max participants, default to 100
785e31e 2026-02-15 13:30 Remove max_participants limit entirely
1a5737c 2026-02-15 13:44 Major feature: Event system with categories (MD/WD/XD), age groups, grade merging
ec0f1c0 2026-02-15 13:55 Add bulk participant registration (text paste + CSV upload)
fe323e1 2026-02-15 13:59 Add 100 test participants and downloadable test data file
6ec5944 2026-02-15 14:06 Add auto team assignment for events
```

### Phase 2: 코트 점수판 & 운영 시스템 (2026-02-15)
```
237b59a 2026-02-15 14:16 Feature: Court-side scoreboard for live score management on tablets
4c465f3 2026-02-15 14:30 Improve: Full operational system for tablet/mobile management
f39c184 2026-02-15 14:34 Add PROJECT_HISTORY.md for session recovery
```

### Phase 3: 점수 규칙 & 코트 UX 강화 (2026-02-15 ~ 02-16)
```
dd726c3 2026-02-15 23:24 Feature: Score rules - 25pt for preliminary (KDK/League), 21pt for finals (Tournament)
a94f6a2 2026-02-15 23:53 1세트 단판 규칙 적용 완료
5b9fb60 2026-02-16 00:09 코트 점수판 좌우 레이아웃 + 터치 점수 입력 + 전후반 교체
467b27d 2026-02-16 00:23 사이드 선택 UX 강화 + 자동 코트 교체 로직 개선
2115700 2026-02-16 00:32 경기 종료 후 점수 확인 서명 기능 추가
012d13c 2026-02-16 00:40 탁구 아이콘을 배드민턴 셔틀콕 아이콘으로 교체
dab6c06 2026-02-16 00:50 가이드북 v2.0 업데이트: 사이드선택/자동교체/서명확인/아이콘교체 반영
```

### Phase 4: 혼복 & 데이터 확장 (2026-02-16)
```
adcf946 2026-02-16 01:09 feat: 혼합복식(혼복) 참가 여부 기능 추가
9059c72 2026-02-16 05:10 data: 160명 테스트 참가자 seed 데이터 (남96/여64, 급수·혼복 분포 포함)
d1a3a8f 2026-02-16 05:52 feat: 조편성/대진표 옵션 시스템 구현
```

### Phase 5: 실전 데이터 & 결선/대시보드/참가자 (2026-02-16)
```
bd4d136 2026-02-16 09:12 feat: 실제 장년부 회원 데이터(177명, 18개 클럽) seed.sql 생성 및 대진표 응답 개선
6988785 2026-02-16 09:18 docs: README.md 전면 업데이트 - 전체 기능/API/데이터모델/사용가이드 반영
4e5822d 2026-02-16 10:31 feat: 결선 토너먼트, 통계 대시보드, 참가자 페이지 구현 (1,418 insertions)
ed9e94c 2026-02-16 10:33 docs: README 업데이트 - 결선 토너먼트, 통계, 참가자 페이지 문서화
```

### Phase 6: 개발 문서 & 운영 매뉴얼 (2026-02-16)
```
dfd2e39 2026-02-16 10:40 docs: 개발문서 전면 보강 - 전체 API 엔드포인트, DB 스키마, 비즈니스 로직 상세 문서화
f7bbc3a 2026-02-16 10:46 docs: 현장 운영 셋팅 가이드 추가 - 장비/네트워크/인력 배치, 당일 타임라인
4e32fb5 2026-02-16 10:54 feat: A4 인쇄용 현장 운영 매뉴얼 HTML 추가 (/static/manual.html)
2772f76 2026-02-16 11:10 docs: 네트워크 섹션 대폭 보강 - 체육관 환경, 대역 분리, 공유기 설치, 비상 대응
9db6648 2026-02-16 11:19 docs: 공유기 추천을 실제 구매 가능 제품으로 업데이트 (가격/링크/구매방법 포함)
```

---

## 7. 샘플 데이터 현황

| 항목 | 수량 |
|------|------|
| 참가자 | 177명 (남 122명, 여 55명) |
| 소속 클럽 | 18개 |
| 팀 | 116팀 |
| 조 | 25개 |
| 경기 | 214경기 |

---

## 8. 빌드 & 실행 명령어

```bash
# 전체 리셋 (DB 초기화 + 시드)
cd /home/user/webapp
rm -rf .wrangler/state/v3/d1
npm run build
npx wrangler d1 migrations apply badminton-production --local
npx wrangler d1 execute badminton-production --local --file=./seed.sql

# 서비스 시작/재시작
fuser -k 3000/tcp 2>/dev/null || true
pm2 restart badminton  (또는 pm2 start ecosystem.config.cjs)

# 빌드만 (코드 수정 후)
npm run build
pm2 restart badminton

# 로그 확인
pm2 logs badminton --nostream

# 헬스체크
curl http://localhost:3000/api/health

# npm 명령어
npm run build             # Vite 빌드
npm run db:reset          # DB 완전 초기화
npm run db:migrate:local  # 마이그레이션 적용
npm run db:seed           # 시드 데이터
```

---

## 9. 주요 설정

### wrangler.jsonc
```jsonc
{
  "name": "webapp",
  "compatibility_date": "2026-02-15",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "badminton-production",
    "database_id": "local-dev-db"
  }]
}
```

### ecosystem.config.cjs (PM2)
```javascript
{
  name: 'badminton',
  script: 'npx',
  args: 'wrangler pages dev dist --d1=badminton-production --local --ip 0.0.0.0 --port 3000'
}
```

### 의존성
- **runtime**: hono ^4.11.9
- **dev**: @hono/vite-build, @hono/vite-dev-server, vite ^6.3.5, wrangler ^4.4.0

---

## 10. 현재 상태 & 남은 작업

### ✅ 완료된 기능
- [x] 대회 CRUD (생성/수정/삭제/상태변경)
- [x] 참가자 관리 (개별/일괄 등록, 참가비, 체크인, 클럽)
- [x] 종목 시스템 (남복/여복/혼복, 연령대, 급수)
- [x] 자동 팀편성 (성별/급수 고려, 단일/전체)
- [x] 급수합병 (인접급수 자동 합병)
- [x] 조 배정 (종목별 그룹 배정)
- [x] 대진표 생성 (KDK/풀리그/토너먼트, 조별 옵션)
- [x] **결선 토너먼트** (조별 상위팀 → 단판 싱글 엘리미네이션)
- [x] 점수 관리 (세트별 점수, 승자, 순위 자동계산)
- [x] **코트 전용 점수판** (/court) — URL 파라미터, 자동 다음경기, QR코드, 읽기전용, 전체보기
- [x] 경기 서명 확인 기능
- [x] **통계 대시보드** (/dashboard) — 전체/종목별/클럽별 실시간 통계
- [x] **참가자 개인 페이지** (/my) — 이름+연락처로 내 경기 조회, QR 접속
- [x] 스코어보드 (관중용, 자동갱신)
- [x] 결과/순위표 + PDF 출력
- [x] 감사 로그
- [x] 반응형 UI (모바일/태블릿/데스크탑)
- [x] **A4 인쇄용 현장 운영 매뉴얼** (/static/manual.html)
- [x] 네트워크 구성 가이드 (공유기 추천, 구매 링크 포함)
- [x] 실제 장년부 데이터 시딩 (177명, 18개 클럽)

### 🔮 향후 개선 가능 사항
- [ ] Cloudflare Pages 실 배포 (wrangler pages deploy)
- [ ] GitHub 푸시
- [ ] 실시간 WebSocket (현재는 폴링 방식)
- [ ] 참가자 본인 경기 알림 (푸시 알림)
- [ ] 다중 대회 동시 운영 최적화
- [ ] 오프라인 모드 (Service Worker)
- [ ] 대회 결과 통계 리포트 (PDF 자동 생성)

---

## 11. 세션 복원 절차

새 세션에서 이 파일을 읽은 후 아래 순서로 복원합니다:

```bash
# 1. 현재 상태 확인
cd /home/user/webapp
git log --oneline -5
pm2 list

# 2. 서비스가 죽어있으면 재시작
npm run build
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 3. DB가 초기화되었으면
npm run db:reset

# 4. 동작 확인
curl http://localhost:3000/api/health
curl http://localhost:3000/api/tournaments

# 5. 주요 페이지 확인
# 관리자: http://localhost:3000/
# 코트 점수판: http://localhost:3000/court?tid=1&court=1
# 대시보드: http://localhost:3000/dashboard?tid=1
# 내 경기: http://localhost:3000/my?tid=1
# 운영 매뉴얼: http://localhost:3000/static/manual.html
```
