/**
 * chart.js — Risk Timeline Chart
 * Line chart showing risk score over the last 60 seconds.
 * Uses Chart.js from CDN.
 * Colored zones: green 0-39, amber 40-79, red 80-120.
 */

const RiskChart = (() => {
  const MAX_POINTS   = 60;   // 60 seconds of history
  const POLL_INTERVAL = 1000; // ms

  let _chart    = null;
  let _labels   = [];   // time strings
  let _scores   = [];   // numeric risk scores

  const ZONE_COLORS = {
    low:    'rgba(0, 230, 118, 0.12)',
    medium: 'rgba(255, 145, 0, 0.12)',
    high:   'rgba(255, 23, 68, 0.12)',
  };

  /**
   * Initialize the Chart.js instance.
   * Must be called after Chart.js is loaded and canvas exists.
   */
  function init() {
    const canvas = document.getElementById('risk-chart');
    if (!canvas) {
      console.warn('[Chart] Canvas #risk-chart not found.');
      return;
    }

    const ctx = canvas.getContext('2d');

    // Pre-fill with 60 empty points
    for (let i = MAX_POINTS; i > 0; i--) {
      _labels.push(_timeLabel());
      _scores.push(null);
    }

    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels:   _labels,
        datasets: [{
          label:           'Risk Score',
          data:            _scores,
          borderColor:     '#ff4d00',
          backgroundColor: _buildGradient(ctx),
          borderWidth:     2,
          pointRadius:     0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#ff4d00',
          tension:         0.4,
          fill:            true,
          spanGaps:        true,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation: {
          duration: 400,
          easing:   'easeOutQuart',
        },
        interaction: {
          mode:       'index',
          intersect:  false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,10,15,0.85)',
            titleColor:      '#888',
            bodyColor:       '#f0f0f0',
            borderColor:     'rgba(255,255,255,0.1)',
            borderWidth:     1,
            padding:         10,
            callbacks: {
              label: ctx => `Score: ${ctx.parsed.y ?? '—'}`,
            },
          },
          // Colored zone annotations (drawn as background rectangles)
          annotation: undefined,
        },
        scales: {
          x: {
            ticks: {
              color:       '#555',
              font:        { size: 10, family: 'Inter' },
              maxTicksLimit: 6,
              maxRotation: 0,
            },
            grid: {
              color: 'rgba(255,255,255,0.05)',
            },
            border: { color: 'transparent' },
          },
          y: {
            min: 0,
            max: 120,
            ticks: {
              color:     '#555',
              stepSize:  40,
              font:      { size: 10, family: 'Inter' },
              callback:  v => v === 40 ? 'MED' : v === 80 ? 'HIGH' : v,
            },
            grid: {
              color: ctx => {
                if (ctx.tick.value === 40 || ctx.tick.value === 80) {
                  return 'rgba(255,255,255,0.18)';
                }
                return 'rgba(255,255,255,0.05)';
              },
              lineWidth: ctx => (ctx.tick.value === 40 || ctx.tick.value === 80) ? 1.5 : 1,
            },
            border: { color: 'transparent' },
          },
        },
      },
      plugins: [_zonePlugin()],
    });
  }

  /**
   * Push a new score data point (called every second from main.js).
   * @param {number} score - Current risk score (0–120)
   */
  function addPoint(score) {
    if (!_chart) return;

    _labels.push(_timeLabel());
    _scores.push(score);

    if (_labels.length > MAX_POINTS) {
      _labels.shift();
      _scores.shift();
    }

    _chart.update('none'); // skip default animation; we handle it via tension
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _timeLabel() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  function _buildGradient(ctx) {
    // Attempt to build a vertical gradient; safe fallback to solid color
    try {
      const gradient = ctx.createLinearGradient(0, 0, 0, 220);
      gradient.addColorStop(0,    'rgba(255, 77, 0, 0.35)');
      gradient.addColorStop(0.5,  'rgba(255, 77, 0, 0.10)');
      gradient.addColorStop(1,    'rgba(255, 77, 0, 0.01)');
      return gradient;
    } catch {
      return 'rgba(255, 77, 0, 0.15)';
    }
  }

  /** Custom Chart.js plugin to draw LOW/MEDIUM/HIGH zone backgrounds */
  function _zonePlugin() {
    return {
      id: 'riskZones',
      beforeDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
        if (!y) return;

        const toY = val => y.getPixelForValue(val);

        ctx.save();

        // LOW zone: 0–39
        ctx.fillStyle = ZONE_COLORS.low;
        ctx.fillRect(left, toY(39),  right - left, toY(0)  - toY(39));

        // MEDIUM zone: 40–79
        ctx.fillStyle = ZONE_COLORS.medium;
        ctx.fillRect(left, toY(79),  right - left, toY(39) - toY(79));

        // HIGH zone: 80–120
        ctx.fillStyle = ZONE_COLORS.high;
        ctx.fillRect(left, toY(120), right - left, toY(79) - toY(120));

        ctx.restore();
      },
    };
  }

  return { init, addPoint };
})();
