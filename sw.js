// Keeps the app itself on the phone so it opens with no internet.
const CACHE = 'nameplate-v18';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
// Excel tool used for "Export Excel"; saved on the phone so export also works offline.
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).then(() => c.add(XLSX_URL).catch(() => {})))
      .then(() => self.skipWaiting())
  );
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
  const url = new URL(e.request.url);

  // Excel tool: use the saved copy first, fetch and save it if missing.
  if (e.request.url === XLSX_URL) {
    e.respondWith(
      caches.match(XLSX_URL).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(XLSX_URL, copy)); }
        return r;
      }))
    );
    return;
  }

  // Text-reading (OCR) files from the CDN: saved after the first use so they work offline later.
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'tessdata.projectnaptha.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      }))
    );
    return;
  }

  // Own files: try the network first (so updates arrive), fall back to the saved copy offline.
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
