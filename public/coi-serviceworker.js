/* coi-serviceworker — SharedArrayBuffer 활성화용 서비스 워커
 * 출처: https://github.com/gzuidhof/coi-serviceworker (MIT License)
 * 핵심: 같은 출처(localhost) 응답에만 COOP/COEP 헤더 추가
 * 외부 요청(Firebase Storage, CDN 등)은 간섭하지 않음
 */

if (typeof window === 'undefined') {
  // ── 서비스 워커 스코프 ──────────────────────────────────────────────────
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 같은 출처(localhost) 요청만 처리 — Firebase Storage/CDN은 건드리지 않음
    if (url.origin !== self.location.origin) return;
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.status === 0) return response;
          const newHeaders = new Headers(response.headers);
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
          newHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch(() => fetch(req)) // 실패 시 원래 요청으로 폴백
    );
  });
} else {
  // ── 메인 스레드 — 서비스 워커 등록 ────────────────────────────────────
  (() => {
    if (window.crossOriginIsolated) return; // 이미 활성화됨
    if (!window.isSecureContext) return;

    navigator.serviceWorker
      .register('/coi-serviceworker.js')
      .then(() => {
        if (!navigator.serviceWorker.controller) {
          window.location.reload();
        }
      })
      .catch((e) => console.warn('[coi-sw] 등록 실패:', e));
  })();
}
