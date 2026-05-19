const CACHE = 'studio-booking-v2';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Helper: detectează request-uri pentru HTML/navigare (care trebuie să fie mereu proaspete)
function isHtmlRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  const url = new URL(req.url);
  if (url.pathname.endsWith('.html') || url.pathname === '/') return true;
  return false;
}

self.addEventListener('fetch', e => {
  // Skip non-GET și cereri către Firebase/Google (lăsăm să meargă direct)
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // doar same-origin (skip Firebase, Maps, etc.)

  if (isHtmlRequest(e.request)) {
    // NETWORK-FIRST pentru HTML: ia mereu versiunea fresh, cache doar ca fallback offline
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
    );
  } else {
    // CACHE-FIRST pentru assets (iconițe, manifest, sw.js) — sunt statice
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
});
