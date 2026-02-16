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

#### 6. 결선 토너먼트 🆕
- **조별 리그 상위팀 → 결선 싱글 엘리미네이션** 자동 생성
- 조별 순위 미리보기 (승점, 득실차 기반)
- **상위 N팀 선택** (1/2/3팀 진출)
- 같은 클럽 회피 시드 배정
- 결선은 **21점 선취제** (조별 리그는 25점)
- 경기 탭에서 결선/예선 경기 분리 표시

#### 7. 경기 운영
- 1세트 단판제 (예선 25점 / 본선 21점 선취)
- 중간 교체 (예선 13점 / 본선 11점 도달 시 코트 교체)
- 승자 자동/수동 판정
- 코트별 경기 배정 및 진행
- 경기 상태 관리: 대기(pending) → 진행(playing) → 완료(completed)
- 경기 결과 서명 확인 (승/패팀 서명 캔버스)

#### 8. 코트 전용 점수판 (`/court`)
- 전체화면 좌/우 터치 점수판 (태블릿/모니터용)
- 사이드 선택 → 점수 입력 → 교체 감지 → 종료 → 서명 흐름
- URL 파라미터: `tid`, `court`, `locked`, `mode=view`, `autonext`
- QR 코드 생성 (코트별 URL)
- 읽기전용 모드 (관람 모니터용, 3초 자동 새로고침)
- 자동 다음 경기 로드
- 코트 잠금 모드

#### 9. 통계 대시보드 (`/dashboard`) 🆕
- **대회 진행률** (전체/진행중/대기/완료 경기 수)
- **참가자 현황** (성별, 참가비 납부율, 체크인율)
- **급수 분포** 바 차트
- **종목별 경기 현황** 테이블 (진행률 포함)
- **코트별 실시간 상태** (진행중/대기/완료)
- **클럽별 성적** (승률 순위, 승/패/승률)
- 30초 자동 새로고침
- SPA 내장 + 독립 URL 모두 지원

#### 10. 참가자 페이지 (`/my`) 🆕
- **이름/연락처로 본인 경기 검색**
- 프로필 정보 (이름, 성별, 급수, 소속, 참가비, 체크인)
- **전적 요약** (승/패/득실차)
- 소속 팀 목록 (종목, 조 번호)
- **예정/진행중 경기** (코트 번호 포함)
- **완료된 경기 결과** (승패, 점수)
- SPA 내장 + 독립 URL 모두 지원

#### 11. 순위 및 결과
- 자동 순위 계산 (승점 → 득실차 → 득점)
- 조별/종목별 순위표
- 시상대 UI (🥇🥈🥉)
- 결과 PDF 출력 (html2canvas + jsPDF)
- 감사 로그 (점수 수정 이력 추적)

#### 12. 기타
- 오프라인 감지 및 경고
- 반응형 모바일 UI
- 코트 수 기반 라운드 자동 배분
- 홈페이지에서 코트점수판/통계/내경기 바로가기

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
│   ├── index.tsx                  # 메인 Hono 앱 & HTML 페이지 (SPA + 코트 + 통계 + 참가자)
│   └── routes/
│       ├── tournaments.ts         # 대회 CRUD, 인증, 통계
│       ├── participants.ts        # 참가자 관리, 일괄등록
│       ├── events.ts              # 종목, 팀 편성, 조 배정, 합병
│       ├── matches.ts             # 경기, 점수, 순위, 코트, 서명, 통계 대시보드, 참가자 조회
│       └── brackets.ts            # 대진표 생성 (조별리그/KDK/풀리그/토너먼트/결선)
├── public/static/
│   ├── app.js                     # 메인 프론트엔드 (SPA 전체 UI + 통계 + 참가자 + 결선)
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

## 페이지 및 URL

| 경로 | 설명 | 용도 |
|------|------|------|
| `/` | 메인 SPA (대회 관리 전체 UI) | 관리자/운영자 |
| `/court` | 코트 전용 점수판 (전체화면, 터치 UI) | 코트 태블릿 |
| `/court?tid=1&court=1&locked=1` | 1코트 잠금 모드 점수판 | 코트 전용 태블릿 |
| `/court?tid=1&court=1&mode=view` | 1코트 관람 전용 모드 | 관중 모니터 |
| `/dashboard` | 통계 대시보드 (대회 선택) | 운영자/관리자 |
| `/dashboard?tid=1` | 대회별 통계 대시보드 | 전광판/모니터 |
| `/my` | 참가자 경기 조회 (대회 선택) | 참가자 모바일 |
| `/my?tid=1` | 대회별 참가자 경기 조회 | 참가자 QR 접근 |
| `/api/health` | 헬스 체크 | 모니터링 |

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
| GET | `/api/tournaments/:tid/events/:eid/teams` | 팀 목록 |
| DELETE | `/api/tournaments/:tid/events/:eid/teams/:teamId` | 팀 삭제 |

### 조편성
| Method | Path | 설명 |
|--------|------|------|
| POST | `/:tid/events/auto-assign-all` | 전체 종목 팀 편성 |
| POST | `/:tid/events/assign-groups-all` | 전체 종목 조 배정 |
| POST | `/:tid/events/preview-assignment` | 시뮬레이션 프리뷰 |
| POST | `/:tid/events/check-merge` | 급수 합병 체크 |
| POST | `/:tid/events/execute-merge` | 급수 합병 실행 |

### 대진표 생성
| Method | Path | 설명 |
|--------|------|------|
| POST | `/:tid/brackets/generate` | 대진표 생성 |
| POST | `/:tid/brackets/generate-finals` | 결선 토너먼트 생성 |
| GET | `/:tid/brackets/finals-preview` | 결선 진출 미리보기 |

### 경기 및 점수
| Method | Path | 설명 |
|--------|------|------|
| GET | `/:tid/matches` | 경기 목록 |
| PUT | `/:tid/matches/:mid/score` | 점수 입력 |
| PATCH | `/:tid/matches/:mid/status` | 경기 상태 변경 |
| GET | `/:tid/standings` | 순위표 |
| GET | `/:tid/court/:courtNum` | 코트 현재 경기 |
| POST | `/:tid/court/:courtNum/next` | 코트 다음 경기 시작 |
| GET | `/:tid/courts/overview` | 전체 코트 현황 |
| PUT | `/:tid/matches/:mid/signature` | 서명 저장 |

### 통계 및 참가자 조회 🆕
| Method | Path | 설명 |
|--------|------|------|
| GET | `/:tid/dashboard` | 통계 대시보드 데이터 |
| GET | `/:tid/my-matches?name=&phone=` | 참가자 본인 경기 조회 |

---

## 사용 가이드

### 1. 대회 생성
1. 메인 페이지에서 **"새 대회 만들기"** 클릭
2. 대회명, 설명, 포맷, 코트 수, 관리자 비밀번호 설정

### 2. 참가자 등록
1. 대회 상세 → **참가자** 탭
2. 개별 등록 또는 **일괄 등록** (CSV/텍스트 붙여넣기)

### 3. 종목 생성 및 조편성
1. **종목** 탭에서 종목 추가
2. **"조편성 옵션"** → 팀 편성 방식 + 조 배정 옵션 설정
3. **미리보기** 확인 후 실행

### 4. 대진표 생성
1. **"대진표 옵션"** → 포맷 선택 → 생성
2. 경기 탭에서 경기 목록 확인

### 5. 경기 진행
1. 경기 목록에서 **"시작"** 클릭
2. 코트 점수판(`/court`)에서 실시간 점수 입력
3. 경기 종료 → 서명 → 다음 경기 자동 로드

### 6. 결선 토너먼트 (조별 리그 완료 후)
1. 경기 탭에서 **"결선 토너먼트 생성"** 클릭
2. 조별 순위 미리보기 확인
3. 상위 진출 팀 수(1/2/3) 선택 후 생성
4. 결선 경기 (21점 선취제)로 자동 생성

### 7. 통계 확인
1. 대회 상세 → **"통계"** 버튼 또는 `/dashboard?tid=ID`
2. 진행률, 종목별 현황, 코트 상태, 클럽 성적 확인

### 8. 참가자 경기 조회
1. 대회 상세 → **"내 경기"** 버튼 또는 `/my?tid=ID`
2. 이름 검색 → 소속 팀, 예정 경기, 결과 확인

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
pm2 start ecosystem.config.cjs

# 서비스 확인
curl http://localhost:3000/api/health
pm2 logs --nostream

# 프로덕션 배포
npm run deploy
```

---

## 미구현 / 향후 개발 계획
- 🔔 경기 호출 알림 (웹 푸시 또는 카카오톡 연동)
- 📋 복수 대회 동시 운영
- 🗄️ 시즌 데이터 누적 관리 (선수별 전적/랭킹)
- 🔐 역할 기반 권한 (대회장/진행요원/참가자)
- 📱 PWA 지원 (오프라인 점수 입력)

---

## 배포 정보
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ 로컬 개발 서버 동작중
- **마지막 업데이트**: 2026-02-16
