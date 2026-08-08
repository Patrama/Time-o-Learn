/** @format */
/* eslint-disable no-unused-vars */
/**
 * Time-o-Learn — non-secret site configuration (Repo A).
 *
 * SECRETS NEVER GO HERE. See MASTER_BUILD_PLAN.md §2 (Repo A note):
 * this file holds non-secret config only (Vercel API base URL, languages,
 * feature flags). Actual secrets live in Repo B (Vercel env vars).
 */
window.APP_CONFIG = {
  /** Deployed Vercel API base (Repo B). Placeholder until Repo B deploys. */
  apiBaseUrl: "https://ivy-tol.vercel.app/",

  /** Languages shipped at launch (plan §1). First entry = default fallback. */
  supportedLanguages: ["en", "id"],

  /**
   * Path to the i18n dictionaries, relative to the current page.
   * index.html → "other/i18n/"; a page in page/game-content/ overrides
   * this with "../../other/i18n/".
   */
  i18nPath: "other/i18n/",

  /** Site-level feature flags */
  features: {
    /** Enable service worker app-shell caching (plan §5.4) */
    serviceWorker: true,
    /** Use mock entitlement until Repo B exists (plan §3 / §8 Phase 0) */
    mockEntitlement: true,
    /** Fall back to cached catalog in localStorage when /api/catalog fails */
    catalogCacheFallback: true,
  },
};
