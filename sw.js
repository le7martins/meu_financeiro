const CACHE = 'mf-v1';
const SHELL = ['/meu_financeiro/', '/meu_financeiro/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/meu_financeiro/')))
  );
});

// Exibe notificação disparada pelo app principal
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/meu_financeiro/icon-192.png',
      badge: '/meu_financeiro/icon-192.png',
      vibrate: [200, 100, 200],
      renotify: false,
    });
  }
});

// Clique na notificação abre/foca o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/meu_financeiro/'));
      if (existing) return existing.focus();
      return clients.openWindow('/meu_financeiro/');
    })
  );
});
