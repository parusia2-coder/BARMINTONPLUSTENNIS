// ==========================================
// 스마트워치 전용 점수판 v2.0 - Watch Scoreboard
// 원형 화면 최적화 (~360x360px)
// 테니스 완전 지원 (포인트→게임→세트, 타이브레이크, 듀스, 서브)
// 배드민턴 완전 지원 (KDK 교체, 목표점수)
// 네트워크 상태/화면 잠금/오프라인 큐
// ==========================================
var API = '/api';

// ==========================================
// 글로벌 상태
// ==========================================
var watchState = {
  page: 'loading',     // loading | tournaments | courts | waiting | scoreboard | finished | error
  tournaments: [],
  tournamentId: null,
  tournamentName: '',
  sport: 'badminton',
  courtNumber: null,
  courts: 0,
  currentMatch: null,
  nextMatches: [],
  recentMatches: [],

  // 배드민턴 점수
  score: { left: 0, right: 0 },
  leftTeam: 1,
  rightTeam: 2,
  targetScore: 21,
  format: 'kdk',
  swapDone: false,
  swapPending: false,

  // 테니스 전용 상태
  tennis: {
    point: { left: 0, right: 0 },
    games: { left: 0, right: 0 },
    tiebreak: false,
    tbPoint: { left: 0, right: 0 },
    deuceRule: 'tiebreak',
    lastSwapGames: 0,
    serving: 'left',
    initialServer: 'left',
    setFormat: 'pro8',
    currentSet: 1,
    sets: [],
    setsToWin: 1,
    gamesPerSet: 8,
    finalSetTiebreak: true
  },

  actionHistory: [],
  autoRefreshTimer: null,
  autoSaveTimer: null,
  readOnly: false,

  // 네트워크 & Wake Lock
  networkOk: true,
  offlineQueue: [],
  wakeLock: null,

  vibrate: function(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {}
  }
};

// 테니스 판별
function isTennis() {
  return watchState.sport === 'tennis';
}

// 테니스 포인트 라벨
var TENNIS_POINTS = ['0', '15', '30', '40'];
function tennisPointLabel(pt) {
  return pt < 4 ? TENNIS_POINTS[pt] : pt.toString();
}

// 테니스 포인트 디스플레이
function getTennisPointDisplay(side) {
  var t = watchState.tennis;
  if (t.tiebreak) return t.tbPoint[side].toString();
  var pL = t.point.left;
  var pR = t.point.right;
  if (pL >= 3 && pR >= 3) {
    if (t.deuceRule === 'noad') {
      return side === 'left' ? (pL > pR ? 'AD' : '40') : (pR > pL ? 'AD' : '40');
    }
    if (pL === pR) return '40';
    if (side === 'left') return pL > pR ? 'AD' : '40';
    return pR > pL ? 'AD' : '40';
  }
  return TENNIS_POINTS[t.point[side]] || '0';
}

// 테니스 상태 라벨
function getTennisStatusLabel() {
  var t = watchState.tennis;
  if (t.tiebreak) return 'TB';
  var pL = t.point.left;
  var pR = t.point.right;
  if (pL >= 3 && pR >= 3 && pL === pR) return 'DEUCE';
  if (pL >= 3 && pR >= 3 && Math.abs(pL - pR) === 1) return 'AD';
  return '';
}

// ==========================================
// API 통신
// ==========================================
async function wApi(path, options) {
  options = options || {};
  try {
    var res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    updateNetStatus(true);
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  } catch(e) {
    updateNetStatus(false);
    throw e;
  }
}

// 네트워크 상태 업데이트
function updateNetStatus(ok) {
  watchState.networkOk = ok;
  var el = document.getElementById('net');
  if (el) {
    el.className = 'net ' + (ok ? 'ok' : 'off');
  }
}

function showSaving() {
  var el = document.getElementById('net');
  if (el) el.className = 'net saving';
  setTimeout(function() {
    if (watchState.networkOk) {
      var el2 = document.getElementById('net');
      if (el2) el2.className = 'net ok';
    }
  }, 600);
}

// ==========================================
// Wake Lock (화면 꺼짐 방지)
// ==========================================
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      watchState.wakeLock = await navigator.wakeLock.request('screen');
      watchState.wakeLock.addEventListener('release', function() {
        watchState.wakeLock = null;
        updateWakeLockUI();
      });
      updateWakeLockUI();
    }
  } catch(e) { /* 실패 무시 */ }
}

function releaseWakeLock() {
  if (watchState.wakeLock) {
    watchState.wakeLock.release();
    watchState.wakeLock = null;
    updateWakeLockUI();
  }
}

function updateWakeLockUI() {
  var el = document.getElementById('wl');
  if (el) {
    el.className = 'wl ' + (watchState.wakeLock ? 'on' : 'off');
  }
}

// 페이지 다시 보일 때 Wake Lock 재획득
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && watchState.page === 'scoreboard') {
    requestWakeLock();
  }
});

// ==========================================
// 초기화
// ==========================================
async function init() {
  var params = new URLSearchParams(window.location.search);
  var tid = params.get('tid');
  var court = params.get('court');
  if (params.get('readonly') === '1' || params.get('mode') === 'view') {
    watchState.readOnly = true;
  }

  if (tid && court) {
    watchState.tournamentId = tid;
    watchState.courtNumber = parseInt(court);
    await loadCourtData();
  } else if (tid) {
    watchState.tournamentId = tid;
    await loadTournamentInfo();
  } else {
    await loadTournaments();
  }
}

// ==========================================
// 데이터 로딩
// ==========================================
async function loadTournaments() {
  try {
    var data = await wApi('/tournaments');
    watchState.tournaments = (data.tournaments || data || []).filter(function(t) { return !t.deleted; });
    watchState.page = 'tournaments';
    render();
  } catch(e) {
    showError('대회 목록 로드 실패');
  }
}

async function loadTournamentInfo() {
  try {
    var tid = watchState.tournamentId;
    var t = await wApi('/tournaments/' + tid);
    watchState.tournamentName = t.name || '';
    watchState.courts = t.courts || 4;
    watchState.sport = t.sport || 'badminton';
    watchState.page = 'courts';
    render();
  } catch(e) {
    showError('대회 정보 로드 실패');
  }
}

async function loadCourtData() {
  try {
    var tid = watchState.tournamentId;
    var cn = watchState.courtNumber;
    var data = await wApi('/tournaments/' + tid + '/court/' + cn);

    if (data.tournament) {
      watchState.tournamentName = data.tournament.name || '';
      watchState.sport = data.tournament.sport || 'badminton';
      watchState.format = data.tournament.format || 'kdk';

      // 테니스 설정 초기화
      if (isTennis()) {
        initTennisFromTournament(data.tournament);
      }
    }
    if (data.target_score) {
      watchState.targetScore = data.target_score;
      if (isTennis()) {
        watchState.tennis.gamesPerSet = data.target_score;
      }
    }

    // 다음 경기 / 최근 경기 저장
    watchState.nextMatches = data.next_matches || [];
    watchState.recentMatches = data.recent_matches || [];

    if (data.current_match) {
      var m = data.current_match;
      watchState.currentMatch = m;

      if (isTennis()) {
        // 테니스: DB에서 게임 수 복원
        restoreTennisScore(m);
      } else {
        // 배드민턴: 기존 점수 복원
        watchState.score.left = (watchState.leftTeam === 1) ? (m.team1_set1 || 0) : (m.team2_set1 || 0);
        watchState.score.right = (watchState.leftTeam === 1) ? (m.team2_set1 || 0) : (m.team1_set1 || 0);
      }
      watchState.page = 'scoreboard';
      requestWakeLock();
    } else {
      watchState.currentMatch = null;
      watchState.page = 'waiting';
      releaseWakeLock();
      startAutoRefresh();
    }
    render();
  } catch(e) {
    showError('코트 데이터 로드 실패');
  }
}

// 테니스 대회 설정 초기화
function initTennisFromTournament(tournament) {
  var t = watchState.tennis;
  t.deuceRule = tournament.deuce_rule || 'tiebreak';
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
  watchState.targetScore = t.gamesPerSet;
}

// 테니스 점수 복원 (DB에서)
function restoreTennisScore(m) {
  var t = watchState.tennis;
  // DB의 set1에는 현재 게임 수 (프로세트) 또는 세트 수 (멀티세트)
  var t1s1 = m.team1_set1 || 0;
  var t2s1 = m.team2_set1 || 0;

  if (t.setsToWin === 1) {
    // 프로세트: team1_set1 = team1 게임 수
    t.games.left = (watchState.leftTeam === 1) ? t1s1 : t2s1;
    t.games.right = (watchState.leftTeam === 1) ? t2s1 : t1s1;
  } else {
    // 멀티세트: set별 복원
    var sets = [];
    if (m.team1_set1 || m.team2_set1) sets.push({ left: (watchState.leftTeam === 1 ? m.team1_set1 : m.team2_set1) || 0, right: (watchState.leftTeam === 1 ? m.team2_set1 : m.team1_set1) || 0 });
    if (m.team1_set2 || m.team2_set2) sets.push({ left: (watchState.leftTeam === 1 ? m.team1_set2 : m.team2_set2) || 0, right: (watchState.leftTeam === 1 ? m.team2_set2 : m.team1_set2) || 0 });
    // 마지막 세트는 현재 진행 중일 수 있음
    if (sets.length > 0) {
      var last = sets[sets.length - 1];
      // 완료된 세트인지 확인
      if (checkSetWinWatch(last.left, last.right)) {
        t.sets = sets;
        t.currentSet = sets.length + 1;
        t.games = { left: 0, right: 0 };
      } else {
        t.sets = sets.slice(0, -1);
        t.currentSet = sets.length;
        t.games = { left: last.left, right: last.right };
      }
    } else {
      t.games = { left: 0, right: 0 };
    }
  }
  // 포인트는 DB에 없으므로 0으로 시작
  t.point = { left: 0, right: 0 };
  t.tiebreak = false;
  t.tbPoint = { left: 0, right: 0 };
  // 동기화
  watchState.score.left = t.games.left;
  watchState.score.right = t.games.right;
}

// 세트 승리 체크 (워치용)
function checkSetWinWatch(gL, gR) {
  var t = watchState.tennis;
  if (t.setFormat === 'pro8' || t.setFormat === 'pro10') {
    return (gL >= t.gamesPerSet && gL - gR >= 2) || (gR >= t.gamesPerSet && gR - gL >= 2);
  }
  if (gL >= 6 && gL - gR >= 2) return true;
  if (gR >= 6 && gR - gL >= 2) return true;
  if ((gL === 7 && gR === 6) || (gR === 7 && gL === 6)) return true;
  return false;
}

// 타이브레이크 진입 체크
function checkTiebreakEntry(gL, gR) {
  var t = watchState.tennis;
  if (t.setFormat === 'pro8' || t.setFormat === 'pro10') {
    return gL === t.gamesPerSet - 1 && gR === t.gamesPerSet - 1;
  }
  return gL === 6 && gR === 6;
}

function startAutoRefresh() {
  stopAutoRefresh();
  watchState.autoRefreshTimer = setInterval(function() {
    loadCourtData();
  }, 8000);
}

function stopAutoRefresh() {
  if (watchState.autoRefreshTimer) {
    clearInterval(watchState.autoRefreshTimer);
    watchState.autoRefreshTimer = null;
  }
}

// ==========================================
// 테니스 서브 관리
// ==========================================
function tennisToggleServe() {
  var t = watchState.tennis;
  t.serving = t.serving === 'left' ? 'right' : 'left';
}

function tennisTiebreakServeCheck() {
  var t = watchState.tennis;
  var totalTB = t.tbPoint.left + t.tbPoint.right;
  if (totalTB === 1 || (totalTB > 1 && totalTB % 2 === 1)) {
    tennisToggleServe();
  }
}

// ==========================================
// 테니스 포인트 득점
// ==========================================
function tennisScorePoint(side) {
  var t = watchState.tennis;
  var otherSide = side === 'left' ? 'right' : 'left';

  // 히스토리 저장
  watchState.actionHistory.push({
    type: 'tennis_point',
    snapshot: JSON.parse(JSON.stringify({
      point: t.point, games: t.games, tiebreak: t.tiebreak,
      tbPoint: t.tbPoint, serving: t.serving, lastSwapGames: t.lastSwapGames,
      currentSet: t.currentSet, sets: t.sets,
      score: watchState.score, swapDone: watchState.swapDone
    }))
  });

  // 타이브레이크 모드
  if (t.tiebreak) {
    t.tbPoint[side]++;
    var myTB = t.tbPoint[side];
    var otherTB = t.tbPoint[otherSide];
    tennisTiebreakServeCheck();
    if (myTB >= 7 && myTB - otherTB >= 2) {
      t.games[side]++;
      tennisToggleServe();
      tennisGameWon(side);
      return;
    }
    watchState.vibrate(30);
    autoSave();
    render();
    return;
  }

  // 일반 게임 포인트
  t.point[side]++;
  var myPt = t.point[side];
  var otherPt = t.point[otherSide];

  var gameWon = false;
  if (t.deuceRule === 'noad' && myPt >= 3 && otherPt >= 3) {
    if (myPt > otherPt) gameWon = true;
  } else if (myPt >= 4 && myPt - otherPt >= 2) {
    gameWon = true;
  } else if (myPt >= 4 && otherPt < 3) {
    gameWon = true;
  }

  if (gameWon) {
    t.games[side]++;
    t.point.left = 0;
    t.point.right = 0;
    tennisToggleServe();
    tennisGameWon(side);
    return;
  }

  watchState.vibrate(30);
  autoSave();
  render();
}

// 테니스 게임 획득 처리
function tennisGameWon(side) {
  var t = watchState.tennis;
  var target = t.gamesPerSet;
  var gL = t.games.left;
  var gR = t.games.right;

  watchState.score.left = t.games.left;
  watchState.score.right = t.games.right;

  var setLabel = t.setsToWin > 1 ? ' [S' + t.currentSet + ']' : '';
  showToast('🎾 ' + gL + '-' + gR + setLabel);
  watchState.vibrate([50, 30, 50]);

  // 체인지오버: 게임 합 홀수
  var totalGames = gL + gR;
  if (totalGames % 2 === 1 && totalGames > t.lastSwapGames && !t.tiebreak) {
    t.lastSwapGames = totalGames;
    // 자동 사이드 스왑
    var tmp = watchState.score.left;
    watchState.score.left = watchState.score.right;
    watchState.score.right = tmp;
    tmp = watchState.leftTeam;
    watchState.leftTeam = watchState.rightTeam;
    watchState.rightTeam = tmp;
    tmp = t.games.left;
    t.games.left = t.games.right;
    t.games.right = tmp;
    // 포인트도 스왑
    tmp = t.point.left;
    t.point.left = t.point.right;
    t.point.right = tmp;
    // 서브 방향도 스왑
    t.serving = t.serving === 'left' ? 'right' : 'left';
    // 세트 기록도 스왑
    for (var i = 0; i < t.sets.length; i++) {
      tmp = t.sets[i].left;
      t.sets[i].left = t.sets[i].right;
      t.sets[i].right = tmp;
    }

    watchState.vibrate([100, 50, 100]);
    showToast('⇄ 체인지오버');
  }

  // 세트 승리 체크
  gL = t.games.left;
  gR = t.games.right;
  if (checkSetWinWatch(gL, gR)) {
    var setWinner = gL > gR ? 'left' : 'right';
    t.sets.push({ left: gL, right: gR });

    var setsWonLeft = t.sets.filter(function(s) { return s.left > s.right; }).length;
    var setsWonRight = t.sets.filter(function(s) { return s.right > s.left; }).length;

    if (setsWonLeft >= t.setsToWin || setsWonRight >= t.setsToWin) {
      // 매치 종료!
      syncTennisScoreToDB();
      autoSave();
      var matchWinner = setsWonLeft >= t.setsToWin ? 'left' : 'right';
      watchState.vibrate([200, 100, 200, 100, 300]);
      setTimeout(function() {
        showFinishConfirm(matchWinner);
      }, 500);
      return;
    }

    // 다음 세트 시작
    showToast('세트 ' + t.currentSet + ' 종료 → 세트 ' + (t.currentSet + 1));
    t.currentSet++;
    t.games = { left: 0, right: 0 };
    t.point = { left: 0, right: 0 };
    t.tiebreak = false;
    t.tbPoint = { left: 0, right: 0 };
    t.lastSwapGames = 0;
    watchState.score.left = 0;
    watchState.score.right = 0;
    syncTennisScoreToDB();
    autoSave();
    render();
    return;
  }

  // 타이브레이크 진입
  gL = t.games.left;
  gR = t.games.right;
  if (checkTiebreakEntry(gL, gR) && !t.tiebreak) {
    t.tiebreak = true;
    t.tbPoint = { left: 0, right: 0 };
    showToast('🎯 TIEBREAK!');
    watchState.vibrate([100, 50, 100, 50, 100]);
  }

  syncTennisScoreToDB();
  autoSave();
  render();
}

// 테니스 세트→DB 동기화
function syncTennisScoreToDB() {
  var t = watchState.tennis;
  if (t.setsToWin === 1) {
    watchState.score.left = t.games.left;
    watchState.score.right = t.games.right;
    return;
  }
  watchState.score.left = t.sets.filter(function(s) { return s.left > s.right; }).length;
  watchState.score.right = t.sets.filter(function(s) { return s.right > s.left; }).length;
}

// 테니스 Undo
function tennisUndoPoint() {
  if (watchState.actionHistory.length === 0) {
    showToast('취소할 내역 없음');
    return;
  }
  var last = watchState.actionHistory.pop();
  if (last.type === 'tennis_point' && last.snapshot) {
    var s = last.snapshot;
    var t = watchState.tennis;
    t.point = s.point;
    t.games = s.games;
    t.tiebreak = s.tiebreak;
    t.tbPoint = s.tbPoint;
    t.serving = s.serving;
    t.lastSwapGames = s.lastSwapGames;
    t.currentSet = s.currentSet;
    t.sets = s.sets;
    watchState.score = s.score;
    watchState.swapDone = s.swapDone;
  }
  watchState.vibrate(20);
  autoSave();
  render();
  showToast('↩ 되돌리기');
}

// 테니스 -1 게임 (직접 게임 수 조정)
function tennisMinusGame(side) {
  var t = watchState.tennis;
  if (t.games[side] > 0) {
    watchState.actionHistory.push({
      type: 'tennis_point',
      snapshot: JSON.parse(JSON.stringify({
        point: t.point, games: t.games, tiebreak: t.tiebreak,
        tbPoint: t.tbPoint, serving: t.serving, lastSwapGames: t.lastSwapGames,
        currentSet: t.currentSet, sets: t.sets,
        score: watchState.score, swapDone: watchState.swapDone
      }))
    });
    t.games[side]--;
    t.point = { left: 0, right: 0 };
    if (t.tiebreak) {
      t.tiebreak = false;
      t.tbPoint = { left: 0, right: 0 };
    }
    watchState.score.left = t.games.left;
    watchState.score.right = t.games.right;
    syncTennisScoreToDB();
    watchState.vibrate(20);
    autoSave();
    render();
    showToast('게임 취소');
  }
}

// ==========================================
// 배드민턴 점수 조작
// ==========================================
function addScore(side) {
  if (watchState.readOnly || !watchState.currentMatch) return;

  if (isTennis()) {
    tennisScorePoint(side);
    return;
  }

  // 배드민턴 기존 로직
  var old = watchState.score[side];
  var maxS = watchState.targetScore + 10;
  var newVal = Math.min(maxS, old + 1);
  if (old === newVal) return;

  watchState.actionHistory.push({ type: 'badminton', side: side, oldVal: old, swapDone: watchState.swapDone, leftTeam: watchState.leftTeam, rightTeam: watchState.rightTeam, scoreL: watchState.score.left, scoreR: watchState.score.right });
  watchState.score[side] = newVal;

  watchState.vibrate(30);

  // 점수 애니메이션
  var el = document.getElementById('s-' + side);
  if (el) {
    el.textContent = newVal;
    el.classList.add('fl');
    setTimeout(function() { el.classList.remove('fl'); }, 300);
  }

  // KDK 교체 체크
  if (!watchState.swapDone && !watchState.swapPending && watchState.format === 'kdk') {
    var mid = Math.floor(watchState.targetScore / 2);
    var sL = watchState.score.left;
    var sR = watchState.score.right;
    if (sL >= mid || sR >= mid) {
      watchState.swapDone = true;
      var tmp = watchState.score.left;
      watchState.score.left = watchState.score.right;
      watchState.score.right = tmp;
      tmp = watchState.leftTeam;
      watchState.leftTeam = watchState.rightTeam;
      watchState.rightTeam = tmp;
      watchState.vibrate([100, 50, 100]);
      showToast('⇄ 코트 교체!');
    }
  }

  checkWin();
  autoSave();
  render();
}

function minusScore(side) {
  if (watchState.readOnly || !watchState.currentMatch) return;
  if (isTennis()) {
    tennisMinusGame(side);
    return;
  }
  if (watchState.score[side] > 0) {
    watchState.actionHistory.push({ type: 'badminton', side: side, oldVal: watchState.score[side], swapDone: watchState.swapDone, leftTeam: watchState.leftTeam, rightTeam: watchState.rightTeam, scoreL: watchState.score.left, scoreR: watchState.score.right });
    watchState.score[side]--;
    watchState.vibrate(20);
    autoSave();
    render();
  }
}

function undoScore() {
  if (isTennis()) {
    tennisUndoPoint();
    return;
  }
  if (watchState.actionHistory.length === 0) {
    showToast('취소할 내역 없음');
    return;
  }
  var last = watchState.actionHistory.pop();
  if (last.type === 'badminton') {
    watchState.score[last.side] = last.oldVal;
    if (last.swapDone !== undefined) watchState.swapDone = last.swapDone;
    if (last.leftTeam !== undefined) watchState.leftTeam = last.leftTeam;
    if (last.rightTeam !== undefined) watchState.rightTeam = last.rightTeam;
    // 스왑 복원
    if (last.scoreL !== undefined) {
      watchState.score.left = last.scoreL;
      watchState.score.right = last.scoreR;
    }
  }
  watchState.vibrate(20);
  autoSave();
  render();
  showToast('↩ 되돌리기');
}

function checkWin() {
  var target = watchState.targetScore;
  var sL = watchState.score.left;
  var sR = watchState.score.right;

  var winSide = null;
  if (sL >= target && sL > sR) winSide = 'left';
  else if (sR >= target && sR > sL) winSide = 'right';

  if (winSide) {
    watchState.vibrate([200, 100, 200, 100, 300]);
    setTimeout(function() {
      showFinishConfirm(winSide);
    }, 500);
  }
}

// ==========================================
// 경기 완료
// ==========================================
function showFinishConfirm(winSide) {
  var m = watchState.currentMatch;
  if (!m) return;

  var winnerTeam = winSide === 'left' ? watchState.leftTeam : watchState.rightTeam;
  var winnerName = winnerTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');

  // 스코어 문자열 생성
  var scoreStr = '';
  if (isTennis()) {
    var t = watchState.tennis;
    if (t.setsToWin > 1 && t.sets.length > 0) {
      scoreStr = t.sets.map(function(s) { return s.left + '-' + s.right; }).join(', ');
    } else {
      scoreStr = t.games.left + '-' + t.games.right;
    }
  } else {
    scoreStr = watchState.score.left + ' : ' + watchState.score.right;
  }

  watchState.page = 'finished';
  watchState._finishData = {
    winSide: winSide,
    winnerTeam: winnerTeam,
    winnerName: winnerName,
    scoreStr: scoreStr,
    scoreLeft: watchState.score.left,
    scoreRight: watchState.score.right
  };
  render();
}

async function confirmFinish() {
  var fd = watchState._finishData;
  if (!fd || !watchState.currentMatch) return;

  var m = watchState.currentMatch;
  var data;

  if (isTennis()) {
    data = buildTennisScorePayload(fd.winnerTeam);
  } else {
    data = {
      team1_set1: watchState.leftTeam === 1 ? watchState.score.left : watchState.score.right,
      team1_set2: 0, team1_set3: 0,
      team2_set1: watchState.leftTeam === 1 ? watchState.score.right : watchState.score.left,
      team2_set2: 0, team2_set3: 0,
      status: 'completed',
      winner_team: fd.winnerTeam
    };
  }

  try {
    showSaving();
    await wApi('/tournaments/' + watchState.tournamentId + '/matches/' + m.id + '/score', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    watchState.vibrate([100, 50, 200]);
    showToast('🏆 경기 완료!');

    resetMatchState();

    setTimeout(function() {
      startNextMatch();
    }, 1500);
  } catch(e) {
    showToast('저장 실패! 재시도 중...');
    // 오프라인 큐에 저장
    watchState.offlineQueue.push({ path: '/tournaments/' + watchState.tournamentId + '/matches/' + m.id + '/score', data: data });
  }
}

function buildTennisScorePayload(winnerTeam) {
  var t = watchState.tennis;
  var payload = {
    team1_set1: 0, team1_set2: 0, team1_set3: 0,
    team2_set1: 0, team2_set2: 0, team2_set3: 0,
    status: 'completed',
    winner_team: winnerTeam
  };

  if (t.setsToWin === 1) {
    // 프로세트
    payload.team1_set1 = watchState.leftTeam === 1 ? t.games.left : t.games.right;
    payload.team2_set1 = watchState.leftTeam === 1 ? t.games.right : t.games.left;
  } else {
    // 멀티세트
    var allSets = t.sets.slice();
    for (var i = 0; i < allSets.length && i < 3; i++) {
      var key1 = 'team1_set' + (i + 1);
      var key2 = 'team2_set' + (i + 1);
      payload[key1] = watchState.leftTeam === 1 ? allSets[i].left : allSets[i].right;
      payload[key2] = watchState.leftTeam === 1 ? allSets[i].right : allSets[i].left;
    }
  }
  return payload;
}

function cancelFinish() {
  watchState._finishData = null;
  watchState.page = 'scoreboard';
  render();
}

function resetMatchState() {
  watchState.currentMatch = null;
  watchState.score = { left: 0, right: 0 };
  watchState.leftTeam = 1;
  watchState.rightTeam = 2;
  watchState.swapDone = false;
  watchState.actionHistory = [];
  watchState._finishData = null;
  // 테니스 상태 리셋
  var t = watchState.tennis;
  t.point = { left: 0, right: 0 };
  t.games = { left: 0, right: 0 };
  t.tiebreak = false;
  t.tbPoint = { left: 0, right: 0 };
  t.lastSwapGames = 0;
  t.serving = 'left';
  t.sets = [];
  t.currentSet = 1;
}

async function startNextMatch() {
  try {
    await wApi('/tournaments/' + watchState.tournamentId + '/court/' + watchState.courtNumber + '/next', {
      method: 'POST'
    });
    await loadCourtData();
  } catch(e) {
    watchState.page = 'waiting';
    startAutoRefresh();
    render();
  }
}

// ==========================================
// 자동 저장 (500ms 디바운스)
// ==========================================
function autoSave() {
  if (!watchState.currentMatch || watchState.readOnly) return;
  if (watchState.autoSaveTimer) clearTimeout(watchState.autoSaveTimer);
  watchState.autoSaveTimer = setTimeout(async function() {
    var m = watchState.currentMatch;
    if (!m) return;

    var data;
    if (isTennis()) {
      data = buildTennisScorePayload(0);
      data.status = 'playing';
      data.winner_team = undefined;
      delete data.winner_team;
    } else {
      data = {
        team1_set1: watchState.leftTeam === 1 ? watchState.score.left : watchState.score.right,
        team1_set2: 0, team1_set3: 0,
        team2_set1: watchState.leftTeam === 1 ? watchState.score.right : watchState.score.left,
        team2_set2: 0, team2_set3: 0,
        status: 'playing'
      };
    }

    try {
      showSaving();
      await wApi('/tournaments/' + watchState.tournamentId + '/matches/' + m.id + '/score', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch(e) {
      // 오프라인 큐에 추가
      watchState.offlineQueue.push({ path: '/tournaments/' + watchState.tournamentId + '/matches/' + m.id + '/score', data: data });
    }
  }, 500);
}

// 오프라인 큐 처리
async function processOfflineQueue() {
  if (watchState.offlineQueue.length === 0) return;
  var item = watchState.offlineQueue.shift();
  try {
    await wApi(item.path, { method: 'PUT', body: JSON.stringify(item.data) });
    showToast('✓ 동기화 완료');
    processOfflineQueue();
  } catch(e) {
    watchState.offlineQueue.unshift(item);
  }
}

// 온라인 복귀 시 큐 처리
window.addEventListener('online', function() {
  updateNetStatus(true);
  processOfflineQueue();
});
window.addEventListener('offline', function() {
  updateNetStatus(false);
});

// ==========================================
// 토스트 메시지
// ==========================================
function showToast(msg) {
  var el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(34,197,94,0.92);color:#fff;padding:4px 14px;border-radius:12px;font-size:11px;font-weight:700;opacity:1;transition:opacity .3s;pointer-events:none;white-space:nowrap;';
  setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { el.textContent = ''; }, 300);
  }, 2000);
}

function showError(msg) {
  watchState.page = 'error';
  watchState._errorMsg = msg;
  render();
}

// ==========================================
// 렌더링
// ==========================================
function render() {
  var app = document.getElementById('app');
  if (!app) return;
  switch (watchState.page) {
    case 'loading': app.innerHTML = renderLoading(); break;
    case 'tournaments': app.innerHTML = renderTournaments(); break;
    case 'courts': app.innerHTML = renderCourts(); break;
    case 'waiting': app.innerHTML = renderWaiting(); break;
    case 'scoreboard': app.innerHTML = renderScoreboard(); break;
    case 'finished': app.innerHTML = renderFinished(); break;
    case 'error': app.innerHTML = renderError(); break;
    default: app.innerHTML = renderLoading();
  }
}

function renderLoading() {
  return '<div class="ld"><div class="sp"></div><div class="lt">연결 중...</div></div>';
}

function renderError() {
  return '<div class="ld">' +
    '<div style="font-size:24px;margin-bottom:8px;">⚠️</div>' +
    '<div class="lt">' + esc(watchState._errorMsg || '오류') + '</div>' +
    '<button onclick="init()" class="bt nx" style="margin-top:10px;">재시도</button>' +
    '</div>';
}

// ==========================================
// 대회 선택
// ==========================================
function renderTournaments() {
  var list = watchState.tournaments;
  var html = '<div class="sel">' +
    '<div class="sel-t">⌚ 대회 선택</div>' +
    '<div class="sel-l">';

  if (list.length === 0) {
    html += '<div style="text-align:center;color:rgba(255,255,255,0.3);font-size:10px;padding:20px;">등록된 대회 없음</div>';
  } else {
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var emoji = t.sport === 'tennis' ? '🎾' : '🏸';
      html += '<button class="sel-b" onclick="selectTournament(' + t.id + ')">' +
        '<div>' + emoji + ' ' + esc(t.name) + '</div>' +
        '<div class="sel-s">코트 ' + (t.courts || 4) + '면</div>' +
        '</button>';
    }
  }

  html += '</div></div>';
  return html;
}

function selectTournament(id) {
  watchState.tournamentId = id;
  var t = watchState.tournaments.find(function(x) { return x.id === id; });
  if (t) {
    watchState.tournamentName = t.name || '';
    watchState.courts = t.courts || 4;
    watchState.sport = t.sport || 'badminton';
  }
  watchState.page = 'courts';
  render();
}

// ==========================================
// 코트 선택
// ==========================================
function renderCourts() {
  var n = watchState.courts;
  var emoji = isTennis() ? '🎾' : '🏸';
  var html = '<div class="sel">' +
    '<div class="sel-t">' + emoji + ' 코트 선택</div>' +
    '<div style="font-size:9px;color:rgba(255,255,255,0.3);margin-bottom:4px;text-align:center;">' + esc(watchState.tournamentName) + '</div>' +
    '<div class="cg">';

  for (var i = 1; i <= n; i++) {
    html += '<button class="cb" onclick="selectCourt(' + i + ')">' + i + '</button>';
  }

  html += '</div>' +
    '<button class="bt bk" style="margin-top:8px;" onclick="goBack()">← 뒤로</button>' +
    '</div>';
  return html;
}

function selectCourt(num) {
  watchState.courtNumber = num;
  watchState.page = 'loading';
  render();
  stopAutoRefresh();
  loadCourtData();
}

// ==========================================
// 대기 화면 (다음 경기 미리보기 포함)
// ==========================================
function renderWaiting() {
  var emoji = isTennis() ? '🎾' : '🏸';
  var html = '<div class="wt">' +
    '<div class="wt-i">' + emoji + '</div>' +
    '<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);">코트 ' + watchState.courtNumber + '</div>' +
    '<div class="wt-t">다음 경기 대기 중...</div>';

  // 다음 경기 미리보기
  if (watchState.nextMatches && watchState.nextMatches.length > 0) {
    var nm = watchState.nextMatches[0];
    html += '<div class="nxt-preview">' +
      '<div style="font-size:9px;color:rgba(255,255,255,0.3);margin-bottom:3px;">다음 경기</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,0.7);font-weight:600;">' +
        esc(shortName(nm.team1_name || '?')) + ' vs ' + esc(shortName(nm.team2_name || '?')) +
      '</div>' +
      (nm.event_name ? '<div style="font-size:9px;color:rgba(255,255,255,0.3);">' + esc(nm.event_name) + '</div>' : '') +
    '</div>';
  }

  // 최근 완료 경기
  if (watchState.recentMatches && watchState.recentMatches.length > 0) {
    html += '<div style="font-size:9px;color:rgba(255,255,255,0.2);margin-top:4px;">최근 결과</div>';
    for (var i = 0; i < Math.min(2, watchState.recentMatches.length); i++) {
      var rm = watchState.recentMatches[i];
      html += '<div style="font-size:9px;color:rgba(255,255,255,0.4);">' +
        esc(shortName(rm.team1_name || '?')) + ' ' + (rm.team1_set1 || 0) + '-' + (rm.team2_set1 || 0) + ' ' + esc(shortName(rm.team2_name || '?')) +
      '</div>';
    }
  }

  html += '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;justify-content:center;">' +
    '<button class="bt nx" onclick="manualStartNext()">▶ 시작</button>' +
    '<button class="bt u" onclick="loadCourtData()">↻</button>' +
    '<button class="bt bk" onclick="goBack()">←</button>' +
    '</div>' +
    '</div>';
  return html;
}

async function manualStartNext() {
  try {
    showToast('경기 시작 중...');
    await startNextMatch();
  } catch(e) {
    showToast('대기 중인 경기 없음');
  }
}

// ==========================================
// 점수판 (핵심 UI) - 스포츠별 분기
// ==========================================
function renderScoreboard() {
  var m = watchState.currentMatch;
  if (!m) return renderWaiting();

  if (isTennis()) return renderTennisScoreboard(m);
  return renderBadmintonScoreboard(m);
}

// ==========================================
// 배드민턴 점수판
// ==========================================
function renderBadmintonScoreboard(m) {
  var sL = watchState.score.left;
  var sR = watchState.score.right;
  var target = watchState.targetScore;
  var leftName = watchState.leftTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');
  var rightName = watchState.leftTeam === 1 ? (m.team2_name || '팀2') : (m.team1_name || '팀1');

  // 뱃지
  var badge = '';
  var maxS = Math.max(sL, sR);
  var minS = Math.min(sL, sR);
  if (maxS >= target - 1 && maxS > minS) {
    badge = '<span class="bg mp">MATCH PT</span>';
  } else if (maxS >= target - 3 && Math.abs(sL - sR) <= 2 && maxS > 0) {
    badge = '<span class="bg cl">접전</span>';
  }

  var leftColor = sL >= target ? '#fde047' : '#fff';
  var rightColor = sR >= target ? '#fde047' : '#fff';

  return '<div class="sb">' +
    '<div class="mi">' +
      '<span>' + esc(m.event_name || '') + '</span>' +
      (watchState.readOnly ? ' <span style="color:#fca5a5;">👁</span>' : '') +
    '</div>' +
    '<div class="br">' + badge + '<span class="bg lv">LIVE</span></div>' +

    '<div class="sc">' +
      '<div class="sd">' +
        '<div class="tn">' + esc(shortName(leftName)) + '</div>' +
        '<div class="st L" onclick="addScore(\'left\')">' +
          (!watchState.readOnly ? '<div class="mn" onclick="event.stopPropagation();minusScore(\'left\')">-</div>' : '') +
          '<span class="n" id="s-left" style="color:' + leftColor + '">' + sL + '</span>' +
          (!watchState.readOnly ? '<span class="h">+1</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="vs">:</div>' +
      '<div class="sd">' +
        '<div class="tn">' + esc(shortName(rightName)) + '</div>' +
        '<div class="st R" onclick="addScore(\'right\')">' +
          (!watchState.readOnly ? '<div class="mn" onclick="event.stopPropagation();minusScore(\'right\')">-</div>' : '') +
          '<span class="n" id="s-right" style="color:' + rightColor + '">' + sR + '</span>' +
          (!watchState.readOnly ? '<span class="h">+1</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ct">' +
      (!watchState.readOnly ? '<button class="bt u" onclick="undoScore()">↩</button>' +
      '<button class="bt sw" onclick="swapSides()">⇄</button>' : '') +
      '<button class="bt bk" onclick="goBack()">✕</button>' +
    '</div>' +
    '<div style="font-size:8px;color:rgba(255,255,255,0.2);margin-top:2px;">🏸 C' + watchState.courtNumber + ' | ' + target + '점</div>' +
  '</div>';
}

// ==========================================
// 테니스 점수판
// ==========================================
function renderTennisScoreboard(m) {
  var t = watchState.tennis;
  var leftName = watchState.leftTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');
  var rightName = watchState.leftTeam === 1 ? (m.team2_name || '팀2') : (m.team1_name || '팀1');

  var ptL = getTennisPointDisplay('left');
  var ptR = getTennisPointDisplay('right');
  var gL = t.games.left;
  var gR = t.games.right;

  var statusLabel = getTennisStatusLabel();

  // 서브 인디케이터
  var servL = t.serving === 'left' ? '<span class="srv">●</span>' : '';
  var servR = t.serving === 'right' ? '<span class="srv">●</span>' : '';

  // 뱃지
  var badge = '';
  if (t.tiebreak) {
    badge = '<span class="bg tb">TB</span>';
  } else if (statusLabel === 'DEUCE') {
    badge = '<span class="bg dc">DEUCE</span>';
  } else if (statusLabel === 'AD') {
    badge = '<span class="bg ad">AD</span>';
  }

  // 세트 히스토리 (멀티세트)
  var setsHtml = '';
  if (t.setsToWin > 1 && t.sets.length > 0) {
    setsHtml = '<div class="sets-row">';
    for (var i = 0; i < t.sets.length; i++) {
      setsHtml += '<span class="set-sc">' + t.sets[i].left + '-' + t.sets[i].right + '</span>';
    }
    setsHtml += '</div>';
  }

  // 포인트 표시 색상
  var ptColorL = ptL === 'AD' ? '#fde047' : (t.tiebreak ? '#f87171' : 'rgba(255,255,255,0.8)');
  var ptColorR = ptR === 'AD' ? '#fde047' : (t.tiebreak ? '#f87171' : 'rgba(255,255,255,0.8)');

  // 게임이 매치포인트에 가까운지 체크
  var matchPt = false;
  if (t.setsToWin === 1) {
    if ((gL >= t.gamesPerSet - 1 && gL > gR) || (gR >= t.gamesPerSet - 1 && gR > gL)) matchPt = true;
  }
  if (matchPt && !badge) {
    badge = '<span class="bg mp">MATCH</span>';
  }

  return '<div class="sb tennis">' +
    '<div class="mi">' +
      '<span>' + esc(m.event_name || '') + '</span>' +
      (watchState.readOnly ? ' <span style="color:#fca5a5;">👁</span>' : '') +
    '</div>' +
    '<div class="br">' + badge + '<span class="bg lv">LIVE</span></div>' +
    setsHtml +

    // 게임 스코어 (큰 원형)
    '<div class="sc">' +
      '<div class="sd">' +
        '<div class="tn">' + servL + esc(shortName(leftName)) + '</div>' +
        '<div class="st L tennis-st" onclick="addScore(\'left\')">' +
          (!watchState.readOnly ? '<div class="mn" onclick="event.stopPropagation();minusScore(\'left\')">-</div>' : '') +
          '<span class="n" id="s-left">' + gL + '</span>' +
          '<span class="h">GAME</span>' +
        '</div>' +
        '<div class="pt" style="color:' + ptColorL + '">' + ptL + '</div>' +
      '</div>' +
      '<div class="vs">:</div>' +
      '<div class="sd">' +
        '<div class="tn">' + esc(shortName(rightName)) + servR + '</div>' +
        '<div class="st R tennis-st" onclick="addScore(\'right\')">' +
          (!watchState.readOnly ? '<div class="mn" onclick="event.stopPropagation();minusScore(\'right\')">-</div>' : '') +
          '<span class="n" id="s-right">' + gR + '</span>' +
          '<span class="h">GAME</span>' +
        '</div>' +
        '<div class="pt" style="color:' + ptColorR + '">' + ptR + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ct">' +
      (!watchState.readOnly ? '<button class="bt u" onclick="undoScore()">↩</button>' +
      '<button class="bt sw" onclick="swapSides()">⇄</button>' : '') +
      '<button class="bt bk" onclick="goBack()">✕</button>' +
    '</div>' +
    '<div style="font-size:8px;color:rgba(255,255,255,0.2);margin-top:2px;">🎾 C' + watchState.courtNumber + ' | ' + t.gamesPerSet + 'G ' + (t.deuceRule === 'noad' ? 'NA' : t.deuceRule === 'advantage' ? 'AD' : 'TB') + '</div>' +
  '</div>';
}

// ==========================================
// 사이드 스왑
// ==========================================
function swapSides() {
  var tmp = watchState.score.left;
  watchState.score.left = watchState.score.right;
  watchState.score.right = tmp;
  tmp = watchState.leftTeam;
  watchState.leftTeam = watchState.rightTeam;
  watchState.rightTeam = tmp;

  if (isTennis()) {
    var t = watchState.tennis;
    tmp = t.games.left;
    t.games.left = t.games.right;
    t.games.right = tmp;
    tmp = t.point.left;
    t.point.left = t.point.right;
    t.point.right = tmp;
    tmp = t.tbPoint.left;
    t.tbPoint.left = t.tbPoint.right;
    t.tbPoint.right = tmp;
    t.serving = t.serving === 'left' ? 'right' : 'left';
    for (var i = 0; i < t.sets.length; i++) {
      tmp = t.sets[i].left;
      t.sets[i].left = t.sets[i].right;
      t.sets[i].right = tmp;
    }
  }

  watchState.vibrate([50, 30, 50]);
  render();
}

// ==========================================
// 경기 완료 화면
// ==========================================
function renderFinished() {
  var fd = watchState._finishData;
  if (!fd) return renderWaiting();

  return '<div class="fn">' +
    '<div style="font-size:28px;margin-bottom:4px;">🏆</div>' +
    '<div class="fn-t">경기 종료</div>' +
    '<div class="fn-w">' + esc(fd.winnerName) + ' 승리!</div>' +
    '<div class="fn-s">' + fd.scoreStr + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:8px;">' +
      '<button class="bt dn" style="padding:10px 18px;font-size:12px;" onclick="confirmFinish()">✓ 확인</button>' +
      '<button class="bt u" style="padding:10px 18px;font-size:12px;" onclick="cancelFinish()">← 계속</button>' +
    '</div>' +
  '</div>';
}

// ==========================================
// 유틸리티
// ==========================================
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shortName(name) {
  if (!name) return '';
  if (name.length > 8) return name.substring(0, 7) + '…';
  return name;
}

function goBack() {
  stopAutoRefresh();
  releaseWakeLock();
  if (watchState.page === 'scoreboard' || watchState.page === 'waiting' || watchState.page === 'finished') {
    resetMatchState();
    watchState.page = 'courts';
  } else if (watchState.page === 'courts') {
    watchState.page = 'tournaments';
    loadTournaments();
    return;
  } else {
    watchState.page = 'tournaments';
    loadTournaments();
    return;
  }
  render();
}

// 페이지 초기화
init();
