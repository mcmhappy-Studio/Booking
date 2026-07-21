const CACHE = 'studio-booking-v3';
// Path-uri RELATIVE: aplicația e servită sub /Booking/, nu la rădăcina domeniului.
// Cu path-uri absolute ('/index.html') addAll dă 404 și instalarea SW eșuează complet.
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Fallback offline pentru navigare — relativ la scope-ul SW-ului
const OFFLINE_FALLBACK = new URL('./index.html', self.registration.scope).href;

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
      }).catch(() => caches.match(e.request).then(c => c || caches.match(OFFLINE_FALLBACK)))
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

// Tap pe notificare → aduce aplicația în față
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
    })
  );
});
