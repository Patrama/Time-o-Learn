/** @format */

// /api/catalog — game catalog + pricing for the public menu.
//
// Fetches two published Google Sheet CSVs (Catalog, Pricing) server-side,
// parses them, caches in-memory for CACHE_TTL_MS, and returns only the
// fields the menu needs. Env: SHEET_CATALOG_CSV_URL, SHEET_PRICING_CSV_URL.
//
// Cache is per-function-instance (resets on cold start) — this is expected
// and fine at this scale; it avoids re-fetching Sheets on every request
// without needing a separate cache store.

import { applyCors, isPreflight, sendJson } from "../lib/cors.js";

const CACHE_TTL_MS = 8 * 60 * 1000; // ~8 min, within the 5–10 min window from the plan

let cache = {
  data: null, // { games, pricing }
  fetchedAt: 0, // epoch ms
};

// --- Minimal CSV parser (no dependency) -----------------------------------
// Handles quoted fields, commas inside quotes, and escaped "" quotes.
// Google Sheets' CSV export follows standard RFC 4180 quoting, which this covers.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        // Handle \r\n and bare \n; skip the paired \n after \r
        if (char === "\r" && next === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
  }
  // Final field/row if the file doesn't end with a newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function rowsToObjects(rows) {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`csv_fetch_failed:${res.status}`);
  }
  const text = await res.text();
  return rowsToObjects(parseCsv(text));
}

function toBool(value) {
  return String(value).trim().toUpperCase() === "TRUE";
}

function toNumber(value, fallback = 0) {
  // Sheets' Publish-to-web CSV export can carry display formatting through
  // (e.g. "10,000" or "Rp 10.000") depending on locale/number-format
  // settings — strip everything except digits and a leading minus sign
  // before parsing, since prices here are always whole numbers (no cents).
  const cleaned = String(value)
    .trim()
    .replace(/[^0-9-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== "" ? n : fallback;
}

// --- Shape the raw sheet rows into the light payload the menu needs -------
function shapeCatalog(rawRows) {
  return rawRows
    .filter((row) => toBool(row.active))
    .map((row) => ({
      id: row.id,
      title: { en: row.title_en, id: row.title_id },
      description: { en: row.description_en, id: row.description_id },
      thumbnail: row.thumbnail,
      ageRange: row.age_range,
      category: row.category,
      priceRental: toNumber(row.price_rental),
      priceCurrency: row.price_currency || "IDR",
      isFreeTrial: toBool(row.is_free_trial),
      contentType: row.content_type || "game",
    }))
    .filter((game) => game.id); // drop any blank/malformed rows
}

function shapePricing(rawRows) {
  return rawRows
    .map((row) => ({
      planId: row.plan_id,
      label: { en: row.label_en, id: row.label_id },
      price: toNumber(row.price),
      durationDays: toNumber(row.duration_days),
      installmentsAllowed: toBool(row.installments_allowed),
    }))
    .filter((plan) => plan.planId);
}

async function loadCatalogAndPricing() {
  const catalogUrl = process.env.SHEET_CATALOG_CSV_URL;
  const pricingUrl = process.env.SHEET_PRICING_CSV_URL;

  // Catalog is required — without it there's nothing to show.
  if (!catalogUrl) {
    throw new Error("missing_catalog_env_var");
  }

  // Pricing is OPTIONAL — the Pricing tab/sheet may not exist yet (e.g.
  // subscription plans built in a later phase). Catalog must still load
  // and games must still display even with no pricing configured.
  const catalogPromise = fetchCsv(catalogUrl);
  const pricingPromise = pricingUrl
    ? fetchCsv(pricingUrl).catch(() => [])
    : Promise.resolve([]);

  const [catalogRows, pricingRows] = await Promise.all([
    catalogPromise,
    pricingPromise,
  ]);

  return {
    games: shapeCatalog(catalogRows),
    pricing: shapePricing(pricingRows),
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (isPreflight(req)) {
    return sendJson(res, 204, {});
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const now = Date.now();
  const cacheIsFresh = cache.data && now - cache.fetchedAt < CACHE_TTL_MS;
  const forceRefresh = req.query?.refresh === "1";

  if (cacheIsFresh && !forceRefresh) {
    return sendJson(res, 200, {
      ok: true,
      cached: true,
      cachedAt: cache.fetchedAt,
      ...cache.data,
    });
  }

  try {
    const data = await loadCatalogAndPricing();
    cache = { data, fetchedAt: now };
    return sendJson(res, 200, {
      ok: true,
      cached: false,
      cachedAt: now,
      ...data,
    });
  } catch (err) {
    // Graceful degradation: if we have any stale cache, serve it rather than
    // erroring out completely — matches the plan's §5.4 resilience principle.
    if (cache.data) {
      return sendJson(res, 200, {
        ok: true,
        cached: true,
        stale: true,
        cachedAt: cache.fetchedAt,
        ...cache.data,
      });
    }
    return sendJson(res, 502, {
      ok: false,
      error: "catalog_fetch_failed",
      message: err.message,
    });
  }
}
