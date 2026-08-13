/**
 * Time-o-Learn — Menu page logic.
 * Plan §4.4 discipline: the entitlement/catalog check fires once per game
 * session — now specifically on the "Play" button inside an expanded card,
 * never on the initial expand tap (which is pure local UI state, no network
 * call at all). Play locks immediately, shows a loading state, and
 * re-enables only after load completes or errors. Result is session-cached
 * in memory (not localStorage).
 *
 * Tag filtering is OR/union logic: selecting multiple tags shows any game
 * that has AT LEAST ONE of the selected tags, not only games with all of
 * them. Tag identity for filtering uses the language-independent slug
 * (CATALOG.slugifyTag on the English label) so toggling EN/ID doesn't
 * reset an active filter selection.
 *
 * @format
 */

(function () {
  "use strict";

  var CONFIG = window.APP_CONFIG || {};
  var CLICK_DEBOUNCE_MS = 350;
  var sessionCache = {};

  var state = {
    games: [],
    groupFilter: "all",
    badgeFilter: "all",
    categoryFilter: "all",
    tagFilters: new Set(),
  };

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

  function gameDescription(game) {
    return I18N.getLang() === "id"
      ? game.descriptionId || game.description
      : game.description;
  }

  function gameTagLabels(game) {
    var lang = I18N.getLang();
    var list =
      (game.tags && (lang === "id" ? game.tags.id : game.tags.en)) || [];
    return list;
  }

  function buildCardHead(game) {
    var head = el("button", "game-card-toggle");
    head.type = "button";
    head.setAttribute("aria-expanded", "false");
    head.setAttribute(
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

    // Play overlay on header thumbnail (shown when expanded)
    var playOverlay = el("button", "game-card-play-overlay", "▶");
    playOverlay.type = "button";
    playOverlay.setAttribute("aria-label", I18N.t("game.play"));
    thumb.appendChild(playOverlay);

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

    var arrow = el("span", "game-arrow", "▾");

    head.appendChild(thumb);
    head.appendChild(info);
    head.appendChild(arrow);
    return { head: head, playBtn: playOverlay };
  }

  function buildCardExpanded(game) {
    var body = el("div", "game-card-expanded");
    body.hidden = true;

    var mediaWrap = el("div", "game-card-media");
    if (game.videoUrl) {
      var video = document.createElement("video");
      video.className = "game-card-video";
      video.src = game.videoUrl;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      mediaWrap.appendChild(video);
    } else if (game.thumb) {
      var img2 = document.createElement("img");
      img2.className = "game-card-media-img";
      img2.src = game.thumb;
      img2.alt = "";
      img2.loading = "lazy";
      mediaWrap.appendChild(img2);
    } else {
      mediaWrap.classList.add("game-card-media-fallback");
      mediaWrap.textContent = game.emoji || "🎮";
    }
    body.appendChild(mediaWrap);

    var tagLabels = gameTagLabels(game);
    if (tagLabels.length) {
      var tagRow = el("div", "game-card-tags");
      tagLabels.forEach(function (label) {
        tagRow.appendChild(el("span", "tag-pill", label));
      });
      body.appendChild(tagRow);
    }

    var desc = gameDescription(game);
    if (desc) {
      body.appendChild(el("p", "game-card-desc", desc));
    }

    // Play button is on the header thumbnail; find it from the toggle
    var head = body.previousElementSibling;
    var playBtn = head && head.querySelector(".game-card-play-overlay");

    return {
      body: body,
      playBtn: playBtn,
      video: mediaWrap.querySelector("video"),
    };
  }

  function buildCard(game) {
    var wrap = el("div", "game-card");
    wrap.setAttribute("data-game", game.id);

    var headParts = buildCardHead(game);
    var head = headParts.head;
    var expandedParts = buildCardExpanded(game);
    expandedParts.playBtn = headParts.playBtn;

    head.addEventListener("click", function () {
      var isOpen = head.getAttribute("aria-expanded") === "true";
      document
        .querySelectorAll(".game-card-toggle[aria-expanded='true']")
        .forEach(function (other) {
          if (other !== head) collapseCard(other);
        });
      if (isOpen) {
        collapseCard(head);
      } else {
        expandCard(head, expandedParts);
      }
    });

    expandedParts.playBtn.addEventListener("click", function () {
      openGame(game, expandedParts.playBtn, wrap);
    });

    wrap.appendChild(head);
    wrap.appendChild(expandedParts.body);
    return wrap;
  }

  function expandCard(head, parts) {
    head.setAttribute("aria-expanded", "true");
    parts.body.hidden = false;
    if (parts.video) {
      parts.video.preload = "auto";
      parts.video.play().catch(function () {});
    }
  }

  function collapseCard(head) {
    head.setAttribute("aria-expanded", "false");
    var wrap = head.closest(".game-card");
    var body = wrap && wrap.querySelector(".game-card-expanded");
    if (body) {
      body.hidden = true;
      var video = body.querySelector("video");
      if (video) video.pause();
    }
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
    if (state.tagFilters.size > 0) {
      var slugs = game.tagSlugs || [];
      var hasAny = slugs.some(function (s) {
        return state.tagFilters.has(s);
      });
      if (!hasAny) return false;
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
      grid.appendChild(buildCard(game));
    });
    updateNoResults(visible === 0);
  }

  function updateNoResults(hidden) {
    var msg = document.getElementById("no-results");
    if (!msg) return;
    msg.style.display = hidden ? "block" : "none";
  }

  function setGroup(group) {
    state.groupFilter = group;
    document
      .querySelectorAll(".content-tab[data-group]")
      .forEach(function (tab) {
        var active = tab.getAttribute("data-group") === group;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
    renderSidebar();
    renderTagChips();
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

  function toggleTagFilter(slug, chip) {
    if (state.tagFilters.has(slug)) {
      state.tagFilters.delete(slug);
      chip.classList.remove("active");
      chip.setAttribute("aria-pressed", "false");
    } else {
      state.tagFilters.add(slug);
      chip.classList.add("active");
      chip.setAttribute("aria-pressed", "true");
    }
    renderGrid();
  }

  function renderTagChips() {
    var bar = document.querySelector(".tag-bar");
    if (!bar) return;
    bar.innerHTML = "";

    var seen = {};
    state.games.forEach(function (g) {
      if (
        state.groupFilter !== "all" &&
        (g.contentGroup || "game") !== state.groupFilter
      )
        return;
      var labels = gameTagLabels(g);
      (g.tagSlugs || []).forEach(function (slug, i) {
        if (!seen[slug]) seen[slug] = labels[i] || slug;
      });
    });

    var slugs = Object.keys(seen).sort();
    if (slugs.length === 0) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;

    slugs.forEach(function (slug) {
      var chip = el("button", "filter-chip tag-chip", seen[slug]);
      chip.type = "button";
      chip.setAttribute(
        "aria-pressed",
        state.tagFilters.has(slug) ? "true" : "false",
      );
      if (state.tagFilters.has(slug)) chip.classList.add("active");
      chip.addEventListener("click", function () {
        toggleTagFilter(slug, chip);
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

  var lastClick = 0;

  function openGame(game, playBtn, cardWrap) {
    var now = Date.now();
    if (now - lastClick < CLICK_DEBOUNCE_MS) return;
    lastClick = now;
    if (!playBtn || playBtn.disabled) return;

    playBtn.disabled = true;
    cardWrap.classList.add("is-loading");
    playBtn.setAttribute("aria-busy", "true");

    checkAccess(game.id)
      .then(function (grant) {
        if (!grant.allowed) {
          playBtn.disabled = false;
          cardWrap.classList.remove("is-loading");
          playBtn.setAttribute("aria-busy", "false");
          return;
        }
        window.location.href = game.path;
      })
      .catch(function () {
        playBtn.disabled = false;
        cardWrap.classList.remove("is-loading");
        playBtn.setAttribute("aria-busy", "false");
      });
  }

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
        renderTagChips();
        renderGrid();
      }
    });
  }

  function boot() {
    I18N.initTheme();
    I18N.load()
      .then(function () {
        I18N.apply();
        bindLangToggle();
      })
      .catch(function () {
        bindLangToggle();
      });

    bindContentTabs();

    CATALOG.load()
      .then(function (result) {
        state.games = result.games;
        if (!result.online) showOfflineNote();
        hideError();
        setFilterChips();
        renderSidebar();
        renderTagChips();
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
