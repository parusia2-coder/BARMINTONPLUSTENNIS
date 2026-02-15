// ==========================================
// 배드민턴 대회 운영 시스템 - Frontend App
// ==========================================

const API = '/api';

// ==========================================
// State Management
// ==========================================
const state = {
  currentPage: 'home',
  tournaments: [],
  currentTournament: null,
  participants: [],
  matches: [],
  standings: [],
  adminAuth: {}, // { tournamentId: true }
  adminPasswords: {}, // { tournamentId: password }
  isOnline: navigator.onLine
};

// ==========================================
// API Helpers
// ==========================================
async function api(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '요청 실패');
    return data;
  } catch (err) {
    if (!navigator.onLine) {
      showToast('네트워크 연결을 확인해주세요.', 'error');
    } else {
      showToast(err.message, 'error');
    }
    throw err;
  }
}

// ==========================================
// Toast Notification
// ==========================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500 text-gray-900' };
  toast.className = `fixed top-4 right-4 z-[9999] px-5 py-3 rounded-lg text-white shadow-lg ${colors[type]} fade-in flex items-center gap-2`;
  const icons = { info: 'fa-info-circle', success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ==========================================
// Router
// ==========================================
function navigate(page, params = {}) {
  state.currentPage = page;
  Object.assign(state, params);
  render();
}

// ==========================================
// Main Render
// ==========================================
function render() {
  const app = document.getElementById('app');
  switch (state.currentPage) {
    case 'home': app.innerHTML = renderHome(); break;
    case 'create': app.innerHTML = renderCreate(); break;
    case 'tournament': app.innerHTML = renderTournament(); break;
    case 'scoreboard': app.innerHTML = renderScoreboard(); break;
    case 'results': app.innerHTML = renderResults(); break;
    default: app.innerHTML = renderHome();
  }
  bindEvents();
}

// ==========================================
// Network Status
// ==========================================
window.addEventListener('online', () => { state.isOnline = true; render(); showToast('네트워크가 연결되었습니다.', 'success'); });
window.addEventListener('offline', () => { state.isOnline = false; render(); showToast('네트워크 연결이 끊겼습니다.', 'warning'); });

// ==========================================
// PAGES
// ==========================================

// ---- HOME PAGE ----
function renderHome() {
  return `
    ${renderNav()}
    ${!state.isOnline ? renderOfflineBanner() : ''}
    <div class="max-w-5xl mx-auto px-4 py-8 fade-in">
      <!-- Hero -->
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-shuttle-400 to-shuttle-600 mb-4 shadow-lg">
          <i class="fas fa-shuttlecock text-3xl text-white"></i>
        </div>
        <h1 class="text-4xl font-extrabold text-gray-900 mb-3">배드민턴 대회 운영</h1>
        <p class="text-lg text-gray-500 max-w-lg mx-auto">대진표 생성부터 실시간 점수 관리, 순위 계산까지<br>스마트하게 대회를 운영하세요.</p>
        <button onclick="navigate('create')" class="mt-6 px-8 py-3 bg-shuttle-600 text-white rounded-xl font-semibold hover:bg-shuttle-700 transition shadow-md hover:shadow-lg">
          <i class="fas fa-plus mr-2"></i>새 대회 만들기
        </button>
      </div>
      <!-- Tournament List -->
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-trophy mr-2 text-yellow-500"></i>진행 중인 대회</h2>
        <button onclick="loadTournaments()" class="text-sm text-gray-500 hover:text-gray-700"><i class="fas fa-sync-alt mr-1"></i>새로고침</button>
      </div>
      <div id="tournament-list" class="grid gap-4 sm:grid-cols-2">
        <div class="col-span-full text-center py-12 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">불러오는 중...</p></div>
      </div>
    </div>`;
}

function renderTournamentCard(t) {
  const statusMap = {
    draft: { label: '준비중', color: 'bg-gray-100 text-gray-600', icon: 'fa-pen' },
    open: { label: '접수중', color: 'bg-blue-100 text-blue-700', icon: 'fa-door-open' },
    in_progress: { label: '진행중', color: 'bg-green-100 text-green-700', icon: 'fa-play' },
    completed: { label: '완료', color: 'bg-purple-100 text-purple-700', icon: 'fa-flag-checkered' },
    cancelled: { label: '취소', color: 'bg-red-100 text-red-600', icon: 'fa-ban' }
  };
  const s = statusMap[t.status] || statusMap.draft;
  const formatMap = { kdk: 'KDK (랜덤 복식)', league: '풀리그', tournament: '토너먼트' };
  return `
    <div class="bg-white rounded-xl border border-gray-200 p-5 card-hover cursor-pointer" onclick="openTournament(${t.id})">
      <div class="flex items-start justify-between mb-3">
        <h3 class="font-bold text-gray-900 text-lg leading-tight">${t.name}</h3>
        <span class="badge ${s.color} ml-2 whitespace-nowrap"><i class="fas ${s.icon} mr-1"></i>${s.label}</span>
      </div>
      <p class="text-sm text-gray-500 mb-3 line-clamp-2">${t.description || '설명 없음'}</p>
      <div class="flex items-center gap-4 text-xs text-gray-400">
        <span><i class="fas fa-gamepad mr-1"></i>${formatMap[t.format] || t.format}</span>
        <span><i class="fas fa-users mr-1"></i>최대 ${t.max_participants}명</span>
        <span><i class="fas fa-table-tennis-paddle-ball mr-1"></i>${t.courts}코트</span>
      </div>
      <div class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
        <i class="far fa-clock mr-1"></i>${new Date(t.created_at).toLocaleDateString('ko-KR')}
      </div>
    </div>`;
}

// ---- CREATE TOURNAMENT ----
function renderCreate() {
  return `
    ${renderNav()}
    <div class="max-w-2xl mx-auto px-4 py-8 fade-in">
      <button onclick="navigate('home')" class="text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center text-sm">
        <i class="fas fa-arrow-left mr-2"></i>돌아가기
      </button>
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-6"><i class="fas fa-plus-circle mr-2 text-shuttle-500"></i>새 대회 만들기</h2>
        <form id="create-form" class="space-y-5">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">대회명 <span class="text-red-500">*</span></label>
            <input name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 focus:border-shuttle-500 outline-none transition" placeholder="예: 2026 봄맞이 배드민턴 대회">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">설명</label>
            <textarea name="description" rows="2" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 focus:border-shuttle-500 outline-none transition" placeholder="대회에 대한 안내 사항"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">대회 방식</label>
              <select name="format" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none">
                <option value="kdk">KDK (랜덤 복식)</option>
                <option value="league">풀리그 (단식)</option>
                <option value="tournament">토너먼트 (단식)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">최대 인원</label>
              <input name="max_participants" type="number" value="16" min="2" max="64" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">선수당 경기 수 (KDK)</label>
              <input name="games_per_player" type="number" value="4" min="1" max="20" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">코트 수</label>
              <input name="courts" type="number" value="2" min="1" max="10" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none">
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">관리자 비밀번호 <span class="text-red-500">*</span></label>
            <input name="admin_password" type="password" required class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none" placeholder="대회 관리용 비밀번호">
            <p class="text-xs text-gray-400 mt-1">점수 입력, 대진표 생성 등 관리 기능에 사용됩니다.</p>
          </div>
          <button type="submit" class="w-full py-3 bg-shuttle-600 text-white rounded-xl font-semibold hover:bg-shuttle-700 transition shadow-md text-lg">
            <i class="fas fa-rocket mr-2"></i>대회 생성
          </button>
        </form>
      </div>
    </div>`;
}

// ---- TOURNAMENT DETAIL ----
function renderTournament() {
  const t = state.currentTournament;
  if (!t) return `<div class="text-center py-20"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>`;
  const isAdmin = state.adminAuth[t.id];
  const formatMap = { kdk: 'KDK (랜덤 복식)', league: '풀리그', tournament: '토너먼트' };

  return `
    ${renderNav()}
    ${!state.isOnline ? renderOfflineBanner() : ''}
    <div class="max-w-6xl mx-auto px-4 py-6 fade-in">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <button onclick="navigate('home')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition">
            <i class="fas fa-arrow-left text-gray-600"></i>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">${t.name}</h1>
            <p class="text-sm text-gray-500">${formatMap[t.format]} · ${t.courts}코트</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${!isAdmin ? `<button onclick="showAuthModal(${t.id})" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"><i class="fas fa-lock mr-1"></i>관리자 로그인</button>` : `<span class="badge bg-shuttle-100 text-shuttle-700"><i class="fas fa-shield-alt mr-1"></i>관리자</span>`}
          <button onclick="navigate('scoreboard')" class="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition"><i class="fas fa-tv mr-1"></i>스코어보드</button>
          <button onclick="loadStandingsAndNavigate(${t.id})" class="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100 transition"><i class="fas fa-medal mr-1"></i>결과</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        <button onclick="switchTab('participants')" id="tab-participants" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition bg-white shadow-sm text-gray-900">
          <i class="fas fa-users mr-1"></i>참가자 (${state.participants.length})
        </button>
        <button onclick="switchTab('matches')" id="tab-matches" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-700">
          <i class="fas fa-table-tennis-paddle-ball mr-1"></i>대진표/경기
        </button>
      </div>

      <!-- Tab Content -->
      <div id="tab-content">
        ${renderParticipantsTab(isAdmin)}
      </div>
    </div>

    <!-- Auth Modal -->
    <div id="auth-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-lock mr-2 text-shuttle-500"></i>관리자 인증</h3>
        <input id="auth-password" type="password" class="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-shuttle-500" placeholder="관리자 비밀번호">
        <div class="flex gap-2">
          <button onclick="closeAuthModal()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">취소</button>
          <button onclick="authenticate()" class="flex-1 py-2.5 bg-shuttle-600 text-white rounded-xl font-medium hover:bg-shuttle-700">확인</button>
        </div>
      </div>
    </div>`;
}

function renderParticipantsTab(isAdmin) {
  const participants = state.participants;
  return `
    <div class="space-y-4">
      ${isAdmin ? `
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="font-semibold text-gray-800 mb-3"><i class="fas fa-user-plus mr-2 text-shuttle-500"></i>참가자 등록</h3>
        <form id="add-participant-form" class="flex flex-wrap gap-3">
          <input name="name" required placeholder="이름" class="flex-1 min-w-[120px] px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
          <input name="phone" placeholder="연락처" class="flex-1 min-w-[120px] px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
          <select name="level" class="px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
            <option value="s">S급</option>
            <option value="a">A급</option>
            <option value="b">B급</option>
            <option value="c" selected>C급</option>
            <option value="d">D급</option>
            <option value="e">E급</option>
          </select>
          <button type="submit" class="px-6 py-2.5 bg-shuttle-600 text-white rounded-lg font-medium hover:bg-shuttle-700 transition"><i class="fas fa-plus mr-1"></i>등록</button>
        </form>
      </div>` : ''}

      ${isAdmin && state.currentTournament && (state.currentTournament.status === 'open' || state.currentTournament.status === 'draft') && participants.length >= 2 ? `
      <div class="flex justify-end">
        <button onclick="generateBracket()" class="px-6 py-3 bg-gradient-to-r from-shuttle-500 to-shuttle-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition">
          <i class="fas fa-magic mr-2"></i>대진표 자동 생성
        </button>
      </div>` : ''}

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이름</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">연락처</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">레벨</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">참가비</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">체크인</th>
              ${isAdmin ? '<th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">관리</th>' : ''}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${participants.length === 0 ? `<tr><td colspan="${isAdmin ? 7 : 6}" class="px-4 py-8 text-center text-gray-400">등록된 참가자가 없습니다.</td></tr>` : ''}
            ${participants.map((p, i) => {
              const levelMap = { s: { label: 'S', color: 'bg-red-100 text-red-700' }, a: { label: 'A', color: 'bg-orange-100 text-orange-700' }, b: { label: 'B', color: 'bg-yellow-100 text-yellow-700' }, c: { label: 'C', color: 'bg-green-100 text-green-700' }, d: { label: 'D', color: 'bg-blue-100 text-blue-700' }, e: { label: 'E', color: 'bg-gray-100 text-gray-600' } };
              const lv = levelMap[p.level] || levelMap.c;
              return `<tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm text-gray-500">${i + 1}</td>
                <td class="px-4 py-3 font-medium text-gray-900">${p.name}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${p.phone || '-'}</td>
                <td class="px-4 py-3 text-center"><span class="badge ${lv.color}">${lv.label}</span></td>
                <td class="px-4 py-3 text-center">
                  ${isAdmin ? `<button onclick="togglePaid(${p.id})" class="text-lg ${p.paid ? 'text-green-500' : 'text-gray-300'} hover:scale-110 transition">${p.paid ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>'}</button>` : (p.paid ? '<i class="fas fa-check-circle text-green-500"></i>' : '<i class="fas fa-times-circle text-gray-300"></i>')}
                </td>
                <td class="px-4 py-3 text-center">
                  ${isAdmin ? `<button onclick="toggleCheckin(${p.id})" class="text-lg ${p.checked_in ? 'text-blue-500' : 'text-gray-300'} hover:scale-110 transition">${p.checked_in ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>'}</button>` : (p.checked_in ? '<i class="fas fa-check-circle text-blue-500"></i>' : '<i class="fas fa-times-circle text-gray-300"></i>')}
                </td>
                ${isAdmin ? `<td class="px-4 py-3 text-center"><button onclick="deleteParticipant(${p.id})" class="text-red-400 hover:text-red-600 transition"><i class="fas fa-trash-alt"></i></button></td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderMatchesTab(isAdmin) {
  const matches = state.matches;
  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  return `
    <div class="space-y-6">
      ${matches.length === 0 ? `
        <div class="text-center py-12 text-gray-400">
          <i class="fas fa-clipboard-list text-4xl mb-3"></i>
          <p>대진표가 아직 생성되지 않았습니다.</p>
          ${isAdmin ? '<p class="text-sm mt-1">참가자 탭에서 대진표를 생성해주세요.</p>' : ''}
        </div>` : ''}

      ${Object.keys(rounds).sort((a, b) => a - b).map(round => `
        <div>
          <h3 class="text-lg font-bold text-gray-800 mb-3"><i class="fas fa-layer-group mr-2 text-shuttle-500"></i>${round}라운드</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            ${rounds[round].map(m => renderMatchCard(m, isAdmin)).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderMatchCard(m, isAdmin) {
  const statusMap = {
    pending: { label: '대기', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
    playing: { label: '진행중', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    completed: { label: '완료', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' }
  };
  const s = statusMap[m.status] || statusMap.pending;
  const isDoubles = m.team1_player2 || m.team2_player2;
  const t1Name = isDoubles ? `${m.t1p1_name || '?'} · ${m.t1p2_name || '?'}` : (m.t1p1_name || 'BYE');
  const t2Name = isDoubles ? `${m.t2p1_name || '?'} · ${m.t2p2_name || '?'}` : (m.t2p1_name || 'BYE');
  const t1Total = (m.team1_set1 || 0) + (m.team1_set2 || 0) + (m.team1_set3 || 0);
  const t2Total = (m.team2_set1 || 0) + (m.team2_set2 || 0) + (m.team2_set3 || 0);

  return `
    <div class="bg-white rounded-xl border ${m.status === 'playing' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200'} p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">경기 #${m.match_order}</span>
          ${m.court_number ? `<span class="badge bg-yellow-50 text-yellow-700"><i class="fas fa-map-marker-alt mr-1"></i>${m.court_number}코트</span>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${m.status === 'playing' ? '<span class="w-2 h-2 rounded-full bg-green-500 pulse-live"></span>' : ''}
          <span class="badge ${s.color}">${s.label}</span>
        </div>
      </div>
      <!-- Teams -->
      <div class="space-y-2">
        <div class="flex items-center justify-between ${m.winner_team === 1 ? 'font-bold text-shuttle-700' : ''}">
          <span class="text-sm flex items-center gap-1">${m.winner_team === 1 ? '<i class="fas fa-crown text-yellow-500 text-xs"></i>' : ''} ${t1Name}</span>
          <span class="scoreboard-num text-lg font-bold">${t1Total}</span>
        </div>
        <div class="flex items-center justify-between ${m.winner_team === 2 ? 'font-bold text-shuttle-700' : ''}">
          <span class="text-sm flex items-center gap-1">${m.winner_team === 2 ? '<i class="fas fa-crown text-yellow-500 text-xs"></i>' : ''} ${t2Name}</span>
          <span class="scoreboard-num text-lg font-bold">${t2Total}</span>
        </div>
      </div>
      ${m.status !== 'cancelled' && isAdmin ? `
      <div class="mt-3 pt-3 border-t border-gray-100 flex gap-2">
        ${m.status === 'pending' ? `<button onclick="startMatch(${m.id})" class="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition"><i class="fas fa-play mr-1"></i>시작</button>` : ''}
        ${m.status === 'playing' ? `<button onclick="showScoreModal(${m.id})" class="flex-1 py-2 bg-shuttle-50 text-shuttle-700 rounded-lg text-sm font-medium hover:bg-shuttle-100 transition"><i class="fas fa-edit mr-1"></i>점수 입력</button>` : ''}
        ${m.status === 'completed' ? `<button onclick="showScoreModal(${m.id})" class="flex-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition"><i class="fas fa-edit mr-1"></i>수정</button>` : ''}
      </div>` : ''}
    </div>`;
}

// ---- SCOREBOARD (Public View) ----
function renderScoreboard() {
  const t = state.currentTournament;
  const playingMatches = state.matches.filter(m => m.status === 'playing');
  const pendingMatches = state.matches.filter(m => m.status === 'pending');
  const completedMatches = state.matches.filter(m => m.status === 'completed');

  return `
    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div class="max-w-6xl mx-auto px-4 py-6">
        <div class="flex items-center justify-between mb-8">
          <div>
            <button onclick="navigate('tournament')" class="text-gray-400 hover:text-white mb-2 inline-flex items-center text-sm"><i class="fas fa-arrow-left mr-2"></i>돌아가기</button>
            <h1 class="text-3xl font-extrabold">${t ? t.name : '스코어보드'}</h1>
          </div>
          <div class="flex items-center gap-3">
            <button onclick="refreshScoreboard()" class="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition"><i class="fas fa-sync-alt mr-1"></i>새로고침</button>
            <span class="text-xs text-gray-400"><i class="fas fa-clock mr-1"></i>${new Date().toLocaleTimeString('ko-KR')}</span>
          </div>
        </div>
        <!-- Live Matches -->
        ${playingMatches.length > 0 ? `
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-4 flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-green-500 pulse-live"></span>진행 중인 경기</h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            ${playingMatches.map(m => renderScoreboardCard(m)).join('')}
          </div>
        </div>` : '<div class="text-center py-8 text-gray-500 mb-8"><i class="fas fa-pause-circle text-3xl mb-2"></i><p>현재 진행 중인 경기가 없습니다.</p></div>'}
        
        <!-- Stats -->
        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="bg-white/5 rounded-xl p-4 text-center">
            <div class="text-3xl font-extrabold text-green-400">${playingMatches.length}</div>
            <div class="text-xs text-gray-400 mt-1">진행중</div>
          </div>
          <div class="bg-white/5 rounded-xl p-4 text-center">
            <div class="text-3xl font-extrabold text-yellow-400">${pendingMatches.length}</div>
            <div class="text-xs text-gray-400 mt-1">대기중</div>
          </div>
          <div class="bg-white/5 rounded-xl p-4 text-center">
            <div class="text-3xl font-extrabold text-blue-400">${completedMatches.length}</div>
            <div class="text-xs text-gray-400 mt-1">완료</div>
          </div>
        </div>

        <!-- Recent Results -->
        ${completedMatches.length > 0 ? `
        <h2 class="text-lg font-bold mb-4"><i class="fas fa-history mr-2"></i>최근 결과</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${completedMatches.slice(-6).reverse().map(m => renderScoreboardCard(m)).join('')}
        </div>` : ''}
      </div>
    </div>`;
}

function renderScoreboardCard(m) {
  const isDoubles = m.team1_player2 || m.team2_player2;
  const t1Name = isDoubles ? `${m.t1p1_name || '?'} · ${m.t1p2_name || '?'}` : (m.t1p1_name || 'BYE');
  const t2Name = isDoubles ? `${m.t2p1_name || '?'} · ${m.t2p2_name || '?'}` : (m.t2p1_name || 'BYE');
  const t1Total = (m.team1_set1 || 0) + (m.team1_set2 || 0) + (m.team1_set3 || 0);
  const t2Total = (m.team2_set1 || 0) + (m.team2_set2 || 0) + (m.team2_set3 || 0);
  const isLive = m.status === 'playing';

  return `
    <div class="bg-white/10 rounded-xl p-4 ${isLive ? 'ring-2 ring-green-500/50' : ''}">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-400">#${m.match_order} ${m.court_number ? `· ${m.court_number}코트` : ''}</span>
        ${isLive ? '<span class="text-xs text-green-400 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500 pulse-live"></span>LIVE</span>' : '<span class="text-xs text-blue-400">완료</span>'}
      </div>
      <div class="space-y-2">
        <div class="flex items-center justify-between ${m.winner_team === 1 ? 'text-yellow-400' : ''}">
          <span class="text-sm font-medium">${m.winner_team === 1 ? '🏆 ' : ''}${t1Name}</span>
          <span class="text-2xl font-extrabold scoreboard-num">${t1Total}</span>
        </div>
        <div class="h-px bg-white/10"></div>
        <div class="flex items-center justify-between ${m.winner_team === 2 ? 'text-yellow-400' : ''}">
          <span class="text-sm font-medium">${m.winner_team === 2 ? '🏆 ' : ''}${t2Name}</span>
          <span class="text-2xl font-extrabold scoreboard-num">${t2Total}</span>
        </div>
      </div>
      ${m.status === 'completed' ? `
      <div class="mt-2 pt-2 border-t border-white/10 text-xs text-gray-400">
        세트: ${m.team1_set1||0}-${m.team2_set1||0}, ${m.team1_set2||0}-${m.team2_set2||0}${(m.team1_set3 || m.team2_set3) ? `, ${m.team1_set3||0}-${m.team2_set3||0}` : ''}
      </div>` : ''}
    </div>`;
}

// ---- RESULTS PAGE ----
function renderResults() {
  const t = state.currentTournament;
  const standings = state.standings;

  return `
    ${renderNav()}
    <div class="max-w-4xl mx-auto px-4 py-8 fade-in">
      <button onclick="navigate('tournament')" class="text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center text-sm"><i class="fas fa-arrow-left mr-2"></i>돌아가기</button>
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-trophy mr-2 text-yellow-500"></i>${t ? t.name : ''} - 최종 결과</h2>
          <button onclick="exportToPDF()" class="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition"><i class="fas fa-file-pdf mr-2"></i>PDF 저장</button>
        </div>
        
        <!-- Top 3 Podium -->
        ${standings.length >= 3 ? `
        <div class="flex items-end justify-center gap-4 mb-8">
          <div class="text-center">
            <div class="w-20 h-24 bg-gray-100 rounded-t-xl flex items-center justify-center text-4xl">🥈</div>
            <div class="bg-gray-200 rounded-b-xl p-2"><p class="font-bold text-sm">${standings[1]?.name || ''}</p><p class="text-xs text-gray-500">${standings[1]?.points || 0}점</p></div>
          </div>
          <div class="text-center -mt-4">
            <div class="w-24 h-32 bg-yellow-50 rounded-t-xl flex items-center justify-center text-5xl border-2 border-yellow-300">🥇</div>
            <div class="bg-yellow-100 rounded-b-xl p-2 border-2 border-t-0 border-yellow-300"><p class="font-bold">${standings[0]?.name || ''}</p><p class="text-xs text-yellow-700">${standings[0]?.points || 0}점</p></div>
          </div>
          <div class="text-center">
            <div class="w-20 h-20 bg-orange-50 rounded-t-xl flex items-center justify-center text-4xl">🥉</div>
            <div class="bg-orange-100 rounded-b-xl p-2"><p class="font-bold text-sm">${standings[2]?.name || ''}</p><p class="text-xs text-gray-500">${standings[2]?.points || 0}점</p></div>
          </div>
        </div>` : ''}

        <!-- Full Rankings Table -->
        <div id="results-table" class="overflow-hidden rounded-xl border border-gray-200">
          <table class="w-full">
            <thead class="bg-gray-800 text-white">
              <tr>
                <th class="px-4 py-3 text-center text-sm">순위</th>
                <th class="px-4 py-3 text-left text-sm">이름</th>
                <th class="px-4 py-3 text-center text-sm">승점</th>
                <th class="px-4 py-3 text-center text-sm">승</th>
                <th class="px-4 py-3 text-center text-sm">패</th>
                <th class="px-4 py-3 text-center text-sm">득점</th>
                <th class="px-4 py-3 text-center text-sm">실점</th>
                <th class="px-4 py-3 text-center text-sm">득실차</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${standings.length === 0 ? '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">순위 데이터가 없습니다.</td></tr>' : ''}
              ${standings.map((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                const bg = i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-gray-50' : i === 2 ? 'bg-orange-50' : '';
                return `<tr class="${bg} hover:bg-gray-50">
                  <td class="px-4 py-3 text-center font-bold text-lg">${medal}</td>
                  <td class="px-4 py-3 font-semibold text-gray-900">${s.name}</td>
                  <td class="px-4 py-3 text-center font-bold text-shuttle-700">${s.points}</td>
                  <td class="px-4 py-3 text-center text-green-600 font-medium">${s.wins}</td>
                  <td class="px-4 py-3 text-center text-red-500 font-medium">${s.losses}</td>
                  <td class="px-4 py-3 text-center">${s.score_for}</td>
                  <td class="px-4 py-3 text-center">${s.score_against}</td>
                  <td class="px-4 py-3 text-center font-bold ${s.goal_difference > 0 ? 'text-green-600' : s.goal_difference < 0 ? 'text-red-500' : 'text-gray-500'}">${s.goal_difference > 0 ? '+' : ''}${s.goal_difference}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ---- COMMON COMPONENTS ----
function renderNav() {
  return `
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a onclick="navigate('home')" class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
          <div class="w-8 h-8 bg-shuttle-600 rounded-lg flex items-center justify-center"><i class="fas fa-shuttlecock text-white text-sm"></i></div>
          <span class="font-bold text-gray-900">배드민턴 대회</span>
        </a>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span class="hidden sm:block">${state.isOnline ? '<i class="fas fa-wifi text-green-500"></i> 온라인' : '<i class="fas fa-wifi text-red-500"></i> 오프라인'}</span>
        </div>
      </div>
    </nav>`;
}

function renderOfflineBanner() {
  return `<div class="bg-yellow-400 text-yellow-900 text-center py-2 text-sm font-medium"><i class="fas fa-exclamation-triangle mr-1"></i>네트워크 연결이 끊겼습니다. 일부 기능이 제한될 수 있습니다.</div>`;
}

// ==========================================
// Event Handlers
// ==========================================
function bindEvents() {
  // Create form
  const createForm = document.getElementById('create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd);
      data.max_participants = parseInt(data.max_participants);
      data.games_per_player = parseInt(data.games_per_player);
      data.courts = parseInt(data.courts);
      try {
        const res = await api('/tournaments', { method: 'POST', body: JSON.stringify(data) });
        showToast('대회가 생성되었습니다!', 'success');
        navigate('home');
        loadTournaments();
      } catch (e) {}
    });
  }

  // Add participant form
  const addForm = document.getElementById('add-participant-form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd);
      const tid = state.currentTournament.id;
      try {
        await api(`/tournaments/${tid}/participants`, { method: 'POST', body: JSON.stringify(data) });
        showToast(`${data.name}님이 등록되었습니다.`, 'success');
        e.target.reset();
        await loadParticipants(tid);
        render();
      } catch (e) {}
    });
  }
}

// ==========================================
// API Calls
// ==========================================
async function loadTournaments() {
  try {
    const data = await api('/tournaments');
    state.tournaments = data.tournaments;
    const listEl = document.getElementById('tournament-list');
    if (listEl) {
      if (state.tournaments.length === 0) {
        listEl.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400"><i class="fas fa-folder-open text-4xl mb-3"></i><p>등록된 대회가 없습니다.</p><p class="text-sm mt-1">새 대회를 만들어보세요!</p></div>';
      } else {
        listEl.innerHTML = state.tournaments.map(renderTournamentCard).join('');
      }
    }
  } catch (e) {}
}

async function openTournament(id) {
  try {
    const data = await api(`/tournaments/${id}`);
    state.currentTournament = data.tournament;
    await loadParticipants(id);
    await loadMatches(id);
    navigate('tournament');
  } catch (e) {}
}

async function loadParticipants(tid) {
  try {
    const data = await api(`/tournaments/${tid}/participants`);
    state.participants = data.participants;
  } catch (e) {}
}

async function loadMatches(tid) {
  try {
    const data = await api(`/tournaments/${tid}/matches`);
    state.matches = data.matches;
  } catch (e) {}
}

async function loadStandingsAndNavigate(tid) {
  try {
    const data = await api(`/tournaments/${tid}/standings`);
    state.standings = data.standings;
    navigate('results');
  } catch (e) {}
}

// Tab switching
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-white', 'shadow-sm', 'text-gray-900');
    btn.classList.add('text-gray-500');
  });
  const activeBtn = document.getElementById(`tab-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-white', 'shadow-sm', 'text-gray-900');
    activeBtn.classList.remove('text-gray-500');
  }
  const content = document.getElementById('tab-content');
  const isAdmin = state.adminAuth[state.currentTournament?.id];
  if (tab === 'participants') {
    content.innerHTML = renderParticipantsTab(isAdmin);
  } else if (tab === 'matches') {
    content.innerHTML = renderMatchesTab(isAdmin);
  }
  bindEvents();
}

// Auth
function showAuthModal(tid) {
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('auth-password').focus();
  state._authTid = tid;
}
function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}
async function authenticate() {
  const pw = document.getElementById('auth-password').value;
  const tid = state._authTid;
  try {
    await api(`/tournaments/${tid}/auth`, { method: 'POST', body: JSON.stringify({ admin_password: pw }) });
    state.adminAuth[tid] = true;
    state.adminPasswords[tid] = pw;
    closeAuthModal();
    showToast('관리자 인증 성공!', 'success');
    render();
  } catch (e) {}
}

// Participant actions
async function togglePaid(pid) {
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/participants/${pid}/paid`, { method: 'PATCH' });
    await loadParticipants(tid);
    render();
  } catch (e) {}
}

async function toggleCheckin(pid) {
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/participants/${pid}/checkin`, { method: 'PATCH' });
    await loadParticipants(tid);
    render();
  } catch (e) {}
}

async function deleteParticipant(pid) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/participants/${pid}`, { method: 'DELETE' });
    showToast('참가자가 삭제되었습니다.', 'success');
    await loadParticipants(tid);
    render();
  } catch (e) {}
}

// Bracket generation
async function generateBracket() {
  if (!confirm('대진표를 생성하시겠습니까? 기존 경기 기록이 초기화됩니다.')) return;
  const tid = state.currentTournament.id;
  try {
    const res = await api(`/tournaments/${tid}/brackets/generate`, { method: 'POST' });
    showToast(`대진표가 생성되었습니다! (${res.matchCount}경기)`, 'success');
    await loadMatches(tid);
    // Reload tournament to get updated status
    const tData = await api(`/tournaments/${tid}`);
    state.currentTournament = tData.tournament;
    switchTab('matches');
  } catch (e) {}
}

// Match actions
async function startMatch(mid) {
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/matches/${mid}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'playing' }) });
    showToast('경기가 시작되었습니다!', 'success');
    await loadMatches(tid);
    switchTab('matches');
  } catch (e) {}
}

function showScoreModal(mid) {
  const m = state.matches.find(x => x.id === mid);
  if (!m) return;
  const isDoubles = m.team1_player2 || m.team2_player2;
  const t1Name = isDoubles ? `${m.t1p1_name} · ${m.t1p2_name}` : m.t1p1_name;
  const t2Name = isDoubles ? `${m.t2p1_name} · ${m.t2p2_name}` : m.t2p1_name;

  const modal = document.createElement('div');
  modal.id = 'score-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-bold mb-4"><i class="fas fa-edit mr-2 text-shuttle-500"></i>점수 입력</h3>
      <div class="text-center mb-4">
        <span class="font-semibold text-shuttle-700">${t1Name}</span>
        <span class="mx-2 text-gray-400">vs</span>
        <span class="font-semibold text-red-600">${t2Name}</span>
      </div>
      <div class="space-y-3">
        ${[1, 2, 3].map(s => `
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-500 w-12">${s}세트</span>
            <input id="t1s${s}" type="number" min="0" max="30" value="${m[`team1_set${s}`] || 0}" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-bold outline-none focus:ring-2 focus:ring-shuttle-500">
            <span class="text-gray-400">:</span>
            <input id="t2s${s}" type="number" min="0" max="30" value="${m[`team2_set${s}`] || 0}" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-bold outline-none focus:ring-2 focus:ring-red-500">
          </div>
        `).join('')}
      </div>
      <div class="mt-4">
        <label class="block text-sm font-semibold text-gray-700 mb-2">승자 선택</label>
        <div class="flex gap-2">
          <button onclick="document.getElementById('winner-val').value=1;this.classList.add('ring-2','ring-shuttle-500');this.nextElementSibling.classList.remove('ring-2','ring-shuttle-500')" class="flex-1 py-2 bg-shuttle-50 text-shuttle-700 rounded-lg text-sm font-medium hover:bg-shuttle-100 ${m.winner_team === 1 ? 'ring-2 ring-shuttle-500' : ''}">${t1Name}</button>
          <button onclick="document.getElementById('winner-val').value=2;this.classList.add('ring-2','ring-shuttle-500');this.previousElementSibling.classList.remove('ring-2','ring-shuttle-500')" class="flex-1 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 ${m.winner_team === 2 ? 'ring-2 ring-shuttle-500' : ''}">${t2Name}</button>
        </div>
        <input type="hidden" id="winner-val" value="${m.winner_team || ''}">
      </div>
      <div class="flex gap-2 mt-5">
        <button onclick="document.getElementById('score-modal').remove()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">취소</button>
        <button onclick="submitScore(${mid})" class="flex-1 py-2.5 bg-shuttle-600 text-white rounded-xl font-medium hover:bg-shuttle-700">저장</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitScore(mid) {
  const t1s1 = parseInt(document.getElementById('t1s1').value) || 0;
  const t1s2 = parseInt(document.getElementById('t1s2').value) || 0;
  const t1s3 = parseInt(document.getElementById('t1s3').value) || 0;
  const t2s1 = parseInt(document.getElementById('t2s1').value) || 0;
  const t2s2 = parseInt(document.getElementById('t2s2').value) || 0;
  const t2s3 = parseInt(document.getElementById('t2s3').value) || 0;
  const winner = document.getElementById('winner-val').value;

  const tid = state.currentTournament.id;
  const data = {
    team1_set1: t1s1, team1_set2: t1s2, team1_set3: t1s3,
    team2_set1: t2s1, team2_set2: t2s2, team2_set3: t2s3,
    status: winner ? 'completed' : 'playing',
    winner_team: winner ? parseInt(winner) : null
  };

  try {
    await api(`/tournaments/${tid}/matches/${mid}/score`, { method: 'PUT', body: JSON.stringify(data) });
    document.getElementById('score-modal').remove();
    showToast('점수가 저장되었습니다!', 'success');
    await loadMatches(tid);
    switchTab('matches');
  } catch (e) {}
}

// Scoreboard refresh
async function refreshScoreboard() {
  if (!state.currentTournament) return;
  await loadMatches(state.currentTournament.id);
  render();
}

// PDF Export
async function exportToPDF() {
  try {
    showToast('PDF 생성 중...', 'info');
    const element = document.getElementById('results-table');
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.setFontSize(18);
    pdf.text(state.currentTournament?.name || '대회 결과', 14, 15);
    pdf.setFontSize(10);
    pdf.text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, 14, 22);
    pdf.addImage(imgData, 'PNG', 10, 28, pdfWidth - 20, pdfHeight - 20);
    pdf.save(`${state.currentTournament?.name || 'tournament'}-결과.pdf`);
    showToast('PDF가 저장되었습니다!', 'success');
  } catch (e) {
    showToast('PDF 생성에 실패했습니다.', 'error');
  }
}

// ==========================================
// Initialize
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  render();
  loadTournaments();
});
