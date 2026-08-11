/**
 * ---------- Brush Reveal ----------
 * Hover-driven "wipe away the grayscale to reveal color" effect.
 * Plug-and-play: works via markup + data-attributes, or by calling
 * initBrushReveal() yourself for custom options / multiple instances.
 * No global config object, no hardcoded IDs — safe to use more than
 * once on the same page.
 *
 * Markup usage (zero JS config needed):
 *   <div class="js-brush-reveal"
 *        data-grayscale-src="grayscale.png"
 *        data-brush-size="60"
 *        data-brush-blur="30"
 *        data-drying-speed="0.04">
 *     <img class="reveal-color-image" src="colored.png" alt="">
 *     <canvas class="reveal-canvas"></canvas>
 *   </div>
 *   <script src="js/brush-reveal.js" defer></script>
 *
 * JS usage (custom control):
 *   initBrushReveal(document.querySelector("#myReveal"), {
 *     grayscaleSrc: "grayscale.png",
 *     brushSize: 80,
 *   });
 *
 * @format
 */

// Pure helper (exported for testing) — computes "object-fit: cover"
// geometry so the canvas layer lines up pixel-for-pixel with the <img>.
function calcCoverGeometry(imgWidth, imgHeight, boxWidth, boxHeight) {
  var imgRatio = imgWidth / imgHeight;
  var boxRatio = boxWidth / boxHeight;
  var geometry = { xOffset: 0, yOffset: 0, width: 0, height: 0 };

  if (imgRatio > boxRatio) {
    geometry.height = boxHeight;
    geometry.width = boxHeight * imgRatio;
    geometry.xOffset = (boxWidth - geometry.width) / 2;
    geometry.yOffset = 0;
  } else {
    geometry.width = boxWidth;
    geometry.height = boxWidth / imgRatio;
    geometry.xOffset = 0;
    geometry.yOffset = (boxHeight - geometry.height) / 2;
  }

  return geometry;
}

function initBrushReveal(container, options) {
  if (!container) return null;

  var opts = options || {};
  var colorImg = container.querySelector(".reveal-color-image");
  var canvas = container.querySelector(".reveal-canvas");
  if (!colorImg || !canvas) return null;

  var grayscaleSrc =
    opts.grayscaleSrc || container.getAttribute("data-grayscale-src");
  if (!grayscaleSrc) return null;

  var brushSize =
    opts.brushSize || Number(container.getAttribute("data-brush-size")) || 60;
  var brushBlur =
    opts.brushBlur || Number(container.getAttribute("data-brush-blur")) || 30;
  var dryingSpeed =
    opts.dryingSpeed ||
    Number(container.getAttribute("data-drying-speed")) ||
    0.04;

  var ctx = canvas.getContext("2d");
  var grayImg = new Image();
  grayImg.src = grayscaleSrc;

  var mouseX = -1000;
  var mouseY = -1000;
  var isHovering = false;
  var loadedCount = 0;
  var geometry = { xOffset: 0, yOffset: 0, width: 0, height: 0 };
  var rafId = null;
  var stopped = false;

  function onAsset() {
    loadedCount++;
    if (loadedCount === 2) setup();
  }
  if (colorImg.complete) onAsset();
  else colorImg.onload = onAsset;
  if (grayImg.complete) onAsset();
  else grayImg.onload = onAsset;

  function setup() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    geometry = calcCoverGeometry(
      colorImg.naturalWidth,
      colorImg.naturalHeight,
      canvas.width,
      canvas.height
    );
    drawGrayscale(1.0);
  }

  function drawGrayscale(alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      grayImg,
      geometry.xOffset,
      geometry.yOffset,
      geometry.width,
      geometry.height
    );
    ctx.restore();
  }

  function onPointerMove(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    isHovering = true;
  }
  function onPointerLeave() {
    isHovering = false;
  }
  function onResize() {
    if (loadedCount === 2) setup();
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", onResize);

  function tick() {
    if (stopped) return;

    if (loadedCount < 2) {
      rafId = window.requestAnimationFrame(tick);
      return;
    }

    drawGrayscale(dryingSpeed);

    if (isHovering) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      var gradient = ctx.createRadialGradient(
        mouseX,
        mouseY,
        brushSize - brushBlur,
        mouseX,
        mouseY,
        brushSize
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, brushSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    rafId = window.requestAnimationFrame(tick);
  }

  rafId = window.requestAnimationFrame(tick);

  // Handle so the caller can tear this instance down (SPA nav, etc).
  return {
    stop: function () {
      stopped = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
    },
  };
}

// Auto-init every matching container, so this file can be dropped in
// and linked with zero extra wiring.
(function autoInit() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".js-brush-reveal").forEach(function (el) {
    initBrushReveal(el);
  });
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    initBrushReveal: initBrushReveal,
    calcCoverGeometry: calcCoverGeometry,
  };
}
