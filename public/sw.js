/**
 * Service Worker do Prumo (Fase 4 — PWA instalável).
 *
 * Estratégia:
 * - Navegação/HTML: network-first, com a cache como fallback offline. É o que
 *   garante que um deploy novo (landing nova, assets novos) apareça de
 *   imediato; cache-first no index.html prendia o utilizador na versão antiga.
 * - Assets estáticos com hash no nome: cache-first (imutáveis por definição).
 * - API (same-origin /api/*): network-only — nada de servir dados financeiros
 *   desatualizados; o offline-first do app já cobre isso com o estado local
 *   (LocalStorage) e a fila de sync.
 */

const CACHE_NAME = 'prumo-v4.1.0';
const APP_SHELL = ['/', '/index.html', '/favicon.png', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API: sempre rede (o app já é offline-first no cliente).
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.origin === self.location.origin) {
    const isNavigation =
      req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');

    // Navegação/HTML: rede primeiro, cache só como fallback offline.
    if (isNavigation) {
      event.respondWith(
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() =>
            caches
              .match(req)
              .then((cached) => cached || caches.match('/index.html'))
              .then((cached) => cached || Response.error())
          )
      );
      return;
    }

    // Assets com hash no nome: cache-first.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Cross-origin (fonts do Google etc.): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
