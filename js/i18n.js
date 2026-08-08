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

  /* -------- Theme helper (plan §1 UI considerations) -------- */
  function applyTheme(pref) {
    var html = document.documentElement;
    if (pref === "light" || pref === "dark") {
      html.setAttribute("data-theme", pref);
    } else {
      html.removeAttribute("data-theme");
    }
  }

  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (e) {
      /* ignore */
    }
    applyTheme(saved);
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
    STORAGE_KEY: STORAGE_KEY,
    THEME_KEY: THEME_KEY,
  };
})();