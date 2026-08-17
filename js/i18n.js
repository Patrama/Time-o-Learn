/**
 * Time-o-Learn — i18n loader + language toggle.
 * Plan §6: flat JSON dictionaries, browser detection on first visit,
 * stored in localStorage, manual toggle always available.
 */
(function () {
  "use strict";

  var CONFIG = window.APP_CONFIG || {
    supportedLanguages: ["en", "id"],
  };

  var STORAGE_KEY = "tol_lang";
  var THEME_KEY = "tol_theme";
  var dicts = {};
  var current = null;
  var listeners = [];

  function normalize(code) {
    return String(code || "").toLowerCase().split("-")[0];
  }

  function detect() {
    var nav = navigator.language || navigator.userLanguage || "en";
    var code = normalize(nav);
    return CONFIG.supportedLanguages.indexOf(code) !== -1
      ? code
      : CONFIG.supportedLanguages[0];
  }

  function getLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch (e) {
      /* storage unavailable — fall through */
    }
    return detect();
  }

  function setLang(code, persist) {
    current = code;
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch (e) {
        /* ignore */
      }
    }
    document.documentElement.lang = code + "-" + code.toUpperCase();
  }

  function nested(root, key) {
    var parts = String(key).split(".");
    var node = root;
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  /** Translate a dotted key, falling back to 'en' then the key itself. */
  function t(key, vars) {
    var value = nested(dicts[current], key);
    if (value === undefined && current !== "en") {
      value = nested(dicts.en, key);
    }
    if (value === undefined) return key;
    if (vars) {
      value = String(value).replace(/\{(\w+)\}/g, function (m, name) {
        return vars[name] !== undefined ? vars[name] : m;
      });
    }
    return value;
  }

  /** Translate every element with [data-i18n] — value or attribute. */
  function apply(rootEl) {
    var scope = rootEl || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      var attr = el.getAttribute("data-i18n-attr");
      if (attr) {
        el.setAttribute(attr, t(key));
      } else {
        el.textContent = t(key);
      }
    });
  }

  function toggle() {
    var idx = CONFIG.supportedLanguages.indexOf(getLang());
    var next =
      CONFIG.supportedLanguages[(idx + 1) % CONFIG.supportedLanguages.length];
    setLang(next, true);
    apply();
    listeners.forEach(function (fn) {
      fn(next);
    });
    return next;
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function load() {
    var base = CONFIG.i18nPath || "other/i18n/";
    return Promise.all(
      CONFIG.supportedLanguages.map(function (code) {
        return fetch(base + code + ".json", { cache: "no-cache" })
          .then(function (res) {
            if (!res.ok) throw new Error("i18n " + code + ": " + res.status);
            return res.json();
          })
          .then(function (json) {
            dicts[code] = json;
          });
      })
    ).then(function () {
      setLang(getLang(), false);
    });
  }

  /* -------- Theme helper --------
     Three states: "system" (default — no attribute, CSS media query
     decides live), "light" and "dark" (explicit overrides persisted in
     localStorage, restored pre-paint by the inline script in index.html
     to avoid a flash of the wrong colors). */
  var THEME_STATES = ["system", "light", "dark"];

  function applyTheme(pref) {
    var html = document.documentElement;
    if (pref === "light" || pref === "dark") {
      html.setAttribute("data-theme", pref);
    } else {
      html.removeAttribute("data-theme");
    }
  }

  function getTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (e) {
      /* ignore */
    }
    return saved === "light" || saved === "dark" ? saved : "system";
  }

  function setTheme(pref) {
    if (THEME_STATES.indexOf(pref) === -1) pref = "system";
    try {
      if (pref === "system") {
        localStorage.removeItem(THEME_KEY);
      } else {
        localStorage.setItem(THEME_KEY, pref);
      }
    } catch (e) {
      /* ignore */
    }
    applyTheme(pref);
  }

  function toggleTheme() {
    var next =
      THEME_STATES[(THEME_STATES.indexOf(getTheme()) + 1) % THEME_STATES.length];
    setTheme(next);
    return next;
  }

  function initTheme() {
    applyTheme(getTheme());
    /* Live OS follow: while pref is "system" the attribute is simply
       absent, so CSS `@media (prefers-color-scheme: dark)` tracks the OS
       by itself. The listener re-applies on change for safety. */
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onSchemeChange = function () {
        applyTheme(getTheme());
      };
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onSchemeChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(onSchemeChange);
      }
    }
  }

  window.I18N = {
    t: t,
    apply: apply,
    toggle: toggle,
    onChange: onChange,
    load: load,
    getLang: getLang,
    setLang: setLang,
    initTheme: initTheme,
    applyTheme: applyTheme,
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    THEME_STATES: THEME_STATES,
    STORAGE_KEY: STORAGE_KEY,
    THEME_KEY: THEME_KEY,
  };
})();