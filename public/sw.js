// Service Worker for Push Notifications
// 배드민턴 대회 운영 시스템 v2.3

// Push 알림 수신
self.addEventListener('push', function(event) {
  var data = { title: '🏸 배드민턴 대회', body: '알림이 있습니다.', tag: 'default' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }

  var options = {
    body: data.body || '',
    icon: data.icon || '/static/icon-192.png',
    badge: data.badge || '/static/icon-72.png',
    tag: data.tag || 'match-notification',
    renotify: true,
    vibrate: [200, 100, 200, 100, 300],
    data: {
      url: data.url || '/',
      matchId: data.matchId,
      courtNumber: data.courtNumber,
      tournamentId: data.tournamentId
    },
    actions: data.actions || [
      { action: 'open', title: '확인하기' },
      { action: 'dismiss', title: '닫기' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🏸 배드민턴 대회', options)
  );
});

// 알림 클릭 처리 — matchId 딥링크 + 하이라이트
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  var notifData = event.notification.data || {};
  var tid = notifData.tournamentId;
  var matchId = notifData.matchId;
  // 딥링크: matchId가 있으면 highlight 파라미터로 전달
  var urlToOpen = notifData.url || '/';
  if (matchId && urlToOpen.indexOf('highlight') === -1) {
    urlToOpen += (urlToOpen.indexOf('?') !== -1 ? '&' : '?') + 'highlight=' + matchId;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 이미 열린 /my 창이 있으면 URL 업데이트 + 포커스
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/my') !== -1 && 'focus' in client) {
          // 열린 창에 메시지 전송 → 프론트엔드에서 하이라이트 처리
          client.postMessage({
            type: 'MATCH_NOTIFICATION',
            matchId: matchId,
            courtNumber: notifData.courtNumber,
            tournamentId: tid
          });
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      return clients.openWindow(urlToOpen);
    })
  );
});

// 알림 닫기 이벤트 (분석용)
self.addEventListener('notificationclose', function(event) {});

// Service Worker 설치
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Service Worker 활성화
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
