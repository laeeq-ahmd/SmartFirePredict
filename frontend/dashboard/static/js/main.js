/**
 * main.js — Dashboard Orchestrator
 * Polls /status @ 1s, drives all dashboard components.
 */

// ── Backend URL Configuration ─────────────────────────────────────────────────
// Automatically selects the correct backend URL based on the environment.
//
//  Environment              │ window.location          │ BACKEND_URL
//  ─────────────────────────┼──────────────────────────┼────────────────────────
//  Local run.py (direct)    │ localhost:8000            │ "" (relative, FastAPI
//                           │                           │  serves the frontend)
//  Local Live Server        │ localhost:5500            │ http://localhost:8000
//  Local file:// open       │ file:///...               │ http://localhost:8000
//  Local Docker (Nginx)     │ localhost:3000            │ "" (relative, Nginx
//                           │                           │  proxies to backend)
//  AWS / OCI cloud          │ <ip>:3000                 │ "" (relative, Nginx
//                           │                           │  proxies to backend)
//
const Config = (() => {
  const { protocol, hostname, port } = window.location;

  // Case 1: Opened directly from disk (no server)
  if (protocol === 'file:') {
    return { backendUrl: 'http://localhost:8000' };
  }

  // Case 2: Local dev server on a non-standard port
  // (e.g. VS Code Live Server :5500, Python http.server :8080)
  // In these cases the frontend is on a different port from FastAPI,
  // so we must hit FastAPI's explicit address.
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isNonDockerPort = port !== '' && port !== '3000' && port !== '8000';
  if (isLocalhost && isNonDockerPort) {
    return { backendUrl: 'http://localhost:8000' };
  }

  // Case 3: Everything else — served by FastAPI directly (:8000) or Nginx
  // (:3000 locally, any port on AWS/OCI). Use relative paths so the request
  // goes to the same host/port serving the page, and Nginx/FastAPI handles it.
  return { backendUrl: '' };
})();

const POLL_INTERVAL   = 1000;
const BACKEND_URL     = Config.backendUrl;
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
  _initSidebarNav();
  _initSettings();
  _startPolling();
  _startUptime();
});

function _cacheDOM() {
  const ids = [
    'risk-level-text','risk-label-sub','risk-timestamp','risk-banner-card',
    'score-label','risk-icon',
    'sensor-flame-dot','sensor-flame-text',
    'sensor-smoke-dot','sensor-smoke-text',
    'sensor-flame-hw-dot','sensor-flame-hw-text',
    'sensor-gas-dot','sensor-gas-text',
    'sensor-esp32-dot','sensor-esp32-text',
    'sensor-cam-dot','sensor-cam-text',
    'esp32-chip','esp32-header-dot','esp32-header-label',
    'detection-list',
    'metric-temp','metric-humidity','metric-flame','metric-flame-status',
    'metric-smoke','metric-smoke-status','metric-uptime',
    'map-lat','map-lon','map-acc','map-speed',
    'map-lat2','map-lon2','map-acc2','map-speed2',
    'donut-total','legend-high','legend-med','legend-low','legend-total',
    'thermal-max-temp','cooldown-bar',
    'logs-section',
  ];
  ids.forEach(id => { DOM[id] = document.getElementById(id); });

}

// ── Sidebar Navigation ────────────────────────────────────────────────────────
function _initSidebarNav() {
  const navItems = document.querySelectorAll('.nav-item[data-section]');
  const sections = document.querySelectorAll('.dash-section');

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const target = item.getAttribute('data-section');

      // Toggle active class on nav items
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Show/hide sections
      sections.forEach(sec => {
        sec.style.display = sec.getAttribute('data-section') === target ? '' : 'none';
      });

      // Initialize + invalidate the fullscreen map when its section becomes visible
      if (target === 'map') {
        // Delay slightly so browser can compute layout for the newly visible section.
        setTimeout(() => {
          if (typeof LocationManager !== 'undefined') {
            if (LocationManager._initFullMap) LocationManager._initFullMap();
            if (LocationManager._invalidateMaps) LocationManager._invalidateMaps();
          }
        }, 100);
        
        setTimeout(() => {
          if (typeof LocationManager !== 'undefined' && LocationManager._invalidateMaps) {
            LocationManager._invalidateMaps();
          }
        }, 500);
      }
    });
  });
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
  // Sync Demo Mode Badge
  const demoBadge = document.getElementById('demo-mode-badge');
  if (demoBadge) {
    demoBadge.style.display = s.demo_mode ? 'flex' : 'none';
  }

  // Sync camera UI state with backend reality
  if (s.camera_ok !== _cameraEnabled) {
    _cameraEnabled = !!s.camera_ok;
    if (_cameraEnabled) {
      _setCamerasOnline();
    } else {
      _setCamerasOffline();
    }
  }

  // Always update hardware sensor readings (ESP32 is independent of camera)
  _updateSensors(
    s.flame_sensor,   // AI fire
    s.smoke_detected, // AI smoke
    s.flame_hw,       // ESP32 hardware flame sensor (1 = flame detected)
    s.gas,            // ESP32 gas sensor (1 = gas detected)
    s.esp32_connected,
    s.camera_ok
  );
  _updateMetrics(s.temp, s.humidity, s.flame_sensor, s.flame_hw, s.gas, s.detections);
  _updateCooldown(s.cooldown_active, s.cooldown_remaining, s.last_sent_class);
  AlertLog.processStatus(s);
  _updateTwilioUI(s.twilio_enabled);

  // When camera is OFF, freeze risk score and skip AI-based alerts
  if (!_cameraEnabled) return;

  _updateRisk(s.risk_level, s.score, s.timestamp);
  Gauge.update(s.score, s.risk_level);
  RiskChart.addPoint(s.score);
  _updateDetections(s.detections);
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

function _updateSensors(flameAI, smokeAI, flameHW, gasHW, esp32, camera) {
  // AI detections
  _setSensor('sensor-flame-dot','sensor-flame-text', flameAI ? 'err':'ok',  flameAI ? 'ACTIVE':'CLEAR');
  _setSensor('sensor-smoke-dot','sensor-smoke-text', smokeAI ? 'warn':'ok', smokeAI ? 'ACTIVE':'CLEAR');
  // ESP32 hardware sensors (1 = triggered, 0 = clear, null = esp32 offline)
  const hwFlameActive = flameHW === 1;
  const hwGasActive   = gasHW   === 1;
  _setSensor('sensor-flame-hw-dot','sensor-flame-hw-text', hwFlameActive ? 'err':'ok',  hwFlameActive ? 'FLAME!' : (esp32 ? 'CLEAR' : '—'));
  _setSensor('sensor-gas-dot',     'sensor-gas-text',      hwGasActive   ? 'err':'ok',  hwGasActive   ? 'GAS!'  : (esp32 ? 'CLEAR' : '—'));
  // Connectivity
  _setSensor('sensor-esp32-dot','sensor-esp32-text', esp32  ? 'ok':'offline', esp32  ? 'Online':'Offline');
  _setSensor('sensor-cam-dot',  'sensor-cam-text',   camera ? 'ok':'offline', camera ? 'Online':'Offline');

  const chip = DOM['esp32-chip'];
  if (chip) chip.className = `esp32-chip ${esp32 ? '' : 'offline'}`;
  if (DOM['esp32-header-dot']) DOM['esp32-header-dot'].style.background = esp32 ? 'var(--green)' : 'var(--red)';
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
    const cls   = det.class_name || 'unknown';
    const conf  = det.confidence  || 0;
    const lower = cls.toLowerCase();
    const badgeCls = lower.includes('fire')||lower.includes('flame') ? 'badge-fire' : lower.includes('smoke') ? 'badge-smoke' : 'badge-default';
    const el = document.createElement('span');
    el.className = `detection-badge ${badgeCls}`;
    el.textContent = `${cls} ${conf.toFixed(2)}`;
    list.appendChild(el);
  });
}

function _updateMetrics(temp, humidity, flameAI, flameHW, gasHW, dets) {
  // Combine AI + hardware for display
  const anyFlame = flameAI || flameHW === 1;
  const hasSmoke = gasHW === 1 || (dets && dets.some(d => (d.class_name||'').toLowerCase().includes('smoke')));

  if (DOM['metric-temp'])
    DOM['metric-temp'].textContent = temp != null ? `${temp.toFixed(1)}°C` : '—';
  if (DOM['metric-humidity'])
    DOM['metric-humidity'].textContent = humidity != null ? `${humidity.toFixed(2)} Δ` : '—';
  if (DOM['metric-flame']) DOM['metric-flame'].textContent = anyFlame ? '🔥 Flame!' : 'No Flame';
  if (DOM['metric-flame-status']) {
    DOM['metric-flame-status'].textContent = anyFlame ? 'Detected!' : 'Normal';
    DOM['metric-flame-status'].style.color  = anyFlame ? 'var(--red)' : 'var(--green)';
  }
  if (DOM['metric-smoke']) DOM['metric-smoke'].textContent = hasSmoke ? '💨 Smoke/Gas!' : 'No Smoke';
  if (DOM['metric-smoke-status']) {
    DOM['metric-smoke-status'].textContent = hasSmoke ? 'Detected!' : 'Normal';
    DOM['metric-smoke-status'].style.color  = hasSmoke ? 'var(--yellow)' : 'var(--green)';
  }
}

function _updateCooldown(active, remaining, lastClass) {
  const bar = DOM['cooldown-bar'];
  if (!bar) return;
  if (active && remaining > 0) {
    const pct = Math.round((remaining / 30) * 100);
    const cls = lastClass === 'fire' ? 'var(--red)' : 'var(--yellow)';
    bar.style.display = '';
    bar.innerHTML = `
      <span style="font-size:0.68rem;color:var(--text-muted)">📵 Telegram cooldown (${lastClass})</span>
      <div style="flex:1;background:var(--bg-card-2);border-radius:4px;height:6px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${cls};border-radius:4px;transition:width 1s linear;"></div>
      </div>
      <span style="font-size:0.68rem;color:var(--text-muted);white-space:nowrap;">${remaining}s</span>`;
  } else {
    bar.style.display = 'none';
  }
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
    _donutChart.data.datasets[0].data = [_alertCounts.HIGH, _alertCounts.MEDIUM, _alertCounts.LOW || 0];
    _donutChart.update();
  }
  if (DOM['donut-total']) DOM['donut-total'].textContent = total;
  if (DOM['legend-high'])  DOM['legend-high'].textContent  = _alertCounts.HIGH;
  if (DOM['legend-med'])   DOM['legend-med'].textContent   = _alertCounts.MEDIUM;
  if (DOM['legend-low'])   DOM['legend-low'].textContent   = _alertCounts.LOW;
  if (DOM['legend-total']) DOM['legend-total'].textContent = total;
}

// ── Camera source toggle ──────────────────────────────────────────────────────
let _cameraMode = 'rtsp'; // 'rtsp' | 'pccam'

function _initCameraToggles() {
  const btnRtsp  = document.getElementById('btn-rtsp');
  const btnPc    = document.getElementById('btn-pccam');
  const rtspCtrl = document.getElementById('rtsp-controls');
  const pcCtrl   = document.getElementById('pccam-controls');

  // Restore persisted mode
  _cameraMode = localStorage.getItem('sfp-cam-mode') || 'rtsp';
  _applyCameraMode(_cameraMode);

  if (btnRtsp) btnRtsp.addEventListener('click', () => {
    _cameraMode = 'rtsp';
    localStorage.setItem('sfp-cam-mode', 'rtsp');
    _applyCameraMode('rtsp');
  });
  if (btnPc) btnPc.addEventListener('click', () => {
    _cameraMode = 'pccam';
    localStorage.setItem('sfp-cam-mode', 'pccam');
    _applyCameraMode('pccam');
  });
}

function _applyCameraMode(mode) {
  const btnRtsp  = document.getElementById('btn-rtsp');
  const btnPc    = document.getElementById('btn-pccam');
  const rtspCtrl = document.getElementById('rtsp-controls');
  const pcCtrl   = document.getElementById('pccam-controls');

  if (mode === 'rtsp') {
    btnRtsp?.classList.add('active');
    btnPc?.classList.remove('active');
    if (rtspCtrl) rtspCtrl.style.display = 'flex';
    if (pcCtrl)   pcCtrl.style.display   = 'none';
  } else {
    btnPc?.classList.add('active');
    btnRtsp?.classList.remove('active');
    if (pcCtrl)   pcCtrl.style.display   = 'flex';
    if (rtspCtrl) rtspCtrl.style.display = 'none';
  }
}

// ── Camera ON/OFF Toggle State ────────────────────────────────────────────────
let _cameraEnabled   = null;  // start null so first poll forces an update
let _frozenRiskScore = null;

// ── Utility functions (called from HTML onclick) ──────────────────────────────
function saveRtsp() {
  const val = document.getElementById('rtsp-input')?.value?.trim();
  if (!val) return;
  _setConnStatus('Connecting…', '');
  fetch(BACKEND_URL + '/set-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rtsp: val })
  }).then(r => r.json()).then(d => {
    if (d.status === 'success') {
      _setConnStatus('RTSP Connected', 'connected');
      _setCamerasOnline();
    } else {
      _setConnStatus('Failed: ' + d.message, 'failed');
    }
  }).catch(() => _setConnStatus('Connection Error', 'failed'));
}

// ── Shared: show/hide BOTH camera feeds together ─────────────────────────────
function _setCamerasOffline() {
  // Detection feed
  ['detection-img', 'detection-img-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['cam-offline-placeholder', 'cam-offline-placeholder-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  });
  const detBadge = document.getElementById('det-live-badge-2');
  if (detBadge) detBadge.style.display = 'none';

  // Thermal feed
  ['thermal-img', 'thermal-img-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['thermal-offline-placeholder', 'thermal-offline-placeholder-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  });
  ['thermal-live-badge', 'thermal-live-badge-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function _setCamerasOnline() {
  const ts = Date.now(); // cache-buster for both feeds

  // Detection feed — force new MJPEG connection to drop the offline JPEG
  ['detection-img', 'detection-img-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.src = 'http://localhost:8000/video?t=' + ts;
      el.style.display = 'block';
    }
  });
  ['cam-offline-placeholder', 'cam-offline-placeholder-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const detBadge = document.getElementById('det-live-badge-2');
  if (detBadge) detBadge.style.display = '';

  // Thermal feed — force new MJPEG connection
  ['thermal-img', 'thermal-img-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.src = 'http://localhost:8000/thermal?t=' + ts;
      el.style.display = 'block';
    }
  });
  ['thermal-offline-placeholder', 'thermal-offline-placeholder-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['thermal-live-badge', 'thermal-live-badge-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
}

function startPcCam() {
  _setConnStatus('Starting…', '');
  fetch(BACKEND_URL + '/use-webcam', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      if (d.status === 'success') {
        _setConnStatus('PC Cam Active', 'connected');
        _setCamerasOnline();
      } else {
        _setConnStatus('Failed: ' + d.message, 'failed');
      }
    })
    .catch(() => _setConnStatus('Connection Error', 'failed'));
}

function stopStream() {
  fetch(BACKEND_URL + '/stop-stream', { method: 'POST' })
    .then(() => {
      _setConnStatus('Stopped', '');
      _setCamerasOffline();
      // Sync the Cameras section panel status if it's loaded
      if (typeof RtspPanel !== 'undefined' && RtspPanel.onStreamStopped) {
        RtspPanel.onStreamStopped();
      }
    });
}

function _setConnStatus(msg, cls) {
  const el    = document.getElementById('cam-conn-status');
  const label = document.getElementById('cam-conn-label');
  if (label) label.textContent = msg;
  if (el) el.className = 'conn-status' + (cls ? ' ' + cls : '');
}

function exportReport() {
  const data = `SmartFirePredict Alert Report\nHigh: ${_alertCounts.HIGH}\nMedium: ${_alertCounts.MEDIUM}\nLow: ${_alertCounts.LOW}`;
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(data);
  a.download = 'sfp_report.txt';
  a.click();
}

// ── Twilio toggle ─────────────────────────────────────────────────────────────
let _twilioEnabled = false;

function toggleTwilio() {
  fetch(BACKEND_URL + '/twilio/toggle', { method: 'POST' })
    .then(r => r.json())
    .then(d => _applyTwilioState(d.twilio_enabled))
    .catch(e => console.warn('[Twilio toggle failed]', e));
}

function _applyTwilioState(enabled) {
  _twilioEnabled = enabled;
  const btn   = document.getElementById('twilio-toggle-btn');
  const label = document.getElementById('twilio-status-label');
  const bar   = document.getElementById('twilio-status');
  
  // Sync the settings bar checkbox
  const settingsCb  = document.getElementById('setting-twilio');
  const settingsLbl = document.getElementById('label-setting-twilio');
  if (settingsCb)  settingsCb.checked    = enabled;
  if (settingsLbl) settingsLbl.textContent = enabled ? 'ON' : 'OFF';

  // Sync the settings PAGE checkbox
  const pageCb  = document.getElementById('setting-twilio-page');
  const pageLbl = document.getElementById('label-setting-twilio-page');
  if (pageCb)  pageCb.checked      = enabled;
  if (pageLbl) pageLbl.textContent = enabled ? 'ON' : 'OFF';

  if (enabled) {
    if (btn) {
      btn.textContent      = '● ON';
      btn.style.background = 'var(--green)';
      btn.style.color      = '#000';
      btn.style.boxShadow  = '0 0 8px var(--green-glow)';
    }
    if (label) label.textContent = 'Active';
    if (bar)   bar.className     = 'conn-status connected';
  } else {
    if (btn) {
      btn.textContent      = '● OFF';
      btn.style.background = '#333';
      btn.style.color      = '#777';
      btn.style.boxShadow  = 'none';
    }
    if (label) label.textContent = 'Disabled';
    if (bar)   bar.className     = 'conn-status';
  }
}

// Called from _apply() on every status poll to keep UI in sync with backend
function _updateTwilioUI(twilioEnabled) {
  if (twilioEnabled !== _twilioEnabled) {
    _applyTwilioState(twilioEnabled);
  }
}

// ── Alert Settings ────────────────────────────────────────────────────────────
function _initSettings() {
  fetch(BACKEND_URL + '/settings')
    .then(r => r.json())
    .then(d => {
      _applySettingUI('fire', d.fire_alerts);
      _applySettingUI('smoke', d.smoke_alerts);
      _applySettingUI('telegram', d.telegram_alerts);
      _applySettingUI('demo-mode', d.demo_mode);
      _applyDemoModeState(d.demo_mode);
    })
    .catch(e => console.warn('[Settings fetch failed]', e));
    
  fetch(BACKEND_URL + '/twilio/state')
    .then(r => r.json())
    .then(d => _applyTwilioState(d.twilio_enabled));
}


function updateSetting(key, value) {

  const payload = {};
  payload[key] = value;
  
  fetch(BACKEND_URL + '/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(d => {
    if (d.status === 'success') {
      const s = d.settings;
      _applySettingUI('fire', s.fire_alerts);
      _applySettingUI('smoke', s.smoke_alerts);
      _applySettingUI('telegram', s.telegram_alerts);
      _applySettingUI('demo-mode', s.demo_mode);
      _applyDemoModeState(s.demo_mode);
    }
  })
  .catch(e => console.warn('[Settings update failed]', e));
}

function _applySettingUI(type, isEnabled) {
  // Update both the dashboard bar and the settings page copies
  const ids = ['setting-' + type, 'setting-' + type + '-page'];
  const lblIds = ['label-setting-' + type, 'label-setting-' + type + '-page'];
  ids.forEach(id => {
    const cb = document.getElementById(id);
    if (cb) cb.checked = isEnabled;
  });
  lblIds.forEach(id => {
    const lbl = document.getElementById(id);
    if (lbl) {
      lbl.textContent = isEnabled ? 'Enabled' : 'Disabled';
      lbl.style.color = isEnabled ? 'var(--text-primary)' : 'var(--text-muted)';
    }
  });
}

function _applyDemoModeState(isDemoMode) {
  const toggleIds = [
    'setting-fire', 'setting-smoke', 'setting-telegram', 'setting-twilio',
    'setting-fire-page', 'setting-smoke-page', 'setting-telegram-page', 'setting-twilio-page'
  ];
  
  toggleIds.forEach(id => {
    const cb = document.getElementById(id);
    if (cb) {
      cb.disabled = isDemoMode;
      // Visually gray out the parent container
      const parent = cb.closest('.toggle-row') || cb.closest('.settings-page-toggle');
      if (parent) {
        parent.style.opacity = isDemoMode ? '0.5' : '1';
        parent.style.pointerEvents = isDemoMode ? 'none' : 'auto';
      }
    }
  });


}
