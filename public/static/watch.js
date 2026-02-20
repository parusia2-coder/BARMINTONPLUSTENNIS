// ==========================================
// 스마트워치 전용 점수판 - Watch Scoreboard
// 원형 화면 최적화 (~360x360px)
// 터치 전용 초경량 UI
// ==========================================
const API = '/api';

const watchState = {
  page: 'loading',     // loading | tournaments | courts | waiting | scoreboard | finished
  tournaments: [],
  tournamentId: null,
  tournamentName: '',
  sport: 'badminton',
  courtNumber: null,
  courts: 0,
  currentMatch: null,
  score: { left: 0, right: 0 },
  leftTeam: 1,
  rightTeam: 2,
  targetScore: 21,
  format: 'kdk',
  swapDone: false,
  swapPending: false,
  actionHistory: [],
  autoRefreshTimer: null,
  autoSaveTimer: null,
  readOnly: false,
  // 진동 피드백
  vibrate: function(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }
};

// ==========================================
// API 통신
// ==========================================
async function wApi(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

// ==========================================
// 초기화
// ==========================================
async function init() {
  // URL 파라미터 확인
  const params = new URLSearchParams(window.location.search);
  const tid = params.get('tid');
  const court = params.get('court');
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
    const data = await wApi('/tournaments');
    watchState.tournaments = (data.tournaments || data || []).filter(function(t) { return !t.deleted; });
    watchState.page = 'tournaments';
    render();
  } catch(e) {
    showError('대회 목록 로드 실패');
  }
}

async function loadTournamentInfo() {
  try {
    const tid = watchState.tournamentId;
    const t = await wApi('/tournaments/' + tid);
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
    const tid = watchState.tournamentId;
    const cn = watchState.courtNumber;
    const data = await wApi('/tournaments/' + tid + '/court/' + cn);

    if (data.tournament) {
      watchState.tournamentName = data.tournament.name || '';
      watchState.sport = data.tournament.sport || 'badminton';
      watchState.format = data.tournament.format || 'kdk';
    }
    if (data.target_score) {
      watchState.targetScore = data.target_score;
    }

    if (data.current_match) {
      const m = data.current_match;
      watchState.currentMatch = m;
      // 기존 점수 복원
      watchState.score.left = (watchState.leftTeam === 1) ? (m.team1_set1 || 0) : (m.team2_set1 || 0);
      watchState.score.right = (watchState.leftTeam === 1) ? (m.team2_set1 || 0) : (m.team1_set1 || 0);
      watchState.page = 'scoreboard';
    } else {
      watchState.currentMatch = null;
      watchState.page = 'waiting';
      // 대기 모드 자동 새로고침 (10초)
      startAutoRefresh();
    }
    render();
  } catch(e) {
    showError('코트 데이터 로드 실패');
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  watchState.autoRefreshTimer = setInterval(function() {
    loadCourtData();
  }, 10000);
}

function stopAutoRefresh() {
  if (watchState.autoRefreshTimer) {
    clearInterval(watchState.autoRefreshTimer);
    watchState.autoRefreshTimer = null;
  }
}

// ==========================================
// 점수 조작
// ==========================================
function addScore(side) {
  if (watchState.readOnly || !watchState.currentMatch) return;

  const old = watchState.score[side];
  const maxS = watchState.targetScore + 10;
  const newVal = Math.min(maxS, old + 1);
  if (old === newVal) return;

  watchState.actionHistory.push({ side: side, oldVal: old });
  watchState.score[side] = newVal;

  // 진동 피드백
  watchState.vibrate(30);

  // 애니메이션
  const el = document.getElementById('s-' + side);
  if (el) {
    el.textContent = newVal;
    el.classList.add('flash');
    setTimeout(function() { el.classList.remove('flash'); }, 300);
  }

  // 교체 체크 (KDK)
  if (!watchState.swapDone && !watchState.swapPending && watchState.format === 'kdk') {
    const mid = Math.floor(watchState.targetScore / 2);
    const sL = watchState.score.left;
    const sR = watchState.score.right;
    if (sL >= mid || sR >= mid) {
      watchState.swapDone = true;
      // 좌우 교환
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

  // 목표 점수 도달 체크
  checkWin();

  // 자동 저장
  autoSave();
  render();
}

function undoScore() {
  if (watchState.actionHistory.length === 0) return;
  var last = watchState.actionHistory.pop();
  watchState.score[last.side] = last.oldVal;
  watchState.vibrate(20);
  autoSave();
  render();
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
    // 약간의 딜레이 후 완료 화면 표시
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

  watchState.page = 'finished';
  watchState._finishData = {
    winSide: winSide,
    winnerTeam: winnerTeam,
    winnerName: winnerName,
    scoreLeft: watchState.score.left,
    scoreRight: watchState.score.right
  };
  render();
}

async function confirmFinish() {
  var fd = watchState._finishData;
  if (!fd || !watchState.currentMatch) return;

  var m = watchState.currentMatch;
  var data = {
    team1_set1: watchState.leftTeam === 1 ? watchState.score.left : watchState.score.right,
    team1_set2: 0, team1_set3: 0,
    team2_set1: watchState.leftTeam === 1 ? watchState.score.right : watchState.score.left,
    team2_set2: 0, team2_set3: 0,
    status: 'completed',
    winner_team: fd.winnerTeam
  };

  try {
    await wApi('/tournaments/' + watchState.tournamentId + '/matches/' + m.id + '/score', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    watchState.vibrate([100, 50, 200]);
    showToast('경기 완료!');

    // 상태 초기화
    watchState.currentMatch = null;
    watchState.score = { left: 0, right: 0 };
    watchState.leftTeam = 1;
    watchState.rightTeam = 2;
    watchState.swapDone = false;
    watchState.actionHistory = [];
    watchState._finishData = null;

    // 자동으로 다음 경기 로드
    setTimeout(function() {
      startNextMatch();
    }, 1500);
  } catch(e) {
    showToast('저장 실패!');
  }
}

function cancelFinish() {
  watchState._finishData = null;
  watchState.page = 'scoreboard';
  render();
}

async function startNextMatch() {
  try {
    await wApi('/tournaments/' + watchState.tournamentId + '/court/' + watchState.courtNumber + '/next', {
      method: 'POST'
    });
    await loadCourtData();
  } catch(e) {
    // 다음 경기 없으면 대기 화면
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
    var data = {
      team1_set1: watchState.leftTeam === 1 ? watchState.score.left : watchState.score.right,
      team1_set2: 0, team1_set3: 0,
      team2_set1: watchState.leftTeam === 1 ? watchState.score.right : watchState.score.left,
      team2_set2: 0, team2_set3: 0,
      status: 'playing'
    };
    try {
      await wApi('/tournaments/' + watchState.tournamentId + '/matches/' + m.id + '/score', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch(e) { /* 실패 무시 - 워치 네트워크 불안정 가능 */ }
  }, 500);
}

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
  el.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(34,197,94,0.9);color:#fff;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:700;opacity:1;transition:opacity .3s;';
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
// 렌더링 - 원형 스마트워치 최적화
// ==========================================
function render() {
  var app = document.getElementById('app');
  switch (watchState.page) {
    case 'loading':
      app.innerHTML = renderLoading();
      break;
    case 'tournaments':
      app.innerHTML = renderTournaments();
      break;
    case 'courts':
      app.innerHTML = renderCourts();
      break;
    case 'waiting':
      app.innerHTML = renderWaiting();
      break;
    case 'scoreboard':
      app.innerHTML = renderScoreboard();
      break;
    case 'finished':
      app.innerHTML = renderFinished();
      break;
    case 'error':
      app.innerHTML = renderError();
      break;
    default:
      app.innerHTML = renderLoading();
  }
}

function renderLoading() {
  return '<div class="loading"><div class="spinner"></div><div class="loading-text">연결 중...</div></div>';
}

function renderError() {
  return '<div class="loading">' +
    '<div style="font-size:24px;margin-bottom:8px;">⚠️</div>' +
    '<div class="loading-text">' + (watchState._errorMsg || '오류') + '</div>' +
    '<button onclick="init()" style="margin-top:10px;padding:6px 16px;background:rgba(59,130,246,0.3);border:1px solid rgba(59,130,246,0.4);border-radius:10px;color:#93c5fd;font-size:11px;font-weight:600;">재시도</button>' +
    '</div>';
}

// ==========================================
// 대회 선택 화면
// ==========================================
function renderTournaments() {
  var list = watchState.tournaments;
  var html = '<div class="select-screen">' +
    '<div class="select-title">⌚ 대회 선택</div>' +
    '<div class="select-list">';

  if (list.length === 0) {
    html += '<div style="text-align:center;color:rgba(255,255,255,0.3);font-size:10px;padding:20px;">등록된 대회 없음</div>';
  } else {
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      html += '<button class="select-btn" onclick="selectTournament(' + t.id + ')">' +
        '<div>' + escHtml(t.name) + '</div>' +
        '<div class="select-sub">' + (t.sport === 'tennis' ? '🎾' : '🏸') + ' 코트 ' + (t.courts || 4) + '면</div>' +
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
// 코트 선택 화면
// ==========================================
function renderCourts() {
  var n = watchState.courts;
  var emoji = watchState.sport === 'tennis' ? '🎾' : '🏸';
  var html = '<div class="select-screen">' +
    '<div class="select-title">' + emoji + ' 코트 선택</div>' +
    '<div style="font-size:9px;color:rgba(255,255,255,0.3);margin-bottom:4px;text-align:center;">' + escHtml(watchState.tournamentName) + '</div>' +
    '<div class="court-grid">';

  for (var i = 1; i <= n; i++) {
    html += '<button class="court-btn" onclick="selectCourt(' + i + ')">' + i + '</button>';
  }

  html += '</div>' +
    '<button class="ctrl-btn back" style="margin-top:8px;" onclick="goBack()">← 뒤로</button>' +
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
// 대기 화면
// ==========================================
function renderWaiting() {
  return '<div class="waiting">' +
    '<div class="waiting-icon">⌚</div>' +
    '<div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);">코트 ' + watchState.courtNumber + '</div>' +
    '<div class="waiting-text">다음 경기 대기 중...</div>' +
    '<div style="display:flex;gap:4px;margin-top:8px;">' +
    '<button class="ctrl-btn" style="background:rgba(59,130,246,0.2);color:#93c5fd;" onclick="loadCourtData()">↻ 새로고침</button>' +
    '<button class="ctrl-btn back" onclick="goBack()">← 뒤로</button>' +
    '</div>' +
    '<div style="margin-top:6px;">' +
    '<button class="ctrl-btn" style="background:rgba(34,197,94,0.2);color:#86efac;padding:8px 14px;font-size:10px;" onclick="manualStartNext()">▶ 다음 경기 시작</button>' +
    '</div>' +
    '</div>';
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
// 점수판 (핵심 UI)
// ==========================================
function renderScoreboard() {
  var m = watchState.currentMatch;
  if (!m) return renderWaiting();

  var sL = watchState.score.left;
  var sR = watchState.score.right;
  var target = watchState.targetScore;
  var leftName = watchState.leftTeam === 1 ? (m.team1_name || '팀1') : (m.team2_name || '팀2');
  var rightName = watchState.leftTeam === 1 ? (m.team2_name || '팀2') : (m.team1_name || '팀1');

  // 매치포인트 / 접전 표시
  var badge = '';
  var maxS = Math.max(sL, sR);
  var minS = Math.min(sL, sR);
  if (maxS >= target - 1 && maxS > minS) {
    badge = '<div class="badge mp">MATCH POINT</div>';
  } else if (maxS >= target - 3 && Math.abs(sL - sR) <= 2 && maxS > 0) {
    badge = '<div class="badge close">접전</div>';
  }

  // 점수 색상
  var leftColor = sL >= target ? '#fde047' : '#fff';
  var rightColor = sR >= target ? '#fde047' : '#fff';

  var html = '<div class="scoreboard">' +
    // 상단 정보
    '<div class="match-info">' +
      '<span class="event">' + escHtml(m.event_name || '') + '</span>' +
      (watchState.readOnly ? ' <span style="color:#fca5a5;">👁</span>' : '') +
    '</div>' +

    // 뱃지
    (badge ? '<div class="badge-row">' + badge + '<div class="badge live">LIVE</div></div>' : '<div class="badge-row"><div class="badge live">LIVE</div></div>') +

    // 점수 영역
    '<div class="scores">' +
      // 왼쪽
      '<div class="side">' +
        '<div class="team-name">' + escHtml(shortName(leftName)) + '</div>' +
        '<div class="score-touch left" onclick="addScore(\'left\')">' +
          '<span class="num" id="s-left" style="color:' + leftColor + ';">' + sL + '</span>' +
          (watchState.readOnly ? '' : '<span class="hint">TAP +1</span>') +
        '</div>' +
      '</div>' +

      // VS
      '<div class="vs">:</div>' +

      // 오른쪽
      '<div class="side">' +
        '<div class="team-name">' + escHtml(shortName(rightName)) + '</div>' +
        '<div class="score-touch right" onclick="addScore(\'right\')">' +
          '<span class="num" id="s-right" style="color:' + rightColor + ';">' + sR + '</span>' +
          (watchState.readOnly ? '' : '<span class="hint">TAP +1</span>') +
        '</div>' +
      '</div>' +
    '</div>' +

    // 컨트롤 버튼
    '<div class="controls">' +
      (watchState.readOnly ? '' :
        '<button class="ctrl-btn undo" onclick="undoScore()">↩</button>' +
        '<button class="ctrl-btn swap" onclick="swapSides()">⇄</button>'
      ) +
      '<button class="ctrl-btn back" onclick="goBack()">✕</button>' +
    '</div>' +

    // 하단 점수 목표 표시
    '<div style="font-size:8px;color:rgba(255,255,255,0.2);margin-top:2px;">' +
      'Court ' + watchState.courtNumber + ' | 목표 ' + target + '점' +
    '</div>' +
  '</div>';

  return html;
}

function swapSides() {
  var tmp = watchState.score.left;
  watchState.score.left = watchState.score.right;
  watchState.score.right = tmp;
  tmp = watchState.leftTeam;
  watchState.leftTeam = watchState.rightTeam;
  watchState.rightTeam = tmp;
  watchState.vibrate([50, 30, 50]);
  render();
}

// ==========================================
// 경기 완료 화면
// ==========================================
function renderFinished() {
  var fd = watchState._finishData;
  if (!fd) return renderWaiting();

  return '<div class="finish-screen">' +
    '<div style="font-size:28px;margin-bottom:4px;">🏆</div>' +
    '<div class="finish-title">경기 종료</div>' +
    '<div class="winner-name">' + escHtml(fd.winnerName) + ' 승리!</div>' +
    '<div class="finish-score">' + fd.scoreLeft + ' : ' + fd.scoreRight + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:8px;">' +
      '<button class="ctrl-btn finish" style="padding:8px 16px;font-size:11px;" onclick="confirmFinish()">✓ 확인</button>' +
      '<button class="ctrl-btn undo" style="padding:8px 16px;font-size:11px;" onclick="cancelFinish()">← 계속</button>' +
    '</div>' +
  '</div>';
}

// ==========================================
// 유틸리티
// ==========================================
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shortName(name) {
  if (!name) return '';
  // 스마트워치용: 8자 초과 시 축약
  if (name.length > 8) return name.substring(0, 7) + '…';
  return name;
}

function goBack() {
  stopAutoRefresh();
  if (watchState.page === 'scoreboard' || watchState.page === 'waiting' || watchState.page === 'finished') {
    watchState.currentMatch = null;
    watchState.score = { left: 0, right: 0 };
    watchState.actionHistory = [];
    watchState._finishData = null;
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
