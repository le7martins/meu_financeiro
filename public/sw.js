// ─── Firebase Messaging (background push) ────────────────────
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBGTj0GO5afkhAvZgT03mWAJqvkil8vnIA",
  authDomain:        "meu-financeiro-13919.firebaseapp.com",
  projectId:         "meu-financeiro-13919",
  storageBucket:     "meu-financeiro-13919.firebasestorage.app",
  messagingSenderId: "350978430463",
  appId:             "1:350978430463:web:f27515f6fd9d3f35e243ca",
});

const messaging = firebase.messaging();

// Notificação recebida com app fechado/background
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  if (!title) return;
  self.registration.showNotification(title, {
    body,
    icon:    '/meu_financeiro/icon-192.png',
    badge:   '/meu_financeiro/badge-96.png',
    vibrate: [200, 100, 200],
    tag:     payload.data?.tag || 'mf-notif',
    data:    payload.data || {},
  });
});

// ─── Cache / PWA ─────────────────────────────────────────────
const CACHE = 'mf-v3';
const SHELL = ['/meu_financeiro/', '/meu_financeiro/index.html', '/meu_financeiro/badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || caches.match('/meu_financeiro/'))
    )
  );
});

// Mensagem do app principal (notificação manual)
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body, tag,
      icon:    '/meu_financeiro/icon-192.png',
      badge:   '/meu_financeiro/badge-96.png',
      vibrate: [200, 100, 200],
    });
  }
});

// Clique na notificação → abre/foca o app
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
