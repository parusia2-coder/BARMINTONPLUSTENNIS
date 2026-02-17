// Service Worker for Push Notifications
// 배드민턴 대회 운영 시스템

const CACHE_NAME = 'badminton-v1';

// Push 알림 수신
self.addEventListener('push', function(event) {
  let data = { title: '🏸 배드민턴 대회', body: '알림이 있습니다.', tag: 'default' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }

  const options = {
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

// 알림 클릭 처리
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 이미 열린 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes('/my') && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      return clients.openWindow(urlToOpen);
    })
  );
});

// 알림 닫기 이벤트
self.addEventListener('notificationclose', function(event) {
  // 분석용: 알림 닫기 추적 가능
});

// Service Worker 설치
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Service Worker 활성화
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
