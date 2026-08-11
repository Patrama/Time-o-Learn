/**
 * ---------- Typewriter Effect (reusable) ----------
 * Types and deletes a list of phrases into any element, looping forever.
 * Plug-and-play: works via a data-attribute, or by calling initTypewriter()
 * yourself with custom options. Safe to include on pages that don't have
 * a matching element (it just does nothing).
 *
 * Markup usage (zero JS config needed):
 *   <span class="js-typewriter"
 *         data-phrases='["Professional","Setulus Hati","Ikhlas","Penuh Kasih","Empati"]'
 *         data-type-speed="95"
 *         data-delete-speed="45"
 *         data-hold="1800"
 *         data-pause="2000"></span>
 *
 * JS usage (custom control):
 *   initTypewriter(document.querySelector(".melayani-dengan"), {
 *     phrases: ["Professional", "Setulus Hati"],
 *   });
 *
 * @format
 */

function initTypewriter(el, options) {
  if (!el) return null;

  var opts = options || {};
  var phrases = opts.phrases || ["Hello"];
  var typeSpeed = opts.typeSpeed || 95;
  var deleteSpeed = opts.deleteSpeed || 45;
  var holdDelay = opts.holdDelay || 1800;
  var pauseDelay = opts.pauseDelay || 2000;

  if (!phrases.length) return null;

  var phraseIndex = 0;
  var charIndex = 0;
  var isDeleting = false;
  var timerId = null;

  function tick() {
    var current = phrases[phraseIndex];
    charIndex += isDeleting ? -1 : 1;
    el.textContent = current.substring(0, charIndex);

    var delay = isDeleting ? deleteSpeed : typeSpeed;

    if (!isDeleting && charIndex === current.length) {
      delay = holdDelay;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      delay = pauseDelay;
    }

    timerId = window.setTimeout(tick, delay);
  }

  tick();

  // Return a handle so the caller can stop it if needed (e.g. SPA teardown).
  return {
    stop: function () {
      if (timerId) window.clearTimeout(timerId);
    },
  };
}

// Auto-init any element marked with the data-attribute hook, so this file
// can be dropped in and linked with zero extra wiring.
(function autoInit() {
  if (typeof document === "undefined") return;

  document.querySelectorAll(".js-typewriter").forEach(function (el) {
    var phrases = [];
    try {
      phrases = JSON.parse(el.getAttribute("data-phrases") || "[]");
    } catch (e) {
      phrases = [];
    }
    if (!phrases.length) return;

    initTypewriter(el, {
      phrases: phrases,
      typeSpeed: Number(el.getAttribute("data-type-speed")) || undefined,
      deleteSpeed: Number(el.getAttribute("data-delete-speed")) || undefined,
      holdDelay: Number(el.getAttribute("data-hold")) || undefined,
      pauseDelay: Number(el.getAttribute("data-pause")) || undefined,
    });
  });
})();

// Support both plain <script> include and module import.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { initTypewriter: initTypewriter };
}
