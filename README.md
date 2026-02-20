# 🏸🎾 MATCH POINT — 배드민턴·테니스 대회 운영 시스템

## 프로젝트 개요
- **이름**: MATCH POINT (Sport Tournament Management System)
- **목적**: 소규모~중규모 배드민턴·테니스 동호회/클럽 대회 운영 자동화
- **지원 종목**: 🏸 배드민턴 / 🎾 테니스 (종목별 완전 분리 UI)
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
| Font | Pretendard Variable | 시니어 최적화 한국어 UI |
| Config | 종목별 SportConfig | 배드민턴/테니스 동적 전환 |

---

## 주요 기능 (전체 구현 완료)

### ✅ 1. 대회 관리
- 대회 생성/수정/삭제 (Soft Delete)
- **종목 선택**: 배드민턴 / 테니스 (생성 시 선택, 전체 UI 자동 전환)
- 상태 관리: 초안(draft) → 접수중(open) → 진행중(in_progress) → 완료(completed)
- 관리자 비밀번호 인증
- 코트 수, 팀당 경기수, 합병 기준 설정

### ✅ 2. 참가자 관리
- 개별 등록 및 수정 (이름, 전화, 성별, 출생년도, 급수, 소속클럽)
- **일괄 등록** (텍스트 붙여넣기 / CSV 업로드)
- 참가비 납부 토글
- 체크인 토글
- 혼합복식 참가 희망 토글
- 소속 클럽(동호회) 관리

### ✅ 3. 종목 관리
- **배드민턴**: 남자복식(md), 여자복식(wd), 혼합복식(xd)
- **테니스**: 남자단식(ms), 여자단식(ws), 남자복식(md), 여자복식(wd), 혼합복식(xd)
- 연령대: 오픈, 장년부 등
- 급수별 세분화: S/A/B/C/D/E급, 전체
- 급수 합병 (팀 수 부족 시 자동 제안 및 실행)

### ✅ 4. 조편성 옵션 시스템
- **팀 편성 방식 3가지 선택 가능**:
  - 🏢 **같은 클럽 우선**: 같은 동호회 멤버끼리 팀을 먼저 구성
  - 📊 **급수 매칭**: 비슷한 실력끼리 팀 구성 (클럽 무시)
  - 🎲 **완전 랜덤**: 무작위 팀 편성
- **조 배정 옵션**:
  - 조당 팀 수 설정 (3~8팀, 기본 5팀)
  - 같은 클럽 다른 조 배정 (동호회 분산)
- **시뮬레이션 프리뷰**: 실제 적용 전 예상 팀 수, 조 수, 경기 수 미리 확인
- 단일 종목 / 전체 종목 일괄 편성 지원

### ✅ 5. 대진표 옵션 시스템
- **대진 포맷 5가지 선택 가능**:
  - 🤖 **자동 (추천)**: 조가 있으면 조별리그, 5팀 이하 풀리그, 그 외 KDK
  - 🏆 **조별 리그**: 같은 조끼리 풀리그 (4~5팀 권장)
  - 🎯 **KDK**: 팀당 N회 랜덤 매칭 (대규모 대회 적합)
  - 📋 **풀리그**: 모든 팀 1:1 라운드 로빈
  - 🥊 **싱글 엘리미네이션**: 토너먼트 방식
- **같은 클럽 회피 매칭**: 가능한 한 같은 소속 팀끼리 대결을 피함
- **코트 분배 자동화**: 코트 수 기반 라운드별 자동 배분

### ✅ 6. 결선 토너먼트
- **조별 리그 상위팀 → 결선 싱글 엘리미네이션** 자동 생성
- 조별 순위 미리보기 (승점, 득실차 기반)
- **상위 N팀 선택** (1/2/3팀 진출)
- 같은 클럽 회피 시드 배정
- 결선은 **21점 선취제** (조별 리그는 25점)
- 경기 탭에서 결선/예선 경기 분리 표시 (결선은 빨간 카드 + 왕관 아이콘)

**결선 생성 흐름:**
1. 조별 리그 경기 진행 → 완료율 확인
2. "결선 토너먼트 생성" 버튼 클릭 (완료율 표시)
3. 미리보기 모달에서 조별 순위 & 진출 팀 하이라이트 확인
4. 상위 N팀 + 같은클럽 회피 옵션 선택 → 결선 브래킷 자동 생성
5. 부전승 처리 (2의 거듭제곱에 맞춤 패딩)

### ✅ 7. 경기 운영
- **배드민턴**: 1세트 단판제 (예선 25점 / 본선 21점 선취), 중간 교체
- **테니스**: 다양한 스코어링 타입 지원
  - 🎾 **8게임 프로세트** (동호회 기본) — 8게임 선취
  - 🎾 **10게임 프로세트** — 10게임 선취
  - 🎾 **2세트 선취 (6게임)** — 정식 룰 축소판
  - 🎾 **3세트 매치 (정식)** — 완전 정식 룰
  - 🎾 **듀스 규칙**: 타이브레이크 / 노어드 / 어드밴티지
- **테니스 점수 시스템**: 포인트(0/15/30/40) → 게임 → 세트 → 매치 자동 진행
- 승자 자동/수동 판정
- 코트별 경기 배정 및 진행
- 경기 상태 관리: 대기(pending) → 진행(playing) → 완료(completed)
- 경기 결과 서명 확인 (승/패팀 서명 캔버스)
- **순위 자동 재계산**: 경기 완료 시 해당 종목 순위 자동 업데이트 (승점→득실차→득점 순)
- **점수 수정 UI 개선** *(v3.2)*: 완료된 경기 수정 시 경고 배너, 3세트 입력 UI 포함
- **경기 리셋** *(v3.2)*: 완료된 경기를 대기(pending)로 되돌리기 (점수 초기화, 이중 확인)
- **코트 재배정** *(v3.2)*: 진행중/대기 경기의 코트 번호 변경 (점수 모달 내 셀렉트 + 전용 API)

### ✅ 8. 코트 전용 점수판 (`/court`)
- 전체화면 좌/우 터치 점수판 (태블릿/모니터용)
- **종목별 점수판 자동 전환**: 배드민턴(점수제) / 테니스(게임→세트 시스템)
- 사이드 선택 → 점수 입력 → 교체 감지 → 종료 → 서명 흐름
- URL 파라미터: `tid`, `court`, `locked`, `mode=view`, `autonext`
- QR 코드 생성 (코트별 URL)
- 읽기전용 모드 (관람 모니터용, 3초 자동 새로고침)
- 잠금 모드 (코트 전용 태블릿 – 다른 코트로 이동 불가)
- 자동 다음 경기 로드
- 점수 되돌리기 (Undo)
- 경기 종료 후 서명 캡처 (승/패팀 각각)
- **🔄 디바운스 자동저장** *(v4.0)*: 점수 변경 즉시 서버 동기화 (500ms 디바운스) → 전광판 실시간 반영

**코트 점수판 상태 흐름:**
```
코트 선택 → 사이드 선택 → 점수 입력 ↔ 교체 안내 → 경기 종료
  → 승자 확인 → 서명 캡처 (승팀→패팀) → 저장 → 대기 화면 → 다음 경기 자동 로드

🎾 테니스 점수판 흐름:
  포인트(0→15→30→40) → 게임 획득 → 체인지오버 → 세트 승리 → 매치 종료
  타이브레이크: 6-6 (또는 7-7 프로세트) 시 자동 진입
```

### ✅ 9. 통계 대시보드 (`/dashboard`)
- **대회 진행률** (전체/진행중/대기/완료 경기 수, % 게이지바)
- **참가자 현황** (성별 분포, 참가비 납부율, 체크인율, 혼복 신청수)
- **급수 분포** 바 차트 (S/A/B/C/D/E별 인원)
- **종목별 경기 현황** 테이블 (팀수, 경기수, 진행률 포함)
- **코트별 실시간 상태** (진행중/대기/완료 카운트)
- **클럽별 성적** (승률 순위, 승수, 패수, 승률%)
- 30초 자동 새로고침
- SPA 내장 + 독립 URL 모두 지원

### ✅ 9-1. 대형 전광판 대시보드 (`/court?tid=N&mode=view`) — v4.0 신규
- **전 코트 통합 실시간 전광판** (TV/프로젝터/대형 모니터용)
- **종목별 완전 분리 UI**:
  - 🏸 **배드민턴 전광판** (블루 테마): 랠리 점수 대형 표시, 점수/목표점수 진행률
  - 🎾 **테니스 전광판** (에메랄드 테마): 현재 게임 수 + 세트 스코어 패널, 포맷명 표시
- **코트별 카드 상태**: 경기중(점수 표시) / 경기 종료(승자 + 점수, 8초 결과 표시) / 다음 경기(선수 호출) / 빈 코트
- **실시간 뱃지**: MATCH POINT(빨강) / SET POINT(오렌지, 테니스만) / 접전(노랑)
- **통계 바**: 경기중/대기/완료 실시간 카운트
- 3초 자동 갱신, 전체화면 최적화
- 코트 수에 따라 그리드 레이아웃 자동 조정 (2~8코트)

**대시보드 API 응답 구조:**
```json
{
  "tournament": { "id, name, format, courts, status" },
  "match_stats": { "total, completed, playing, pending" },
  "event_stats": [{ "id, name, category, total_matches, completed_matches, team_count" }],
  "court_stats": [{ "court_number, completed, playing, pending" }],
  "club_stats": [{ "club, player_count, team_count, wins, losses, win_rate" }],
  "participant_stats": { "total, male, female, paid, checked_in, mixed_doubles" },
  "level_distribution": [{ "level, count" }],
  "progress": 0-100
}
```

### ✅ 10. 참가자 페이지 (`/my`)
- **이름/연락처로 본인 경기 검색** (이름만으로 검색 가능)
- **동명이인 처리** *(v3.2)*: 같은 이름 참가자 감지 시 클럽·급수·출생년도 정보로 선택 UI 제공, `my-matches-by-id` API 추가
- 프로필 정보 (이름, 성별, 급수, 소속, 참가비, 체크인 상태)
- **전적 요약** (승/패/득실차)
- 소속 팀 목록 (종목명, 파트너, 조 번호)
- **예정/진행중 경기** (코트 번호, 상대 팀, 상태 배지)
- **완료된 경기 결과** (승/패 색상 표시, 세트 점수)
- SPA 내장 + 독립 URL 모두 지원

**참가자 조회 API 응답 구조:**
```json
{
  "participant": { "id, name, gender, level, club, paid, checked_in" },
  "teams": [{ "team_id, event_name, partner_name, group_num" }],
  "matches": [{ "match_id, event_name, status, court, team1/team2, scores, winner" }],
  "record": { "wins, losses, total_score, total_lost" },
  "upcoming": [{ "경기 시작 예정인 경기 목록" }]
}
```

### ✅ 11. 순위 및 결과
- 자동 순위 계산 (승점 → 득실차 → 득점)
- 조별/종목별 순위표
- 시상대 UI (🥇🥈🥉)
- 결과 PDF 출력 (html2canvas + jsPDF)
- 감사 로그 (점수 수정 이력 추적, 최근 100건)

### ✅ 12. 기타
- 오프라인 감지 및 경고
- 반응형 모바일 UI
- 코트 수 기반 라운드 자동 배분
- 홈페이지에서 코트점수판/통계/내경기 바로가기 링크
- 대회 상세 헤더에 통계/내경기 버튼

### ✅ 14. 데이터 백업/복원 — v3.2 신규
- **JSON 내보내기** (`GET /api/tournaments/:id/export`): 대회 전체 데이터(참가자/종목/팀/경기/순위) 일괄 다운로드
- **JSON 가져오기** (`POST /api/tournaments/:id/import`): 백업 파일 업로드로 데이터 복원 (ID 매핑 자동 처리)
- 관리자 패널에 **다운로드/업로드 버튼** 추가
- 파일 미리보기 모달 (참가자 수, 종목 수, 경기 수 표시)

### ✅ 15. 관리자 세션 유지 — v3.2 신규
- 인증 상태를 **localStorage**에 저장하여 페이지 새로고침 후에도 관리자 모드 유지
- 대회별 개별 세션 관리
- 세션 자동 복원 (DOMContentLoaded 시 localStorage 확인)

### ✅ 16. 참가자 검색/필터 — v3.2 신규
- **텍스트 검색**: 이름·소속으로 실시간 필터링
- **드롭다운 필터**: 성별·급수·클럽별 필터 조합
- 필터 결과 카운트 표시
- 기존 참가자 통계와 통합 UI

### ✅ 17. CDN 로컬 번들링 — v3.2 신규
- Tailwind CSS, Font Awesome, 웹폰트를 `public/static/vendor/`에 로컬 저장
- **로컬 우선 로드 → CDN 폴백** 방식으로 사설 IP/오프라인 환경 완벽 지원
- vendor/ 디렉터리: `tailwind.js` (413KB), `fontawesome.min.css` (102KB), 웹폰트 3종

### ✅ 13. 인쇄 센터 (`/print`) — v3.1 신규
- 수기 운영 대비 6종 A4 인쇄물 (참가자명단/팀편성표/대진표/점수기록지/순위표/결선브래킷)
- 경기 미생성 시 빈 양식 자동 제공
- 결선 대진표: 시각적 토너먼트 브래킷, 크로스 시드, BYE 자동 배치
- 통합 API(/print-data) 도입으로 빠른 로딩
- 메뉴 토글 UX (로딩 중 비활성화, 토글 시 스크롤 이동, 비활성 취소선)

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
│   ├── index.tsx                  # 메인 Hono 앱 & HTML 페이지 (SPA + 코트 + 대시보드 + 참가자)
│   ├── config/                    # 종목별 설정 (v3.5 신규)
│   │   ├── index.ts               # 설정 통합 export
│   │   ├── types.ts               # SportConfig 타입 정의
│   │   ├── badminton.ts           # 배드민턴 설정 (블루 테마, 점수제)
│   │   └── tennis.ts              # 테니스 설정 (에메랄드 테마, 게임/세트제)
│   └── routes/
│       ├── tournaments.ts         # 대회 CRUD, 인증, 통계
│       ├── participants.ts        # 참가자 관리, 일괄등록
│       ├── events.ts              # 종목, 팀 편성, 조 배정, 합병
│       ├── matches.ts             # 경기, 점수, 순위, 코트, 서명, 대시보드, 참가자 조회
│       ├── brackets.ts            # 대진표 생성 (조별리그/KDK/풀리그/토너먼트/결선)
│       └── sponsors.ts            # 스폰서 배너 CRUD (v4.1)
├── public/static/
│   ├── app.js                     # 메인 프론트엔드 SPA (전체 UI + 대시보드 + 참가자 + 결선)
│   ├── court.js                   # 코트 전용 점수판 프론트엔드
│   ├── style.css                  # Pretendard 폰트 + 파티클 애니메이션 + 타임라인 바 + 글래스모피즘
│   ├── manual.html                # A4 인쇄용 현장 운영 매뉴얼
│   ├── test_participants_100.txt  # 테스트용 참가자 붙여넣기 데이터
│   └── vendor/                    # CDN 로컬 번들 (v3.2)
│       ├── tailwind.js            # Tailwind CSS v3.4.1
│       ├── fontawesome.min.css    # Font Awesome 6.4.0
│       └── webfonts/              # FA 웹폰트 (woff2)
├── migrations/
│   ├── 0001_initial_schema.sql    # 기본 테이블 (대회/종목/참가자/팀/경기/순위/감사로그)
│   ├── 0002_add_signatures.sql    # 경기 서명 필드 추가 (winner_signature, loser_signature, signature_at)
│   ├── 0003_add_mixed_doubles.sql # 참가자 혼합복식 참가 여부 필드 추가
│   ├── 0004_add_club_and_groups.sql # 클럽(소속) 및 조(그룹) 시스템 추가
│   └── 0005_add_push_notifications.sql # 푸시 알림 구독 테이블 추가
├── seed.sql                       # 테스트 데이터 (177명 실제 회원, 18개 클럽)
├── ecosystem.config.cjs           # PM2 설정
├── wrangler.jsonc                 # Cloudflare Workers 설정
├── vite.config.ts                 # Vite 빌드 설정
├── tsconfig.json                  # TypeScript 설정
├── package.json                   # 의존성 및 스크립트
└── README.md                      # 이 파일
```

---

## 페이지 및 URL

| 경로 | 설명 | 대상 사용자 | 주요 파라미터 |
|------|------|-------------|-------------|
| `/` | 메인 SPA (대회 관리 전체 UI) | 관리자/운영자 | - |
| `/court` | 코트 전용 점수판 (전체화면, 터치 UI) | 코트 태블릿 | `tid`, `court`, `locked`, `mode`, `autonext` |
| `/court?tid=1&court=1&locked=1` | 1코트 잠금 모드 점수판 | 코트 전용 태블릿 | - |
| `/court?tid=1&court=1&mode=view` | 1코트 관람 전용 모드 (3초 자동갱신) | 관중 모니터 | - |
| `/court?tid=1&mode=view&locked=1` | **대형 전광판** (전 코트 통합 대시보드) | TV/프로젝터 | - |
| `/court?tid=1&court=1&autonext=false` | 자동 다음경기 비활성화 | 수동 운영 | - |
| `/dashboard` | 통계 대시보드 (대회 선택 화면) | 운영자/관리자 | `tid` |
| `/dashboard?tid=1` | 대회별 통계 대시보드 (30초 자동갱신) | 전광판/모니터 | - |
| `/my` | 참가자 경기 조회 (대회 선택 화면) | 참가자 모바일 | `tid` |
| `/my?tid=1` | 대회별 참가자 경기 조회 | 참가자 QR 접근 | - |
| `/print` | 인쇄 센터 (수기 운영 대비 6종 A4 인쇄물) | 운영진 | `tid` |
| `/static/manual.html` | A4 인쇄용 현장 운영 매뉴얼 | 운영자 | - |
| `/api/health` | 헬스 체크 | 모니터링 | - |

---

## API 엔드포인트 (전체)

> 모든 API의 기본 경로: `/api/tournaments`  
> 코트/경기/대진표 관련 API의 기본 경로: `/api/tournaments`

### 대회 관리 (`tournaments.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| GET | `/api/tournaments` | 대회 목록 조회 | - |
| GET | `/api/tournaments/:id` | 대회 상세 조회 | - |
| POST | `/api/tournaments` | 대회 생성 | `name, description, format, games_per_player, courts, merge_threshold, admin_password` |
| PUT | `/api/tournaments/:id` | 대회 수정 | 동일 |
| PATCH | `/api/tournaments/:id/status` | 상태 변경 | `status` (draft/open/in_progress/completed/cancelled) |
| DELETE | `/api/tournaments/:id` | 대회 삭제 (Soft Delete) | - |
| POST | `/api/tournaments/:id/auth` | 관리자 인증 | `password` |
| GET | `/api/tournaments/:id/stats` | 대회 요약 통계 | - |

### 참가자 관리 (`participants.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| GET | `/api/tournaments/:tid/participants` | 참가자 목록 | - |
| POST | `/api/tournaments/:tid/participants` | 참가자 등록 | `name, phone, gender, birth_year, level, club` |
| POST | `/api/tournaments/:tid/participants/bulk` | 일괄 등록 | `data` (텍스트/CSV), `format` |
| PUT | `/api/tournaments/:tid/participants/:pid` | 참가자 수정 | 동일 |
| DELETE | `/api/tournaments/:tid/participants/:pid` | 참가자 삭제 | - |
| PATCH | `/api/tournaments/:tid/participants/:pid/paid` | 납부 토글 | - |
| PATCH | `/api/tournaments/:tid/participants/:pid/checkin` | 체크인 토글 | - |
| PATCH | `/api/tournaments/:tid/participants/:pid/mixed-doubles` | 혼복 토글 | - |

### 종목 및 팀 관리 (`events.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| GET | `/api/tournaments/:tid/events` | 종목 목록 (팀 수 포함) | - |
| POST | `/api/tournaments/:tid/events` | 종목 생성 | `category, age_group, level_group, name` |
| DELETE | `/api/tournaments/:tid/events/:eid` | 종목 삭제 (관련 팀/경기 포함) | - |
| POST | `/api/tournaments/:tid/events/:eid/teams` | 팀 수동 등록 | `player1_id, player2_id, team_name` |
| GET | `/api/tournaments/:tid/events/:eid/teams` | 팀 목록 (선수 정보 포함) | - |
| DELETE | `/api/tournaments/:tid/events/:eid/teams/:teamId` | 팀 삭제 | - |

### 자동 팀 편성 및 조 배정 (`events.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| POST | `/api/tournaments/:tid/events/:eid/auto-assign` | 단일 종목 팀 자동 배정 | `mode` (club/level/random) |
| POST | `/api/tournaments/:tid/events/auto-assign-all` | 전체 종목 팀 일괄 배정 | `mode` (club/level/random) |
| POST | `/api/tournaments/:tid/events/:eid/assign-groups` | 단일 종목 조 배정 | `group_size, avoid_same_club` |
| POST | `/api/tournaments/:tid/events/assign-groups-all` | 전체 종목 조 일괄 배정 | `group_size, avoid_same_club` |
| POST | `/api/tournaments/:tid/events/preview-assignment` | 시뮬레이션 프리뷰 | `mode, group_size` |
| POST | `/api/tournaments/:tid/events/check-merge` | 급수 합병 체크 | - |
| POST | `/api/tournaments/:tid/events/execute-merge` | 급수 합병 실행 | `merges: [{source_levels, target_level, category}]` |

### 대진표 생성 (`brackets.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| POST | `/api/tournaments/:tid/brackets/generate` | 예선 대진표 생성 | `event_id?, format, avoid_same_club, games_per_team, group_size` |
| POST | `/api/tournaments/:tid/brackets/generate-finals` | 결선 토너먼트 생성 | `event_id?, top_n` (기본 2) |
| GET | `/api/tournaments/:tid/brackets/finals-preview` | 결선 진출 미리보기 | `top_n?` |

**대진표 포맷 옵션:**
| format 값 | 설명 | 사용 조건 |
|-----------|------|----------|
| `auto` | 자동 선택 (기본) | 조 있으면 group_league, 5팀 이하 league, 그 외 kdk |
| `group_league` | 조별 리그 | 조가 배정된 팀이 있을 때 |
| `kdk` | 팀당 N회 랜덤 매칭 | 대규모 대회 |
| `league` | 풀리그 (라운드 로빈) | 소규모 (5팀 이하) |
| `tournament` | 싱글 엘리미네이션 | 녹아웃 방식 |

### 경기 및 점수 (`matches.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| GET | `/api/tournaments/:tid/matches` | 경기 목록 | `event_id?` (종목 필터) |
| PUT | `/api/tournaments/:tid/matches/:mid/score` | 점수 입력 | `team1_set1, team2_set1, ..., status, winner_team` |
| PATCH | `/api/tournaments/:tid/matches/:mid/status` | 경기 상태 변경 | `status` (pending/playing/completed) |
| POST | `/api/tournaments/:tid/matches/:mid/reset` | 경기 리셋 (→ pending) | - *(v3.2)* |
| PATCH | `/api/tournaments/:tid/matches/:mid/court` | 코트 재배정 | `court_number` *(v3.2)* |
| GET | `/api/tournaments/:tid/standings` | 순위표 조회 | `recalculate?` (재계산 플래그) |

### 코트 관리 (`matches.ts`)
| Method | Path | 설명 | 응답 내용 |
|--------|------|------|----------|
| GET | `/api/tournaments/:tid/court/:courtNum` | 코트 현재 경기 | 현재 경기, 다음 5경기, 최근 3경기, 대회 정보, target_score |
| POST | `/api/tournaments/:tid/court/:courtNum/next` | 다음 경기 시작 | 다음 대기 경기를 playing 상태로 전환 |
| GET | `/api/tournaments/:tid/courts/overview` | 전체 코트 현황 | 코트별 현재경기/대기수, 전체 경기 통계 |

### 서명 (`matches.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| PUT | `/api/tournaments/:tid/matches/:mid/signature` | 서명 저장 | `winner_signature, loser_signature` (Base64 이미지) |
| GET | `/api/tournaments/:tid/matches/:mid/signature` | 서명 조회 | - |

### 통계 및 참가자 조회 (`matches.ts`)
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| GET | `/api/tournaments/:tid/dashboard` | 통계 대시보드 데이터 | - |
| GET | `/api/tournaments/:tid/my-matches` | 참가자 본인 경기 조회 | `name` (필수), `phone` (선택) |
| GET | `/api/tournaments/:tid/my-matches-by-id/:pid` | 참가자 ID로 경기 조회 *(v3.2)* | - |
| GET | `/api/tournaments/:tid/audit-logs` | 감사 로그 조회 | - (최근 100건) |
| GET | `/api/tournaments/:id/export` | 대회 데이터 JSON 내보내기 *(v3.2)* | - |
| POST | `/api/tournaments/:id/import` | 대회 데이터 JSON 가져오기 *(v3.2)* | `file` (JSON 백업 파일) |

### 스폰서 배너 (`sponsors.ts`) — v4.1 신규
| Method | Path | 설명 | 요청 파라미터 |
|--------|------|------|-------------|
| GET | `/api/tournaments/:tid/sponsors` | 스폰서 목록 조회 | - |
| POST | `/api/tournaments/:tid/sponsors` | 스폰서 등록 | `name, image_url, link_url?, position?, sort_order?` |
| PUT | `/api/tournaments/:tid/sponsors/:sid` | 스폰서 수정 | `name?, image_url?, link_url?, position?, sort_order?, is_active?` |
| DELETE | `/api/tournaments/:tid/sponsors/:sid` | 스폰서 삭제 | - |

---

## 데이터베이스 스키마

### 테이블 구조

#### tournaments (대회)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 대회 ID |
| name | TEXT | 대회명 |
| description | TEXT | 설명 |
| status | TEXT | 상태 (draft/open/in_progress/completed/cancelled) |
| format | TEXT | 포맷 (kdk/league/tournament) |
| games_per_player | INTEGER | 팀당 경기수 (기본 4) |
| courts | INTEGER | 코트 수 (기본 2) |
| merge_threshold | INTEGER | 합병 기준 팀 수 (기본 4) |
| admin_password | TEXT | 관리자 비밀번호 |
| deleted | INTEGER | 소프트 삭제 플래그 |

#### participants (참가자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 참가자 ID |
| tournament_id | INTEGER FK | 대회 ID |
| name | TEXT | 이름 |
| phone | TEXT | 연락처 |
| gender | TEXT | 성별 (m/f) |
| birth_year | INTEGER | 출생년도 |
| level | TEXT | 급수 (s/a/b/c/d/e) |
| club | TEXT | 소속 클럽 *(0004 추가)* |
| paid | INTEGER | 참가비 납부 (0/1) |
| checked_in | INTEGER | 체크인 (0/1) |
| mixed_doubles | INTEGER | 혼복 참가 희망 (0/1) *(0003 추가)* |
| deleted | INTEGER | 소프트 삭제 |

#### events (종목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 종목 ID |
| tournament_id | INTEGER FK | 대회 ID |
| category | TEXT | 유형 (md/wd/xd) |
| age_group | TEXT | 연령대 |
| level_group | TEXT | 급수 그룹 |
| name | TEXT | 종목명 |
| status | TEXT | 상태 |
| merged_from | TEXT | 합병 원본 급수 (JSON) |

#### teams (팀)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 팀 ID |
| event_id | INTEGER FK | 종목 ID |
| tournament_id | INTEGER FK | 대회 ID |
| player1_id | INTEGER FK | 선수1 ID |
| player2_id | INTEGER FK | 선수2 ID |
| team_name | TEXT | 팀명 (자동생성: 선수1/선수2) |
| group_num | INTEGER | 조 번호 *(0004 추가)* |

#### matches (경기)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 경기 ID |
| tournament_id | INTEGER FK | 대회 ID |
| event_id | INTEGER FK | 종목 ID |
| round | INTEGER | 라운드 번호 |
| match_order | INTEGER | 경기 순서 |
| court_number | INTEGER | 코트 번호 |
| team1_id / team2_id | INTEGER FK | 대진 팀 ID |
| team1_set1~3 / team2_set1~3 | INTEGER | 세트별 점수 |
| status | TEXT | 상태 (pending/playing/completed/cancelled) |
| winner_team | INTEGER | 승자 (1 또는 2) |
| group_num | INTEGER | 조 번호 *(0004 추가)* |
| winner_signature | TEXT | 승팀 서명 (Base64) *(0002 추가)* |
| loser_signature | TEXT | 패팀 서명 (Base64) *(0002 추가)* |
| signature_at | DATETIME | 서명 시각 *(0002 추가)* |

#### standings (순위)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 순위 ID |
| tournament_id / event_id / team_id | INTEGER FK | FK들 |
| wins / losses | INTEGER | 승/패 횟수 |
| points | INTEGER | 승점 (승×2 + 패×1) |
| score_for / score_against | INTEGER | 득점/실점 |
| goal_difference | INTEGER | 득실차 |
| rank | INTEGER | 순위 |

#### audit_logs (감사 로그)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 로그 ID |
| tournament_id / match_id | INTEGER FK | 대회/경기 FK |
| action | TEXT | 수행 작업 |
| old_value / new_value | TEXT | 변경 전/후 값 (JSON) |
| updated_by | TEXT | 수행자 |

### 마이그레이션 이력
| 파일 | 설명 |
|------|------|
| 0001_initial_schema.sql | 기본 7개 테이블 + 인덱스 생성 |
| 0002_add_signatures.sql | matches에 서명 필드 추가 |
| 0003_add_mixed_doubles.sql | participants에 혼복 참가 필드 추가 |
| 0004_add_club_and_groups.sql | participants에 club, teams/matches에 group_num 추가 |
| 0005_add_push_notifications.sql | push_subscriptions 테이블 추가 (웹 푸시 알림) |
| 0006_add_sponsors.sql | sponsors 테이블 추가 (스폰서 배너 시스템, v4.1) |

---

## 핵심 비즈니스 로직

### 순위 계산 알고리즘 (`recalculateStandings`)
```
1. 해당 종목의 완료된 경기 결과를 집계
2. 팀별 승수, 패수, 득점, 실점 계산
3. 승점 = 승 × 2 + 패 × 1 (참가 보너스)
4. 득실차 = 득점 - 실점
5. 정렬: 승점(내림차순) → 득실차(내림차순) → 득점(내림차순)
6. standings 테이블 UPSERT
```

### 대진표 생성 알고리즘
- **조별 리그**: 같은 group_num 팀끼리 라운드 로빈
- **KDK**: 팀당 N회 랜덤 매칭 + 같은 클럽 회피 최적화
- **풀리그**: 전체 팀 라운드 로빈
- **싱글 엘리미네이션**: 2의 거듭제곱 패딩 + 부전승
- **결선**: 조별 상위 N팀 선발 → 클럽 시드 분산 → 싱글 엘리미네이션

### 코트 점수판 로직
- **배드민턴 교체 포인트**: 예선 13점, 결선 11점 (목표점수의 절반+1)
- **테니스 체인지오버**: 매 2게임 (홀수 게임 합 시) 자동 감지
- **테니스 타이브레이크**: 6-6(정식) 또는 목표-1(프로) 자동 진입, 7점 이상 + 2점차 승리
- **자동 갱신**: 읽기전용 3초, 일반 10초
- **디바운스 자동저장**: 점수 변경 시 500ms 디바운스로 서버 자동 저장 (전광판 실시간 반영)
- **다음 경기 로드**: 경기 완료 → 서명 → 5초 대기 → 다음 경기 자동 시작

---

## 🏟️ 현장 운영 셋팅 가이드

> **177명, 6코트, 214경기 규모 대회 기준** 실전 운영 매뉴얼

### 📋 필요 장비 목록

| 장비 | 수량 | 용도 | 최소 사양 | 비고 |
|------|------|------|----------|------|
| **코트용 태블릿** | 코트 수 (6대) | 점수 입력 전용 | 10인치 이상, Wi-Fi | iPad / Galaxy Tab 권장 |
| **본부 노트북** | 1~2대 | 대회 운영 관리 | 노트북/PC, 크롬 브라우저 | 메인 관리 화면 |
| **관중 모니터/TV** | 1~2대 | 전체 현황 표시 | HDMI 입력, Wi-Fi 가능 | 대시보드 표시용 |
| **Wi-Fi 공유기** | 1~2대 | 전 장비 인터넷 연결 | 5GHz 지원, 동시 20대+ | 체육관 환경 고려 |
| **QR코드 인쇄물** | 참가자 수만큼 | 참가자 경기 조회 | A4 또는 명찰에 QR | `/my?tid=ID` 링크 |
| **보조배터리/멀티탭** | 여유분 | 태블릿 충전 | 대용량 보조배터리 | 8시간+ 운영 대비 |

### 🌐 네트워크 구성

```
[인터넷 회선] ─── [Wi-Fi 공유기 (5GHz)] ─┬── 코트1 태블릿
                                          ├── 코트2 태블릿
                                          ├── ...
                                          ├── 코트6 태블릿
                                          ├── 본부 노트북 ×2
                                          ├── 관중 모니터 ×2
                                          └── (참가자 스마트폰 접속)
```

**네트워크 팁:**
- 체육관은 Wi-Fi 사각지대가 많으므로 **5GHz 듀얼밴드 공유기** 사용 권장
- 코트 태블릿은 5GHz 대역, 참가자 스마트폰은 2.4GHz 대역으로 분리
- 만약 체육관이 넓다면 공유기를 **2대** 설치 (본부 근처 + 코트 중앙)
- **핫스팟 백업**: 공유기 장애 대비 스마트폰 테더링 준비
- Cloudflare에 배포 완료 시 인터넷만 되면 어디서든 접속 가능

### 🖥️ 장비별 화면 셋팅

#### 1) 코트 태블릿 (코트당 1대) — 점수 입력 전용
```
URL: https://사이트주소/court?tid=1&court=코트번호&locked=1&autonext=true

예시:
  코트1: /court?tid=1&court=1&locked=1
  코트2: /court?tid=1&court=2&locked=1
  코트3: /court?tid=1&court=3&locked=1
  ...
  코트6: /court?tid=1&court=6&locked=1
```

| 설정 | 값 | 이유 |
|------|---|------|
| `locked=1` | ✅ 필수 | 다른 코트로 실수로 이동 방지 |
| `autonext=true` | ✅ 권장 | 경기 완료 후 다음 경기 자동 로드 |
| 화면 방향 | 가로 모드 | 좌/우 점수 입력 UI에 최적 |
| 자동 잠금 | 꺼짐 | 경기 중 화면 꺼짐 방지 |
| 밝기 | 최대 | 체육관 조명 환경에서도 잘 보이게 |
| 브라우저 | 크롬/사파리 전체화면 | 상태바/주소창 숨김 |

**태블릿 브라우저 전체화면 설정:**
- **iPad**: Safari에서 URL 접속 → 공유 → "홈 화면에 추가" → 홈에서 실행하면 전체화면
- **안드로이드**: 크롬에서 메뉴(⋮) → "홈 화면에 추가" → 홈에서 실행

**코트 태블릿 배치 위치:**
```
        [네트]
  ┌──────────────────┐
  │    코트 경기장     │
  │                  │
  │  (선수)    (선수)  │
  │                  │
  └──────────────────┘
      📱 태블릿 ← 심판석 또는 기록석에 배치
                     (코트 바로 옆, 선수가 점수 확인 가능한 위치)
```

#### 2) 본부 노트북 (1~2대) — 대회 운영 관리
```
메인 관리: https://사이트주소/
(대회 상세 페이지에서 모든 관리 작업 수행)
```

| 용도 | 화면 | 담당 |
|------|------|------|
| **운영 본부 (메인)** | 메인 SPA `/` → 대회 상세 | 대회 운영 총괄자 |
| **보조 관리** | 경기탭 + 참가자탭 | 진행 요원 |

**본부에서 수행하는 작업:**
- 경기 시작 버튼 클릭 (코트에 경기 배정)
- 점수 수정 (오입력 정정)
- 결선 토너먼트 생성
- 참가자 추가 등록 / 체크인 처리
- 긴급 상황 대응 (경기 취소, 순서 변경 등)

#### 3) 관중 모니터/TV (1~2대) — 현황 표시
```
통계 대시보드: https://사이트주소/dashboard?tid=1
(30초 자동 갱신 — 별도 조작 불필요)
```

| 모니터 | 표시 화면 | 설치 위치 |
|--------|----------|----------|
| **메인 전광판** | `/dashboard?tid=1` (통계 대시보드) | 본부석 뒤 또는 관중석 정면 |
| **참가자 안내판** | `/my?tid=1` (경기 조회 페이지) | 입구 또는 참가자 대기석 |

**TV/모니터 연결 방법:**
- 노트북/PC + HDMI 케이블로 TV에 미러링
- 또는 Chromecast / Fire Stick 등으로 무선 미러링
- **크롬 전체화면**: `F11` 키로 전체화면 전환

#### 4) 참가자 스마트폰 — 내 경기 조회
```
참가자 경기 조회: https://사이트주소/my?tid=1
```

**QR 코드 배포 방법 (택 1):**
- 📌 **대회 접수처에 QR 포스터 부착** (A3 인쇄)
- 📌 **명찰/배번에 QR 스티커 부착**
- 📌 **카카오톡/단톡방에 URL 공유**
- 📌 코트 점수판에서 **QR 코드 버튼** 클릭 → 코트별 QR 자동 생성

참가자는 QR 스캔 → 이름 입력 → 본인 경기 일정/결과 확인

---

### 👥 운영 인력 배치 (권장)

| 역할 | 인원 | 담당 업무 | 사용 장비 |
|------|------|----------|----------|
| **대회 총괄** | 1명 | 전체 진행, 결선 생성, 긴급 대응 | 본부 노트북 (메인) |
| **기록 보조** | 1명 | 경기 시작 클릭, 점수 수정, 참가자 관리 | 본부 노트북 (보조) |
| **코트 심판/기록** | 코트당 1명 (6명) | 태블릿 점수 입력, 서명 확인 | 코트 태블릿 |
| **접수/안내** | 1~2명 | 체크인, QR 안내, 경기 호출 | 스마트폰/태블릿 |

> **최소 인원**: 총괄 1명 + 코트 기록 6명 = **7명**
> 코트 기록 인력이 부족하면 **선수 자체 기록** 방식도 가능 (autonext 활용)

---

### ⏰ 대회 당일 타임라인 (시간 순서)

#### 🕖 D-1 (전날 준비)
| 시간 | 작업 | 상세 |
|------|------|------|
| 전날 | 대회 생성 & 참가자 등록 | 엑셀 일괄 등록, 참가비 확인 |
| 전날 | 종목 생성 & 조편성 | 팀 편성 + 조 배정 + 미리보기 확인 |
| 전날 | 대진표 생성 | 전체 종목 대진표 생성 & 확인 |
| 전날 | 장비 충전 | 태블릿 완충, 보조배터리 준비 |

#### 🕗 당일 아침 (대회 2시간 전)
| 시간 | 작업 | 상세 |
|------|------|------|
| -2h | Wi-Fi 공유기 설치 & 테스트 | 코트 끝에서 속도 측정 (5Mbps 이상) |
| -2h | 코트 태블릿 셋팅 | 각 코트 URL 접속, 전체화면, 잠금 설정 |
| -1.5h | 관중 모니터 연결 | 대시보드 화면 표시 확인 |
| -1.5h | 본부 노트북 셋팅 | 관리 페이지 로그인, 경기 목록 확인 |
| -1h | QR 코드 포스터 부착 | 접수처, 대기석, 화장실 입구 |
| -1h | 전체 통신 테스트 | 각 태블릿에서 테스트 점수 입력 → 대시보드 반영 확인 |

#### 🕘 대회 진행
| 시간 | 작업 | 상세 |
|------|------|------|
| 시작 | 체크인 처리 | 참가자 도착 시 체크인 토글 |
| 시작 | 1라운드 경기 시작 | 본부에서 6개 코트 경기 일괄 시작 클릭 |
| 진행중 | 코트 점수 입력 | 각 코트 태블릿에서 터치 입력 |
| 진행중 | 경기 완료 → 서명 → 자동 다음 경기 | 코트 자체 순환 (autonext) |
| 진행중 | 본부 모니터링 | 대시보드에서 진행률 확인, 지연 코트 체크 |
| 예선 종료 | 결선 토너먼트 생성 | 경기탭 → "결선 토너먼트 생성" 클릭 |
| 결선 진행 | 결선 경기 운영 | 21점 선취제, 동일 흐름 |
| 종료 | 결과 PDF 출력 | 결과탭 → PDF 다운로드 → 인쇄/배포 |

---

### 🔧 트러블슈팅 (현장 긴급 대응)

| 상황 | 원인 | 해결 방법 |
|------|------|----------|
| 태블릿 화면이 먹통 | 브라우저 캐시/메모리 | 브라우저 새로고침 (당겨서 새로고침) |
| 점수가 반영 안 됨 | Wi-Fi 끊김 | 오프라인 경고 확인 → Wi-Fi 재연결 → 새로고침 |
| 잘못된 점수 입력 | 오입력 | 코트 점수판에서 **Undo(되돌리기)** 또는 본부에서 점수 수정 |
| 경기 순서 변경 필요 | 선수 부재 등 | 본부에서 해당 경기 상태를 pending으로 되돌리고 다른 경기 시작 |
| 태블릿 배터리 방전 | 장시간 사용 | 보조배터리 연결 또는 예비 태블릿 교체 후 같은 URL 접속 |
| 인터넷 끊김 | 공유기 장애 | 스마트폰 핫스팟으로 임시 전환 (모든 장비 재연결) |
| 서명 화면 안 나옴 | 경기 미완료 상태 | 점수 목표점 도달 확인 → 경기 종료 흐름 재진행 |

---

### 💡 효율적 운영 팁

1. **코트 자율 운영 모드**: `locked=1&autonext=true` 설정하면 코트 기록원만 있으면 본부 개입 없이 자동 순환
2. **참가자 자체 기록**: 심판 인력이 부족하면 경기 당사자가 태블릿으로 직접 입력 (서명으로 검증)
3. **경기 호출**: 대시보드의 코트 현황을 보고, 빈 코트가 생기면 방송으로 다음 경기 팀 호출
4. **코트별 QR**: 각 코트 태블릿에서 QR 버튼 → 관중이 스마트폰으로 스캔하면 해당 코트 실시간 점수 관람 (`mode=view`)
5. **중간 점검**: 50% 진행률 시점에서 종목별 진행 상황 확인, 지연 종목 우선 배정
6. **결선 타이밍**: 모든 종목의 예선이 80%+ 완료되면 완료된 종목부터 결선 생성 가능
7. **사진 백업**: 중요 경기는 서명 화면 캡처 (분쟁 대비)

---

### 📐 최소 구성 vs 권장 구성

| 항목 | 최소 구성 (3코트, ~80명) | 권장 구성 (6코트, ~180명) | 대규모 (10코트, 300명+) |
|------|------------------------|------------------------|----------------------|
| 코트 태블릿 | 3대 | 6대 | 10대 |
| 본부 노트북 | 1대 | 2대 | 2~3대 |
| 관중 모니터 | 0~1대 | 1~2대 | 2~3대 |
| Wi-Fi 공유기 | 1대 | 1~2대 | 2~3대 (메시) |
| 운영 인력 | 4명 (총괄1 + 코트3) | 8~9명 | 12~15명 |
| 예상 소요시간 | 3~4시간 | 5~6시간 | 7~8시간 |

---

## 사용 가이드 (소프트웨어)

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
2. 조별 순위 미리보기 확인 (진출 팀 하이라이트)
3. 상위 진출 팀 수(1/2/3) 선택 후 생성
4. 결선 경기 (21점 선취제)로 자동 생성

### 7. 통계 확인
1. 대회 상세 → **"통계"** 버튼 또는 `/dashboard?tid=ID`
2. 진행률, 종목별 현황, 코트 상태, 클럽 성적 확인
3. 30초마다 자동 갱신

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

## 변경 이력

| 버전 | 날짜 | 주요 변경 사항 |
|------|------|---------------|
| v1.0 | 2026-02-17 | 기본 대회 관리, 참가자, 종목, 경기, 순위 |
| v2.0 | 2026-02-17 | 코트 점수판, 대시보드, 참가자 페이지 |
| v2.3 | 2026-02-17 | 웹 푸시 알림 (VAPID), 서비스 워커 |
| v2.7 | 2026-02-17 | 대회 삭제, 연령대 세분화, 종목 일괄 생성 |
| v3.0 | 2026-02-18 | 조편성 옵션, 결선 토너먼트, 클럽 회피 시드 |
| v3.1 | 2026-02-18 | 인쇄 센터 (6종 A4 인쇄물), 운영 매뉴얼 |
| v3.2 | 2026-02-18 | 점수 수정 UI 개선, 경기 리셋, 동명이인 처리, 코트 재배정, 데이터 백업/복원, 관리자 세션 유지, 참가자 검색/필터, CDN 로컬 번들링 |
| v3.5 | 2026-02-19 | 테니스 종목 완전 지원 (프로세트/멀티세트/타이브레이크/노어드), 종목별 동적 SportConfig, 테니스 전용 코트 점수판 (포인트→게임→세트 시스템) |
| v4.0 | 2026-02-20 | 전광판 실시간 점수 반영 (디바운스 자동저장), 테니스/배드민턴 전광판 UI 완전 분리 (테마/세트스코어/뱃지), winner_name API 버그 수정 |
| **v4.1** | **2026-02-20** | **Phase 1 상용화 UX 업그레이드**: 스폰서 배너 시스템 (DB+CRUD API+관리자 모달+자동롤링), Pretendard Variable 폰트, 득점 파티클 애니메이션 (spawnScoreParticles/Confetti/Fireworks), 코트 타임라인 바, Tailwind safelist 동적 클래스 지원, 모바일 터치 영역 개선 (min-height:44px), pointer-events 오버레이 수정, switchTab 클래스 토글 수정 |

---

## 미구현 / 향후 개발 계획

### Phase 2 — Core Tech (예정)
- 🔌 WebSocket / Cloudflare Durable Objects 실시간 엔진 (<0.1s 업데이트)
- 📱 PWA 오프라인 지원 (Service Worker 확장 캐싱 + Background Sync)
- ⏱️ 경기 시간 기록 (시작/종료 타임스탬프)

### Phase 3 — Post-Event Features (예정)
- 📄 원클릭 PDF 대회 요약 리포트 (참가자, 클럽 통계, 연령대별 승률)
- 🗄️ 멀티테넌트 SaaS 아키텍처 (안양/수원/서울 동시 대회)
- 📋 DB 스키마 리뷰 (SaaS 지원)

### 기타 백로그
- 🗄️ 시즌 데이터 누적 관리 (선수별 전적/랭킹)
- 🔐 역할 기반 권한 (대회장/진행요원/참가자)
- 📊 참가자 수정 UI (개별 수정 폼)
- 🔄 경기 일시정지 상태 지원
- 🏓 탁구 등 추가 종목 지원
- 💰 SaaS 모델 (Free/Pro/Enterprise) 전환 — MATCH POINT 사업계획서 참조

---

## 배포 정보
- **플랫폼**: Cloudflare Pages
- **프로덕션 URL**: https://badminton-tournament-5ny.pages.dev
- **상태**: ✅ 프로덕션 배포 완료
- **마지막 업데이트**: 2026-02-20 (v4.1)
- **백업 (v4.1)**: (백업 후 업데이트 예정)
- **백업 (v4.0)**: https://www.genspark.ai/api/files/s/nm2QkMu7 (~269MB, 팟캐스트 미디어 포함)
- **백업 (v3.2)**: https://www.genspark.ai/api/files/s/hG8bLbgu (~3.6MB)
- **사업계획서**: https://fnvqjlie.gensparkspace.com/ (MATCH POINT 투자유치 덱, 23슬라이드)
