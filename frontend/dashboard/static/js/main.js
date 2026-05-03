/**
 * main.js — Dashboard Orchestrator (Redesigned)
 * Polls /status @ 1s, drives all dashboard components.
 */

const POLL_INTERVAL   = 1000;
const BACKEND_URL     = 'http://localhost:8000';
const STATUS_ENDPOINT = BACKEND_URL + '/status';

const DOM = {};
let _startTime   = Date.now();
let _lastRisk    = null;
let _alertCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
let _donutChart  = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _cacheDOM();
  Gauge.init();
  RiskChart.init();
  LocationManager.init();
  AlertLog.init();
  _initDonut();
  _initCameraToggles();
  _startPolling();
  _startUptime();
});

function _cacheDOM() {
  const ids = [
    'risk-level-text','risk-label-sub','risk-timestamp','risk-banner-card',
    'score-label','risk-icon',
    'sensor-flame-dot','sensor-flame-text',
    'sensor-esp32-dot','sensor-esp32-text',
    'sensor-cam-dot','sensor-cam-text',
    'esp32-chip','esp32-header-dot','esp32-header-label',
    'detection-list',
    'metric-temp','metric-humidity','metric-flame','metric-flame-status',
    'metric-smoke','metric-smoke-status','metric-uptime',
    'map-lat','map-lon','map-acc','map-speed',
    'donut-total','legend-high','legend-med','legend-low','legend-total',
    'thermal-max-temp',
  ];
  ids.forEach(id => { DOM[id] = document.getElementById(id); });
}

// ── Polling ───────────────────────────────────────────────────────────────────
function _startPolling() {
  _poll();
  setInterval(_poll, POLL_INTERVAL);
}

async function _poll() {
  try {
    const res    = await fetch(STATUS_ENDPOINT, { cache: 'no-store' });
    if (!res.ok) return;
    const status = await res.json();
    _apply(status);
  } catch (_) {}
}

// ── Apply status ──────────────────────────────────────────────────────────────
function _apply(s) {
  _updateRisk(s.risk_level, s.score, s.timestamp);
  Gauge.update(s.score, s.risk_level);
  RiskChart.addPoint(s.score);
  _updateSensors(s.flame_sensor, s.esp32_connected, s.camera_ok);
  _updateDetections(s.detections);
  _updateMetrics(s.flame_sensor, s.detections);
  AlertLog.processStatus(s);
  _trackAlerts(s.risk_level);
}

function _updateRisk(risk, score, ts) {
  if (!DOM['risk-level-text']) return;
  DOM['risk-level-text'].textContent = risk;
  DOM['risk-level-text'].className   = `risk-${risk}`;
  const sub = { LOW:'System Clear — No Threats', MEDIUM:'Prediction Stage — Smoke Detected', HIGH:'PREVENTION ACTIVE — Immediate Action!' };
  if (DOM['risk-label-sub']) DOM['risk-label-sub'].textContent = sub[risk] || '';
  if (DOM['risk-timestamp'] && ts) DOM['risk-timestamp'].textContent = `Updated: ${ts}`;
  if (DOM['risk-icon']) DOM['risk-icon'].textContent = risk === 'HIGH' ? '🚨' : risk === 'MEDIUM' ? '⚠️' : '🛡';
  if (DOM['risk-banner-card'] && risk !== _lastRisk) {
    DOM['risk-banner-card'].className = `card risk-card banner-${risk}`;
    _lastRisk = risk;
  }
  if (DOM['score-label']) {
    DOM['score-label'].textContent = `${risk} RISK`;
    DOM['score-label'].className   = `score-label ${risk}`;
  }
}

function _updateSensors(flame, esp32, camera) {
  _setSensor('sensor-flame-dot','sensor-flame-text', flame ? 'err':'ok', flame?'ACTIVE':'CLEAR');
  _setSensor('sensor-esp32-dot','sensor-esp32-text', esp32?'ok':'offline', esp32?'Online':'Offline');
  _setSensor('sensor-cam-dot',  'sensor-cam-text',   camera?'ok':'offline', camera?'Online':'Offline');

  const chip = DOM['esp32-chip'];
  if (chip) chip.className = `esp32-chip ${esp32 ? '' : 'offline'}`;
  if (DOM['esp32-header-label']) DOM['esp32-header-label'].textContent = esp32 ? 'ESP32 Online' : 'ESP32 Offline';
}

function _setSensor(dotId, textId, cls, label) {
  if (DOM[dotId])  DOM[dotId].className   = `sys-dot ${cls}`;
  if (DOM[textId]) DOM[textId].textContent = label;
}

function _updateDetections(dets) {
  const list = DOM['detection-list'];
  if (!list) return;
  list.innerHTML = '';
  if (!dets || dets.length === 0) {
    list.innerHTML = '<span class="no-detections" style="font-size:0.65rem;color:var(--text-muted)">No detections</span>';
    return;
  }
  dets.forEach(det => {
    const cls  = det.class_name || 'unknown';
    const conf = det.confidence  || 0;
    const pct  = Math.round(conf * 100);
    const lower= cls.toLowerCase();
    const badgeCls = lower.includes('fire')||lower.includes('flame') ? 'badge-fire' : lower.includes('smoke') ? 'badge-smoke' : 'badge-default';
    const el = document.createElement('span');
    el.className = `detection-badge ${badgeCls}`;
    el.textContent = `${cls} ${conf.toFixed(2)}`;
    list.appendChild(el);
  });
}

function _updateMetrics(flame, dets) {
  const hasSmoke = dets && dets.some(d => (d.class_name||'').toLowerCase().includes('smoke'));
  if (DOM['metric-flame']) DOM['metric-flame'].textContent = flame ? '🔥 Flame!' : 'No Flame';
  if (DOM['metric-flame-status']) { DOM['metric-flame-status'].textContent = flame ? 'Detected!' : 'Normal'; DOM['metric-flame-status'].style.color = flame ? 'var(--red)' : 'var(--green)'; }
  if (DOM['metric-smoke']) DOM['metric-smoke'].textContent = hasSmoke ? '💨 Smoke!' : 'No Smoke';
  if (DOM['metric-smoke-status']) { DOM['metric-smoke-status'].textContent = hasSmoke ? 'Detected!' : 'Normal'; DOM['metric-smoke-status'].style.color = hasSmoke ? 'var(--yellow)' : 'var(--green)'; }
}

// ── Uptime ────────────────────────────────────────────────────────────────────
function _startUptime() {
  setInterval(() => {
    const s = Math.floor((Date.now() - _startTime) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (DOM['metric-uptime']) DOM['metric-uptime'].textContent = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }, 1000);
}

// ── Alert counts / Donut ──────────────────────────────────────────────────────
function _trackAlerts(risk) {
  if (risk === 'HIGH' && _lastRisk !== 'HIGH') {
    _alertCounts.HIGH++;
    _updateDonut();
  } else if (risk === 'MEDIUM' && _lastRisk !== 'MEDIUM') {
    _alertCounts.MEDIUM++;
    _updateDonut();
  }
}

function _initDonut() {
  const ctx = document.getElementById('alert-donut');
  if (!ctx) return;
  _donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['High Risk','Medium Risk','Low Risk'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['rgba(255,23,68,0.8)','rgba(255,193,7,0.8)','rgba(0,230,118,0.8)'],
        borderColor:     ['#ff1744','#ffc107','#00e676'],
        borderWidth: 1.5,
        hoverOffset: 4,
      }]
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      animation: { duration: 400 },
    }
  });
}

function _updateDonut() {
  const total = _alertCounts.HIGH + _alertCounts.MEDIUM + _alertCounts.LOW;
  if (_donutChart) {
    _donutChart.data.datasets[0].data = [_alertCounts.HIGH, _alertCounts.MEDIUM, _alertCounts.LOW || Math.max(1,0)];
    _donutChart.update();
  }
  if (DOM['donut-total']) DOM['donut-total'].textContent = total;
  if (DOM['legend-high'])  DOM['legend-high'].textContent  = _alertCounts.HIGH;
  if (DOM['legend-med'])   DOM['legend-med'].textContent   = _alertCounts.MEDIUM;
  if (DOM['legend-low'])   DOM['legend-low'].textContent   = _alertCounts.LOW;
  if (DOM['legend-total']) DOM['legend-total'].textContent = total;
}

// ── Camera source toggle ──────────────────────────────────────────────────────
function _initCameraToggles() {
  const rtsp = document.getElementById('btn-rtsp');
  const pc   = document.getElementById('btn-pccam');
  if (rtsp) rtsp.addEventListener('click', () => { rtsp.classList.add('active'); pc.classList.remove('active'); });
  if (pc)   pc.addEventListener('click',   () => { pc.classList.add('active');   rtsp.classList.remove('active'); });
}

// ── Utility functions (called from HTML onclick) ───────────────────────────────
function saveRtsp() {
  const val = document.getElementById('rtsp-input')?.value;
  if (val) {
    fetch(BACKEND_URL + '/set-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rtsp: val })
    }).then(() => alert(`RTSP URL saved and stream started:\n${val}`));
  }
}

function testStream() {
  const s = document.getElementById('cam-conn-status');
  if (s) { s.textContent = '● Testing…'; s.className = 'conn-status'; }
  fetch(BACKEND_URL + '/use-webcam', { method: 'POST' }).then(() => {
    if (s) { s.textContent = '● PC Cam Active'; s.className = 'conn-status connected'; }
  }).catch(() => {
    if (s) { s.textContent = '● Failed'; s.className = 'conn-status failed'; }
  });
}

function exportReport() {
  const data = `SmartFirePredict Alert Report\nHigh: ${_alertCounts.HIGH}\nMedium: ${_alertCounts.MEDIUM}\nLow: ${_alertCounts.LOW}`;
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(data);
  a.download = 'sfp_report.txt';
  a.click();
}
