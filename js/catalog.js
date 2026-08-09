/**
 * Time-o-Learn — Game catalog loader.
 * Plan §5.1/§5.4: /api/catalog (Vercel) returns only menu fields; on failure
 * falls back to cached last-known catalog in localStorage. A minimal static
 * seed keeps the menu functional on pure GitHub Pages with no Repo B yet.
 *
 * IMPORTANT: normalize() must match the REAL /api/catalog response shape
 * (see Repo B api/catalog.js shapeCatalog()):
 *   { id, title: {en, id}, description: {en, id}, thumbnail,
 *     ageRange, category, priceRental, priceCurrency, isFreeTrial,
 *     contentType }
 * badge and ageMin/ageMax are DERIVED here — the API does not send them.
 *
 * PATH CONVENTION (confirmed against the real repo tree):
 *   game            -> page/game-content/<id>/<id>.html
 *   book_interactive -> page/book-content/interactive/<id>/<id>.html
 *   book_static      -> page/book-content/static/<id>/<id>.html
 * This requires a `content_type` column on the Catalog sheet
 * (values: game | book_interactive | book_static). Existing game rows
 * (snake-stack, snake-block, matching-block, text-to-image) need this
 * column set to "game".
 *
 * @format
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
      descriptionId:
        "Ular klasik — makan agar panjang, jangan menabrak dinding.",
      category: "classic",
      contentType: "game",
      ageMin: 4,
      ageMax: 10,
      badge: "trial",
      path: "page/game-content/snake/index.html",
      emoji: "🐍",
      thumb: "",
      featured: true,
    },
  ];

  /** Derive a display badge from price/trial fields (API doesn't send one). */
  function deriveBadge(g) {
    if (g.isFreeTrial) return "trial";
    var price = Number(g.priceRental);
    if (!price || price <= 0) return "free";
    return "rental";
    // "subscription" badge is assigned by the Pricing-tab-driven all-access
    // flow, not per-game — not derivable from catalog rows alone.
  }

  /** Parse "4-7" -> {min:4, max:7}. Falls back to a wide-open range. */
  function parseAgeRange(rangeStr) {
    var m = String(rangeStr || "").match(/(\d+)\s*-\s*(\d+)/);
    if (!m) return { min: 0, max: 99 };
    return { min: Number(m[1]), max: Number(m[2]) };
  }

  /**
   * Path convention matching the real page/ tree. Every game/book folder
   * contains an index.html (standard convention — the folder name IS the
   * id, so the file doesn't need to repeat it):
   *   game             -> page/game-content/<id>/index.html
   *   book_interactive -> page/book-content/interactive/<id>/index.html
   *   book_static      -> page/book-content/static/<id>/index.html
   * Unknown/missing content_type defaults to "game" (today's only type).
   */
  function defaultPath(id, contentType) {
    switch (contentType) {
      case "book_interactive":
        return "page/book-content/interactive/" + id + "/index.html";
      case "book_static":
        return "page/book-content/static/" + id + "/index.html";
      case "game":
      default:
        return "page/game-content/" + id + "/index.html";
    }
  }

  /** Content-type label, used for menu section grouping. */
  function deriveContentGroup(contentType) {
    if (contentType === "book_interactive" || contentType === "book_static") {
      return "book";
    }
    return "game";
  }

  function normalize(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw
      .filter(function (g) {
        return g && g.id;
      })
      .map(function (g) {
        // Support BOTH the real API shape (title.en/title.id objects) and
        // the old flat-seed shape (name/nameId strings).
        var titleEn = (g.title && g.title.en) || g.name || g.id;
        var titleId = (g.title && g.title.id) || g.nameId || titleEn;
        var descEn =
          (g.description && g.description.en) ||
          (typeof g.description === "string" ? g.description : "") ||
          "";
        var descId =
          (g.description && g.description.id) || g.descriptionId || descEn;

        var ages = g.ageRange
          ? parseAgeRange(g.ageRange)
          : { min: Number(g.ageMin) || 0, max: Number(g.ageMax) || 99 };

        var contentType = g.contentType || g.content_type || "game";

        return {
          id: g.id,
          name: titleEn,
          nameId: titleId,
          description: descEn,
          descriptionId: descId,
          category: g.category || "other",
          contentType: contentType,
          contentGroup: deriveContentGroup(contentType),
          ageMin: ages.min,
          ageMax: ages.max,
          badge: g.badge || deriveBadge(g),
          priceRental: Number(g.priceRental) || 0,
          priceCurrency: g.priceCurrency || "IDR",
          path: g.path || defaultPath(g.id, contentType),
          emoji:
            g.emoji ||
            (deriveContentGroup(contentType) === "book" ? "📖" : "🎮"),
          thumb: g.thumb || g.thumbnail || "",
          featured: !!g.featured || !!g.isFreeTrial,
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
      },
    );
  }

  window.CATALOG = {
    load: load,
    seed: SEED,
    _normalize: normalize,
    _deriveBadge: deriveBadge,
    _parseAgeRange: parseAgeRange,
    _defaultPath: defaultPath,
  };
})();
