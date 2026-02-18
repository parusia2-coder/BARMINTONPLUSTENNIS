import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { tournamentRoutes } from './routes/tournaments'
import { participantRoutes } from './routes/participants'
import { eventRoutes } from './routes/events'
import { matchRoutes } from './routes/matches'
import { bracketRoutes } from './routes/brackets'
import { notificationRoutes } from './routes/notifications'

type Bindings = {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// API Routes
app.route('/api/tournaments', tournamentRoutes)
app.route('/api/tournaments', participantRoutes)
app.route('/api/tournaments', eventRoutes)
app.route('/api/tournaments', matchRoutes)
app.route('/api/tournaments', bracketRoutes)
app.route('/api/tournaments', notificationRoutes)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// 인쇄용 페이지 (수기 운영 대비)
app.get('/print', (c) => {
  return c.html(getPrintHtml())
})

// 코트 전용 점수판 페이지
app.get('/court', (c) => {
  return c.html(getCourtHtml())
})

// 참가자 전용 페이지 (직접 URL 접근)
app.get('/my', (c) => {
  return c.html(getMyPageHtml())
})

// 통계 대시보드 (직접 URL 접근)
app.get('/dashboard', (c) => {
  return c.html(getDashboardHtml())
})

// 코트별 타임라인 (전체 경기 흐름 한눈에 보기)
app.get('/timeline', (c) => {
  return c.html(getTimelineHtml())
})

// Service Worker (루트에서 접근 필요)
app.get('/sw.js', (c) => {
  return c.text(getServiceWorkerJs(), 200, { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/' })
})

// SPA - serve index.html for all non-API routes
app.get('*', (c) => {
  return c.html(getIndexHtml())
})

function getCourtHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>🏸 코트 점수판</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
            shuttle: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; overscroll-behavior: none; -webkit-user-select: none; user-select: none; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .score-btn { transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
    .score-btn:active { transform: scale(0.88) !important; }
    .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .pulse-live { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    .score-display { transition: all 0.15s ease; }
    .score-flash { transform: scale(1.15); color: #facc15; }

    /* 좌우 점수판 터치 영역 */
    .touch-area { -webkit-tap-highlight-color: transparent; transition: background 0.15s ease; }
    .touch-flash { background: rgba(255,255,255,0.08) !important; }
    
    /* 점수 폰트 크기: 화면 크기에 반응 */
    .score-num { 
      font-size: clamp(6rem, 20vw, 14rem); 
      line-height: 1;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    
    /* 승리 글로우 효과 */
    .winner-glow-left { box-shadow: inset 0 0 80px rgba(59,130,246,0.15); }
    .winner-glow-right { box-shadow: inset 0 0 80px rgba(249,115,22,0.15); }

    /* 사이드 선택 화면 애니메이션 */
    .swap-animate-left {
      animation: swapLeft 0.3s ease-in-out;
    }
    .swap-animate-right {
      animation: swapRight 0.3s ease-in-out;
    }
    @keyframes swapLeft {
      0% { transform: translateX(0); opacity: 1; }
      50% { transform: translateX(30px); opacity: 0.3; }
      100% { transform: translateX(0); opacity: 1; }
    }
    @keyframes swapRight {
      0% { transform: translateX(0); opacity: 1; }
      50% { transform: translateX(-30px); opacity: 0.3; }
      100% { transform: translateX(0); opacity: 1; }
    }
    .swap-icon-spin {
      transition: transform 0.3s ease;
    }
    .swap-icon-spin:hover, button:active .swap-icon-spin {
      transform: rotate(180deg);
    }

    /* 코트 교체 모달 오버레이 펄스 */
    .swap-modal-pulse {
      animation: swapPulse 1.5s ease-in-out infinite;
    }
    @keyframes swapPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.4); }
      50% { box-shadow: 0 0 0 20px rgba(168,85,247,0); }
    }

    /* 서명 캔버스 */
    #sig-canvas {
      cursor: crosshair;
      background: white;
    }

    /* 전체화면용 */
    html, body { height: 100%; overflow: hidden; }
    #app { height: 100%; overflow-y: auto; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 2px; }
  </style>
</head>
<body class="bg-gray-900 min-h-screen">
  <div id="app"></div>
  <script src="/static/court.js"></script>
</body>
</html>`
}

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏸 배드민턴 대회 운영 시스템</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
            shuttle: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
    .fade-in { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in-delay-1 { animation: fadeIn 0.5s ease-out 0.1s both; }
    .fade-in-delay-2 { animation: fadeIn 0.5s ease-out 0.2s both; }
    .fade-in-delay-3 { animation: fadeIn 0.5s ease-out 0.3s both; }
    .fade-in-delay-4 { animation: fadeIn 0.5s ease-out 0.4s both; }
    .score-btn { transition: all 0.15s; }
    .score-btn:active { transform: scale(0.92); }
    .card-hover { transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
    .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15); }
    .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
    .pulse-live { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    .scoreboard-num { font-variant-numeric: tabular-nums; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

    /* === Sport Command Center Design System === */
    .hero-bg {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #064e3b 100%);
      position: relative;
      overflow: hidden;
    }
    .hero-bg::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%);
      border-radius: 50%;
    }
    .hero-bg::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
      border-radius: 50%;
    }
    .glass-card {
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.12);
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    .glass-card:hover {
      background: rgba(255,255,255,0.14);
      border-color: rgba(255,255,255,0.25);
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .glass-nav {
      background: rgba(15,23,42,0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .feature-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      margin-bottom: 12px;
      transition: transform 0.3s;
    }
    .glass-card:hover .feature-icon { transform: scale(1.1); }
    .tournament-card-new {
      background: white;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      position: relative;
    }
    .tournament-card-new:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px -10px rgba(0,0,0,0.12);
      border-color: #cbd5e1;
    }
    .tournament-card-new::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
    }
    .status-bar-draft::before { background: #94a3b8; }
    .status-bar-open::before { background: #3b82f6; }
    .status-bar-in_progress::before { background: linear-gradient(180deg, #10b981, #059669); }
    .status-bar-completed::before { background: #8b5cf6; }
    .status-bar-cancelled::before { background: #ef4444; }
    .glow-emerald {
      box-shadow: 0 0 60px rgba(16,185,129,0.15), 0 0 120px rgba(16,185,129,0.05);
    }
    @keyframes float {
      0%,100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    .float-anim { animation: float 4s ease-in-out infinite; }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .shimmer-text {
      background: linear-gradient(90deg, #e2e8f0 25%, #f8fafc 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      -webkit-background-clip: text;
    }
    .stat-glow {
      background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1));
      border: 1px solid rgba(16,185,129,0.2);
    }
  </style>
</head>
<body class="bg-slate-50 min-h-screen">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
}

export default app

function getMyPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏸 내 경기 조회</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: { extend: { colors: {
        emerald: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b' }
      }}}
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .pulse-live { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    /* 알림 배너 */
    .notif-banner { animation: slideDown 0.4s ease-out, glow 2s infinite; }
    @keyframes slideDown { from { transform: translateY(-100%); opacity:0; } to { transform: translateY(0); opacity:1; } }
    @keyframes glow { 0%,100% { box-shadow: 0 4px 15px rgba(16,185,129,0.3); } 50% { box-shadow: 0 4px 25px rgba(16,185,129,0.6); } }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="notif-area"></div>
  <div id="app"></div>
  <script>
    var API='/api', tid=new URLSearchParams(location.search).get('tid');
    var LEVELS={s:'S',a:'A',b:'B',c:'C',d:'D',e:'E'};
    var LEVEL_COLORS={s:'bg-red-100 text-red-700',a:'bg-orange-100 text-orange-700',b:'bg-yellow-100 text-yellow-700',c:'bg-green-100 text-green-700',d:'bg-blue-100 text-blue-700',e:'bg-gray-100 text-gray-600'};
    var tournament=null, currentName='', currentPhone='', lastData=null, pushSubscribed=false;

    function showToast(msg,type){
      var t=document.createElement('div');
      var c={info:'bg-blue-500',success:'bg-emerald-500',error:'bg-red-500',warning:'bg-yellow-500 text-gray-900'};
      t.className='fixed top-4 right-4 z-[9999] px-5 py-3 rounded-lg text-white shadow-lg '+(c[type]||c.info)+' fade-in max-w-md';
      t.textContent=msg; document.body.appendChild(t);
      setTimeout(function(){t.style.opacity='0';t.style.transition='opacity 0.3s';setTimeout(function(){t.remove()},300)},3000);
    }

    // ─── 알림 배너 표시 ───
    function showNotifBanner(title, body, courtNum) {
      var area = document.getElementById('notif-area');
      var id = 'nb-'+Date.now();
      var html = '<div id="'+id+'" class="notif-banner fixed top-0 left-0 right-0 z-[9998] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-3 shadow-xl">';
      html += '<div class="max-w-2xl mx-auto flex items-center justify-between">';
      html += '<div class="flex items-center gap-3"><div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><i class="fas fa-bell text-lg"></i></div>';
      html += '<div><div class="font-bold text-sm">'+title+'</div><div class="text-xs text-emerald-100">'+body+'</div></div></div>';
      html += '<button onclick="document.getElementById(\\''+id+'\\').remove()" class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"><i class="fas fa-times text-sm"></i></button>';
      html += '</div></div>';
      area.insertAdjacentHTML('beforeend', html);
      // 진동
      if (navigator.vibrate) navigator.vibrate([200,100,200,100,300]);
      // 소리
      try { var ac=new AudioContext(); var o=ac.createOscillator(); o.frequency.value=880; o.type='sine'; var g=ac.createGain(); g.gain.value=0.3; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(function(){o.stop();ac.close()},200); } catch(e){}
      // 10초 후 자동 닫기
      setTimeout(function(){ var el=document.getElementById(id); if(el)el.remove(); }, 10000);
    }

    // ─── Service Worker & Push 구독 ───
    async function registerSW() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
      try {
        var reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        return reg;
      } catch(e) { return false; }
    }

    async function subscribePush(name, phone) {
      var reg = await registerSW();
      if (!reg) { showToast('이 브라우저는 푸시 알림을 지원하지 않습니다', 'warning'); return false; }
      try {
        var res = await fetch(API+'/tournaments/'+tid+'/push/vapid-key');
        var d = await res.json();
        var permission = await Notification.requestPermission();
        if (permission !== 'granted') { showToast('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.', 'warning'); return false; }
        var sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(d.publicKey)
        });
        var subJson = sub.toJSON();
        await fetch(API+'/tournaments/'+tid+'/push/subscribe', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ subscription: { endpoint: subJson.endpoint, keys: subJson.keys }, name: name, phone: phone||'' })
        });
        pushSubscribed = true;
        showToast('알림 구독 완료! 경기 시작 시 푸시 알림을 받습니다.', 'success');
        updatePushButton();
        return true;
      } catch(e) { showToast('알림 구독 실패: '+e.message, 'error'); return false; }
    }

    async function unsubscribePush() {
      if (!('serviceWorker' in navigator)) return;
      try {
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch(API+'/tournaments/'+tid+'/push/unsubscribe', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
          await sub.unsubscribe();
        }
        pushSubscribed = false;
        showToast('알림 구독이 해제되었습니다.', 'info');
        updatePushButton();
      } catch(e) { showToast('구독 해제 실패', 'error'); }
    }

    async function testPush() {
      if (!currentName) return;
      try {
        var res = await fetch(API+'/tournaments/'+tid+'/push/test', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name: currentName })
        });
        var d = await res.json();
        if (d.success) showToast('테스트 알림 발송! ('+d.sent+'건)', 'success');
        else showToast(d.error || '발송 실패', 'error');
      } catch(e) { showToast('발송 실패', 'error'); }
    }

    async function checkPushStatus(name) {
      try {
        var res = await fetch(API+'/tournaments/'+tid+'/push/status?name='+encodeURIComponent(name));
        var d = await res.json();
        pushSubscribed = d.subscribed;
      } catch(e) {}
    }

    function updatePushButton() {
      var btn = document.getElementById('push-btn');
      if (!btn) return;
      if (pushSubscribed) {
        btn.innerHTML = '<div class="flex items-center gap-2"><div class="flex items-center gap-1.5 text-emerald-700"><i class="fas fa-bell text-emerald-500"></i><span class="font-bold text-sm">알림 ON</span></div><div class="flex gap-1"><button onclick="testPush()" class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><i class="fas fa-paper-plane mr-1"></i>테스트</button><button onclick="unsubscribePush()" class="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"><i class="fas fa-bell-slash mr-1"></i>해제</button></div></div>';
      } else {
        btn.innerHTML = '<button onclick="subscribePush(\\''+currentName.replace(/'/g,"\\\\'")+'\\',\\''+currentPhone.replace(/'/g,"\\\\'")+'\\');" class="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:shadow-lg transition flex items-center justify-center gap-2"><i class="fas fa-bell"></i>경기 시작 알림 받기 (푸시)</button>';
      }
    }

    function urlBase64ToUint8Array(base64String) {
      var padding = '='.repeat((4 - base64String.length % 4) % 4);
      var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      var rawData = atob(base64);
      var outputArray = new Uint8Array(rawData.length);
      for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
      return outputArray;
    }

    // ─── 폴링 기반 인앱 알림 ───
    var pollInterval = null;
    function startPolling() {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(pollForChanges, 15000);
    }

    async function pollForChanges() {
      if (!currentName || !tid) return;
      try {
        var res = await fetch(API+'/tournaments/'+tid+'/my-matches?name='+encodeURIComponent(currentName)+(currentPhone?'&phone='+encodeURIComponent(currentPhone):''));
        if (!res.ok) return;
        var data = await res.json();
        if (lastData) {
          detectChanges(lastData, data);
        }
        lastData = data;
        // 결과도 갱신
        var el = document.getElementById('result');
        if (el) el.innerHTML = renderResult(data);
      } catch(e) {}
    }

    function detectChanges(oldD, newD) {
      var oldMatches = {};
      (oldD.matches||[]).forEach(function(m){ oldMatches[m.id] = m.status; });
      var upcoming = newD.upcoming_matches||[];
      for (var i=0; i<upcoming.length; i++) {
        var m = upcoming[i];
        var oldStatus = oldMatches[m.id];
        // 대기→진행 전환 감지
        if (oldStatus === 'pending' && m.status === 'playing') {
          showNotifBanner(
            '🏸 경기 시작!',
            '코트 '+m.court_number+'에서 경기가 시작됩니다!\\n'+m.team1_name+' vs '+m.team2_name,
            m.court_number
          );
        }
      }
    }

    // ─── 초기화 ───
    async function init() {
      var app = document.getElementById('app');
      if (!tid) {
        try {
          var res = await fetch(API+'/tournaments'); var d = await res.json();
          app.innerHTML = '<div class="max-w-lg mx-auto px-4 py-8 fade-in"><div class="text-center mb-8"><div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mb-3 shadow-lg"><i class="fas fa-user text-2xl text-white"></i></div><h1 class="text-2xl font-extrabold text-gray-900">내 경기 조회</h1><p class="text-gray-500 mt-1">대회를 선택하세요</p></div><div class="space-y-3">'+
            d.tournaments.map(function(t){return '<a href="/my?tid='+t.id+'" class="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition"><h3 class="font-bold text-gray-900">'+t.name+'</h3><p class="text-sm text-gray-500">'+t.courts+'코트</p></a>';}).join('')+
            '</div><a href="/" class="block text-center mt-6 text-sm text-gray-500 hover:text-gray-700"><i class="fas fa-home mr-1"></i>메인으로</a></div>';
        } catch(e) { app.innerHTML='<div class="text-center py-20 text-gray-400">로딩 실패</div>'; }
        return;
      }
      try { var res=await fetch(API+'/tournaments/'+tid); var d=await res.json(); tournament=d.tournament; } catch(e){}
      renderSearchPage();
    }

    function renderSearchPage() {
      var app = document.getElementById('app');
      var h = '<div class="max-w-2xl mx-auto px-4 py-8 fade-in">';
      h += '<div class="flex items-center justify-between mb-6"><a href="/my" class="text-gray-500 hover:text-gray-700 text-sm"><i class="fas fa-arrow-left mr-1"></i>대회 선택</a><a href="/" class="text-gray-500 hover:text-gray-700 text-sm"><i class="fas fa-home mr-1"></i>메인</a></div>';
      h += '<div class="text-center mb-6"><div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mb-3 shadow-lg"><i class="fas fa-user text-2xl text-white"></i></div>';
      h += '<h1 class="text-2xl font-extrabold text-gray-900">내 경기 조회</h1>';
      h += '<p class="text-gray-500 mt-1">'+(tournament?.name||'')+'</p></div>';
      // 검색 폼
      h += '<div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4">';
      h += '<form id="search-form" class="flex flex-wrap gap-3 items-end">';
      h += '<div class="flex-1 min-w-[150px]"><label class="block text-xs font-semibold text-gray-500 mb-1">이름 <span class="text-red-500">*</span></label>';
      h += '<input id="s-name" required placeholder="이름 입력" class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"></div>';
      h += '<div class="flex-1 min-w-[150px]"><label class="block text-xs font-semibold text-gray-500 mb-1">연락처 (선택)</label>';
      h += '<input id="s-phone" placeholder="010-xxxx-xxxx" class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"></div>';
      h += '<button type="submit" class="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition"><i class="fas fa-search mr-1"></i>조회</button>';
      h += '</form></div>';
      // 푸시 알림 버튼 영역
      h += '<div id="push-btn" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 hidden"></div>';
      // 인앱 알림 안내
      h += '<div id="polling-status" class="hidden text-center text-xs text-gray-400 mb-4"><i class="fas fa-sync-alt fa-spin mr-1"></i>15초마다 자동 갱신 중</div>';
      // 결과 영역
      h += '<div id="result"></div></div>';
      app.innerHTML = h;

      document.getElementById('search-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        currentName = document.getElementById('s-name').value.trim();
        currentPhone = document.getElementById('s-phone').value.trim();
        if (!currentName) { showToast('이름을 입력해주세요','warning'); return; }
        var el = document.getElementById('result');
        el.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>';
        try {
          var res = await fetch(API+'/tournaments/'+tid+'/my-matches?name='+encodeURIComponent(currentName)+(currentPhone?'&phone='+encodeURIComponent(currentPhone):''));
          if (!res.ok) throw 0;
          var data = await res.json();
          lastData = data;
          el.innerHTML = renderResult(data);
          // 푸시 버튼 표시
          var pushEl = document.getElementById('push-btn');
          pushEl.classList.remove('hidden');
          await checkPushStatus(currentName);
          updatePushButton();
          // 폴링 시작
          document.getElementById('polling-status').classList.remove('hidden');
          startPolling();
        } catch(e) {
          el.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-user-slash text-3xl mb-2"></i><p>참가자를 찾을 수 없습니다.</p></div>';
        }
      });
    }

    function renderResult(data) {
      var p=data.participant, teams=data.teams||[], matches=data.matches||[];
      var rec=data.record||{}, upcoming=data.upcoming_matches||[];
      var completed=matches.filter(function(m){return m.status==='completed'});
      var h='<div class="fade-in">';
      // 프로필 카드
      h+='<div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6"><div class="flex items-center gap-4"><div class="w-14 h-14 rounded-2xl bg-gradient-to-br '+(p.gender==='m'?'from-blue-400 to-blue-600':'from-pink-400 to-pink-600')+' flex items-center justify-center"><i class="fas fa-user text-xl text-white"></i></div><div><h2 class="text-xl font-extrabold">'+p.name+'</h2><div class="flex items-center gap-2 mt-1"><span class="badge '+(p.gender==='m'?'bg-blue-100 text-blue-700':'bg-pink-100 text-pink-700')+'">'+(p.gender==='m'?'남':'여')+'</span><span class="badge '+(LEVEL_COLORS[p.level]||'bg-gray-100 text-gray-600')+'">'+(LEVELS[p.level]||'C')+'급</span>'+(p.club?'<span class="badge bg-teal-50 text-teal-700">'+p.club+'</span>':'')+'</div></div></div></div>';
      // 전적
      h+='<div class="grid grid-cols-4 gap-3 mb-6"><div class="bg-white rounded-xl border p-3 text-center"><div class="text-xl font-extrabold">'+data.total_matches+'</div><div class="text-xs text-gray-500">총</div></div><div class="bg-green-50 rounded-xl border border-green-200 p-3 text-center"><div class="text-xl font-extrabold text-green-600">'+(rec.wins||0)+'</div><div class="text-xs text-gray-500">승</div></div><div class="bg-red-50 rounded-xl border border-red-200 p-3 text-center"><div class="text-xl font-extrabold text-red-500">'+(rec.losses||0)+'</div><div class="text-xs text-gray-500">패</div></div><div class="bg-blue-50 rounded-xl border border-blue-200 p-3 text-center"><div class="text-xl font-extrabold text-blue-600">'+((rec.total_score||0)-(rec.total_lost||0)>0?'+':'')+((rec.total_score||0)-(rec.total_lost||0))+'</div><div class="text-xs text-gray-500">득실</div></div></div>';
      // 소속 팀
      if(teams.length>0){
        h+='<div class="bg-white rounded-2xl shadow-sm border p-5 mb-6"><h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-users mr-2 text-emerald-500"></i>소속 팀</h3><div class="space-y-2">'+teams.map(function(t){return '<div class="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"><div><span class="font-bold">'+t.team_name+'</span><span class="ml-2 text-xs text-gray-500">'+t.event_name+'</span>'+(t.group_num?'<span class="badge bg-indigo-50 text-indigo-600 text-xs ml-1">'+t.group_num+'조</span>':'')+'</div><span class="text-sm text-gray-600">'+t.p1_name+' · '+t.p2_name+'</span></div>';}).join('')+'</div></div>';
      }
      // 예정/진행중
      if(upcoming.length>0){
        h+='<div class="bg-white rounded-2xl shadow-sm border-2 border-emerald-200 p-5 mb-6"><h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-clock mr-2 text-emerald-500"></i>예정/진행중 ('+upcoming.length+')</h3><div class="space-y-2">'+upcoming.map(function(m){
          var isT1=teams.some(function(t){return t.id===m.team1_id});
          var my=isT1?m.team1_name:m.team2_name;
          var opp=isT1?m.team2_name:m.team1_name;
          return '<div data-mid="'+m.id+'" class="flex items-center justify-between rounded-xl px-4 py-3 '+(m.status==='playing'?'bg-emerald-50 border-2 border-emerald-300':'bg-gray-50')+'"><div><span class="font-bold">'+my+'</span> <span class="text-gray-400">vs</span> <span>'+(opp||'BYE')+'</span><p class="text-xs text-gray-500 mt-0.5">'+(m.event_name||'')+' #'+m.match_order+'</p></div><div>'+(m.court_number?'<span class="badge bg-yellow-100 text-yellow-700">'+m.court_number+'코트</span>':'')+(m.status==='playing'?'<span class="badge bg-emerald-100 text-emerald-700 ml-1 pulse-live">진행중</span>':'<span class="badge bg-gray-100 text-gray-600 ml-1">대기</span>')+'</div></div>';
        }).join('')+'</div></div>';
      }
      // 완료
      if(completed.length>0){
        h+='<div class="bg-white rounded-2xl shadow-sm border p-5"><h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-history mr-2 text-blue-500"></i>경기 결과 ('+completed.length+')</h3><div class="space-y-2">'+completed.map(function(m){
          var isT1=teams.some(function(t){return t.id===m.team1_id});
          var isW=(isT1&&m.winner_team===1)||(!isT1&&m.winner_team===2);
          var myS=isT1?(m.team1_set1||0):(m.team2_set1||0);
          var opS=isT1?(m.team2_set1||0):(m.team1_set1||0);
          var my=isT1?m.team1_name:m.team2_name;
          var opp=isT1?m.team2_name:m.team1_name;
          return '<div data-mid="'+m.id+'" class="flex items-center justify-between rounded-xl px-4 py-3 '+(isW?'bg-green-50':'bg-red-50')+'"><div><span class="font-bold '+(isW?'text-green-700':'text-red-600')+'">'+(isW?'🏆':'💔')+' '+my+'</span> <span class="text-gray-400">vs</span> <span>'+opp+'</span><p class="text-xs text-gray-500 mt-0.5">'+(m.event_name||'')+(m.court_number?' '+m.court_number+'코트':'')+'</p></div><div class="text-right"><span class="text-xl font-extrabold '+(isW?'text-green-600':'text-red-500')+'">'+myS+' : '+opS+'</span><span class="badge '+(isW?'bg-green-100 text-green-700':'bg-red-100 text-red-600')+' block mt-1 text-center">'+(isW?'승리':'패배')+'</span></div></div>';
        }).join('')+'</div></div>';
      } else {
        h+='<div class="text-center py-8 text-gray-400"><p>완료된 경기가 없습니다.</p></div>';
      }
      h+='</div>';
      return h;
    }

    // ─── #4 하이라이트: URL ?highlight=matchId → 해당 경기 강조 ───
    function highlightMatch(matchId) {
      if (!matchId) return;
      setTimeout(function() {
        var els = document.querySelectorAll('[data-mid="'+matchId+'"]');
        if (els.length > 0) {
          els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          els[0].classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
          els[0].style.transition = 'all 0.3s';
          setTimeout(function(){ els[0].classList.remove('ring-2','ring-emerald-500','ring-offset-2'); }, 5000);
        }
      }, 500);
    }
    var hlParam = new URLSearchParams(location.search).get('highlight');

    // Service Worker → 프론트엔드 메시지 수신 (이미 열린 /my 창에서)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'MATCH_NOTIFICATION') {
          pollForChanges(); // 즉시 갱신
          highlightMatch(event.data.matchId);
          showNotifBanner('🏸 경기 알림!', '코트 '+(event.data.courtNumber||'')+' 경기 알림이 도착했습니다.', event.data.courtNumber);
        }
      });
    }

    init().then(function() { if (hlParam) highlightMatch(hlParam); });
  </script>
</body>
</html>`
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏸 통계 대시보드</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: { extend: { colors: {
        shuttle: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' }
      }}}
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .pulse-live { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app"><div class="flex items-center justify-center h-96"><i class="fas fa-spinner fa-spin text-4xl text-gray-400"></i></div></div>
  <script>
    const API = '/api';
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('tid');

    async function load() {
      const app = document.getElementById('app');
      if (!tid) {
        try {
          const res = await fetch(API+'/tournaments'); const d = await res.json();
          app.innerHTML = '<div class="max-w-lg mx-auto px-4 py-8 fade-in"><div class="text-center mb-8"><div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 mb-3"><i class="fas fa-chart-bar text-2xl text-white"></i></div><h1 class="text-2xl font-extrabold text-gray-900">통계 대시보드</h1><p class="text-gray-500 mt-1">대회를 선택하세요</p></div><div class="space-y-3">'+
            d.tournaments.map(t => '<a href="/dashboard?tid='+t.id+'" class="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition"><h3 class="font-bold text-gray-900">'+t.name+'</h3><p class="text-sm text-gray-500">'+t.courts+'코트</p></a>').join('')+
            '</div><a href="/" class="block text-center mt-6 text-sm text-gray-500 hover:text-gray-700"><i class="fas fa-home mr-1"></i>메인으로</a></div>';
        } catch(e) { app.innerHTML = '<div class="text-center py-20 text-gray-400">로딩 실패</div>'; }
        return;
      }
      try {
        const res = await fetch(API+'/tournaments/'+tid+'/dashboard');
        const d = await res.json();
        renderDashboard(d);
      } catch(e) { app.innerHTML = '<div class="text-center py-20 text-gray-400">로딩 실패</div>'; }
    }

    function renderDashboard(d) {
      const ms = d.match_stats||{}; const ps = d.participant_stats||{}; const progress = d.progress||0;
      const lvColors = { s:'bg-red-500', a:'bg-orange-500', b:'bg-yellow-500', c:'bg-green-500', d:'bg-blue-500', e:'bg-gray-400' };
      const lvLabels = { s:'S급', a:'A급', b:'B급', c:'C급', d:'D급', e:'E급' };
      const app = document.getElementById('app');
      app.innerHTML = '<div class="max-w-6xl mx-auto px-4 py-6 fade-in">'+
        '<div class="flex items-center justify-between mb-6"><div class="flex items-center gap-3"><a href="/" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200"><i class="fas fa-home text-gray-600"></i></a><h1 class="text-2xl font-bold text-gray-900"><i class="fas fa-chart-bar mr-2 text-orange-500"></i>'+(d.tournament?.name||'')+' - 통계</h1></div><button onclick="location.reload()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><i class="fas fa-sync-alt mr-1"></i>새로고침</button></div>'+
        // 진행률
        '<div class="bg-white rounded-2xl border p-6 mb-6"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold text-gray-800"><i class="fas fa-tasks mr-2 text-shuttle-500"></i>대회 진행률</h3><span class="text-3xl font-extrabold '+(progress>=100?'text-green-600':progress>=50?'text-blue-600':'text-yellow-600')+'">'+progress+'%</span></div><div class="w-full bg-gray-200 rounded-full h-4 mb-3"><div class="h-4 rounded-full transition-all '+(progress>=100?'bg-green-500':progress>=50?'bg-blue-500':'bg-yellow-500')+'" style="width:'+progress+'%"></div></div><div class="grid grid-cols-2 sm:grid-cols-4 gap-4"><div class="bg-gray-50 rounded-xl p-4 text-center"><div class="text-2xl font-extrabold">'+(ms.total||0)+'</div><div class="text-xs text-gray-500">전체 경기</div></div><div class="bg-green-50 rounded-xl p-4 text-center"><div class="text-2xl font-extrabold text-green-600">'+(ms.playing||0)+'</div><div class="text-xs text-gray-500">진행중</div></div><div class="bg-yellow-50 rounded-xl p-4 text-center"><div class="text-2xl font-extrabold text-yellow-600">'+(ms.pending||0)+'</div><div class="text-xs text-gray-500">대기중</div></div><div class="bg-blue-50 rounded-xl p-4 text-center"><div class="text-2xl font-extrabold text-blue-600">'+(ms.completed||0)+'</div><div class="text-xs text-gray-500">완료</div></div></div></div>'+
        // 참가자 + 급수
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">'+
        '<div class="bg-white rounded-2xl border p-6"><h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-users mr-2 text-indigo-500"></i>참가자 현황</h3><div class="grid grid-cols-3 gap-3 mb-4"><div class="text-center bg-gray-50 rounded-xl p-3"><div class="text-xl font-bold">'+(ps.total||0)+'</div><div class="text-xs text-gray-500">총</div></div><div class="text-center bg-blue-50 rounded-xl p-3"><div class="text-xl font-bold text-blue-600">'+(ps.male||0)+'</div><div class="text-xs text-gray-500">남</div></div><div class="text-center bg-pink-50 rounded-xl p-3"><div class="text-xl font-bold text-pink-600">'+(ps.female||0)+'</div><div class="text-xs text-gray-500">여</div></div></div><div class="space-y-2"><div class="flex items-center justify-between text-sm"><span class="text-gray-600"><i class="fas fa-won-sign mr-1 text-green-500"></i>참가비</span><span class="font-bold">'+(ps.paid||0)+'/'+(ps.total||0)+'</span></div><div class="flex items-center justify-between text-sm"><span class="text-gray-600"><i class="fas fa-check-circle mr-1 text-blue-500"></i>체크인</span><span class="font-bold">'+(ps.checked_in||0)+'/'+(ps.total||0)+'</span></div></div></div>'+
        '<div class="bg-white rounded-2xl border p-6"><h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-signal mr-2 text-orange-500"></i>급수 분포</h3><div class="space-y-2">'+(d.level_distribution||[]).map(l => '<div class="flex items-center gap-3"><span class="w-8 text-sm font-bold">'+(lvLabels[l.level]||l.level)+'</span><div class="flex-1 bg-gray-100 rounded-full h-5"><div class="'+(lvColors[l.level]||'bg-gray-400')+' h-5 rounded-full flex items-center justify-end pr-2" style="width:'+Math.max(ps.total?Math.round(l.count/ps.total*100):0,8)+'%"><span class="text-white text-xs font-bold">'+l.count+'</span></div></div><span class="text-xs text-gray-500 w-10 text-right">'+(ps.total?Math.round(l.count/ps.total*100):0)+'%</span></div>').join('')+'</div></div></div>'+
        // 종목별
        '<div class="bg-white rounded-2xl border p-6 mb-6"><h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-layer-group mr-2 text-shuttle-500"></i>종목별 현황</h3><div class="overflow-x-auto"><table class="w-full"><thead class="bg-gray-50"><tr><th class="px-3 py-2 text-left text-sm font-semibold text-gray-600">종목</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">팀</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">전체</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">진행</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">완료</th><th class="px-3 py-2 text-left text-sm font-semibold text-gray-600">진행률</th></tr></thead><tbody class="divide-y divide-gray-100">'+(d.event_stats||[]).map(ev => { const pct=ev.total_matches>0?Math.round(ev.completed_matches/ev.total_matches*100):0; return '<tr class="hover:bg-gray-50"><td class="px-3 py-2 font-medium">'+ev.name+'</td><td class="px-3 py-2 text-center font-bold">'+ev.team_count+'</td><td class="px-3 py-2 text-center">'+ev.total_matches+'</td><td class="px-3 py-2 text-center text-green-600 font-bold">'+ev.playing_matches+'</td><td class="px-3 py-2 text-center text-blue-600">'+ev.completed_matches+'</td><td class="px-3 py-2"><div class="flex items-center gap-2"><div class="flex-1 bg-gray-200 rounded-full h-2"><div class="'+(pct>=100?'bg-green-500':'bg-blue-500')+' h-2 rounded-full" style="width:'+pct+'%"></div></div><span class="text-xs font-bold">'+pct+'%</span></div></td></tr>'; }).join('')+'</tbody></table></div></div>'+
        // 코트별
        '<div class="bg-white rounded-2xl border p-6 mb-6"><h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-th-large mr-2 text-green-500"></i>코트별 현황</h3><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">'+(d.court_stats||[]).map(ct => '<div class="rounded-xl border '+(ct.playing>0?'border-green-300 bg-green-50':'border-gray-200 bg-gray-50')+' p-4 text-center"><div class="text-2xl font-extrabold '+(ct.playing>0?'text-green-600':'text-gray-400')+'">'+ct.court_number+'</div><div class="text-xs text-gray-500 mb-1">'+ct.court_number+'코트</div>'+(ct.playing>0?'<span class="badge bg-green-100 text-green-700 text-xs">진행중</span>':'')+'<div class="text-xs text-gray-500 mt-1">대기 '+ct.pending+' · 완료 '+ct.completed+'</div></div>').join('')+'</div></div>'+
        // 클럽별
        ((d.club_stats||[]).length>0?'<div class="bg-white rounded-2xl border p-6 mb-6"><h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-building mr-2 text-teal-500"></i>클럽별 성적</h3><div class="overflow-x-auto"><table class="w-full"><thead class="bg-gray-50"><tr><th class="px-3 py-2 text-left text-sm font-semibold text-gray-600">클럽</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">선수</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">팀</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">승</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">패</th><th class="px-3 py-2 text-center text-sm font-semibold text-gray-600">승률</th></tr></thead><tbody class="divide-y divide-gray-100">'+(d.club_stats||[]).sort((a,b)=>b.win_rate-a.win_rate).map((cl,i) => '<tr class="hover:bg-gray-50"><td class="px-3 py-2 font-medium text-teal-700">'+(i<3?['🥇','🥈','🥉'][i]+' ':'')+cl.club+'</td><td class="px-3 py-2 text-center">'+cl.player_count+'</td><td class="px-3 py-2 text-center">'+cl.team_count+'</td><td class="px-3 py-2 text-center text-green-600 font-bold">'+cl.wins+'</td><td class="px-3 py-2 text-center text-red-500">'+cl.losses+'</td><td class="px-3 py-2 text-center font-bold '+(cl.win_rate>=60?'text-green-600':cl.win_rate>=40?'text-blue-600':'text-gray-600')+'">'+cl.win_rate+'%</td></tr>').join('')+'</tbody></table></div></div>':'')+
      '</div>';
    }

    load();
    // 자동 새로고침 (30초)
    if (tid) setInterval(load, 30000);
  </script>
</body>
</html>`
}

function getTimelineHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏸 코트별 타임라인</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: { extend: { colors: {
        emerald: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b' }
      }}}
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .pulse-live { animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    .timeline-scroll::-webkit-scrollbar { height: 6px; }
    .timeline-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
    .timeline-scroll::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    .timeline-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
    /* 툴팁 - 이벤트 위임으로 동적 표시 */
    #tooltip-popup {
      display: none; position: fixed; z-index: 999; pointer-events: none;
      background: white; border-radius: 12px; padding: 12px 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0; min-width: 200px; max-width: 280px;
    }
    /* 경기 노드 - 최소 CSS */
    .mn { flex-shrink:0; cursor:pointer; transition: transform 0.15s; }
    .mn:hover { transform: translateY(-3px); }
    .nd { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; }
    .cd { position:absolute; bottom:-2px; left:50%; transform:translateX(-50%); width:6px; height:6px; border-radius:50%; }
    /* 상태색 */
    .s-c { background:#10b981; color:white; }
    .s-p { background:#f59e0b; color:#78350f; }
    .s-w { background:#e2e8f0; color:#64748b; }
    /* 종목색 */
    .c-md { background:#3b82f6; } .c-wd { background:#ec4899; } .c-xd { background:#8b5cf6; }
  </style>
</head>
<body class="bg-slate-50 min-h-screen">
  <div id="app"><div class="flex items-center justify-center h-screen"><i class="fas fa-spinner fa-spin text-4xl text-gray-400"></i></div></div>
  <div id="tooltip-popup"></div>
  <script>
    var API='/api', tid=new URLSearchParams(location.search).get('tid');
    var CAT_L={md:'남복',wd:'여복',xd:'혼복'};
    var CAT_C={md:['bg-blue-50','border-blue-300','text-blue-700'],wd:['bg-pink-50','border-pink-300','text-pink-700'],xd:['bg-purple-50','border-purple-300','text-purple-700']};
    var ST_L={completed:'완료',playing:'진행중',pending:'대기'};
    var D=null, filterCat='all';
    // match tuple indices: 0=status, 1=category, 2=s1, 3=s2, 4=winner, 5=group, 6=t1name, 7=t2name, 8=order

    async function load(){
      var app=document.getElementById('app');
      if(!tid){
        try{var r=await(await fetch(API+'/tournaments')).json();app.innerHTML=selPage(r.tournaments);}catch(e){app.innerHTML='<div class="text-center py-20 text-gray-400">로딩 실패</div>';}
        return;
      }
      try{
        var r=await fetch(API+'/tournaments/'+tid+'/timeline');
        if(!r.ok)throw 0;
        D=await r.json();
        render();
      }catch(e){app.innerHTML='<div class="text-center py-20 text-gray-400"><i class="fas fa-exclamation-circle text-3xl mb-3"></i><p>데이터를 불러올 수 없습니다.</p></div>';}
    }

    function selPage(ts){
      return '<div class="max-w-lg mx-auto px-4 py-8 fade-in">'+
        '<div class="text-center mb-8"><div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mb-3 shadow-lg"><i class="fas fa-stream text-2xl text-white"></i></div>'+
        '<h1 class="text-2xl font-extrabold text-gray-900">코트별 타임라인</h1><p class="text-gray-500 mt-1">대회를 선택하세요</p></div>'+
        '<div class="space-y-3">'+ts.map(function(t){return '<a href="/timeline?tid='+t.id+'" class="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition"><h3 class="font-bold text-gray-900">'+t.name+'</h3><p class="text-sm text-gray-500">'+t.courts+'코트</p></a>';}).join('')+'</div>'+
        '<a href="/" class="block text-center mt-6 text-sm text-gray-500 hover:text-gray-700"><i class="fas fa-home mr-1"></i>메인으로</a></div>';
    }

    function render(){
      var t=D.t, d=D.d, s=D.s; // s=[done,play,pend]
      var total=s[0]+s[1]+s[2], prog=total>0?Math.round(s[0]/total*100):0;
      var h='<div class="fade-in">';

      // ─── 헤더 ───
      h+='<div class="bg-white border-b border-gray-200 sticky top-0 z-30"><div class="max-w-[1800px] mx-auto px-4 sm:px-6 py-3">';
      h+='<div class="flex items-center justify-between flex-wrap gap-3">';
      h+='<div class="flex items-center gap-3">';
      h+='<a href="/" class="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"><i class="fas fa-home text-gray-600 text-sm"></i></a>';
      h+='<div><h1 class="text-lg font-bold text-gray-900"><i class="fas fa-stream mr-1.5 text-emerald-500"></i>코트별 타임라인</h1>';
      h+='<p class="text-xs text-gray-500">'+t.n+' · '+t.c+'코트</p></div></div>';

      // 통계 + 필터
      h+='<div class="flex items-center gap-2 flex-wrap">';
      h+='<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border text-xs">';
      h+='<div class="w-20 bg-gray-200 rounded-full h-1.5"><div class="h-1.5 rounded-full '+(prog>=100?'bg-emerald-500':prog>=50?'bg-blue-500':'bg-amber-500')+'" style="width:'+prog+'%"></div></div>';
      h+='<span class="font-bold '+(prog>=100?'text-emerald-600':'text-gray-600')+'">'+prog+'%</span></div>';
      h+='<div class="flex items-center gap-1 text-xs">';
      h+='<span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">'+s[0]+'완료</span>';
      h+='<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">'+s[1]+'진행</span>';
      h+='<span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">'+s[2]+'대기</span></div>';
      // 필터
      h+='<div class="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg">';
      var fo=[['all','전체'],['md','남복'],['wd','여복'],['xd','혼복']];
      for(var i=0;i<fo.length;i++){var f=fo[i];
        h+='<button onclick="filterCat=\\''+f[0]+'\\';render()" class="px-2.5 py-1 rounded-md text-xs font-medium transition '+(filterCat===f[0]?'bg-white shadow text-gray-900':'text-gray-500 hover:text-gray-700')+'">'+f[1]+'</button>';
      }
      h+='</div>';
      h+='<button onclick="load()" class="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition"><i class="fas fa-sync-alt mr-1"></i>새로고침</button>';
      h+='</div></div></div></div>';

      // ─── 범례 ───
      h+='<div class="max-w-[1800px] mx-auto px-4 sm:px-6 pt-4 pb-2">';
      h+='<div class="flex items-center gap-3 text-xs text-gray-500 flex-wrap">';
      h+='<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>완료</span>';
      h+='<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-400 pulse-live"></span>진행중</span>';
      h+='<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-slate-200"></span>대기</span>';
      h+='<span class="text-gray-300">|</span>';
      h+='<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300"></span>남복</span>';
      h+='<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-pink-100 border border-pink-300"></span>여복</span>';
      h+='<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-purple-100 border border-purple-300"></span>혼복</span>';
      h+='</div></div>';

      // ─── 코트 레인들 ───
      h+='<div class="max-w-[1800px] mx-auto px-4 sm:px-6 pb-6">';
      for(var cn=0;cn<t.c;cn++){
        var raw=d[cn]||[];
        var matches=filterCat==='all'?raw:raw.filter(function(m){return m[1]===filterCat;});
        var done=0,play=0;
        for(var j=0;j<matches.length;j++){if(matches[j][0]==='completed')done++;else if(matches[j][0]==='playing')play++;}
        var mt=matches.length, cp=mt>0?Math.round(done/mt*100):0;

        h+='<div class="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">';
        // 코트 헤더
        h+='<div class="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">';
        h+='<div class="flex items-center gap-2.5">';
        h+='<div class="w-9 h-9 rounded-lg '+(play>0?'bg-gradient-to-br from-amber-400 to-amber-500':done===mt&&mt>0?'bg-gradient-to-br from-emerald-400 to-emerald-500':'bg-gradient-to-br from-slate-400 to-slate-500')+' flex items-center justify-center text-white font-extrabold shadow-sm">'+(cn+1)+'</div>';
        h+='<div><span class="font-bold text-gray-900 text-sm">코트 '+(cn+1)+'</span>';
        h+='<span class="text-xs text-gray-400 ml-1.5">'+done+'/'+mt+'</span></div></div>';
        h+='<div class="flex items-center gap-1.5">';
        h+='<div class="w-16 bg-gray-200 rounded-full h-1"><div class="h-1 rounded-full '+(cp>=100?'bg-emerald-500':'bg-blue-500')+'" style="width:'+cp+'%"></div></div>';
        h+='<span class="text-xs font-bold text-gray-500">'+cp+'%</span></div></div>';

        // 타임라인 스크롤 — 컴팩트 노드
        h+='<div class="timeline-scroll overflow-x-auto px-4 py-3">';
        h+='<div class="flex items-center gap-1" style="min-width:'+Math.max(mt*46,120)+'px">';
        for(var mi=0;mi<matches.length;mi++){
          var m=matches[mi]; // [st,cat,s1,s2,w,g,t1,t2,order]
          var st=m[0],cat=m[1];
          var sc=st==='completed'?'s-c':st==='playing'?'s-p':'s-w';
          var cc=cat==='wd'?'c-wd':cat==='xd'?'c-xd':'c-md';
          // data 속성에 인덱스 저장 (툴팁 이벤트 위임)
          h+='<div class="mn relative" data-c="'+cn+'" data-i="'+mi+'" data-f="'+(filterCat!=='all'?1:0)+'">';
          h+='<div class="nd '+sc+'">';
          if(st==='completed')h+='<i class="fas fa-check" style="font-size:10px"></i>';
          else if(st==='playing')h+='<i class="fas fa-play" style="font-size:9px"></i>';
          else h+=(mi+1);
          h+='</div><div class="cd '+cc+'"></div></div>';
          // 연결선
          if(mi<matches.length-1){
            h+='<div class="flex-shrink-0 rounded" style="width:6px;height:2px;background:'+(st==='completed'?'#6ee7b7':st==='playing'?'#fcd34d':'#e2e8f0')+'"></div>';
          }
        }
        if(mt===0) h+='<div class="text-xs text-gray-400 py-1"><i class="fas fa-info-circle mr-1"></i>배정된 경기가 없습니다</div>';
        h+='</div></div></div>';
      }
      h+='</div></div>';
      document.getElementById('app').innerHTML=h;
    }

    // ─── 이벤트 위임: 툴팁 ───
    var tip=document.getElementById('tooltip-popup');
    document.addEventListener('mouseover',function(e){
      var el=e.target.closest('.mn');
      if(!el||!D)return;
      var cn=+el.dataset.c, mi=+el.dataset.i, filt=+el.dataset.f;
      var raw=D.d[cn]||[];
      var matches=filt?raw.filter(function(m){return m[1]===filterCat;}):raw;
      var m=matches[mi]; if(!m)return;
      var st=m[0],cat=m[1],s1=m[2],s2=m[3],w=m[4],g=m[5],t1=m[6]||'TBD',t2=m[7]||'TBD',ord=m[8];
      var cc=CAT_C[cat]||CAT_C.md;
      var th='<div class="'+cc[0]+' border '+cc[1]+' rounded-xl p-3">';
      th+='<div class="flex items-center justify-between mb-1.5">';
      th+='<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold '+cc[0]+' '+cc[2]+' border '+cc[1]+'">'+(CAT_L[cat]||'')+' '+(g?g+'조':'')+'</span>';
      th+='<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold '+(st==='completed'?'bg-emerald-500 text-white':st==='playing'?'bg-amber-400 text-amber-900':'bg-slate-200 text-slate-500')+'">'+(ST_L[st]||'')+'</span></div>';
      th+='<div class="text-sm font-bold text-gray-900">'+t1+'</div>';
      th+='<div class="text-[10px] text-gray-400 my-0.5">vs</div>';
      th+='<div class="text-sm font-bold text-gray-900">'+t2+'</div>';
      if(st==='completed'){
        th+='<div class="mt-1.5 pt-1.5 border-t '+cc[1]+' text-center">';
        th+='<span class="text-base font-extrabold '+(w===1?'text-emerald-600':'text-gray-500')+'">'+s1+'</span>';
        th+='<span class="mx-1.5 text-gray-300">:</span>';
        th+='<span class="text-base font-extrabold '+(w===2?'text-emerald-600':'text-gray-500')+'">'+s2+'</span></div>';
      }
      th+='<div class="text-[9px] text-gray-400 mt-1">#'+ord+'</div></div>';
      tip.innerHTML=th;
      tip.style.display='block';
      var r=el.getBoundingClientRect();
      var tw=tip.offsetWidth,th2=tip.offsetHeight;
      var x=r.left+r.width/2-tw/2, y=r.top-th2-8;
      if(x<4)x=4; if(x+tw>window.innerWidth-4)x=window.innerWidth-tw-4;
      if(y<4){y=r.bottom+8;} // flip below if no space
      tip.style.left=x+'px'; tip.style.top=y+'px';
    });
    document.addEventListener('mouseout',function(e){
      if(e.target.closest('.mn'))tip.style.display='none';
    });
    // 모바일 터치 지원
    document.addEventListener('touchstart',function(e){
      var el=e.target.closest('.mn');
      if(!el){tip.style.display='none';return;}
      // 동일 로직 - mouseover 이벤트로 위임
      var ev=new MouseEvent('mouseover',{bubbles:true,clientX:e.touches[0].clientX,clientY:e.touches[0].clientY});
      el.dispatchEvent(ev);
    },{passive:true});

    load();
    if(tid)setInterval(load,20000); // 20초 간격 갱신 (15→20)
  </script>
</body>
</html>`
}

function getServiceWorkerJs(): string {
  return `// Service Worker for Push Notifications - 배드민턴 대회 운영 시스템
self.addEventListener('push', function(event) {
  var data = { title: '🏸 배드민턴 대회', body: '알림이 있습니다.', tag: 'default' };
  if (event.data) { try { data = event.data.json(); } catch(e) { data.body = event.data.text(); } }
  var options = {
    body: data.body || '', tag: data.tag || 'match-notification', renotify: true,
    vibrate: [200, 100, 200, 100, 300],
    data: { url: data.url || '/', matchId: data.matchId, courtNumber: data.courtNumber, tournamentId: data.tournamentId },
    actions: data.actions || [{ action: 'open', title: '확인하기' }, { action: 'dismiss', title: '닫기' }]
  };
  event.waitUntil(self.registration.showNotification(data.title || '🏸 배드민턴 대회', options));
});
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  var urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) { if (clientList[i].url.indexOf('/my') !== -1 && 'focus' in clientList[i]) return clientList[i].focus(); }
      return clients.openWindow(urlToOpen);
    })
  );
});
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(event) { event.waitUntil(clients.claim()); });
`
}

function getPrintHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🏸 대회 인쇄 센터 - 수기 운영 대비</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  /* ===== 기본 ===== */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif; background: #f3f4f6; color: #1a1a1a; }
  
  /* ===== 화면용 컨트롤 패널 ===== */
  .control-panel {
    position: sticky; top: 0; z-index: 100;
    background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
    color: #fff; padding: 16px 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .control-panel h1 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
  .control-panel h1 i { margin-right: 8px; }
  .control-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .ctrl-btn {
    padding: 8px 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 8px;
    background: rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
  }
  .ctrl-btn:hover { background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.6); }
  .ctrl-btn.active { background: #fff; color: #1e3a5f; border-color: #fff; }
  .ctrl-btn.print-btn { background: #f59e0b; border-color: #f59e0b; color: #000; font-weight: 800; }
  .ctrl-btn.print-btn:hover { background: #d97706; }
  .ctrl-label { font-size: 12px; color: rgba(255,255,255,0.7); margin-right: 4px; }
  .ctrl-select {
    padding: 6px 12px; border-radius: 6px; border: 2px solid rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 500;
  }
  .ctrl-select option { color: #000; background: #fff; }
  .loading-msg { text-align: center; padding: 60px; font-size: 18px; color: #666; }
  .error-msg { text-align: center; padding: 60px; font-size: 16px; color: #dc2626; }
  
  /* ===== 인쇄 영역 ===== */
  .print-area { padding: 20px; max-width: 210mm; margin: 0 auto; }
  .print-section { display: none; }
  .print-section.visible { display: block; }
  
  /* ===== A4 인쇄 공통 ===== */
  @page { size: A4; margin: 12mm 15mm; }
  @media print {
    body { background: #fff; }
    .control-panel { display: none !important; }
    .print-area { padding: 0; max-width: none; }
    .print-section { display: block !important; }
    .print-section:not(.visible) { display: none !important; }
    .page-break { page-break-before: always; break-before: page; }
  }
  
  /* ===== 인쇄용 테이블 ===== */
  .print-title {
    font-size: 18px; font-weight: 800; text-align: center; margin: 0 0 2mm 0;
    padding: 3mm 0; border-bottom: 3px solid #1e3a5f; color: #1e3a5f;
  }
  .print-subtitle { font-size: 11px; text-align: center; color: #666; margin-bottom: 4mm; }
  .print-table {
    width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 5mm;
  }
  .print-table th {
    background: #1e3a5f; color: #fff; padding: 2.5mm 3mm; font-weight: 600;
    font-size: 8.5pt; text-align: center; border: 0.5px solid #ccc;
  }
  .print-table td {
    padding: 2mm 3mm; border: 0.5px solid #ccc; text-align: center; font-size: 9pt;
  }
  .print-table tr:nth-child(even) td { background: #f8f9fa; }
  .print-table .left { text-align: left; }
  .print-table .checkbox-cell { width: 12mm; }
  .print-table .checkbox { display: inline-block; width: 4mm; height: 4mm; border: 1px solid #333; }
  
  .section-header {
    background: #e8edf3; padding: 2mm 4mm; font-weight: 700; font-size: 11pt;
    border-left: 4px solid #1e3a5f; margin: 4mm 0 2mm 0; color: #1e3a5f;
  }
  
  /* 점수 기록지 */
  .score-sheet { margin-bottom: 8mm; page-break-inside: avoid; }
  .score-sheet .match-header {
    display: flex; justify-content: space-between; align-items: center;
    background: #1e3a5f; color: #fff; padding: 2mm 4mm; font-size: 10pt; font-weight: 700;
  }
  .score-grid { width: 100%; border-collapse: collapse; }
  .score-grid th, .score-grid td {
    border: 1px solid #999; padding: 3mm 2mm; text-align: center; font-size: 10pt;
  }
  .score-grid th { background: #e8edf3; font-weight: 600; font-size: 9pt; }
  .score-grid .score-cell { height: 10mm; min-width: 14mm; }
  .score-grid .sig-cell { height: 14mm; min-width: 30mm; }
  .score-grid .team-name { text-align: left; padding-left: 3mm; font-weight: 600; min-width: 50mm; }
  
  /* 순위표 */
  .standing-table td.write-cell { height: 8mm; min-width: 12mm; background: #fffef0; }
  
  /* 결선 브래킷 */
  .bracket-container { display: flex; align-items: center; justify-content: center; gap: 5mm; margin: 5mm 0; }
  .bracket-round { display: flex; flex-direction: column; gap: 3mm; }
  .bracket-match {
    border: 1.5px solid #1e3a5f; border-radius: 2mm; overflow: hidden; min-width: 55mm;
  }
  .bracket-slot {
    padding: 2.5mm 3mm; font-size: 9pt; border-bottom: 1px solid #ddd;
    min-height: 8mm; display: flex; align-items: center;
  }
  .bracket-slot:last-child { border-bottom: none; }
  .bracket-slot .seed { color: #999; font-size: 8pt; margin-right: 2mm; min-width: 5mm; }
  .bracket-connector { width: 8mm; position: relative; }
  
  .info-footer {
    margin-top: 4mm; padding-top: 2mm; border-top: 1px solid #ddd;
    font-size: 8pt; color: #999; text-align: center;
  }
</style>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"></noscript>
</head>
<body>

<div class="control-panel">
  <h1><i class="fas fa-print"></i> 대회 인쇄 센터 — 수기 운영 대비</h1>
  <div class="control-row">
    <span class="ctrl-label">대회:</span>
    <select id="tid-select" class="ctrl-select" onchange="loadPrintData()">
      <option value="">대회를 선택하세요</option>
    </select>
    <span style="width:16px"></span>
    <span class="ctrl-label">인쇄 항목:</span>
    <button class="ctrl-btn active" data-section="participants" onclick="toggleSection(this)">① 참가자 명단</button>
    <button class="ctrl-btn active" data-section="teams" onclick="toggleSection(this)">② 팀 편성표</button>
    <button class="ctrl-btn active" data-section="matches" onclick="toggleSection(this)">③ 대진표</button>
    <button class="ctrl-btn active" data-section="scoresheet" onclick="toggleSection(this)">④ 점수 기록지</button>
    <button class="ctrl-btn active" data-section="standings" onclick="toggleSection(this)">⑤ 순위 집계표</button>
    <button class="ctrl-btn active" data-section="finals" onclick="toggleSection(this)">⑥ 결선 대진표</button>
    <span style="width:16px"></span>
    <button class="ctrl-btn print-btn" onclick="window.print()"><i class="fas fa-print"></i> 인쇄 / PDF 저장</button>
  </div>
</div>

<div class="print-area" id="print-area">
  <div class="loading-msg" id="loading-msg">⬆ 상단에서 대회를 선택하세요</div>
</div>

<script>
const CATEGORIES = { md: '남자복식', wd: '여자복식', xd: '혼합복식' };
const LEVELS = { s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' };
const AGE_LABELS = { open: '오픈', '20': '20대', '30': '30대', '40': '40대', '50': '50대', '55': '55대', '60': '60대' };

let state = { tournament: null, participants: [], events: [], matches: [], teams: {} };

async function api(path) {
  const res = await fetch('/api/tournaments' + path);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// 대회 목록 로드
(async function() {
  try {
    const d = await api('');
    const sel = document.getElementById('tid-select');
    const list = d.tournaments || d;
    list.forEach(t => {
      if (t.deleted) return;
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
    const params = new URLSearchParams(location.search);
    if (params.get('tid')) { sel.value = params.get('tid'); loadPrintData(); }
  } catch(e) { console.error(e); }
})();

async function loadPrintData() {
  const tid = document.getElementById('tid-select').value;
  if (!tid) return;
  const area = document.getElementById('print-area');
  area.innerHTML = '<div class="loading-msg"><i class="fas fa-spinner fa-spin"></i> 데이터 로드 중...</div>';
  
  try {
    // 통합 API 1회 호출로 모든 데이터 로드
    const d = await api('/' + tid + '/print-data');
    
    state.tournament = d.tournament;
    state.participants = (d.participants || []).filter(p => !p.deleted);
    state.events = d.events || [];
    state.matches = d.matches || [];
    state.teams = d.teamsByEvent || {};
    
    renderAll();
  } catch(e) {
    area.innerHTML = '<div class="error-msg"><i class="fas fa-exclamation-triangle"></i> 로드 실패: ' + e.message + '</div>';
  }
}

function toggleSection(btn) {
  btn.classList.toggle('active');
  const sec = btn.dataset.section;
  document.querySelectorAll('.ps-' + sec).forEach(el => el.classList.toggle('visible'));
}

function renderAll() {
  const t = state.tournament;
  const now = new Date().toLocaleDateString('ko-KR');
  let html = '';
  
  // ============================
  // ① 참가자 명단
  // ============================
  html += '<div class="print-section visible ps-participants">';
  html += '<div class="print-title">📋 참가자 명단</div>';
  html += '<div class="print-subtitle">' + t.name + ' | 총 ' + state.participants.length + '명 | 출력일: ' + now + '</div>';
  
  // 클럽별 그룹핑
  const byClub = {};
  state.participants.forEach(p => {
    const club = p.club || '무소속';
    if (!byClub[club]) byClub[club] = [];
    byClub[club].push(p);
  });
  const clubs = Object.keys(byClub).sort();
  
  let pNum = 1;
  clubs.forEach(club => {
    const members = byClub[club].sort((a,b) => a.name.localeCompare(b.name));
    html += '<div class="section-header">' + club + ' (' + members.length + '명)</div>';
    html += '<table class="print-table"><tr><th style="width:7%">번호</th><th style="width:15%">이름</th><th style="width:8%">성별</th><th style="width:10%">출생</th><th style="width:8%">급수</th><th style="width:12%">연락처</th><th class="checkbox-cell">체크인</th><th class="checkbox-cell">참가비</th></tr>';
    members.forEach(p => {
      html += '<tr><td>' + (pNum++) + '</td><td class="left"><strong>' + p.name + '</strong></td>';
      html += '<td>' + (p.gender === 'm' ? '남' : '여') + '</td>';
      html += '<td>' + (p.birth_year || '-') + '</td>';
      html += '<td><strong>' + (LEVELS[p.level] || '-') + '</strong>급</td>';
      html += '<td style="font-size:8pt">' + (p.phone || '-') + '</td>';
      html += '<td><span class="checkbox"></span></td>';
      html += '<td><span class="checkbox"></span></td></tr>';
    });
    html += '</table>';
  });
  html += '<div class="info-footer">※ 체크인/참가비 란에 ✓ 표시하세요. 네트워크 복구 후 시스템에 일괄 입력합니다.</div>';
  html += '</div>';
  
  // ============================
  // ② 종목별 팀 편성표
  // ============================
  html += '<div class="print-section visible ps-teams page-break">';
  html += '<div class="print-title">👥 종목별 팀 편성표</div>';
  html += '<div class="print-subtitle">' + t.name + ' | 출력일: ' + now + '</div>';
  
  state.events.forEach(ev => {
    const teams = state.teams[ev.id] || [];
    if (teams.length === 0) return;
    
    html += '<div class="section-header">' + ev.name + ' (' + teams.length + '팀)</div>';
    
    // 조별 그룹핑
    const byGroup = {};
    teams.forEach(tm => {
      const g = tm.group_num || 0;
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(tm);
    });
    
    for (const [gNum, gTeams] of Object.entries(byGroup)) {
      if (gNum !== '0') html += '<div style="font-weight:700; font-size:9.5pt; margin:2mm 0 1mm 2mm; color:#2563eb;">◆ ' + gNum + '조</div>';
      html += '<table class="print-table"><tr><th style="width:8%">팀번호</th><th style="width:22%">선수1</th><th style="width:8%">급수</th><th style="width:15%">소속</th><th style="width:22%">선수2</th><th style="width:8%">급수</th><th style="width:15%">소속</th></tr>';
      gTeams.forEach((tm, i) => {
        html += '<tr><td><strong>' + (i+1) + '</strong></td>';
        html += '<td class="left">' + (tm.p1_name || '-') + '</td><td>' + (LEVELS[tm.p1_level] || '-') + '</td><td class="left" style="font-size:8pt">' + (tm.p1_club || '-') + '</td>';
        html += '<td class="left">' + (tm.p2_name || '-') + '</td><td>' + (LEVELS[tm.p2_level] || '-') + '</td><td class="left" style="font-size:8pt">' + (tm.p2_club || '-') + '</td>';
        html += '</tr>';
      });
      html += '</table>';
    }
  });
  html += '</div>';
  
  // ============================
  // ③ 조별 대진표
  // ============================
  html += '<div class="print-section visible ps-matches page-break">';
  html += '<div class="print-title">🏸 조별 대진표</div>';
  html += '<div class="print-subtitle">' + t.name + ' | 코트 ' + (t.courts || 6) + '면 | 출력일: ' + now + '</div>';
  
  // 종목별 > 조별 그룹핑
  const matchesByEvent = {};
  state.matches.forEach(m => {
    if (!matchesByEvent[m.event_id]) matchesByEvent[m.event_id] = [];
    matchesByEvent[m.event_id].push(m);
  });
  
  let hasMatches = false;
  state.events.forEach(ev => {
    const evMatches = matchesByEvent[ev.id] || [];
    if (evMatches.length === 0) return;
    hasMatches = true;
    
    // 조별 그룹
    const byGroup = {};
    evMatches.forEach(m => {
      const g = m.group_num || 0;
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(m);
    });
    
    html += '<div class="section-header">' + ev.name + ' (' + evMatches.length + '경기)</div>';
    
    for (const [gNum, gMatches] of Object.entries(byGroup)) {
      gMatches.sort((a,b) => (a.round - b.round) || (a.match_order - b.match_order));
      if (gNum !== '0') html += '<div style="font-weight:600; font-size:9pt; margin:2mm 0 1mm 2mm; color:#2563eb;">◆ ' + gNum + '조</div>';
      html += '<table class="print-table"><tr><th style="width:6%">순번</th><th style="width:6%">R</th><th style="width:8%">코트</th><th style="width:32%">팀 A</th><th style="width:6%">vs</th><th style="width:32%">팀 B</th><th style="width:10%">승자</th></tr>';
      gMatches.forEach((m, i) => {
        const t1 = m.team1_name || ('팀' + m.team1_id);
        const t2 = m.team2_name || ('팀' + m.team2_id);
        html += '<tr><td>' + (i+1) + '</td><td>' + m.round + '</td><td>' + (m.court_number || '-') + '</td>';
        html += '<td class="left"><strong>' + t1 + '</strong></td><td>vs</td>';
        html += '<td class="left"><strong>' + t2 + '</strong></td>';
        html += '<td><span class="checkbox"></span></td></tr>';
      });
      html += '</table>';
    }
  });
  if (!hasMatches) {
    // 경기 미생성 시 빈 양식 제공
    state.events.forEach(ev => {
      const teams = state.teams[ev.id] || [];
      if (teams.length === 0) return;
      const byGroup = {};
      teams.forEach(tm => { const g = tm.group_num || 0; if (!byGroup[g]) byGroup[g] = []; byGroup[g].push(tm); });
      html += '<div class="section-header">' + ev.name + ' (경기 미생성 - 빈 양식)</div>';
      for (const [gNum, gTeams] of Object.entries(byGroup)) {
        if (gNum === '0') continue;
        const nTeams = gTeams.length;
        const nMatches = nTeams * (nTeams - 1) / 2;
        html += '<div style="font-weight:600; font-size:9pt; margin:2mm 0 1mm 2mm; color:#2563eb;">◆ ' + gNum + '조 (' + nTeams + '팀, ' + nMatches + '경기)</div>';
        html += '<table class="print-table"><tr><th style="width:6%">순번</th><th style="width:8%">코트</th><th style="width:34%">팀 A</th><th style="width:6%">vs</th><th style="width:34%">팀 B</th><th style="width:12%">승자</th></tr>';
        let mNum = 1;
        for (let a = 0; a < gTeams.length; a++) {
          for (let b = a + 1; b < gTeams.length; b++) {
            const t1 = gTeams[a].team_name || (gTeams[a].p1_name + ' · ' + gTeams[a].p2_name);
            const t2 = gTeams[b].team_name || (gTeams[b].p1_name + ' · ' + gTeams[b].p2_name);
            html += '<tr><td>' + (mNum++) + '</td><td class="write-cell"></td>';
            html += '<td class="left"><strong>' + t1 + '</strong></td><td>vs</td>';
            html += '<td class="left"><strong>' + t2 + '</strong></td>';
            html += '<td><span class="checkbox"></span></td></tr>';
          }
        }
        html += '</table>';
      }
    });
    html += '<div class="info-footer" style="color:#dc2626;">⚠ 시스템에서 경기가 아직 생성되지 않았습니다. 위 빈 양식에 직접 코트 배정과 승자를 기입하세요.</div>';
  } else {
    html += '<div class="info-footer">※ 승자 란에 A 또는 B를 기입하세요.</div>';
  }
  html += '</div>';
  
  // ============================
  // ④ 코트별 점수 기록지
  // ============================
  html += '<div class="print-section visible ps-scoresheet page-break">';
  html += '<div class="print-title">📝 점수 기록지</div>';
  html += '<div class="print-subtitle">' + t.name + ' | 출력일: ' + now + '</div>';
  
  // 코트별 그룹핑
  const matchesByCourt = {};
  state.matches.forEach(m => {
    const c = m.court_number || 0;
    if (!matchesByCourt[c]) matchesByCourt[c] = [];
    matchesByCourt[c].push(m);
  });
  
  const courts = Object.keys(matchesByCourt).sort((a,b) => a - b);
  if (courts.length > 0) {
    courts.forEach(courtNum => {
      const courtMatches = matchesByCourt[courtNum];
      courtMatches.sort((a,b) => (a.round - b.round) || (a.match_order - b.match_order));
      
      html += '<div class="section-header" style="margin-top:5mm">🏸 ' + courtNum + '번 코트 (' + courtMatches.length + '경기)</div>';
      
      courtMatches.forEach((m, i) => {
        const evName = (state.events.find(e => e.id === m.event_id) || {}).name || '';
        const t1 = m.team1_name || ('팀' + m.team1_id);
        const t2 = m.team2_name || ('팀' + m.team2_id);
        
        html += '<div class="score-sheet">';
        html += '<div class="match-header"><span>' + courtNum + '코트 #' + (i+1) + '</span><span>' + evName + '</span><span>R' + m.round + '</span></div>';
        html += '<table class="score-grid">';
        html += '<tr><th style="width:35%">팀</th><th>1세트</th><th>2세트</th><th>3세트</th><th style="width:12%">승</th><th style="width:18%">서명</th></tr>';
        html += '<tr><td class="team-name">' + t1 + '</td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="sig-cell"></td></tr>';
        html += '<tr><td class="team-name">' + t2 + '</td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="sig-cell"></td></tr>';
        html += '</table></div>';
      });
    });
    html += '<div class="info-footer">※ 각 세트 점수와 승자(◯)를 기입하고, 양팀 대표가 서명합니다. 네트워크 복구 후 시스템에 일괄 입력합니다.</div>';
  } else {
    // 경기 미생성 시 빈 점수 기록지 양식
    const numCourts = t.courts || 6;
    html += '<div style="text-align:center; padding:5mm; color:#666; font-size:10pt;">⚠ 시스템에서 경기가 아직 생성되지 않았습니다. 아래 빈 양식을 사용하세요.</div>';
    for (let c = 1; c <= numCourts; c++) {
      html += '<div class="section-header" style="margin-top:5mm">🏸 ' + c + '번 코트</div>';
      for (let g = 0; g < 5; g++) {
        html += '<div class="score-sheet">';
        html += '<div class="match-header"><span>' + c + '코트 #' + (g+1) + '</span><span>종목: ___________</span><span>___조</span></div>';
        html += '<table class="score-grid">';
        html += '<tr><th style="width:35%">팀</th><th>1세트</th><th>2세트</th><th>3세트</th><th style="width:12%">승</th><th style="width:18%">서명</th></tr>';
        html += '<tr><td class="team-name" style="height:10mm"></td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="sig-cell"></td></tr>';
        html += '<tr><td class="team-name" style="height:10mm"></td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="score-cell"></td><td class="sig-cell"></td></tr>';
        html += '</table></div>';
      }
    }
    html += '<div class="info-footer" style="color:#dc2626;">⚠ 빈 양식입니다. 팀명을 직접 기입하고 점수와 서명을 받으세요. 양식 부족 시 추가 인쇄하세요.</div>';
  }
  html += '</div>';
  
  // ============================
  // ⑤ 조별 순위 집계표
  // ============================
  html += '<div class="print-section visible ps-standings page-break">';
  html += '<div class="print-title">🏆 조별 순위 집계표</div>';
  html += '<div class="print-subtitle">' + t.name + ' | 출력일: ' + now + '</div>';
  
  state.events.forEach(ev => {
    const teams = state.teams[ev.id] || [];
    if (teams.length === 0) return;
    
    const byGroup = {};
    teams.forEach(tm => {
      const g = tm.group_num || 0;
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(tm);
    });
    
    html += '<div class="section-header">' + ev.name + '</div>';
    
    for (const [gNum, gTeams] of Object.entries(byGroup)) {
      const nTeams = gTeams.length;
      if (gNum !== '0') html += '<div style="font-weight:600; font-size:9pt; margin:2mm 0 1mm 2mm; color:#2563eb;">◆ ' + gNum + '조 (' + nTeams + '팀)</div>';
      html += '<table class="print-table standing-table"><tr><th style="width:5%">#</th><th style="width:28%">팀명</th><th style="width:9%">승</th><th style="width:9%">패</th><th style="width:10%">승점</th><th style="width:10%">득점</th><th style="width:10%">실점</th><th style="width:10%">득실차</th><th style="width:9%">순위</th></tr>';
      gTeams.forEach((tm, i) => {
        const name = tm.team_name || (tm.p1_name + ' · ' + tm.p2_name) || '팀';
        html += '<tr><td>' + (i+1) + '</td><td class="left"><strong>' + name + '</strong></td>';
        html += '<td class="write-cell"></td><td class="write-cell"></td><td class="write-cell"></td>';
        html += '<td class="write-cell"></td><td class="write-cell"></td><td class="write-cell"></td>';
        html += '<td class="write-cell"></td></tr>';
      });
      html += '</table>';
    }
  });
  html += '<div class="info-footer">※ 경기 결과를 기입하여 순위를 집계하세요. 승점: 승리 2점, 패배 0점. 동률 시 득실차 → 득점 순.</div>';
  html += '</div>';
  
  // ============================
  // ⑥ 결선 토너먼트 대진표 (빈 브래킷)
  // ============================
  html += '<div class="print-section visible ps-finals page-break">';
  html += '<div class="print-title">🥇 결선 토너먼트 대진표</div>';
  html += '<div class="print-subtitle">' + t.name + ' | 출력일: ' + now + '</div>';
  
  state.events.forEach(ev => {
    const teams = state.teams[ev.id] || [];
    if (teams.length === 0) return;
    
    // 조 수 파악
    const groupNums = [...new Set(teams.map(t => t.group_num || 0))].filter(g => g > 0);
    if (groupNums.length === 0) return;
    
    // 각 조 상위 2팀 기준 결선 슬롯
    const slots = groupNums.length * 2;
    const rounds = Math.ceil(Math.log2(slots));
    const bracketSize = Math.pow(2, rounds);
    
    html += '<div class="section-header">' + ev.name + ' 결선 (각 조 상위 2팀 → ' + bracketSize + '강)</div>';
    
    // 시드 배치 슬롯
    html += '<table class="print-table" style="max-width:160mm">';
    
    // 1라운드
    html += '<tr><th colspan="4" style="background:#2563eb">' + bracketSize + '강 (1라운드)</th><th colspan="3">' + (bracketSize/2) + '강 (2라운드)</th>';
    if (rounds >= 3) html += '<th colspan="2">준결승</th>';
    html += '<th>결승</th><th>우승</th></tr>';
    
    for (let i = 0; i < bracketSize / 2; i++) {
      const seedA = i + 1;
      const seedB = bracketSize - i;
      html += '<tr>';
      html += '<td style="width:5%;font-size:8pt;color:#999">' + seedA + '</td>';
      html += '<td class="left write-cell" style="width:28%;min-width:30mm">____조 ____위</td>';
      html += '<td style="width:5%">vs</td>';
      html += '<td class="left write-cell" style="width:28%;min-width:30mm">____조 ____위</td>';
      
      if (i % 2 === 0) {
        html += '<td class="write-cell" rowspan="2" style="width:22%"></td>';
        html += '<td rowspan="2" style="width:3%">vs</td>';
        html += '<td class="write-cell" rowspan="2" style="width:22%"></td>';
      }
      
      if (rounds >= 3 && i % 4 === 0) {
        html += '<td class="write-cell" rowspan="4"></td>';
        html += '<td class="write-cell" rowspan="4"></td>';
      }
      
      if (i === 0) {
        html += '<td class="write-cell" rowspan="' + (bracketSize/2) + '" style="background:#fffef0;font-weight:700;font-size:11pt;vertical-align:middle">🥇</td>';
        html += '<td class="write-cell" rowspan="' + (bracketSize/2) + '" style="vertical-align:middle;font-size:14pt">🏆</td>';
      }
      
      html += '</tr>';
    }
    html += '</table>';
    html += '<div style="font-size:8pt;color:#666;margin:1mm 0 4mm 0">※ 각 조 순위표에서 상위 2팀을 기입하세요. 같은 조 팀이 초반에 만나지 않도록 시드를 배치합니다.</div>';
  });
  html += '</div>';
  
  document.getElementById('print-area').innerHTML = html;
  
  // 현재 토글 상태 반영
  document.querySelectorAll('.ctrl-btn[data-section]').forEach(btn => {
    const sec = btn.dataset.section;
    const isActive = btn.classList.contains('active');
    document.querySelectorAll('.ps-' + sec).forEach(el => {
      if (isActive) el.classList.add('visible');
      else el.classList.remove('visible');
    });
  });
}
</script>
</body>
</html>`
}

