const APP_ID = "sidehop";
const VERSION = "v00000-001";
const CACHE = APP_ID + "-" + VERSION;
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./og.png",
  "./assets/logo.png",
  "./css/style.css",
  "./js/main.js",
  "./js/storage/sidehop-format.js",
  "./js/storage/storage.js",
  "./js/audio/sound.js",
  "./js/recorder/recorder.js",
  "./js/engine/entities.js",
  "./js/engine/camera.js",
  "./js/engine/physics.js",
  "./js/editor/inspector.js",
  "./js/editor/paint.js",
  "./js/editor/grid.js",
  "./js/editor/history.js"
];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache, so a release never installs a stale index.html
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener("activate", e => {
  // Delete only THIS app's old caches
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith(APP_ID + "-") && k !== CACHE)
    .map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then(hit => hit || fetch(e.request)));
});
