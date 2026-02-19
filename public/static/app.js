// ==========================================
// 대회 운영 시스템 - Frontend App (멀티스포츠)
// ==========================================
const ALL_CONFIGS = window.ALL_SPORT_CONFIGS || {};
let SC = window.SPORT_CONFIG || {};
const API = '/api';
let CATEGORIES = SC.categories || { md: '남자복식', wd: '여자복식', xd: '혼합복식' };
let SUPPORTS_SINGLES = SC.supportsSingles || false;
const LEVELS = { s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' };
// ==========================================
// 테마 헬퍼 (SC config 기반 동적 색상)
// P = primary Tailwind 색상명 (blue / emerald)
// ==========================================
let P = (SC.theme && SC.theme.primaryClass) || 'blue';
let EMOJI = SC.emoji || '🏸';
let SCORE_UNIT = (SC.scoring && SC.scoring.scoreUnit) || '점';
let SCORE_LABEL = (SC.scoring && SC.scoring.scoreLabel) || '점수';
let SYSTEM_NAME = SC.name || '대회 운영 시스템';
let T = {};

function buildTheme(p, sc) {
  return {
    bg50: `bg-${p}-50`, bg100: `bg-${p}-100`, bg200: `bg-${p}-200`,
    bg400: `bg-${p}-400`, bg500: `bg-${p}-500`, bg600: `bg-${p}-600`,
    bg700: `bg-${p}-700`,
    text400: `text-${p}-400`, text500: `text-${p}-500`, text600: `text-${p}-600`,
    text700: `text-${p}-700`,
    border100: `border-${p}-100`, border200: `border-${p}-200`,
    border300: `border-${p}-300`, border500: `border-${p}-500`,
    ring100: `ring-${p}-100`,
    badge: `bg-${p}-50 text-${p}-700 border border-${p}-200`,
    statusOpen: `bg-${p}-50 text-${p}-700 border border-${p}-200`,
    dot: `bg-${p}-500`,
    hoverBg50: `hover:bg-${p}-50`, hoverBg100: `hover:bg-${p}-100`,
    hoverBorder: `hover:border-${p}-300`,
    checkedBorder: `has-[:checked]:border-${p}-500`,
    checkedBg: `has-[:checked]:bg-${p}-50`,
    inputColor: `text-${p}-600`,
    gradFrom: (sc.theme && sc.theme.gradientFrom) || 'from-blue-500',
    gradTo: (sc.theme && sc.theme.gradientTo) || 'to-blue-600',
  };
}
T = buildTheme(P, SC);

// ==========================================
// 종목 전환 함수 — 대회 진입 시 호출
// ==========================================
function switchSportConfig(sportName) {
  const cfg = ALL_CONFIGS[sportName];
  if (!cfg) return;
  SC = cfg;
  CATEGORIES = SC.categories || CATEGORIES;
  SUPPORTS_SINGLES = SC.supportsSingles || false;
  P = (SC.theme && SC.theme.primaryClass) || 'blue';
  EMOJI = SC.emoji || '🏸';
  SCORE_UNIT = (SC.scoring && SC.scoring.scoreUnit) || '점';
  SCORE_LABEL = (SC.scoring && SC.scoring.scoreLabel) || '점수';
  SYSTEM_NAME = SC.name || '대회 운영 시스템';
  T = buildTheme(P, SC);
}
const LEVEL_COLORS = { s: 'bg-red-100 text-red-700', a: 'bg-orange-100 text-orange-700', b: 'bg-yellow-100 text-yellow-700', c: 'bg-green-100 text-green-700', d: 'bg-blue-100 text-blue-700', e: 'bg-gray-100 text-gray-600' };
const AGE_GROUPS = [
  { value: 'open', label: '오픈 (전연령)' },
  { value: '20대', label: '20대' }, { value: '30대', label: '30대' },
  { value: '40대', label: '40대' }, { value: '50대', label: '50대' },
  { value: '55대', label: '55대' }, { value: '60대', label: '60대' }
];

function getAgeGroup(birthYear) {
  if (!birthYear) return '-';
  const age = new Date().getFullYear() - birthYear;
  if (age >= 60) return '60대';
  if (age >= 55) return '55대';
  if (age >= 50) return '50대';
  if (age >= 40) return '40대';
  if (age >= 30) return '30대';
  if (age >= 20) return '20대';
  return '10대';
}

// State
const state = {
  currentPage: 'home', tournaments: [], currentTournament: null,
  participants: [], events: [], currentEvent: null, teams: [],
  matches: [], standings: [], adminAuth: {}, adminPasswords: {},
  activeTab: 'participants', isOnline: navigator.onLine,
  targetScore: (SC.scoring && SC.scoring.defaultTargetScore) || 25, format: 'kdk',
  dashboardData: null
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
  const c = { info: T.bg500, success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500 text-gray-900' };
  const ic = { info: 'fa-info-circle', success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
  t.className = `fixed top-4 right-4 z-[9999] px-5 py-3 rounded-lg text-white shadow-lg ${c[type]} fade-in flex items-center gap-2 max-w-md`;
  t.innerHTML = `<i class="fas ${ic[type]}"></i><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 4000);
}

function navigate(page, params = {}) {
  state.currentPage = page;
  Object.assign(state, params);
  // 홈으로 돌아가면 기본 config(badminton)로 복원
  if (page === 'home') switchSportConfig('badminton');
  render();
}

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
    case 'dashboard': app.innerHTML = renderDashboard(); break;
    case 'mypage': app.innerHTML = renderMyPage(); break;
    default: app.innerHTML = renderHome();
  }
  bindEvents();
}

window.addEventListener('online', () => { state.isOnline = true; render(); showToast('네트워크 연결됨', 'success'); });
window.addEventListener('offline', () => { state.isOnline = false; render(); showToast('네트워크 끊김', 'warning'); });

// ==========================================
// NAV & COMMON
// ==========================================
function renderNav(transparent = false) {
  if (transparent) {
    return `<nav class="glass-nav fixed top-0 left-0 right-0 z-40">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a onclick="navigate('home')" class="flex items-center gap-3 cursor-pointer group">
          <div class="w-9 h-9 bg-gradient-to-br ${T.gradFrom} ${T.gradTo} rounded-xl flex items-center justify-center shadow-lg shadow-${P}-500/20 group-hover:shadow-${P}-500/40 transition-shadow">
            <i class="fas ${SC.icon || "fa-trophy"} text-white text-sm"></i>
          </div>
          <span class="font-bold text-white/90 group-hover:text-white transition-colors tracking-tight">${EMOJI} 대회</span>
        </a>
        <div class="flex items-center gap-2">
          <a href="/static/manual.html" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/10 transition-all">
            <i class="fas fa-book"></i><span>매뉴얼</span>
          </a>
        </div>
      </div>
    </nav>`;
  }
  return `<nav class="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <a onclick="navigate('home')" class="flex items-center gap-3 cursor-pointer group">
        <div class="w-9 h-9 bg-gradient-to-br ${T.gradFrom} ${T.gradTo} rounded-xl flex items-center justify-center shadow-lg shadow-${P}-500/20 group-hover:shadow-${P}-500/40 transition-shadow">
          <i class="fas ${SC.icon || "fa-trophy"} text-white text-sm"></i>
        </div>
        <span class="font-bold text-gray-900 tracking-tight">${EMOJI} 대회</span>
      </a>
    </div>
  </nav>`;
}
function renderOffline() { return !state.isOnline ? '<div class="bg-yellow-400 text-yellow-900 text-center py-2 text-sm font-medium"><i class="fas fa-exclamation-triangle mr-1"></i>오프라인</div>' : ''; }

// ==========================================
// HOME
// ==========================================
function renderHome() {
  return `${renderNav(true)}${renderOffline()}
  <!-- Hero Section -->
  <section class="hero-bg pt-16">
    <div class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div class="text-center fade-in">
        <!-- Logo Icon -->
        <div class="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br ${T.gradFrom} ${T.gradTo} mb-8 shadow-2xl shadow-${P}-500/30 glow-${P} float-anim">
          <i class="fas ${SC.icon || "fa-trophy"} text-4xl text-white"></i>
        </div>
        <!-- Title -->
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4 tracking-tight leading-tight">
          ${EMOJI} 대회<br class="sm:hidden"> <span class="text-${P}-400">운영 시스템</span>
        </h1>
        <p class="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          ${Object.values(CATEGORIES).join(" · ")} 종목별, 연령별, 급수별<br class="hidden sm:inline"> 대진표 생성부터 실시간 ${SCORE_LABEL} 관리까지
        </p>
        <!-- CTA Button -->
        <button onclick="navigate('create')" class="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${T.gradFrom} ${T.gradTo} text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl shadow-${P}-500/25 hover:shadow-${P}-500/40 hover:-translate-y-0.5 active:translate-y-0">
          <i class="fas fa-plus"></i>새 대회 만들기
        </button>
      </div>
    </div>
    <!-- Wave Divider -->
    <div class="relative">
      <svg class="w-full h-12 sm:h-16" viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none">
        <path d="M0,0 C360,60 1080,60 1440,0 L1440,60 L0,60 Z" fill="#f8fafc"/>
      </svg>
    </div>
  </section>

  <!-- Tournament List Section -->
  <section class="max-w-5xl mx-auto px-4 sm:px-6 -mt-2 pb-8">
    <div class="mb-8 flex items-center justify-between fade-in">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <i class="fas fa-trophy text-white"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">대회 목록</h2>
          <p class="text-xs text-gray-400">등록된 대회를 선택하여 관리하세요</p>
        </div>
      </div>
      <button onclick="loadTournaments()" class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
        <i class="fas fa-sync-alt text-xs"></i>새로고침
      </button>
    </div>
    <div id="tournament-list" class="grid gap-4 sm:grid-cols-2">
      <div class="col-span-full text-center py-16 text-gray-400">
        <i class="fas fa-spinner fa-spin text-3xl"></i>
      </div>
    </div>
  </section>

  <!-- Feature Cards Section -->
  <section class="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
    <div class="mb-6 flex items-center gap-3 fade-in">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20">
        <i class="fas fa-th-large text-white"></i>
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900">운영 도구</h2>
        <p class="text-xs text-gray-400">대회 운영에 필요한 각종 도구 바로가기</p>
      </div>
    </div>
    <!-- Row 1: 코트 ${SC.terms ? SC.terms.scoreBoard : '점수판'} / 내경기조회 / 코트타임라인 -->
    <div class="grid grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
      <a href="/court" class="group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 text-center cursor-pointer block hover:shadow-lg hover:border-green-300 transition-all">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 mx-auto mb-3 flex items-center justify-center shadow-lg shadow-green-500/20">
          <i class="fas fa-tablet-alt text-white text-lg"></i>
        </div>
        <h3 class="font-bold text-gray-900 text-sm sm:text-base mb-1 group-hover:text-green-600 transition">코트 ${SC.terms ? SC.terms.scoreBoard : '점수판'}</h3>
        <p class="text-gray-400 text-xs leading-relaxed hidden sm:block">태블릿으로 실시간<br>${SCORE_LABEL} 입력</p>
      </a>
      <a href="/my" class="group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 text-center cursor-pointer block hover:shadow-lg hover:border-indigo-300 transition-all">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 mx-auto mb-3 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <i class="fas fa-user text-white text-lg"></i>
        </div>
        <h3 class="font-bold text-gray-900 text-sm sm:text-base mb-1 group-hover:text-indigo-600 transition">내 경기 조회</h3>
        <p class="text-gray-400 text-xs leading-relaxed hidden sm:block">QR코드로 간편<br>일정 확인</p>
      </a>
      <a href="/timeline" class="group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 text-center cursor-pointer block hover:shadow-lg hover:border-cyan-300 transition-all">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 mx-auto mb-3 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <i class="fas fa-stream text-white text-lg"></i>
        </div>
        <h3 class="font-bold text-gray-900 text-sm sm:text-base mb-1 group-hover:text-cyan-600 transition">코트 타임라인</h3>
        <p class="text-gray-400 text-xs leading-relaxed hidden sm:block">전체 경기 흐름<br>한눈에 보기</p>
      </a>
    </div>
    <!-- Row 2: 통계대시보드 / 인쇄센터 / 운영매뉴얼 -->
    <div class="grid grid-cols-3 gap-3 sm:gap-4">
      <a href="/dashboard" class="group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 text-center cursor-pointer block hover:shadow-lg hover:border-orange-300 transition-all">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 mx-auto mb-3 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <i class="fas fa-chart-bar text-white text-lg"></i>
        </div>
        <h3 class="font-bold text-gray-900 text-sm sm:text-base mb-1 group-hover:text-orange-600 transition">통계 대시보드</h3>
        <p class="text-gray-400 text-xs leading-relaxed hidden sm:block">실시간 진행률<br>& 클럽별 현황</p>
      </a>
      <a href="/print" class="group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 text-center cursor-pointer block hover:shadow-lg hover:border-amber-300 transition-all">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 mx-auto mb-3 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <i class="fas fa-print text-white text-lg"></i>
        </div>
        <h3 class="font-bold text-gray-900 text-sm sm:text-base mb-1 group-hover:text-amber-600 transition">인쇄 센터</h3>
        <p class="text-gray-400 text-xs leading-relaxed hidden sm:block">수기 운영 대비<br>인쇄물 출력</p>
      </a>
      <a href="/static/manual.html" target="_blank" class="group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 text-center cursor-pointer block hover:shadow-lg hover:border-purple-300 transition-all">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 mx-auto mb-3 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <i class="fas fa-book text-white text-lg"></i>
        </div>
        <h3 class="font-bold text-gray-900 text-sm sm:text-base mb-1 group-hover:text-purple-600 transition">운영 매뉴얼</h3>
        <p class="text-gray-400 text-xs leading-relaxed hidden sm:block">장비 셋팅부터<br>당일 운영까지</p>
      </a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-gray-200 bg-white">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2 text-sm text-gray-400">
        <div class="w-6 h-6 bg-gradient-to-br ${T.gradFrom} ${T.gradTo} rounded-lg flex items-center justify-center">
          <i class="fas ${SC.icon || "fa-trophy"} text-white text-[8px]"></i>
        </div>
        <span>${SYSTEM_NAME}</span>
      </div>
      <div class="flex items-center gap-4 text-xs text-gray-400">
        <span>Hono + Cloudflare Workers</span>
        <span class="w-1 h-1 rounded-full bg-gray-300"></span>
        <a href="/static/manual.html" target="_blank" class="hover:text-gray-600 transition">운영 매뉴얼</a>
      </div>
    </div>
  </footer>`;
}

function renderTournamentCard(t) {
  const st = { 
    draft: { l: '준비중', c: 'bg-gray-100 text-gray-600', i: 'fa-pen', dot: 'bg-gray-400' }, 
    open: { l: '접수중', c: T.statusOpen, i: 'fa-door-open', dot: T.dot }, 
    in_progress: { l: '진행중', c: 'bg-${P}-50 text-${P}-700 border border-${P}-200', i: 'fa-play', dot: 'bg-${P}-500 pulse-live' }, 
    completed: { l: '완료', c: 'bg-purple-50 text-purple-700 border border-purple-200', i: 'fa-flag-checkered', dot: 'bg-purple-500' }, 
    cancelled: { l: '취소', c: 'bg-red-50 text-red-600 border border-red-200', i: 'fa-ban', dot: 'bg-red-500' } 
  };
  const s = st[t.status] || st.draft;
  const fmt = { kdk: 'KDK', league: '풀리그', tournament: '토너먼트' };
  const fmtIcon = { kdk: 'fa-random', league: 'fa-list-ol', tournament: 'fa-sitemap' };
  return `<div class="tournament-card-new status-bar-${t.status} cursor-pointer group" onclick="openTournament(${t.id})">
    <div class="p-5 pl-7">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-gray-900 text-lg group-hover:text-${P}-700 transition-colors truncate">${t.name}</h3>
          <p class="text-sm text-gray-400 mt-0.5 truncate">${t.description || '대회 설명이 없습니다'}</p>
        </div>
        <span class="badge ${s.c} ml-3 whitespace-nowrap flex-shrink-0">
          <span class="w-1.5 h-1.5 rounded-full ${s.dot} mr-1.5"></span>${s.l}
        </span>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${t.sport === 'tennis' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'} font-medium">
          ${t.sport === 'tennis' ? '🎾 테니스' : '🏸 배드민턴'}
        </span>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 font-medium">
          <i class="fas ${fmtIcon[t.format] || 'fa-gamepad'} text-slate-400"></i>${fmt[t.format] || t.format}
        </span>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 font-medium">
          <i class="fas fa-columns text-slate-400"></i>${t.courts}코트
        </span>
        <span class="inline-flex items-center gap-1.5 text-slate-400 ml-auto">
          <i class="fas fa-arrow-right group-hover:translate-x-1 transition-transform text-${P}-500 opacity-0 group-hover:opacity-100"></i>
        </span>
      </div>
    </div>
  </div>`;
}

// ==========================================
// CREATE
// ==========================================
function renderCreate() {
  return `${renderNav()}
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 fade-in">
    <button onclick="navigate('home')" class="text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center text-sm gap-2 group"><i class="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>돌아가기</button>
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg">
          <i class="fas fa-plus text-white"></i>
        </div>
        <h2 class="text-2xl font-bold text-gray-900">새 대회 만들기</h2>
      </div>
      <form id="create-form" class="space-y-5">
        <!-- 종목 선택 (배드민턴/테니스) -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">종목 선택 <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-2 gap-3" id="sport-selector">
            <label class="relative cursor-pointer">
              <input type="radio" name="sport" value="badminton" class="sr-only peer" checked>
              <div class="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all hover:border-blue-300">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <span class="text-2xl">🏸</span>
                </div>
                <div>
                  <div class="font-bold text-gray-900">배드민턴</div>
                  <div class="text-xs text-gray-500">남복 · 여복 · 혼복</div>
                </div>
                <div class="ml-auto hidden peer-checked:block">
                  <i class="fas fa-check-circle text-blue-500 text-lg"></i>
                </div>
              </div>
            </label>
            <label class="relative cursor-pointer">
              <input type="radio" name="sport" value="tennis" class="sr-only peer">
              <div class="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 transition-all hover:border-emerald-300">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <span class="text-2xl">🎾</span>
                </div>
                <div>
                  <div class="font-bold text-gray-900">테니스</div>
                  <div class="text-xs text-gray-500">남단 · 여단 · 남복 · 여복 · 혼복</div>
                </div>
                <div class="ml-auto hidden peer-checked:block">
                  <i class="fas fa-check-circle text-emerald-500 text-lg"></i>
                </div>
              </div>
            </label>
          </div>
        </div>
        <div><label class="block text-sm font-semibold text-gray-700 mb-1">대회명 <span class="text-red-500">*</span></label>
          <input name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="예: 2026 대회"></div>
        <div><label class="block text-sm font-semibold text-gray-700 mb-1">설명</label>
          <textarea name="description" rows="2" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="대회 안내 사항"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">대회 방식</label>
            <select name="format" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="kdk">KDK (랜덤 대진)</option><option value="league">풀리그</option><option value="tournament">토너먼트</option></select></div>
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">코트 수</label>
            <input name="courts" type="number" value="6" min="1" max="20" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">팀당 경기 수 (KDK)</label>
            <input name="games_per_player" type="number" value="4" min="1" max="20" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"></div>
          <div><label class="block text-sm font-semibold text-gray-700 mb-1">급수합병 기준 (팀 수)</label>
            <input name="merge_threshold" type="number" value="4" min="2" max="20" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
            <p class="text-xs text-gray-400 mt-1">종목의 참가팀이 이 수 미만이면 인접 급수와 합병</p></div>
        </div>
        <div><label class="block text-sm font-semibold text-gray-700 mb-1">관리자 비밀번호 <span class="text-red-500">*</span></label>
          <input name="admin_password" type="password" required class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="대회 관리용 비밀번호"></div>
        <button type="submit" class="w-full py-3.5 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg text-lg"><i class="fas fa-rocket mr-2"></i>대회 생성</button>
      </form>
    </div>
  </div>`;
}

// ==========================================
// TOURNAMENT DETAIL
// ==========================================
function renderTournament() {
  const t = state.currentTournament;
  if (!t) return `<div class="text-center py-20"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>`;
  const isAdmin = state.adminAuth[t.id];

  // 통계 계산
  const totalMatches = state.matches.length;
  const completedMatches = state.matches.filter(m => m.status === 'completed').length;
  const playingMatches = state.matches.filter(m => m.status === 'playing').length;
  const progress = totalMatches > 0 ? Math.round(completedMatches / totalMatches * 100) : 0;
  const statusMap = {
    draft: { label: '준비중', color: 'bg-gray-500', icon: 'fa-pencil-alt' },
    open: { label: '접수중', color: 'bg-yellow-500', icon: 'fa-door-open' },
    in_progress: { label: '진행중', color: 'bg-green-500', icon: 'fa-play-circle' },
    completed: { label: '완료', color: T.bg500, icon: 'fa-check-circle' },
    cancelled: { label: '취소됨', color: 'bg-red-500', icon: 'fa-ban' }
  };
  const st = statusMap[t.status] || statusMap.draft;
  const formatMap = { kdk: 'KDK (랜덤 대진)', league: '풀리그', tournament: '토너먼트' };

  return `${renderNav()}${renderOffline()}

  <!-- Hero Banner -->
  <div class="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 relative overflow-hidden">
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-10 left-10 w-32 h-32 rounded-full bg-${P}-400 blur-3xl"></div>
      <div class="absolute bottom-10 right-10 w-40 h-40 rounded-full ${T.bg400} blur-3xl"></div>
    </div>
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
      <!-- Top Bar -->
      <div class="flex items-center justify-between mb-5">
        <button onclick="navigate('home')" class="flex items-center gap-2 text-white/60 hover:text-white transition text-sm group">
          <i class="fas fa-arrow-left group-hover:-translate-x-0.5 transition-transform"></i>대회 목록
        </button>
        <div class="flex items-center gap-2">
          ${!isAdmin ? `<button onclick="showAuthModal(${t.id})" class="px-3 py-1.5 bg-white/10 text-white/70 rounded-lg text-xs hover:bg-white/20 transition backdrop-blur"><i class="fas fa-lock mr-1.5"></i>관리자</button>` : `<span class="px-3 py-1.5 bg-${P}-500/20 text-${P}-400 rounded-lg text-xs border border-${P}-500/30"><i class="fas fa-shield-alt mr-1.5"></i>관리자 모드</span>`}
        </div>
      </div>
      <!-- Title -->
      <div class="flex items-center gap-4 mb-6">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${T.gradFrom} ${T.gradTo} flex items-center justify-center shadow-xl shadow-${P}-500/20 flex-shrink-0">
          <i class="fas ${SC.icon || "fa-trophy"} text-xl text-white"></i>
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">${t.name}</h1>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 ${st.color} text-white rounded-full text-xs font-bold"><i class="fas ${st.icon} text-[10px]"></i>${st.label}</span>
            <span class="text-white/50 text-sm">${formatMap[t.format] || t.format}</span>
            <span class="text-white/30">·</span>
            <span class="text-white/50 text-sm">${t.courts}코트</span>
          </div>
        </div>
      </div>
      <!-- Stats Cards -->
      <div class="grid grid-cols-4 gap-3 sm:gap-4">
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${state.participants.length}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-users mr-1"></i>참가자</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${state.events.length}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-layer-group mr-1"></i>종목</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${totalMatches}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5">${playingMatches > 0 ? `<span class="w-1.5 h-1.5 inline-block rounded-full bg-green-400 pulse-live mr-0.5"></span>${playingMatches}진행중 ` : ''}<i class="fas fa-gamepad mr-0.5"></i>경기</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold ${progress >= 100 ? 'text-green-400' : progress >= 50 ? T.text400 : 'text-white'}">${progress}<span class="text-lg">%</span></div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-chart-pie mr-1"></i>진행률</div>
          ${totalMatches > 0 ? `<div class="mt-1.5 w-full bg-white/10 rounded-full h-1"><div class="h-1 rounded-full transition-all ${progress >= 100 ? 'bg-green-400' : progress >= 50 ? T.bg400 : 'bg-yellow-400'}" style="width:${progress}%"></div></div>` : ''}
        </div>
      </div>
    </div>
    <!-- Wave Divider -->
    <svg class="w-full h-6 sm:h-8" viewBox="0 0 1440 30" fill="none" preserveAspectRatio="none">
      <path d="M0,0 C360,30 1080,30 1440,0 L1440,30 L0,30 Z" fill="#f8fafc"/>
    </svg>
  </div>

  <div class="bg-slate-50 min-h-screen">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 -mt-1 pb-10 fade-in">

    <!-- Quick Access Grid -->
    <div class="mb-6">
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
        <button onclick="window.open('/court?tid='+state.currentTournament.id,'_blank')" class="group rounded-xl border border-gray-200 bg-white p-3 sm:p-4 text-center cursor-pointer hover:shadow-lg hover:border-green-300 transition-all">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 mx-auto mb-1.5 sm:mb-2 flex items-center justify-center shadow-md shadow-green-500/20">
            <i class="fas fa-tablet-alt text-white text-sm"></i>
          </div>
          <span class="font-bold text-gray-800 text-xs group-hover:text-green-600 transition">코트 ${SC.terms ? SC.terms.scoreBoard : '점수판'}</span>
        </button>
        <button onclick="loadDashboard(${t.id});navigate('dashboard')" class="group rounded-xl border border-gray-200 bg-white p-3 sm:p-4 text-center cursor-pointer hover:shadow-lg hover:border-orange-300 transition-all">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 mx-auto mb-1.5 sm:mb-2 flex items-center justify-center shadow-md shadow-orange-500/20">
            <i class="fas fa-chart-bar text-white text-sm"></i>
          </div>
          <span class="font-bold text-gray-800 text-xs group-hover:text-orange-600 transition">통계</span>
        </button>
        <button onclick="navigate('mypage')" class="group rounded-xl border border-gray-200 bg-white p-3 sm:p-4 text-center cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 mx-auto mb-1.5 sm:mb-2 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <i class="fas fa-user text-white text-sm"></i>
          </div>
          <span class="font-bold text-gray-800 text-xs group-hover:text-indigo-600 transition">내 경기</span>
        </button>
        <button onclick="loadStandingsAndNavigate(${t.id})" class="group rounded-xl border border-gray-200 bg-white p-3 sm:p-4 text-center cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 mx-auto mb-1.5 sm:mb-2 flex items-center justify-center shadow-md shadow-purple-500/20">
            <i class="fas fa-medal text-white text-sm"></i>
          </div>
          <span class="font-bold text-gray-800 text-xs group-hover:text-purple-600 transition">결과/순위</span>
        </button>
        <button onclick="window.open('/print?tid='+state.currentTournament.id,'_blank')" class="group rounded-xl border border-gray-200 bg-white p-3 sm:p-4 text-center cursor-pointer hover:shadow-lg hover:border-amber-300 transition-all">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 mx-auto mb-1.5 sm:mb-2 flex items-center justify-center shadow-md shadow-amber-500/20">
            <i class="fas fa-print text-white text-sm"></i>
          </div>
          <span class="font-bold text-gray-800 text-xs group-hover:text-amber-600 transition">인쇄센터</span>
        </button>
        <button onclick="window.open('/timeline?tid='+state.currentTournament.id,'_blank')" class="group rounded-xl border border-gray-200 bg-white p-3 sm:p-4 text-center cursor-pointer hover:shadow-lg hover:border-cyan-300 transition-all">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 mx-auto mb-1.5 sm:mb-2 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <i class="fas fa-stream text-white text-sm"></i>
          </div>
          <span class="font-bold text-gray-800 text-xs group-hover:text-cyan-600 transition">타임라인</span>
        </button>
      </div>
    </div>

    ${isAdmin ? `
    <!-- Admin Actions (Collapsible) -->
    <div class="mb-6">
      <button onclick="toggleAdminPanel()" id="admin-panel-toggle" class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition mb-2">
        <i class="fas fa-chevron-right text-xs transition-transform" id="admin-panel-arrow"></i>
        <i class="fas fa-cog text-gray-400"></i>관리자 메뉴
      </button>
      <div id="admin-panel" class="hidden">
        <div class="flex flex-wrap gap-2 p-3 bg-white rounded-xl border border-gray-200">
          <button onclick="navigate('scoreboard')" class="px-3 py-2 ${T.bg50} ${T.text700} rounded-lg text-xs font-medium ${T.hoverBg100} transition"><i class="fas fa-tv mr-1"></i>스코어보드</button>
          <button onclick="exportTournament(${t.id})" class="px-3 py-2 bg-${P}-50 text-${P}-700 rounded-lg text-xs font-medium hover:bg-${P}-100 transition"><i class="fas fa-download mr-1"></i>데이터 백업</button>
          <button onclick="showImportModal()" class="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition"><i class="fas fa-upload mr-1"></i>데이터 복원</button>
          <button onclick="deleteTournament(${t.id})" class="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition"><i class="fas fa-trash-alt mr-1"></i>대회 삭제</button>
        </div>
      </div>
    </div>` : ''}

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
      <button onclick="switchTab('participants')" id="tab-participants" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${state.activeTab==='participants' ? 'bg-${P}-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"><i class="fas fa-users mr-1"></i>참가자 <span class="hidden sm:inline">(${state.participants.length})</span></button>
      <button onclick="switchTab('events')" id="tab-events" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${state.activeTab==='events' ? 'bg-${P}-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"><i class="fas fa-layer-group mr-1"></i>종목/팀 <span class="hidden sm:inline">(${state.events.length})</span></button>
      <button onclick="switchTab('matches')" id="tab-matches" class="tab-btn flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${state.activeTab==='matches' ? 'bg-${P}-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"><i class="fas ${SC.icon || "fa-trophy"} mr-1"></i>경기</button>
    </div>
    <div id="tab-content">${state.activeTab==='participants' ? renderParticipantsTab(isAdmin) : state.activeTab==='events' ? renderEventsTab(isAdmin) : renderMatchesTab(isAdmin)}</div>
  </div>
  </div>

  <!-- Auth Modal -->
  <div id="auth-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
      <h3 class="text-lg font-bold mb-4"><i class="fas fa-lock mr-2 text-${P}-500"></i>관리자 인증</h3>
      <input id="auth-password" type="password" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" class="w-full px-4 py-3 border rounded-xl mb-4 outline-none focus:ring-2 focus:ring-${P}-500" placeholder="관리자 비밀번호">
      <div class="flex gap-2"><button onclick="closeAuthModal()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition">취소</button><button onclick="authenticate()" class="flex-1 py-2.5 bg-gradient-to-r ${T.gradFrom} ${T.gradTo} text-white rounded-xl font-medium hover:opacity-90 transition-all">확인</button></div>
    </div>
  </div>`;
}

// ---- ADMIN PANEL TOGGLE ----
function toggleAdminPanel() {
  const panel = document.getElementById('admin-panel');
  const arrow = document.getElementById('admin-panel-arrow');
  if (panel) {
    panel.classList.toggle('hidden');
    if (arrow) arrow.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(90deg)';
  }
}
function toggleParticipantForm() {
  const panel = document.getElementById('participant-form-panel');
  const arrow = document.getElementById('pform-arrow');
  if (panel) {
    panel.classList.toggle('hidden');
    if (arrow) arrow.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
  }
}
function filterParticipants() {
  const search = (document.getElementById('participant-search')?.value || '').toLowerCase();
  const gender = document.getElementById('participant-filter-gender')?.value || '';
  const level = document.getElementById('participant-filter-level')?.value || '';
  const club = document.getElementById('participant-filter-club')?.value || '';
  const rows = document.querySelectorAll('.participant-row');
  let shown = 0;
  rows.forEach(row => {
    const matchSearch = !search || row.dataset.name.includes(search) || row.dataset.club.includes(search);
    const matchGender = !gender || row.dataset.gender === gender;
    const matchLevel = !level || row.dataset.level === level;
    const matchClub = !club || row.dataset.club === club.toLowerCase();
    const show = matchSearch && matchGender && matchLevel && matchClub;
    row.style.display = show ? '' : 'none';
    if (show) shown++;
  });
  const countEl = document.getElementById('participant-count-filtered');
  if (countEl) {
    const total = rows.length;
    countEl.textContent = (search || gender || level || club) ? `${shown}/${total}명 표시` : '';
  }
}
function toggleEventForm() {
  const panel = document.getElementById('event-form-panel');
  const arrow = document.getElementById('eform-arrow');
  if (panel) {
    panel.classList.toggle('hidden');
    if (arrow) arrow.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
  }
}

// ---- PARTICIPANTS TAB ----
function renderParticipantsTab(isAdmin) {
  // 클럽별 통계
  const clubs = {};
  state.participants.forEach(p => {
    const c = p.club || '(미소속)';
    if (!clubs[c]) clubs[c] = 0;
    clubs[c]++;
  });
  const clubList = Object.entries(clubs).sort((a, b) => b[1] - a[1]);

  const maleCount = state.participants.filter(p=>p.gender==='m').length;
  const femaleCount = state.participants.filter(p=>p.gender==='f').length;
  const mixedCount = state.participants.filter(p=>p.mixed_doubles).length;
  const paidCount = state.participants.filter(p=>p.paid).length;
  const checkinCount = state.participants.filter(p=>p.checked_in).length;

  return `<div class="space-y-4">
    <!-- Summary Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div class="text-xl font-extrabold text-gray-900">${state.participants.length}</div>
        <div class="text-xs text-gray-500"><i class="fas fa-users mr-1"></i>총 참가자</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div class="text-xl font-extrabold text-blue-600">${maleCount}</div>
        <div class="text-xs text-gray-500"><i class="fas fa-mars mr-1 text-blue-400"></i>남자</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div class="text-xl font-extrabold text-pink-600">${femaleCount}</div>
        <div class="text-xs text-gray-500"><i class="fas fa-venus mr-1 text-pink-400"></i>여자</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div class="text-xl font-extrabold text-green-600">${paidCount}<span class="text-sm text-gray-400 font-normal">/${state.participants.length}</span></div>
        <div class="text-xs text-gray-500"><i class="fas fa-won-sign mr-1 text-green-400"></i>참가비</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div class="text-xl font-extrabold text-indigo-600">${checkinCount}<span class="text-sm text-gray-400 font-normal">/${state.participants.length}</span></div>
        <div class="text-xs text-gray-500"><i class="fas fa-check-circle mr-1 text-indigo-400"></i>체크인</div>
      </div>
    </div>
    <!-- Detail Badges -->
    <div class="flex flex-wrap gap-1.5">
      ${mixedCount > 0 ? `<span class="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200"><i class="fas fa-venus-mars mr-1"></i>혼복 ${mixedCount}명</span>` : ''}
      ${(() => { const partnerCount = state.participants.filter(p => p.partner_name && p.partner_name.trim()).length; return partnerCount > 0 ? `<span class="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200"><i class="fas fa-handshake mr-1"></i>파트너지정 ${partnerCount}명</span>` : ''; })()}
      ${['20대','30대','40대','50대','55대','60대'].map(ag => {
        const cnt = state.participants.filter(p => getAgeGroup(p.birth_year) === ag).length;
        return cnt > 0 ? `<span class="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">${ag} ${cnt}명</span>` : '';
      }).join('')}
      ${clubList.length > 1 ? clubList.slice(0, 8).map(([name, count]) => `<span class="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">${name} ${count}</span>`).join('') : ''}
    </div>

    ${isAdmin ? `
    <!-- Admin Registration (Collapsible) -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onclick="toggleParticipantForm()" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
        <h3 class="font-semibold text-gray-800 flex items-center"><i class="fas fa-user-plus mr-2 text-${P}-500"></i>참가자 등록</h3>
        <div class="flex items-center gap-2">
          <button onclick="event.stopPropagation();showBulkModal()" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100"><i class="fas fa-file-import mr-1"></i>일괄 등록</button>
          <i class="fas fa-chevron-down text-gray-400 text-xs transition-transform" id="pform-arrow"></i>
        </div>
      </button>
      <div id="participant-form-panel" class="hidden border-t border-gray-100 p-4">
        <form id="add-participant-form" class="flex flex-wrap gap-3">
          <input name="name" required placeholder="이름" class="flex-1 min-w-[80px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
          <input name="phone" placeholder="연락처" class="flex-1 min-w-[90px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
          <select name="gender" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500"><option value="m">남</option><option value="f">여</option></select>
          <input name="birth_year" type="number" placeholder="출생년도" min="1950" max="2010" class="w-[90px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
          <select name="level" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
            ${Object.entries(LEVELS).map(([k,v]) => `<option value="${k}" ${k==='c'?'selected':''}>${v}급</option>`).join('')}
          </select>
          <input name="club" placeholder="소속 클럽" class="flex-1 min-w-[80px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
          <input name="partner_name" placeholder="희망 파트너" class="flex-1 min-w-[80px] px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400" title="자동 팀편성 시 이 파트너와 우선 매칭됩니다">
          <label class="flex items-center gap-1.5 px-3 py-2.5 border rounded-lg cursor-pointer hover:bg-purple-50 transition" title="혼합복식 참가 희망">
            <input type="checkbox" name="mixed_doubles" value="1" class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500">
            <span class="text-sm font-medium text-purple-700"><i class="fas fa-venus-mars mr-0.5"></i>혼복</span>
          </label>
          <button type="submit" class="px-5 py-2.5 bg-${P}-600 text-white rounded-lg font-medium hover:bg-${P}-700"><i class="fas fa-plus mr-1"></i>등록</button>
        </form>
      </div>
    </div>` : ''}

    <!-- Participant Search/Filter -->
    <div class="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div class="flex flex-wrap gap-2 items-center">
        <div class="relative flex-1 min-w-[150px]">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
          <input id="participant-search" type="text" placeholder="이름 또는 소속 검색..." oninput="filterParticipants()" class="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-${P}-500">
        </div>
        <select id="participant-filter-gender" onchange="filterParticipants()" class="px-2 py-2 border rounded-lg text-sm outline-none">
          <option value="">전체 성별</option><option value="m">남자</option><option value="f">여자</option>
        </select>
        <select id="participant-filter-level" onchange="filterParticipants()" class="px-2 py-2 border rounded-lg text-sm outline-none">
          <option value="">전체 급수</option>${Object.entries(LEVELS).map(([k,v]) => `<option value="${k}">${v}급</option>`).join('')}
        </select>
        <select id="participant-filter-club" onchange="filterParticipants()" class="px-2 py-2 border rounded-lg text-sm outline-none">
          <option value="">전체 소속</option>${clubList.map(([name]) => `<option value="${name}">${name}</option>`).join('')}
        </select>
        <span id="participant-count-filtered" class="text-xs text-gray-400"></span>
      </div>
    </div>

    <!-- Participant Table -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200"><tr>
          <th class="px-2 py-3 text-left text-xs font-semibold text-gray-500">#</th>
          <th class="px-2 py-3 text-left text-xs font-semibold text-gray-500">이름</th>
          <th class="px-2 py-3 text-center text-xs font-semibold text-gray-500">성별</th>
          <th class="px-2 py-3 text-center text-xs font-semibold text-gray-500">연령대</th>
          <th class="px-2 py-3 text-center text-xs font-semibold text-gray-500">급수</th>
          <th class="px-2 py-3 text-left text-xs font-semibold text-gray-500">소속</th>
          <th class="px-2 py-3 text-left text-xs font-semibold text-gray-500">파트너</th>
          <th class="px-2 py-3 text-center text-xs font-semibold text-gray-500">혼복</th>
          <th class="px-2 py-3 text-center text-xs font-semibold text-gray-500">참가비</th>
          <th class="px-2 py-3 text-center text-xs font-semibold text-gray-500">체크인</th>
          ${isAdmin ? '<th class="px-2 py-3 text-center text-xs font-semibold text-gray-500">관리</th>' : ''}
        </tr></thead>
        <tbody class="divide-y divide-gray-100">
          ${state.participants.length === 0 ? `<tr><td colspan="${isAdmin?11:10}" class="px-4 py-8 text-center text-gray-400">등록된 참가자가 없습니다.</td></tr>` : ''}
          ${state.participants.map((p, i) => {
            const lv = LEVEL_COLORS[p.level] || LEVEL_COLORS.c;
            return `<tr class="hover:bg-gray-50 participant-row" data-name="${(p.name||'').toLowerCase()}" data-club="${(p.club||'').toLowerCase()}" data-gender="${p.gender}" data-level="${p.level}">
              <td class="px-2 py-2 text-sm text-gray-400">${i+1}</td>
              <td class="px-2 py-2 font-medium text-gray-900 text-sm">${p.name}</td>
              <td class="px-2 py-2 text-center"><span class="badge text-xs ${p.gender==='m' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}">${p.gender==='m'?'남':'여'}</span></td>
              <td class="px-2 py-2 text-center"><span class="badge text-xs bg-amber-50 text-amber-700">${getAgeGroup(p.birth_year)}</span></td>
              <td class="px-2 py-2 text-center"><span class="badge text-xs ${lv}">${LEVELS[p.level]||'C'}</span></td>
              <td class="px-2 py-2 text-xs text-gray-500">${p.club || '-'}</td>
              <td class="px-2 py-2 text-xs ${p.partner_name ? 'text-orange-600 font-semibold' : 'text-gray-300'}">${p.partner_name || '-'}</td>
              <td class="px-2 py-2 text-center">${isAdmin ? `<button onclick="toggleMixedDoubles(${p.id})" class="text-base ${p.mixed_doubles?'text-purple-500':'text-gray-300'} hover:scale-110">${p.mixed_doubles?'<i class="fas fa-venus-mars"></i>':'<i class="far fa-circle"></i>'}</button>` : (p.mixed_doubles?'<span class="text-purple-500"><i class="fas fa-venus-mars"></i></span>':'<span class="text-gray-300">-</span>')}</td>
              <td class="px-2 py-2 text-center">${isAdmin ? `<button onclick="togglePaid(${p.id})" class="text-base ${p.paid?'text-green-500':'text-gray-300'} hover:scale-110">${p.paid?'<i class="fas fa-check-circle"></i>':'<i class="far fa-circle"></i>'}</button>` : (p.paid?'<i class="fas fa-check-circle text-green-500"></i>':'<i class="fas fa-times-circle text-gray-300"></i>')}</td>
              <td class="px-2 py-2 text-center">${isAdmin ? `<button onclick="toggleCheckin(${p.id})" class="text-base ${p.checked_in?T.text500:'text-gray-300'} hover:scale-110">${p.checked_in?'<i class="fas fa-check-circle"></i>':'<i class="far fa-circle"></i>'}</button>` : (p.checked_in?`<i class="fas fa-check-circle ${T.text500}"></i>`:'<i class="fas fa-times-circle text-gray-300"></i>')}</td>
              ${isAdmin ? `<td class="px-2 py-2 text-center"><button onclick="deleteParticipant(${p.id})" class="text-red-400 hover:text-red-600"><i class="fas fa-trash-alt"></i></button></td>` : ''}
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
  const mixedMales = state.participants.filter(p => p.gender === 'm' && p.mixed_doubles);
  const mixedFemales = state.participants.filter(p => p.gender === 'f' && p.mixed_doubles);

  return `<div class="space-y-4">
    ${isAdmin ? `
    <!-- Admin Event Management (Collapsible) -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onclick="toggleEventForm()" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
        <h3 class="font-semibold text-gray-800 flex items-center"><i class="fas fa-plus-circle mr-2 text-${P}-500"></i>종목 추가</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400"><i class="fas fa-mars mr-1 text-blue-400"></i>${maleP.length} <i class="fas fa-venus mr-1 ml-1 text-pink-400"></i>${femaleP.length} <i class="fas fa-venus-mars mr-1 ml-1 text-purple-400"></i>${Math.min(mixedMales.length, mixedFemales.length)}팀</span>
          <i class="fas fa-chevron-down text-gray-400 text-xs transition-transform" id="eform-arrow"></i>
        </div>
      </button>
      <div id="event-form-panel" class="hidden border-t border-gray-100 p-4 space-y-4">
        <form id="add-event-form" class="flex flex-wrap gap-3 items-end">
          <div><label class="block text-xs font-semibold text-gray-500 mb-1">종류</label>
            <select name="category" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
              <option value="md">남자복식</option><option value="wd">여자복식</option><option value="xd">혼합복식</option></select></div>
          <div><label class="block text-xs font-semibold text-gray-500 mb-1">연령대</label>
            <select name="age_group" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
              ${AGE_GROUPS.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}</select></div>
          <div><label class="block text-xs font-semibold text-gray-500 mb-1">급수</label>
            <select name="level_group" class="px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
              <option value="all">전체</option>${Object.entries(LEVELS).map(([k,v]) => `<option value="${k}">${v}급</option>`).join('')}</select></div>
          <button type="submit" class="px-5 py-2.5 bg-${P}-600 text-white rounded-lg font-medium hover:bg-${P}-700"><i class="fas fa-plus mr-1"></i>종목 추가</button>
          <button type="button" onclick="showBulkEventModal()" class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><i class="fas fa-th-large mr-1"></i>일괄 생성</button>
        </form>
      </div>
    </div>
    <!-- Admin Action Buttons -->
    <div class="flex flex-wrap gap-2">
      <button onclick="showTeamAssignModal()" class="px-4 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 shadow-sm"><i class="fas fa-users-cog mr-1"></i>조편성 옵션</button>
      <button onclick="showBracketOptionsModal()" class="px-4 py-2.5 bg-gradient-to-r ${T.gradFrom} ${T.gradTo} text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg"><i class="fas fa-magic mr-1"></i>대진표 옵션</button>
      <button onclick="checkMerge()" class="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100"><i class="fas fa-compress-arrows-alt mr-1"></i>급수합병 체크</button>
      <button onclick="showManualMergeModal()" class="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"><i class="fas fa-object-group mr-1"></i>수동 합병</button>
      <button onclick="bulkDeleteAssignments()" class="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 border border-red-200"><i class="fas fa-eraser mr-1"></i>조편성 일괄삭제</button>
      <button onclick="bulkDeleteEverything()" class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"><i class="fas fa-trash-alt mr-1"></i>종목 전체삭제</button>
    </div>` : ''}
    <div id="merge-result"></div>
    ${state.events.length === 0 ? '<div class="text-center py-12 text-gray-400"><i class="fas fa-layer-group text-4xl mb-3 block"></i><p>등록된 종목이 없습니다.</p></div>' : ''}
    ${state.events.map(ev => {
      const catStyle = ev.category==='md' ? 'border-l-blue-500 from-blue-50' : ev.category==='wd' ? 'border-l-pink-500 from-pink-50' : 'border-l-purple-500 from-purple-50';
      const catBadge = ev.category==='md'?'bg-blue-100 text-blue-700':ev.category==='wd'?'bg-pink-100 text-pink-700':'bg-purple-100 text-purple-700';
      return `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden border-l-4 ${catStyle} shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge ${catBadge}">${CATEGORIES[ev.category]}</span>
            <h4 class="font-bold text-gray-900">${ev.name}</h4>
            <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">${ev.team_count || 0}팀</span>
            ${ev.merged_from ? '<span class="badge bg-amber-100 text-amber-700 text-xs"><i class="fas fa-compress-arrows-alt mr-1"></i>합병</span>' : ''}
          </div>
          <div class="flex items-center gap-2">
            ${isAdmin && ev.merged_from ? `<button onclick="unmergeEvent(${ev.id})" class="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 border border-amber-200"><i class="fas fa-undo mr-1"></i>합병취소</button>` : ''}
            ${isAdmin ? `<button onclick="showTeamModal(${ev.id}, '${ev.category}')" class="px-3 py-1.5 bg-${P}-50 text-${P}-700 rounded-lg text-xs font-medium hover:bg-${P}-100"><i class="fas fa-user-plus mr-1"></i>팀 등록</button>` : ''}
            ${isAdmin ? `<button onclick="deleteEvent(${ev.id})" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-trash-alt"></i></button>` : ''}
          </div>
        </div>
        <div id="teams-${ev.id}" class="px-4 py-2 border-t border-gray-100">
          <button onclick="loadTeams(${ev.id})" class="text-sm text-${P}-600 hover:text-${P}-800"><i class="fas fa-eye mr-1"></i>팀 목록 보기</button>
        </div>
      </div>
    `;}).join('')}
  </div>`;
}

// ==========================================
// ★ 조편성 일괄 삭제 / 종목 전체 삭제 ★
// ==========================================
async function bulkDeleteAssignments() {
  const tid = state.currentTournament?.id;
  if (!tid) return;
  const teamTotal = state.events.reduce((s, e) => s + (e.team_count || 0), 0);
  if (teamTotal === 0) return showToast('삭제할 조편성 데이터가 없습니다.', 'warning');
  if (!confirm(`모든 종목의 팀/경기/순위를 일괄 삭제합니다.\n(종목 ${state.events.length}개의 팀 ${teamTotal}개가 삭제됩니다)\n\n종목 자체는 유지됩니다. 계속하시겠습니까?`)) return;
  if (!confirm('정말로 모든 조편성을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
  try {
    const res = await api(`/tournaments/${tid}/events/all/assignments`, { method: 'DELETE' });
    showToast(`조편성 일괄 삭제 완료! (팀 ${res.deleted.teams}개, 경기 ${res.deleted.matches}개, 순위 ${res.deleted.standings}개 삭제)`, 'success');
    await loadEvents(tid); navigate('tournament');
  } catch (e) { showToast('조편성 삭제 실패: ' + e.message, 'error'); }
}

async function bulkDeleteEverything() {
  const tid = state.currentTournament?.id;
  if (!tid) return;
  if (state.events.length === 0) return showToast('삭제할 종목이 없습니다.', 'warning');
  if (!confirm(`모든 종목과 팀/경기/순위를 완전히 삭제합니다.\n(종목 ${state.events.length}개가 모두 삭제됩니다)\n\n계속하시겠습니까?`)) return;
  if (!confirm('⚠️ 정말로 모든 종목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) return;
  try {
    const res = await api(`/tournaments/${tid}/events/all/everything`, { method: 'DELETE' });
    showToast(`전체 삭제 완료! (종목 ${res.deleted.events}개, 팀 ${res.deleted.teams}개, 경기 ${res.deleted.matches}개 삭제)`, 'success');
    await loadEvents(tid); navigate('tournament');
  } catch (e) { showToast('전체 삭제 실패: ' + e.message, 'error'); }
}

// ==========================================
// ★ 종목 일괄 생성 + 자동 편성 모달 ★
// ==========================================
function showBulkEventModal() {
  // 연령대별 인원 계산
  const ageCounts = {};
  AGE_GROUPS.forEach(ag => {
    if (ag.value === 'open') {
      ageCounts['open'] = { m: state.participants.filter(p=>p.gender==='m').length, f: state.participants.filter(p=>p.gender==='f').length };
    } else {
      ageCounts[ag.value] = {
        m: state.participants.filter(p=>p.gender==='m' && getAgeGroup(p.birth_year)===ag.value).length,
        f: state.participants.filter(p=>p.gender==='f' && getAgeGroup(p.birth_year)===ag.value).length
      };
    }
  });

  const modal = document.createElement('div');
  modal.id = 'bulk-event-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900"><i class="fas fa-th-large mr-2 text-indigo-500"></i>종목 일괄 생성 + 자동 편성</h3>
        <button onclick="document.getElementById('bulk-event-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"><i class="fas fa-times text-gray-400"></i></button>
      </div>
      <p class="text-sm text-gray-500 mt-1">종목과 연령대를 다중 선택하면 조합별로 종목을 생성하고 자동 팀 편성까지 진행합니다.</p>
    </div>
    <div class="p-6 overflow-y-auto flex-1 space-y-5">
      <!-- 1. 종목 선택 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-gamepad mr-1 ${T.text500}"></i>1. 종목 선택 (다중 선택)</h4>
        <div class="grid grid-cols-3 gap-2">
          <label class="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer ${T.hoverBg50} transition ${T.checkedBorder} ${T.checkedBg}">
            <input type="checkbox" name="bulk_cat" value="md" checked class="w-4 h-4 ${T.inputColor} rounded">
            <div><p class="font-bold text-sm text-blue-700"><i class="fas fa-mars mr-1"></i>남자복식</p></div>
          </label>
          <label class="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-pink-50 transition has-[:checked]:border-pink-500 has-[:checked]:bg-pink-50">
            <input type="checkbox" name="bulk_cat" value="wd" checked class="w-4 h-4 text-pink-600 rounded">
            <div><p class="font-bold text-sm text-pink-700"><i class="fas fa-venus mr-1"></i>여자복식</p></div>
          </label>
          <label class="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-purple-50 transition has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
            <input type="checkbox" name="bulk_cat" value="xd" class="w-4 h-4 text-purple-600 rounded">
            <div><p class="font-bold text-sm text-purple-700"><i class="fas fa-venus-mars mr-1"></i>혼합복식</p></div>
          </label>
        </div>
      </div>

      <!-- 2. 연령대 선택 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-birthday-cake mr-1 text-amber-500"></i>2. 연령대 선택 (다중 선택)</h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${AGE_GROUPS.map(ag => {
            const mc = ageCounts[ag.value]?.m || 0;
            const fc = ageCounts[ag.value]?.f || 0;
            return `<label class="flex items-start gap-2 p-3 border-2 rounded-xl cursor-pointer hover:bg-amber-50 transition has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
              <input type="checkbox" name="bulk_age" value="${ag.value}" class="w-4 h-4 text-amber-600 rounded mt-0.5">
              <div>
                <p class="font-bold text-sm">${ag.label}</p>
                <p class="text-xs text-gray-500">남${mc} 여${fc}</p>
              </div>
            </label>`;
          }).join('')}
        </div>
      </div>

      <!-- 3. 급수 선택 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-signal mr-1 text-green-500"></i>3. 급수 (선택사항)</h4>
        <div class="flex flex-wrap gap-2">
          <label class="flex items-center gap-2 px-3 py-2 border-2 rounded-lg cursor-pointer hover:bg-green-50 transition has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
            <input type="checkbox" name="bulk_level" value="all" checked class="w-4 h-4 text-green-600 rounded">
            <span class="text-sm font-bold">전체</span>
          </label>
          ${Object.entries(LEVELS).map(([k,v]) => `<label class="flex items-center gap-2 px-3 py-2 border-2 rounded-lg cursor-pointer hover:bg-green-50 transition has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
            <input type="checkbox" name="bulk_level" value="${k}" class="w-4 h-4 text-green-600 rounded">
            <span class="text-sm font-medium">${v}급</span>
          </label>`).join('')}
        </div>
        <p class="text-xs text-gray-400 mt-1">"전체"를 선택하면 급수 구분 없이 생성됩니다. 개별 급수를 선택하면 급수별 종목이 생성됩니다.</p>
      </div>

      <!-- 4. 자동 편성 옵션 -->
      <div class="border-t pt-4">
        <label class="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-teal-50 transition has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50">
          <input type="checkbox" id="bulk-auto-assign" checked class="w-5 h-5 text-teal-600 rounded">
          <div>
            <p class="font-bold text-sm"><i class="fas fa-users-cog mr-1 text-teal-500"></i>종목 생성 후 자동 팀 편성</p>
            <p class="text-xs text-gray-500">생성된 종목에 참가자를 자동으로 배정합니다 (같은 클럽 우선)</p>
          </div>
        </label>
        <div id="bulk-assign-options" class="mt-3 pl-4 space-y-2">
          <div class="flex items-center gap-3">
            <label class="text-sm font-medium text-gray-700 w-24">팀 편성 방식</label>
            <select id="bulk-team-mode" class="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
              <option value="club_priority">같은 클럽 우선</option>
              <option value="level_match">같은 급수 매칭</option>
              <option value="random">완전 랜덤</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 미리보기 영역 -->
      <div id="bulk-event-preview" class="hidden bg-gray-50 rounded-xl p-4">
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-eye mr-1"></i>생성될 종목 미리보기</h4>
        <div id="bulk-event-preview-content"></div>
      </div>
    </div>
    <div class="p-6 border-t border-gray-200 flex gap-3">
      <button onclick="previewBulkEvents()" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>미리보기</button>
      <button onclick="executeBulkEvents()" class="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md"><i class="fas fa-bolt mr-2"></i>일괄 생성 + 편성</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function getBulkEventSelections() {
  const categories = [...document.querySelectorAll('input[name="bulk_cat"]:checked')].map(cb => cb.value);
  const ageGroups = [...document.querySelectorAll('input[name="bulk_age"]:checked')].map(cb => cb.value);
  const levelChecks = [...document.querySelectorAll('input[name="bulk_level"]:checked')].map(cb => cb.value);
  // "전체"가 체크되어 있으면 ['all']만 사용
  const levels = levelChecks.includes('all') ? ['all'] : levelChecks.filter(v => v !== 'all');
  return { categories, ageGroups, levels: levels.length > 0 ? levels : ['all'] };
}

function previewBulkEvents() {
  const { categories, ageGroups, levels } = getBulkEventSelections();
  if (categories.length === 0) { showToast('종목을 하나 이상 선택하세요.', 'warning'); return; }
  if (ageGroups.length === 0) { showToast('연령대를 하나 이상 선택하세요.', 'warning'); return; }

  const catLabels = { md: '남자복식', wd: '여자복식', xd: '혼합복식' };
  const lvLabels = { all: '전체', s: 'S급', a: 'A급', b: 'B급', c: 'C급', d: 'D급', e: 'E급' };
  const events = [];
  for (const cat of categories) {
    for (const age of ageGroups) {
      for (const lv of levels) {
        const ageLabel = age === 'open' ? '오픈' : age;
        events.push({ name: `${catLabels[cat]} ${ageLabel} ${lvLabels[lv]}`, cat, age, lv });
      }
    }
  }

  const previewDiv = document.getElementById('bulk-event-preview');
  const content = document.getElementById('bulk-event-preview-content');
  previewDiv.classList.remove('hidden');
  content.innerHTML = `
    <p class="text-sm font-bold text-indigo-600 mb-2">총 ${events.length}개 종목 생성 예정</p>
    <div class="max-h-40 overflow-y-auto space-y-1">
      ${events.map((e, i) => `<div class="flex items-center gap-2 text-sm py-1 px-2 rounded ${i%2===0?'bg-white':''}">
        <span class="text-gray-400 w-5">${i+1}</span>
        <span class="badge ${e.cat==='md'?'bg-blue-100 text-blue-700':e.cat==='wd'?'bg-pink-100 text-pink-700':'bg-purple-100 text-purple-700'} text-xs">${catLabels[e.cat]}</span>
        <span class="badge bg-amber-50 text-amber-700 text-xs">${e.age==='open'?'오픈':e.age}</span>
        <span class="badge bg-green-50 text-green-700 text-xs">${lvLabels[e.lv]}</span>
        <span class="font-medium">${e.name}</span>
      </div>`).join('')}
    </div>`;
  showToast(`${events.length}개 종목 생성 예정`, 'info');
}

async function executeBulkEvents() {
  const { categories, ageGroups, levels } = getBulkEventSelections();
  if (categories.length === 0) { showToast('종목을 하나 이상 선택하세요.', 'warning'); return; }
  if (ageGroups.length === 0) { showToast('연령대를 하나 이상 선택하세요.', 'warning'); return; }

  const totalEvents = categories.length * ageGroups.length * levels.length;
  const doAutoAssign = document.getElementById('bulk-auto-assign')?.checked;
  const teamMode = document.getElementById('bulk-team-mode')?.value || 'club_priority';

  if (!confirm(`${totalEvents}개 종목을 생성${doAutoAssign ? '하고 자동 팀 편성까지 진행' : ''}합니다.\n\n계속하시겠습니까?`)) return;

  const tid = state.currentTournament.id;

  try {
    // Step 1: 종목 일괄 생성
    const res = await api(`/tournaments/${tid}/events/bulk-create`, {
      method: 'POST',
      body: JSON.stringify({ categories, age_groups: ageGroups, level_groups: levels })
    });
    showToast(res.message, 'success');

    // Step 2: 자동 팀 편성 (옵션 선택 시)
    if (doAutoAssign && res.total_created > 0) {
      showToast('자동 팀 편성 중...', 'info');
      const assignRes = await api(`/tournaments/${tid}/events/auto-assign-all`, {
        method: 'POST',
        body: JSON.stringify({ team_mode: teamMode })
      });
      showToast(`팀 편성 완료! ${assignRes.total_teams}팀 생성`, 'success');
    }

    document.getElementById('bulk-event-modal')?.remove();
    await loadEvents(tid);
    render();
  } catch(e) {}
}

// ==========================================
// ★ 조편성 옵션 모달 ★
// ==========================================
function showTeamAssignModal() {
  const modal = document.createElement('div');
  modal.id = 'team-assign-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900"><i class="fas fa-users-cog mr-2 text-teal-500"></i>조편성 옵션 설정</h3>
        <button onclick="document.getElementById('team-assign-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"><i class="fas fa-times text-gray-400"></i></button>
      </div>
    </div>
    <div class="p-6 overflow-y-auto flex-1 space-y-5">
      <!-- 1. 팀 편성 방식 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-handshake mr-1 text-teal-500"></i>1. 팀 편성 방식</h4>
        <div class="space-y-2">
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-teal-50 transition has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50">
            <input type="radio" name="team_mode" value="club_priority" checked class="mt-1 w-4 h-4 text-teal-600">
            <div><p class="font-semibold text-sm">같은 클럽 우선 편성</p><p class="text-xs text-gray-500">같은 소속 클럽 멤버끼리 먼저 매칭 → 남은 인원은 급수 순 매칭</p></div>
          </label>
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-teal-50 transition has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50">
            <input type="radio" name="team_mode" value="level_match" class="mt-1 w-4 h-4 text-teal-600">
            <div><p class="font-semibold text-sm">같은 급수 매칭</p><p class="text-xs text-gray-500">클럽 무관, 같은 급수끼리 우선 매칭 (급수 밸런스 중시)</p></div>
          </label>
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-teal-50 transition has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50">
            <input type="radio" name="team_mode" value="random" class="mt-1 w-4 h-4 text-teal-600">
            <div><p class="font-semibold text-sm">완전 랜덤</p><p class="text-xs text-gray-500">클럽·급수 무관 랜덤 매칭</p></div>
          </label>
        </div>
      </div>
      <!-- 2. 조 배정 옵션 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-th-large mr-1 text-indigo-500"></i>2. 조(그룹) 배정</h4>
        <label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-indigo-50 transition mb-2">
          <input type="checkbox" id="assign-groups-check" checked class="w-4 h-4 text-indigo-600 rounded">
          <div><p class="font-semibold text-sm">조 배정 실행</p><p class="text-xs text-gray-500">팀 편성 후 자동으로 조 배정까지 진행</p></div>
        </label>
        <div id="group-options" class="pl-4 space-y-3">
          <div class="flex items-center gap-3">
            <label class="text-sm font-medium text-gray-700 w-24">조당 팀 수</label>
            <input type="number" id="group-size-input" value="5" min="3" max="8" class="w-20 px-3 py-2 border rounded-lg text-center focus:ring-2 focus:ring-indigo-500 outline-none">
            <span class="text-xs text-gray-500">(4~5팀 풀리그 권장)</span>
          </div>
          <label class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-indigo-50">
            <input type="checkbox" id="avoid-same-club" checked class="w-4 h-4 text-indigo-600 rounded">
            <div><p class="font-semibold text-sm">같은 클럽 다른 조 배정</p><p class="text-xs text-gray-500">같은 클럽 팀끼리 다른 조에 배정 (클럽 내 대결 최소화)</p></div>
          </label>
        </div>
      </div>
      <!-- 미리보기 -->
      <div id="assign-preview" class="hidden p-3 bg-gray-50 rounded-xl">
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-eye mr-1"></i>편성 미리보기</h4>
        <div id="assign-preview-content"></div>
      </div>
    </div>
    <div class="p-6 border-t border-gray-200 flex gap-3">
      <button onclick="previewAssignment()" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>미리보기</button>
      <button onclick="executeTeamAssignment()" class="flex-1 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 shadow-md"><i class="fas fa-check mr-2"></i>편성 실행</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

// 미리보기 기능
async function previewAssignment() {
  const teamMode = document.querySelector('input[name="team_mode"]:checked')?.value || 'club_priority';
  const assignGroups = document.getElementById('assign-groups-check')?.checked;
  const groupSize = parseInt(document.getElementById('group-size-input')?.value || '5');
  const avoidSameClub = document.getElementById('avoid-same-club')?.checked;

  const tid = state.currentTournament.id;
  try {
    const res = await api(`/tournaments/${tid}/events/preview-assignment`, {
      method: 'POST',
      body: JSON.stringify({ team_mode: teamMode, group_size: groupSize, avoid_same_club: avoidSameClub })
    });

    const previewDiv = document.getElementById('assign-preview');
    const content = document.getElementById('assign-preview-content');
    previewDiv.classList.remove('hidden');

    content.innerHTML = `
      <div class="space-y-2 text-sm">
        <div class="grid grid-cols-2 gap-2">
          <div class="p-2 bg-white rounded-lg"><span class="text-gray-500">총 종목:</span> <b>${res.summary.total_events}개</b></div>
          <div class="p-2 bg-white rounded-lg"><span class="text-gray-500">총 팀 수:</span> <b>${res.summary.total_teams}팀</b></div>
          <div class="p-2 bg-white rounded-lg"><span class="text-gray-500">예상 경기:</span> <b>${res.summary.total_estimated_matches}경기</b></div>
          <div class="p-2 bg-white rounded-lg"><span class="text-gray-500">조당 팀:</span> <b>${groupSize}팀</b></div>
        </div>
        <div class="mt-2 max-h-40 overflow-y-auto">
          <table class="w-full text-xs">
            <thead class="bg-gray-100"><tr>
              <th class="px-2 py-1 text-left">종목</th>
              <th class="px-2 py-1 text-center">참가자</th>
              <th class="px-2 py-1 text-center">팀</th>
              <th class="px-2 py-1 text-center">조</th>
              <th class="px-2 py-1 text-center">예상경기</th>
              <th class="px-2 py-1 text-center">추천방식</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-50">
              ${res.preview.map(p => `<tr>
                <td class="px-2 py-1 font-medium">${p.event_name}</td>
                <td class="px-2 py-1 text-center">${p.player_count}명</td>
                <td class="px-2 py-1 text-center font-bold">${p.team_count}팀</td>
                <td class="px-2 py-1 text-center">${assignGroups ? p.group_count + '조' : '-'}</td>
                <td class="px-2 py-1 text-center">${p.estimated_matches}</td>
                <td class="px-2 py-1 text-center"><span class="badge ${p.team_count <= 5 ? 'bg-green-100 text-green-700' : T.bg100+' '+T.text700} text-xs">${p.format_suggestion}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    showToast('미리보기가 생성되었습니다!', 'info');
  } catch(e) {}
}

// 편성 실행
async function executeTeamAssignment() {
  if (!confirm('모든 종목의 기존 팀/조를 삭제하고 새로 편성합니다.\n\n계속하시겠습니까?')) return;

  const teamMode = document.querySelector('input[name="team_mode"]:checked')?.value || 'club_priority';
  const doAssignGroups = document.getElementById('assign-groups-check')?.checked;
  const groupSize = parseInt(document.getElementById('group-size-input')?.value || '5');
  const avoidSameClub = document.getElementById('avoid-same-club')?.checked;

  const tid = state.currentTournament.id;
  const modeLabels = { club_priority: '같은 클럽 우선', level_match: '같은 급수 매칭', random: '완전 랜덤' };

  try {
    // Step 1: 팀 편성
    const teamRes = await api(`/tournaments/${tid}/events/auto-assign-all`, {
      method: 'POST',
      body: JSON.stringify({ team_mode: teamMode })
    });
    showToast(`팀 편성 완료! (${modeLabels[teamMode]}) → ${teamRes.total_teams}팀`, 'success');

    // Step 2: 조 배정 (옵션 선택 시)
    if (doAssignGroups) {
      const groupRes = await api(`/tournaments/${tid}/events/assign-groups-all`, {
        method: 'POST',
        body: JSON.stringify({ group_size: groupSize, avoid_same_club: avoidSameClub })
      });
      showToast(`조 배정 완료! ${groupRes.total_groups}개 조 (${avoidSameClub ? '같은 클럽 회피' : '랜덤'})`, 'success');
    }

    document.getElementById('team-assign-modal')?.remove();
    await loadEvents(tid);
    render();
  } catch(e) {}
}

// ==========================================
// ★ 대진표 옵션 모달 ★
// ==========================================
function showBracketOptionsModal() {
  const t = state.currentTournament;
  const modal = document.createElement('div');
  modal.id = 'bracket-options-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900"><i class="fas fa-magic mr-2 text-${P}-500"></i>대진표 옵션 설정</h3>
        <button onclick="document.getElementById('bracket-options-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"><i class="fas fa-times text-gray-400"></i></button>
      </div>
    </div>
    <div class="p-6 overflow-y-auto flex-1 space-y-5">
      <!-- 1. 대진 포맷 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-sitemap mr-1 text-${P}-500"></i>1. 대진 방식</h4>
        <div class="space-y-2">
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-${P}-50 transition has-[:checked]:border-${P}-500 has-[:checked]:bg-${P}-50">
            <input type="radio" name="bracket_format" value="auto" checked class="mt-1 w-4 h-4 text-${P}-600">
            <div><p class="font-semibold text-sm">자동 결정 (권장)</p><p class="text-xs text-gray-500">팀 수와 조 배정 여부에 따라 자동으로 최적 방식 결정<br>• 조 배정 있으면 → 조별 리그 (같은 조끼리 풀리그)<br>• 5팀 이하 → 풀리그 / 그 외 → KDK</p></div>
          </label>
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-${P}-50 transition has-[:checked]:border-${P}-500 has-[:checked]:bg-${P}-50">
            <input type="radio" name="bracket_format" value="group_league" class="mt-1 w-4 h-4 text-${P}-600">
            <div><p class="font-semibold text-sm">조별 리그 (Group Stage)</p><p class="text-xs text-gray-500">같은 조 팀끼리만 풀리그 진행 (4~5팀 풀리그 권장)</p></div>
          </label>
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-${P}-50 transition has-[:checked]:border-${P}-500 has-[:checked]:bg-${P}-50">
            <input type="radio" name="bracket_format" value="kdk" class="mt-1 w-4 h-4 text-${P}-600">
            <div><p class="font-semibold text-sm">KDK (팀당 N경기)</p><p class="text-xs text-gray-500">모든 팀이 설정된 경기 수만큼 진행 (랜덤 대진)</p></div>
          </label>
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-${P}-50 transition has-[:checked]:border-${P}-500 has-[:checked]:bg-${P}-50">
            <input type="radio" name="bracket_format" value="league" class="mt-1 w-4 h-4 text-${P}-600">
            <div><p class="font-semibold text-sm">풀리그</p><p class="text-xs text-gray-500">모든 팀이 다른 모든 팀과 한 번씩 대전 (소규모 종목)</p></div>
          </label>
          <label class="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-${P}-50 transition has-[:checked]:border-${P}-500 has-[:checked]:bg-${P}-50">
            <input type="radio" name="bracket_format" value="tournament" class="mt-1 w-4 h-4 text-${P}-600">
            <div><p class="font-semibold text-sm">싱글 엘리미네이션 (토너먼트)</p><p class="text-xs text-gray-500">지면 탈락, 결승까지 승자끼리 대전</p></div>
          </label>
        </div>
      </div>
      <!-- 2. 대진 옵션 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-cog mr-1 text-gray-500"></i>2. 대진 옵션</h4>
        <div class="space-y-3">
          <label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
            <input type="checkbox" id="bracket-avoid-club" checked class="w-4 h-4 text-${P}-600 rounded">
            <div><p class="font-semibold text-sm">같은 클럽 대결 회피</p><p class="text-xs text-gray-500">같은 소속 팀끼리 가능한 한 대결하지 않도록 배정</p></div>
          </label>
          <div class="flex items-center gap-3 px-3">
            <label class="text-sm font-medium text-gray-700 w-28">팀당 경기 수</label>
            <input type="number" id="bracket-games" value="${t?.games_per_player || 4}" min="2" max="10" class="w-20 px-3 py-2 border rounded-lg text-center focus:ring-2 focus:ring-${P}-500 outline-none">
            <span class="text-xs text-gray-500">(KDK 전용)</span>
          </div>
        </div>
      </div>
      <!-- 3. 대상 종목 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-list-check mr-1 text-green-500"></i>3. 대상 종목</h4>
        <label class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-green-50 mb-2">
          <input type="checkbox" id="bracket-all-events" checked onchange="toggleBracketEvents(this.checked)" class="w-4 h-4 text-green-600 rounded">
          <p class="font-semibold text-sm">전체 종목</p>
        </label>
        <div id="bracket-event-list" class="hidden max-h-32 overflow-y-auto space-y-1 pl-4">
          ${state.events.map(ev => `
            <label class="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-50">
              <input type="checkbox" class="bracket-event-cb" value="${ev.id}" checked class="w-4 h-4 text-green-600 rounded">
              <span class="text-sm">${ev.name} (${ev.team_count || 0}팀)</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="p-6 border-t border-gray-200 flex gap-3">
      <button onclick="document.getElementById('bracket-options-modal').remove()" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">취소</button>
      <button onclick="executeBracketGeneration()" class="flex-1 py-3 bg-gradient-to-r ${T.gradFrom} ${T.gradTo} text-white rounded-xl font-semibold shadow-md"><i class="fas fa-magic mr-2"></i>대진표 생성</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function toggleBracketEvents(allChecked) {
  const list = document.getElementById('bracket-event-list');
  list.classList.toggle('hidden', allChecked);
  if (allChecked) {
    document.querySelectorAll('.bracket-event-cb').forEach(cb => cb.checked = true);
  }
}

async function executeBracketGeneration() {
  const bracketFormat = document.querySelector('input[name="bracket_format"]:checked')?.value || 'auto';
  const avoidSameClub = document.getElementById('bracket-avoid-club')?.checked;
  const gamesPerTeam = parseInt(document.getElementById('bracket-games')?.value || '4');
  const allEvents = document.getElementById('bracket-all-events')?.checked;

  const formatLabels = { auto: '자동', group_league: '조별 리그', kdk: 'KDK', league: '풀리그', tournament: '토너먼트' };

  if (!confirm(`대진표를 생성합니다.\n\n• 방식: ${formatLabels[bracketFormat]}\n• 클럽 회피: ${avoidSameClub ? '예' : '아니오'}\n• 팀당 경기: ${gamesPerTeam}경기\n\n기존 경기 데이터가 초기화됩니다. 계속하시겠습니까?`)) return;

  const tid = state.currentTournament.id;
  const body = {
    format: bracketFormat,
    avoid_same_club: avoidSameClub,
    games_per_team: gamesPerTeam
  };

  if (!allEvents) {
    const checked = [...document.querySelectorAll('.bracket-event-cb:checked')].map(cb => parseInt(cb.value));
    if (checked.length === 0) { showToast('최소 하나의 종목을 선택하세요.', 'warning'); return; }
    // 종목별로 하나씩 생성
    try {
      let totalMatches = 0;
      for (const eid of checked) {
        const res = await api(`/tournaments/${tid}/brackets/generate`, {
          method: 'POST', body: JSON.stringify({ ...body, event_id: eid })
        });
        totalMatches += res.matchCount;
      }
      showToast(`대진표 생성 완료! (${totalMatches}경기)`, 'success');
    } catch(e) { return; }
  } else {
    try {
      const res = await api(`/tournaments/${tid}/brackets/generate`, {
        method: 'POST', body: JSON.stringify(body)
      });
      showToast(`대진표 생성 완료! (${res.matchCount}경기, ${formatLabels[bracketFormat]})`, 'success');
    } catch(e) { return; }
  }

  document.getElementById('bracket-options-modal')?.remove();
  await loadMatches(tid);
  const tData = await api(`/tournaments/${tid}`);
  state.currentTournament = tData.tournament;
  switchTab('matches');
}

// ---- MATCHES TAB ----
function renderMatchesTab(isAdmin) {
  const matches = state.matches;
  if (matches.length === 0) return `<div class="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200"><i class="fas fa-clipboard-list text-5xl mb-4 block text-gray-300"></i><p class="text-lg font-medium text-gray-500 mb-1">대진표가 아직 생성되지 않았습니다.</p><p class="text-sm text-gray-400 mb-4">종목/팀 탭에서 조편성 후 대진표를 생성하세요.</p>
    ${isAdmin ? `<button onclick="showBracketOptionsModal()" class="px-6 py-2.5 bg-gradient-to-r ${T.gradFrom} ${T.gradTo} text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition"><i class="fas fa-magic mr-2"></i>대진표 생성하기</button>` : ''}
  </div>`;

  // 결선 토너먼트 존재 여부 확인
  const hasGroupMatches = matches.some(m => m.group_num);
  const hasFinalsMatches = hasGroupMatches && matches.some(m => !m.group_num);
  const completedGroupMatches = matches.filter(m => m.group_num && m.status === 'completed').length;
  const totalGroupMatches = matches.filter(m => m.group_num).length;
  const groupProgress = totalGroupMatches > 0 ? Math.round(completedGroupMatches / totalGroupMatches * 100) : 0;

  const scoreRuleHtml = `<div class="mb-4 flex flex-wrap gap-3">
    <div class="p-3 rounded-xl flex items-center gap-2 ${state.format === 'tournament' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}">
      <i class="fas fa-bullseye"></i>
      <span class="text-sm font-bold">${state.targetScore}${SCORE_UNIT} 선취제 (${state.format === 'tournament' ? '본선/토너먼트' : '예선'})</span>
    </div>
    ${isAdmin && hasGroupMatches && !hasFinalsMatches ? `
    <button onclick="showFinalsModal()" class="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:from-red-600 hover:to-red-700 transition">
      <i class="fas fa-crown mr-1"></i>결선 토너먼트 생성 (${groupProgress}% 완료)
    </button>` : ''}
    ${isAdmin ? `<button onclick="showBracketOptionsModal()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
      <i class="fas fa-magic mr-1"></i>대진표 옵션
    </button>` : ''}
  </div>`;

  // 종목별 → 조별 → 라운드별 그룹핑
  const byEvent = {};
  const finalsByEvent = {};
  matches.forEach(m => {
    const evKey = m.event_name || '전체';
    if (hasGroupMatches && !m.group_num) {
      // 결선 경기
      if (!finalsByEvent[evKey]) finalsByEvent[evKey] = {};
      if (!finalsByEvent[evKey][m.round]) finalsByEvent[evKey][m.round] = [];
      finalsByEvent[evKey][m.round].push(m);
    } else {
      // 조별 경기 또는 일반 경기
      if (!byEvent[evKey]) byEvent[evKey] = {};
      const groupKey = m.group_num ? `${m.group_num}조` : '전체';
      if (!byEvent[evKey][groupKey]) byEvent[evKey][groupKey] = {};
      if (!byEvent[evKey][groupKey][m.round]) byEvent[evKey][groupKey][m.round] = [];
      byEvent[evKey][groupKey][m.round].push(m);
    }
  });

  const hasFinals = Object.keys(finalsByEvent).length > 0;

  return `<div class="space-y-6">${scoreRuleHtml}
    ${hasFinals ? `
    <!-- 결선 토너먼트 -->
    <div class="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border-2 border-red-200 p-5">
      <h2 class="text-xl font-extrabold text-red-700 mb-4 flex items-center gap-2">
        <i class="fas fa-crown text-yellow-500"></i>결선 토너먼트 (${SC.scoring ? SC.scoring.tournamentTargetScore : 21}${SCORE_UNIT} 선취)
      </h2>
      ${Object.entries(finalsByEvent).map(([eventName, rounds]) => `
        <div class="mb-4">
          <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-layer-group text-red-500"></i>${eventName}</h3>
          ${Object.entries(rounds).sort(([a],[b]) => a-b).map(([round, ms]) => `
            <div class="mb-3">
              <h5 class="text-xs font-semibold text-red-400 mb-2"><i class="fas fa-trophy mr-1"></i>결선 ${round}라운드</h5>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${ms.map(m => renderMatchCard(m, isAdmin)).join('')}</div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>` : ''}

    ${Object.keys(byEvent).length > 0 ? `
    <!-- 조별 리그 / 예선 -->
    ${hasFinals ? `<h2 class="text-lg font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-th-large text-indigo-500"></i>조별 리그 (예선)</h2>` : ''}
    ${Object.entries(byEvent).map(([eventName, groups]) => `
      <div>
        <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-layer-group text-${P}-500"></i>${eventName}</h3>
        ${Object.entries(groups).map(([groupName, rounds]) => `
          <div class="mb-4">
            ${groupName !== '전체' ? `<h4 class="text-sm font-bold text-indigo-600 mb-2 flex items-center gap-1"><i class="fas fa-th-large"></i>${groupName}</h4>` : ''}
            ${Object.entries(rounds).sort(([a],[b]) => a-b).map(([round, ms]) => `
              <div class="mb-3">
                <h5 class="text-xs font-semibold text-gray-400 mb-2">${round}라운드</h5>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${ms.map(m => renderMatchCard(m, isAdmin)).join('')}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `).join('')}` : ''}
  </div>`;
}

function renderMatchCard(m, isAdmin) {
  const st = { pending: { l: '대기', c: 'bg-gray-100 text-gray-600', bc: 'border-gray-200' }, playing: { l: '진행중', c: 'bg-green-100 text-green-700', bc: 'border-green-300 ring-2 ring-green-100' }, completed: { l: '완료', c: T.bg100+' '+T.text700, bc: 'border-gray-200' } };
  const s = st[m.status] || st.pending;
  const t1 = m.team1_name || 'BYE', t2 = m.team2_name || 'BYE';
  const t1T = m.team1_set1||0, t2T = m.team2_set1||0;
  return `<div class="bg-white rounded-xl border ${s.bc} p-3 shadow-sm hover:shadow-md transition-shadow">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-1.5"><span class="text-xs text-gray-400 font-mono">#${m.match_order}</span>${m.court_number?`<span class="badge bg-yellow-50 text-yellow-700 text-xs border border-yellow-200">${m.court_number}코트</span>`:''} ${m.group_num ? `<span class="badge bg-indigo-50 text-indigo-600 text-xs border border-indigo-200">${m.group_num}조</span>` : ''}</div>
      <div class="flex items-center gap-1">${m.status==='playing'?'<span class="w-2 h-2 rounded-full bg-green-500 pulse-live"></span>':''}<span class="badge ${s.c} text-xs">${s.l}</span></div>
    </div>
    <div class="space-y-1.5">
      <div class="flex items-center justify-between ${m.winner_team===1?'font-bold text-${P}-700':''}"><span class="text-sm truncate mr-2">${m.winner_team===1?'🏆 ':''}${t1}</span><span class="scoreboard-num text-lg font-bold">${t1T}</span></div>
      <div class="h-px bg-gray-100"></div>
      <div class="flex items-center justify-between ${m.winner_team===2?'font-bold text-${P}-700':''}"><span class="text-sm truncate mr-2">${m.winner_team===2?'🏆 ':''}${t2}</span><span class="scoreboard-num text-lg font-bold">${t2T}</span></div>
    </div>
    ${isAdmin && m.status!=='cancelled' ? `<div class="mt-2 pt-2 border-t border-gray-100 flex gap-2">
      ${m.status==='pending'?`<button onclick="startMatch(${m.id})" class="flex-1 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"><i class="fas fa-play mr-1"></i>시작</button>`:''}
      ${m.status==='playing'?`<button onclick="showScoreModal(${m.id})" class="flex-1 py-1.5 bg-${P}-50 text-${P}-700 rounded-lg text-xs font-medium hover:bg-${P}-100"><i class="fas fa-edit mr-1"></i>점수</button>`:''}
      ${m.status==='completed'?`<button onclick="showScoreModal(${m.id})" class="flex-1 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100"><i class="fas fa-edit mr-1"></i>수정</button>`:''}
      ${m.status!=='playing'?`<button onclick="showCourtChangeModal(${m.id})" class="py-1.5 px-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100" title="코트 변경"><i class="fas fa-exchange-alt"></i></button>`:''}
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
        <div class="bg-white/5 rounded-xl p-4 text-center"><div class="text-3xl font-extrabold ${T.text400}">${completed.length}</div><div class="text-xs text-gray-400">완료</div></div>
      </div>
      ${completed.length > 0 ? `<h2 class="text-lg font-bold mb-4"><i class="fas fa-history mr-2"></i>최근 결과</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${completed.slice(-6).reverse().map(m => renderScoreCard(m)).join('')}</div>` : ''}
    </div>
  </div>`;
}

function renderScoreCard(m) {
  const t1 = m.team1_name || 'BYE', t2 = m.team2_name || 'BYE';
  const t1T = m.team1_set1||0, t2T = m.team2_set1||0;
  const live = m.status==='playing';
  return `<div class="bg-white/10 rounded-xl p-3 ${live?'ring-2 ring-green-500/50':''}">
    <div class="flex justify-between mb-2">
      <span class="text-xs text-gray-400">${m.court_number ? m.court_number+'코트 ' : ''}#${m.match_order} ${m.event_name||''} ${m.group_num ? m.group_num+'조' : ''}</span>
      ${live?'<span class="text-xs text-green-400 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500 pulse-live"></span>LIVE</span>':`<span class="text-xs ${T.text400}">완료</span>`}
    </div>
    <div class="space-y-1">
      <div class="flex justify-between items-center ${m.winner_team===1?'text-yellow-400':''}"><span class="text-sm font-medium">${m.winner_team===1?'🏆 ':''}${t1}</span><span class="text-2xl font-extrabold scoreboard-num">${t1T}</span></div>
      <div class="h-px bg-white/10"></div>
      <div class="flex justify-between items-center ${m.winner_team===2?'text-yellow-400':''}"><span class="text-sm font-medium">${m.winner_team===2?'🏆 ':''}${t2}</span><span class="text-2xl font-extrabold scoreboard-num">${t2T}</span></div>
    </div>
  </div>`;
}

// ---- RESULTS ----
function renderResults() {
  const t = state.currentTournament;
  const byEvent = {};
  state.standings.forEach(s => {
    const key = s.event_name || '전체';
    if (!byEvent[key]) byEvent[key] = [];
    byEvent[key].push(s);
  });
  const eventNames = Object.keys(byEvent);
  const totalTeams = state.standings.length;
  const topWinner = state.standings.length > 0 ? state.standings[0] : null;

  return `${renderNav()}${renderOffline()}

  <!-- Hero Banner -->
  <div class="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 relative overflow-hidden">
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-10 left-10 w-32 h-32 rounded-full bg-yellow-400 blur-3xl"></div>
      <div class="absolute bottom-10 right-20 w-40 h-40 rounded-full bg-purple-400 blur-3xl"></div>
    </div>
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
      <!-- Top Bar -->
      <div class="flex items-center justify-between mb-5">
        <button onclick="navigate('tournament')" class="flex items-center gap-2 text-white/60 hover:text-white transition text-sm group">
          <i class="fas fa-arrow-left group-hover:-translate-x-0.5 transition-transform"></i>대회로 돌아가기
        </button>
        <button onclick="exportToPDF()" class="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-xs hover:bg-red-500/30 transition backdrop-blur border border-red-500/20"><i class="fas fa-file-pdf mr-1.5"></i>PDF 저장</button>
      </div>
      <!-- Title -->
      <div class="flex items-center gap-4 mb-6">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-xl shadow-yellow-500/20 flex-shrink-0">
          <i class="fas fa-trophy text-xl text-white"></i>
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">${t?.name || '결과'}</h1>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-white/50 text-sm">결과 / 순위</span>
            <span class="text-white/30">·</span>
            <span class="text-white/50 text-sm">${eventNames.length}개 종목</span>
          </div>
        </div>
      </div>
      <!-- Stats Cards -->
      <div class="grid grid-cols-3 gap-3 sm:gap-4">
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${eventNames.length}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-layer-group mr-1"></i>종목</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${totalTeams}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-users mr-1"></i>참가 팀</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-yellow-400">${topWinner?.team_name || '-'}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-crown mr-1"></i>최고 성적</div>
        </div>
      </div>
    </div>
    <!-- Wave Divider -->
    <svg class="w-full h-6 sm:h-8" viewBox="0 0 1440 30" fill="none" preserveAspectRatio="none">
      <path d="M0,0 C360,30 1080,30 1440,0 L1440,30 L0,30 Z" fill="#f8fafc"/>
    </svg>
  </div>

  <div class="bg-slate-50 min-h-screen">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 -mt-1 pb-10 fade-in">
    <div id="results-table">
    ${eventNames.length === 0 ? '<div class="text-center py-16 text-gray-400"><i class="fas fa-trophy text-5xl mb-4"></i><p class="text-lg font-medium">아직 결과가 없습니다</p><p class="text-sm mt-1">경기가 완료되면 순위가 표시됩니다</p></div>' : ''}
    ${Object.entries(byEvent).map(([eventName, standings]) => {
      const catKey = standings[0]?.category || '';
      const catIcon = catKey === 'md' ? 'fa-mars' : catKey === 'wd' ? 'fa-venus' : catKey === 'xd' ? 'fa-venus-mars' : 'fa-trophy';
      const catGrad = catKey === 'md' ? 'from-blue-400 to-blue-600' : catKey === 'wd' ? 'from-pink-400 to-pink-600' : catKey === 'xd' ? 'from-purple-400 to-purple-600' : 'from-yellow-400 to-yellow-600';
      const catShadow = catKey === 'md' ? 'shadow-blue-500/20' : catKey === 'wd' ? 'shadow-pink-500/20' : catKey === 'xd' ? 'shadow-purple-500/20' : 'shadow-yellow-500/20';
      return `
      <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-lg font-bold text-gray-800 mb-5 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br ${catGrad} flex items-center justify-center mr-2.5 shadow-md ${catShadow}"><i class="fas ${catIcon} text-white text-xs"></i></div>${eventName}</h3>

        <!-- 시상대 (3팀 이상일 때) -->
        ${standings.length >= 3 ? `<div class="flex items-end justify-center gap-3 sm:gap-5 mb-6 px-4">
          <!-- 2위 -->
          <div class="text-center flex-shrink-0">
            <div class="w-16 sm:w-20 h-20 sm:h-24 bg-gradient-to-b from-gray-100 to-gray-200 rounded-t-2xl flex flex-col items-center justify-center border border-gray-300 border-b-0">
              <span class="text-2xl sm:text-3xl mb-0.5">&#129352;</span>
              <span class="text-xs font-bold text-gray-500">2nd</span>
            </div>
            <div class="bg-gray-200 rounded-b-xl px-2 py-2 border border-gray-300 border-t-0">
              <p class="font-bold text-xs sm:text-sm text-gray-700 truncate max-w-[80px] sm:max-w-[100px]">${standings[1]?.team_name||''}</p>
              <p class="text-[10px] text-gray-500 mt-0.5">${standings[1]?.wins||0}승 ${standings[1]?.losses||0}패</p>
            </div>
          </div>
          <!-- 1위 -->
          <div class="text-center flex-shrink-0 -mt-6">
            <div class="w-20 sm:w-24 h-28 sm:h-32 bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-t-2xl flex flex-col items-center justify-center border-2 border-yellow-400 border-b-0 relative">
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md"><i class="fas fa-crown text-white text-[10px]"></i></div>
              <span class="text-3xl sm:text-4xl mb-0.5 mt-2">&#129351;</span>
              <span class="text-xs font-bold text-yellow-600">1st</span>
            </div>
            <div class="bg-yellow-100 rounded-b-xl px-2 py-2 border-2 border-yellow-400 border-t-0">
              <p class="font-bold text-sm sm:text-base text-yellow-800 truncate max-w-[90px] sm:max-w-[120px]">${standings[0]?.team_name||''}</p>
              <p class="text-[10px] text-yellow-600 mt-0.5">${standings[0]?.wins||0}승 ${standings[0]?.losses||0}패</p>
            </div>
          </div>
          <!-- 3위 -->
          <div class="text-center flex-shrink-0">
            <div class="w-16 sm:w-20 h-16 sm:h-20 bg-gradient-to-b from-orange-50 to-orange-100 rounded-t-2xl flex flex-col items-center justify-center border border-orange-300 border-b-0">
              <span class="text-2xl sm:text-3xl mb-0.5">&#129353;</span>
              <span class="text-xs font-bold text-orange-500">3rd</span>
            </div>
            <div class="bg-orange-100 rounded-b-xl px-2 py-2 border border-orange-300 border-t-0">
              <p class="font-bold text-xs sm:text-sm text-orange-700 truncate max-w-[80px] sm:max-w-[100px]">${standings[2]?.team_name||''}</p>
              <p class="text-[10px] text-orange-500 mt-0.5">${standings[2]?.wins||0}승 ${standings[2]?.losses||0}패</p>
            </div>
          </div>
        </div>` : ''}

        <!-- 순위 테이블 -->
        <div class="overflow-x-auto rounded-xl border border-gray-100">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200"><tr>
              <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-14">순위</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">팀</th>
              <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">승점</th>
              <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">승</th>
              <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">패</th>
              <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">득실차</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
              ${standings.map((s, i) => {
                const medalHtml = i===0 ? '<span class="text-lg">&#129351;</span>' : i===1 ? '<span class="text-lg">&#129352;</span>' : i===2 ? '<span class="text-lg">&#129353;</span>' : `<span class="w-6 h-6 rounded-full bg-gray-100 inline-flex items-center justify-center text-xs font-bold text-gray-500">${i+1}</span>`;
                const rowBg = i===0 ? 'bg-yellow-50/50' : i===1 ? 'bg-gray-50/50' : i===2 ? 'bg-orange-50/50' : '';
                return `<tr class="${rowBg} hover:bg-gray-50 transition-colors">
                  <td class="px-3 py-3 text-center">${medalHtml}</td>
                  <td class="px-4 py-3 font-semibold text-gray-800">${s.team_name}</td>
                  <td class="px-3 py-3 text-center"><span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-${P}-100 text-${P}-700 font-extrabold text-sm">${s.points}</span></td>
                  <td class="px-3 py-3 text-center text-green-600 font-bold text-sm">${s.wins}</td>
                  <td class="px-3 py-3 text-center text-red-500 font-medium text-sm">${s.losses}</td>
                  <td class="px-3 py-3 text-center"><span class="font-bold text-sm ${s.goal_difference>0?'text-green-600':s.goal_difference<0?'text-red-500':'text-gray-400'}">${s.goal_difference>0?'+':''}${s.goal_difference}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }).join('')}
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
    data.mixed_doubles = fd.has('mixed_doubles') ? 1 : 0;
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

  const mySearchForm = document.getElementById('my-search-form');
  if (mySearchForm) mySearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    searchMyMatches();
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
    // 대회의 종목에 맞게 config 전환
    const tournamentSport = d.tournament.sport || 'badminton';
    switchSportConfig(tournamentSport);
    await loadParticipants(id); await loadEvents(id); await loadMatches(id);
    state.activeTab = 'participants'; navigate('tournament');
  } catch(e){}
}

async function loadParticipants(tid) { try { const d = await api(`/tournaments/${tid}/participants`); state.participants = d.participants; } catch(e){} }
async function loadEvents(tid) { try { const d = await api(`/tournaments/${tid}/events`); state.events = d.events; } catch(e){} }
async function loadMatches(tid) { try { const d = await api(`/tournaments/${tid}/matches`); state.matches = d.matches; if (d.target_score) state.targetScore = d.target_score; if (d.format) state.format = d.format; } catch(e){} }

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

// Auth (세션 유지: localStorage)
function showAuthModal(tid) { document.getElementById('auth-modal').classList.remove('hidden'); document.getElementById('auth-password').focus(); state._authTid = tid; }
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }
async function authenticate() {
  const pw = document.getElementById('auth-password').value.trim();
  try { await api(`/tournaments/${state._authTid}/auth`, { method: 'POST', body: JSON.stringify({ admin_password: pw }) });
    state.adminAuth[state._authTid] = true; state.adminPasswords[state._authTid] = pw;
    // localStorage에 세션 저장
    try { localStorage.setItem('sport_admin_auth', JSON.stringify(state.adminAuth)); localStorage.setItem('sport_admin_pw', JSON.stringify(state.adminPasswords)); } catch(e){}
    closeAuthModal(); document.getElementById('auth-password').value = ''; showToast('관리자 인증 성공!', 'success'); render();
  } catch(e){ document.getElementById('auth-password').value = ''; document.getElementById('auth-password').focus(); }
}
// 세션 복원
function restoreAdminSession() {
  try {
    const auth = localStorage.getItem('sport_admin_auth');
    const pw = localStorage.getItem('sport_admin_pw');
    if (auth) Object.assign(state.adminAuth, JSON.parse(auth));
    if (pw) Object.assign(state.adminPasswords, JSON.parse(pw));
  } catch(e){}
}

// Participant actions
async function togglePaid(pid) { const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/participants/${pid}/paid`, { method: 'PATCH' }); await loadParticipants(tid); render(); } catch(e){} }
async function toggleCheckin(pid) { const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/participants/${pid}/checkin`, { method: 'PATCH' }); await loadParticipants(tid); render(); } catch(e){} }
async function toggleMixedDoubles(pid) { const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/participants/${pid}/mixed-doubles`, { method: 'PATCH' }); await loadParticipants(tid); render(); } catch(e){} }
async function deleteParticipant(pid) { if (!confirm('삭제하시겠습니까?')) return; const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/participants/${pid}`, { method: 'DELETE' }); showToast('삭제됨', 'success'); await loadParticipants(tid); render(); } catch(e){} }

// ==========================================
// BULK REGISTRATION
// ==========================================
function showBulkModal() {
  const modal = document.createElement('div');
  modal.id = 'bulk-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900"><i class="fas fa-file-import mr-2 text-indigo-500"></i>참가자 일괄 등록</h3>
        <button onclick="closeBulkModal()" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"><i class="fas fa-times text-gray-400"></i></button>
      </div>
    </div>
    <div class="p-6 overflow-y-auto flex-1">
      <div class="mb-3 p-3 ${T.bg50} rounded-lg text-sm ${T.text700}">
        <p class="font-semibold mb-1"><i class="fas fa-info-circle mr-1"></i>입력 형식 안내</p>
        <p>한 줄에 한 명씩 · 탭(Tab) 또는 콤마(,)로 구분</p>
        <p class="mt-1 font-mono text-xs ${T.bg100} rounded p-2">이름, 성별(남/여), 출생년도, 급수, 연락처, 혼복(O/X), 소속클럽, 희망파트너<br>김민수, 남, 1985, A, 010-1234-5678, O, 안양시청, 이정호<br>박서연, 여, 1992, B, , X, 만안클럽, </p>
        <p class="mt-1 text-xs ${T.text500}">* 엑셀에서 복사(Ctrl+C)하여 바로 붙여넣기(Ctrl+V) 가능!</p>
      </div>
      <textarea id="bulk-text" rows="10" class="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y" placeholder="김민수, 남, 1985, A, 010-1234-5678, O, 안양시청, 이정호&#10;박서연, 여, 1992, B, , O, 동안셔틀&#10;이정호, 남, 1990, C, , , 만안클럽, 김민수"></textarea>
      <div class="mt-2 flex items-center justify-between">
        <span id="bulk-count" class="text-sm text-gray-400">0명 감지</span>
        <button onclick="previewBulk()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"><i class="fas fa-eye mr-1"></i>미리보기</button>
      </div>
      <div id="bulk-preview" class="hidden mt-4">
        <h4 class="font-semibold text-gray-800 mb-2"><i class="fas fa-list mr-1"></i>미리보기 (<span id="preview-count">0</span>명)</h4>
        <div class="max-h-60 overflow-y-auto border rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-0"><tr>
              <th class="px-2 py-2 text-left text-xs">#</th><th class="px-2 py-2 text-left text-xs">이름</th><th class="px-2 py-2 text-center text-xs">성별</th>
              <th class="px-2 py-2 text-center text-xs">급수</th><th class="px-2 py-2 text-left text-xs">소속</th><th class="px-2 py-2 text-left text-xs">파트너</th><th class="px-2 py-2 text-center text-xs">혼복</th><th class="px-2 py-2 text-center text-xs">상태</th>
            </tr></thead>
            <tbody id="preview-body" class="divide-y divide-gray-100"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="p-6 border-t border-gray-200 flex gap-3">
      <button onclick="closeBulkModal()" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">취소</button>
      <button onclick="submitBulk()" id="bulk-submit-btn" class="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md"><i class="fas fa-check mr-2"></i>일괄 등록</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const ta = document.getElementById('bulk-text');
  if (ta) ta.addEventListener('input', () => {
    const lines = ta.value.split('\n').filter(l => l.trim());
    document.getElementById('bulk-count').textContent = lines.length + '명 감지';
  });
}

function closeBulkModal() { const m = document.getElementById('bulk-modal'); if (m) m.remove(); }

function parseBulkText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length === 0) return [];
  const headerPatterns = ['이름', 'name', '성별', 'gender', '급수', 'level', '소속', 'club'];
  const firstLine = lines[0].toLowerCase();
  const isHeader = headerPatterns.some(h => firstLine.includes(h));
  const dataLines = isHeader ? lines.slice(1) : lines;

  const genderMap = { '남': 'm', '여': 'f', '남자': 'm', '여자': 'f', 'm': 'm', 'f': 'f', 'M': 'm', 'F': 'f' };
  const levelMap = { 's': 's', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'S': 's', 'A': 'a', 'B': 'b', 'C': 'c', 'D': 'd', 'E': 'e' };

  return dataLines.map(line => {
    let parts = line.includes('\t') ? line.split('\t') : line.split(',');
    parts = parts.map(p => p.trim()).filter(p => p);
    if (parts.length === 0) return null;

    const result = { name: '', gender: '', birth_year: null, level: 'c', phone: '', mixed_doubles: false, club: '', partner_name: '', valid: true, error: '' };
    result.name = parts[0] || '';

    // 마지막 필드가 파트너 이름인지 확인 (8번째 필드)
    let remainingParts = parts.slice(1);
    // 파트너 이름은 마지막 필드로 처리 (7개 이상일 때)
    let potentialPartner = '';
    if (parts.length >= 8) {
      potentialPartner = parts[7].trim();
      remainingParts = parts.slice(1, 7);
    }

    for (let i = 0; i < remainingParts.length; i++) {
      const val = remainingParts[i].trim();
      const valLower = val.toLowerCase();
      if (genderMap[val] || genderMap[valLower]) { result.gender = genderMap[val] || genderMap[valLower]; continue; }
      const mixedMap = { 'o': true, 'x': false, '혼복': true, 'yes': true, 'no': false, '1': true, '0': false, 'y': true, 'n': false };
      if (mixedMap[valLower] !== undefined) { result.mixed_doubles = mixedMap[valLower]; continue; }
      if (levelMap[val] || levelMap[valLower]) { result.level = levelMap[val] || levelMap[valLower]; continue; }
      const num = parseInt(val);
      if (!isNaN(num) && num >= 1950 && num <= 2015) { result.birth_year = num; continue; }
      if (val.includes('-') || (val.startsWith('0') && val.length >= 10)) { result.phone = val; continue; }
      // 남은 문자열은 클럽명으로
      if (val.length >= 2 && !result.club) { result.club = val; continue; }
    }

    // 파트너 이름 설정
    if (potentialPartner) {
      result.partner_name = potentialPartner;
    }

    if (!result.name) { result.valid = false; result.error = '이름 없음'; }
    if (!result.gender) { result.valid = false; result.error = (result.error ? result.error + ', ' : '') + '성별 없음'; }
    return result;
  }).filter(r => r !== null);
}

function previewBulk() {
  const text = document.getElementById('bulk-text').value;
  const parsed = parseBulkText(text);
  const previewDiv = document.getElementById('bulk-preview');
  const body = document.getElementById('preview-body');
  const countEl = document.getElementById('preview-count');
  if (parsed.length === 0) { showToast('입력된 데이터가 없습니다.', 'warning'); return; }
  previewDiv.classList.remove('hidden');
  countEl.textContent = parsed.length;
  body.innerHTML = parsed.map((p, i) => {
    const status = p.valid ? '<span class="badge bg-green-100 text-green-700"><i class="fas fa-check mr-1"></i>OK</span>' : `<span class="badge bg-red-100 text-red-600">${p.error}</span>`;
    const gLabel = p.gender === 'm' ? '<span class="badge bg-blue-100 text-blue-700">남</span>' : p.gender === 'f' ? '<span class="badge bg-pink-100 text-pink-700">여</span>' : '<span class="text-red-500">?</span>';
    return `<tr class="${p.valid ? '' : 'bg-red-50'}">
      <td class="px-2 py-1.5 text-gray-400">${i+1}</td>
      <td class="px-2 py-1.5 font-medium">${p.name||'-'}</td>
      <td class="px-2 py-1.5 text-center">${gLabel}</td>
      <td class="px-2 py-1.5 text-center"><span class="badge ${LEVEL_COLORS[p.level]||''}">${LEVELS[p.level]||'C'}</span></td>
      <td class="px-2 py-1.5 text-gray-500">${p.club || '-'}</td>
      <td class="px-2 py-1.5 text-orange-600 font-medium">${p.partner_name || '-'}</td>
      <td class="px-2 py-1.5 text-center">${p.mixed_doubles ? '<span class="text-purple-500"><i class="fas fa-venus-mars"></i></span>' : '-'}</td>
      <td class="px-2 py-1.5 text-center">${status}</td>
    </tr>`;
  }).join('');
}

async function submitBulk() {
  const text = document.getElementById('bulk-text').value;
  const parsed = parseBulkText(text);
  const valid = parsed.filter(p => p.valid);
  if (valid.length === 0) { showToast('등록 가능한 참가자가 없습니다.', 'error'); return; }
  const btn = document.getElementById('bulk-submit-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>등록 중...';
  const tid = state.currentTournament.id;
  try {
    const data = valid.map(p => ({ name: p.name, gender: p.gender, birth_year: p.birth_year, level: p.level, phone: p.phone, mixed_doubles: p.mixed_doubles ? 1 : 0, club: p.club, partner_name: p.partner_name || '' }));
    const res = await api(`/tournaments/${tid}/participants/bulk`, { method: 'POST', body: JSON.stringify({ participants: data }) });
    closeBulkModal(); showToast(res.message, 'success');
    await loadParticipants(tid); render();
  } catch(e) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check mr-2"></i>일괄 등록'; }
}

// Event actions
async function deleteEvent(eid) { if (!confirm('종목과 관련 팀/경기를 모두 삭제합니다.')) return; const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/events/${eid}`, { method: 'DELETE' }); showToast('종목 삭제됨', 'success'); await loadEvents(tid); render(); } catch(e){} }

async function loadTeams(eid) {
  const tid = state.currentTournament.id;
  const isAdmin = state.adminAuth[tid];
  try {
    const d = await api(`/tournaments/${tid}/events/${eid}/teams`);
    const el = document.getElementById(`teams-${eid}`);
    if (d.teams.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 py-2">등록된 팀이 없습니다.</p>'; return; }

    // 조별 그룹핑
    const byGroup = {};
    d.teams.forEach(t => {
      const g = t.group_num || 0;
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(t);
    });

    let html = '';
    for (const [groupNum, teams] of Object.entries(byGroup)) {
      if (groupNum !== '0') html += `<div class="text-xs font-bold text-indigo-600 mt-2 mb-1"><i class="fas fa-th-large mr-1"></i>${groupNum}조</div>`;
      html += `<div class="space-y-0.5">${teams.map((t, i) => `
        <div class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400 w-5">${i+1}</span>
            <span class="font-medium text-sm">${t.team_name || (t.p1_name && t.p2_name ? t.p1_name + ' · ' + t.p2_name : '팀 ' + (i+1))}</span>
            <span class="badge ${LEVEL_COLORS[t.p1_level]||''} text-xs">${LEVELS[t.p1_level]||''}</span>
            <span class="badge ${LEVEL_COLORS[t.p2_level]||''} text-xs">${LEVELS[t.p2_level]||''}</span>
            ${t.p1_club ? `<span class="text-xs text-teal-600">${t.p1_club}</span>` : ''}
            ${t.p2_club && t.p2_club !== t.p1_club ? `<span class="text-xs text-teal-600">/ ${t.p2_club}</span>` : ''}
          </div>
          ${isAdmin ? `<button onclick="deleteTeam(${eid},${t.id})" class="text-red-400 hover:text-red-600 text-xs"><i class="fas fa-times"></i></button>` : ''}
        </div>
      `).join('')}</div>`;
    }
    el.innerHTML = html;
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
  const modal = document.createElement('div');
  modal.id = 'team-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-plus mr-2 text-${P}-500"></i>팀 등록 - ${CATEGORIES[category]}</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-semibold text-gray-700 mb-1">${category==='xd'?'남자':'선수'} 1</label>
        <select id="team-p1" class="w-full px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
          ${(category==='xd'?state.participants.filter(p=>p.gender==='m'):filtered1).map(p => `<option value="${p.id}">${p.name} (${LEVELS[p.level]}급${p.club?' · '+p.club:''})</option>`).join('')}
        </select></div>
      <div><label class="block text-sm font-semibold text-gray-700 mb-1">${category==='xd'?'여자':'선수'} 2</label>
        <select id="team-p2" class="w-full px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-${P}-500">
          ${(category==='xd'?state.participants.filter(p=>p.gender==='f'):filtered2).map(p => `<option value="${p.id}">${p.name} (${LEVELS[p.level]}급${p.club?' · '+p.club:''})</option>`).join('')}
        </select></div>
    </div>
    <div class="flex gap-2 mt-5"><button onclick="document.getElementById('team-modal').remove()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium">취소</button>
      <button onclick="submitTeam(${eid})" class="flex-1 py-2.5 bg-${P}-600 text-white rounded-xl font-medium">등록</button></div>
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

// Merge
async function checkMerge() {
  const tid = state.currentTournament.id;
  try {
    const d = await api(`/tournaments/${tid}/events/check-merge`, { method: 'POST' });
    const el = document.getElementById('merge-result');
    if (d.merges.length === 0) {
      el.innerHTML = `<div class="p-3 bg-green-50 text-green-700 rounded-xl text-sm mb-4">
        <div class="flex items-center justify-between">
          <span><i class="fas fa-check mr-1"></i>급수합병 대상이 없습니다. (기준: 종목당 최소 ${d.threshold}팀)</span>
          <button onclick="showThresholdModal()" class="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-medium hover:bg-green-200"><i class="fas fa-sliders-h mr-1"></i>기준 변경</button>
        </div>
      </div>`;
      return;
    }
    el.innerHTML = `<div class="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-bold text-amber-800"><i class="fas fa-compress-arrows-alt mr-1"></i>급수합병 필요 (기준: ${d.threshold}팀 미만)</h4>
        <button onclick="showThresholdModal()" class="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200"><i class="fas fa-sliders-h mr-1"></i>기준 변경</button>
      </div>
      ${d.merges.map((m, i) => `<div class="flex items-center justify-between py-2 ${i>0?'border-t border-amber-100':''}">
        <div><p class="text-sm font-medium text-amber-900">${m.merged_name} (${m.combined_teams}팀)</p><p class="text-xs text-amber-600">${m.reason}</p></div>
        <button onclick="executeMerge([${m.events.map(e=>e.id).join(',')}])" class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">합병 실행</button>
      </div>`).join('')}
    </div>`;
  } catch(e){}
}

async function executeMerge(eventIds) {
  if (!confirm('선택된 종목을 합병합니다. 계속하시겠습니까?')) return;
  const tid = state.currentTournament.id;
  try { await api(`/tournaments/${tid}/events/execute-merge`, { method: 'POST', body: JSON.stringify({ event_ids: eventIds }) }); showToast('급수합병 완료!', 'success'); await loadEvents(tid); navigate('tournament'); } catch(e){}
}

// ==========================================
// ★ 수동 합병 모달 ★
// ==========================================
function showManualMergeModal() {
  if (state.events.length < 2) return showToast('합병하려면 종목이 2개 이상 필요합니다.', 'warning');
  const existing = document.getElementById('manual-merge-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'manual-merge-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
    <div class="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
      <h3 class="text-lg font-bold text-gray-900"><i class="fas fa-object-group mr-2 text-amber-500"></i>수동 종목 합병</h3>
      <button onclick="this.closest('.modal-overlay').remove()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
    </div>
    <div class="p-6 space-y-4">
      <p class="text-sm text-gray-500">합병할 종목을 2개 이상 선택하세요. 카테고리/연령대가 달라도 합병 가능합니다.</p>
      <div class="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
        ${state.events.map(ev => `
          <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" value="${ev.id}" class="merge-cb w-4 h-4 text-amber-500 rounded focus:ring-amber-400">
            <div class="flex-1">
              <span class="badge text-xs ${ev.category==='md'?'bg-blue-100 text-blue-700':ev.category==='wd'?'bg-pink-100 text-pink-700':'bg-purple-100 text-purple-700'}">${CATEGORIES[ev.category]}</span>
              <span class="text-sm font-medium ml-1">${ev.name}</span>
              <span class="text-xs text-gray-400 ml-1">${ev.team_count || 0}팀</span>
              ${ev.merged_from ? '<span class="badge bg-amber-100 text-amber-700 text-xs ml-1">합병</span>' : ''}
            </div>
          </label>
        `).join('')}
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 mb-1">합병 종목명 (비우면 자동 생성)</label>
        <input type="text" id="merge-custom-name" placeholder="예: 남복 50~55대 A+B급" class="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400">
      </div>
      <div id="merge-preview" class="text-sm text-gray-500"></div>
      <button onclick="executeManualMerge()" class="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-md"><i class="fas fa-compress-arrows-alt mr-2"></i>선택 종목 합병</button>
    </div>
  </div>`;
  document.body.appendChild(modal);

  // 체크박스 변경 시 미리보기 업데이트
  modal.querySelectorAll('.merge-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...modal.querySelectorAll('.merge-cb:checked')].map(c => parseInt(c.value));
      const preview = document.getElementById('merge-preview');
      if (checked.length < 2) { preview.innerHTML = '<span class="text-gray-400">2개 이상 선택하세요</span>'; return; }
      const selected = state.events.filter(e => checked.includes(e.id));
      const totalTeams = selected.reduce((s, e) => s + (e.team_count || 0), 0);
      preview.innerHTML = `<span class="text-amber-700 font-medium">${selected.length}개 종목 선택 (총 ${totalTeams}팀)</span>`;
    });
  });
}

async function executeManualMerge() {
  const modal = document.getElementById('manual-merge-modal');
  const checked = [...modal.querySelectorAll('.merge-cb:checked')].map(c => parseInt(c.value));
  if (checked.length < 2) return showToast('2개 이상의 종목을 선택해주세요.', 'warning');
  const customName = document.getElementById('merge-custom-name').value.trim();
  if (!confirm(`${checked.length}개 종목을 합병합니다. 계속하시겠습니까?`)) return;
  const tid = state.currentTournament.id;
  try {
    const body = { event_ids: checked };
    if (customName) body.custom_name = customName;
    const res = await api(`/tournaments/${tid}/events/execute-merge`, { method: 'POST', body: JSON.stringify(body) });
    showToast(res.message, 'success');
    modal.remove();
    await loadEvents(tid); navigate('tournament');
  } catch(e) {}
}

// ==========================================
// ★ 합병 기준(threshold) 변경 모달 ★
// ==========================================
function showThresholdModal() {
  const t = state.currentTournament;
  const existing = document.getElementById('threshold-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'threshold-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4">
    <div class="px-6 py-4 border-b flex items-center justify-between">
      <h3 class="text-lg font-bold text-gray-900"><i class="fas fa-sliders-h mr-2 text-amber-500"></i>합병 기준 변경</h3>
      <button onclick="this.closest('.modal-overlay').remove()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
    </div>
    <div class="p-6 space-y-4">
      <p class="text-sm text-gray-500">종목의 참가팀이 이 수 미만이면 급수합병 대상으로 표시됩니다.</p>
      <div class="flex items-center gap-3">
        <input type="range" id="threshold-range" min="2" max="20" value="${t.merge_threshold || 4}" class="flex-1 accent-amber-500"
          oninput="document.getElementById('threshold-val').textContent=this.value">
        <span id="threshold-val" class="text-2xl font-bold text-amber-600 w-8 text-center">${t.merge_threshold || 4}</span>
        <span class="text-sm text-gray-500">팀</span>
      </div>
      <button onclick="saveThreshold()" class="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600"><i class="fas fa-check mr-2"></i>저장</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function saveThreshold() {
  const val = parseInt(document.getElementById('threshold-range').value);
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/merge-threshold`, { method: 'PATCH', body: JSON.stringify({ threshold: val }) });
    state.currentTournament.merge_threshold = val;
    showToast(`합병 기준이 ${val}팀으로 변경되었습니다.`, 'success');
    document.getElementById('threshold-modal').remove();
    checkMerge();
  } catch(e) {}
}

// ==========================================
// ★ 합병 취소 (되돌리기) ★
// ==========================================
async function unmergeEvent(eid) {
  if (!confirm('합병을 취소하고 원래 종목으로 복원합니다.\n팀은 첫 번째 종목으로 이동되며, 재편성이 필요합니다.\n\n계속하시겠습니까?')) return;
  const tid = state.currentTournament.id;
  try {
    const res = await api(`/tournaments/${tid}/events/${eid}/unmerge`, { method: 'POST' });
    showToast(res.message, 'success');
    await loadEvents(tid); navigate('tournament');
  } catch(e) {}
}

// Match actions
async function startMatch(mid) { const tid = state.currentTournament.id; try { await api(`/tournaments/${tid}/matches/${mid}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'playing' }) }); showToast('경기 시작!', 'success'); await loadMatches(tid); switchTab('matches'); } catch(e){} }

function showScoreModal(mid) {
  const m = state.matches.find(x => x.id === mid); if (!m) return;
  const target = state.targetScore;
  const isCompleted = m.status === 'completed';
  const courts = state.currentTournament?.courts || 6;
  const modal = document.createElement('div'); modal.id = 'score-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-bold"><i class="fas fa-edit mr-2 text-${P}-500"></i>${isCompleted ? SCORE_LABEL+' 수정' : SCORE_LABEL+' 입력'}</h3>
      <div class="flex items-center gap-2">
        ${m.court_number ? `<span class="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">${m.court_number}코트</span>` : ''}
        <span class="text-xs px-2 py-1 rounded-lg ${isCompleted ? T.bg50+' '+T.text600 : m.status==='playing' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'}">${isCompleted ? '완료' : m.status==='playing' ? '진행중' : '대기'}</span>
      </div>
    </div>
    ${isCompleted ? '<div class="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700"><i class="fas fa-exclamation-triangle mr-1"></i>완료된 경기를 수정하면 순위가 재계산됩니다.</div>' : ''}
    <div class="text-center mb-4"><span class="font-semibold text-${P}-700">${m.team1_name||'팀1'}</span><span class="mx-2 text-gray-400">vs</span><span class="font-semibold text-red-600">${m.team2_name||'팀2'}</span></div>
    <div class="flex items-center gap-3">
      <div class="flex-1 text-center">
        <label class="block text-sm font-medium text-${P}-700 mb-2">${m.team1_name||'팀1'}</label>
        <input id="t1s1" type="number" min="0" max="${target+10}" value="${m.team1_set1||0}" class="w-full px-3 py-4 border-2 rounded-xl text-center text-3xl font-black outline-none focus:ring-2 focus:ring-${P}-500" inputmode="numeric">
      </div>
      <span class="text-3xl text-gray-300 font-bold mt-6">:</span>
      <div class="flex-1 text-center">
        <label class="block text-sm font-medium text-red-600 mb-2">${m.team2_name||'팀2'}</label>
        <input id="t2s1" type="number" min="0" max="${target+10}" value="${m.team2_set1||0}" class="w-full px-3 py-4 border-2 rounded-xl text-center text-3xl font-black outline-none focus:ring-2 focus:ring-red-500" inputmode="numeric">
      </div>
    </div>
    <div class="mt-4"><label class="block text-sm font-semibold text-gray-700 mb-2">승자</label>
      <div class="flex gap-2">
        <button onclick="document.getElementById('winner-val').value=1;this.classList.add('ring-2','ring-${P}-500');this.nextElementSibling.classList.remove('ring-2','ring-${P}-500')" class="flex-1 py-2 bg-${P}-50 text-${P}-700 rounded-lg text-sm font-medium ${m.winner_team===1?'ring-2 ring-${P}-500':''}">${m.team1_name||'팀1'}</button>
        <button onclick="document.getElementById('winner-val').value=2;this.classList.add('ring-2','ring-${P}-500');this.previousElementSibling.classList.remove('ring-2','ring-${P}-500')" class="flex-1 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium ${m.winner_team===2?'ring-2 ring-${P}-500':''}">${m.team2_name||'팀2'}</button>
      </div><input type="hidden" id="winner-val" value="${m.winner_team||''}"></div>
    <!-- 코트 변경 -->
    <div class="mt-4">
      <label class="block text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-exchange-alt mr-1 text-indigo-500"></i>코트 변경</label>
      <select id="court-change-val" class="w-full px-3 py-2 border-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400">
        <option value="">변경 안 함</option>
        ${Array.from({length: courts}, (_, i) => i+1).map(n => `<option value="${n}" ${m.court_number===n?'selected':''}>${n}코트</option>`).join('')}
      </select>
    </div>
    <div class="flex gap-2 mt-5">
      <button onclick="document.getElementById('score-modal').remove()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium">취소</button>
      ${isCompleted ? `<button onclick="resetMatch(${mid})" class="py-2.5 px-4 bg-red-50 text-red-600 rounded-xl font-medium text-sm hover:bg-red-100"><i class="fas fa-undo mr-1"></i>리셋</button>` : ''}
      <button onclick="submitScore(${mid})" class="flex-1 py-2.5 bg-${P}-600 text-white rounded-xl font-medium">저장</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function submitScore(mid) {
  const data = { team1_set1: +document.getElementById('t1s1').value||0, team1_set2: 0, team1_set3: 0,
    team2_set1: +document.getElementById('t2s1').value||0, team2_set2: 0, team2_set3: 0 };
  const w = document.getElementById('winner-val').value;
  data.status = w ? 'completed' : 'playing'; data.winner_team = w ? parseInt(w) : null;
  const tid = state.currentTournament.id;
  // 코트 변경 처리
  const courtVal = document.getElementById('court-change-val')?.value;
  const m = state.matches.find(x => x.id === mid);
  if (courtVal && m && parseInt(courtVal) !== m.court_number && m.status !== 'playing') {
    try { await api(`/tournaments/${tid}/matches/${mid}/court`, { method: 'PATCH', body: JSON.stringify({ court_number: parseInt(courtVal) }) }); } catch(e){}
  }
  try { await api(`/tournaments/${tid}/matches/${mid}/score`, { method: 'PUT', body: JSON.stringify(data) }); document.getElementById('score-modal').remove(); showToast('${SCORE_LABEL} 저장!', 'success'); await loadMatches(tid); switchTab('matches'); } catch(e){}
}

async function resetMatch(mid) {
  if (!confirm('경기를 초기화하시겠습니까?\n점수와 승자가 모두 초기화되고 대기 상태로 돌아갑니다.')) return;
  if (!confirm('정말 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/matches/${mid}/reset`, { method: 'POST' });
    const modal = document.getElementById('score-modal'); if (modal) modal.remove();
    showToast('경기가 초기화되었습니다.', 'success');
    await loadMatches(tid); switchTab('matches');
  } catch(e) {}
}

async function showCourtChangeModal(mid) {
  const m = state.matches.find(x => x.id === mid); if (!m) return;
  const courts = state.currentTournament?.courts || 6;
  const modal = document.createElement('div'); modal.id = 'court-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-exchange-alt mr-2 text-indigo-500"></i>코트 변경</h3>
    <p class="text-sm text-gray-600 mb-3">${m.team1_name||'팀1'} vs ${m.team2_name||'팀2'}</p>
    <p class="text-xs text-gray-400 mb-3">현재: ${m.court_number || '미배정'}코트</p>
    <div class="grid grid-cols-3 gap-2 mb-5">
      ${Array.from({length: courts}, (_, i) => i+1).map(n =>
        `<button onclick="document.querySelectorAll('#court-modal .court-btn').forEach(b=>b.classList.remove('ring-2','ring-indigo-500'));this.classList.add('ring-2','ring-indigo-500');document.getElementById('new-court-val').value=${n}" class="court-btn py-3 rounded-xl text-sm font-bold ${m.court_number===n ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">${n}코트</button>`
      ).join('')}
    </div>
    <input type="hidden" id="new-court-val" value="${m.court_number||1}">
    <div class="flex gap-2">
      <button onclick="document.getElementById('court-modal').remove()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium">취소</button>
      <button onclick="submitCourtChange(${mid})" class="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium">변경</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function submitCourtChange(mid) {
  const courtNum = parseInt(document.getElementById('new-court-val').value);
  const tid = state.currentTournament.id;
  try {
    await api(`/tournaments/${tid}/matches/${mid}/court`, { method: 'PATCH', body: JSON.stringify({ court_number: courtNum }) });
    document.getElementById('court-modal').remove();
    showToast(`코트 ${courtNum}으로 변경!`, 'success');
    await loadMatches(tid); switchTab('matches');
  } catch(e) {}
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

// 대회 삭제
async function deleteTournament(tid) {
  const t = state.currentTournament;
  if (!t) return;
  const pw = state.adminPasswords[tid];
  if (!pw) { showToast('관리자 인증이 필요합니다.', 'warning'); return; }
  if (!confirm(`정말로 "${t.name}" 대회를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
  if (!confirm('대회에 포함된 모든 참가자, 종목, 경기 데이터도 함께 삭제됩니다.\n정말 삭제하시겠습니까?')) return;
  try {
    await api(`/tournaments/${tid}`, { method: 'DELETE', body: JSON.stringify({ admin_password: pw }) });
    showToast('대회가 삭제되었습니다.', 'success');
    state.currentTournament = null;
    navigate('home');
    loadTournaments();
  } catch(e) {}
}

// 🔴 대회 데이터 백업 (JSON Export)
async function exportTournament(tid) {
  try {
    showToast('데이터를 내보내는 중...', 'info');
    const data = await api(`/tournaments/${tid}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = data.tournament?.name || '대회';
    const date = new Date().toISOString().split('T')[0];
    a.href = url; a.download = `${name}_백업_${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('백업 파일이 다운로드되었습니다!', 'success');
  } catch(e) { showToast('백업 실패', 'error'); }
}

// 🔴 데이터 복원 모달
function showImportModal() {
  const modal = document.createElement('div'); modal.id = 'import-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
    <h3 class="text-lg font-bold mb-3"><i class="fas fa-upload mr-2 text-indigo-500"></i>데이터 복원</h3>
    <p class="text-sm text-gray-500 mb-4">이전에 백업한 JSON 파일을 선택하면 새로운 대회로 복원됩니다.</p>
    <div class="mb-4">
      <label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition" id="import-drop-zone">
        <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
        <span class="text-sm text-gray-500">클릭하여 파일 선택</span>
        <span class="text-xs text-gray-400 mt-1">또는 파일을 여기로 드래그</span>
        <input type="file" accept=".json" id="import-file-input" class="hidden" onchange="previewImportFile(this)">
      </label>
    </div>
    <div id="import-preview" class="hidden mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
    </div>
    <div class="flex gap-2">
      <button onclick="document.getElementById('import-modal').remove()" class="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium">취소</button>
      <button onclick="executeImport()" id="import-btn" class="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hidden">복원 실행</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function previewImportFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data._meta || !data.tournament) { showToast('유효하지 않은 백업 파일입니다.', 'error'); return; }
      window._importData = data;
      const preview = document.getElementById('import-preview');
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <div class="font-bold text-gray-800 mb-2"><i class="fas fa-file-alt mr-1 text-indigo-500"></i>${data.tournament.name}</div>
        <div class="grid grid-cols-2 gap-1 text-xs text-gray-600">
          <div>참가자: <strong>${(data.participants||[]).length}명</strong></div>
          <div>종목: <strong>${(data.events||[]).length}개</strong></div>
          <div>팀: <strong>${(data.teams||[]).length}개</strong></div>
          <div>경기: <strong>${(data.matches||[]).length}경기</strong></div>
        </div>
        <div class="mt-2 text-xs text-gray-400">백업일시: ${data._meta.exported_at || '-'}</div>
      `;
      document.getElementById('import-btn').classList.remove('hidden');
    } catch(err) { showToast('JSON 파일 파싱 실패', 'error'); }
  };
  reader.readAsText(file);
}

async function executeImport() {
  if (!window._importData) { showToast('파일을 먼저 선택해주세요.', 'warning'); return; }
  if (!confirm(`"${window._importData.tournament.name}" 대회를 복원하시겠습니까?\n새로운 대회로 생성됩니다.`)) return;
  try {
    showToast('복원 중...', 'info');
    const result = await api('/tournaments/import', { method: 'POST', body: JSON.stringify(window._importData) });
    document.getElementById('import-modal').remove();
    window._importData = null;
    showToast(`복원 완료! (참가자 ${result.stats.participants}명, 경기 ${result.stats.matches}경기)`, 'success');
    await loadTournaments();
    if (result.tournament_id) { openTournament(result.tournament_id); }
  } catch(e) { showToast('복원 실패', 'error'); }
}

// Init
document.addEventListener('DOMContentLoaded', () => { restoreAdminSession(); render(); loadTournaments(); });

// ==========================================
// ★ 결선 토너먼트 모달 ★
// ==========================================
async function showFinalsModal() {
  const tid = state.currentTournament.id;
  showToast('결선 진출 현황을 불러오는 중...', 'info');
  try {
    const data = await api(`/tournaments/${tid}/brackets/finals-preview?top_n=2`);
    renderFinalsModal(data);
  } catch(e) {}
}

function renderFinalsModal(data) {
  const modal = document.createElement('div');
  modal.id = 'finals-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900"><i class="fas fa-crown mr-2 text-yellow-500"></i>결선 토너먼트 생성</h3>
        <button onclick="document.getElementById('finals-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"><i class="fas fa-times text-gray-400"></i></button>
      </div>
      <p class="text-sm text-gray-500 mt-1">조별 리그 상위 팀이 결선 싱글 엘리미네이션 토너먼트(${SC.scoring ? SC.scoring.tournamentTargetScore : 21}${SCORE_UNIT}제)에 진출합니다.</p>
    </div>
    <div class="p-6 overflow-y-auto flex-1 space-y-5">
      <!-- 상위 N팀 선택 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-medal mr-1 text-yellow-500"></i>조별 상위 진출 팀 수</h4>
        <div class="flex gap-2">
          <label class="flex-1 p-3 border rounded-xl cursor-pointer hover:bg-yellow-50 transition has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 text-center">
            <input type="radio" name="finals_topn" value="1" class="hidden"><span class="font-bold">상위 1팀</span></label>
          <label class="flex-1 p-3 border rounded-xl cursor-pointer hover:bg-yellow-50 transition has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 text-center">
            <input type="radio" name="finals_topn" value="2" checked class="hidden"><span class="font-bold">상위 2팀</span></label>
          <label class="flex-1 p-3 border rounded-xl cursor-pointer hover:bg-yellow-50 transition has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 text-center">
            <input type="radio" name="finals_topn" value="3" class="hidden"><span class="font-bold">상위 3팀</span></label>
        </div>
      </div>
      <!-- 같은 클럽 회피 -->
      <label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
        <input type="checkbox" id="finals-avoid-club" checked class="w-4 h-4 text-yellow-600 rounded">
        <div><p class="font-semibold text-sm">같은 클럽 대결 회피 (시드 배정)</p></div>
      </label>
      <!-- 종목별 조별 현황 미리보기 -->
      <div>
        <h4 class="text-sm font-bold text-gray-700 mb-2"><i class="fas fa-chart-bar mr-1 ${T.text500}"></i>종목별 조별 현황</h4>
        ${(data.events || []).map(ev => `
          <div class="mb-4 bg-gray-50 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <h5 class="font-bold text-gray-800">${ev.event_name}</h5>
              <div class="flex items-center gap-2">
                <span class="badge ${ev.progress >= 100 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${ev.progress}% 완료</span>
                <span class="text-xs text-gray-500">${ev.completed_matches}/${ev.total_matches}경기</span>
              </div>
            </div>
            <div class="space-y-2">
              ${ev.groups.map(g => `
                <div class="bg-white rounded-lg p-2 border border-gray-200">
                  <p class="text-xs font-bold text-indigo-600 mb-1"><i class="fas fa-th-large mr-1"></i>${g.group_num}조</p>
                  <div class="space-y-0.5">
                    ${g.standings.map((t, i) => `
                      <div class="flex items-center justify-between text-xs py-0.5 ${t.qualified ? 'bg-yellow-50 px-1 rounded font-bold' : ''}">
                        <div class="flex items-center gap-1.5">
                          <span class="${t.qualified ? 'text-yellow-600' : 'text-gray-400'}">${i+1}.</span>
                          <span>${t.name}</span>
                          ${t.qualified ? '<span class="badge bg-yellow-100 text-yellow-700 text-xs py-0 px-1">진출</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2 text-gray-500">
                          <span>${t.wins}승 ${t.losses}패</span>
                          <span class="font-bold">${t.points}점</span>
                          <span class="${t.goal_diff > 0 ? 'text-green-600' : t.goal_diff < 0 ? 'text-red-500' : ''}">${t.goal_diff > 0 ? '+' : ''}${t.goal_diff}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="p-6 border-t border-gray-200 flex gap-3">
      <button onclick="document.getElementById('finals-modal').remove()" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">취소</button>
      <button onclick="executeFinalsGeneration()" class="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold shadow-md hover:from-red-600 hover:to-red-700">
        <i class="fas fa-crown mr-2"></i>결선 토너먼트 생성
      </button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function executeFinalsGeneration() {
  const topN = parseInt(document.querySelector('input[name="finals_topn"]:checked')?.value || '2');
  const avoidSameClub = document.getElementById('finals-avoid-club')?.checked;
  if (!confirm(`조별 상위 ${topN}팀을 결선 토너먼트(${SC.scoring ? SC.scoring.tournamentTargetScore : 21}${SCORE_UNIT}제)에 진출시킵니다.\n\n기존 결선 경기가 있으면 재생성됩니다. 계속하시겠습니까?`)) return;

  const tid = state.currentTournament.id;
  try {
    const res = await api(`/tournaments/${tid}/brackets/generate-finals`, {
      method: 'POST', body: JSON.stringify({ top_n: topN, avoid_same_club: avoidSameClub })
    });
    showToast(`결선 토너먼트 생성 완료! (${res.total_matches}경기)`, 'success');
    document.getElementById('finals-modal')?.remove();
    await loadMatches(tid);
    switchTab('matches');
  } catch(e) {}
}

// ==========================================
// ★ 통계 대시보드 페이지 ★
// ==========================================
function renderDashboard() {
  const t = state.currentTournament;
  const d = state.dashboardData;
  if (!d) return `${renderNav()}<div class="flex items-center justify-center h-96"><i class="fas fa-spinner fa-spin text-4xl text-gray-400"></i></div>`;

  const ms = d.match_stats || {};
  const ps = d.participant_stats || {};
  const progress = d.progress || 0;
  const formatMap = { kdk: 'KDK', league: '풀리그', tournament: '토너먼트' };

  return `${renderNav()}${renderOffline()}

  <!-- Hero Banner (대회 상세와 동일 구조) -->
  <div class="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 relative overflow-hidden">
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-10 right-20 w-32 h-32 rounded-full bg-orange-400 blur-3xl"></div>
      <div class="absolute bottom-10 left-10 w-40 h-40 rounded-full ${T.bg400} blur-3xl"></div>
    </div>
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
      <!-- Top Bar -->
      <div class="flex items-center justify-between mb-5">
        <button onclick="navigate('tournament')" class="flex items-center gap-2 text-white/60 hover:text-white transition text-sm group">
          <i class="fas fa-arrow-left group-hover:-translate-x-0.5 transition-transform"></i>대회로 돌아가기
        </button>
        <button onclick="loadDashboard(${t?.id})" class="px-3 py-1.5 bg-white/10 text-white/70 rounded-lg text-xs hover:bg-white/20 transition backdrop-blur"><i class="fas fa-sync-alt mr-1.5"></i>새로고침</button>
      </div>
      <!-- Title -->
      <div class="flex items-center gap-4 mb-6">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/20 flex-shrink-0">
          <i class="fas fa-chart-bar text-xl text-white"></i>
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">${t?.name || '통계'}</h1>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-white/50 text-sm">통계 대시보드</span>
            ${t?.format ? `<span class="text-white/30">·</span><span class="text-white/50 text-sm">${formatMap[t.format] || t.format}</span>` : ''}
            ${t?.courts ? `<span class="text-white/30">·</span><span class="text-white/50 text-sm">${t.courts}코트</span>` : ''}
          </div>
        </div>
      </div>
      <!-- Stats Cards (대회 상세와 동일한 4대 카드) -->
      <div class="grid grid-cols-4 gap-3 sm:gap-4 mb-4">
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${ps.total || 0}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-users mr-1"></i>참가자</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${(d.event_stats || []).length}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-layer-group mr-1"></i>종목</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold text-white">${ms.total || 0}</div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5">${(ms.playing||0) > 0 ? `<span class="w-1.5 h-1.5 inline-block rounded-full bg-green-400 pulse-live mr-0.5"></span>${ms.playing}진행중 ` : ''}<i class="fas fa-gamepad mr-0.5"></i>경기</div>
        </div>
        <div class="bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10">
          <div class="text-2xl sm:text-3xl font-extrabold ${progress >= 100 ? 'text-green-400' : progress >= 50 ? T.text400 : 'text-white'}">${progress}<span class="text-lg">%</span></div>
          <div class="text-[11px] sm:text-xs text-white/50 mt-0.5"><i class="fas fa-chart-pie mr-1"></i>진행률</div>
          ${(ms.total||0) > 0 ? `<div class="mt-1.5 w-full bg-white/10 rounded-full h-1"><div class="h-1 rounded-full transition-all ${progress >= 100 ? 'bg-green-400' : progress >= 50 ? T.bg400 : 'bg-yellow-400'}" style="width:${progress}%"></div></div>` : ''}
        </div>
      </div>
      <!-- 경기 상세 현황 바 -->
      <div class="bg-white/[0.07] backdrop-blur-sm rounded-2xl p-4 border border-white/10">
        <div class="flex items-center justify-between mb-2">
          <span class="text-white/60 text-sm font-medium"><i class="fas fa-tasks mr-1.5"></i>경기 진행 현황</span>
          <span class="text-2xl font-extrabold ${progress >= 100 ? 'text-green-400' : progress >= 50 ? T.text400 : 'text-yellow-400'}">${ms.completed||0}<span class="text-sm text-white/40">/${ms.total||0}</span></span>
        </div>
        <div class="w-full bg-white/10 rounded-full h-2.5 mb-3">
          <div class="h-2.5 rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-400' : progress >= 50 ? T.bg400 : 'bg-yellow-400'}" style="width:${progress}%"></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="flex items-center gap-2 justify-center">
            <span class="w-2 h-2 rounded-full bg-green-400 pulse-live"></span>
            <span class="text-white/60 text-xs">진행중</span>
            <span class="text-green-400 font-extrabold text-lg">${ms.playing || 0}</span>
          </div>
          <div class="flex items-center gap-2 justify-center">
            <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
            <span class="text-white/60 text-xs">대기중</span>
            <span class="text-yellow-400 font-extrabold text-lg">${ms.pending || 0}</span>
          </div>
          <div class="flex items-center gap-2 justify-center">
            <span class="w-2 h-2 rounded-full ${T.bg400}"></span>
            <span class="text-white/60 text-xs">완료</span>
            <span class="${T.text400} font-extrabold text-lg">${ms.completed || 0}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- Wave Divider -->
    <svg class="w-full h-6 sm:h-8" viewBox="0 0 1440 30" fill="none" preserveAspectRatio="none">
      <path d="M0,0 C360,30 1080,30 1440,0 L1440,30 L0,30 Z" fill="#f8fafc"/>
    </svg>
  </div>

  <div class="bg-slate-50 min-h-screen">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 -mt-1 pb-10 fade-in">

    <!-- 참가자 통계 + 급수 분포 (2열 그리드) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
      <!-- 참가자 현황 카드 -->
      <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center mr-2.5 shadow-md shadow-indigo-500/20"><i class="fas fa-users text-white text-xs"></i></div>참가자 현황</h3>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="text-center bg-gray-50 rounded-xl p-3 border border-gray-100 hover:border-gray-300 transition"><div class="text-xl font-extrabold">${ps.total || 0}</div><div class="text-xs text-gray-500">총 참가자</div></div>
          <div class="text-center ${T.bg50} rounded-xl p-3 border ${T.border100} ${T.hoverBorder} transition"><div class="text-xl font-extrabold ${T.text600}">${ps.male || 0}</div><div class="text-xs text-gray-500">남자</div></div>
          <div class="text-center bg-pink-50 rounded-xl p-3 border border-pink-100 hover:border-pink-300 transition"><div class="text-xl font-extrabold text-pink-600">${ps.female || 0}</div><div class="text-xs text-gray-500">여자</div></div>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600"><i class="fas fa-won-sign mr-1.5 text-green-500"></i>참가비 완납</span>
            <div class="flex items-center gap-2"><div class="w-28 bg-gray-200 rounded-full h-2"><div class="bg-green-500 h-2 rounded-full transition-all" style="width:${ps.total ? Math.round((ps.paid||0)/ps.total*100) : 0}%"></div></div><span class="font-bold text-sm">${ps.paid||0}<span class="text-gray-400 font-normal">/${ps.total||0}</span></span></div>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600"><i class="fas fa-check-circle mr-1.5 ${T.text500}"></i>체크인</span>
            <div class="flex items-center gap-2"><div class="w-28 bg-gray-200 rounded-full h-2"><div class="${T.bg500} h-2 rounded-full transition-all" style="width:${ps.total ? Math.round((ps.checked_in||0)/ps.total*100) : 0}%"></div></div><span class="font-bold text-sm">${ps.checked_in||0}<span class="text-gray-400 font-normal">/${ps.total||0}</span></span></div>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600"><i class="fas fa-venus-mars mr-1.5 text-purple-500"></i>혼합복식 참가</span>
            <span class="font-bold text-purple-600">${ps.mixed_doubles||0}<span class="text-gray-400 font-normal text-xs ml-0.5">명</span></span>
          </div>
        </div>
      </div>

      <!-- 급수 분포 카드 -->
      <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mr-2.5 shadow-md shadow-orange-500/20"><i class="fas fa-signal text-white text-xs"></i></div>급수 분포</h3>
        <div class="space-y-2.5">
          ${(d.level_distribution || []).map(l => {
            const pct = ps.total ? Math.round((l.count / ps.total) * 100) : 0;
            const colors = { s: 'bg-red-500', a: 'bg-orange-500', b: 'bg-yellow-500', c: 'bg-green-500', d: 'bg-blue-500', e: 'bg-gray-400' };
            const bgColors = { s: 'bg-red-50', a: 'bg-orange-50', b: 'bg-yellow-50', c: 'bg-green-50', d: 'bg-blue-50', e: 'bg-gray-50' };
            const textColors = { s: 'text-red-700', a: 'text-orange-700', b: 'text-yellow-700', c: 'text-green-700', d: 'text-blue-700', e: 'text-gray-600' };
            const labels = { s: 'S급', a: 'A급', b: 'B급', c: 'C급', d: 'D급', e: 'E급' };
            return `<div class="flex items-center gap-3">
              <span class="w-10 text-xs font-bold ${textColors[l.level] || 'text-gray-700'} ${bgColors[l.level] || 'bg-gray-50'} rounded-md px-1.5 py-0.5 text-center border">${labels[l.level] || l.level}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-5"><div class="${colors[l.level] || 'bg-gray-400'} h-5 rounded-full flex items-center justify-end pr-2 transition-all" style="width:${Math.max(pct, 8)}%"><span class="text-white text-xs font-bold">${l.count}</span></div></div>
              <span class="text-xs text-gray-500 w-10 text-right font-medium">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- 종목별 경기 현황 -->
    <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br ${T.gradFrom} ${T.gradTo} flex items-center justify-center mr-2.5 shadow-md shadow-${P}-500/20"><i class="fas fa-layer-group text-white text-xs"></i></div>종목별 현황</h3>
      ${(d.event_stats || []).length > 0 ? `<div class="overflow-x-auto rounded-xl border border-gray-100">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200"><tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">종목</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">팀</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">전체</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">진행</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">완료</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-gray-500 w-36">진행률</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">
            ${(d.event_stats || []).map(ev => {
              const evPct = ev.total_matches > 0 ? Math.round(ev.completed_matches / ev.total_matches * 100) : 0;
              const catIcons = { md: 'fa-mars text-blue-500', wd: 'fa-venus text-pink-500', xd: 'fa-venus-mars text-purple-500' };
              const catBg = { md: 'bg-blue-50 border-blue-200', wd: 'bg-pink-50 border-pink-200', xd: 'bg-purple-50 border-purple-200' };
              const catText = { md: 'text-blue-700', wd: 'text-pink-700', xd: 'text-purple-700' };
              return `<tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3"><div class="flex items-center gap-2"><span class="w-6 h-6 rounded-md ${catBg[ev.category] || 'bg-gray-50 border-gray-200'} border flex items-center justify-center flex-shrink-0"><i class="fas ${catIcons[ev.category] || 'fa-trophy text-gray-500'} text-xs"></i></span><span class="font-semibold ${catText[ev.category] || 'text-gray-700'} text-sm">${ev.name}</span></div></td>
                <td class="px-3 py-3 text-center font-bold text-sm">${ev.team_count}</td>
                <td class="px-3 py-3 text-center text-sm text-gray-600">${ev.total_matches}</td>
                <td class="px-3 py-3 text-center text-sm"><span class="${ev.playing_matches > 0 ? 'text-green-600 font-bold' : 'text-gray-400'}">${ev.playing_matches}</span></td>
                <td class="px-3 py-3 text-center text-sm ${T.text600} font-medium">${ev.completed_matches}</td>
                <td class="px-3 py-3"><div class="flex items-center gap-2"><div class="flex-1 bg-gray-200 rounded-full h-2"><div class="${evPct >= 100 ? 'bg-green-500' : T.bg500} h-2 rounded-full transition-all" style="width:${evPct}%"></div></div><span class="text-xs font-bold w-9 text-right ${evPct >= 100 ? 'text-green-600' : 'text-gray-600'}">${evPct}%</span></div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-3xl mb-2"></i><p class="text-sm">등록된 종목이 없습니다</p></div>'}
    </div>

    <!-- 코트별 현황 -->
    <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mr-2.5 shadow-md shadow-green-500/20"><i class="fas fa-th-large text-white text-xs"></i></div>코트별 현황</h3>
      ${(d.court_stats || []).length > 0 ? `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        ${(d.court_stats || []).map(ct => `
          <div class="rounded-xl border-2 ${ct.playing > 0 ? 'border-green-300 bg-gradient-to-b from-green-50 to-white' : 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'} p-4 text-center hover:shadow-md transition-all cursor-default">
            <div class="w-10 h-10 rounded-xl ${ct.playing > 0 ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-gray-300 to-gray-400'} mx-auto mb-2 flex items-center justify-center shadow-md">
              <span class="text-white font-extrabold text-sm">${ct.court_number}</span>
            </div>
            <div class="text-xs font-medium text-gray-500 mb-2">${ct.court_number}번 코트</div>
            ${ct.playing > 0 ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200"><span class="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live"></span>경기중</span>' : '<span class="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium border border-gray-200">대기</span>'}
            <div class="flex items-center justify-center gap-3 text-xs text-gray-500 mt-2">
              <span><i class="fas fa-clock mr-0.5 text-yellow-500"></i>${ct.pending}</span>
              <span><i class="fas fa-check mr-0.5 ${T.text500}"></i>${ct.completed}</span>
            </div>
          </div>
        `).join('')}
      </div>` : '<div class="text-center py-8 text-gray-400"><i class="fas fa-th-large text-3xl mb-2"></i><p class="text-sm">코트 정보가 없습니다</p></div>'}
    </div>

    <!-- 클럽별 성적 -->
    ${(d.club_stats || []).length > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mr-2.5 shadow-md shadow-teal-500/20"><i class="fas fa-building text-white text-xs"></i></div>클럽별 성적</h3>
      <div class="overflow-x-auto rounded-xl border border-gray-100">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200"><tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">클럽</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">선수</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">팀</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">승</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">패</th>
            <th class="px-3 py-3 text-center text-xs font-semibold text-gray-500">승률</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">
            ${(d.club_stats || []).sort((a,b) => b.win_rate - a.win_rate).map((cl, i) => {
              const medalBg = i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-gray-50' : i === 2 ? 'bg-orange-50' : '';
              return `<tr class="hover:bg-gray-50 transition-colors ${medalBg}">
                <td class="px-4 py-3"><div class="flex items-center gap-2">${i < 3 ? `<span class="text-lg">${['&#129351;','&#129352;','&#129353;'][i]}</span>` : `<span class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">${i+1}</span>`}<span class="font-semibold text-teal-700">${cl.club}</span></div></td>
                <td class="px-3 py-3 text-center text-sm">${cl.player_count}</td>
                <td class="px-3 py-3 text-center text-sm">${cl.team_count}</td>
                <td class="px-3 py-3 text-center text-sm text-green-600 font-bold">${cl.wins}</td>
                <td class="px-3 py-3 text-center text-sm text-red-500 font-medium">${cl.losses}</td>
                <td class="px-3 py-3 text-center"><div class="inline-flex items-center gap-1.5"><div class="w-12 bg-gray-200 rounded-full h-1.5"><div class="${cl.win_rate >= 60 ? 'bg-green-500' : cl.win_rate >= 40 ? T.bg500 : 'bg-gray-400'} h-1.5 rounded-full" style="width:${cl.win_rate}%"></div></div><span class="font-bold text-sm ${cl.win_rate >= 60 ? 'text-green-600' : cl.win_rate >= 40 ? T.text600 : 'text-gray-600'}">${cl.win_rate}%</span></div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

  </div>
  </div>`;
}

async function loadDashboard(tid) {
  try {
    const d = await api(`/tournaments/${tid}/dashboard`);
    state.dashboardData = d;
    render();
  } catch(e) {}
}

// ==========================================
// ★ 참가자 페이지 ★
// ==========================================
function renderMyPage() {
  const t = state.currentTournament;
  return `${renderNav()}${renderOffline()}

  <!-- Hero Banner -->
  <div class="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 relative overflow-hidden">
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-10 left-20 w-32 h-32 rounded-full bg-indigo-400 blur-3xl"></div>
      <div class="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-purple-400 blur-3xl"></div>
    </div>
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
      <!-- Top Bar -->
      <div class="flex items-center justify-between mb-5">
        <button onclick="navigate('tournament')" class="flex items-center gap-2 text-white/60 hover:text-white transition text-sm group">
          <i class="fas fa-arrow-left group-hover:-translate-x-0.5 transition-transform"></i>대회로 돌아가기
        </button>
      </div>
      <!-- Title -->
      <div class="flex items-center gap-4 mb-6">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 flex-shrink-0">
          <i class="fas fa-user-circle text-xl text-white"></i>
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">내 경기 조회</h1>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-white/50 text-sm">${t?.name || '대회'}</span>
            <span class="text-white/30">·</span>
            <span class="text-white/50 text-sm">참가자 전용</span>
          </div>
        </div>
      </div>
      <!-- 검색 폼 (히어로 내부) -->
      <div class="bg-white/[0.07] backdrop-blur-sm rounded-2xl p-5 border border-white/10">
        <form id="my-search-form" class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-[140px]">
            <label class="block text-xs font-semibold text-white/50 mb-1.5">이름 <span class="text-red-400">*</span></label>
            <input name="name" required placeholder="예: 김민수" class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 transition">
          </div>
          <div class="flex-1 min-w-[140px]">
            <label class="block text-xs font-semibold text-white/50 mb-1.5">연락처 (선택)</label>
            <input name="phone" placeholder="010-xxxx-xxxx" class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 transition">
          </div>
          <button type="submit" class="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-bold hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/30 transition-all">
            <i class="fas fa-search mr-1.5"></i>조회
          </button>
        </form>
      </div>
    </div>
    <!-- Wave Divider -->
    <svg class="w-full h-6 sm:h-8" viewBox="0 0 1440 30" fill="none" preserveAspectRatio="none">
      <path d="M0,0 C360,30 1080,30 1440,0 L1440,30 L0,30 Z" fill="#f8fafc"/>
    </svg>
  </div>

  <div class="bg-slate-50 min-h-screen">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 -mt-1 pb-10 fade-in">
    <div id="my-result"></div>
  </div>
  </div>`;
}

function renderMyResult(data) {
  const p = data.participant;
  const teams = data.teams || [];
  const matches = data.matches || [];
  const rec = data.record || {};
  const upcoming = data.upcoming_matches || [];
  const completed = matches.filter(m => m.status === 'completed');
  const winRate = (rec.wins||0) + (rec.losses||0) > 0 ? Math.round((rec.wins||0) / ((rec.wins||0) + (rec.losses||0)) * 100) : 0;

  const genderBg = p.gender === 'm' ? 'from-blue-400 to-blue-600' : 'from-pink-400 to-pink-600';
  const genderLabel = p.gender === 'm' ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200"><i class="fas fa-mars text-[10px]"></i>남</span>' : '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs font-bold border border-pink-200"><i class="fas fa-venus text-[10px]"></i>여</span>';
  const levelLabel = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${LEVEL_COLORS[p.level] || 'bg-gray-100 text-gray-600 border-gray-200'}">${LEVELS[p.level] || 'C'}급</span>`;

  return `
    <!-- 선수 프로필 카드 -->
    <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${genderBg} flex items-center justify-center shadow-lg flex-shrink-0">
            <i class="fas fa-user text-xl text-white"></i>
          </div>
          <div class="min-w-0">
            <h2 class="text-xl sm:text-2xl font-extrabold text-gray-900 truncate">${p.name}</h2>
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">${genderLabel} ${levelLabel} ${p.club ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full text-xs font-bold border border-teal-200"><i class="fas fa-building text-[10px]"></i>${p.club}</span>` : ''}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 sm:ml-auto">
          ${p.paid ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold border border-green-200"><i class="fas fa-check-circle text-[10px]"></i>참가비 완납</span>' : '<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-200"><i class="fas fa-times-circle text-[10px]"></i>미납</span>'}
          ${p.checked_in ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 ${T.bg100} ${T.text700} rounded-lg text-xs font-bold border ${T.border200}"><i class="fas fa-check text-[10px]"></i>체크인</span>` : ''}
        </div>
      </div>
    </div>

    <!-- 전적 요약 카드 -->
    <div class="grid grid-cols-4 gap-3 mb-4 sm:mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center shadow-sm hover:shadow-md transition-shadow">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 mx-auto mb-1.5 flex items-center justify-center shadow-md"><i class="fas fa-gamepad text-white text-xs"></i></div>
        <div class="text-xl sm:text-2xl font-extrabold text-gray-900">${data.total_matches}</div>
        <div class="text-[11px] text-gray-500 mt-0.5">총 경기</div>
      </div>
      <div class="bg-white rounded-xl border border-green-200 p-3 sm:p-4 text-center shadow-sm hover:shadow-md transition-shadow">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 mx-auto mb-1.5 flex items-center justify-center shadow-md"><i class="fas fa-trophy text-white text-xs"></i></div>
        <div class="text-xl sm:text-2xl font-extrabold text-green-600">${rec.wins || 0}</div>
        <div class="text-[11px] text-gray-500 mt-0.5">승</div>
      </div>
      <div class="bg-white rounded-xl border border-red-200 p-3 sm:p-4 text-center shadow-sm hover:shadow-md transition-shadow">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-red-400 to-red-600 mx-auto mb-1.5 flex items-center justify-center shadow-md"><i class="fas fa-heart-broken text-white text-xs"></i></div>
        <div class="text-xl sm:text-2xl font-extrabold text-red-500">${rec.losses || 0}</div>
        <div class="text-[11px] text-gray-500 mt-0.5">패</div>
      </div>
      <div class="bg-white rounded-xl border ${T.border200} p-3 sm:p-4 text-center shadow-sm hover:shadow-md transition-shadow">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br ${T.gradFrom} ${T.gradTo} mx-auto mb-1.5 flex items-center justify-center shadow-md"><i class="fas fa-chart-line text-white text-xs"></i></div>
        <div class="text-xl sm:text-2xl font-extrabold ${T.text600}">${rec.total_score && rec.total_lost ? `${rec.total_score > rec.total_lost ? '+' : ''}${rec.total_score - rec.total_lost}` : '0'}</div>
        <div class="text-[11px] text-gray-500 mt-0.5">득실차</div>
      </div>
    </div>

    <!-- 승률 프로그레스 바 -->
    ${(rec.wins||0) + (rec.losses||0) > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-4 mb-4 sm:mb-6 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-gray-600"><i class="fas fa-percentage mr-1.5 text-indigo-500"></i>승률</span>
        <span class="text-lg font-extrabold ${winRate >= 60 ? 'text-green-600' : winRate >= 40 ? T.text600 : 'text-red-500'}">${winRate}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div class="${winRate >= 60 ? 'bg-green-500' : winRate >= 40 ? T.bg500 : 'bg-red-400'} h-2.5 rounded-full transition-all duration-500" style="width:${winRate}%"></div>
      </div>
    </div>` : ''}

    <!-- 소속 팀 -->
    <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br ${T.gradFrom} ${T.gradTo} flex items-center justify-center mr-2.5 shadow-md shadow-${P}-500/20"><i class="fas fa-users text-white text-xs"></i></div>소속 팀</h3>
      ${teams.length === 0 ? '<div class="text-center py-6 text-gray-400"><i class="fas fa-user-friends text-2xl mb-2"></i><p class="text-sm">배정된 팀이 없습니다.</p></div>' : `<div class="space-y-2.5">
        ${teams.map(t => {
          const catBg = t.event_name?.includes('남자') ? 'border-l-blue-500' : t.event_name?.includes('여자') ? 'border-l-pink-500' : t.event_name?.includes('혼합') ? 'border-l-purple-500' : 'border-l-gray-400';
          return `<div class="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 border-l-4 ${catBg} hover:shadow-sm transition-shadow">
            <div class="min-w-0">
              <span class="font-bold text-gray-900">${t.team_name}</span>
              <div class="flex items-center gap-1.5 mt-1">
                <span class="text-xs text-gray-500">${t.event_name}</span>
                ${t.group_num ? `<span class="inline-flex items-center px-1.5 py-0 bg-indigo-50 text-indigo-600 rounded text-xs font-bold border border-indigo-200">${t.group_num}조</span>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1 text-sm text-gray-600 flex-shrink-0">
              <i class="fas fa-user-friends text-xs text-gray-400 mr-1"></i>${t.p1_name} · ${t.p2_name}
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>

    <!-- 예정/진행중 경기 -->
    ${upcoming.length > 0 ? `
    <div class="bg-white rounded-2xl border-2 border-green-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mr-2.5 shadow-md shadow-green-500/20"><i class="fas fa-clock text-white text-xs"></i></div>예정/진행중 경기 <span class="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">${upcoming.length}</span></h3>
      <div class="space-y-3">
        ${upcoming.map(m => {
          const isTeam1 = teams.some(t => t.id === m.team1_id);
          const myTeam = isTeam1 ? m.team1_name : m.team2_name;
          const oppTeam = isTeam1 ? m.team2_name : m.team1_name;
          const isPlaying = m.status === 'playing';
          return `<div class="rounded-xl border ${isPlaying ? 'border-2 border-green-300 bg-gradient-to-r from-green-50 to-white' : 'border-gray-200 bg-gray-50'} p-4 hover:shadow-sm transition-all">
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  ${isPlaying ? '<span class="w-2.5 h-2.5 rounded-full bg-green-500 pulse-live flex-shrink-0"></span>' : ''}
                  <span class="font-bold text-base ${isPlaying ? 'text-green-700' : 'text-gray-900'}">${myTeam}</span>
                  <span class="text-gray-300 font-bold">vs</span>
                  <span class="font-medium text-gray-600">${oppTeam || 'BYE'}</span>
                </div>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span class="text-xs text-gray-500"><i class="fas fa-layer-group mr-0.5"></i>${m.event_name || ''}</span>
                  ${m.group_num ? `<span class="text-xs text-indigo-500 font-medium">${m.group_num}조</span>` : ''}
                  <span class="text-xs text-gray-400">#${m.match_order}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                ${m.court_number ? `<span class="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold border border-yellow-200"><i class="fas fa-map-marker-alt text-[10px]"></i>${m.court_number}코트</span>` : '<span class="text-xs text-gray-400">미배정</span>'}
                ${isPlaying ? '<span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold border border-green-200"><span class="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live"></span>진행중</span>' : '<span class="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium border border-gray-200">대기</span>'}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- 완료된 경기 결과 -->
    ${completed.length > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center"><div class="w-8 h-8 rounded-lg bg-gradient-to-br ${T.gradFrom} ${T.gradTo} flex items-center justify-center mr-2.5 shadow-md shadow-${P}-500/20"><i class="fas fa-history text-white text-xs"></i></div>경기 결과 <span class="ml-2 px-2 py-0.5 ${T.bg100} ${T.text700} rounded-full text-xs font-bold">${completed.length}</span></h3>
      <div class="space-y-3">
        ${completed.map(m => {
          const isTeam1 = teams.some(t => t.id === m.team1_id);
          const isWinner = (isTeam1 && m.winner_team === 1) || (!isTeam1 && m.winner_team === 2);
          const myScore = isTeam1 ? (m.team1_set1||0) : (m.team2_set1||0);
          const oppScore = isTeam1 ? (m.team2_set1||0) : (m.team1_set1||0);
          const myTeam = isTeam1 ? m.team1_name : m.team2_name;
          const oppTeam = isTeam1 ? m.team2_name : m.team1_name;
          return `<div class="rounded-xl border ${isWinner ? 'border-green-200 bg-gradient-to-r from-green-50 to-white' : 'border-red-200 bg-gradient-to-r from-red-50 to-white'} p-4 hover:shadow-sm transition-all">
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="w-7 h-7 rounded-lg ${isWinner ? 'bg-gradient-to-br from-yellow-400 to-yellow-500' : 'bg-gradient-to-br from-gray-300 to-gray-400'} flex items-center justify-center flex-shrink-0"><i class="fas ${isWinner ? 'fa-trophy' : 'fa-times'} text-white text-xs"></i></span>
                  <span class="font-bold text-base ${isWinner ? 'text-green-700' : 'text-red-600'}">${myTeam}</span>
                  <span class="text-gray-300 font-bold">vs</span>
                  <span class="font-medium text-gray-600">${oppTeam}</span>
                </div>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span class="text-xs text-gray-500"><i class="fas fa-layer-group mr-0.5"></i>${m.event_name || ''}</span>
                  ${m.group_num ? `<span class="text-xs text-indigo-500 font-medium">${m.group_num}조</span>` : ''}
                  ${m.court_number ? `<span class="text-xs text-gray-400">${m.court_number}코트</span>` : ''}
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="text-xl sm:text-2xl font-extrabold ${isWinner ? 'text-green-600' : 'text-red-500'}">${myScore} <span class="text-sm text-gray-300">:</span> ${oppScore}</div>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 ${isWinner ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-600 border-red-200'} rounded-full text-xs font-bold border mt-1">${isWinner ? '<i class="fas fa-check text-[9px]"></i>승리' : '<i class="fas fa-times text-[9px]"></i>패배'}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '<div class="text-center py-12 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p class="text-sm">완료된 경기가 없습니다.</p></div>'}
  `;
}

async function searchMyMatches() {
  const form = document.getElementById('my-search-form');
  const name = form?.querySelector('[name="name"]')?.value?.trim();
  const phone = form?.querySelector('[name="phone"]')?.value?.trim();
  if (!name) { showToast('이름을 입력해주세요.', 'warning'); return; }

  const tid = state.currentTournament.id;
  const resultEl = document.getElementById('my-result');
  resultEl.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>';

  try {
    const data = await api(`/tournaments/${tid}/my-matches?name=${encodeURIComponent(name)}${phone ? '&phone=' + encodeURIComponent(phone) : ''}`);
    // 동명이인 처리
    if (data.duplicates) {
      resultEl.innerHTML = renderDuplicateSelection(data);
    } else {
      resultEl.innerHTML = renderMyResult(data);
    }
  } catch(e) {
    resultEl.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-user-slash text-3xl mb-2"></i><p>참가자를 찾을 수 없습니다. 이름을 확인해주세요.</p></div>';
  }
}

function renderDuplicateSelection(data) {
  const CATS = { md: '남복', wd: '여복', xd: '혼복' };
  const LVLS = { s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' };
  return `<div class="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
    <div class="bg-amber-50 px-5 py-4 border-b border-amber-200">
      <h3 class="font-bold text-amber-800"><i class="fas fa-users mr-2"></i>${data.message}</h3>
      <p class="text-xs text-amber-600 mt-1">본인을 선택해주세요.</p>
    </div>
    <div class="p-4 space-y-3">
      ${data.participants.map(p => `
        <button onclick="selectDuplicate(${p.id})" class="w-full text-left p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${p.gender==='m'?'bg-blue-500':'bg-pink-500'}">
                <i class="fas ${p.gender==='m'?'fa-mars':'fa-venus'}"></i>
              </div>
              <div>
                <span class="font-bold text-gray-800">${p.name}</span>
                <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  ${p.club ? `<span><i class="fas fa-building mr-0.5"></i>${p.club}</span>` : ''}
                  ${p.level ? `<span class="px-1.5 py-0.5 rounded bg-gray-100">${LVLS[p.level]||p.level}급</span>` : ''}
                  ${p.birth_year ? `<span>${p.birth_year}년생</span>` : ''}
                  ${p.phone ? `<span>끝자리 ${p.phone}</span>` : ''}
                </div>
              </div>
            </div>
            <i class="fas fa-chevron-right text-gray-300 group-hover:text-indigo-500 transition"></i>
          </div>
        </button>
      `).join('')}
    </div>
  </div>`;
}

async function selectDuplicate(pid) {
  const tid = state.currentTournament.id;
  const resultEl = document.getElementById('my-result');
  resultEl.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>';
  try {
    const data = await api(`/tournaments/${tid}/my-matches-by-id/${pid}`);
    resultEl.innerHTML = renderMyResult(data);
  } catch(e) {
    resultEl.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-exclamation-circle text-3xl mb-2"></i><p>조회에 실패했습니다.</p></div>';
  }
}
