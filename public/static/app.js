// ==========================================
// 배드민턴 대회 운영 시스템 - Frontend App
// ==========================================
const API = '/api';
const CATEGORIES = { md: '남자복식', wd: '여자복식', xd: '혼합복식' };
const LEVELS = { s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' };
const LEVEL_COLORS = { s: 'bg-red-100 text-red-700', a: 'bg-orange-100 text-orange-700', b: 'bg-yellow-100 text-yellow-700', c: 'bg-green-100 text-green-700', d: 'bg-blue-100 text-blue-700', e: 'bg-gray-100 text-gray-600' };
const AGE_GROUPS = [
  { value: 'open', label: '오픈 (전연령)' },
  { value: '20대', label: '20대' }, { value: '30대', label: '30대' },
  { value: '40대', label: '40대' }, { value: '50대이상', label: '50대 이상' }
];

// State
const state = {
  currentPage: 'home', tournaments: [], currentTournament: null,
  participants: [], events: [], currentEvent: null, teams: [],
  matches: [], standings: [], adminAuth: {}, adminPasswords: {},
  activeTab: 'participants', isOnline: navigator.onLine
};

// API Helper
async function api(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '요청 실패');
    return data;
  } catch (err) {
    showToast(navigator.onLine ? err.message : '네트워크 연결을 확인해주세요.', 'error');
    throw err;
  }
}

// Toast
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  const c = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500 text-gray-900' };
  const ic = { info: 'fa-info-circle', success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
  t.className = `fixed top-4 right-4 z-[9999] px-5 py-3 rounded-lg text-white shadow-lg ${c[type]} fade-in flex items-center gap-2`;
  t.innerHTML = `<i class="fas ${ic[type]}"></i><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function navigate(page, params = {}) { state.currentPage = page; Object.assign(state, params); render(); }

// ==========================================
// RENDER
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

window.addEventListener('online', () => { state.isOnline = true; render(); showToast('네트워크 연결됨', 'success'); });
window.addEventListener('offline', () => { state.isOnline = false; render(); showToast('네트워크 끊김', 'warning'); });

// ==========================================
// NAV & COMMON
// ==========================================
function renderNav() {
  return `<nav class="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
      <a onclick="navigate('home')" class="flex items-center gap-2 cursor-pointer hover:opacity-80"><div class="w-8 h-8 bg-shuttle-600 rounded-lg flex items-center justify-center"><i class="fas fa-shuttlecock text-white text-sm"></i></div><span class="font-bold text-gray-900">배드민턴 대회</span></a>
    </div>
  </nav>`;
}
function renderOffline() { return !state.isOnline ? '<div class="bg-yellow-400 text-yellow-900 text-center py-2 text-sm font-medium"><i class="fas fa-exclamation-triangle mr-1"></i>오프라인</div>' : ''; }

// ==========================================
// HOME
// ==========================================
function renderHome() {
  return `${renderNav()}${renderOffline()}
  <div class="max-w-5xl mx-auto px-4 py-8 fade-in">
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-shuttle-400 to-shuttle-600 mb-4 shadow-lg"><i class="fas fa-shuttlecock text-3xl text-white"></i></div>
      <h1 class="text-4xl font-extrabold text-gray-900 mb-3">배드민턴 대회 운영</h1>
      <p class="text-lg text-gray-500">남복 · 여복 · 혼복 종목별, 연령별, 급수별 대진 관리</p>
      <button onclick="navigate('create')" class="mt-6 px-8 py-3 bg-shuttle-600 text-white rounded-xl font-semibold hover:bg-shuttle-700 transition shadow-md"><i class="fas fa-plus mr-2"></i>새 대회 만들기</button>
    </div>
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-trophy mr-2 text-yellow-500"></i>대회 목록</h2>
      <button onclick="loadTournaments()" class="text-sm text-gray-500 hover:text-gray-700"><i class="fas fa-sync-alt mr-1"></i>새로고침</button>
    </div>
    <div id="tournament-list" class="grid gap-4 sm:grid-cols-2"><div class="col-span-full text-center py-12 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div></div>
  </div>`;
}

function renderTournamentCard(t) {
  const st = { draft: { l: '준비중', c: 'bg-gray-100 text-gray-600', i: 'fa-pen' }, open: { l: '접수중', c: 'bg-blue-100 text-blue-700', i: 'fa-door-open' }, in_progress: { l: '진행중', c: 'bg-green-100 text-green-700', i: 'fa-play' }, completed: { l: '완료', c: 'bg-purple-100 text-purple-700', i: 'fa-flag-checkered' }, cancelled: { l: '취소', c: 'bg-red-100 text-red-600', i: 'fa-ban' } };
  const s = st[t.status] || st.draft;
  const fmt = { kdk: 'KDK', league: '풀리그', tournament: '토너먼트' };
  return `<div class="bg-white rounded-xl border border-gray-200 p-5 card-hover cursor-pointer" onclick="openTournament(${t.id})">
    <div class="flex items-start justify-between mb-3"><h3 class="font-bold text-gray-900 text-lg">${t.name}</h3><span class="badge ${s.c} ml-2 whitespace-nowrap"><i class="fas ${s.i} mr-1"></i>${s.l}</span></div>
    <p class="text-sm text-gray-500 mb-3">${t.description || ''}</p>
    <div class="flex items-center gap-4 text-xs text-gray-400"><span><i class="fas fa-gamepad mr-1"></i>${fmt[t.format] || t.format}</span><span><i class="fas fa-table-tennis-paddle-ball mr-1"></i>${t.courts}코트</span></div>
  </div>`;
}

// ==========================================
// CREATE
// ==========================================
function renderCreate() {
  return `${renderNav()}
  <div class="max-w-2xl mx-auto px-4 py-8 fade-in">
    <button onclick="navigate('home')" class="text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center text-sm"><i class="fas fa-arrow-left mr-2"></i>돌아가기</button>
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6"><i class="fas fa-plus-circle mr-2 text-shuttle-500"></i>새 대회 만들기</h2>
      <form id="create-form" class="space-y-5">
        <div><label class="block text-sm font-semibold text-gray-700 mb-1">대회명 <span class="text-red-500">*</span></label>
          <input name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none" placeholder="예: 2026 봄맞이 배드민턴 대회"></div>
        <div><label class="block text-sm font-semibold text-gray-700 mb-1">설명</label>
          <textarea name="description" rows="2" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none" placeholder="대회 안내 사항"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">대회 방식</label>
            <select name="format" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none">
              <option value="kdk">KDK (랜덤 대진)</option><option value="league">풀리그</option><option value="tournament">토너먼트</option></select></div>
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">코트 수</label>
            <input name="courts" type="number" value="2" min="1" max="20" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none"></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">팀당 경기 수 (KDK)</label>
            <input name="games_per_player" type="number" value="4" min="1" max="20" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none"></div>
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">급수합병 기준 (팀 수)</label>
            <input name="merge_threshold" type="number" value="4" min="2" max="20" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none">
            <p class="text-xs text-gray-400 mt-1">종목의 참가팀이 이 수 미만이면 인접 급수와 합병</p></div>
        </div>
        <div><label class="block text-sm font-semibold text-gray-700 mb-1">관리자 비밀번호 <span class="text-red-500">*</span></label>
          <input name="admin_password" type="password" required class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-shuttle-500 outline-none" placeholder="대회 관리용 비밀번호"></div>
        <button type="submit" class="w-full py-3 bg-shuttle-600 text-white rounded-xl font-semibold hover:bg-shuttle-700 transition shadow-md text-lg"><i class="fas fa-rocket mr-2"></i>대회 생성</button>
      </form>
    </div>
  </div>`;
}

// ==========================================
// TOURNAMENT DETAIL (Tabs: 참가자, 종목/팀, 경기)
// ==========================================
function renderTournament() {
  const t = state.currentTournament;
  if (!t) return `<div class="text-center py-20"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>`;
  const isAdmin = state.adminAuth[t.id];

  return `${renderNav()}${renderOffline()}
  <div class="max-w-6xl mx-auto px-4 py-6 fade-in">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <button onclick="navigate('home')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200"><i class="fas fa-arrow-left text-gray-600"></i></button>
        <div><h1 class="text-2xl font-bold text-gray-900">${t.name}</h1><p class="text-sm text-gray-500">${{ kdk: 'KDK', league: '풀리그', tournament: '토너먼트' }[t.format]} · ${t.courts}코트</p></div>
      </div>
      <div class="flex items-center gap-2">
        ${!isAdmin ? `<button onclick="showAuthModal(${t.id})" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-lock mr-1"></i>관리자</button>` : `<span class="badge bg-shuttle-100 text-shuttle-700"><i class="fas fa-shield-alt mr-1"></i>관리자</span>`}
        <button onclick="navigate('scoreboard')" class="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100"><i class="fas fa-tv mr-1"></i>스코어보드</button>
        <button onclick="loadStandingsAndNavigate(${t.id})" class="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100"><i class="fas fa-medal mr-1"></i>결과</button>
      </div>
    </div>
    <!-- Tabs -->
    <div class="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
      <button onclick="switchTab('participants')" id="tab-participants" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${state.activeTab==='participants' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}"><i class="fas fa-users mr-1"></i>참가자 (${state.participants.length})</button>
      <button onclick="switchTab('events')" id="tab-events" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${state.activeTab==='events' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}"><i class="fas fa-layer-group mr-1"></i>종목/팀 (${state.events.length})</button>
      <button onclick="switchTab('matches')" id="tab-matches" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${state.activeTab==='matches' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}"><i class="fas fa-table-tennis-paddle-ball mr-1"></i>경기</button>
    </div>
    <div id="tab-content">${state.activeTab==='participants' ? renderParticipantsTab(isAdmin) : state.activeTab==='events' ? renderEventsTab(isAdmin) : renderMatchesTab(isAdmin)}</div>
  </div>
  <!-- Auth Modal -->
  <div id="auth-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
      <h3 class="text-lg font-bold mb-4"><i class="fas fa-lock mr-2 text-shuttle-500"></i>관리자 인증</h3>
      <input id="auth-password" type="password" class="w-full px-4 py-3 border rounded-xl mb-4 outline-none focus:ring-2 focus:ring-shuttle-500" placeholder="관리자 비밀번호">
      <div class="flex gap-2"><button onclick="closeAuthModal()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium">취소</button><button onclick="authenticate()" class="flex-1 py-2.5 bg-shuttle-600 text-white rounded-xl font-medium">확인</button></div>
    </div>
  </div>`;
}

// ---- PARTICIPANTS TAB ----
function renderParticipantsTab(isAdmin) {
  return `<div class="space-y-4">
    ${isAdmin ? `<div class="bg-white rounded-xl border border-gray-200 p-4">
      <h3 class="font-semibold text-gray-800 mb-3"><i class="fas fa-user-plus mr-2 text-shuttle-500"></i>참가자 등록</h3>
      <form id="add-participant-form" class="flex flex-wrap gap-3">
        <input name="name" required placeholder="이름" class="flex-1 min-w-[100px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
        <input name="phone" placeholder="연락처" class="flex-1 min-w-[100px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
        <select name="gender" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500"><option value="m">남</option><option value="f">여</option></select>
        <input name="birth_year" type="number" placeholder="출생년도" min="1950" max="2010" class="w-[100px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
        <select name="level" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
          ${Object.entries(LEVELS).map(([k,v]) => `<option value="${k}" ${k==='c'?'selected':''}>${v}급</option>`).join('')}
        </select>
        <button type="submit" class="px-5 py-2.5 bg-shuttle-600 text-white rounded-lg font-medium hover:bg-shuttle-700"><i class="fas fa-plus mr-1"></i>등록</button>
      </form>
    </div>` : ''}
    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50"><tr>
          <th class="px-3 py-3 text-left text-xs font-semibold text-gray-500">#</th>
          <th class="px-3 py-3 text-left text-xs font-semibold text-gray-500">이름</th>
          <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">성별</th>
          <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">출생</th>
          <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">급수</th>
          <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">참가비</th>
          <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">체크인</th>
          ${isAdmin ? '<th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">관리</th>' : ''}
        </tr></thead>
        <tbody class="divide-y divide-gray-100">
          ${state.participants.length === 0 ? `<tr><td colspan="${isAdmin?8:7}" class="px-4 py-8 text-center text-gray-400">등록된 참가자가 없습니다.</td></tr>` : ''}
          ${state.participants.map((p, i) => {
            const lv = LEVEL_COLORS[p.level] || LEVEL_COLORS.c;
            return `<tr class="hover:bg-gray-50">
              <td class="px-3 py-3 text-sm text-gray-500">${i+1}</td>
              <td class="px-3 py-3 font-medium text-gray-900">${p.name}</td>
              <td class="px-3 py-3 text-center"><span class="badge ${p.gender==='m' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}">${p.gender==='m'?'남':'여'}</span></td>
              <td class="px-3 py-3 text-center text-sm text-gray-500">${p.birth_year || '-'}</td>
              <td class="px-3 py-3 text-center"><span class="badge ${lv}">${LEVELS[p.level]||'C'}</span></td>
              <td class="px-3 py-3 text-center">${isAdmin ? `<button onclick="togglePaid(${p.id})" class="text-lg ${p.paid?'text-green-500':'text-gray-300'} hover:scale-110">${p.paid?'<i class="fas fa-check-circle"></i>':'<i class="far fa-circle"></i>'}</button>` : (p.paid?'<i class="fas fa-check-circle text-green-500"></i>':'<i class="fas fa-times-circle text-gray-300"></i>')}</td>
              <td class="px-3 py-3 text-center">${isAdmin ? `<button onclick="toggleCheckin(${p.id})" class="text-lg ${p.checked_in?'text-blue-500':'text-gray-300'} hover:scale-110">${p.checked_in?'<i class="fas fa-check-circle"></i>':'<i class="far fa-circle"></i>'}</button>` : (p.checked_in?'<i class="fas fa-check-circle text-blue-500"></i>':'<i class="fas fa-times-circle text-gray-300"></i>')}</td>
              ${isAdmin ? `<td class="px-3 py-3 text-center"><button onclick="deleteParticipant(${p.id})" class="text-red-400 hover:text-red-600"><i class="fas fa-trash-alt"></i></button></td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ---- EVENTS TAB ----
function renderEventsTab(isAdmin) {
  const maleP = state.participants.filter(p => p.gender === 'm');
  const femaleP = state.participants.filter(p => p.gender === 'f');

  return `<div class="space-y-4">
    ${isAdmin ? `<div class="bg-white rounded-xl border border-gray-200 p-4">
      <h3 class="font-semibold text-gray-800 mb-3"><i class="fas fa-plus-circle mr-2 text-shuttle-500"></i>종목 추가</h3>
      <form id="add-event-form" class="flex flex-wrap gap-3 items-end">
        <div><label class="block text-xs font-semibold text-gray-500 mb-1">종류</label>
          <select name="category" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
            <option value="md">남자복식</option><option value="wd">여자복식</option><option value="xd">혼합복식</option></select></div>
        <div><label class="block text-xs font-semibold text-gray-500 mb-1">연령대</label>
          <select name="age_group" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
            ${AGE_GROUPS.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}</select></div>
        <div><label class="block text-xs font-semibold text-gray-500 mb-1">급수</label>
          <select name="level_group" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
            <option value="all">전체</option>${Object.entries(LEVELS).map(([k,v]) => `<option value="${k}">${v}급</option>`).join('')}</select></div>
        <button type="submit" class="px-5 py-2.5 bg-shuttle-600 text-white rounded-lg font-medium hover:bg-shuttle-700"><i class="fas fa-plus mr-1"></i>종목 추가</button>
      </form>
    </div>` : ''}
    ${isAdmin ? `<div class="flex gap-2">
      <button onclick="checkMerge()" class="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100"><i class="fas fa-compress-arrows-alt mr-1"></i>급수합병 체크</button>
      ${state.events.length > 0 ? `<button onclick="generateAllBrackets()" class="px-4 py-2 bg-gradient-to-r from-shuttle-500 to-shuttle-700 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg"><i class="fas fa-magic mr-1"></i>전체 대진표 생성</button>` : ''}
    </div>` : ''}
    <div id="merge-result"></div>
    ${state.events.length === 0 ? '<div class="text-center py-12 text-gray-400"><i class="fas fa-layer-group text-4xl mb-3"></i><p>등록된 종목이 없습니다.</p></div>' : ''}
    ${state.events.map(ev => `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <div class="flex items-center gap-2">
            <span class="badge ${ev.category==='md'?'bg-blue-100 text-blue-700':ev.category==='wd'?'bg-pink-100 text-pink-700':'bg-purple-100 text-purple-700'}">${CATEGORIES[ev.category]}</span>
            <h4 class="font-semibold text-gray-800">${ev.name}</h4>
            <span class="text-xs text-gray-400">${ev.team_count || 0}팀</span>
            ${ev.merged_from ? '<span class="badge bg-amber-100 text-amber-700"><i class="fas fa-compress-arrows-alt mr-1"></i>합병</span>' : ''}
          </div>
          <div class="flex items-center gap-2">
            ${isAdmin ? `<button onclick="showTeamModal(${ev.id}, '${ev.category}')" class="px-3 py-1.5 bg-shuttle-50 text-shuttle-700 rounded-lg text-xs font-medium hover:bg-shuttle-100"><i class="fas fa-user-plus mr-1"></i>팀 등록</button>` : ''}
            ${isAdmin ? `<button onclick="deleteEvent(${ev.id})" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-trash-alt"></i></button>` : ''}
          </div>
        </div>
        <div id="teams-${ev.id}" class="p-3">
          <button onclick="loadTeams(${ev.id})" class="text-sm text-shuttle-600 hover:text-shuttle-800"><i class="fas fa-eye mr-1"></i>팀 목록 보기</button>
        </div>
      </div>
    `).join('')}
  </div>`;
}

// ---- MATCHES TAB ----
function renderMatchesTab(isAdmin) {
  const matches = state.matches;
  if (matches.length === 0) return `<div class="text-center py-12 text-gray-400"><i class="fas fa-clipboard-list text-4xl mb-3"></i><p>대진표가 아직 생성되지 않았습니다.</p></div>`;

  // 종목별 → 라운드별 그룹핑
  const byEvent = {};
  matches.forEach(m => {
    if (!byEvent[m.event_name]) byEvent[m.event_name] = {};
    if (!byEvent[m.event_name][m.round]) byEvent[m.event_name][m.round] = [];
    byEvent[m.event_name][m.round].push(m);
  });

  return `<div class="space-y-6">${Object.entries(byEvent).map(([eventName, rounds]) => `
    <div>
      <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-layer-group text-shuttle-500"></i>${eventName}</h3>
      ${Object.entries(rounds).sort(([a],[b]) => a-b).map(([round, ms]) => `
        <div class="mb-4">
          <h4 class="text-sm font-semibold text-gray-500 mb-2">${round}라운드</h4>
          <div class="grid gap-3 sm:grid-cols-2">${ms.map(m => renderMatchCard(m, isAdmin)).join('')}</div>
        </div>
      `).join('')}
    </div>
  `).join('')}</div>`;
}

function renderMatchCard(m, isAdmin) {
  const st = { pending: { l: '대기', c: 'bg-gray-100 text-gray-600' }, playing: { l: '진행중', c: 'bg-green-100 text-green-700' }, completed: { l: '완료', c: 'bg-blue-100 text-blue-700' } };
  const s = st[m.status] || st.pending;
  const t1 = m.team1_name || 'BYE', t2 = m.team2_name || 'BYE';
  const t1T = (m.team1_set1||0)+(m.team1_set2||0)+(m.team1_set3||0);
  const t2T = (m.team2_set1||0)+(m.team2_set2||0)+(m.team2_set3||0);
  return `<div class="bg-white rounded-xl border ${m.status==='playing'?'border-green-300 ring-2 ring-green-100':'border-gray-200'} p-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2"><span class="text-xs text-gray-400">#${m.match_order}</span>${m.court_number?`<span class="badge bg-yellow-50 text-yellow-700">${m.court_number}코트</span>`:''}</div>
      <div class="flex items-center gap-2">${m.status==='playing'?'<span class="w-2 h-2 rounded-full bg-green-500 pulse-live"></span>':''}<span class="badge ${s.c}">${s.l}</span></div>
    </div>
    <div class="space-y-2">
      <div class="flex items-center justify-between ${m.winner_team===1?'font-bold text-shuttle-700':''}"><span class="text-sm">${m.winner_team===1?'🏆 ':''}${t1}</span><span class="scoreboard-num text-lg font-bold">${t1T}</span></div>
      <div class="flex items-center justify-between ${m.winner_team===2?'font-bold text-shuttle-700':''}"><span class="text-sm">${m.winner_team===2?'🏆 ':''}${t2}</span><span class="scoreboard-num text-lg font-bold">${t2T}</span></div>
    </div>
    ${isAdmin && m.status!=='cancelled' ? `<div class="mt-3 pt-3 border-t border-gray-100 flex gap-2">
      ${m.status==='pending'?`<button onclick="startMatch(${m.id})" class="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100"><i class="fas fa-play mr-1"></i>시작</button>`:''}
      ${m.status==='playing'?`<button onclick="showScoreModal(${m.id})" class="flex-1 py-2 bg-shuttle-50 text-shuttle-700 rounded-lg text-sm font-medium hover:bg-shuttle-100"><i class="fas fa-edit mr-1"></i>점수 입력</button>`:''}
      ${m.status==='completed'?`<button onclick="showScoreModal(${m.id})" class="flex-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100"><i class="fas fa-edit mr-1"></i>수정</button>`:''}
    </div>` : ''}
  </div>`;
}

// ---- SCOREBOARD ----
function renderScoreboard() {
  const t = state.currentTournament;
  const playing = state.matches.filter(m => m.status === 'playing');
  const pending = state.matches.filter(m => m.status === 'pending');
  const completed = state.matches.filter(m => m.status === 'completed');
  return `<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
    <div class="max-w-6xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-8">
        <div><button onclick="navigate('tournament')" class="text-gray-400 hover:text-white mb-2 inline-flex items-center text-sm"><i class="fas fa-arrow-left mr-2"></i>돌아가기</button><h1 class="text-3xl font-extrabold">${t?t.name:'스코어보드'}</h1></div>
        <button onclick="refreshScoreboard()" class="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20"><i class="fas fa-sync-alt mr-1"></i>새로고침</button>
      </div>
      ${playing.length > 0 ? `<div class="mb-8"><h2 class="text-lg font-bold mb-4 flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-green-500 pulse-live"></span>진행 중</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${playing.map(m => renderScoreCard(m)).join('')}</div></div>` : '<div class="text-center py-8 text-gray-500 mb-8"><p>진행 중인 경기 없음</p></div>'}
      <div class="grid grid-cols-3 gap-4 mb-8">
        <div class="bg-white/5 rounded-xl p-4 text-center"><div class="text-3xl font-extrabold text-green-400">${playing.length}</div><div class="text-xs text-gray-400">진행중</div></div>
        <div class="bg-white/5 rounded-xl p-4 text-center"><div class="text-3xl font-extrabold text-yellow-400">${pending.length}</div><div class="text-xs text-gray-400">대기중</div></div>
        <div class="bg-white/5 rounded-xl p-4 text-center"><div class="text-3xl font-extrabold text-blue-400">${completed.length}</div><div class="text-xs text-gray-400">완료</div></div>
      </div>
      ${completed.length > 0 ? `<h2 class="text-lg font-bold mb-4"><i class="fas fa-history mr-2"></i>최근 결과</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${completed.slice(-6).reverse().map(m => renderScoreCard(m)).join('')}</div>` : ''}
    </div>
  </div>`;
}

function renderScoreCard(m) {
  const t1 = m.team1_name || 'BYE', t2 = m.team2_name || 'BYE';
  const t1T = (m.team1_set1||0)+(m.team1_set2||0)+(m.team1_set3||0), t2T = (m.team2_set1||0)+(m.team2_set2||0)+(m.team2_set3||0);
  const live = m.status==='playing';
  return `<div class="bg-white/10 rounded-xl p-4 ${live?'ring-2 ring-green-500/50':''}">
    <div class="flex justify-between mb-2"><span class="text-xs text-gray-400">#${m.match_order} ${m.event_name||''}</span>${live?'<span class="text-xs text-green-400 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500 pulse-live"></span>LIVE</span>':'<span class="text-xs text-blue-400">완료</span>'}</div>
    <div class="space-y-2">
      <div class="flex justify-between ${m.winner_team===1?'text-yellow-400':''}"><span class="text-sm font-medium">${m.winner_team===1?'🏆 ':''}${t1}</span><span class="text-2xl font-extrabold scoreboard-num">${t1T}</span></div>
      <div class="h-px bg-white/10"></div>
      <div class="flex justify-between ${m.winner_team===2?'text-yellow-400':''}"><span class="text-sm font-medium">${m.winner_team===2?'🏆 ':''}${t2}</span><span class="text-2xl font-extrabold scoreboard-num">${t2T}</span></div>
    </div>
  </div>`;
}

// ---- RESULTS ----
function renderResults() {
  const t = state.currentTournament;
  // 종목별 그룹핑
  const byEvent = {};
  state.standings.forEach(s => {
    const key = s.event_name || '전체';
    if (!byEvent[key]) byEvent[key] = [];
    byEvent[key].push(s);
  });

  return `${renderNav()}
  <div class="max-w-5xl mx-auto px-4 py-8 fade-in">
    <button onclick="navigate('tournament')" class="text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center text-sm"><i class="fas fa-arrow-left mr-2"></i>돌아가기</button>
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-trophy mr-2 text-yellow-500"></i>${t?t.name:''} - 결과</h2>
        <button onclick="exportToPDF()" class="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100"><i class="fas fa-file-pdf mr-2"></i>PDF 저장</button>
      </div>
      <div id="results-table">
      ${Object.entries(byEvent).map(([eventName, standings]) => `
        <div class="mb-8">
          <h3 class="text-lg font-bold text-gray-800 mb-3"><i class="fas fa-medal mr-2 text-yellow-500"></i>${eventName}</h3>
          ${standings.length >= 3 ? `<div class="flex items-end justify-center gap-4 mb-4">
            <div class="text-center"><div class="w-16 h-20 bg-gray-100 rounded-t-xl flex items-center justify-center text-3xl">🥈</div><div class="bg-gray-200 rounded-b-xl p-1.5"><p class="font-bold text-xs">${standings[1]?.team_name||''}</p></div></div>
            <div class="text-center -mt-4"><div class="w-20 h-28 bg-yellow-50 rounded-t-xl flex items-center justify-center text-4xl border-2 border-yellow-300">🥇</div><div class="bg-yellow-100 rounded-b-xl p-1.5 border-2 border-t-0 border-yellow-300"><p class="font-bold text-sm">${standings[0]?.team_name||''}</p></div></div>
            <div class="text-center"><div class="w-16 h-16 bg-orange-50 rounded-t-xl flex items-center justify-center text-3xl">🥉</div><div class="bg-orange-100 rounded-b-xl p-1.5"><p class="font-bold text-xs">${standings[2]?.team_name||''}</p></div></div>
          </div>` : ''}
          <table class="w-full rounded-lg overflow-hidden border border-gray-200 mb-2"><thead class="bg-gray-800 text-white"><tr>
            <th class="px-3 py-2 text-center text-sm">순위</th><th class="px-3 py-2 text-left text-sm">팀</th><th class="px-3 py-2 text-center text-sm">승점</th><th class="px-3 py-2 text-center text-sm">승</th><th class="px-3 py-2 text-center text-sm">패</th><th class="px-3 py-2 text-center text-sm">득실차</th>
          </tr></thead><tbody class="divide-y divide-gray-100">
            ${standings.map((s, i) => {
              const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;
              const bg = i===0?'bg-yellow-50':i===1?'bg-gray-50':i===2?'bg-orange-50':'';
              return `<tr class="${bg}"><td class="px-3 py-2 text-center font-bold">${medal}</td><td class="px-3 py-2 font-semibold">${s.team_name}</td><td class="px-3 py-2 text-center font-bold text-shuttle-700">${s.points}</td><td class="px-3 py-2 text-center text-green-600">${s.wins}</td><td class="px-3 py-2 text-center text-red-500">${s.losses}</td><td class="px-3 py-2 text-center font-bold ${s.goal_difference>0?'text-green-600':s.goal_difference<0?'text-red-500':'text-gray-500'}">${s.goal_difference>0?'+':''}${s.goal_difference}</td></tr>`;
            }).join('')}
          </tbody></table>
        </div>
      `).join('')}
      </div>
    </div>
  </div>`;
}

// ==========================================
// EVENT HANDLERS
// ==========================================
function bindEvents() {
  const createForm = document.getElementById('create-form');
  if (createForm) createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.games_per_player = parseInt(data.games_per_player);
    data.courts = parseInt(data.courts);
    data.merge_threshold = parseInt(data.merge_threshold);
    try { await api('/tournaments', { method: 'POST', body: JSON.stringify(data) }); showToast('대회가 생성되었습니다!', 'success'); navigate('home'); loadTournaments(); } catch(e){}
  });

  const addPForm = document.getElementById('add-participant-form');
  if (addPForm) addPForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    if (data.birth_year) data.birth_year = parseInt(data.birth_year);
    const tid = state.currentTournament.id;
    try { await api(`/tournaments/${tid}/participants`, { method: 'POST', body: JSON.stringify(data) }); showToast(`${data.name}님 등록!`, 'success'); e.target.reset(); await loadParticipants(tid); render(); } catch(e){}
  });

  const addEForm = document.getElementById('add-event-form');
  if (addEForm) addEForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    const tid = state.currentTournament.id;
    try { await api(`/tournaments/${tid}/events`, { method: 'POST', body: JSON.stringify(data) }); showToast('종목이 추가되었습니다!', 'success'); await loadEvents(tid); render(); } catch(e){}
  });
}

// ==========================================
// API CALLS
// ==========================================
async function loadTournaments() {
  try { const d = await api('/tournaments'); state.tournaments = d.tournaments;
    const el = document.getElementById('tournament-list');
    if (el) el.innerHTML = state.tournaments.length === 0 ? '<div class="col-span-full text-center py-12 text-gray-400"><i class="fas fa-folder-open text-4xl mb-3"></i><p>등록된 대회가 없습니다.</p></div>' : state.tournaments.map(renderTournamentCard).join('');
  } catch(e){}
}

async function openTournament(id) {
  try {
    const d = await api(`/tournaments/${id}`); state.currentTournament = d.tournament;
    await loadParticipants(id); await loadEvents(id); await loadMatches(id);
    state.activeTab = 'participants'; navigate('tournament');
  } catch(e){}
}

async function loadParticipants(tid) { try { const d = await api(`/tournaments/${tid}/participants`); state.participants = d.participants; } catch(e){} }
async function loadEvents(tid) { try { const d = await api(`/tournaments/${tid}/events`); state.events = d.events; } catch(e){} }
async function loadMatches(tid) { try { const d = await api(`/tournaments/${tid}/matches`); state.matches = d.matches; } catch(e){} }

async function loadStandingsAndNavigate(tid) {
  try { const d = await api(`/tournaments/${tid}/standings`); state.standings = d.standings; navigate('results'); } catch(e){}
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('bg-white','shadow-sm','text-gray-900'); b.classList.add('text-gray-500'); });
  const btn = document.getElementById(`tab-${tab}`);
  if (btn) { btn.classList.add('bg-white','shadow-sm','text-gray-900'); btn.classList.remove('text-gray-500'); }
  const content = document.getElementById('tab-content');
  const isAdmin = state.adminAuth[state.currentTournament?.id];
  if (tab==='participants') content.innerHTML = renderParticipantsTab(isAdmin);
  else if (tab==='events') content.innerHTML = renderEventsTab(isAdmin);
  else content.innerHTML = renderMatchesTab(isAdmin);
  bindEvents();
}

// Auth
function showAuthModal(tid) { document.getElementById('auth-modal').classList.remove('hidden'); document.getElementById('auth-password').focus(); state._authTid = tid; }
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }
async function authenticate() {
  const pw = document.getElementById('auth-password').value;
  try { await api(`/tournaments/${state._authTid}/auth`, { method: 'POST', body: JSON.stringify({ admin_password: pw }) });
    state.adminAuth[state._authTid] = true; state.adminPasswords[state._authTid] = pw; closeAuthModal(); showToast('관리자 인증 성공!', 'success'); render();
  } catch(e){}
}

// Participant actions
async function togglePaid(pid) { const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/participants/${pid}/paid`, { method: 'PATCH' }); await loadParticipants(tid); render(); } catch(e){} }
async function toggleCheckin(pid) { const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/participants/${pid}/checkin`, { method: 'PATCH' }); await loadParticipants(tid); render(); } catch(e){} }
async function deleteParticipant(pid) { if (!confirm('삭제하시겠습니까?')) return; const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/participants/${pid}`, { method: 'DELETE' }); showToast('삭제됨', 'success'); await loadParticipants(tid); render(); } catch(e){} }

// Event actions
async function deleteEvent(eid) { if (!confirm('종목과 관련 팀/경기를 모두 삭제합니다.')) return; const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/events/${eid}`, { method: 'DELETE' }); showToast('종목 삭제됨', 'success'); await loadEvents(tid); render(); } catch(e){} }

async function loadTeams(eid) {
  const tid = state.currentTournament.id;
  const isAdmin = state.adminAuth[tid];
  try {
    const d = await api(`/tournaments/${tid}/events/${eid}/teams`);
    const el = document.getElementById(`teams-${eid}`);
    if (d.teams.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 py-2">등록된 팀이 없습니다.</p>'; return; }
    el.innerHTML = `<div class="space-y-1">${d.teams.map((t, i) => `
      <div class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
        <div class="flex items-center gap-2"><span class="text-xs text-gray-400 w-5">${i+1}</span><span class="font-medium text-sm">${t.team_name}</span>
          <span class="badge ${LEVEL_COLORS[t.p1_level]||''} text-xs">${LEVELS[t.p1_level]||''}</span><span class="badge ${LEVEL_COLORS[t.p2_level]||''} text-xs">${LEVELS[t.p2_level]||''}</span></div>
        ${isAdmin ? `<button onclick="deleteTeam(${eid},${t.id})" class="text-red-400 hover:text-red-600 text-xs"><i class="fas fa-times"></i></button>` : ''}
      </div>
    `).join('')}</div>`;
  } catch(e){}
}

async function deleteTeam(eid, teamId) {
  const tid = state.currentTournament.id;
  try { await api(`/tournaments/${tid}/events/${eid}/teams/${teamId}`, { method: 'DELETE' }); showToast('팀 삭제됨', 'success'); loadTeams(eid); await loadEvents(tid); } catch(e){}
}

// Team registration modal
function showTeamModal(eid, category) {
  let filtered1 = state.participants, filtered2 = state.participants;
  if (category === 'md') { filtered1 = state.participants.filter(p => p.gender === 'm'); filtered2 = filtered1; }
  else if (category === 'wd') { filtered1 = state.participants.filter(p => p.gender === 'f'); filtered2 = filtered1; }
  else { filtered1 = state.participants; filtered2 = state.participants; }

  const modal = document.createElement('div');
  modal.id = 'team-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-plus mr-2 text-shuttle-500"></i>팀 등록 - ${CATEGORIES[category]}</h3>
    ${category === 'xd' ? '<p class="text-xs text-gray-500 mb-3">혼합복식: 남녀 한 명씩 선택</p>' : ''}
    <div class="space-y-3">
      <div><label class="block text-sm font-semibold text-gray-700 mb-1">${category==='xd'?'남자':'선수'} 1</label>
        <select id="team-p1" class="w-full px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
          ${(category==='xd'?state.participants.filter(p=>p.gender==='m'):filtered1).map(p => `<option value="${p.id}">${p.name} (${LEVELS[p.level]}급${p.birth_year?' · '+p.birth_year:''})</option>`).join('')}
        </select></div>
      <div><label class="block text-sm font-semibold text-gray-700 mb-1">${category==='xd'?'여자':'선수'} 2</label>
        <select id="team-p2" class="w-full px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-shuttle-500">
          ${(category==='xd'?state.participants.filter(p=>p.gender==='f'):filtered2).map(p => `<option value="${p.id}">${p.name} (${LEVELS[p.level]}급${p.birth_year?' · '+p.birth_year:''})</option>`).join('')}
        </select></div>
    </div>
    <div class="flex gap-2 mt-5"><button onclick="document.getElementById('team-modal').remove()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium">취소</button>
      <button onclick="submitTeam(${eid})" class="flex-1 py-2.5 bg-shuttle-600 text-white rounded-xl font-medium">등록</button></div>
  </div>`;
  document.body.appendChild(modal);
}

async function submitTeam(eid) {
  const p1 = parseInt(document.getElementById('team-p1').value);
  const p2 = parseInt(document.getElementById('team-p2').value);
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/events/${eid}/teams`, { method: 'POST', body: JSON.stringify({ player1_id: p1, player2_id: p2 }) });
    document.getElementById('team-modal').remove(); showToast('팀 등록!', 'success');
    await loadEvents(tid); loadTeams(eid);
  } catch(e){}
}

// Merge check
async function checkMerge() {
  const tid = state.currentTournament.id;
  try {
    const d = await api(`/tournaments/${tid}/events/check-merge`, { method: 'POST' });
    const el = document.getElementById('merge-result');
    if (d.merges.length === 0) { el.innerHTML = '<div class="p-3 bg-green-50 text-green-700 rounded-lg text-sm mb-4"><i class="fas fa-check mr-1"></i>급수합병 대상이 없습니다. (기준: 종목당 최소 ' + d.threshold + '팀)</div>'; return; }
    el.innerHTML = `<div class="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
      <h4 class="font-bold text-amber-800 mb-2"><i class="fas fa-compress-arrows-alt mr-1"></i>급수합병 필요 (기준: ${d.threshold}팀 미만)</h4>
      ${d.merges.map((m, i) => `<div class="flex items-center justify-between py-2 ${i>0?'border-t border-amber-100':''}">
        <div><p class="text-sm font-medium text-amber-900">${m.merged_name}</p><p class="text-xs text-amber-600">${m.reason}</p></div>
        <button onclick="executeMerge([${m.events.map(e=>e.id).join(',')}])" class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">합병 실행</button>
      </div>`).join('')}
    </div>`;
  } catch(e){}
}

async function executeMerge(eventIds) {
  if (!confirm('선택된 종목을 합병합니다.')) return;
  const tid = state.currentTournament.id;
  try { await api(`/tournaments/${tid}/events/execute-merge`, { method: 'POST', body: JSON.stringify({ event_ids: eventIds }) }); showToast('급수합병 완료!', 'success'); await loadEvents(tid); render(); } catch(e){}
}

// Generate brackets
async function generateAllBrackets() {
  if (!confirm('전체 종목의 대진표를 생성합니다. 기존 경기가 초기화됩니다.')) return;
  const tid = state.currentTournament.id;
  try {
    const res = await api(`/tournaments/${tid}/brackets/generate`, { method: 'POST', body: '{}' });
    showToast(`대진표 생성! (${res.matchCount}경기)`, 'success');
    await loadMatches(tid); const tData = await api(`/tournaments/${tid}`); state.currentTournament = tData.tournament;
    switchTab('matches');
  } catch(e){}
}

// Match actions
async function startMatch(mid) { const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/matches/${mid}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'playing' }) }); showToast('경기 시작!', 'success'); await loadMatches(tid); switchTab('matches'); } catch(e){} }

function showScoreModal(mid) {
  const m = state.matches.find(x => x.id === mid); if (!m) return;
  const modal = document.createElement('div'); modal.id = 'score-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-edit mr-2 text-shuttle-500"></i>점수 입력</h3>
    <div class="text-center mb-4"><span class="font-semibold text-shuttle-700">${m.team1_name||'팀1'}</span><span class="mx-2 text-gray-400">vs</span><span class="font-semibold text-red-600">${m.team2_name||'팀2'}</span></div>
    <div class="space-y-3">${[1,2,3].map(s => `<div class="flex items-center gap-3"><span class="text-sm font-medium text-gray-500 w-12">${s}세트</span>
      <input id="t1s${s}" type="number" min="0" max="30" value="${m[`team1_set${s}`]||0}" class="flex-1 px-3 py-2 border rounded-lg text-center text-lg font-bold outline-none focus:ring-2 focus:ring-shuttle-500"><span class="text-gray-400">:</span>
      <input id="t2s${s}" type="number" min="0" max="30" value="${m[`team2_set${s}`]||0}" class="flex-1 px-3 py-2 border rounded-lg text-center text-lg font-bold outline-none focus:ring-2 focus:ring-red-500"></div>`).join('')}</div>
    <div class="mt-4"><label class="block text-sm font-semibold text-gray-700 mb-2">승자</label>
      <div class="flex gap-2">
        <button onclick="document.getElementById('winner-val').value=1;this.classList.add('ring-2','ring-shuttle-500');this.nextElementSibling.classList.remove('ring-2','ring-shuttle-500')" class="flex-1 py-2 bg-shuttle-50 text-shuttle-700 rounded-lg text-sm font-medium ${m.winner_team===1?'ring-2 ring-shuttle-500':''}">${m.team1_name||'팀1'}</button>
        <button onclick="document.getElementById('winner-val').value=2;this.classList.add('ring-2','ring-shuttle-500');this.previousElementSibling.classList.remove('ring-2','ring-shuttle-500')" class="flex-1 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium ${m.winner_team===2?'ring-2 ring-shuttle-500':''}">${m.team2_name||'팀2'}</button>
      </div><input type="hidden" id="winner-val" value="${m.winner_team||''}"></div>
    <div class="flex gap-2 mt-5"><button onclick="document.getElementById('score-modal').remove()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium">취소</button><button onclick="submitScore(${mid})" class="flex-1 py-2.5 bg-shuttle-600 text-white rounded-xl font-medium">저장</button></div>
  </div>`;
  document.body.appendChild(modal);
}

async function submitScore(mid) {
  const data = { team1_set1: +document.getElementById('t1s1').value||0, team1_set2: +document.getElementById('t1s2').value||0, team1_set3: +document.getElementById('t1s3').value||0,
    team2_set1: +document.getElementById('t2s1').value||0, team2_set2: +document.getElementById('t2s2').value||0, team2_set3: +document.getElementById('t2s3').value||0 };
  const w = document.getElementById('winner-val').value;
  data.status = w ? 'completed' : 'playing'; data.winner_team = w ? parseInt(w) : null;
  const tid = state.currentTournament.id;
  try { await api(`/tournaments/${tid}/matches/${mid}/score`, { method: 'PUT', body: JSON.stringify(data) }); document.getElementById('score-modal').remove(); showToast('점수 저장!', 'success'); await loadMatches(tid); switchTab('matches'); } catch(e){}
}

async function refreshScoreboard() { if (state.currentTournament) { await loadMatches(state.currentTournament.id); render(); } }

async function exportToPDF() {
  try { showToast('PDF 생성 중...', 'info');
    const el = document.getElementById('results-table'); const canvas = await html2canvas(el, { scale: 2 });
    const img = canvas.toDataURL('image/png'); const { jsPDF } = window.jspdf; const pdf = new jsPDF('l','mm','a4');
    const w = pdf.internal.pageSize.getWidth(); const h = (canvas.height*w)/canvas.width;
    pdf.setFontSize(18); pdf.text(state.currentTournament?.name||'결과', 14, 15);
    pdf.addImage(img,'PNG',10,25,w-20,h-20); pdf.save(`${state.currentTournament?.name||'대회'}-결과.pdf`);
    showToast('PDF 저장 완료!', 'success');
  } catch(e) { showToast('PDF 생성 실패', 'error'); }
}

// Init
document.addEventListener('DOMContentLoaded', () => { render(); loadTournaments(); });
