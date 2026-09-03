// Cachea el armazón para que la app abra sin conexión.
// Solo se registra sobre https (o localhost); sobre http en la red local la app
// funciona igual, nada más que sin caché offline.

const CACHE = 'rutina-v9';
const ARCHIVOS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icon.svg', './icon-180.png', './icon-512.png',
  './fonts/archivo-latin.woff2', './fonts/archivo-latin-ext.woff2',
  './src/app.js', './src/db.js', './src/data.js', './src/ui.js', './src/session.js', './src/icons.js',
  './src/charts.js', './src/musculos.js', './src/s-inicio.js', './src/s-entrenar.js', './src/s-plantillas.js',
  './src/s-historial.js', './src/s-progreso.js', './src/s-datos.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache:'reload' es obligatorio: addAll() usa el caché HTTP del navegador y
    // termina instalando archivos viejos, dejando una versión mezclada.
    // Además cada archivo va por separado, así uno que falle no tumba la instalación.
    await Promise.all(ARCHIVOS.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { cache: 'reload' }));
        if (res.ok) await c.put(u, res);
      } catch { /* si falta uno, se resuelve por red en el fetch */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // la tipografía va por la red
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
