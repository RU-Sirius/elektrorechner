// Offline-Cache. Bei Änderungen an den Dateien die Versionsnummer erhöhen.
const CACHE = "elektrorechner-v5";
const FILES = ["index.html", "style.css", "app.js", "calc.js", "ui.js", "tools.js", "manifest.webmanifest",
               "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Zuerst Netz (für Updates), bei Offline oder Fehler der Cache.
// Seitenaufrufe (auch ".../elektro-rechner/") fallen immer auf index.html zurück.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const isPage = e.request.mode === "navigate";
  e.respondWith(
    // no-cache: immer beim Server nachfragen (ETag), nie veraltete Browser-Kopie nutzen
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status);
        if (!isPage) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => isPage ? caches.match("index.html")
                          : caches.match(e.request, { ignoreSearch: true }))
  );
});
