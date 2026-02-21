// ==========================================
// 코트 전용 스코어보드 - Court Scoreboard
// 좌우 레이아웃 + 터치 스코어 입력 + 자동 체인지오버
// 종목별 동적 테마 지원 (배드민턴/테니스)
// ==========================================
const API = '/api';
const ALL_CONFIGS = window.ALL_SPORT_CONFIGS || {};

// 동적 sport config - 대회 선택 시 갱신됨
let SC = window.SPORT_CONFIG || {};
let P = (SC.theme && SC.theme.primaryClass) || 'blue';
let SCORE_UNIT = (SC.scoring && SC.scoring.scoreUnit) || '점';
let SWAP_LABEL = (SC.scoring && SC.scoring.swapLabel) || '교체';
let SWAP_DESC = (SC.scoring && SC.scoring.swapDescription) || '중간 교체';
let EMOJI = SC.emoji || '🏸';
let BOARD_NAME = (SC.terms && SC.terms.scoreBoard) || '점수판';
let HALF1 = (SC.terms && SC.terms.half1) || '전반';
let HALF2 = (SC.terms && SC.terms.half2) || '후반';

// 대회 종목에 따라 sport config를 동적으로 교체
function applySportConfig(sport) {
  const cfg = ALL_CONFIGS[sport] || ALL_CONFIGS['badminton'] || SC;
  SC = cfg;
  P = (cfg.theme && cfg.theme.primaryClass) || 'blue';
  SCORE_UNIT = (cfg.scoring && cfg.scoring.scoreUnit) || '점';
  SWAP_LABEL = (cfg.scoring && cfg.scoring.swapLabel) || '교체';
  SWAP_DESC = (cfg.scoring && cfg.scoring.swapDescription) || '중간 교체';
  EMOJI = cfg.emoji || '🏸';
  BOARD_NAME = (cfg.terms && cfg.terms.scoreBoard) || '점수판';
  HALF1 = (cfg.terms && cfg.terms.half1) || '전반';
  HALF2 = (cfg.terms && cfg.terms.half2) || '후반';
  // Tailwind 동적 테마 갱신
  if (window.tailwind && cfg.theme) {
    tailwind.config = {
      theme: { extend: { colors: {
        primary: cfg.theme.primary || {},
        court: cfg.theme.secondary || {}
      }}}
    };
  }
  // 문서 타이틀 업데이트
  document.title = EMOJI + ' ' + BOARD_NAME;
}

const courtState = {
  tournamentId: null,
  courtNumber: null,
  currentMatch: null,
  nextMatches: [],
  recentMatches: [],
  tournament: null,
  page: 'select', // select | side-select | court | signature | dashboard
  courts: [],
  stats: null,
  autoRefreshTimer: null,
  score: { left: 0, right: 0 },
  leftTeam: 1,
  rightTeam: 2,
  swapped: false,
  swapDone: false,
  swapPending: false,
  targetScore: 25,
  format: 'kdk',
  // 서명 관련
  finishedMatch: null,
  finishedScore: null,
  finishedWinner: null,
  finishedNames: null,
  // 코트 고정 모드
  locked: false,      // 코트 잠금 (나가기 비활성화)
  readOnly: false,     // 읽기 전용 (관람용)
  autoNext: true,      // 경기 종료 후 자동으로 다음 경기 로딩
  // ====== 테니스 전용 상태 ======
  tennis: {
    point: { left: 0, right: 0 },     // 현재 게임 포인트 (0,1,2,3 = 0,15,30,40)
    games: { left: 0, right: 0 },     // 현재 세트 획득 게임 수
    tiebreak: false,                    // 타이브레이크 모드
    tbPoint: { left: 0, right: 0 },   // 타이브레이크 포인트
    deuceRule: 'tiebreak',             // tiebreak | noad | advantage
    lastSwapGames: 0,                   // 마지막 체인지오버 시 게임 합
    // === 서브권 ===
    serving: 'left',                    // 현재 서브하는 쪽 ('left' | 'right')
    initialServer: 'left',              // 경기 시작 시 첫 서버
    // === 세트 시스템 ===
    setFormat: 'pro8',                  // pro8 | pro10 | set2 | set3
    currentSet: 1,                      // 현재 세트 번호 (1-based)
    sets: [],                           // 완료된 세트 기록 [{left:6, right:4}, ...]
    setsToWin: 1,                       // 승리에 필요한 세트 수 (pro=1, set2=2, set3=2)
    gamesPerSet: 8,                     // 세트 당 목표 게임 수 (pro8=8, pro10=10, set=6)
    finalSetTiebreak: true              // 마지막 세트 타이브레이크 여부
  }
};

// 테니스 여부 판별
function isTennis() {
  return courtState.tournament && courtState.tournament.sport === 'tennis';
}

// 테니스 포인트 표시 (0→'0', 1→'15', 2→'30', 3→'40')
const TENNIS_POINTS = ['0', '15', '30', '40'];
function tennisPointLabel(pt) {
  return pt < 4 ? TENNIS_POINTS[pt] : pt.toString();
}

// 테니스 포인트 상태 문자열
function getTennisPointDisplay(side) {
  const t = courtState.tennis;
  if (t.tiebreak) {
    return t.tbPoint[side].toString();
  }
  const pL = t.point.left;
  const pR = t.point.right;
  // 듀스/어드밴티지 상태
  if (pL >= 3 && pR >= 3) {
    if (t.deuceRule === 'noad') {
      // 노어드: 40-40에서 다음 포인트가 결정
      return side === 'left' ? (pL > pR ? 'AD' : '40') : (pR > pL ? 'AD' : '40');
    }
    if (pL === pR) return '40';                   // 듀스
    if (side === 'left') return pL > pR ? 'AD' : '40';
    return pR > pL ? 'AD' : '40';
  }
  return TENNIS_POINTS[t.point[side]] || '0';
}

// 테니스 현재 상태 라벨
function getTennisStatusLabel() {
  const t = courtState.tennis;
  if (t.tiebreak) return 'TIEBREAK';
  const pL = t.point.left;
  const pR = t.point.right;
  if (pL >= 3 && pR >= 3 && pL === pR) return 'DEUCE';
  if (pL >= 3 && pR >= 3 && Math.abs(pL - pR) === 1) return 'AD';
  return '';
}

// 테니스 서브 교대 처리
function tennisToggleServe() {
  const t = courtState.tennis;
  t.serving = t.serving === 'left' ? 'right' : 'left';
}

// 타이브레이크 서브 교대 (첫 1포인트 후 매 2포인트)
function tennisTiebreakServeCheck() {
  const t = courtState.tennis;
  const totalTB = t.tbPoint.left + t.tbPoint.right;
  // 첫 포인트(1) 후 교대, 이후 매 2포인트(3,5,7,...) 마다 교대
  if (totalTB === 1 || (totalTB > 1 && totalTB % 2 === 1)) {
    tennisToggleServe();
  }
}

// 테니스 포인트 득점 처리
function tennisScorePoint(side) {
  const t = courtState.tennis;
  const otherSide = side === 'left' ? 'right' : 'left';

  // === 타이브레이크 모드 ===
  if (t.tiebreak) {
    t.tbPoint[side]++;
    const myTB = t.tbPoint[side];
    const otherTB = t.tbPoint[otherSide];
    // 타이브레이크 서브 교대
    tennisTiebreakServeCheck();
    // 타이브레이크 승리: 7점 이상 + 2점 차
    if (myTB >= 7 && myTB - otherTB >= 2) {
      t.games[side]++;
      // 타이브레이크 후 서브: 타이브레이크 시작한 반대쪽이 다음 세트 첫 서브
      tennisToggleServe();
      tennisGameWon(side);
      return;
    }
    renderCourt();
    return;
  }

  // === 일반 게임 포인트 ===
  t.point[side]++;
  const myPt = t.point[side];
  const otherPt = t.point[otherSide];

  let gameWon = false;
  // 노어드(No-Ad) 규칙: 40-40에서 바로 결정
  if (t.deuceRule === 'noad' && myPt >= 3 && otherPt >= 3) {
    if (myPt > otherPt) gameWon = true;
  }
  // 어드밴티지/타이브레이크 룰: 40 이상에서 2점 차
  else if (myPt >= 4 && myPt - otherPt >= 2) {
    gameWon = true;
  }
  // 40 이전에 4포인트 도달 (상대 3 미만) = 게임 획득
  else if (myPt >= 4 && otherPt < 3) {
    gameWon = true;
  }

  if (gameWon) {
    t.games[side]++;
    t.point.left = 0;
    t.point.right = 0;
    // 일반 게임 후 서브 교대
    tennisToggleServe();
    tennisGameWon(side);
    return;
  }

  renderCourt();
}

// 세트 승리 조건 판별
function checkSetWin(gL, gR, target) {
  const t = courtState.tennis;
  // 프로세트(pro8, pro10): target 이상 + 2점 차
  if (t.setFormat === 'pro8' || t.setFormat === 'pro10') {
    return (gL >= target && gL - gR >= 2) || (gR >= target && gR - gL >= 2);
  }
  // 정식 세트(set2, set3): 6게임 이상 + 2게임 차, 또는 타이브레이크 승리(7게임)
  if (gL >= 6 && gL - gR >= 2) return true;
  if (gR >= 6 && gR - gL >= 2) return true;
  // 타이브레이크 결과 (7-6)
  if ((gL === 7 && gR === 6) || (gR === 7 && gL === 6)) return true;
  return false;
}

// 타이브레이크 진입 조건 판별
function checkTiebreakEntry(gL, gR, target) {
  const t = courtState.tennis;
  if (t.setFormat === 'pro8' || t.setFormat === 'pro10') {
    return gL === target - 1 && gR === target - 1;
  }
  // 정식 세트: 6-6
  return gL === 6 && gR === 6;
}

// 테니스 게임 획득 후 처리
function tennisGameWon(side) {
  const t = courtState.tennis;
  const target = t.gamesPerSet;
  const gL = t.games.left;
  const gR = t.games.right;
  const winnerName = side === 'left' ? getLeftName() : getRightName();

  // 게임 카운트를 score에 동기화 (현재 세트 저장용)
  courtState.score.left = t.games.left;
  courtState.score.right = t.games.right;

  // 세트 표시 (멀티세트일 때)
  const setLabel = t.setsToWin > 1 ? ' [세트 ' + t.currentSet + ']' : '';
  showCourtToast(winnerName + ' 게임! (' + gL + '-' + gR + ')' + setLabel, 'success');
  // ★ 게임 승리 파티클
  spawnScoreParticles(side, false);

  // 체인지오버 체크: 게임 합이 홀수일 때
  const totalGames = gL + gR;
  if (totalGames % 2 === 1 && totalGames > t.lastSwapGames && !t.tiebreak) {
    t.lastSwapGames = totalGames;
    courtState.swapPending = true;
    autoSaveScore(); // ★ 체인지오버 시에도 서버 저장
    renderCourt();
    setTimeout(function() { showSwapModal(); }, 500);
    return;
  }

  // 세트 승리 체크
  if (checkSetWin(gL, gR, target)) {
    const setWinner = gL > gR ? 'left' : 'right';
    // 현재 세트를 기록
    t.sets.push({ left: gL, right: gR });

    // 매치 승리 체크
    const setsWonLeft = t.sets.filter(function(s) { return s.left > s.right; }).length;
    const setsWonRight = t.sets.filter(function(s) { return s.right > s.left; }).length;

    if (setsWonLeft >= t.setsToWin || setsWonRight >= t.setsToWin) {
      // 매치 종료!
      const matchWinner = setsWonLeft >= t.setsToWin ? 'left' : 'right';
      const matchWinnerName = matchWinner === 'left' ? getLeftName() : getRightName();
      // DB에 저장할 세트별 점수 동기화
      syncTennisScoreToDB();
      autoSaveScore(); // ★ 매치 종료 시 서버 저장
      renderCourt();
      setTimeout(function() {
        var setScores = t.sets.map(function(s) { return s.left + '-' + s.right; }).join(', ');
        showCourtToast('🏆 ' + matchWinnerName + ' 승리! (' + setScores + ')', 'success');
        spawnConfetti();
        spawnFireworks(window.innerWidth/2, window.innerHeight/3);
        setTimeout(function() { showFinishModal(); }, 500);
      }, 300);
      return;
    }

    // 다음 세트 시작
    showCourtToast('🎾 세트 ' + t.currentSet + ' 종료! (' + gL + '-' + gR + ') → 세트 ' + (t.currentSet + 1) + ' 시작', 'info');
    spawnScoreParticles(setWinner, true);
    t.currentSet++;
    t.games = { left: 0, right: 0 };
    t.point = { left: 0, right: 0 };
    t.tiebreak = false;
    t.tbPoint = { left: 0, right: 0 };
    t.lastSwapGames = 0;
    // 세트 간 score 동기화
    courtState.score.left = 0;
    courtState.score.right = 0;
    syncTennisScoreToDB();
    autoSaveScore(); // ★ 다음 세트 시작 시 서버 저장
    renderCourt();
    return;
  }

  // 타이브레이크 진입 체크
  if (checkTiebreakEntry(gL, gR, target) && !t.tiebreak) {
    t.tiebreak = true;
    t.tbPoint = { left: 0, right: 0 };
    showCourtToast('🎯 TIEBREAK! 먼저 7포인트 + 2점 차 승리', 'info');
  }

  // ★ 테니스 게임 승리 시 서버 저장 (전광판 실시간 반영)
  autoSaveScore();

  renderCourt();
}

// 테니스 세트별 점수를 courtState.score에 동기화 (DB 저장용)
function syncTennisScoreToDB() {
  const t = courtState.tennis;
  // 프로세트는 단일 세트이므로 현재 게임 수만 저장
  if (t.setsToWin === 1) {
    courtState.score.left = t.games.left;
    courtState.score.right = t.games.right;
    return;
  }
  // 멀티세트: 승리 세트 수를 score에 저장
  courtState.score.left = t.sets.filter(function(s) { return s.left > s.right; }).length;
  courtState.score.right = t.sets.filter(function(s) { return s.right > s.left; }).length;
}

// 테니스 포인트 취소
function tennisUndoPoint(side) {
  const t = courtState.tennis;
  if (t.tiebreak) {
    if (t.tbPoint[side] > 0) {
      t.tbPoint[side]--;
      renderCourt();
      showCourtToast('타이브레이크 포인트 취소', 'info');
    }
    return;
  }
  if (t.point[side] > 0) {
    t.point[side]--;
    renderCourt();
    showCourtToast('포인트 취소', 'info');
  }
}

// 테니스 게임 취소 (이전 게임 상태로 되돌리기)
function tennisUndoGame(side) {
  const t = courtState.tennis;
  if (t.games[side] > 0) {
    t.games[side]--;
    t.point.left = 0;
    t.point.right = 0;
    // 타이브레이크였다면 해제
    if (t.tiebreak) {
      t.tiebreak = false;
      t.tbPoint = { left: 0, right: 0 };
    }
    // 서브 되돌리기
    tennisToggleServe();
    courtState.score.left = t.games.left;
    courtState.score.right = t.games.right;
    syncTennisScoreToDB();
    autoSaveScore(); // ★ 게임 취소 후 서버 저장
    renderCourt();
    showCourtToast('게임 취소 (' + t.games.left + '-' + t.games.right + ')', 'info');
  }
}

// 테니스 상태 초기화
function resetTennisState() {
  const t = courtState.tennis;
  const tournament = courtState.tournament || {};
  t.point = { left: 0, right: 0 };
  t.games = { left: 0, right: 0 };
  t.tiebreak = false;
  t.tbPoint = { left: 0, right: 0 };
  t.deuceRule = tournament.deuce_rule || 'tiebreak';
  t.lastSwapGames = 0;
  t.serving = 'left';  // 사이드 선택 화면에서 변경 가능
  t.initialServer = 'left';
  t.sets = [];
  t.currentSet = 1;

  // 세트 포맷 결정
  var sf = tournament.scoring_type || 'pro8';
  t.setFormat = sf;
  if (sf === 'pro8') {
    t.setsToWin = 1;
    t.gamesPerSet = tournament.target_games || 8;
  } else if (sf === 'pro10') {
    t.setsToWin = 1;
    t.gamesPerSet = tournament.target_games || 10;
  } else if (sf === 'set2') {
    t.setsToWin = 2;
    t.gamesPerSet = 6;
  } else if (sf === 'set3') {
    t.setsToWin = 2;
    t.gamesPerSet = 6;
  } else {
    t.setsToWin = 1;
    t.gamesPerSet = tournament.target_games || 8;
  }
  t.finalSetTiebreak = true;
  // targetScore는 gamesPerSet로 통일
  courtState.targetScore = t.gamesPerSet;
}

// 중간 교체(체인지오버) 점수 계산
function getSwapScore() {
  const swapInterval = SC.scoring && SC.scoring.swapInterval;
  if (swapInterval && swapInterval > 0) {
    // 테니스: 매 N게임마다 (예: 2게임마다 → 첫 교체는 2 이후)
    return swapInterval;
  }
  // 배드민턴: 중간점 자동 계산 (21→11, 25→13)
  return courtState.targetScore === 21 ? 11 : Math.ceil(courtState.targetScore / 2);
}

// 실제 팀 점수 ↔ left/right 매핑
function getTeam1Score() { return courtState.leftTeam === 1 ? courtState.score.left : courtState.score.right; }
function getTeam2Score() { return courtState.leftTeam === 1 ? courtState.score.right : courtState.score.left; }
function getLeftName() {
  const m = courtState.currentMatch;
  if (!m) return '팀';
  return courtState.leftTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');
}
function getRightName() {
  const m = courtState.currentMatch;
  if (!m) return '팀';
  return courtState.rightTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');
}

// API Helper
async function courtApi(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '요청 실패');
    return data;
  } catch (err) {
    showCourtToast(err.message, 'error');
    throw err;
  }
}

// Toast
function showCourtToast(msg, type = 'info') {
  const t = document.createElement('div');
  const c = { info: `bg-${P}-600`, success: 'bg-green-600', error: 'bg-red-600', warning: 'bg-yellow-500 text-gray-900' };
  t.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl text-white shadow-2xl ${c[type]} text-lg font-bold fade-in`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2500);
}

// URL 파라미터
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  courtState.tournamentId = params.get('tid');
  courtState.courtNumber = params.get('court');
  // 코트 고정 모드 파라미터
  if (params.get('locked') === '1' || params.get('lock') === '1') courtState.locked = true;
  if (params.get('mode') === 'view' || params.get('readonly') === '1') courtState.readOnly = true;
  if (params.get('autonext') === '0') courtState.autoNext = false;
}

// ==========================================
// 메인 렌더
// ==========================================
function renderCourt() {
  const app = document.getElementById('app');
  switch (courtState.page) {
    case 'select': app.innerHTML = renderCourtSelect(); break;
    case 'side-select': app.innerHTML = renderSideSelect(); break;
    case 'court': app.innerHTML = renderCourtScoreboard(); bindScoreboardEvents(); break;
    case 'signature': app.innerHTML = renderSignatureScreen(); initSignaturePads(); break;
    case 'dashboard': renderDashboardView(); break;
    default: app.innerHTML = renderCourtSelect();
  }
}

// ==========================================
// 대회/코트 선택 화면
// ==========================================
function renderCourtSelect() {
  const sportGrad = P === 'emerald' ? 'from-emerald-400 to-emerald-600' : 'from-blue-400 to-blue-600';
  const headerBg = P === 'emerald' ? 'bg-emerald-500' : 'bg-green-500';
  return `<div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 ${headerBg} rounded-xl flex items-center justify-center text-xl">${EMOJI}</div>
        <div><h1 class="text-xl font-bold">코트 ${BOARD_NAME}</h1><p class="text-xs text-gray-400">Court Scoreboard</p></div>
      </div>
      <a href="/" class="text-sm text-gray-400 hover:text-white"><i class="fas fa-home mr-1"></i>메인</a>
    </div>
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-lg">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${sportGrad} mb-4 shadow-lg">
            <span class="text-4xl">${EMOJI}</span>
          </div>
          <h2 class="text-3xl font-extrabold mb-2">코트 ${BOARD_NAME}</h2>
          <p class="text-gray-400">코트에 배치할 태블릿에서 사용하세요</p>
          <div class="mt-3 flex flex-wrap justify-center gap-2">
            <span class="text-xs text-gray-500">고정 URL: /court?tid=대회ID&court=코트번호&locked=1</span>
          </div>
        </div>
        ${courtState.tournamentId ? renderCourtPicker() : renderTournamentPicker()}
      </div>
    </div>
  </div>`;
}

function renderTournamentPicker() {
  return `<div id="tournament-picker">
    <h3 class="text-lg font-semibold mb-4 text-center"><i class="fas fa-trophy mr-2 text-yellow-400"></i>대회를 선택하세요</h3>
    <div id="tournament-list-court" class="space-y-3">
      <div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
    </div>
  </div>`;
}

function renderCourtPicker() {
  return `<div>
    <h3 class="text-lg font-semibold mb-2 text-center text-${P}-400">
      <span class="mr-1">${EMOJI}</span>${courtState.tournament?.name || '대회'}
    </h3>
    <p class="text-center text-gray-400 mb-4">코트를 선택하세요</p>
    <!-- 모드 안내 + QR -->
    <div class="flex justify-center gap-2 mb-4 flex-wrap">
      <button onclick="enterDashboardMode()" class="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-xs hover:bg-blue-500/30">
        <i class="fas fa-tv mr-1"></i>대형 전광판
      </button>
      <button onclick="showQRModal()" class="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-xs hover:bg-purple-500/30">
        <i class="fas fa-qrcode mr-1"></i>QR 코드 생성
      </button>
    </div>
    <div id="court-grid" class="grid grid-cols-2 gap-4">
      <div class="col-span-2 text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
    </div>
    <button onclick="courtState.tournamentId=null;courtState.tournament=null;renderCourt();loadTournamentList()" 
            class="w-full mt-4 py-3 bg-white/5 text-gray-400 rounded-xl text-sm hover:bg-white/10">
      <i class="fas fa-arrow-left mr-2"></i>대회 다시 선택
    </button>
    <a href="/" class="block w-full mt-2 py-3 text-center text-gray-500 rounded-xl text-xs hover:text-gray-300 hover:bg-white/5 transition">
      <i class="fas fa-home mr-1"></i>메인으로
    </a>
  </div>`;
}

// ==========================================
// 사이드 선택 화면 (경기 시작 전)
// ==========================================
function renderSideSelect() {
  const m = courtState.currentMatch;
  if (!m) { courtState.page = 'court'; renderCourt(); return ''; }

  const team1Name = m.team1_name || '팀1';
  const team2Name = m.team2_name || '팀2';
  const target = courtState.targetScore;
  const swapPt = getSwapScore();

  return `<div class="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col select-none" style="touch-action:manipulation;overflow:hidden;">
    <!-- 상단 바 -->
    <div class="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/10 shrink-0">
      <div class="flex items-center gap-2">
        <span class="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">${courtState.courtNumber}코트</span>
        <span class="text-xs text-gray-400">#${m.match_order} ${m.event_name || ''}</span>
      </div>
      ${courtState.locked ? '' : '<button onclick="goBackFromSideSelect()" class="text-gray-500 hover:text-white text-sm"><i class="fas fa-arrow-left mr-1"></i>돌아가기</button>'}
    </div>

    <!-- 메인 -->
    <div class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="text-center mb-6">
        <div class="w-20 h-20 rounded-full bg-${P}-500/20 flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-arrows-alt-h text-4xl text-${P}-400"></i>
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold mb-2">코트 사이드 선택</h2>
        <p class="text-gray-400 text-sm sm:text-base">각 팀이 시작할 코트 위치를 선택하세요</p>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${target === 21 ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}">
            <i class="fas fa-bullseye"></i>${target}${SCORE_UNIT} 선취 · ${courtState.format === 'tournament' ? '본선' : '예선'}
          </span>
          <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300">
            <i class="fas fa-exchange-alt"></i>${swapPt}${SCORE_UNIT} 도달 시 ${SWAP_LABEL}
          </span>
        </div>
      </div>

      <!-- 미리보기: 현재 배치 -->
      <div class="w-full max-w-lg mb-6">
        <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <!-- 코트 시각화 -->
          <div class="flex">
            <!-- 왼쪽 -->
            <div class="flex-1 p-5 sm:p-8 text-center border-r border-white/10 bg-${P}-500/5">
              <p class="text-xs text-gray-500 mb-2 uppercase tracking-wider">왼쪽 코트</p>
              <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-${P}-500/20 border-2 border-${P}-500/40 flex items-center justify-center mx-auto mb-2">
                <i class="fas fa-user-friends text-xl sm:text-2xl text-${P}-400"></i>
              </div>
              <p class="text-lg sm:text-xl font-bold text-${P}-400" id="side-left-name">${courtState.leftTeam === 1 ? team1Name : team2Name}</p>
            </div>
            <!-- 네트 -->
            <div class="flex items-center">
              <div class="w-1 bg-white/20 h-full"></div>
            </div>
            <!-- 오른쪽 -->
            <div class="flex-1 p-5 sm:p-8 text-center bg-orange-500/5">
              <p class="text-xs text-gray-500 mb-2 uppercase tracking-wider">오른쪽 코트</p>
              <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center mx-auto mb-2">
                <i class="fas fa-user-friends text-xl sm:text-2xl text-orange-400"></i>
              </div>
              <p class="text-lg sm:text-xl font-bold text-orange-400" id="side-right-name">${courtState.rightTeam === 1 ? team1Name : team2Name}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 교체 버튼 -->
      <button onclick="toggleSidePreview()" 
        class="mb-4 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-base font-bold border border-white/10 active:scale-95 transition flex items-center gap-3">
        <i class="fas fa-exchange-alt text-yellow-400"></i>
        <span>좌우 바꾸기</span>
      </button>

      ${isTennis() ? `
      <!-- 테니스 서브 선택 -->
      <div class="w-full max-w-lg mb-4">
        <p class="text-center text-sm text-gray-400 mb-2"><i class="fas fa-baseball-ball mr-1 text-yellow-400"></i>첫 서브를 선택하세요</p>
        <div class="grid grid-cols-2 gap-3">
          <button onclick="selectFirstServer('left')" id="serve-btn-left"
            class="py-3 rounded-xl text-center font-bold transition border-2 ${courtState.tennis.serving === 'left' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 ring-2 ring-yellow-500/30' : 'bg-white/5 border-white/10 text-gray-400'}">
            🎾 ${courtState.leftTeam === 1 ? team1Name : team2Name}
          </button>
          <button onclick="selectFirstServer('right')" id="serve-btn-right"
            class="py-3 rounded-xl text-center font-bold transition border-2 ${courtState.tennis.serving === 'right' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 ring-2 ring-yellow-500/30' : 'bg-white/5 border-white/10 text-gray-400'}">
            🎾 ${courtState.rightTeam === 1 ? team1Name : team2Name}
          </button>
        </div>
      </div>
      ` : ''}

      <!-- 확인 / 시작 -->
      <button onclick="confirmSideAndStart()" 
        class="w-full max-w-lg py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl text-xl font-bold shadow-xl hover:shadow-green-500/30 active:scale-95 transition">
        <i class="fas fa-play mr-2"></i>이 배치로 경기 시작
      </button>
    </div>
  </div>`;
}

// 테니스 첫 서버 선택
function selectFirstServer(side) {
  courtState.tennis.serving = side;
  courtState.tennis.initialServer = side;
  renderCourt();
}

// 사이드 선택 화면에서 좌우 바꾸기
function toggleSidePreview() {
  const tmp = courtState.leftTeam;
  courtState.leftTeam = courtState.rightTeam;
  courtState.rightTeam = tmp;
  renderCourt();
}

// 사이드 확인 후 점수판으로
function confirmSideAndStart() {
  courtState.swapped = false;
  courtState.swapDone = false;
  courtState.score = { left: 0, right: 0 };
  actionHistory = [];
  // 테니스 상태 초기화
  if (isTennis()) {
    resetTennisState();
  }
  courtState.page = 'court';
  renderCourt();
  showCourtToast('경기 시작! 화면을 터치하여 ' + (isTennis() ? '포인트' : '점수') + '를 올리세요', 'success');
}

// ==========================================
// 테니스 전용 점수판 - 게임 + 포인트 2단계 표시
// ==========================================
function renderTennisScoreboard(m) {
  const t = courtState.tennis;
  const gL = t.games.left;
  const gR = t.games.right;
  const target = t.gamesPerSet;
  const leftName = getLeftName();
  const rightName = getRightName();

  // 포인트 표시
  const ptL = getTennisPointDisplay('left');
  const ptR = getTennisPointDisplay('right');
  const statusLabel = getTennisStatusLabel();

  // 서브 표시
  const servL = t.serving === 'left';
  const servR = t.serving === 'right';

  // 세트 승리 체크
  const setsWonL = t.sets.filter(function(s) { return s.left > s.right; }).length;
  const setsWonR = t.sets.filter(function(s) { return s.right > s.left; }).length;
  const matchOver = setsWonL >= t.setsToWin || setsWonR >= t.setsToWin;
  const isMultiSet = t.setsToWin > 1;

  // 포맷 라벨
  var formatLabel = target + '게임 프로세트';
  if (t.setFormat === 'set2') formatLabel = '2세트 선취';
  else if (t.setFormat === 'set3') formatLabel = '3세트 선취';

  // 듀스 규칙 라벨
  const deuceLabel = t.deuceRule === 'noad' ? '노어드' : t.deuceRule === 'advantage' ? '어드밴티지' : '타이브레이크';

  // 세트 히스토리 HTML
  var setsHtml = '';
  if (t.sets.length > 0 || isMultiSet) {
    setsHtml = '<div class="flex items-center justify-center gap-1 px-3 py-1 bg-black/40 border-b border-white/5 shrink-0" style="min-height:28px;">';
    // 완료된 세트
    for (var si = 0; si < t.sets.length; si++) {
      var s = t.sets[si];
      var sWin = s.left > s.right ? 'left' : 'right';
      setsHtml += '<span class="px-2 py-0.5 rounded text-xs font-bold ' +
        (sWin === 'left' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-orange-500/30 text-orange-300') +
        '">S' + (si+1) + ' ' + s.left + '-' + s.right + '</span>';
    }
    // 현재 세트 (진행 중)
    if (!matchOver) {
      setsHtml += '<span class="px-2 py-0.5 rounded text-xs font-bold bg-white/20 text-white animate-pulse">' +
        'S' + t.currentSet + ' ' + gL + '-' + gR + '</span>';
    }
    // 세트 승리 수
    if (isMultiSet) {
      setsHtml += '<span class="ml-2 text-xs text-gray-500">세트 ' + setsWonL + '-' + setsWonR + '</span>';
    }
    setsHtml += '</div>';
  }

  return '<div class="h-screen bg-gray-900 text-white flex flex-col select-none" style="touch-action:manipulation;overflow:hidden;">' +
    // 상단 정보 바
    '<div class="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-white/10 shrink-0" style="min-height:40px;">' +
      '<div class="flex items-center gap-2">' +
        '<span class="bg-emerald-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full pulse-live">🎾 ' + courtState.courtNumber + '코트</span>' +
        '<span class="text-xs text-gray-400">#' + m.match_order + '</span>' +
        '<span class="text-xs text-gray-500">' + (m.event_name || '') + '</span>' +
      '</div>' +
      '<div class="flex items-center gap-1.5">' +
        '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-300">' + formatLabel + '</span>' +
        '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/30 text-amber-300">' + deuceLabel + '</span>' +
        (t.tiebreak ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-300 animate-pulse">TIEBREAK</span>' : '') +
        (statusLabel === 'DEUCE' ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/30 text-purple-300 animate-pulse">DEUCE</span>' : '') +
        (statusLabel === 'AD' ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/30 text-yellow-300 animate-pulse">AD</span>' : '') +
        (courtState.locked ? '<span class="text-xs text-yellow-500"><i class="fas fa-lock"></i></span>' : '<button onclick="exitCourt()" class="text-gray-500 hover:text-white text-sm px-1.5 ml-1" title="코트 선택으로"><i class="fas fa-arrow-left"></i></button>') +
      '</div>' +
    '</div>' +

    // 세트 히스토리 바
    setsHtml +

    // 메인 점수판: 좌우 구조
    '<div class="flex-1 flex flex-row relative" style="min-height:0;">' +

      // 왼쪽 팀
      '<div id="left-zone" class="flex-1 flex flex-col items-center justify-center relative cursor-pointer touch-area' +
        (gL > gR ? ' bg-gradient-to-r from-emerald-900/30 to-transparent' : '') + '"' +
        ' style="border-right: 3px solid rgba(255,255,255,0.1);">' +
        // 이름 + 서브 표시
        '<div class="absolute top-3 left-0 right-0 text-center">' +
          '<p class="text-lg sm:text-xl font-bold text-emerald-400 truncate px-4">' +
            (servL ? '<span class="inline-block w-3 h-3 bg-yellow-400 rounded-full mr-1.5 animate-pulse" title="서브"></span>' : '') +
            leftName +
            (servL ? ' <span class="text-xs text-yellow-400 font-normal">SERVE</span>' : '') +
          '</p>' +
        '</div>' +
        // 게임 점수 (큰 글씨)
        '<div class="text-center">' +
          '<div class="font-black tabular-nums leading-none text-white' + (matchOver && setsWonL > setsWonR ? ' text-yellow-400' : '') + '" ' +
            'style="font-size:clamp(5rem,16vw,10rem);text-shadow:0 4px 20px rgba(0,0,0,0.5);">' + gL + '</div>' +
          '<p class="text-xs text-emerald-400/60 font-bold mt-1 uppercase tracking-wider">GAMES</p>' +
        '</div>' +
        // 현재 포인트 (작은 글씨)
        '<div class="absolute bottom-20 left-0 right-0 text-center">' +
          '<div class="inline-flex items-center gap-1 px-4 py-2 rounded-full ' +
            (t.tiebreak ? 'bg-red-500/20 border border-red-500/30' : ptL === 'AD' ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-white/10 border border-white/10') + '">' +
            '<span class="text-2xl sm:text-3xl font-black ' + (ptL === 'AD' ? 'text-yellow-400' : 'text-white') + '" id="score-left">' + ptL + '</span>' +
            '<span class="text-xs text-white/40 ml-1">' + (t.tiebreak ? 'TB' : 'PT') + '</span>' +
          '</div>' +
        '</div>' +
        '<button onclick="event.stopPropagation();tennisMinusPoint(\'left\')" ' +
          'class="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-10 rounded-xl bg-red-600/60 hover:bg-red-500 text-xl font-bold shadow-lg active:scale-90 transition z-10">' +
          '−1</button>' +
      '</div>' +

      // 중앙 컨트롤
      '<div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">' +
        '<button onclick="manualSwapSides()" class="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border-2 border-white/20 flex items-center justify-center text-white shadow-xl active:scale-90 transition backdrop-blur-sm" title="좌우 교체">' +
          '<i class="fas fa-exchange-alt text-lg"></i></button>' +
        '<div class="flex flex-col items-center">' +
          '<span class="text-xs text-white/40 font-bold">' + gL + ' - ' + gR + '</span>' +
          (t.tiebreak ? '<span class="text-xs text-red-400 font-bold">TB ' + t.tbPoint.left + '-' + t.tbPoint.right + '</span>' : '') +
        '</div>' +
        // 서브 전환 버튼
        '<button onclick="event.stopPropagation();toggleServeManual()" class="w-10 h-10 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shadow-lg active:scale-90 transition" title="서브 전환">' +
          '<span class="text-sm">🎾</span></button>' +
      '</div>' +

      // 오른쪽 팀
      '<div id="right-zone" class="flex-1 flex flex-col items-center justify-center relative cursor-pointer touch-area' +
        (gR > gL ? ' bg-gradient-to-l from-orange-900/30 to-transparent' : '') + '">' +
        // 이름 + 서브 표시
        '<div class="absolute top-3 left-0 right-0 text-center">' +
          '<p class="text-lg sm:text-xl font-bold text-orange-400 truncate px-4">' +
            (servR ? '<span class="inline-block w-3 h-3 bg-yellow-400 rounded-full mr-1.5 animate-pulse" title="서브"></span>' : '') +
            rightName +
            (servR ? ' <span class="text-xs text-yellow-400 font-normal">SERVE</span>' : '') +
          '</p>' +
        '</div>' +
        // 게임 점수
        '<div class="text-center">' +
          '<div class="font-black tabular-nums leading-none text-white' + (matchOver && setsWonR > setsWonL ? ' text-yellow-400' : '') + '" ' +
            'style="font-size:clamp(5rem,16vw,10rem);text-shadow:0 4px 20px rgba(0,0,0,0.5);">' + gR + '</div>' +
          '<p class="text-xs text-orange-400/60 font-bold mt-1 uppercase tracking-wider">GAMES</p>' +
        '</div>' +
        // 현재 포인트
        '<div class="absolute bottom-20 left-0 right-0 text-center">' +
          '<div class="inline-flex items-center gap-1 px-4 py-2 rounded-full ' +
            (t.tiebreak ? 'bg-red-500/20 border border-red-500/30' : ptR === 'AD' ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-white/10 border border-white/10') + '">' +
            '<span class="text-2xl sm:text-3xl font-black ' + (ptR === 'AD' ? 'text-yellow-400' : 'text-white') + '" id="score-right">' + ptR + '</span>' +
            '<span class="text-xs text-white/40 ml-1">' + (t.tiebreak ? 'TB' : 'PT') + '</span>' +
          '</div>' +
        '</div>' +
        '<button onclick="event.stopPropagation();tennisMinusPoint(\'right\')" ' +
          'class="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-10 rounded-xl bg-red-600/60 hover:bg-red-500 text-xl font-bold shadow-lg active:scale-90 transition z-10">' +
          '−1</button>' +
      '</div>' +
    '</div>' +

    // 하단 컨트롤 바
    (courtState.readOnly ?
    '<div class="bg-black/50 border-t border-white/10 px-3 py-2 shrink-0" style="min-height:52px;">' +
      '<div class="flex items-center justify-center gap-3">' +
        '<span class="text-xs text-gray-500"><i class="fas fa-eye mr-1"></i>관람 전용 모드</span>' +
      '</div></div>'
    :
    '<div class="bg-black/50 border-t border-white/10 px-3 py-2 shrink-0" style="min-height:52px;">' +
      '<div class="flex gap-2">' +
        '<button onclick="tennisUndo()" class="flex-1 py-2.5 bg-white/10 rounded-xl text-xs sm:text-sm font-medium hover:bg-white/20 active:scale-95 transition">' +
          '<i class="fas fa-undo mr-1"></i>취소</button>' +
        '<button onclick="saveCurrentScore()" class="flex-1 py-2.5 bg-emerald-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-500 shadow-lg active:scale-95 transition">' +
          '<i class="fas fa-save mr-1"></i>저장</button>' +
        '<button onclick="showFinishModal()" class="flex-1 py-2.5 bg-green-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-green-500 shadow-lg active:scale-95 transition">' +
          '<i class="fas fa-flag-checkered mr-1"></i>종료</button>' +
      '</div>' +
    '</div>') +

    // 경기종료 모달
    renderFinishModal() +
    // 코트 교체 모달
    renderSwapModal() +
    // 터치 피드백
    '<div id="touch-feedback" class="fixed pointer-events-none z-[100]" style="display:none;">' +
      '<div class="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black text-white animate-ping">🎾</div></div>' +
  '</div>';
}

// 테니스 -1 포인트 버튼
function tennisMinusPoint(side) {
  tennisUndoPoint(side);
}

// 수동 서브 전환 버튼
function toggleServeManual() {
  const t = courtState.tennis;
  t.serving = t.serving === 'left' ? 'right' : 'left';
  renderCourt();
  var serverName = t.serving === 'left' ? getLeftName() : getRightName();
  showCourtToast('🎾 서브 → ' + serverName, 'info');
}

// 테니스 종합 취소 (최근 액션)
function tennisUndo() {
  const t = courtState.tennis;
  // 포인트가 있으면 포인트 취소, 없으면 게임 취소
  if (t.tiebreak && (t.tbPoint.left > 0 || t.tbPoint.right > 0)) {
    // 타이브레이크 중 가장 최근 포인트 취소는 복잡 → 알림
    showCourtToast('타이브레이크 중에는 −1 버튼을 사용하세요', 'warning');
    return;
  }
  if (t.point.left > 0 || t.point.right > 0) {
    showCourtToast('진행 중인 게임이 있습니다. −1 버튼을 사용하세요', 'warning');
    return;
  }
  // 게임이 있으면 마지막 게임 취소 (어느 쪽이었는지 모르므로 선택)
  if (t.games.left > 0 || t.games.right > 0) {
    const lastSide = t.games.left >= t.games.right ? 'left' : 'right';
    tennisUndoGame(lastSide);
    return;
  }
  showCourtToast('취소할 항목이 없습니다', 'warning');
}

// ==========================================
// 메인 점수판 - 좌우 레이아웃 + 터치 영역
// ==========================================
function renderCourtScoreboard() {
  const m = courtState.currentMatch;
  if (!m) return renderWaitingScreen();
  // 테니스 전용 점수판
  if (isTennis()) return renderTennisScoreboard(m);

  const sL = courtState.score.left;
  const sR = courtState.score.right;
  const target = courtState.targetScore;
  const swapPt = getSwapScore();
  const maxScore = Math.max(sL, sR);

  const leftName = getLeftName();
  const rightName = getRightName();

  // 교체 진행 표시
  const halfLabel = courtState.swapDone ? HALF2 : HALF1;
  const swapInfo = courtState.swapDone ? '교체완료' : `${swapPt}${SCORE_UNIT} ${SWAP_LABEL}`;

  return `<div class="h-screen bg-gray-900 text-white flex flex-col select-none" style="touch-action:manipulation;overflow:hidden;">
    <!-- 상단 정보 바 -->
    <div class="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-white/10 shrink-0" style="min-height:40px;">
      <div class="flex items-center gap-2">
        <span class="bg-green-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full pulse-live">${courtState.courtNumber}코트</span>
        <span class="text-xs text-gray-400">#${m.match_order}</span>
        <span class="text-xs text-gray-500">${m.event_name || ''}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="px-2 py-0.5 rounded-full text-xs font-bold ${target === 21 ? 'bg-red-500/30 text-red-300' : 'bg-yellow-500/30 text-yellow-300'}">
          ${target}점 ${courtState.format === 'tournament' ? '본선' : '예선'}
        </span>
        <span class="px-2 py-0.5 rounded-full text-xs font-bold ${courtState.swapDone ? 'bg-green-500/30 text-green-300' : 'bg-purple-500/30 text-purple-300'}">
          <i class="fas fa-exchange-alt mr-0.5"></i>${swapInfo}
        </span>
        <span class="text-xs px-2 py-0.5 rounded-full font-bold ${getProgressClass()}">${getProgressLabel()}</span>
        ${courtState.locked ? '<span class="text-xs text-yellow-500"><i class="fas fa-lock"></i></span>' : '<button onclick="exitCourt()" class="text-gray-500 hover:text-white text-sm px-1.5 ml-1" title="코트 선택으로"><i class="fas fa-arrow-left"></i></button>'}
      </div>
    </div>

    <!-- 메인 점수판: 좌우 구조 -->
    <div class="flex-1 flex flex-row relative" style="min-height:0;">
      
      <!-- 왼쪽 팀 (터치 영역) -->
      <div id="left-zone" class="flex-1 flex flex-col items-center justify-center relative cursor-pointer touch-area
        ${sL > sR ? 'bg-gradient-to-r from-${P}-900/30 to-transparent' : ''}
        ${sL >= target ? 'winner-glow-left' : ''}"
        style="border-right: 3px solid rgba(255,255,255,0.1);">
        
        <div class="absolute top-3 left-0 right-0 text-center">
          <p class="text-lg sm:text-xl font-bold text-${P}-400 truncate px-4">${leftName}</p>
        </div>

        <div class="text-center" id="left-score-display">
          <div class="score-num font-black tabular-nums leading-none text-white ${sL >= target ? 'text-yellow-400' : ''}" 
               id="score-left">${sL}</div>
        </div>

        <div class="absolute bottom-14 left-0 right-0 text-center">
          <span class="text-xs text-white/20"><i class="fas fa-hand-pointer mr-1"></i>터치 +1</span>
        </div>

        <button onclick="event.stopPropagation();changeScore('left',-1)" 
          class="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-10 rounded-xl bg-red-600/60 hover:bg-red-500 text-xl font-bold shadow-lg active:scale-90 transition z-10">
          −1
        </button>
      </div>

      <!-- 중앙 컨트롤 -->
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
        <button onclick="manualSwapSides()" id="swap-btn"
          class="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 border-2 border-white/20 
                 flex items-center justify-center text-white shadow-xl active:scale-90 transition backdrop-blur-sm"
          title="수동 좌우 교체">
          <i class="fas fa-exchange-alt text-xl"></i>
        </button>
        <span class="text-xs text-white/40 font-bold">${halfLabel}</span>
      </div>

      <!-- 오른쪽 팀 (터치 영역) -->
      <div id="right-zone" class="flex-1 flex flex-col items-center justify-center relative cursor-pointer touch-area
        ${sR > sL ? 'bg-gradient-to-l from-orange-900/30 to-transparent' : ''}
        ${sR >= target ? 'winner-glow-right' : ''}">

        <div class="absolute top-3 left-0 right-0 text-center">
          <p class="text-lg sm:text-xl font-bold text-orange-400 truncate px-4">${rightName}</p>
        </div>

        <div class="text-center" id="right-score-display">
          <div class="score-num font-black tabular-nums leading-none text-white ${sR >= target ? 'text-yellow-400' : ''}" 
               id="score-right">${sR}</div>
        </div>

        <div class="absolute bottom-14 left-0 right-0 text-center">
          <span class="text-xs text-white/20"><i class="fas fa-hand-pointer mr-1"></i>터치 +1</span>
        </div>

        <button onclick="event.stopPropagation();changeScore('right',-1)" 
          class="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-10 rounded-xl bg-red-600/60 hover:bg-red-500 text-xl font-bold shadow-lg active:scale-90 transition z-10">
          −1
        </button>
      </div>
    </div>

    <!-- 하단 컨트롤 바 -->
    ${courtState.readOnly ? `
    <div class="bg-black/50 border-t border-white/10 px-3 py-2 shrink-0" style="min-height:52px;">
      <div class="flex items-center justify-center gap-3">
        <span class="text-xs text-gray-500"><i class="fas fa-eye mr-1"></i>관람 전용 모드</span>
        ${!courtState.locked ? '<button onclick="exitCourt()" class="px-4 py-2 bg-white/10 rounded-xl text-xs text-gray-400 hover:bg-white/20"><i class="fas fa-arrow-left mr-1"></i>코트 선택</button>' : ''}
      </div>
    </div>` : `
    <div class="bg-black/50 border-t border-white/10 px-3 py-2 shrink-0" style="min-height:52px;">
      <div class="flex gap-2">
        <button onclick="undoLastAction()" class="flex-1 py-2.5 bg-white/10 rounded-xl text-xs sm:text-sm font-medium hover:bg-white/20 active:scale-95 transition">
          <i class="fas fa-undo mr-1"></i>취소
        </button>
        <button onclick="saveCurrentScore()" class="flex-1 py-2.5 bg-${P}-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-${P}-500 shadow-lg active:scale-95 transition">
          <i class="fas fa-save mr-1"></i>저장
        </button>
        <button onclick="showFinishModal()" class="flex-1 py-2.5 bg-green-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-green-500 shadow-lg active:scale-95 transition">
          <i class="fas fa-flag-checkered mr-1"></i>종료
        </button>
      </div>
    </div>`}

    <!-- 경기종료 모달 -->
    ${renderFinishModal()}

    <!-- 코트 교체 모달 -->
    ${renderSwapModal()}

    <!-- 터치 피드백 -->
    <div id="touch-feedback" class="fixed pointer-events-none z-[100]" style="display:none;">
      <div class="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black text-white animate-ping">+1</div>
    </div>
  </div>`;
}

// ==========================================
// 코트 교체 모달 (중간 교체)
// ==========================================
function renderSwapModal() {
  const swapPt = getSwapScore();
  const leftName = getLeftName();
  const rightName = getRightName();
  return `<div id="swap-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
    <div class="bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 border-2 border-purple-500/50 swap-modal-pulse">
      <div class="text-center mb-5">
        <div class="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-exchange-alt text-5xl text-purple-400 animate-pulse"></i>
        </div>
        <h3 class="text-3xl font-extrabold text-purple-300">${SWAP_LABEL}!</h3>
        <p class="text-gray-400 mt-2 text-base">${swapPt}${SCORE_UNIT} 도달 — ${SWAP_LABEL}합니다</p>
      </div>
      <div class="bg-white/5 rounded-2xl p-5 mb-5">
        <div class="flex items-center justify-center gap-5">
          <div class="text-center flex-1">
            <p class="text-sm text-${P}-400 font-bold mb-1">${leftName}</p>
            <p class="text-3xl font-black">${courtState.score.left}</p>
            <p class="text-xs text-gray-500 mt-1">→ 오른쪽으로</p>
          </div>
          <div class="flex flex-col items-center">
            <i class="fas fa-arrows-alt-h text-3xl text-purple-400 animate-pulse"></i>
          </div>
          <div class="text-center flex-1">
            <p class="text-sm text-orange-400 font-bold mb-1">${rightName}</p>
            <p class="text-3xl font-black">${courtState.score.right}</p>
            <p class="text-xs text-gray-500 mt-1">← 왼쪽으로</p>
          </div>
        </div>
      </div>
      <button onclick="executeAutoSwap()" 
        class="w-full py-5 bg-gradient-to-r from-purple-600 to-purple-500 rounded-2xl text-xl font-bold shadow-xl active:scale-95 transition hover:from-purple-500 hover:to-purple-400">
        <i class="fas fa-exchange-alt mr-2"></i>${SWAP_LABEL} 확인
      </button>
    </div>
  </div>`;
}

function showSwapModal() {
  const modal = document.getElementById('swap-modal');
  if (modal) modal.classList.remove('hidden');
}

function executeAutoSwap() {
  const modal = document.getElementById('swap-modal');
  if (modal) modal.classList.add('hidden');
  
  // 점수도 같이 교체
  const tmpScore = courtState.score.left;
  courtState.score.left = courtState.score.right;
  courtState.score.right = tmpScore;

  const tmpTeam = courtState.leftTeam;
  courtState.leftTeam = courtState.rightTeam;
  courtState.rightTeam = tmpTeam;

  courtState.swapped = !courtState.swapped;
  courtState.swapDone = true;

  // 테니스: 포인트/게임/타이브레이크/서브/세트 데이터도 좌우 교체
  if (isTennis()) {
    const t = courtState.tennis;
    const tmpPt = t.point.left; t.point.left = t.point.right; t.point.right = tmpPt;
    const tmpG = t.games.left; t.games.left = t.games.right; t.games.right = tmpG;
    const tmpTB = t.tbPoint.left; t.tbPoint.left = t.tbPoint.right; t.tbPoint.right = tmpTB;
    t.serving = t.serving === 'left' ? 'right' : 'left';
    for (var i = 0; i < t.sets.length; i++) {
      var tmp = t.sets[i].left; t.sets[i].left = t.sets[i].right; t.sets[i].right = tmp;
    }
  }

  // ★ 좌우 교체 후 서버 저장 (전광판 실시간 반영)
  autoSaveScore();
  renderCourt();
  showCourtToast('🔄 ' + SWAP_LABEL + ' 완료!', 'success');
}

function renderFinishModal() {
  const m = courtState.currentMatch;
  if (!m) return '';
  const sL = courtState.score.left;
  const sR = courtState.score.right;
  const leftName = getLeftName();
  const rightName = getRightName();

  // 테니스 세트 상세 정보
  var tennisDetail = '';
  if (isTennis()) {
    const t = courtState.tennis;
    var allSets = t.sets.slice();
    if (t.games.left > 0 || t.games.right > 0) {
      allSets.push({ left: t.games.left, right: t.games.right });
    }
    if (allSets.length > 0) {
      tennisDetail = '<div class="mt-3 flex justify-center gap-2 flex-wrap">';
      for (var si = 0; si < allSets.length; si++) {
        var s = allSets[si];
        var sWin = s.left > s.right ? 'left' : 'right';
        tennisDetail += '<span class="px-2 py-1 rounded text-xs font-bold ' +
          (sWin === 'left' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-orange-500/30 text-orange-300') +
          '">세트' + (si+1) + ': ' + s.left + '-' + s.right + '</span>';
      }
      tennisDetail += '</div>';
    }
  }

  // 게임 수 vs 세트 승리 수 표시
  var displayL = sL, displayR = sR;
  if (isTennis() && courtState.tennis.setsToWin > 1) {
    // 멀티세트: 세트 승리 수 표시
    displayL = courtState.tennis.sets.filter(function(s) { return s.left > s.right; }).length;
    displayR = courtState.tennis.sets.filter(function(s) { return s.right > s.left; }).length;
  } else if (isTennis()) {
    displayL = courtState.tennis.games.left;
    displayR = courtState.tennis.games.right;
  }

  return `<div id="finish-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div class="bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 border border-white/10">
      <h3 class="text-xl font-bold text-center mb-6"><i class="fas fa-flag-checkered mr-2 text-green-400"></i>경기 종료</h3>
      <div class="mb-6">
        <div class="flex items-center justify-between bg-white/5 rounded-xl px-6 py-4">
          <div class="text-center flex-1">
            <p class="text-sm text-${P}-400 font-medium mb-1">${leftName}</p>
            <p class="text-4xl font-black ${displayL > displayR ? 'text-yellow-400' : ''}">${displayL}</p>
          </div>
          <span class="text-2xl text-gray-600 font-bold mx-4">:</span>
          <div class="text-center flex-1">
            <p class="text-sm text-orange-400 font-medium mb-1">${rightName}</p>
            <p class="text-4xl font-black ${displayR > displayL ? 'text-yellow-400' : ''}">${displayR}</p>
          </div>
        </div>
        ${tennisDetail}
      </div>
      <div class="mb-6">
        <p class="text-sm text-gray-400 mb-3 text-center">승자를 선택하세요</p>
        <div class="grid grid-cols-2 gap-3">
          <button onclick="selectWinner('left')" id="winner-btn-left" class="py-4 bg-${P}-600/30 border-2 border-${P}-500/30 rounded-2xl text-center hover:bg-${P}-600/50 transition">
            <p class="font-bold text-${P}-400">${leftName}</p>
            <p class="text-3xl font-black mt-1">${displayL}</p>
          </button>
          <button onclick="selectWinner('right')" id="winner-btn-right" class="py-4 bg-orange-600/30 border-2 border-orange-500/30 rounded-2xl text-center hover:bg-orange-600/50 transition">
            <p class="font-bold text-orange-400">${rightName}</p>
            <p class="text-3xl font-black mt-1">${displayR}</p>
          </button>
        </div>
      </div>
      <div class="flex gap-3">
        <button onclick="closeFinishModal()" class="flex-1 py-3 bg-white/10 rounded-xl font-medium hover:bg-white/20">취소</button>
        <button onclick="confirmFinish()" id="confirm-finish-btn" class="flex-1 py-3 bg-green-600 rounded-xl font-bold hover:bg-green-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled>
          <i class="fas fa-check mr-1"></i>경기 종료 확인
        </button>
      </div>
    </div>
  </div>`;
}

// ==========================================
// 대기 화면
// ==========================================
function renderWaitingScreen() {
  const next = courtState.nextMatches;
  const recent = courtState.recentMatches;
  const swapPt = getSwapScore();
  return `<div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col select-none">
    <div class="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/10">
      <div class="flex items-center gap-2">
        <span class="bg-yellow-500 text-black text-sm font-bold px-4 py-1.5 rounded-full">${courtState.courtNumber}코트</span>
        <span class="text-sm text-gray-400">${courtState.tournament?.name || ''}</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="refreshCourtData()" class="px-3 py-1.5 bg-white/10 rounded-lg text-sm hover:bg-white/20"><i class="fas fa-sync-alt mr-1"></i>새로고침</button>
        ${courtState.locked ? '' : '<button onclick="exitCourt()" class="px-3 py-1.5 bg-white/10 rounded-lg text-sm hover:bg-white/20" title="코트 선택으로"><i class="fas fa-arrow-left mr-1"></i>코트 선택</button>'}
      </div>
    </div>
    <div class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="text-center mb-8">
        <div class="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-hourglass-half text-4xl text-yellow-400"></i>
        </div>
        <h2 class="text-3xl font-extrabold mb-2">경기 대기중</h2>
        <p class="text-gray-400">다음 경기를 시작해주세요</p>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${courtState.targetScore === 21 ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}">
            <i class="fas fa-bullseye"></i>${courtState.targetScore}${SCORE_UNIT} 선취제
          </span>
          <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300">
            <i class="fas fa-exchange-alt"></i>${swapPt}${SCORE_UNIT} ${SWAP_LABEL}
          </span>
        </div>
      </div>
      ${next.length > 0 ? `
        <button onclick="startNextMatch()" class="w-full max-w-md py-5 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl text-xl font-bold shadow-xl hover:shadow-green-500/30 active:scale-95 transition mb-6">
          <i class="fas fa-play mr-2"></i>다음 경기 시작
        </button>
        <div class="w-full max-w-md">
          <h3 class="text-sm font-semibold text-gray-400 mb-3"><i class="fas fa-list mr-1"></i>대기 경기 목록</h3>
          <div class="space-y-2">
            ${next.map((m, i) => `
              <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 ${i===0 ? 'ring-2 ring-green-500/50 bg-green-500/10' : ''}">
                <div>
                  <span class="text-xs text-gray-500">#${m.match_order} ${m.event_name||''}</span>
                  <div class="font-medium">${m.team1_name||'TBD'} <span class="text-gray-500 mx-1">vs</span> ${m.team2_name||'TBD'}</div>
                </div>
                ${i===0 ? '<span class="badge bg-green-500/20 text-green-400 text-xs"><i class="fas fa-arrow-right mr-1"></i>NEXT</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="text-center py-8">
          <p class="text-gray-500 text-lg">이 코트에 배정된 대기 경기가 없습니다.</p>
        </div>
      `}
      ${recent.length > 0 ? `
        <div class="w-full max-w-md mt-6">
          <h3 class="text-sm font-semibold text-gray-400 mb-3"><i class="fas fa-history mr-1"></i>최근 완료</h3>
          <div class="space-y-2">
            ${recent.map(m => {
              const t1S = m.team1_set1||0;
              const t2S = m.team2_set1||0;
              return `<div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div class="text-sm">
                  <span class="${m.winner_team===1?'text-yellow-400 font-bold':'text-gray-400'}">${m.team1_name}</span>
                  <span class="mx-2 text-gray-600">vs</span>
                  <span class="${m.winner_team===2?'text-yellow-400 font-bold':'text-gray-400'}">${m.team2_name}</span>
                </div>
                <span class="text-lg font-bold">${t1S} : ${t2S}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  </div>`;
}

// ==========================================
// 터치 이벤트 바인딩
// ==========================================
function bindScoreboardEvents() {
  // 읽기 전용 모드에서는 터치 이벤트 비활성화
  if (courtState.readOnly) return;

  const leftZone = document.getElementById('left-zone');
  const rightZone = document.getElementById('right-zone');

  if (leftZone) {
    leftZone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      showTouchFeedback(e, 'left');
      // 테니스: 포인트 시스템(0→15→30→40→게임), 배드민턴: +1점
      if (isTennis()) {
        tennisScorePoint('left');
      } else {
        changeScore('left', 1);
      }
    });
  }
  if (rightZone) {
    rightZone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      showTouchFeedback(e, 'right');
      if (isTennis()) {
        tennisScorePoint('right');
      } else {
        changeScore('right', 1);
      }
    });
  }
}

function showTouchFeedback(e, side) {
  const fb = document.getElementById('touch-feedback');
  if (!fb) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX || rect.left + rect.width / 2;
  const y = e.clientY || rect.top + rect.height / 2;
  fb.style.left = (x - 40) + 'px';
  fb.style.top = (y - 40) + 'px';
  fb.style.display = 'block';
  // 테니스: 포인트 표시, 배드민턴: +1 표시
  const fbInner = fb.querySelector('div');
  if (fbInner) {
    if (isTennis()) {
      fbInner.textContent = '🎾';
    } else {
      fbInner.textContent = '+1';
    }
  }
  
  const zone = document.getElementById(side + '-zone');
  if (zone) { zone.classList.add('touch-flash'); setTimeout(() => zone.classList.remove('touch-flash'), 200); }
  setTimeout(() => { fb.style.display = 'none'; }, 400);
}

// ==========================================
// 진행 상태 표시
// ==========================================
function getProgressLabel() {
  const target = courtState.targetScore;
  const sL = courtState.score.left;
  const sR = courtState.score.right;
  const maxScore = Math.max(sL, sR);

  if (sL >= target && sL > sR) return '경기 종료!';
  if (sR >= target && sR > sL) return '경기 종료!';
  if (maxScore === target - 1) return '매치포인트!';
  if (maxScore >= target - 3) return `${target - maxScore}${SCORE_UNIT} 남음`;
  return `${sL} : ${sR}`;
}

function getProgressClass() {
  const target = courtState.targetScore;
  const sL = courtState.score.left;
  const sR = courtState.score.right;
  const maxScore = Math.max(sL, sR);

  if ((sL >= target && sL > sR) || (sR >= target && sR > sL)) return 'bg-green-500/30 text-green-300 font-bold';
  if (maxScore === target - 1) return 'bg-red-500/40 text-red-200 animate-pulse font-bold';
  if (maxScore >= target - 3) return 'bg-red-500/30 text-red-300 animate-pulse';
  if (maxScore >= target - 5) return 'bg-yellow-500/30 text-yellow-300';
  return 'bg-white/10 text-gray-400';
}

// ==========================================
// 수동 좌우 교체
// ==========================================
function manualSwapSides() {
  const tmpScore = courtState.score.left;
  courtState.score.left = courtState.score.right;
  courtState.score.right = tmpScore;

  const tmpTeam = courtState.leftTeam;
  courtState.leftTeam = courtState.rightTeam;
  courtState.rightTeam = tmpTeam;

  courtState.swapped = !courtState.swapped;

  // 테니스: 포인트/게임/타이브레이크/서브/세트 데이터도 좌우 교체
  if (isTennis()) {
    const t = courtState.tennis;
    const tmpPt = t.point.left; t.point.left = t.point.right; t.point.right = tmpPt;
    const tmpG = t.games.left; t.games.left = t.games.right; t.games.right = tmpG;
    const tmpTB = t.tbPoint.left; t.tbPoint.left = t.tbPoint.right; t.tbPoint.right = tmpTB;
    t.serving = t.serving === 'left' ? 'right' : 'left';
    for (var i = 0; i < t.sets.length; i++) {
      var tmp = t.sets[i].left; t.sets[i].left = t.sets[i].right; t.sets[i].right = tmp;
    }
  }

  showCourtToast('🔄 좌우 ' + SWAP_LABEL + '!', 'info');
  renderCourt();
}

// ==========================================
// 점수 조작
// ==========================================
let actionHistory = [];

// ==========================================
// 디바운스 자동저장 (점수 변경 시 서버에 즉시 반영)
// 전광판(대시보드)이 3초마다 서버를 조회하므로
// 점수가 바뀔 때마다 서버에 저장해야 실시간 반영됨
// ==========================================
let _autoSaveTimer = null;
const AUTO_SAVE_DELAY = 200; // 200ms 디바운스 (빠른 전광판 반영)

function autoSaveScore() {
  if (!courtState.currentMatch) return;
  if (courtState.readOnly) return;  // 관람 모드에서는 저장 안 함

  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(async () => {
    const m = courtState.currentMatch;
    if (!m) return;

    var data;
    if (isTennis()) {
      data = getTennisSetScores();
      data.status = 'playing';
    } else {
      data = {
        team1_set1: getTeam1Score(),
        team1_set2: 0, team1_set3: 0,
        team2_set1: getTeam2Score(),
        team2_set2: 0, team2_set3: 0,
        status: 'playing'
      };
    }

    try {
      await courtApi(`/tournaments/${courtState.tournamentId}/matches/${m.id}/score`, {
        method: 'PUT', body: JSON.stringify(data)
      });
      console.log('[AutoSave] 점수 서버 저장 완료', data);
    } catch(e) {
      console.warn('[AutoSave] 저장 실패', e);
    }
  }, AUTO_SAVE_DELAY);
}

function changeScore(side, delta) {
  const oldVal = courtState.score[side];
  const maxScore = courtState.targetScore + 10;
  const newVal = Math.max(0, Math.min(maxScore, oldVal + delta));
  
  if (oldVal === newVal) return;
  
  actionHistory.push({ side, oldVal, newVal, swapDone: courtState.swapDone, swapPending: courtState.swapPending });
  courtState.score[side] = newVal;

  const el = document.getElementById(`score-${side}`);
  if (el) {
    el.textContent = newVal;
    el.classList.add('score-flash');
    setTimeout(() => el.classList.remove('score-flash'), 300);
  }

  // ★ 득점 파티클 애니메이션
  if (delta > 0) {
    const target = courtState.targetScore;
    const isMatchPoint = (newVal === target - 1 && newVal > courtState.score[side === 'left' ? 'right' : 'left']);
    const isWinning = (newVal >= target);
    if (isWinning) {
      spawnScoreParticles(side, true);
      setTimeout(() => spawnConfetti(), 200);
      setTimeout(() => spawnFireworks(window.innerWidth/2, window.innerHeight/3), 400);
    } else if (isMatchPoint) {
      spawnScoreParticles(side, true);
    } else {
      spawnScoreParticles(side, false);
    }
  }

  // 중간 교체 점수 체크 (아직 교체 안 했을 때만, 모달 미표시 중일 때만)
  if (!courtState.swapDone && !courtState.swapPending) {
    if (checkAutoSwap()) {
      // 교체 모달이 표시되므로 renderCourt 스킵 (모달 안에서 처리)
      autoSaveScore(); // 교체 시에도 서버에 저장
      return;
    }
  }

  // 목표 점수 도달 체크
  checkGameEnd();

  // ★ 점수 변경 시 서버에 자동 저장 (전광판 실시간 반영)
  autoSaveScore();

  renderCourt();
}

// 중간 교체 체크: 어느 한 팀이 교체 점수에 도달하면
// returns true if swap modal is triggered
function checkAutoSwap() {
  const swapPt = getSwapScore();
  const sL = courtState.score.left;
  const sR = courtState.score.right;
  
  // 어느 한쪽이 교체 점수에 최초 도달하면 (정확히 교체 점수일 때)
  if (sL === swapPt || sR === swapPt) {
    courtState.swapPending = true;
    // 점수 표시 업데이트 후 모달
    renderCourt();
    setTimeout(() => showSwapModal(), 300);
    return true;
  }
  return false;
}

function checkGameEnd() {
  const target = courtState.targetScore;
  const sL = courtState.score.left;
  const sR = courtState.score.right;
  
  let winnerSide = null;
  if (sL >= target && sL > sR) winnerSide = 'left';
  else if (sR >= target && sR > sL) winnerSide = 'right';
  
  if (!winnerSide) return;
  
  const winnerName = winnerSide === 'left' ? getLeftName() : getRightName();
  
  setTimeout(() => {
    showCourtToast(`🏆 ${winnerName} 승리! (${sL}:${sR})`, 'success');
    setTimeout(() => showFinishModal(), 500);
  }, 300);
}

function undoLastAction() {
  if (actionHistory.length === 0) { showCourtToast('실행취소할 항목이 없습니다.', 'warning'); return; }
  const last = actionHistory.pop();
  courtState.score[last.side] = last.oldVal;
  // undo 시 swapDone, swapPending도 복원
  courtState.swapDone = last.swapDone;
  if (last.swapPending !== undefined) courtState.swapPending = last.swapPending;
  // ★ 실행취소 후에도 서버에 저장 (전광판 반영)
  autoSaveScore();
  renderCourt();
  showCourtToast('실행취소 완료', 'info');
}

// ==========================================
// 점수 저장 / 경기 종료
// ==========================================
function getTennisSetScores() {
  // 테니스 세트별 점수를 DB 필드에 매핑
  const t = courtState.tennis;
  const result = {
    team1_set1: 0, team1_set2: 0, team1_set3: 0,
    team2_set1: 0, team2_set2: 0, team2_set3: 0
  };

  // 프로세트 (단일 세트)
  if (t.setsToWin === 1) {
    if (courtState.leftTeam === 1) {
      result.team1_set1 = t.games.left;
      result.team2_set1 = t.games.right;
    } else {
      result.team1_set1 = t.games.right;
      result.team2_set1 = t.games.left;
    }
    return result;
  }

  // 멀티세트: 완료된 세트 + 현재 세트
  var allSets = t.sets.slice();
  // 현재 진행 중인 세트가 있으면 추가
  if (t.games.left > 0 || t.games.right > 0) {
    allSets.push({ left: t.games.left, right: t.games.right });
  }

  for (var i = 0; i < allSets.length && i < 3; i++) {
    var s = allSets[i];
    var team1g, team2g;
    if (courtState.leftTeam === 1) {
      team1g = s.left;
      team2g = s.right;
    } else {
      team1g = s.right;
      team2g = s.left;
    }
    if (i === 0) { result.team1_set1 = team1g; result.team2_set1 = team2g; }
    else if (i === 1) { result.team1_set2 = team1g; result.team2_set2 = team2g; }
    else if (i === 2) { result.team1_set3 = team1g; result.team2_set3 = team2g; }
  }
  return result;
}

async function saveCurrentScore() {
  const m = courtState.currentMatch;
  if (!m) return;

  var data;
  if (isTennis()) {
    data = getTennisSetScores();
    data.status = 'playing';
  } else {
    data = {
      team1_set1: getTeam1Score(),
      team1_set2: 0, team1_set3: 0,
      team2_set1: getTeam2Score(),
      team2_set2: 0, team2_set3: 0,
      status: 'playing'
    };
  }

  try {
    await courtApi(`/tournaments/${courtState.tournamentId}/matches/${m.id}/score`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    showCourtToast((SC.scoring && SC.scoring.scoreLabel || '점수') + ' 저장됨!', 'success');
  } catch(e) {}
}

let selectedWinnerSide = null;

function showFinishModal() {
  selectedWinnerSide = null;
  const sL = courtState.score.left;
  const sR = courtState.score.right;
  
  if (sL > sR) selectedWinnerSide = 'left';
  else if (sR > sL) selectedWinnerSide = 'right';
  
  renderCourt();
  const modal = document.getElementById('finish-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (selectedWinnerSide) selectWinner(selectedWinnerSide);
  }
}

function closeFinishModal() {
  const modal = document.getElementById('finish-modal');
  if (modal) modal.classList.add('hidden');
  selectedWinnerSide = null;
}

function selectWinner(side) {
  selectedWinnerSide = side;
  const btnL = document.getElementById('winner-btn-left');
  const btnR = document.getElementById('winner-btn-right');
  const confirmBtn = document.getElementById('confirm-finish-btn');
  
  if (btnL && btnR) {
    btnL.className = `py-4 rounded-2xl text-center transition ${side === 'left' ? 'bg-${P}-600 border-2 border-${P}-400 ring-4 ring-${P}-500/30 shadow-xl' : 'bg-white/5 border-2 border-white/10'}`;
    btnR.className = `py-4 rounded-2xl text-center transition ${side === 'right' ? 'bg-orange-600 border-2 border-orange-400 ring-4 ring-orange-500/30 shadow-xl' : 'bg-white/5 border-2 border-white/10'}`;
  }
  if (confirmBtn) confirmBtn.disabled = false;
}

async function confirmFinish() {
  if (!selectedWinnerSide || !courtState.currentMatch) return;
  
  const m = courtState.currentMatch;
  const winnerTeam = selectedWinnerSide === 'left' ? courtState.leftTeam : courtState.rightTeam;
  const loserTeam = winnerTeam === 1 ? 2 : 1;

  var data;
  if (isTennis()) {
    data = getTennisSetScores();
    data.status = 'completed';
    data.winner_team = winnerTeam;
  } else {
    data = {
      team1_set1: getTeam1Score(),
      team1_set2: 0, team1_set3: 0,
      team2_set1: getTeam2Score(),
      team2_set2: 0, team2_set3: 0,
      status: 'completed',
      winner_team: winnerTeam
    };
  }

  try {
    await courtApi(`/tournaments/${courtState.tournamentId}/matches/${m.id}/score`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    showCourtToast('경기가 종료되었습니다! 서명을 받아주세요.', 'success');
    closeFinishModal();
    
    // 서명 화면으로 전환 (경기 정보 보존)
    const winnerName = winnerTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');
    const loserName = loserTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');
    
    courtState.finishedMatch = m;
    // 테니스: 세트별 점수 보존
    if (isTennis()) {
      const setScores = getTennisSetScores();
      courtState.finishedScore = {
        team1: getTeam1Score(), team2: getTeam2Score(),
        isTennis: true,
        sets: setScores
      };
    } else {
      courtState.finishedScore = { team1: getTeam1Score(), team2: getTeam2Score() };
    }
    courtState.finishedWinner = winnerTeam;
    courtState.finishedNames = { winner: winnerName, loser: loserName };
    courtState.page = 'signature';
    
    // 현재 경기 정보 초기화
    courtState.currentMatch = null;
    courtState.score = { left: 0, right: 0 };
    courtState.leftTeam = 1;
    courtState.rightTeam = 2;
    courtState.swapped = false;
    courtState.swapDone = false;
    courtState.swapPending = false;
    actionHistory = [];
    selectedWinnerSide = null;
    
    renderCourt();
  } catch(e) {}
}

// ==========================================
// 서명 확인 화면
// ==========================================
let signaturePads = { winner: null, loser: null };
let signatureStep = 'winner'; // winner | loser | done

function renderSignatureScreen() {
  const fm = courtState.finishedMatch;
  const fs = courtState.finishedScore;
  const names = courtState.finishedNames;
  if (!fm || !fs || !names) {
    courtState.page = 'court';
    renderCourt();
    return '';
  }

  const winnerScore = courtState.finishedWinner === 1 ? fs.team1 : fs.team2;
  const loserScore = courtState.finishedWinner === 1 ? fs.team2 : fs.team1;

  // 테니스 세트별 점수 표시
  let setScoreHtml = '';
  if (fs.isTennis && fs.sets) {
    const s = fs.sets;
    const setLines = [];
    if (s.team1_set1 || s.team2_set1) {
      const w1 = courtState.finishedWinner === 1 ? s.team1_set1 : s.team2_set1;
      const l1 = courtState.finishedWinner === 1 ? s.team2_set1 : s.team1_set1;
      setLines.push(`<span class="px-2 py-0.5 rounded-lg ${w1 > l1 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/5 text-gray-400'} text-sm font-bold">${w1}-${l1}</span>`);
    }
    if (s.team1_set2 || s.team2_set2) {
      const w2 = courtState.finishedWinner === 1 ? s.team1_set2 : s.team2_set2;
      const l2 = courtState.finishedWinner === 1 ? s.team2_set2 : s.team1_set2;
      setLines.push(`<span class="px-2 py-0.5 rounded-lg ${w2 > l2 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/5 text-gray-400'} text-sm font-bold">${w2}-${l2}</span>`);
    }
    if (s.team1_set3 || s.team2_set3) {
      const w3 = courtState.finishedWinner === 1 ? s.team1_set3 : s.team2_set3;
      const l3 = courtState.finishedWinner === 1 ? s.team2_set3 : s.team1_set3;
      setLines.push(`<span class="px-2 py-0.5 rounded-lg ${w3 > l3 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/5 text-gray-400'} text-sm font-bold">${w3}-${l3}</span>`);
    }
    if (setLines.length > 0) {
      setScoreHtml = `<div class="mt-2 flex items-center justify-center gap-2">
        <span class="text-[10px] text-gray-500">세트:</span>
        ${setLines.join('<span class="text-gray-600">·</span>')}
      </div>`;
    }
  }

  return `<div class="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col select-none" style="touch-action:none;overflow:hidden;">
    <!-- 상단 바 -->
    <div class="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10 shrink-0">
      <div class="flex items-center gap-2">
        <span class="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">${courtState.courtNumber}코트</span>
        <span class="text-xs text-gray-400">#${fm.match_order} ${fm.event_name || ''}</span>
      </div>
      <span class="text-xs text-yellow-300 font-bold"><i class="fas fa-pen-fancy mr-1"></i>점수 확인 서명</span>
    </div>

    <!-- 경기 결과 요약 -->
    <div class="px-4 pt-3 pb-2 shrink-0">
      <div class="bg-white/5 rounded-2xl p-3 border border-white/10">
        <div class="flex items-center justify-center gap-4">
          <div class="text-center flex-1">
            <p class="text-xs text-yellow-400 font-bold mb-0.5">
              🏆 승리
            </p>
            <p class="text-sm font-bold truncate">${names.winner}</p>
            <p class="text-2xl font-black text-yellow-400">${winnerScore}</p>
          </div>
          <span class="text-xl text-gray-600 font-bold">:</span>
          <div class="text-center flex-1">
            <p class="text-xs text-gray-400 font-bold mb-0.5">
              패배
            </p>
            <p class="text-sm font-bold truncate">${names.loser}</p>
            <p class="text-2xl font-black">${loserScore}</p>
          </div>
        </div>
        ${setScoreHtml}
      </div>
    </div>

    <!-- 서명 영역 -->
    <div class="flex-1 flex flex-col px-4 pb-3 min-h-0">
      <!-- 단계 표시 -->
      <div class="flex justify-center gap-3 mb-2 shrink-0">
        <div class="flex items-center gap-1.5">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${signatureStep === 'winner' ? 'bg-yellow-500 text-black' : signaturePads.winner ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-500'}">
            ${signaturePads.winner ? '✓' : '1'}
          </div>
          <span class="text-xs ${signatureStep === 'winner' ? 'text-yellow-300 font-bold' : 'text-gray-500'}">승리팀</span>
        </div>
        <div class="w-6 border-t border-white/20 self-center"></div>
        <div class="flex items-center gap-1.5">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${signatureStep === 'loser' ? 'bg-${P}-500 text-white' : signaturePads.loser ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-500'}">
            ${signaturePads.loser ? '✓' : '2'}
          </div>
          <span class="text-xs ${signatureStep === 'loser' ? 'text-${P}-300 font-bold' : 'text-gray-500'}">패배팀</span>
        </div>
      </div>

      <!-- 현재 서명 대상 -->
      <div class="text-center mb-2 shrink-0">
        <p class="text-base font-bold ${signatureStep === 'winner' ? 'text-yellow-400' : 'text-${P}-400'}">
          <i class="fas fa-pen-fancy mr-1"></i>
          ${signatureStep === 'winner' ? `${names.winner} (승리팀)` : signatureStep === 'loser' ? `${names.loser} (패배팀)` : ''} 서명
        </p>
        <p class="text-xs text-gray-500 mt-0.5">위 점수가 맞다면 아래에 서명해주세요</p>
      </div>

      <!-- 캔버스 (터치 서명 영역) -->
      <div class="flex-1 relative rounded-2xl overflow-hidden border-2 ${signatureStep === 'winner' ? 'border-yellow-500/40' : 'border-${P}-500/40'} bg-white min-h-0" id="sig-container" style="max-height:45vh;">
        <canvas id="sig-canvas" class="w-full h-full" style="touch-action:none;"></canvas>
        <!-- 가이드 라인 -->
        <div class="absolute bottom-[30%] left-[10%] right-[10%] border-b border-dashed border-gray-300 pointer-events-none"></div>
        <div class="absolute bottom-[28%] right-[10%] pointer-events-none">
          <span class="text-gray-300 text-xs">서명</span>
        </div>
        <!-- 서명 안내 워터마크 -->
        <div id="sig-watermark" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p class="text-gray-300 text-lg font-medium">여기에 서명하세요</p>
        </div>
      </div>

      <!-- 하단 버튼 -->
      <div class="flex gap-2 mt-3 shrink-0 pb-2">
        <button onclick="clearSignature()" class="py-3 px-4 bg-white/10 rounded-xl text-sm font-medium hover:bg-white/20 active:scale-95 transition">
          <i class="fas fa-eraser mr-1"></i>다시 쓰기
        </button>
        ${signatureStep !== 'done' ? `
        <button onclick="confirmSignature()" id="sig-confirm-btn" class="flex-1 py-4 ${signatureStep === 'winner' ? 'bg-yellow-500 text-black' : 'bg-${P}-500 text-white'} rounded-xl text-base font-black hover:opacity-90 shadow-lg active:scale-95 transition disabled:opacity-30" disabled>
          <i class="fas fa-arrow-right mr-2"></i>${signatureStep === 'winner' ? '승리팀 서명 완료 →' : '패배팀 서명 완료 → 경기 종료'}
        </button>
        ` : ''}
        <button onclick="skipSignature()" class="py-3 px-3 bg-white/5 rounded-xl text-xs text-gray-500 hover:bg-white/10 active:scale-95 transition">
          건너뛰기
        </button>
      </div>
    </div>
  </div>`;
}

// 서명 캔버스 초기화
function initSignaturePads() {
  const canvas = document.getElementById('sig-canvas');
  const container = document.getElementById('sig-container');
  if (!canvas || !container) return;

  // 캔버스 크기를 컨테이너에 맞춤
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  let drawing = false;
  let hasStrokes = false;
  let lastX = 0;
  let lastY = 0;

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - r.left) * (canvas.width / r.width),
      y: (touch.clientY - r.top) * (canvas.height / r.height)
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastX = pos.x;
    lastY = pos.y;
    
    if (!hasStrokes) {
      hasStrokes = true;
      const wm = document.getElementById('sig-watermark');
      if (wm) wm.style.display = 'none';
      const btn = document.getElementById('sig-confirm-btn');
      if (btn) btn.disabled = false;
    }
  }

  function endDraw(e) {
    if (drawing) {
      e.preventDefault();
      drawing = false;
    }
  }

  // 터치 이벤트
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', endDraw, { passive: false });
  canvas.addEventListener('touchcancel', endDraw, { passive: false });

  // 마우스 이벤트 (PC 테스트용)
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);

  // 캔버스 참조 저장
  canvas._hasStrokes = () => hasStrokes;
  canvas._resetStrokes = () => { hasStrokes = false; };
}

function clearSignature() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas._resetStrokes && canvas._resetStrokes();
  
  const wm = document.getElementById('sig-watermark');
  if (wm) wm.style.display = 'flex';
  const btn = document.getElementById('sig-confirm-btn');
  if (btn) btn.disabled = true;
}

function confirmSignature() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas || !(canvas._hasStrokes && canvas._hasStrokes())) {
    showCourtToast('서명을 해주세요.', 'warning');
    return;
  }

  // 서명 이미지 저장
  const sigData = canvas.toDataURL('image/png');
  
  if (signatureStep === 'winner') {
    signaturePads.winner = sigData;
    signatureStep = 'loser';
    renderCourt();
    showCourtToast('승리팀 서명 완료! 패배팀 서명을 받아주세요.', 'success');
  } else if (signatureStep === 'loser') {
    signaturePads.loser = sigData;
    signatureStep = 'done';
    submitSignatures();
  }
}

function skipSignature() {
  if (signatureStep === 'winner') {
    if (!confirm('서명 없이 진행하시겠습니까?')) return;
    signaturePads.winner = null;
    signaturePads.loser = null;
    finishSignatureProcess();
  } else if (signatureStep === 'loser') {
    if (!confirm('패배팀 서명 없이 진행하시겠습니까?')) return;
    signaturePads.loser = null;
    submitSignatures();
  }
}

async function submitSignatures() {
  const fm = courtState.finishedMatch;
  if (!fm) { finishSignatureProcess(); return; }

  if (signaturePads.winner || signaturePads.loser) {
    try {
      await courtApi(`/tournaments/${courtState.tournamentId}/matches/${fm.id}/signature`, {
        method: 'PUT',
        body: JSON.stringify({
          winner_signature: signaturePads.winner || null,
          loser_signature: signaturePads.loser || null
        })
      });
      showCourtToast('서명이 저장되었습니다!', 'success');
    } catch(e) {
      showCourtToast('서명 저장 실패 - 경기 결과는 이미 저장됨', 'warning');
    }
  }
  
  finishSignatureProcess();
}

function finishSignatureProcess() {
  // 상태 초기화
  courtState.finishedMatch = null;
  courtState.finishedScore = null;
  courtState.finishedWinner = null;
  courtState.finishedNames = null;
  signaturePads = { winner: null, loser: null };
  signatureStep = 'winner';
  
  // 자동 다음 경기 모드
  if (courtState.autoNext) {
    showCourtToast('3초 후 다음 경기를 자동 로드합니다...', 'info');
    setTimeout(async () => {
      try {
        const data = await courtApi(`/tournaments/${courtState.tournamentId}/court/${courtState.courtNumber}`);
        courtState.nextMatches = data.next_matches || [];
        if (data.next_matches && data.next_matches.length > 0) {
          await startNextMatch();
        } else {
          refreshCourtData();
        }
      } catch(e) {
        refreshCourtData();
      }
    }, 3000);
  } else {
    refreshCourtData();
  }
}

// ==========================================
// 다음 경기 시작 → 사이드 선택으로
// ==========================================
async function startNextMatch() {
  try {
    await courtApi(`/tournaments/${courtState.tournamentId}/court/${courtState.courtNumber}/next`, {
      method: 'POST', body: '{}'
    });
    // 경기 데이터 로드
    const data = await courtApi(`/tournaments/${courtState.tournamentId}/court/${courtState.courtNumber}`);
    courtState.tournament = data.tournament;
    courtState.currentMatch = data.current_match;
    courtState.nextMatches = data.next_matches;
    courtState.recentMatches = data.recent_matches;
    courtState.targetScore = data.target_score || 25;
    courtState.format = data.tournament?.format || 'kdk';
    // 대회 종목에 맞는 config로 전환
    if (data.tournament && data.tournament.sport) {
      applySportConfig(data.tournament.sport);
    }

    // 초기화
    courtState.score = { left: 0, right: 0 };
    courtState.leftTeam = 1;
    courtState.rightTeam = 2;
    courtState.swapped = false;
    courtState.swapDone = false;
    courtState.swapPending = false;
    actionHistory = [];

    // 사이드 선택 화면으로
    courtState.page = 'side-select';
    renderCourt();
  } catch(e) {}
}

// ==========================================
// 데이터 로드
// ==========================================
async function refreshCourtData() {
  if (!courtState.tournamentId || !courtState.courtNumber) return;
  
  try {
    const data = await courtApi(`/tournaments/${courtState.tournamentId}/court/${courtState.courtNumber}`);
    courtState.tournament = data.tournament;
    courtState.currentMatch = data.current_match;
    courtState.nextMatches = data.next_matches;
    courtState.recentMatches = data.recent_matches;
    courtState.targetScore = data.target_score || 25;
    courtState.format = data.tournament?.format || 'kdk';
    // 대회 종목에 맞는 config로 전환
    if (data.tournament && data.tournament.sport) {
      applySportConfig(data.tournament.sport);
    }
    
    if (data.current_match) {
      const m = data.current_match;
      // 진행중인 경기가 있는데 점수가 0:0이면 → 사이드 선택으로
      const t1s = m.team1_set1 || 0;
      const t2s = m.team2_set1 || 0;
      if (t1s === 0 && t2s === 0 && courtState.page !== 'court') {
        courtState.score = { left: 0, right: 0 };
        courtState.leftTeam = 1;
        courtState.rightTeam = 2;
        courtState.swapped = false;
        courtState.swapDone = false;
        courtState.swapPending = false;
        courtState.page = 'side-select';
      } else {
        // 이미 점수가 있으면 바로 점수판
        if (courtState.leftTeam === 1) {
          courtState.score = { left: t1s, right: t2s };
        } else {
          courtState.score = { left: t2s, right: t1s };
        }
        // 테니스: DB에 저장된 게임 수를 tennis 상태에 복원
        if (isTennis()) {
          resetTennisState();
          const mt = data.current_match;
          const t = courtState.tennis;
          // 멀티세트: set2, set3 데이터가 있으면 완료된 세트로 복원
          var t1s1 = mt.team1_set1 || 0, t2s1 = mt.team2_set1 || 0;
          var t1s2 = mt.team1_set2 || 0, t2s2 = mt.team2_set2 || 0;
          var t1s3 = mt.team1_set3 || 0, t2s3 = mt.team2_set3 || 0;

          if (t.setsToWin > 1) {
            // 멀티세트 복원
            t.sets = [];
            t.currentSet = 1;
            // 세트1이 완료 상태인지 체크 (둘 다 0이 아니고, 승자가 있는 경우)
            if ((t1s1 > 0 || t2s1 > 0) && (t1s2 > 0 || t2s2 > 0)) {
              // 세트1은 완료됨
              if (courtState.leftTeam === 1) {
                t.sets.push({ left: t1s1, right: t2s1 });
              } else {
                t.sets.push({ left: t2s1, right: t1s1 });
              }
              t.currentSet = 2;
              // 세트2도 완료됐는지 체크
              if ((t1s3 > 0 || t2s3 > 0)) {
                if (courtState.leftTeam === 1) {
                  t.sets.push({ left: t1s2, right: t2s2 });
                } else {
                  t.sets.push({ left: t2s2, right: t1s2 });
                }
                t.currentSet = 3;
                // 현재 세트 = 세트3
                if (courtState.leftTeam === 1) {
                  t.games = { left: t1s3, right: t2s3 };
                } else {
                  t.games = { left: t2s3, right: t1s3 };
                }
              } else {
                // 현재 세트 = 세트2
                if (courtState.leftTeam === 1) {
                  t.games = { left: t1s2, right: t2s2 };
                } else {
                  t.games = { left: t2s2, right: t1s2 };
                }
              }
            } else {
              // 현재 세트 = 세트1
              if (courtState.leftTeam === 1) {
                t.games = { left: t1s1, right: t2s1 };
              } else {
                t.games = { left: t2s1, right: t1s1 };
              }
            }
          } else {
            // 프로세트: 단일 세트
            t.games.left = courtState.score.left;
            t.games.right = courtState.score.right;
          }

          // 타이브레이크 진입 체크
          if (checkTiebreakEntry(t.games.left, t.games.right, t.gamesPerSet) && !t.tiebreak) {
            t.tiebreak = true;
          }
          // score 동기화
          syncTennisScoreToDB();
        }
        courtState.page = 'court';
      }
    } else {
      courtState.leftTeam = 1;
      courtState.rightTeam = 2;
      courtState.swapped = false;
      courtState.swapDone = false;
      courtState.swapPending = false;
      courtState.page = 'court';
    }
    
    renderCourt();
  } catch(e) {}
}

async function loadTournamentList() {
  try {
    const data = await courtApi('/tournaments');
    const el = document.getElementById('tournament-list-court');
    if (!el) return;
    
    if (data.tournaments.length === 0) {
      el.innerHTML = '<div class="text-center py-8 text-gray-500">등록된 대회가 없습니다.</div>';
      return;
    }
    
    el.innerHTML = data.tournaments.map(t => {
      const st = { draft: '준비중', open: '접수중', in_progress: '진행중', completed: '완료' };
      const sportEmoji = t.sport === 'tennis' ? '🎾' : '🏸';
      const sportLabel = t.sport === 'tennis' ? '테니스' : '배드민턴';
      const tCfg = ALL_CONFIGS[t.sport] || SC;
      const tP = (tCfg.theme && tCfg.theme.primaryClass) || 'blue';
      const tUnit = (tCfg.scoring && tCfg.scoring.scoreUnit) || '점';
      const stColor = { draft: 'text-gray-400', open: 'text-' + tP + '-400', in_progress: 'text-green-400', completed: 'text-purple-400' };
      const targetPt = t.target_games || (t.format === 'tournament' ? (tCfg.scoring && tCfg.scoring.tournamentTargetScore || 21) : (tCfg.scoring && tCfg.scoring.defaultTargetScore || 25));
      return `<button onclick="selectTournament(${t.id})" class="w-full text-left bg-white/5 rounded-xl p-4 hover:bg-white/10 transition border border-white/5">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-lg">${sportEmoji}</span>
              <h4 class="font-bold text-lg">${t.name}</h4>
            </div>
            <p class="text-sm text-gray-500">${sportLabel} · ${t.courts}코트 · ${({kdk:'KDK',league:'풀리그',tournament:'토너먼트'})[t.format]} · ${targetPt}${tUnit}제</p>
          </div>
          <span class="text-sm font-medium ${stColor[t.status]||''}">${st[t.status]||t.status}</span>
        </div>
      </button>`;
    }).join('');
  } catch(e) {}
}

async function selectTournament(tid) {
  courtState.tournamentId = tid;
  try {
    const data = await courtApi(`/tournaments/${tid}`);
    courtState.tournament = data.tournament;
    // 대회 종목에 맞는 config로 전환
    if (data.tournament && data.tournament.sport) {
      applySportConfig(data.tournament.sport);
    }
    renderCourt();
    await loadCourtGrid();
  } catch(e) {}
}

async function loadCourtGrid() {
  if (!courtState.tournamentId) return;
  try {
    const data = await courtApi(`/tournaments/${courtState.tournamentId}/courts/overview`);
    const el = document.getElementById('court-grid');
    if (!el) return;

    el.innerHTML = data.courts.map(c => {
      const hasMatch = !!c.current_match;
      const color = hasMatch ? 'from-green-600 to-green-500' : 'from-gray-700 to-gray-600';
      return `<button onclick="showCourtModeModal(${c.court_number})" 
        class="bg-gradient-to-br ${color} rounded-2xl p-6 text-center hover:scale-[1.02] transition shadow-lg active:scale-95">
        <div class="text-4xl font-black mb-2">${c.court_number}</div>
        <div class="text-sm font-medium opacity-80">${c.court_number}코트</div>
        ${hasMatch ? `
          <div class="mt-2 text-xs opacity-70">
            <div class="bg-black/20 rounded-lg px-2 py-1 mt-1">
              <span class="pulse-live">🟢</span> ${c.current_match.team1_name||''} vs ${c.current_match.team2_name||''}
            </div>
          </div>
        ` : `
          <div class="mt-2 text-xs opacity-60">대기: ${c.pending_count}경기</div>
        `}
      </button>`;
    }).join('');
  } catch(e) {}
}

// ==========================================
// 코트 모드 선택 모달
// ==========================================
function showCourtModeModal(courtNum) {
  // 기존 모달 제거
  const old = document.getElementById('court-mode-modal');
  if (old) old.remove();

  const baseUrl = window.location.origin + '/court';
  const tid = courtState.tournamentId;

  const modal = document.createElement('div');
  modal.id = 'court-mode-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md';
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-6 border border-white/10">
      <div class="text-center mb-5">
        <div class="w-16 h-16 rounded-full bg-${P}-500/20 flex items-center justify-center mx-auto mb-3">
          <span class="text-3xl font-black text-${P}-400">${courtNum}</span>
        </div>
        <h3 class="text-xl font-extrabold">${courtNum}코트</h3>
        <p class="text-sm text-gray-400 mt-1">사용 모드를 선택하세요</p>
      </div>

      <div class="space-y-3">
        <!-- 심판용 (점수 입력) -->
        <button onclick="enterCourtMode(${courtNum}, 'scorer')"
          class="w-full py-4 px-4 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl text-left hover:from-green-500 hover:to-green-400 active:scale-[0.98] transition shadow-lg">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <i class="fas fa-hand-pointer text-xl"></i>
            </div>
            <div>
              <p class="font-bold text-base">🏓 심판용 (점수 입력)</p>
              <p class="text-xs text-white/70 mt-0.5">터치로 점수 입력 · 코트 태블릿용</p>
            </div>
          </div>
        </button>

        <!-- 관람용 전광판 -->
        <button onclick="enterCourtMode(${courtNum}, 'viewer')"
          class="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl text-left hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] transition shadow-lg">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <i class="fas fa-tv text-xl"></i>
            </div>
            <div>
              <p class="font-bold text-base">📺 관람용 전광판</p>
              <p class="text-xs text-white/70 mt-0.5">점수 자동 갱신 · 터치 잠금 · TV/모니터용</p>
            </div>
          </div>
        </button>

        <!-- 심판용 (고정) -->
        <button onclick="enterCourtMode(${courtNum}, 'locked')"
          class="w-full py-3 px-4 bg-white/10 rounded-2xl text-left hover:bg-white/15 active:scale-[0.98] transition border border-white/10">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
              <i class="fas fa-lock text-lg text-yellow-400"></i>
            </div>
            <div>
              <p class="font-bold text-sm">🔒 심판용 (코트 고정)</p>
              <p class="text-xs text-gray-400 mt-0.5">점수 입력 + 나가기 버튼 숨김</p>
            </div>
          </div>
        </button>
      </div>

      <button onclick="document.getElementById('court-mode-modal').remove()" 
        class="w-full mt-4 py-3 bg-white/5 text-gray-400 rounded-xl text-sm hover:bg-white/10">
        <i class="fas fa-times mr-1"></i>취소
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 배경 클릭 시 닫기
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });
}

function enterCourtMode(courtNum, mode) {
  // 모달 닫기
  const modal = document.getElementById('court-mode-modal');
  if (modal) modal.remove();

  if (mode === 'viewer') {
    // 관람용: 새 탭으로 열기 (locked + mode=view)
    const url = '/court?tid=' + courtState.tournamentId + '&court=' + courtNum + '&locked=1&mode=view';
    window.open(url, '_blank');
  } else if (mode === 'locked') {
    // 고정 심판용: 새 탭으로 열기 (locked)
    const url = '/court?tid=' + courtState.tournamentId + '&court=' + courtNum + '&locked=1';
    window.open(url, '_blank');
  } else {
    // 일반 심판용: 현재 탭에서 진입
    selectCourtNumber(courtNum);
  }
}

function selectCourtNumber(num) {
  courtState.courtNumber = num;
  const url = new URL(window.location);
  url.searchParams.set('tid', courtState.tournamentId);
  url.searchParams.set('court', num);
  window.history.pushState({}, '', url);
  refreshCourtData();
}

// QR 코드 모달 (심판용 + 관람용)
function showQRModal() {
  const t = courtState.tournament;
  if (!t) return;
  const baseUrl = window.location.origin + '/court';
  const numCourts = t.courts || 6;
  const modal = document.createElement('div');
  modal.id = 'qr-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md';

  // 모드 탭 상태
  let qrMode = 'scorer'; // scorer | viewer | dashboard | watch

  function renderQRContent(mode) {
    // 스마트워치 모드
    if (mode === 'watch') {
      const watchBase = window.location.origin + '/watch';
      let cards = '';
      for (let i = 1; i <= numCourts; i++) {
        const watchUrl = watchBase + '?tid=' + courtState.tournamentId + '&court=' + i;
        cards += '<div class="bg-white rounded-xl p-3 text-center">' +
          '<div class="font-bold text-gray-900 mb-2">⌚ ' + i + '코트</div>' +
          '<div class="flex items-center justify-center" style="min-height:120px;">' +
            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(watchUrl) + '" alt="Watch QR ' + i + '" class="w-[120px] h-[120px]" loading="lazy">' +
          '</div>' +
          '<div class="flex gap-1 mt-2 justify-center">' +
            '<button onclick="copyToClipboard(\'' + watchUrl.replace(/'/g, "\\'") + '\')" class="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded bg-gray-100">' +
              '<i class="fas fa-copy mr-0.5"></i>복사</button>' +
            '<button onclick="window.open(\'' + watchUrl.replace(/'/g, "\\'") + '\', \'_blank\')" class="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-gray-100">' +
              '<i class="fas fa-external-link-alt mr-0.5"></i>열기</button>' +
          '</div>' +
        '</div>';
      }
      return '<p class="text-sm text-gray-400 mb-3"><span class="font-bold text-white">⌚ 스마트워치 점수판</span> — 원형 화면 최적화 · 터치로 간편 점수 입력</p>' +
        '<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">' + cards + '</div>';
    }

    // 대시보드 모드: 단일 QR
    if (mode === 'dashboard') {
      const dashUrl = baseUrl + '?tid=' + courtState.tournamentId + '&locked=1&mode=view';
      return '<p class="text-sm text-gray-400 mb-3"><span class="font-bold text-white">🖥️ 대형 전광판 대시보드</span> — 전 코트 실시간 현황 · TV/프로젝터용</p>' +
        '<div class="flex justify-center">' +
          '<div class="bg-white rounded-xl p-6 text-center max-w-xs">' +
            '<div class="font-bold text-gray-900 mb-3 text-lg">전체 코트 대시보드</div>' +
            '<div class="flex items-center justify-center" style="min-height:160px;">' +
              '<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(dashUrl) + '" alt="Dashboard QR" class="w-[160px] h-[160px]" loading="lazy">' +
            '</div>' +
            '<p class="text-xs text-gray-500 mt-3">전 코트 경기 현황을 한 화면에 표시</p>' +
            '<div class="flex gap-2 mt-3 justify-center">' +
              '<button onclick="copyToClipboard(\'' + dashUrl.replace(/'/g, "\\'") + '\')" class="text-xs text-purple-600 hover:text-purple-800 px-3 py-1.5 rounded-lg bg-gray-100 font-bold">' +
                '<i class="fas fa-copy mr-1"></i>URL 복사</button>' +
              '<button onclick="window.open(\'' + dashUrl.replace(/'/g, "\\'") + '\', \'_blank\')" class="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg bg-gray-100 font-bold">' +
                '<i class="fas fa-external-link-alt mr-1"></i>열기</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    const suffix = mode === 'viewer' ? '&locked=1&mode=view' : '&locked=1';
    const modeLabel = mode === 'viewer' ? '📺 관람용 전광판' : '🏓 심판용 (코트 고정)';
    const modeDesc = mode === 'viewer' 
      ? '관중 모니터에서 스캔 — 점수 자동 갱신, 터치 잠금' 
      : '코트 태블릿에서 스캔 — 터치로 점수 입력';

    let cards = '';
    for (let i = 1; i <= numCourts; i++) {
      const courtUrl = baseUrl + '?tid=' + courtState.tournamentId + '&court=' + i + suffix;
      cards += '<div class="bg-white rounded-xl p-3 text-center">' +
        '<div class="font-bold text-gray-900 mb-2">' + i + '코트</div>' +
        '<div id="qr-court-' + mode + '-' + i + '" class="flex items-center justify-center" style="min-height:120px;">' +
          '<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(courtUrl) + '" alt="QR ' + i + '코트" class="w-[120px] h-[120px]" loading="lazy">' +
        '</div>' +
        '<div class="flex gap-1 mt-2 justify-center">' +
          '<button onclick="copyToClipboard(\'' + courtUrl.replace(/'/g, "\\'") + '\')" class="text-xs text-' + P + '-600 hover:text-' + P + '-800 px-2 py-1 rounded bg-gray-100">' +
            '<i class="fas fa-copy mr-0.5"></i>복사</button>' +
          '<button onclick="window.open(\'' + courtUrl.replace(/'/g, "\\'") + '\', \'_blank\')" class="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-gray-100">' +
            '<i class="fas fa-external-link-alt mr-0.5"></i>열기</button>' +
        '</div>' +
      '</div>';
    }
    return '<p class="text-sm text-gray-400 mb-3"><span class="font-bold text-white">' + modeLabel + '</span> — ' + modeDesc + '</p>' +
      '<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">' + cards + '</div>';
  }

  modal.innerHTML = '<div class="bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">' +
    '<div class="p-4 border-b border-white/10 flex items-center justify-between">' +
      '<h3 class="text-lg font-bold text-white"><i class="fas fa-qrcode mr-2 text-purple-400"></i>코트별 QR 코드</h3>' +
      '<button onclick="document.getElementById(\'qr-modal\').remove()" class="text-gray-400 hover:text-white"><i class="fas fa-times text-lg"></i></button>' +
    '</div>' +
    '<div class="px-4 pt-3 pb-1 flex gap-2 shrink-0">' +
      '<button id="qr-tab-scorer" onclick="switchQRTab(\'scorer\')" class="flex-1 py-2.5 rounded-xl text-sm font-bold transition bg-green-600 text-white">' +
        '🏓 심판용</button>' +
      '<button id="qr-tab-viewer" onclick="switchQRTab(\'viewer\')" class="flex-1 py-2.5 rounded-xl text-sm font-bold transition bg-white/10 text-gray-400 hover:bg-white/15">' +
        '📺 관람용</button>' +
      '<button id="qr-tab-watch" onclick="switchQRTab(\'watch\')" class="flex-1 py-2.5 rounded-xl text-sm font-bold transition bg-white/10 text-gray-400 hover:bg-white/15">' +
        '⌚ 워치</button>' +
      '<button id="qr-tab-dashboard" onclick="switchQRTab(\'dashboard\')" class="flex-1 py-2.5 rounded-xl text-sm font-bold transition bg-white/10 text-gray-400 hover:bg-white/15">' +
        '🖥️ 대시보드</button>' +
    '</div>' +
    '<div class="p-4 overflow-y-auto flex-1" id="qr-content">' +
      renderQRContent('scorer') +
    '</div>' +
  '</div>';
  document.body.appendChild(modal);

  // 탭 전환 함수를 전역으로 노출
  window.switchQRTab = function(mode) {
    qrMode = mode;
    var content = document.getElementById('qr-content');
    if (content) content.innerHTML = renderQRContent(mode);
    var tabScorer = document.getElementById('qr-tab-scorer');
    var tabViewer = document.getElementById('qr-tab-viewer');
    var tabDash = document.getElementById('qr-tab-dashboard');
    var tabWatch = document.getElementById('qr-tab-watch');
    var inactiveClass = 'bg-white/10 text-gray-400 hover:bg-white/15';
    if (tabScorer) tabScorer.className = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition ' + 
      (mode === 'scorer' ? 'bg-green-600 text-white' : inactiveClass);
    if (tabViewer) tabViewer.className = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition ' + 
      (mode === 'viewer' ? 'bg-blue-600 text-white' : inactiveClass);
    if (tabWatch) tabWatch.className = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition ' + 
      (mode === 'watch' ? 'bg-amber-600 text-white' : inactiveClass);
    if (tabDash) tabDash.className = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition ' + 
      (mode === 'dashboard' ? 'bg-purple-600 text-white' : inactiveClass);
  };
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showCourtToast('URL이 복사되었습니다!', 'success');
  }).catch(() => {
    // 폴백
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showCourtToast('URL이 복사되었습니다!', 'success');
  });
}

// ==========================================
// 대형 전광판 대시보드 (전 코트 통합 뷰)
// ==========================================
let dashboardTimer = null;
let dashboardData = null;     // 마지막 API 응답 캐시
let dashboardPrevState = {};  // 코트별 이전 상태 (경기종료→결과 전환용)

function startDashboardRefresh() {
  if (dashboardTimer) clearInterval(dashboardTimer);
  dashboardTimer = setInterval(async () => {
    if (courtState.page !== 'dashboard') return;
    await fetchDashboardData();
  }, 1500);
}

function enterDashboardMode() {
  courtState.page = 'dashboard';
  courtState.readOnly = true;
  courtState.locked = true;
  dashboardData = null;
  dashboardPrevState = {};
  // URL 업데이트
  const url = new URL(window.location);
  url.searchParams.set('tid', courtState.tournamentId);
  url.searchParams.delete('court');
  url.searchParams.set('mode', 'view');
  url.searchParams.set('locked', '1');
  window.history.pushState({}, '', url);
  renderDashboardView();
  startDashboardRefresh();
}

async function fetchDashboardData() {
  try {
    const data = await courtApi(`/tournaments/${courtState.tournamentId}/courts/overview`);
    // 경기 종료 감지: 이전에 playing이었는데 지금 current_match가 없으면 → 종료 전환
    if (dashboardData) {
      data.courts.forEach((c, idx) => {
        const prev = dashboardData.courts[idx];
        if (prev && prev.current_match && !c.current_match) {
          // 경기가 방금 끝남 → 결과 표시 모드
          dashboardPrevState[c.court_number] = {
            phase: 'result',
            match: prev.current_match,
            recent: c.recent_match,
            timestamp: Date.now()
          };
        }
      });
    }
    dashboardData = data;
    courtState.tournament = data.tournament;
    courtState.stats = data.stats;
    renderDashboardView();
  } catch(e) { console.error('Dashboard fetch error', e); }
}

function renderDashboardView() {
  const app = document.getElementById('app');
  if (!dashboardData) {
    app.innerHTML = `<div class="min-h-screen bg-gray-950 flex items-center justify-center">
      <div class="text-center"><i class="fas fa-spinner fa-spin text-4xl text-${P}-400 mb-4"></i>
      <p class="text-gray-400">대시보드 로딩 중...</p></div></div>`;
    fetchDashboardData();
    return;
  }

  const t = dashboardData.tournament;
  const courts = dashboardData.courts;
  const stats = dashboardData.stats;
  const numCourts = courts.length;
  const sport = t.sport || 'badminton';
  const emoji = sport === 'tennis' ? '🎾' : '🏸';

  // 그리드 레이아웃: 코트 수에 따라 결정
  let gridCols = 'grid-cols-2';
  let cardMaxH = '';
  if (numCourts <= 2) { gridCols = 'grid-cols-2'; }
  else if (numCourts <= 3) { gridCols = 'grid-cols-3'; }
  else if (numCourts <= 4) { gridCols = 'grid-cols-2 lg:grid-cols-4'; }
  else if (numCourts <= 6) { gridCols = 'grid-cols-2 lg:grid-cols-3'; }
  else { gridCols = 'grid-cols-2 lg:grid-cols-4'; }

  const isTen = sport === 'tennis';
  const accentColor = isTen ? 'emerald' : 'blue';
  const sportLabel = isTen ? 'Tennis' : 'Badminton';

  // 상단 바
  const topBar = `
    <div class="flex items-center justify-between px-6 py-3 border-b ${isTen ? 'border-emerald-500/20' : 'border-blue-500/20'} bg-gray-900/80 backdrop-blur-lg">
      <div class="flex items-center gap-3">
        <span class="text-2xl">${emoji}</span>
        <div>
          <h1 class="text-xl font-extrabold text-white tracking-tight">${t.name || '대회'}</h1>
          <p class="text-xs text-${accentColor}-400/60">${sportLabel} Tournament Dashboard</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-xs">
          <span class="px-2 py-1 rounded-full bg-${accentColor}-500/20 text-${accentColor}-400 font-bold">
            <i class="fas fa-play mr-1"></i>${stats?.playing || 0} 경기중
          </span>
          <span class="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">
            <i class="fas fa-clock mr-1"></i>${stats?.pending || 0} 대기
          </span>
          <span class="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 font-bold">
            <i class="fas fa-check mr-1"></i>${stats?.completed || 0} 완료
          </span>
        </div>
        <div class="flex items-center gap-1 text-${accentColor}-400 text-xs">
          <span class="w-2 h-2 rounded-full bg-${accentColor}-400 animate-pulse"></span> LIVE
        </div>
      </div>
    </div>`;

  // 코트 카드들
  const courtCards = courts.map(c => renderDashboardCourtCard(c, sport, t)).join('');

  // 하단 바
  const bottomBar = `
    <div class="flex items-center justify-between px-6 py-2 border-t border-white/10 bg-gray-900/60">
      <div class="flex items-center gap-3 flex-1">
        <span class="text-xs text-gray-500">${emoji} ${t.name} — ${numCourts}코트</span>
        <div class="sponsor-banner-slot flex-1 max-w-xs"></div>
      </div>
      <span class="text-xs text-gray-500">자동 갱신 3초 <i class="fas fa-sync-alt ml-1 animate-spin" style="animation-duration:3s"></i></span>
    </div>`;

  app.innerHTML = `
    <div class="min-h-screen bg-gray-950 flex flex-col">
      ${topBar}
      <div class="flex-1 p-4 lg:p-6 overflow-auto">
        <div class="grid ${gridCols} gap-4 lg:gap-5 auto-rows-fr">
          ${courtCards}
        </div>
      </div>
      ${bottomBar}
    </div>`;
}

function renderDashboardCourtCard(court, sport, tournament) {
  const cn = court.court_number;
  const m = court.current_match;
  const next = court.next_match;
  const recent = court.recent_match;
  const pending = court.pending_count;
  const isTen = sport === 'tennis';
  const targetScore = dashboardData.target_score || 21;

  // 경기 종료 전환 상태 체크
  const prevState = dashboardPrevState[cn];
  if (prevState && prevState.phase === 'result') {
    const elapsed = Date.now() - prevState.timestamp;
    if (elapsed < 8000) {
      // 8초간 결과 표시
      return renderDashboardCardResult(cn, prevState, isTen);
    } else {
      // 전환 완료 → 정리
      delete dashboardPrevState[cn];
    }
  }

  if (m) {
    return renderDashboardCardPlaying(cn, m, isTen, targetScore, tournament);
  } else if (next) {
    return renderDashboardCardNext(cn, next, pending, isTen);
  } else {
    return renderDashboardCardEmpty(cn, pending, recent, isTen);
  }
}

// --- 경기중 카드 ---
function renderDashboardCardPlaying(cn, m, isTen, targetScore, tournament) {
  if (isTen) {
    return renderDashboardCardPlayingTennis(cn, m, targetScore, tournament);
  }
  return renderDashboardCardPlayingBadminton(cn, m, targetScore, tournament);
}

// --- 배드민턴 경기중 카드 ---
function renderDashboardCardPlayingBadminton(cn, m, targetScore, tournament) {
  const s1 = m.team1_set1 || 0;
  const s2 = m.team2_set1 || 0;
  
  const maxScore = Math.max(s1, s2, 1);
  const progress = Math.min(maxScore / targetScore * 100, 100);
  
  const isMatchPoint = (s1 === targetScore - 1 && s1 > s2) || (s2 === targetScore - 1 && s2 > s1);
  const isCloseGame = Math.abs(s1 - s2) <= 1 && (s1 >= targetScore - 3 || s2 >= targetScore - 3);
  
  let borderColor = 'border-blue-500/50';
  let glowClass = '';
  let badge = '';
  if (isMatchPoint) {
    borderColor = 'border-red-500/80';
    glowClass = 'shadow-[0_0_25px_rgba(239,68,68,0.3)]';
    badge = `<span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-black bg-red-500 text-white rounded-full animate-pulse tracking-wider">MATCH POINT</span>`;
  } else if (isCloseGame) {
    borderColor = 'border-yellow-500/60';
    badge = `<span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-yellow-500/80 text-black rounded-full">접전</span>`;
  }

  const eventInfo = m.event_name || '';
  const roundInfo = m.round ? `R${m.round}` : '';

  return `
    <div class="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 ${borderColor} ${glowClass} p-4 flex flex-col transition-all duration-500 overflow-hidden">
      ${badge}
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-black text-sm">${cn}</span>
          <span class="text-xs font-bold text-blue-400 tracking-wider">🏸 경기중</span>
        </div>
        <div class="text-[10px] text-gray-500 text-right leading-tight">
          ${eventInfo ? `<div>${eventInfo}</div>` : ''}
          ${roundInfo ? `<div>${roundInfo} #${m.match_order || ''}</div>` : ''}
        </div>
      </div>

      <div class="flex-1 flex flex-col justify-center">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-bold text-white truncate flex-1 mr-2" title="${m.team1_name||''}">${truncateName(m.team1_name||'팀1', 10)}</span>
          <span class="text-3xl lg:text-4xl font-black ${s1 > s2 ? 'text-white' : 'text-gray-400'} tabular-nums min-w-[2ch] text-right">${s1}</span>
        </div>
        <div class="flex items-center gap-2 my-1">
          <div class="flex-1 h-px bg-white/10"></div>
          <span class="text-[10px] text-gray-600 font-bold">VS</span>
          <div class="flex-1 h-px bg-white/10"></div>
        </div>
        <div class="flex items-center justify-between mt-1">
          <span class="text-sm font-bold text-white truncate flex-1 mr-2" title="${m.team2_name||''}">${truncateName(m.team2_name||'팀2', 10)}</span>
          <span class="text-3xl lg:text-4xl font-black ${s2 > s1 ? 'text-white' : 'text-gray-400'} tabular-nums min-w-[2ch] text-right">${s2}</span>
        </div>
      </div>

      <div class="mt-3">
        ${renderCourtTimeline(m, targetScore, false)}
      </div>
    </div>`;
}

// --- 테니스 경기중 카드 ---
function renderDashboardCardPlayingTennis(cn, m, targetScore, tournament) {
  // 세트별 게임 스코어 추출
  const g1s1 = m.team1_set1 || 0, g2s1 = m.team2_set1 || 0; // 세트1 (또는 현재 프로세트)
  const g1s2 = m.team1_set2 || 0, g2s2 = m.team2_set2 || 0; // 세트2
  const g1s3 = m.team1_set3 || 0, g2s3 = m.team2_set3 || 0; // 세트3

  // 스코어링 타입 판단
  const scoringType = tournament.scoring_type || 'pro8';
  const isMultiSet = scoringType === 'set2' || scoringType === 'set3';

  // 현재 세트와 현재 게임 스코어 결정
  let currentG1, currentG2;
  let completedSets = [];
  let currentSetNum = 1;

  if (isMultiSet) {
    // 멀티세트: 어떤 세트가 진행 중인지 판단
    if (g1s2 > 0 || g2s2 > 0 || (g1s1 > 0 || g2s1 > 0)) {
      // 세트2 데이터 있으면 세트1은 완료
      if (g1s2 > 0 || g2s2 > 0) {
        completedSets.push({ t1: g1s1, t2: g2s1 });
        currentSetNum = 2;
        if (g1s3 > 0 || g2s3 > 0) {
          completedSets.push({ t1: g1s2, t2: g2s2 });
          currentSetNum = 3;
          currentG1 = g1s3; currentG2 = g2s3;
        } else {
          currentG1 = g1s2; currentG2 = g2s2;
        }
      } else {
        currentG1 = g1s1; currentG2 = g2s1;
      }
    } else {
      currentG1 = 0; currentG2 = 0;
    }
  } else {
    // 프로세트 (단일 세트)
    currentG1 = g1s1; currentG2 = g2s1;
  }

  // 세트 승수 계산 (멀티세트일 때)
  let setsWon1 = 0, setsWon2 = 0;
  completedSets.forEach(s => {
    if (s.t1 > s.t2) setsWon1++;
    else if (s.t2 > s.t1) setsWon2++;
  });

  // 게임포인트/세트포인트/매치포인트 감지
  const gamesTarget = targetScore;
  let badge = '';
  let borderColor = 'border-emerald-500/50';
  let glowClass = '';
  let progressBarColor = 'bg-emerald-500';

  // 프로세트: 목표 게임 -1에 도달하고 리드 중이면 매치포인트
  // 멀티세트: 세트포인트/매치포인트 분리
  const leading = currentG1 > currentG2 ? 1 : (currentG2 > currentG1 ? 2 : 0);
  const maxG = Math.max(currentG1, currentG2);
  const minG = Math.min(currentG1, currentG2);
  const isGameClose = maxG >= gamesTarget - 2 && maxG - minG <= 1;

  if (!isMultiSet) {
    // 프로세트: 매치포인트 = 목표-1 이상이고 리드
    if (maxG >= gamesTarget - 1 && leading > 0 && maxG > minG) {
      borderColor = 'border-red-500/80';
      glowClass = 'shadow-[0_0_25px_rgba(239,68,68,0.3)]';
      badge = `<span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-black bg-red-500 text-white rounded-full animate-pulse tracking-wider">MATCH POINT</span>`;
      progressBarColor = 'bg-red-500 animate-pulse';
    } else if (isGameClose) {
      borderColor = 'border-yellow-500/60';
      badge = `<span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-yellow-500/80 text-black rounded-full">접전</span>`;
      progressBarColor = 'bg-yellow-500';
    }
  } else {
    // 멀티세트
    const setsToWin = scoringType === 'set3' ? 2 : 2;
    const isMatchPointSet = (setsWon1 === setsToWin - 1 || setsWon2 === setsToWin - 1);
    if (isMatchPointSet && maxG >= 5 && leading > 0 && maxG > minG) {
      borderColor = 'border-red-500/80';
      glowClass = 'shadow-[0_0_25px_rgba(239,68,68,0.3)]';
      badge = `<span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-black bg-red-500 text-white rounded-full animate-pulse tracking-wider">MATCH POINT</span>`;
      progressBarColor = 'bg-red-500 animate-pulse';
    } else if (maxG >= 5 && leading > 0 && maxG > minG) {
      borderColor = 'border-orange-500/60';
      badge = `<span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-orange-500/80 text-white rounded-full">SET POINT</span>`;
      progressBarColor = 'bg-orange-500';
    } else if (isGameClose) {
      borderColor = 'border-yellow-500/60';
      badge = `<span class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-yellow-500/80 text-black rounded-full">접전</span>`;
      progressBarColor = 'bg-yellow-500';
    }
  }

  const eventInfo = m.event_name || '';
  const roundInfo = m.round ? `R${m.round}` : '';
  const progress = Math.min(maxG / gamesTarget * 100, 100);

  // 세트 스코어 라벨 (프로세트는 포맷명, 멀티세트는 세트 점수)
  let scoringLabel = '';
  if (scoringType === 'pro8') scoringLabel = '8게임 프로세트';
  else if (scoringType === 'pro10') scoringLabel = '10게임 프로세트';
  else if (scoringType === 'set2') scoringLabel = '2세트 선취';
  else if (scoringType === 'set3') scoringLabel = '3세트 매치';
  else scoringLabel = gamesTarget + '게임 목표';

  // 완료된 세트 점수 표시 (테이블 형태)
  let setScoreRow = '';
  if (isMultiSet && completedSets.length > 0) {
    const setCells = completedSets.map((s, i) => {
      const t1Won = s.t1 > s.t2;
      return `<div class="flex flex-col items-center px-2">
        <span class="text-[9px] text-gray-600 font-bold mb-0.5">S${i+1}</span>
        <span class="text-xs font-bold ${t1Won ? 'text-emerald-400' : 'text-gray-500'}">${s.t1}</span>
        <span class="text-xs font-bold ${!t1Won ? 'text-emerald-400' : 'text-gray-500'}">${s.t2}</span>
      </div>`;
    }).join('');
    setScoreRow = `<div class="flex items-center justify-center gap-1 border-l border-white/10 ml-2 pl-2">${setCells}</div>`;
  }

  return `
    <div class="relative bg-gradient-to-br from-gray-800 via-emerald-950/20 to-gray-900 rounded-2xl border-2 ${borderColor} ${glowClass} p-4 flex flex-col transition-all duration-500 overflow-hidden">
      ${badge}
      <!-- 코트 번호 + 상태 -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm">${cn}</span>
          <span class="text-xs font-bold text-emerald-400 tracking-wider">🎾 경기중</span>
          ${isMultiSet ? `<span class="text-[10px] text-gray-500 font-bold ml-1">세트 ${currentSetNum}</span>` : ''}
        </div>
        <div class="text-[10px] text-gray-500 text-right leading-tight">
          ${eventInfo ? `<div>${eventInfo}</div>` : ''}
          ${roundInfo ? `<div>${roundInfo} #${m.match_order || ''}</div>` : ''}
        </div>
      </div>

      <!-- 테니스 스코어보드 -->
      <div class="flex-1 flex flex-col justify-center">
        <div class="flex items-stretch">
          <!-- 메인 스코어 (현재 게임 수) -->
          <div class="flex-1">
            <!-- 선수1 -->
            <div class="flex items-center justify-between mb-1.5 py-1 px-2 rounded-lg ${currentG1 > currentG2 ? 'bg-emerald-500/10' : ''}">
              <div class="flex items-center flex-1 min-w-0 mr-2">
                ${isMultiSet ? `<span class="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center mr-1.5">${setsWon1}</span>` : ''}
                <span class="text-sm font-bold text-white truncate" title="${m.team1_name||''}">${truncateName(m.team1_name||'팀1', isMultiSet ? 7 : 10)}</span>
              </div>
              <span class="text-3xl lg:text-4xl font-black ${currentG1 > currentG2 ? 'text-emerald-300' : 'text-gray-400'} tabular-nums min-w-[2ch] text-right">${currentG1}</span>
            </div>
            
            <!-- 구분선 -->
            <div class="flex items-center gap-2 my-0.5 px-2">
              <div class="flex-1 h-px bg-emerald-500/20"></div>
              <span class="text-[10px] text-emerald-700 font-bold">VS</span>
              <div class="flex-1 h-px bg-emerald-500/20"></div>
            </div>

            <!-- 선수2 -->
            <div class="flex items-center justify-between mt-1.5 py-1 px-2 rounded-lg ${currentG2 > currentG1 ? 'bg-emerald-500/10' : ''}">
              <div class="flex items-center flex-1 min-w-0 mr-2">
                ${isMultiSet ? `<span class="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center mr-1.5">${setsWon2}</span>` : ''}
                <span class="text-sm font-bold text-white truncate" title="${m.team2_name||''}">${truncateName(m.team2_name||'팀2', isMultiSet ? 7 : 10)}</span>
              </div>
              <span class="text-3xl lg:text-4xl font-black ${currentG2 > currentG1 ? 'text-emerald-300' : 'text-gray-400'} tabular-nums min-w-[2ch] text-right">${currentG2}</span>
            </div>
          </div>

          <!-- 완료된 세트 점수 (멀티세트일 때만) -->
          ${setScoreRow}
        </div>
      </div>

      <!-- 프로그레스 바 -->
      <div class="mt-3">
        ${renderCourtTimeline(m, gamesTarget, true)}
      </div>
    </div>`;
}

// --- 경기 종료 결과 카드 (전환 애니메이션) ---
function renderDashboardCardResult(cn, prevState, isTen) {
  const r = prevState.recent || prevState.match;
  if (!r) return renderDashboardCardEmpty(cn, 0, null);
  
  if (isTen) {
    return renderDashboardCardResultTennis(cn, prevState, r);
  }
  return renderDashboardCardResultBadminton(cn, prevState, r);
}

// --- 배드민턴 결과 카드 ---
function renderDashboardCardResultBadminton(cn, prevState, r) {
  const s1 = r.team1_set1 || 0;
  const s2 = r.team2_set1 || 0;
  const winnerName = r.winner_name || (s1 > s2 ? r.team1_name : r.team2_name) || '?';
  const elapsed = Date.now() - prevState.timestamp;
  const fadeClass = elapsed > 6000 ? 'opacity-70' : 'opacity-100';

  return `
    <div class="relative bg-gradient-to-br from-yellow-900/30 to-amber-900/20 rounded-2xl border-2 border-yellow-500/50 p-4 flex flex-col transition-all duration-700 ${fadeClass} overflow-hidden">
      <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M20%200L40%2020L20%2040L0%2020Z%22%20fill%3D%22%23fbbf24%22%20fill-opacity%3D%220.03%22%2F%3E%3C%2Fsvg%3E')] opacity-50"></div>
      <div class="flex items-center justify-between mb-2 relative z-10">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-black text-sm">${cn}</span>
          <span class="text-xs font-bold text-yellow-400 tracking-wider">🏸 경기 종료</span>
        </div>
        <span class="text-lg">🏆</span>
      </div>
      <div class="flex-1 flex flex-col justify-center items-center relative z-10 py-2">
        <div class="text-[10px] text-yellow-500/70 font-bold mb-1 tracking-widest">WINNER</div>
        <div class="text-base lg:text-lg font-black text-yellow-300 text-center leading-tight mb-2">${winnerName}</div>
        <div class="flex items-center gap-3 text-2xl font-black">
          <span class="${s1 > s2 ? 'text-yellow-300' : 'text-gray-500'}">${s1}</span>
          <span class="text-gray-600 text-sm">:</span>
          <span class="${s2 > s1 ? 'text-yellow-300' : 'text-gray-500'}">${s2}</span>
        </div>
        <div class="text-[10px] text-gray-500 mt-1">${r.event_name || ''}</div>
      </div>
      <div class="mt-2 relative z-10">
        <div class="h-1 rounded-full bg-yellow-900/50 overflow-hidden">
          <div class="h-full rounded-full bg-yellow-500/60 transition-all duration-1000" style="width:${Math.min(((Date.now() - prevState.timestamp) / 8000) * 100, 100)}%"></div>
        </div>
        <div class="text-[10px] text-gray-600 mt-1 text-center">다음 경기로 전환 중...</div>
      </div>
    </div>`;
}

// --- 테니스 결과 카드 ---
function renderDashboardCardResultTennis(cn, prevState, r) {
  const g1s1 = r.team1_set1 || 0, g2s1 = r.team2_set1 || 0;
  const g1s2 = r.team1_set2 || 0, g2s2 = r.team2_set2 || 0;
  const g1s3 = r.team1_set3 || 0, g2s3 = r.team2_set3 || 0;
  
  const winnerName = r.winner_name || (g1s1 > g2s1 ? r.team1_name : r.team2_name) || '?';
  const elapsed = Date.now() - prevState.timestamp;
  const fadeClass = elapsed > 6000 ? 'opacity-70' : 'opacity-100';

  // 세트 스코어 빌드
  const allSets = [];
  allSets.push({ t1: g1s1, t2: g2s1 });
  if (g1s2 > 0 || g2s2 > 0) allSets.push({ t1: g1s2, t2: g2s2 });
  if (g1s3 > 0 || g2s3 > 0) allSets.push({ t1: g1s3, t2: g2s3 });

  const isMultiSet = allSets.length > 1;
  
  // 세트 점수 표시
  let scoreDisplay = '';
  if (isMultiSet) {
    const setCells = allSets.map((s, i) => {
      const t1Won = s.t1 > s.t2;
      return `<div class="flex flex-col items-center">
        <span class="text-[9px] text-emerald-700 font-bold mb-0.5">S${i+1}</span>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-black ${t1Won ? 'text-emerald-300' : 'text-gray-500'} tabular-nums">${s.t1}</span>
          <span class="text-sm font-black ${!t1Won ? 'text-emerald-300' : 'text-gray-500'} tabular-nums">${s.t2}</span>
        </div>
      </div>`;
    }).join('');
    scoreDisplay = `
      <div class="flex items-center gap-3 mb-1">
        <div class="flex flex-col items-end mr-1 text-[10px]">
          <span class="text-gray-400 mb-0.5 h-[14px]"></span>
          <span class="font-bold text-white text-xs leading-tight">${truncateName(r.team1_name||'팀1', 6)}</span>
          <span class="font-bold text-white text-xs leading-tight mt-0.5">${truncateName(r.team2_name||'팀2', 6)}</span>
        </div>
        ${setCells}
      </div>`;
  } else {
    scoreDisplay = `
      <div class="flex items-center gap-3 text-2xl font-black">
        <span class="${g1s1 > g2s1 ? 'text-emerald-300' : 'text-gray-500'}">${g1s1}</span>
        <span class="text-emerald-800 text-sm">:</span>
        <span class="${g2s1 > g1s1 ? 'text-emerald-300' : 'text-gray-500'}">${g2s1}</span>
      </div>`;
  }

  return `
    <div class="relative bg-gradient-to-br from-emerald-900/30 to-teal-900/20 rounded-2xl border-2 border-emerald-500/50 p-4 flex flex-col transition-all duration-700 ${fadeClass} overflow-hidden">
      <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%228%22%20fill%3D%22none%22%20stroke%3D%22%2310b981%22%20stroke-opacity%3D%220.04%22%20stroke-width%3D%221.5%22%2F%3E%3C%2Fsvg%3E')] opacity-50"></div>
      <div class="flex items-center justify-between mb-2 relative z-10">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm">${cn}</span>
          <span class="text-xs font-bold text-emerald-400 tracking-wider">🎾 경기 종료</span>
        </div>
        <span class="text-lg">🏆</span>
      </div>
      <div class="flex-1 flex flex-col justify-center items-center relative z-10 py-2">
        <div class="text-[10px] text-emerald-500/70 font-bold mb-1 tracking-widest">WINNER</div>
        <div class="text-base lg:text-lg font-black text-emerald-300 text-center leading-tight mb-2">${winnerName}</div>
        ${scoreDisplay}
        <div class="text-[10px] text-gray-500 mt-1">${r.event_name || ''}</div>
      </div>
      <div class="mt-2 relative z-10">
        <div class="h-1 rounded-full bg-emerald-900/50 overflow-hidden">
          <div class="h-full rounded-full bg-emerald-500/60 transition-all duration-1000" style="width:${Math.min(((Date.now() - prevState.timestamp) / 8000) * 100, 100)}%"></div>
        </div>
        <div class="text-[10px] text-gray-600 mt-1 text-center">다음 경기로 전환 중...</div>
      </div>
    </div>`;
}

// --- 다음 경기 대기 카드 ---
function renderDashboardCardNext(cn, next, pending, isTen) {
  const accentColor = isTen ? 'emerald' : 'blue';
  const sportEmoji = isTen ? '🎾' : '🏸';
  return `
    <div class="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-${accentColor}-500/30 p-4 flex flex-col overflow-hidden">
      <!-- 코트 번호 -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl bg-${accentColor}-500/20 flex items-center justify-center text-${accentColor}-400 font-black text-sm">${cn}</span>
          <span class="text-xs font-bold text-${accentColor}-400 tracking-wider">${sportEmoji} 다음 경기</span>
        </div>
        <span class="px-2 py-0.5 bg-${accentColor}-500/10 text-${accentColor}-400 text-[10px] rounded-full font-bold">
          대기 ${pending}경기
        </span>
      </div>

      <!-- 다음 선수 정보 -->
      <div class="flex-1 flex flex-col justify-center">
        <div class="text-center mb-3">
          <div class="text-[10px] text-gray-500 font-bold tracking-widest mb-2">NEXT MATCH</div>
          <div class="text-sm lg:text-base font-bold text-white leading-relaxed">
            ${truncateName(next.team1_name || 'TBD', 12)}
          </div>
          <div class="text-xs text-gray-500 font-bold my-1">VS</div>
          <div class="text-sm lg:text-base font-bold text-white leading-relaxed">
            ${truncateName(next.team2_name || 'TBD', 12)}
          </div>
        </div>
        <div class="text-center">
          <span class="inline-block px-2 py-0.5 bg-white/5 rounded-md text-[10px] text-gray-400">
            ${next.event_name || ''} ${next.round ? 'R' + next.round : ''}
          </span>
        </div>
      </div>

      <!-- 호출 알림 -->
      <div class="mt-3 py-2 bg-${accentColor}-500/10 rounded-xl text-center">
        <span class="text-xs text-${accentColor}-300 font-bold">
          <i class="fas fa-bullhorn mr-1"></i>선수 호출 대기중
        </span>
      </div>
    </div>`;
}

// --- 빈 코트 카드 ---
function renderDashboardCardEmpty(cn, pending, recent, isTen) {
  const sportEmoji = isTen ? '🎾' : '🏸';
  let recentInfo = '';
  if (recent) {
    if (isTen) {
      // 테니스: 세트 스코어로 최근 결과 표시
      const sets = [];
      sets.push(`${recent.team1_set1||0}-${recent.team2_set1||0}`);
      if (recent.team1_set2 || recent.team2_set2) sets.push(`${recent.team1_set2||0}-${recent.team2_set2||0}`);
      if (recent.team1_set3 || recent.team2_set3) sets.push(`${recent.team1_set3||0}-${recent.team2_set3||0}`);
      recentInfo = `
        <div class="mt-2 text-center">
          <div class="text-[10px] text-gray-600 mb-1">최근 결과</div>
          <div class="text-xs text-gray-500">${truncateName(recent.team1_name||'',8)} vs ${truncateName(recent.team2_name||'',8)}</div>
          <div class="text-[10px] text-emerald-600 mt-0.5 font-bold">${sets.join(' / ')}</div>
          ${recent.winner_name ? `<div class="text-[10px] text-emerald-500 mt-0.5">🏆 ${recent.winner_name}</div>` : ''}
        </div>`;
    } else {
      recentInfo = `
        <div class="mt-2 text-center">
          <div class="text-[10px] text-gray-600 mb-1">최근 결과</div>
          <div class="text-xs text-gray-500">${truncateName(recent.team1_name||'',8)} ${recent.team1_set1||0}:${recent.team2_set1||0} ${truncateName(recent.team2_name||'',8)}</div>
          ${recent.winner_name ? `<div class="text-[10px] text-yellow-600 mt-0.5">🏆 ${recent.winner_name}</div>` : ''}
        </div>`;
    }
  }

  return `
    <div class="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border-2 border-gray-700/30 p-4 flex flex-col overflow-hidden opacity-60">
      <!-- 코트 번호 -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl bg-gray-700/50 flex items-center justify-center text-gray-500 font-black text-sm">${cn}</span>
          <span class="text-xs font-bold text-gray-600 tracking-wider">${pending > 0 ? '배정 대기' : '운영 종료'}</span>
        </div>
      </div>

      <!-- 중앙 -->
      <div class="flex-1 flex flex-col justify-center items-center py-4">
        <i class="fas ${pending > 0 ? 'fa-hourglass-half text-gray-600' : 'fa-check-circle text-gray-700'} text-3xl mb-2"></i>
        <span class="text-sm text-gray-600 font-bold">${pending > 0 ? `${pending}경기 대기중` : '경기 없음'}</span>
        ${recentInfo}
      </div>
    </div>`;
}

// 이름 자르기 유틸
function truncateName(name, maxLen) {
  if (!name) return '';
  return name.length > maxLen ? name.substring(0, maxLen) + '…' : name;
}

function exitCourt() {
  // 잠금 모드에서는 나가기 불가
  if (courtState.locked) {
    showCourtToast('이 코트는 잠금 모드입니다. URL 파라미터에서 locked=1을 제거하세요.', 'warning');
    return;
  }
  if (courtState.currentMatch && courtState.page === 'court') {
    if (!confirm('진행중인 경기가 있습니다. 나가시겠습니까? (점수는 저장됩니다)')) return;
    saveCurrentScore();
  }
  // 코트 선택 화면으로 돌아가기 (대회는 유지)
  courtState.courtNumber = null;
  courtState.currentMatch = null;
  courtState.score = { left: 0, right: 0 };
  courtState.leftTeam = 1;
  courtState.rightTeam = 2;
  courtState.swapped = false;
  courtState.swapDone = false;
  courtState.swapPending = false;
  courtState.page = 'select';
  actionHistory = [];
  
  const url = new URL(window.location);
  url.searchParams.delete('court');
  window.history.pushState({}, '', url);
  renderCourt();
  loadCourtGrid();
}

// 대회 선택 화면으로 완전히 돌아가기
function exitToHome() {
  if (courtState.locked) {
    showCourtToast('이 코트는 잠금 모드입니다.', 'warning');
    return;
  }
  courtState.tournamentId = null;
  courtState.tournament = null;
  courtState.courtNumber = null;
  courtState.currentMatch = null;
  courtState.score = { left: 0, right: 0 };
  courtState.leftTeam = 1;
  courtState.rightTeam = 2;
  courtState.swapped = false;
  courtState.swapDone = false;
  courtState.swapPending = false;
  courtState.page = 'select';
  actionHistory = [];
  
  const url = new URL(window.location);
  url.searchParams.delete('court');
  url.searchParams.delete('tid');
  window.history.pushState({}, '', url);
  renderCourt();
  loadTournamentList();
}

// 사이드 선택에서 코트 대기화면으로 돌아가기
function goBackFromSideSelect() {
  courtState.page = 'court';
  courtState.leftTeam = 1;
  courtState.rightTeam = 2;
  renderCourt();
}

// ==========================================
// 자동 새로고침
// ==========================================
function startAutoRefresh() {
  if (courtState.autoRefreshTimer) clearInterval(courtState.autoRefreshTimer);
  courtState.autoRefreshTimer = setInterval(async () => {
    // 대기 화면에서 자동 새로고침
    if (courtState.page === 'court' && !courtState.currentMatch) {
      await refreshCourtData();
    }
    // 읽기 전용 모드에서는 진행중 경기도 자동 새로고침 (점수 표시 업데이트)
    if (courtState.readOnly && courtState.page === 'court' && courtState.currentMatch) {
      try {
        const data = await courtApi(`/tournaments/${courtState.tournamentId}/court/${courtState.courtNumber}`);
        if (data.current_match) {
          const m = data.current_match;
          courtState.currentMatch = m;
          courtState.score = { left: m.team1_set1 || 0, right: m.team2_set1 || 0 };
          renderCourt();
        } else {
          courtState.currentMatch = null;
          courtState.nextMatches = data.next_matches;
          courtState.recentMatches = data.recent_matches;
          courtState.page = 'court';
          renderCourt();
        }
      } catch(e) {}
    }
  }, courtState.readOnly ? 1500 : 5000);
}

// ==========================================
// 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  parseUrlParams();
  
  if (courtState.tournamentId && courtState.courtNumber) {
    refreshCourtData();
  } else if (courtState.tournamentId && courtState.readOnly) {
    // tid만 있고 court 없이 mode=view → 대형 전광판 대시보드
    courtState.page = 'dashboard';
    selectTournament(parseInt(courtState.tournamentId)).then(() => {
      courtState.page = 'dashboard';
      renderCourt();
      startDashboardRefresh();
    });
  } else if (courtState.tournamentId) {
    selectTournament(parseInt(courtState.tournamentId));
  } else {
    renderCourt();
    loadTournamentList();
  }
  
  startAutoRefresh();
  // 대시보드용 스폰서 배너 로드
  loadSponsorBanners();
});

// ==========================================
// 득점 파티클 애니메이션 시스템
// ==========================================
function spawnScoreParticles(side, isSpecial) {
  const container = document.createElement('div');
  container.className = 'particle-container';
  document.body.appendChild(container);

  const colors = isSpecial 
    ? ['#fbbf24','#f59e0b','#ef4444','#ec4899','#8b5cf6','#3b82f6']
    : ['#60a5fa','#34d399','#fbbf24','#f472b6'];
  
  const rect = document.getElementById(side + '-zone');
  const cx = rect ? rect.getBoundingClientRect().left + rect.getBoundingClientRect().width/2 : window.innerWidth/2;
  const cy = rect ? rect.getBoundingClientRect().top + rect.getBoundingClientRect().height/2 : window.innerHeight/2;

  const count = isSpecial ? 40 : 15;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (Math.PI * 2 * i) / count + (Math.random()-0.5)*0.5;
    const dist = 60 + Math.random() * (isSpecial ? 180 : 100);
    const size = 4 + Math.random() * (isSpecial ? 10 : 6);
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${cx}px;top:${cy}px;
      background:${colors[i % colors.length]};
      --px:${Math.cos(angle)*dist}px;
      --py:${Math.sin(angle)*dist}px;
      animation-duration:${0.5 + Math.random()*0.5}s;
      animation-delay:${Math.random()*0.1}s;
    `;
    container.appendChild(p);
  }
  setTimeout(() => container.remove(), 1500);
}

function spawnConfetti() {
  const container = document.createElement('div');
  container.className = 'particle-container';
  document.body.appendChild(container);
  const colors = ['#fbbf24','#ef4444','#3b82f6','#22c55e','#ec4899','#8b5cf6','#f97316'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    const shape = Math.random() > 0.5 ? '50%' : '2px';
    c.style.cssText = `
      left:${Math.random()*100}%;
      width:${6+Math.random()*6}px;
      height:${6+Math.random()*6}px;
      background:${colors[i%colors.length]};
      border-radius:${shape};
      animation-delay:${Math.random()*1}s;
      animation-duration:${1.5+Math.random()*1.5}s;
    `;
    container.appendChild(c);
  }
  setTimeout(() => container.remove(), 4000);
}

function spawnFireworks(cx, cy) {
  const container = document.createElement('div');
  container.className = 'particle-container';
  document.body.appendChild(container);
  const colors = ['rgba(251,191,36,0.8)','rgba(239,68,68,0.8)','rgba(59,130,246,0.8)','rgba(34,197,94,0.8)'];
  for (let burst = 0; burst < 3; burst++) {
    const bx = cx + (Math.random()-0.5)*200;
    const by = cy + (Math.random()-0.5)*100;
    setTimeout(() => {
      for (let i = 0; i < 20; i++) {
        const spark = document.createElement('div');
        const angle = (Math.PI*2*i)/20;
        const dist = 40 + Math.random()*80;
        spark.style.cssText = `
          position:absolute;
          left:${bx}px;top:${by}px;
          width:4px;height:4px;
          border-radius:50%;
          --fw-x:${Math.cos(angle)*dist}px;
          --fw-y:${Math.sin(angle)*dist}px;
          --fw-color:${colors[burst%colors.length]};
          animation:firework 0.8s ease-out forwards;
          animation-delay:${Math.random()*0.2}s;
        `;
        container.appendChild(spark);
      }
    }, burst * 300);
  }
  setTimeout(() => container.remove(), 3000);
}

// ==========================================
// 스폰서 배너 시스템
// ==========================================
let sponsorBanners = [];
let sponsorBannerIndex = 0;
let sponsorBannerTimer = null;

async function loadSponsorBanners() {
  if (!courtState.tournamentId) return;
  try {
    const data = await courtApi('/tournaments/' + courtState.tournamentId + '/sponsors');
    sponsorBanners = data || [];
    if (sponsorBanners.length > 0) startSponsorBannerRotation();
  } catch(e) { /* 스폰서 없으면 무시 */ }
}

function startSponsorBannerRotation() {
  if (sponsorBannerTimer) clearInterval(sponsorBannerTimer);
  if (sponsorBanners.length === 0) return;
  sponsorBannerIndex = 0;
  sponsorBannerTimer = setInterval(() => {
    sponsorBannerIndex = (sponsorBannerIndex + 1) % sponsorBanners.length;
    updateSponsorBannerDisplay();
  }, 6000);
}

function updateSponsorBannerDisplay() {
  const els = document.querySelectorAll('.sponsor-banner-slot');
  els.forEach(el => {
    if (sponsorBanners.length === 0) { el.innerHTML = ''; return; }
    const s = sponsorBanners[sponsorBannerIndex];
    const link = s.link_url ? `onclick="window.open('${s.link_url}','_blank')" style="cursor:pointer"` : '';
    el.innerHTML = `<div class="sponsor-banner-item flex items-center justify-center gap-2 h-full" ${link}>
      <img src="${s.image_url}" alt="${s.name}" class="h-6 max-w-[120px] object-contain opacity-70">
      <span class="text-xs text-white/40 font-medium">${s.name}</span>
    </div>`;
  });
}

function renderSponsorBannerSlot() {
  if (sponsorBanners.length === 0) return '';
  const s = sponsorBanners[sponsorBannerIndex % sponsorBanners.length];
  return `<div class="sponsor-banner sponsor-banner-slot rounded-lg px-3 py-1.5 flex items-center justify-center" style="min-height:32px;">
    <div class="sponsor-banner-item flex items-center justify-center gap-2 h-full">
      <img src="${s.image_url}" alt="${s.name}" class="h-5 max-w-[100px] object-contain opacity-70">
      <span class="text-[10px] text-white/40 font-medium">${s.name}</span>
    </div>
  </div>`;
}

// ==========================================
// 대시보드 코트 타임라인 바
// ==========================================
function renderCourtTimeline(m, targetScore, isTen) {
  if (!m) return '';
  let progress = 0;
  let label = '';
  
  if (isTen) {
    const s1 = m.team1_set1 || 0;
    const s2 = m.team2_set1 || 0;
    const maxG = Math.max(s1, s2, 1);
    progress = Math.min((maxG / targetScore) * 100, 100);
    label = Math.max(s1,s2) + '/' + targetScore + ' 게임';
  } else {
    const s1 = m.team1_set1 || 0;
    const s2 = m.team2_set1 || 0;
    const maxS = Math.max(s1, s2, 1);
    progress = Math.min((maxS / targetScore) * 100, 100);
    label = Math.max(s1,s2) + '/' + targetScore + '점';
  }
  
  const colorClass = progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-yellow-500' : isTen ? 'bg-emerald-500' : 'bg-blue-500';
  
  return `<div class="mt-2">
    <div class="flex justify-between items-center mb-1">
      <span class="text-[10px] text-gray-500">${label}</span>
      <span class="text-[10px] font-bold ${progress >= 90 ? 'text-red-400' : 'text-gray-400'}">${Math.round(progress)}%</span>
    </div>
    <div class="timeline-bar">
      <div class="timeline-bar-fill ${colorClass}" style="width:${progress}%"></div>
    </div>
  </div>`;
}
