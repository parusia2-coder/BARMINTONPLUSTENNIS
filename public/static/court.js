// ==========================================
// 코트 전용 점수판 - Court Scoreboard
// 좌우 레이아웃 + 터치 점수 입력 + 전후반 교체
// 1세트 단판 경기 전용
// ==========================================
const API = '/api';

const courtState = {
  tournamentId: null,
  courtNumber: null,
  currentMatch: null,
  nextMatches: [],
  recentMatches: [],
  tournament: null,
  page: 'select', // select | court
  courts: [],
  stats: null,
  autoRefreshTimer: null,
  score: { left: 0, right: 0 },
  // left/right → 실제 team 매핑 (교체 가능)
  leftTeam: 1,   // 1=team1, 2=team2
  rightTeam: 2,
  swapped: false, // 전후반 교체 여부
  targetScore: 25,
  format: 'kdk'
};

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
  const c = { info: 'bg-blue-600', success: 'bg-green-600', error: 'bg-red-600', warning: 'bg-yellow-500 text-gray-900' };
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
}

// ==========================================
// 메인 렌더
// ==========================================
function renderCourt() {
  const app = document.getElementById('app');
  switch (courtState.page) {
    case 'select': app.innerHTML = renderCourtSelect(); break;
    case 'court': app.innerHTML = renderCourtScoreboard(); bindScoreboardEvents(); break;
    default: app.innerHTML = renderCourtSelect();
  }
}

// ==========================================
// 대회/코트 선택 화면
// ==========================================
function renderCourtSelect() {
  return `<div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center"><i class="fas fa-table-tennis-paddle-ball text-white"></i></div>
        <div><h1 class="text-xl font-bold">코트 점수판</h1><p class="text-xs text-gray-400">Court Scoreboard</p></div>
      </div>
      <a href="/" class="text-sm text-gray-400 hover:text-white"><i class="fas fa-home mr-1"></i>메인으로</a>
    </div>
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-lg">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 mb-4 shadow-lg">
            <i class="fas fa-tv text-3xl text-white"></i>
          </div>
          <h2 class="text-3xl font-extrabold mb-2">코트 점수판</h2>
          <p class="text-gray-400">코트에 배치할 태블릿에서 사용하세요</p>
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
    <h3 class="text-lg font-semibold mb-2 text-center text-green-400">
      <i class="fas fa-trophy mr-2"></i>${courtState.tournament?.name || '대회'}
    </h3>
    <p class="text-center text-gray-400 mb-6">코트를 선택하세요</p>
    <div id="court-grid" class="grid grid-cols-2 gap-4">
      <div class="col-span-2 text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
    </div>
    <button onclick="courtState.tournamentId=null;courtState.tournament=null;renderCourt();loadTournamentList()" 
            class="w-full mt-6 py-3 bg-white/5 text-gray-400 rounded-xl text-sm hover:bg-white/10">
      <i class="fas fa-arrow-left mr-2"></i>대회 다시 선택
    </button>
  </div>`;
}

// ==========================================
// 메인 점수판 - 좌우 레이아웃 + 터치 영역
// ==========================================
function renderCourtScoreboard() {
  const m = courtState.currentMatch;
  if (!m) return renderWaitingScreen();

  const sL = courtState.score.left;
  const sR = courtState.score.right;
  const target = courtState.targetScore;
  const maxScore = Math.max(sL, sR);
  const isNearEnd = maxScore >= target - 3 && maxScore < target;
  const isGamePoint = maxScore === target - 1;

  const leftName = getLeftName();
  const rightName = getRightName();

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
        <span class="text-xs px-2 py-0.5 rounded-full font-bold ${getProgressClass()}">${getProgressLabel()}</span>
        <button onclick="exitCourt()" class="text-gray-500 hover:text-white text-sm px-1.5 ml-1"><i class="fas fa-times"></i></button>
      </div>
    </div>

    <!-- 메인 점수판: 좌우 구조 -->
    <div class="flex-1 flex flex-row relative" style="min-height:0;">
      
      <!-- 왼쪽 팀 (터치 영역) -->
      <div id="left-zone" class="flex-1 flex flex-col items-center justify-center relative cursor-pointer touch-area
        ${sL > sR ? 'bg-gradient-to-r from-blue-900/30 to-transparent' : ''}
        ${sL >= target ? 'winner-glow-left' : ''}"
        style="border-right: 3px solid rgba(255,255,255,0.1);">
        
        <!-- 팀 이름 -->
        <div class="absolute top-3 left-0 right-0 text-center">
          <p class="text-lg sm:text-xl font-bold text-blue-400 truncate px-4">${leftName}</p>
          ${courtState.swapped ? '<span class="text-xs text-yellow-400/70"><i class="fas fa-exchange-alt mr-1"></i>교체됨</span>' : ''}
        </div>

        <!-- 점수 -->
        <div class="text-center" id="left-score-display">
          <div class="score-num font-black tabular-nums leading-none text-white ${sL >= target ? 'text-yellow-400' : ''}" 
               id="score-left">${sL}</div>
        </div>

        <!-- 터치 안내 (작은 텍스트) -->
        <div class="absolute bottom-14 left-0 right-0 text-center">
          <span class="text-xs text-white/20"><i class="fas fa-hand-pointer mr-1"></i>터치하여 +1</span>
        </div>

        <!-- -1 버튼 (하단) -->
        <button onclick="event.stopPropagation();changeScore('left',-1)" 
          class="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-10 rounded-xl bg-red-600/60 hover:bg-red-500 text-xl font-bold shadow-lg active:scale-90 transition z-10">
          −1
        </button>
      </div>

      <!-- 중앙 컨트롤 -->
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
        <!-- 교체 버튼 -->
        <button onclick="swapSides()" id="swap-btn"
          class="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 border-2 border-white/20 
                 flex items-center justify-center text-white shadow-xl active:scale-90 transition backdrop-blur-sm"
          title="좌우 교체 (전후반)">
          <i class="fas fa-exchange-alt text-xl"></i>
        </button>
        <span class="text-xs text-white/40 font-bold">${courtState.swapped ? '후반' : '전반'}</span>
      </div>

      <!-- 오른쪽 팀 (터치 영역) -->
      <div id="right-zone" class="flex-1 flex flex-col items-center justify-center relative cursor-pointer touch-area
        ${sR > sL ? 'bg-gradient-to-l from-orange-900/30 to-transparent' : ''}
        ${sR >= target ? 'winner-glow-right' : ''}">

        <!-- 팀 이름 -->
        <div class="absolute top-3 left-0 right-0 text-center">
          <p class="text-lg sm:text-xl font-bold text-orange-400 truncate px-4">${rightName}</p>
          ${courtState.swapped ? '<span class="text-xs text-yellow-400/70"><i class="fas fa-exchange-alt mr-1"></i>교체됨</span>' : ''}
        </div>

        <!-- 점수 -->
        <div class="text-center" id="right-score-display">
          <div class="score-num font-black tabular-nums leading-none text-white ${sR >= target ? 'text-yellow-400' : ''}" 
               id="score-right">${sR}</div>
        </div>

        <!-- 터치 안내 -->
        <div class="absolute bottom-14 left-0 right-0 text-center">
          <span class="text-xs text-white/20"><i class="fas fa-hand-pointer mr-1"></i>터치하여 +1</span>
        </div>

        <!-- -1 버튼 -->
        <button onclick="event.stopPropagation();changeScore('right',-1)" 
          class="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-10 rounded-xl bg-red-600/60 hover:bg-red-500 text-xl font-bold shadow-lg active:scale-90 transition z-10">
          −1
        </button>
      </div>
    </div>

    <!-- 하단 컨트롤 바 -->
    <div class="bg-black/50 border-t border-white/10 px-3 py-2 shrink-0" style="min-height:52px;">
      <div class="flex gap-2">
        <button onclick="undoLastAction()" class="flex-1 py-2.5 bg-white/10 rounded-xl text-xs sm:text-sm font-medium hover:bg-white/20 active:scale-95 transition">
          <i class="fas fa-undo mr-1"></i>실행취소
        </button>
        <button onclick="saveCurrentScore()" class="flex-1 py-2.5 bg-blue-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-500 shadow-lg active:scale-95 transition">
          <i class="fas fa-save mr-1"></i>저장
        </button>
        <button onclick="showFinishModal()" class="flex-1 py-2.5 bg-green-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-green-500 shadow-lg active:scale-95 transition">
          <i class="fas fa-flag-checkered mr-1"></i>종료
        </button>
      </div>
    </div>

    <!-- 경기종료 모달 -->
    ${renderFinishModal()}

    <!-- 터치 피드백 오버레이 -->
    <div id="touch-feedback" class="fixed pointer-events-none z-[100]" style="display:none;">
      <div class="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black text-white animate-ping">+1</div>
    </div>
  </div>`;
}

function renderFinishModal() {
  const m = courtState.currentMatch;
  if (!m) return '';
  const sL = courtState.score.left;
  const sR = courtState.score.right;
  const leftName = getLeftName();
  const rightName = getRightName();

  return `<div id="finish-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div class="bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 border border-white/10">
      <h3 class="text-xl font-bold text-center mb-6"><i class="fas fa-flag-checkered mr-2 text-green-400"></i>경기 종료</h3>
      <div class="mb-6">
        <div class="flex items-center justify-between bg-white/5 rounded-xl px-6 py-4">
          <div class="text-center flex-1">
            <p class="text-sm text-blue-400 font-medium mb-1">${leftName}</p>
            <p class="text-4xl font-black ${sL > sR ? 'text-yellow-400' : ''}">${sL}</p>
          </div>
          <span class="text-2xl text-gray-600 font-bold mx-4">:</span>
          <div class="text-center flex-1">
            <p class="text-sm text-orange-400 font-medium mb-1">${rightName}</p>
            <p class="text-4xl font-black ${sR > sL ? 'text-yellow-400' : ''}">${sR}</p>
          </div>
        </div>
      </div>
      <div class="mb-6">
        <p class="text-sm text-gray-400 mb-3 text-center">승자를 선택하세요</p>
        <div class="grid grid-cols-2 gap-3">
          <button onclick="selectWinner('left')" id="winner-btn-left" class="py-4 bg-blue-600/30 border-2 border-blue-500/30 rounded-2xl text-center hover:bg-blue-600/50 transition">
            <p class="font-bold text-blue-400">${leftName}</p>
            <p class="text-3xl font-black mt-1">${sL}</p>
          </button>
          <button onclick="selectWinner('right')" id="winner-btn-right" class="py-4 bg-orange-600/30 border-2 border-orange-500/30 rounded-2xl text-center hover:bg-orange-600/50 transition">
            <p class="font-bold text-orange-400">${rightName}</p>
            <p class="text-3xl font-black mt-1">${sR}</p>
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
  return `<div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col select-none">
    <div class="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/10">
      <div class="flex items-center gap-2">
        <span class="bg-yellow-500 text-black text-sm font-bold px-4 py-1.5 rounded-full">${courtState.courtNumber}코트</span>
        <span class="text-sm text-gray-400">${courtState.tournament?.name || ''}</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="refreshCourtData()" class="px-3 py-1.5 bg-white/10 rounded-lg text-sm hover:bg-white/20"><i class="fas fa-sync-alt mr-1"></i>새로고침</button>
        <button onclick="exitCourt()" class="px-3 py-1.5 bg-white/10 rounded-lg text-sm hover:bg-white/20"><i class="fas fa-sign-out-alt"></i></button>
      </div>
    </div>
    <div class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="text-center mb-8">
        <div class="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-hourglass-half text-4xl text-yellow-400"></i>
        </div>
        <h2 class="text-3xl font-extrabold mb-2">경기 대기중</h2>
        <p class="text-gray-400">다음 경기를 시작해주세요</p>
        <div class="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl ${courtState.targetScore === 21 ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}">
          <i class="fas fa-info-circle"></i>
          <span class="text-sm font-bold">${courtState.targetScore}점 선취제 · 1세트 단판 ${courtState.format === 'tournament' ? '(본선)' : '(예선)'}</span>
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
  const leftZone = document.getElementById('left-zone');
  const rightZone = document.getElementById('right-zone');

  if (leftZone) {
    leftZone.addEventListener('click', (e) => {
      // -1 버튼은 stopPropagation으로 처리됨
      if (e.target.closest('button')) return;
      showTouchFeedback(e, 'left');
      changeScore('left', 1);
    });
  }

  if (rightZone) {
    rightZone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      showTouchFeedback(e, 'right');
      changeScore('right', 1);
    });
  }
}

function showTouchFeedback(e, side) {
  const fb = document.getElementById('touch-feedback');
  if (!fb) return;
  
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX || (e.touches && e.touches[0].clientX) || rect.left + rect.width / 2;
  const y = e.clientY || (e.touches && e.touches[0].clientY) || rect.top + rect.height / 2;
  
  fb.style.left = (x - 40) + 'px';
  fb.style.top = (y - 40) + 'px';
  fb.style.display = 'block';
  
  // 터치한 영역에 플래시 효과
  const zone = document.getElementById(side + '-zone');
  if (zone) {
    zone.classList.add('touch-flash');
    setTimeout(() => zone.classList.remove('touch-flash'), 200);
  }

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
  if (maxScore === target - 1) return '게임 포인트!';
  if (maxScore >= target - 3) return `${target - maxScore}점 남음`;
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
// 좌우 교체 (전후반)
// ==========================================
function swapSides() {
  // 점수도 같이 교체
  const tmpScore = courtState.score.left;
  courtState.score.left = courtState.score.right;
  courtState.score.right = tmpScore;

  // 팀 매핑 교체
  const tmpTeam = courtState.leftTeam;
  courtState.leftTeam = courtState.rightTeam;
  courtState.rightTeam = tmpTeam;

  courtState.swapped = !courtState.swapped;

  showCourtToast(`🔄 좌우 교체! (${courtState.swapped ? '후반' : '전반'})`, 'info');
  renderCourt();
}

// ==========================================
// 점수 조작
// ==========================================
let actionHistory = [];

function changeScore(side, delta) {
  const oldVal = courtState.score[side];
  const maxScore = courtState.targetScore + 10;
  const newVal = Math.max(0, Math.min(maxScore, oldVal + delta));
  
  if (oldVal === newVal) return;
  
  actionHistory.push({ side, oldVal, newVal });
  courtState.score[side] = newVal;

  // DOM 직접 업데이트 (빠른 반응)
  const el = document.getElementById(`score-${side}`);
  if (el) {
    el.textContent = newVal;
    el.classList.add('score-flash');
    setTimeout(() => el.classList.remove('score-flash'), 300);
  }

  // 목표 점수 도달 체크
  checkGameEnd();

  // 전체 리렌더 (상태 바 등 업데이트)
  renderCourt();
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
  renderCourt();
  showCourtToast('실행취소 완료', 'info');
}

// ==========================================
// 점수 저장 / 경기 종료
// ==========================================
async function saveCurrentScore() {
  const m = courtState.currentMatch;
  if (!m) return;

  const data = {
    team1_set1: getTeam1Score(),
    team1_set2: 0, team1_set3: 0,
    team2_set1: getTeam2Score(),
    team2_set2: 0, team2_set3: 0,
    status: 'playing'
  };

  try {
    await courtApi(`/tournaments/${courtState.tournamentId}/matches/${m.id}/score`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    showCourtToast('점수 저장됨!', 'success');
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
    btnL.className = `py-4 rounded-2xl text-center transition ${side === 'left' ? 'bg-blue-600 border-2 border-blue-400 ring-4 ring-blue-500/30 shadow-xl' : 'bg-white/5 border-2 border-white/10'}`;
    btnR.className = `py-4 rounded-2xl text-center transition ${side === 'right' ? 'bg-orange-600 border-2 border-orange-400 ring-4 ring-orange-500/30 shadow-xl' : 'bg-white/5 border-2 border-white/10'}`;
  }
  if (confirmBtn) confirmBtn.disabled = false;
}

async function confirmFinish() {
  if (!selectedWinnerSide || !courtState.currentMatch) return;
  
  const m = courtState.currentMatch;
  // side → 실제 team 번호로 변환
  const winnerTeam = selectedWinnerSide === 'left' ? courtState.leftTeam : courtState.rightTeam;

  const data = {
    team1_set1: getTeam1Score(),
    team1_set2: 0, team1_set3: 0,
    team2_set1: getTeam2Score(),
    team2_set2: 0, team2_set3: 0,
    status: 'completed',
    winner_team: winnerTeam
  };

  try {
    await courtApi(`/tournaments/${courtState.tournamentId}/matches/${m.id}/score`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    showCourtToast('경기가 종료되었습니다!', 'success');
    closeFinishModal();
    
    courtState.currentMatch = null;
    courtState.score = { left: 0, right: 0 };
    courtState.leftTeam = 1;
    courtState.rightTeam = 2;
    courtState.swapped = false;
    actionHistory = [];
    selectedWinnerSide = null;
    
    await refreshCourtData();
  } catch(e) {}
}

// ==========================================
// 다음 경기 시작
// ==========================================
async function startNextMatch() {
  try {
    await courtApi(`/tournaments/${courtState.tournamentId}/court/${courtState.courtNumber}/next`, {
      method: 'POST', body: '{}'
    });
    showCourtToast('경기 시작!', 'success');
    await refreshCourtData();
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
    
    if (data.current_match) {
      const m = data.current_match;
      // 현재 교체 상태에 맞게 점수 복원
      if (courtState.leftTeam === 1) {
        courtState.score = { left: m.team1_set1 || 0, right: m.team2_set1 || 0 };
      } else {
        courtState.score = { left: m.team2_set1 || 0, right: m.team1_set1 || 0 };
      }
      courtState.page = 'court';
    } else {
      // 새 경기면 교체 상태 리셋
      courtState.leftTeam = 1;
      courtState.rightTeam = 2;
      courtState.swapped = false;
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
      const stColor = { draft: 'text-gray-400', open: 'text-blue-400', in_progress: 'text-green-400', completed: 'text-purple-400' };
      const targetPt = t.format === 'tournament' ? 21 : 25;
      return `<button onclick="selectTournament(${t.id})" class="w-full text-left bg-white/5 rounded-xl p-4 hover:bg-white/10 transition border border-white/5">
        <div class="flex items-center justify-between">
          <div><h4 class="font-bold text-lg">${t.name}</h4><p class="text-sm text-gray-500">${t.courts}코트 · ${({kdk:'KDK',league:'풀리그',tournament:'토너먼트'})[t.format]} · ${targetPt}점제</p></div>
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
      return `<button onclick="selectCourtNumber(${c.court_number})" 
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

function selectCourtNumber(num) {
  courtState.courtNumber = num;
  const url = new URL(window.location);
  url.searchParams.set('tid', courtState.tournamentId);
  url.searchParams.set('court', num);
  window.history.pushState({}, '', url);
  refreshCourtData();
}

function exitCourt() {
  if (courtState.currentMatch) {
    if (!confirm('진행중인 경기가 있습니다. 나가시겠습니까? (점수는 저장됩니다)')) return;
    saveCurrentScore();
  }
  courtState.courtNumber = null;
  courtState.currentMatch = null;
  courtState.score = { left: 0, right: 0 };
  courtState.leftTeam = 1;
  courtState.rightTeam = 2;
  courtState.swapped = false;
  courtState.page = 'select';
  actionHistory = [];
  
  const url = new URL(window.location);
  url.searchParams.delete('court');
  window.history.pushState({}, '', url);
  renderCourt();
  loadCourtGrid();
}

// ==========================================
// 자동 새로고침
// ==========================================
function startAutoRefresh() {
  if (courtState.autoRefreshTimer) clearInterval(courtState.autoRefreshTimer);
  courtState.autoRefreshTimer = setInterval(async () => {
    if (courtState.page === 'court' && !courtState.currentMatch) {
      await refreshCourtData();
    }
  }, 10000);
}

// ==========================================
// 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  parseUrlParams();
  
  if (courtState.tournamentId && courtState.courtNumber) {
    refreshCourtData();
  } else if (courtState.tournamentId) {
    selectTournament(parseInt(courtState.tournamentId));
  } else {
    renderCourt();
    loadTournamentList();
  }
  
  startAutoRefresh();
});
