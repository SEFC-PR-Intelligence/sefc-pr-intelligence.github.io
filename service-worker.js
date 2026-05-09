// SEFC Matchday Intelligence - Service Worker
// 오프라인 작동을 위한 캐싱 전략

const CACHE_VERSION = 'sefc-v1';
const CACHE_NAME = `sefc-cache-${CACHE_VERSION}`;

// 앱 셸 — 첫 설치 시 캐시할 파일들
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// 설치 — 앱 셸 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        // 일부 파일(예: 아이콘) 누락 시에도 설치 진행
        console.warn('[SW] 일부 파일 캐싱 실패:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 활성화 — 옛 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// fetch — 캐시 우선, 없으면 네트워크
self.addEventListener('fetch', (event) => {
  // GET 요청만 처리
  if (event.request.method !== 'GET') return;
  
  // 같은 출처(origin) 요청만 처리
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // 캐시 있으면 즉시 반환 + 백그라운드에서 업데이트
        fetch(event.request).then((fresh) => {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, fresh.clone());
            });
          }
        }).catch(() => {/* 오프라인이면 무시 */});
        return cached;
      }
      
      // 캐시 없으면 네트워크 시도
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // 네트워크 실패 + 캐시도 없음 → 오프라인 폴백
        return caches.match('./index.html');
      });
    })
  );
});
