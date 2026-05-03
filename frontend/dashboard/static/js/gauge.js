/**
 * gauge.js — Canvas-based Risk Score Gauge (rebuilt from scratch)
 *
 * Uses Canvas 2D API directly — zero SVG stroke-dasharray tricks.
 *
 * Geometry (all angles measured clockwise from 3-o'clock = 0°):
 *   START_ANGLE = 135°  → 7:30 position (bottom-left edge of gap)
 *   SWEEP       = 270°  → arc spans from 7:30 clockwise to 4:30
 *   GAP         = 90°   → centered at 6-o'clock (bottom)
 */

const Gauge = (() => {
  // ── Constants ────────────────────────────────────────────────────────────
  const SIZE  = 110;                            // CSS px width/height
  const CX    = SIZE / 2;                       // center x (55)
  const CY    = SIZE / 2;                       // center y (55)
  const R     = 38;                             // arc radius
  const SW    = 8;                              // stroke width

  const DEG   = Math.PI / 180;
  const START = 135 * DEG;                      // 7:30 — bottom-left
  const SWEEP = 270 * DEG;                      // 270° clockwise arc

  const MAX   = 100;

  const TRACK_COLOR = '#1E2630';
  const COLORS = {
    LOW:    '#00E676',
    MEDIUM: '#FFC107',
    HIGH:   '#FF3B30',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let _canvas       = null;
  let _ctx          = null;
  let _scoreEl      = null;
  let _currentScore = 0;
  let _animId       = null;

  // ── Internal draw ─────────────────────────────────────────────────────────
  function _draw(progress, color) {
    _ctx.clearRect(0, 0, SIZE, SIZE);

    // 1. Background track — always full 270°
    _ctx.beginPath();
    _ctx.arc(CX, CY, R, START, START + SWEEP, false);
    _ctx.strokeStyle = TRACK_COLOR;
    _ctx.lineWidth   = SW;
    _ctx.lineCap     = 'round';
    _ctx.stroke();

    // 2. Progress arc — grows clockwise from START
    if (progress > 0.001) {
      _ctx.beginPath();
      _ctx.arc(CX, CY, R, START, START + SWEEP * progress, false);
      _ctx.strokeStyle = color;
      _ctx.lineWidth   = SW;
      _ctx.lineCap     = 'round';
      _ctx.stroke();
    }
  }

  // ── Public: init ──────────────────────────────────────────────────────────
  function init() {
    _canvas  = document.getElementById('gauge-canvas');
    _scoreEl = document.getElementById('gauge-score-text');

    if (!_canvas) {
      console.warn('[Gauge] #gauge-canvas not found');
      return;
    }

    // HiDPI / Retina sharpness
    const dpr = window.devicePixelRatio || 1;
    _canvas.width         = SIZE * dpr;
    _canvas.height        = SIZE * dpr;
    _canvas.style.width   = SIZE + 'px';
    _canvas.style.height  = SIZE + 'px';

    _ctx = _canvas.getContext('2d');
    _ctx.scale(dpr, dpr);

    // Draw empty gauge immediately
    _draw(0, COLORS.LOW);
  }

  // ── Public: update ────────────────────────────────────────────────────────
  function update(score, riskLevel) {
    if (!_ctx) return;

    const to    = Math.max(0, Math.min(score, MAX));
    const color = COLORS[riskLevel] || COLORS.LOW;
    const from  = _currentScore;

    // Cancel any in-flight animation
    if (_animId) cancelAnimationFrame(_animId);

    const duration  = 700;
    const startTime = performance.now();

    function step(now) {
      const p       = Math.min((now - startTime) / duration, 1);
      const eased   = 1 - Math.pow(1 - p, 3);          // ease-out cubic
      const current = from + (to - from) * eased;

      _draw(current / MAX, color);
      if (_scoreEl) _scoreEl.textContent = Math.round(current);

      if (p < 1) {
        _animId = requestAnimationFrame(step);
      } else {
        _animId = null;
      }
    }

    _animId = requestAnimationFrame(step);
    _currentScore = to;
  }

  return { init, update };
})();
