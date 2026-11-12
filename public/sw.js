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
// - Navegação: rede primeiro; guarda a página mais recente para abrir offline.
// - /assets/* (nome com hash, imutável): cache primeiro, preenchido conforme o uso.
// - Demais arquivos do app (ícones, manifest): rede primeiro, cache como reserva.
// - Outras origens (Firebase, fontes, gstatic) e métodos não-GET passam direto: o SDK precisa do erro de rede real.
const CACHE = 'mf-v4';
const BASE = '/meu_financeiro/';
const SHELL = [BASE, BASE + 'index.html', BASE + 'badge-96.png', BASE + 'icon-192.png'];
const MAX_ENTRIES = 120;

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

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map(k => cache.delete(k)));
}

// O clone precisa ser feito antes de qualquer await: depois o navegador já está lendo o corpo da resposta.
function put(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  const copy = response.clone();
  caches.open(CACHE)
    .then(cache => cache.put(request, copy).then(() => trim(cache)))
    .catch(() => {});
}

async function networkFirst(request, fallbackKey) {
  try {
    const response = await fetch(request);
    put(fallbackKey || request, response);
    return response;
  } catch (err) {
    const cached = await caches.match(fallbackKey || request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  put(request, response);
  return response;
}

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    e.respondWith(networkFirst(request, BASE));
  } else if (url.pathname.startsWith(BASE + 'assets/')) {
    e.respondWith(cacheFirst(request));
  } else {
    e.respondWith(networkFirst(request));
  }
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
