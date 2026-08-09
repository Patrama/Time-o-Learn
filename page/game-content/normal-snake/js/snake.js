/**
 * Time-o-Learn — Snake game (plain JS + Canvas).
 * Plan §5.3: requestAnimationFrame gated to ~30fps (target 33ms),
 * CSS transitions only, no animation libraries. Phone-first.
 * Plan §6: HUD/overlay copy via I18N.t; input = swipe, dpad, keys.
 * Game logic runs fully client-side (§4.4).
 */
(function () {
  "use strict";

  /* ---------- Config (tokens.css §1: --game-cols, --game-cell) ---------- */
  var COLS = 20;
  var ROWS = 20;
  var TICK_MS = 120; // one grid step per 120ms (≈8 cells/sec — kid-friendly)
  var FRAME_MS = 33; // ≈30fps cap (plan §5.3)

  /* ---------- State ---------- */
  var canvas, ctx, scoreEl, srEl, pauseBtn;
  var snake, food, dir, nextDir, score, best, rafId;
  var running = false;
  var paused = false;
  var gameOver = false;
  var lastFrame = 0;
  var lastTick = 0;
  var srToken = 0;

  /* ---------- Helpers ---------- */
  function $id(id) {
    return document.getElementById(id);
  }

  function t(key) {
    return (window.I18N && I18N.t) ? I18N.t(key) : key;
  }

  function rndFood() {
    var free = [];
    for (var y = 1; y < ROWS - 1; y++) {
      for (var x = 1; x < COLS - 1; x++) {
        var hit = false;
        for (var i = 0; i < snake.length; i++) {
          if (snake[i].x === x && snake[i].y === y) { hit = true; break; }
        }
        if (!hit) free.push({ x: x, y: y });
      }
    }
    return free.length ? free[(Math.random() * free.length) | 0] : null;
  }

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    food = rndFood();
    score = 0;
    gameOver = false;
    paused = false;
    setHud();
  }

  function setHud() {
    scoreEl.textContent = String(score);
  }

  function setSr(text) {
    srEl.textContent = text;
  }

  /* ---------- Rendering (pure token colors) ---------- */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#ffffff";
  }

  var palette = null;
  function loadPalette() {
    palette = {
      bg: cssVar("--surface-000"),
      board: cssVar("--surface-010"),
      snake: cssVar("--brand-050"),
      snakeHead: cssVar("--brand-strong"),
      food: cssVar("--status-ok"),
    };
  }

  function draw() {
    var w = canvas.width;
    var h = canvas.height;
    var cw = w / COLS;
    var ch = h / ROWS;

    ctx.fillStyle = palette.board;
    ctx.fillRect(0, 0, w, h);

    // subtle checkerboard
    ctx.fillStyle = palette.bg;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * cw, y * ch, cw, ch);
      }
    }

    // food
    ctx.fillStyle = palette.food;
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * cw, (food.y + 0.5) * ch, Math.min(cw, ch) * 0.36, 0, Math.PI * 2);
    ctx.fill();

    // snake
    for (var i = 0; i < snake.length; i++) {
      var seg = snake[i];
      var pad = Math.max(1, Math.min(cw, ch) * 0.12);
      ctx.fillStyle = i === 0 ? palette.snakeHead : palette.snake;
      ctx.fillRect(seg.x * cw + pad, seg.y * ch + pad, cw - pad * 2, ch - pad * 2);
    }
  }

  /* ---------- Loop (§5.3 fps cap) ---------- */
  function frame(now) {
    if (now - lastFrame < FRAME_MS) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;

    if (running && !paused && !gameOver) {
      if (now - lastTick >= TICK_MS) {
        lastTick = now;
        step();
      }
      draw();
    }
    rafId = requestAnimationFrame(frame);
  }

  function step() {
    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // walls
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      endGame();
      return;
    }
    // self-collision (ignore tail cell that's moving away)
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        endGame();
        return;
      }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      setHud();
      setSr(t("game.score") + " " + score);
      food = rndFood();
      if (!food) {
        endGame(); // board full — win!
        return;
      }
    } else {
      snake.pop();
    }
  }

  function endGame() {
    gameOver = true;
    running = false;
    if (score > best) {
      best = score;
      try { localStorage.setItem("tol_snake_best", String(best)); } catch (e) {}
    }
    openOverlay("over", score, best);
    setSr(t("game.over") + " " + t("game.score") + " " + score);
  }

  /* ---------- Overlays ---------- */
  function openOverlay(kind, score, best) {
    var el = $id("overlay-" + kind);
    if (!el) return;
    el.querySelector(".overlay-title").textContent =
      kind === "over" ? t("game.over") : t("game.paused");
    var s = el.querySelector(".overlay-score");
    if (s) s.textContent = t("game.score") + ": " + score + "  ·  " + t("game.best") + ": " + best;
    el.classList.add("is-open");
    var btn = el.querySelector(".btn-primary");
    if (btn) btn.focus();
  }

  function closeOverlay(kind) {
    var el = $id("overlay-" + kind);
    if (el) el.classList.remove("is-open");
  }

  /* ---------- Controls ---------- */
  function changeDir(x, y) {
    if (x === -dir.x && y === -dir.y) return; // no reversing
    nextDir = { x: x, y: y };
  }

  function queueDir(dx, dy) {
    changeDir(dx, dy);
    if (paused && !gameOver) togglePause();
  }

  function togglePause() {
    if (gameOver || !running) return;
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", String(paused));
    pauseBtn.textContent = paused ? "▶" : "⏸";
    if (paused) openOverlay("pause", score, best);
    else closeOverlay("pause");
  }

  function start() {
    reset();
    running = true;
    closeOverlay("over");
    closeOverlay("pause");
    setSr(t("game.play"));
  }

  /* ---------- Input bindings ---------- */
  function bindInput() {
    // dpad buttons
    document.querySelectorAll(".dpad-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var d = btn.getAttribute("data-dir");
        if (d === "up") queueDir(0, -1);
        else if (d === "down") queueDir(0, 1);
        else if (d === "left") queueDir(-1, 0);
        else if (d === "right") queueDir(1, 0);
      });
    });

    // swipe on canvas (phone-first)
    var sx = 0, sy = 0;
    canvas.addEventListener("touchstart", function (e) {
      var t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY;
    }, { passive: true });

    canvas.addEventListener("touchend", function (e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? 1 : -1, 0);
      else queueDir(0, dy > 0 ? 1 : -1);
    }, { passive: true });

    // arrow keys
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp") { e.preventDefault(); queueDir(0, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); queueDir(0, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); queueDir(-1, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); queueDir(1, 0); }
      else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); togglePause(); }
    });

    pauseBtn.addEventListener("click", togglePause);

    // overlay restart buttons
    document.querySelectorAll(".btn-primary").forEach(function (btn) {
      btn.addEventListener("click", start);
    });

    // reuse I18N apply for HUD-less static bits when language changes
    if (window.I18N && I18N.onChange) {
      I18N.onChange(function () {
        pauseBtn.setAttribute("aria-label", t("game.pause"));
        document.querySelectorAll(".game-overlay .overlay-title, .game-overlay .overlay-score, .btn-primary").forEach(function (el) {
          if (el.classList.contains("overlay-title")) {
            var kind = el.closest(".game-overlay").id.replace("overlay-", "");
            el.textContent = kind === "over" ? t("game.over") : t("game.paused");
          } else if (el.classList.contains("overlay-score")) {
            var s = $id("overlay-" + (gameOver ? "over" : "pause"));
            if (s) s.querySelector(".overlay-score").textContent =
              t("game.score") + ": " + score + "  ·  " + t("game.best") + ": " + best;
          }
        });
      });
    }
  }

  /* ---------- Boot ---------- */
  function boot() {
    canvas = $id("snake-canvas");
    ctx = canvas.getContext("2d");
    scoreEl = $id("hud-score");
    srEl = $id("sr-status");
    pauseBtn = $id("pause-btn");

    // logical canvas size = grid (tokens: --game-cols * --game-cell)
    canvas.width = COLS * 15;
    canvas.height = ROWS * 15;

    loadPalette();
    bindInput();

    // best score
    try { best = parseInt(localStorage.getItem("tol_snake_best"), 10) || 0; } catch (e) { best = 0; }

    // i18n for static chrome (skip link, back button, pause label)
    I18N.load()
      .then(function () { I18N.apply(); })
      .catch(function () { I18N.apply(); });

    reset();
    draw();
    running = true;
    lastFrame = lastTick = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();