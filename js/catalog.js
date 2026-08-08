/**
 * Time-o-Learn — Game catalog loader.
 * Plan §5.1/§5.4: /api/catalog (Vercel) returns only menu fields; on failure
 * falls back to cached last-known catalog in localStorage. A minimal static
 * seed keeps the menu functional on pure GitHub Pages with no Repo B yet.
 */
(function () {
  "use strict";

  var CONFIG = window.APP_CONFIG || {};
  var FALLBACK_CACHE_KEY = "tol_catalog_v1";

  var SEED = [
    {
      id: "snake",
      name: "Snake",
      nameId: "Ular",
      description: "Classic snake — grow by eating, don't hit the walls.",
      descriptionId: "Ular klasik — makan agar panjang, jangan menabrak dinding.",
      category: "classic",
      ageMin: 4,
      ageMax: 10,
      badge: "trial",
      path: "page/game-content/snake.html",
      emoji: "🐍",
      // No thumb yet — menu shows the emoji fallback (Phase 0).
      thumb: "",
      featured: true,
    },
  ];

  function normalize(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw
      .filter(function (g) {
        return g && g.id;
      })
      .map(function (g) {
        return {
          id: g.id,
          name: g.name || g.title_en || g.nameId || g.id,
          nameId: g.nameId || g.title_id || g.name || g.id,
          description: g.description || g.description_en || "",
          descriptionId: g.descriptionId || g.description_id || g.description || "",
          category: g.category || "other",
          ageMin: Number(g.ageMin) || 0,
          ageMax: Number(g.ageMax) || 99,
          badge: g.badge || "free",
          path: g.path || "page/game-content/" + g.id + ".html",
          emoji: g.emoji || "🎮",
          thumb: g.thumb || g.thumbnail || "",
          featured: !!g.featured,
        };
      });
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(FALLBACK_CACHE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function writeCache(games) {
    try {
      localStorage.setItem(FALLBACK_CACHE_KEY, JSON.stringify(games));
    } catch (e) {
      /* storage full/unavailable — ignore */
    }
  }

  function gamesAreEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
    }
    return true;
  }

  function fromApi() {
    var url = (CONFIG.apiBaseUrl || "").replace(/\/$/, "") + "/api/catalog";
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("catalog http " + res.status);
        return res.json();
      })
      .then(function (json) {
        var games = normalize(json.games || json);
        if (!games) throw new Error("catalog empty");
        var prev = readCache();
        if (!gamesAreEqual(prev, games)) writeCache(games);
        return { games: games, online: true };
      });
  }

  function fromSeed() {
    return { games: SEED, online: false };
  }

  function fromCache() {
    var games = readCache();
    return games ? { games: games, online: false } : null;
  }

  /** Load catalog: API → localStorage cache → static seed. */
  function load() {
    if (CONFIG.features && CONFIG.features.catalogCacheFallback === false) {
      return fromApi().catch(function () {
        return fromSeed();
      });
    }
    return fromApi().then(
      function (result) {
        return result;
      },
      function () {
        var cached = fromCache();
        return cached || fromSeed();
      }
    );
  }

  window.CATALOG = {
    load: load,
    seed: SEED,
  };
})();