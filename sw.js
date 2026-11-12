// Service worker: guarda la app para abrirla sin señal y muestra notificaciones.
const CACHE = "ucb-events-v10";
const ARCHIVOS = ["./", "index.html", "styles.css", "datos.js", "ruteo.js", "app.js", "qrcode.js",
  "leaflet.css", "leaflet.js", "maplibre-gl.css", "maplibre-gl.js", "leaflet-maplibre-gl.js", "plano-campus.png", "mapa-campus-completo.png", "manifest.webmanifest", "icono-192.png", "logo.png", "icono-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes("tiles.openfreemap.org"))) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
self.addEventListener("notificationclick", e => { e.notification.close(); e.waitUntil(self.clients.openWindow((e.notification.data && e.notification.data.url) || "./")); });
