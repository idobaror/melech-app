// Service worker — מטמון לקבצי האפליקציה בלבד (לא לנתונים).
// אסטרטגיה: רשת קודם, ומטמון רק כשאין אינטרנט — כך עדכונים מגיעים מיד.
const CACHE = 'melech-v4';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'pages.js', 'pages2.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'assets/bg.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // רק קבצים מאותו אתר ובקשות GET; קריאות API (POST ל-Google) עוברות ישר
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // no-cache: תמיד בודקים מול השרת אם יש גרסה חדשה (GitHub שומר קבצים 10 דקות) — עדכונים מגיעים מיד
    fetch(new Request(e.request, { cache: 'no-cache' }))
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
