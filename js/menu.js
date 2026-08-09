/**
 * Time-o-Learn — Menu page logic.
 * Plan §4.4 discipline: the entitlement/catalog check fires once per game
 * session (on open), never per in-game interaction. Cards lock immediately on
 * click, show a loading state, and re-enable only after load completes or
 * errors. Result is session-cached in memory (not localStorage).
 *
 * Adds content-type grouping (Games / Storybooks / All) above the existing
 * badge/category filters, per the index.html redesign.
 *
 * @format
 */

(function () {
  "use strict";

  var CONFIG = window.APP_CONFIG || {};
  var CLICK_DEBOUNCE_MS = 350;
  var sessionCache = {}; // in-memory only — never persisted

  var state = {
    games: [],
    groupFilter: "all", // "all" | "game" | "book"
    badgeFilter: "all",
    categoryFilter: "all",
  };

  /* ---------- Entitlement (mock — Repo B later) ---------- */
  function checkAccess(gameId) {
    if (sessionCache.hasOwnProperty(gameId)) {
      return Promise.resolve(sessionCache[gameId]);
    }
    var allowed =
      CONFIG.features && CONFIG.features.mockEntitlement === false
        ? false
        : true;
    var grant = { allowed: allowed, source: "mock" };
    sessionCache[gameId] = grant;
    return Promise.resolve(grant);
  }

  /* ---------- Rendering ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function badgeLabel(badge) {
    return I18N.t("menu.badge." + (badge || "free"));
  }

  function gameName(game) {
    return I18N.getLang() === "id" ? game.nameId || game.name : game.name;
  }

  function buildCard(game) {
    var card = el("button", "game-card");
    card.type = "button";
    card.setAttribute("data-game", game.id);
    card.setAttribute(
      "aria-label",
      gameName(game) + " — " + badgeLabel(game.badge),
    );

    var thumb = el("span", "game-thumb");
    if (game.thumb) {
      var img = document.createElement("img");
      img.src = game.thumb;
      img.alt = "";
      img.loading = "lazy";
      img.width = 128;
      img.height = 128;
      img.decoding = "async";
      img.addEventListener("error", function () {
        img.remove();
        thumb.classList.add("game-thumb-fallback");
        thumb.textContent = game.emoji || "🎮";
      });
      thumb.appendChild(img);
    } else {
      thumb.textContent = game.emoji || "🎮";
    }

    var info = el("div", "game-info");
    info.appendChild(el("div", "game-name", gameName(game)));
    var meta = el("div", "game-meta");
    meta.appendChild(
      el(
        "span",
        "badge badge-" + (game.badge || "free"),
        badgeLabel(game.badge),
      ),
    );
    var ages = game.ageMin + "–" + game.ageMax;
    meta.appendChild(
      el("span", "game-ages", ages + " " + I18N.t("menu.years")),
    );
    info.appendChild(meta);

    var arrow = el("span", "game-arrow", "→");

    card.appendChild(thumb);
    card.appendChild(info);
    card.appendChild(arrow);
    return card;
  }

  function matchesFilters(game) {
    if (
      state.groupFilter !== "all" &&
      (game.contentGroup || "game") !== state.groupFilter
    ) {
      return false;
    }
    if (
      state.badgeFilter !== "all" &&
      (game.badge || "free") !== state.badgeFilter
    ) {
      return false;
    }
    if (
      state.categoryFilter !== "all" &&
      game.category !== state.categoryFilter
    ) {
      return false;
    }
    return true;
  }

  function renderGrid() {
    var grid = document.getElementById("game-grid");
    if (!grid) return;
    grid.innerHTML = "";
    var visible = 0;
    state.games.forEach(function (game) {
      if (!matchesFilters(game)) return;
      visible++;
      var card = buildCard(game);
      card.addEventListener("click", function () {
        openGame(game, card);
      });
      grid.appendChild(card);
    });
    updateNoResults(visible === 0);
  }

  function updateNoResults(hidden) {
    var msg = document.getElementById("no-results");
    if (!msg) return;
    msg.style.display = hidden ? "block" : "none";
  }

  /* ---------- Content-type tabs (Games / Storybooks / All) ---------- */
  function setGroup(group) {
    state.groupFilter = group;
    document
      .querySelectorAll(".content-tab[data-group]")
      .forEach(function (tab) {
        var active = tab.getAttribute("data-group") === group;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
    // Category sidebar/relevance depends on group — rebuild it.
    renderSidebar();
    renderGrid();
  }

  function bindContentTabs() {
    document
      .querySelectorAll(".content-tab[data-group]")
      .forEach(function (tab) {
        tab.setAttribute("role", "tab");
        tab.setAttribute(
          "aria-selected",
          tab.classList.contains("active") ? "true" : "false",
        );
        tab.addEventListener("click", function () {
          setGroup(tab.getAttribute("data-group"));
        });
      });
  }

  function setFilterBadge(badge) {
    state.badgeFilter = badge;
    document
      .querySelectorAll(".filter-chip[data-badge]")
      .forEach(function (chip) {
        chip.classList.toggle(
          "active",
          chip.getAttribute("data-badge") === badge,
        );
      });
    renderGrid();
  }

  function setCategory(cat) {
    state.categoryFilter = cat;
    document
      .querySelectorAll(".sidebar-chip[data-category]")
      .forEach(function (chip) {
        chip.classList.toggle(
          "active",
          chip.getAttribute("data-category") === cat,
        );
      });
    renderGrid();
  }

  function setFilterChips() {
    var badges = ["all", "free", "trial", "rental", "subscription"];
    var bar = document.querySelector(".filter-bar");
    if (!bar) return;
    bar.innerHTML = "";
    badges.forEach(function (badge) {
      var chip = el("button", "filter-chip", I18N.t("menu.filter." + badge));
      chip.type = "button";
      chip.setAttribute("data-badge", badge);
      if (badge === state.badgeFilter) chip.classList.add("active");
      chip.addEventListener("click", function () {
        setFilterBadge(badge);
      });
      bar.appendChild(chip);
    });
  }

  function renderSidebar() {
    var existing = document.querySelector(".sidebar-filters");
    if (!existing) return;
    var cats = {};
    state.games.forEach(function (g) {
      if (
        state.groupFilter !== "all" &&
        (g.contentGroup || "game") !== state.groupFilter
      )
        return;
      var cat = g.category || "other";
      cats[cat] = (cats[cat] || 0) + 1;
    });
    var list = el("div", "sidebar-filters");
    list.setAttribute("aria-label", "Categories");
    list.appendChild(el("p", "sidebar-title", I18N.t("menu.category")));
    Object.keys(cats)
      .sort()
      .forEach(function (cat) {
        var chip = el(
          "button",
          "sidebar-chip",
          I18N.t("menu.cat." + cat) + " (" + cats[cat] + ")",
        );
        chip.type = "button";
        chip.setAttribute("data-category", cat);
        if (cat === state.categoryFilter) chip.classList.add("active");
        chip.addEventListener("click", function () {
          setCategory(cat);
        });
        list.appendChild(chip);
      });
    existing.replaceWith(list);
  }

  /* ---------- Open game (§4.4 discipline) ---------- */
  var lastClick = 0;

  function openGame(game, card) {
    var now = Date.now();
    if (now - lastClick < CLICK_DEBOUNCE_MS) return; // cheap backstop
    lastClick = now;
    if (!card || card.disabled) return;

    card.disabled = true; // lock immediately
    card.classList.add("is-loading");
    card.setAttribute("aria-busy", "true");

    checkAccess(game.id)
      .then(function (grant) {
        if (!grant.allowed) {
          // Later phase: open checkout/payment modal here.
          card.disabled = false;
          card.classList.remove("is-loading");
          card.setAttribute("aria-busy", "false");
          return;
        }
        window.location.href = game.path;
      })
      .catch(function () {
        card.disabled = false;
        card.classList.remove("is-loading");
        card.setAttribute("aria-busy", "false");
      });
  }

  /* ---------- States ---------- */
  function showError(online) {
    var msg = document.getElementById("load-error");
    if (!msg) return;
    msg.style.display = "block";
    var btn = msg.querySelector(".retry-btn");
    if (btn)
      btn.addEventListener("click", function () {
        location.reload();
      });
    if (!online) {
      var note = document.getElementById("offline-note");
      if (note) note.classList.add("visible");
    }
  }

  function hideError() {
    var msg = document.getElementById("load-error");
    if (msg) msg.style.display = "none";
  }

  function showOfflineNote() {
    var note = document.getElementById("offline-note");
    if (note) note.classList.add("visible");
  }

  /* ---------- Boot ---------- */
  function bindLangToggle() {
    var toggle = document.getElementById("lang-toggle");
    if (!toggle) return;
    toggle.querySelector(".lang-code").textContent =
      I18N.getLang().toUpperCase();
    toggle.addEventListener("click", function () {
      var next = I18N.toggle();
      toggle.querySelector(".lang-code").textContent = next.toUpperCase();
      if (state.games.length) {
        setFilterChips();
        renderSidebar();
        renderGrid();
      }
    });
  }

  function boot() {
    I18N.initTheme();
    I18N.load()
      .then(function () {
        I18N.apply(); // static chrome (hero, footer, no-results, etc.)
        bindLangToggle();
      })
      .catch(function () {
        bindLangToggle(); // still allow toggle even if dicts fail
      });

    bindContentTabs();

    CATALOG.load()
      .then(function (result) {
        state.games = result.games;
        if (!result.online) showOfflineNote();
        hideError();
        setFilterChips();
        renderSidebar();
        renderGrid();
        document.body.classList.add("menu-ready");
      })
      .catch(function () {
        showError(false);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
