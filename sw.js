/**
 * Time-o-Learn — app-shell service worker (plan §5.4).
 * Caches ONLY the menu shell (HTML/CSS/JS/i18n/config). Never caches
 * game content (page/) or API responses (api/) — games load on demand
 * via the network, API data is cached client-side in localStorage.
 * Network-first for navigation so fresh deploys propagate quickly,
 * with cache fallback so a repeat visit on spotty data still renders.
 */
"use strict";

var CACHE = "tol-shell-v1";
var CORE = [
  "./",
  "./index.html",
  "./css/tokens.css",
  "./css/menu.css",
  "./js/i18n.js",
  "./js/catalog.js",
  "./js/menu.js",
  "./other/config.js",
  "./other/i18n/en.json",
  "./other/i18n/id.json",
];

/* Install: fetch each core asset and cache it best-effort. */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        CORE.map(function (url) {
          return fetch(url, { cache: "no-cache" })
            .then(function (res) {
              if (res.ok) cache.put(url, res);
            })
            .catch(function () {
              /* offline install — skip, activate anyway */
            });
        })
      );
    })
  );
  self.skipWaiting();
});

/* Activate: drop caches from older versions. */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/* Fetch: navigation network-first w/ cache fallback; shell assets
   cache-first; page/ (games) and api/ always network (never cached). */
self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put("./index.html", copy);
          });
          return res;
        })
        .catch(function () {
          return caches.match("./index.html");
        })
    );
    return;
  }

  if (url.pathname.indexOf("/page/") !== -1) return; // games: network only
  if (url.pathname.indexOf("/api/") !== -1) return; // API: network only

  event.respondWith(
    caches.match(request).then(function (hit) {
      return (
        hit ||
        fetch(request).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(request, copy);
            });
          }
          return res;
        })
      );
    })
  );
});