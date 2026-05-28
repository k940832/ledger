/**
 * service-worker.js — 記帳本 PWA 離線快取
 * 策略：
 *  - 對 static asset 採 cache-first，fallback 到 network 再寫回快取
 *  - 對 Apps Script / Google API 請求一律走 network（不快取，不擋）
 *  - 換版本時 activate 階段清掉舊 cache
 */

const CACHE_NAME = 'ledger-v1.5.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 只快取 GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Apps Script / Google 同步請求直接走網路，不快取
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('script.googleusercontent.com')
  ) {
    return;
  }

  // 只處理同源資源（避免攔截到第三方）
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
