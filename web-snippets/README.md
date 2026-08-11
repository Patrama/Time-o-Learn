# web-snippets

Drop-in, self-contained UI snippets. Copy the whole `web-snippets/` folder into
any project — each file works independently, no build step required.

## Folder convention

```
web-snippets/
  css/    → one stylesheet per snippet
  js/     → one script per snippet
  img/    → any images a snippet needs
  font/   → any fonts a snippet needs
  page/   → docs (this file) and full-page demo/test HTML
  other/  → manifest.json + anything that doesn't fit above
```

Each new snippet gets one entry per relevant folder, named the same
(`snippet-name.css`, `snippet-name.js`, ...). No shared "utils" file — every
snippet must work if you only copy its own files.

## Current snippets

### 1. `force-landscape` (css only)
Full-screen "please rotate" overlay on portrait screens.

```html
<link rel="stylesheet" href="css/force-landscape.css" />
```
Nothing else needed — pure CSS, no markup, no JS.

### 2. `typewriter-effect` (js only)
Types/deletes a list of phrases into an element, looping forever.

**Zero-config (data attributes):**
```html
<script src="js/typewriter-effect.js" defer></script>
<span
  class="js-typewriter"
  data-phrases='["Professional","Setulus Hati","Ikhlas","Penuh Kasih","Empati"]'
></span>
```

**Manual control (custom timing, multiple instances, SPA teardown):**
```js
import { initTypewriter } from "./js/typewriter-effect.js";
const handle = initTypewriter(document.querySelector(".hero-tagline"), {
  phrases: ["Professional", "Setulus Hati"],
  typeSpeed: 95,
  deleteSpeed: 45,
  holdDelay: 1800,
  pauseDelay: 2000,
});
// handle.stop() to cancel
```

### 3. `brush-reveal` (css + js)
Hover over a grayscale-covered photo to "wipe" it away and reveal the color
version underneath, brush-stroke style. The wiped area slowly "dries" back
to grayscale. Multi-instance safe — use it more than once on one page.

**Markup (zero JS config needed):**
```html
<link rel="stylesheet" href="css/brush-reveal.css" />

<div class="js-brush-reveal"
     data-grayscale-src="img/grayscale.png"
     data-brush-size="60"
     data-brush-blur="30"
     data-drying-speed="0.04">
  <img class="reveal-color-image" src="img/colored.png" alt="">
  <canvas class="reveal-canvas"></canvas>
</div>

<script src="js/brush-reveal.js" defer></script>
```
- `data-brush-size` — outer radius of the brush in px (default 60)
- `data-brush-blur` — softness of the brush edge in px, keep ≤ brush-size (default 30)
- `data-drying-speed` — how fast it fades back to grayscale, 0.01 (slow) – 0.1 (fast) (default 0.04)
- If your photo isn't 16:9, set `style="--reveal-aspect-ratio: 4/3"` (or any ratio) on the container.

**Manual control (custom timing, teardown for SPAs):**
```js
import { initBrushReveal } from "./js/brush-reveal.js";
const handle = initBrushReveal(document.querySelector("#myReveal"), {
  grayscaleSrc: "img/grayscale.png",
  brushSize: 80,
  brushBlur: 25,
  dryingSpeed: 0.05,
});
// handle.stop() to cancel the animation loop and remove listeners
```

## Adding a new snippet
1. Add its file(s) to `css/`, `js/`, etc. — same base filename across folders.
2. Register it in `other/manifest.json`.
3. Add a section to this README with a copy-paste usage snippet.
4. Test it (see below) before committing.

## Testing before you drop a snippet in
- JS: `node -c js/<name>.js` (syntax) and, where there's real logic, a quick
  Node script with a fake `window`/`document` to exercise it headlessly.
- CSS: check brace balance / run it through any linter you have; better yet
  open `page/*-demo.html` in a browser and eyeball it.
