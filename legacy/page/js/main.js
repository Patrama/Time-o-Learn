/** @format */

"use strict";

/**
 * Unified storefront logic for shopee.html / tokopedia.html.
 *
 * Each page tells this script which CSV to load by defining
 * `window.STORE_CONFIG` BEFORE this file is included, e.g.:
 *
 *   <script>
 *     window.STORE_CONFIG = {
 *       csvUrl: "https://docs.google.com/.../output=csv",
 *       title: "GOAT Shopee",
 *     };
 *   </script>
 *   <script defer src="js/main.js"></script>
 *
 * If STORE_CONFIG is missing, the page falls back to the
 * localStorage/query-param source or shows a helpful error.
 */

const linksGrid = document.getElementById("linksGrid");
const searchInput = document.getElementById("searchInput");
const tabsEl = document.getElementById("categoryTabs");
const themeToggle = document.getElementById("themeToggle");

let allProducts = [];
let currentCategory = "all";

/* ---- Theme toggle (guarded: only runs when the button exists) ---- */
function initTheme() {
  if (!themeToggle) return;

  const isDark = () => document.documentElement.classList.contains("dark");
  const updateIcon = () => {
    const sun = document.getElementById("iconSun");
    const moon = document.getElementById("iconMoon");
    if (sun) sun.classList.toggle("hidden", !isDark());
    if (moon) moon.classList.toggle("hidden", isDark());
  };

  themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark() ? "dark" : "light");
    updateIcon();
  });

  updateIcon();
}

/* ---- 1. Proper CSV parser (handles quotes, commas, blank rows) ---- */
function parseCSV(text) {
  text = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const rawHeaders = rows.shift().map((h) => h.trim().toLowerCase());

  return rows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const obj = {};
      rawHeaders.forEach((h, idx) => {
        obj[h] = (r[idx] || "").trim();
      });
      return obj;
    });
}

/* ---- 2. Resolve which CSV to load ---- */
function resolveConfig() {
  const params = new URLSearchParams(location.search);
  const paramUrl = params.get("csv");

  if (window.STORE_CONFIG && window.STORE_CONFIG.csvUrl) {
    return window.STORE_CONFIG;
  }
  if (paramUrl) {
    return { csvUrl: paramUrl, title: document.title };
  }
  return null;
}

/* ---- 3. Fetch + parse the sheet ---- */
async function loadStorefrontData() {
  const config = resolveConfig();

  if (location.protocol === "file:") {
    setMessage(
      "This page was opened directly as a file (file://). Browsers block loading remote data that way. Run it through a local server or host it online instead. ⚠️",
      true,
    );
    return;
  }

  if (!config) {
    setMessage(
      "Missing configuration: this page must define window.STORE_CONFIG.csvUrl before loading js/main.js. ⚠️",
      true,
    );
    return;
  }

  if (config.title) {
    document.title = config.title;
  }

  try {
    const url =
      config.csvUrl +
      (config.csvUrl.includes("?") ? "&" : "?") +
      "cb=" +
      Date.now();
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Sheet request failed with status ${response.status}`);
    }

    const csvText = await response.text();

    if (csvText.trim().startsWith("<")) {
      throw new Error(
        "Response was HTML, not CSV — sheet may not be published, or the link/gid is wrong.",
      );
    }

    allProducts = parseCSV(csvText);
    renderCategoryTabs(allProducts);
    applyFilters();
  } catch (error) {
    console.error("Error loading dynamic database:", error);
    setMessage(
      "Failed to sync database. ⚠️ Check console for details — common causes: sheet not published to web, wrong gid, or page opened via file:// instead of a server.",
      true,
    );
  }
}

function setMessage(text, isError) {
  linksGrid.innerHTML =
    '<div class="state-msg' +
    (isError ? " danger" : "") +
    '">' +
    escapeHtml(text) +
    "</div>";
}

/* ---- 4. Render category tabs dynamically ---- */
function renderCategoryTabs(products) {
  const categories = [
    "all",
    ...new Set(
      products.map((p) => (p.category || "").toLowerCase()).filter(Boolean),
    ),
  ];

  tabsEl.innerHTML = categories
    .map((cat) => {
      const label =
        cat === "all"
          ? "All Items"
          : cat.replace(/\b\w/g, (c) => c.toUpperCase());
      const isActive = cat === currentCategory;
      return (
        '<button type="button" data-category="' +
        escapeHtml(cat) +
        '" class="cat-btn' +
        (isActive ? " active" : "") +
        '">' +
        escapeHtml(label) +
        "</button>"
      );
    })
    .join("");
}

/* ---- 5. Render table rows (single DOM write, escaped output) ---- */
function renderRows(list) {
  if (list.length === 0) {
    setMessage("No matching items found 🔍", false);
    return;
  }

  let html = "";
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    html +=
      '<div class="row">' +
      '<div class="num">' +
      escapeHtml(item.number || "") +
      "</div>" +
      '<span class="badge">' +
      escapeHtml(item.category || "—") +
      "</span>" +
      '<div class="name">' +
      escapeHtml(item.name || "") +
      "</div>" +
      '<a class="view" href="' +
      escapeHtml(item.link || "#") +
      '" target="_blank" rel="noopener noreferrer">View</a>' +
      "</div>";
  }
  linksGrid.innerHTML = html;
}

/* ---- 6. Search + category filter combined ---- */
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();

  const filtered = allProducts.filter((item) => {
    const matchesCategory =
      currentCategory === "all" ||
      (item.category || "").toLowerCase() === currentCategory;
    const matchesSearch =
      query === "" ||
      String(item.number || "")
        .toLowerCase()
        .includes(query) ||
      String(item.name || "")
        .toLowerCase()
        .includes(query);
    return matchesCategory && matchesSearch;
  });

  renderRows(filtered);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---- Events: one delegated listener instead of per-element handlers ---- */
tabsEl.addEventListener("click", (event) => {
  const btn = event.target.closest(".cat-btn");
  if (!btn) {
    return;
  }
  currentCategory = btn.dataset.category;
  tabsEl.querySelectorAll(".cat-btn").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });
  applyFilters();
});

searchInput.addEventListener("input", applyFilters, { passive: true });

window.addEventListener("DOMContentLoaded", loadStorefrontData);

initTheme();
