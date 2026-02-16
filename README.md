# 🏸 배드민턴 대회 운영 시스템

## 프로젝트 개요
- **이름**: Badminton Tournament Management System
- **목적**: 소규모~중규모 배드민턴 동호회/클럽 대회 운영 자동화
- **규모**: 200명 이하 대회 운영에 최적화
- **관리자 비밀번호**: `admin123` (테스트용)

## 기술 스택
| 구분 | 기술 | 설명 |
|------|------|------|
| Backend | Hono (TypeScript) | 경량 웹 프레임워크 (Cloudflare Workers) |
| Database | Cloudflare D1 (SQLite) | 관계형 데이터베이스 |
| Frontend | Vanilla JS + TailwindCSS | CDN 기반 SPA |
| Hosting | Cloudflare Pages | 엣지 배포 |
| PDF | jsPDF + html2canvas | 결과 PDF 출력 |
| Font | Noto Sans KR | 한국어 최적화 UI |

---

## 주요 기능

### ✅ 구현 완료

#### 1. 대회 관리
- 대회 생성/수정/삭제 (Soft Delete)
- 상태 관리: 초안(draft) → 접수중(open) → 진행중(in_progress) → 완료(completed)
- 관리자 비밀번호 인증
- 코트 수, 팀당 경기수, 합병 기준 설정

#### 2. 참가자 관리
- 개별 등록 및 수정 (이름, 전화, 성별, 출생년도, 급수, 소속클럽)
- **일괄 등록** (텍스트 붙여넣기 / CSV 업로드)
- 참가비 납부 토글
- 체크인 토글
- 혼합복식 참가 희망 토글
- 소속 클럽(동호회) 관리

#### 3. 종목 관리
- 종목 유형: 남자복식(md), 여자복식(wd), 혼합복식(xd)
- 연령대: 오픈, 장년부 등
- 급수별 세분화: S/A/B/C/D/E급, 전체
- 급수 합병 (팀 수 부족 시 자동 제안 및 실행)

#### 4. 조편성 옵션 시스템
- **팀 편성 방식 3가지 선택 가능**:
  - 🏢 **같은 클럽 우선**: 같은 동호회 멤버끼리 팀을 먼저 구성
  - 📊 **급수 매칭**: 비슷한 실력끼리 팀 구성 (클럽 무시)
  - 🎲 **완전 랜덤**: 무작위 팀 편성
- **조 배정 옵션**:
  - 조당 팀 수 설정 (3~8팀, 기본 5팀)
  - 같은 클럽 다른 조 배정 (동호회 분산)
- **시뮬레이션 프리뷰**: 실제 적용 전 예상 팀 수, 조 수, 경기 수 미리 확인
- 단일 종목 / 전체 종목 일괄 편성 지원

#### 5. 대진표 옵션 시스템
- **대진 포맷 5가지 선택 가능**:
  - 🤖 **자동 (추천)**: 조가 있으면 조별리그, 5팀 이하 풀리그, 그 외 KDK
  - 🏆 **조별 리그**: 같은 조끼리 풀리그 (4~5팀 권장)
  - 🎯 **KDK**: 팀당 N회 랜덤 매칭 (대규모 대회 적합)
  - 📋 **풀리그**: 모든 팀 1:1 라운드 로빈
  - 🥊 **싱글 엘리미네이션**: 토너먼트 방식
- **추가 옵션**:
  - 같은 클럽 대전 회피 (대진 순서 최적화)
  - 팀당 경기수 설정 (KDK 모드)
  - 코트 배분 자동화

#### 6. 경기 운영
- 실시간 점수 입력 (3세트제, 세트별 점수)
- 승자 자동/수동 판정
- 코트별 경기 배정 및 진행
- 경기 상태 관리: 대기(pending) → 진행(playing) → 완료(completed)
- 경기 결과 서명 확인 (승/패팀 서명 캔버스)

#### 7. 코트 전용 점수판 (`/court`)
- 전체화면 스코어보드 UI (코트 옆 모니터/태블릿용)
- 터치 기반 점수 입력 (좌우 터치 영역)
- 사이드 체인지 기능
- 코트별 실시간 상태 표시
- 모바일/태블릿 최적화

#### 8. 순위 및 결과
- 자동 순위 계산 (승점 → 득실차 → 득점)
- 조별/종목별 순위표
- 결과 PDF 출력 (html2canvas + jsPDF)
- 감사 로그 (점수 수정 이력 추적)

#### 9. 기타
- 오프라인 감지 및 경고
- 반응형 모바일 UI
- 코트 수 기반 라운드 자동 배분

---

## 테스트 데이터 (현재 적용)

**2026장년부회비명단.xlsx** 엑셀 파일 기반 실제 회원 데이터:

| 항목 | 내용 |
|------|------|
| 대회명 | 2026 안양시장배 장년부 배드민턴 대회 |
| 총 참가자 | **177명** (남자 122명, 여자 55명) |
| 클럽 수 | **18개** |
| 급수 분포 | S:13 / A:83 / B:44 / C:26 / D:11 |
| 혼복 신청 | 남 49명, 여 37명 |
| 참가비 납부 | 약 82% |
| 체크인 | 약 71% |

### 클럽별 인원
| 클럽 | 인원 | 클럽 | 인원 | 클럽 | 인원 |
|------|------|------|------|------|------|
| 평촌 | 24 | CS연현 | 11 | 에이스 | 7 |
| 부흥 | 22 | 부림 | 9 | 만안 | 6 |
| 청운 | 19 | 일심 | 9 | 안양 | 5 |
| 병목안 | 16 | 덕천 | 7 | 인덕원 | 5 |
| 근린 | 15 | 호계 | 5 | 관악 | 2 |
| 비산 | 13 | 동안 | 1 | 안일 | 1 |

### 테스트 시나리오 (검증 완료)
| 종목 | 팀수 | 조수 | 경기수 | 포맷 |
|------|------|------|--------|------|
| 남자복식 A급 (S+A) | 28팀 | 6조 | 52경기 | 조별리그 |
| 남자복식 B급 | 14팀 | 3조 | 26경기 | 조별리그 |
| 남자복식 C급 | 10팀 | 2조 | 20경기 | 조별리그 |
| 여자복식 전체 | 27팀 | 6조 | 48경기 | 조별리그 |
| 혼합복식 전체 | 37팀 | 8조 | 68경기 | 조별리그 |
| **합계** | **116팀** | **25조** | **214경기** | |

---

## 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx                  # 메인 Hono 앱 & HTML 페이지 (SPA + 코트 점수판)
│   └── routes/
│       ├── tournaments.ts         # 대회 CRUD, 인증, 통계
│       ├── participants.ts        # 참가자 관리, 일괄등록
│       ├── events.ts              # 종목, 팀 편성, 조 배정, 합병
│       ├── matches.ts             # 경기, 점수, 순위, 코트, 서명
│       └── brackets.ts            # 대진표 생성 (조별리그/KDK/풀리그/토너먼트)
├── public/static/
│   ├── app.js                     # 메인 프론트엔드 (SPA 전체 UI)
│   ├── court.js                   # 코트 전용 점수판 프론트엔드
│   ├── style.css                  # 커스텀 스타일
│   └── test_participants_100.txt  # 테스트용 참가자 붙여넣기 데이터
├── migrations/
│   ├── 0001_initial_schema.sql    # 기본 테이블 (대회/종목/참가자/팀/경기/순위/감사로그)
│   ├── 0002_add_signatures.sql    # 경기 서명 필드 추가
│   ├── 0003_add_mixed_doubles.sql # 혼합복식 참가 여부 필드 추가
│   └── 0004_add_club_and_groups.sql # 클럽(소속) 및 조(그룹) 시스템 추가
├── seed.sql                       # 테스트 데이터 (177명 실제 회원)
├── ecosystem.config.cjs           # PM2 설정
├── wrangler.jsonc                 # Cloudflare Workers 설정
├── vite.config.ts                 # Vite 빌드 설정
├── tsconfig.json                  # TypeScript 설정
├── package.json                   # 의존성 및 스크립트
└── README.md                      # 이 파일
```

---

## 데이터 모델 (D1 SQLite)

### tournaments (대회)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 대회 ID |
| name | TEXT | 대회명 |
| description | TEXT | 설명 |
| status | TEXT | draft / open / in_progress / completed / cancelled |
| format | TEXT | kdk / league / tournament |
| games_per_player | INTEGER | 팀당 기본 경기수 (기본 4) |
| courts | INTEGER | 코트 수 (기본 2) |
| merge_threshold | INTEGER | 합병 기준 팀 수 (기본 4) |
| admin_password | TEXT | 관리자 비밀번호 |

### events (종목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 종목 ID |
| tournament_id | INTEGER FK | 대회 |
| category | TEXT | md(남복) / wd(여복) / xd(혼복) |
| age_group | TEXT | 연령대 (기본 open) |
| level_group | TEXT | 급수 (s/a/b/c/d/e/all/merged) |
| name | TEXT | 표시 이름 |
| status | TEXT | pending / in_progress / completed |
| merged_from | TEXT | 합병 원본 종목 ID (JSON) |

### participants (참가자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 참가자 ID |
| tournament_id | INTEGER FK | 대회 |
| name | TEXT | 이름 |
| phone | TEXT | 전화번호 |
| gender | TEXT | m(남) / f(여) |
| birth_year | INTEGER | 출생년도 |
| level | TEXT | s / a / b / c / d / e |
| paid | INTEGER | 참가비 납부 (0/1) |
| checked_in | INTEGER | 체크인 (0/1) |
| mixed_doubles | INTEGER | 혼복 참가 희망 (0/1) |
| club | TEXT | 소속 클럽(동호회) |

### teams (팀)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 팀 ID |
| event_id | INTEGER FK | 종목 |
| tournament_id | INTEGER FK | 대회 |
| player1_id | INTEGER FK | 선수1 |
| player2_id | INTEGER FK | 선수2 |
| team_name | TEXT | 표시 이름 ("선수1 · 선수2") |
| group_num | INTEGER | 조 번호 (NULL=미배정) |

### matches (경기)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 경기 ID |
| tournament_id | INTEGER FK | 대회 |
| event_id | INTEGER FK | 종목 |
| round | INTEGER | 라운드 |
| match_order | INTEGER | 경기 순서 |
| court_number | INTEGER | 코트 번호 |
| team1_id / team2_id | INTEGER FK | 대전 팀 |
| team1_set1~3 / team2_set1~3 | INTEGER | 세트별 점수 |
| status | TEXT | pending / playing / completed / cancelled |
| winner_team | INTEGER | 승리팀 (1 또는 2) |
| group_num | INTEGER | 조 번호 |
| winner_signature / loser_signature | TEXT | 서명 데이터 |

### standings (순위)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| team_id | INTEGER FK | 팀 |
| event_id | INTEGER FK | 종목 |
| wins / losses | INTEGER | 승/패 수 |
| points | INTEGER | 승점 |
| score_for / score_against | INTEGER | 득점/실점 |
| goal_difference | INTEGER | 득실차 |
| rank | INTEGER | 순위 |

---

## API 엔드포인트

### 대회 관리
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/tournaments` | 대회 목록 |
| GET | `/api/tournaments/:id` | 대회 상세 |
| POST | `/api/tournaments` | 대회 생성 |
| PUT | `/api/tournaments/:id` | 대회 수정 |
| PATCH | `/api/tournaments/:id/status` | 상태 변경 |
| DELETE | `/api/tournaments/:id` | 대회 삭제 |
| POST | `/api/tournaments/:id/auth` | 관리자 인증 |
| GET | `/api/tournaments/:id/stats` | 대회 통계 |

### 참가자 관리
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/tournaments/:tid/participants` | 참가자 목록 |
| POST | `/api/tournaments/:tid/participants` | 참가자 등록 |
| POST | `/api/tournaments/:tid/participants/bulk` | 일괄 등록 |
| PUT | `/api/tournaments/:tid/participants/:pid` | 참가자 수정 |
| DELETE | `/api/tournaments/:tid/participants/:pid` | 참가자 삭제 |
| PATCH | `/api/tournaments/:tid/participants/:pid/paid` | 납부 토글 |
| PATCH | `/api/tournaments/:tid/participants/:pid/checkin` | 체크인 토글 |
| PATCH | `/api/tournaments/:tid/participants/:pid/mixed-doubles` | 혼복 토글 |

### 종목 및 팀 관리
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/tournaments/:tid/events` | 종목 목록 |
| POST | `/api/tournaments/:tid/events` | 종목 생성 |
| DELETE | `/api/tournaments/:tid/events/:eid` | 종목 삭제 |
| POST | `/api/tournaments/:tid/events/:eid/teams` | 팀 수동 등록 |
| GET | `/api/tournaments/:tid/events/:eid/teams` | 팀 목록 (클럽/조 정보 포함) |
| DELETE | `/api/tournaments/:tid/events/:eid/teams/:teamId` | 팀 삭제 |

### 조편성 옵션
| Method | Path | 파라미터 | 설명 |
|--------|------|----------|------|
| POST | `/:tid/events/:eid/auto-assign` | `team_mode` | 단일 종목 팀 편성 |
| POST | `/:tid/events/auto-assign-all` | `team_mode` | 전체 종목 팀 편성 |
| POST | `/:tid/events/:eid/assign-groups` | `group_size`, `avoid_same_club` | 단일 종목 조 배정 |
| POST | `/:tid/events/assign-groups-all` | `group_size`, `avoid_same_club` | 전체 종목 조 배정 |
| POST | `/:tid/events/preview-assignment` | `team_mode`, `group_size`, `avoid_same_club` | 시뮬레이션 프리뷰 |
| POST | `/:tid/events/check-merge` | - | 급수 합병 체크 |
| POST | `/:tid/events/execute-merge` | `event_ids[]` | 급수 합병 실행 |

**team_mode 옵션**: `club_priority` (같은 클럽 우선) | `level_match` (급수 매칭) | `random` (랜덤)

### 대진표 생성
| Method | Path | 파라미터 | 설명 |
|--------|------|----------|------|
| POST | `/:tid/brackets/generate` | `format`, `avoid_same_club`, `games_per_team`, `group_size`, `event_id` | 대진표 생성 |

**format 옵션**: `auto` | `group_league` | `kdk` | `league` | `tournament`

### 경기 및 점수
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/tournaments/:tid/matches` | 경기 목록 (`?event_id=` 필터) |
| PUT | `/api/tournaments/:tid/matches/:mid/score` | 점수 입력 |
| PATCH | `/api/tournaments/:tid/matches/:mid/status` | 경기 상태 변경 |
| GET | `/api/tournaments/:tid/standings` | 순위표 (`?event_id=` 필터) |
| GET | `/api/tournaments/:tid/court/:courtNum` | 코트 현재 경기 |
| POST | `/api/tournaments/:tid/court/:courtNum/next` | 코트 다음 경기 |
| GET | `/api/tournaments/:tid/courts/overview` | 전체 코트 현황 |
| PUT | `/api/tournaments/:tid/matches/:mid/signature` | 서명 저장 |
| GET | `/api/tournaments/:tid/matches/:mid/signature` | 서명 조회 |
| GET | `/api/tournaments/:tid/audit-logs` | 감사 로그 |

### 페이지
| 경로 | 설명 |
|------|------|
| `/` | 메인 SPA (대회 관리 전체 UI) |
| `/court` | 코트 전용 점수판 (전체화면, 터치 UI) |
| `/api/health` | 헬스 체크 |

---

## 사용 가이드

### 1. 대회 생성
1. 메인 페이지에서 **"새 대회 만들기"** 클릭
2. 대회명, 설명, 포맷(KDK/리그/토너먼트), 코트 수, 관리자 비밀번호 설정
3. 대회 생성 완료 → 상태: "초안"

### 2. 참가자 등록
1. 대회 상세 → **참가자** 탭
2. 개별 등록 또는 **일괄 등록** (CSV/텍스트 붙여넣기)
   - 형식: `이름, 성별(남/여), 출생년도, 급수(S~E), 전화번호, 혼복(O/X), 소속`
3. 참가비 납부/체크인/혼복참가 토글 관리

### 3. 종목 생성
1. **종목** 탭에서 종목 추가
2. 유형(남복/여복/혼복) + 연령대 + 급수 선택
3. 예: "남자복식 오픈 A급", "여자복식 오픈 전체"

### 4. 조편성 (팀 + 조 배정)
1. **"팀 자동 편성"** 버튼 클릭 → 옵션 모달
   - 편성 방식: 같은 클럽 우선 / 급수 매칭 / 랜덤
2. **"조 배정"** 버튼 클릭 → 옵션 모달
   - 조당 팀 수 (3~8), 같은 클럽 회피 여부
3. **"미리보기"** 로 시뮬레이션 확인 후 최종 적용

### 5. 대진표 생성
1. **경기** 탭에서 **"대진표 생성"** 클릭 → 옵션 모달
2. 포맷 선택: 자동(추천) / 조별리그 / KDK / 풀리그 / 토너먼트
3. 같은 클럽 대전 회피, 팀당 경기수 설정
4. 생성 후 경기 목록 확인

### 6. 경기 진행
1. 경기 목록에서 **"시작"** 클릭 → 상태: playing
2. 점수 입력 (세트별) → 승자 자동 판정
3. 코트 전용 점수판: `/court?tid=1&court=1` 로 접속
4. 경기 완료 시 자동 순위 업데이트

### 7. 결과 확인
1. **순위표** 에서 종목별 최종 순위 확인
2. **PDF 출력** 으로 결과표 저장/인쇄

---

## 개발 명령어

```bash
# 의존성 설치
npm install

# DB 마이그레이션 (로컬)
npx wrangler d1 migrations apply badminton-production --local

# 테스트 데이터 시드
npx wrangler d1 execute badminton-production --local --file=./seed.sql

# DB 완전 리셋
rm -rf .wrangler/state/v3/d1 && npm run db:migrate:local && npm run db:seed

# 빌드
npm run build

# 로컬 개발 서버
pm2 start ecosystem.config.cjs    # 또는 npm run dev:sandbox

# 서비스 확인
curl http://localhost:3000/api/health
pm2 logs --nostream

# 프로덕션 배포
npm run deploy
```

---

## 미구현 / 향후 개발 계획
- 📋 결선 토너먼트 (조별리그 상위팀 → 결선 자동 진행)
- 📊 대회 통계 대시보드 (실시간 진행률, 코트 가동률)
- 📱 참가자 전용 페이지 (본인 경기 일정/결과 조회)
- 🔔 경기 호출 알림 (웹 푸시 또는 카카오톡 연동)
- 📋 복수 대회 동시 운영
- 🗄️ 시즌 데이터 누적 관리 (선수별 전적/랭킹)
- 🔐 역할 기반 권한 (대회장/진행요원/참가자)

---

## 배포 정보
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ 로컬 개발 서버 동작중
- **마지막 업데이트**: 2026-02-16
