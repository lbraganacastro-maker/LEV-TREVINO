/* Service worker: permite abrir la app sin señal */
var CACHE = "levantamiento-v1";
var BASE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(BASE); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
function guardar(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    var c = res.clone();
    caches.open(CACHE).then(function (x) { x.put(req, c); });
  }
  return res;
}
function conTiempo(p, ms) {
  return new Promise(function (ok, no) {
    var t = setTimeout(function () { no(new Error("timeout")); }, ms);
    p.then(function (r) { clearTimeout(t); ok(r); }, function (e) { clearTimeout(t); no(e); });
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.hostname.indexOf("script.google") >= 0 || url.hostname.indexOf("script.googleusercontent") >= 0) return;

  if (url.origin === self.location.origin) {
    // Archivos de la app: primero internet (para recibir actualizaciones), si no hay, la copia guardada
    e.respondWith(
      conTiempo(fetch(req), 4000).then(function (r) { return guardar(req, r); })
        .catch(function () {
          return caches.match(req).then(function (r) { return r || caches.match("./index.html"); });
        })
    );
    return;
  }
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|lh3\.googleusercontent\.com/.test(url.hostname)) {
    // Fuentes, lector de códigos y miniaturas: usar copia guardada si existe
    e.respondWith(
      caches.match(req).then(function (r) {
        return r || fetch(req).then(function (res) { return guardar(req, res); });
      })
    );
  }
});
