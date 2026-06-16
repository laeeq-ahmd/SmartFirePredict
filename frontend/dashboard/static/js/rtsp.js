/**
 * rtsp.js — RTSP Camera Configuration Panel
 * Handles the camera config form in the Cameras sidebar section.
 * Works alongside existing camera controls in main.js (saveRtsp, stopStream, startPcCam).
 */

const RtspPanel = (() => {

  const BACKEND = 'http://localhost:8000';

  // Field element refs
  let _ip, _port, _username, _password, _channel, _subtype, _urlPreview;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    _ip = document.getElementById('rtsp-ip');
    _port = document.getElementById('rtsp-port');
    _username = document.getElementById('rtsp-username');
    _password = document.getElementById('rtsp-password');
    _channel = document.getElementById('rtsp-channel');
    _subtype = document.getElementById('rtsp-subtype');
    _urlPreview = document.getElementById('rtsp-url-preview');

    if (!_ip) return; // Panel not in DOM

    // Live URL preview on any field change
    [_ip, _port, _username, _password, _channel, _subtype].forEach(el => {
      if (el) el.addEventListener('input', _updatePreview);
      if (el) el.addEventListener('change', _updatePreview);
    });

    // Load saved settings from backend
    _loadSettings();
  }

  // ── Build URL from current field values ────────────────────────────────────
  function _buildUrl() {
    const ip = (_ip?.value || '').trim();
    const port = parseInt(_port?.value || '554', 10);
    const username = (_username?.value || '').trim();
    const password = (_password?.value || '').trim();
    const channel = parseInt(_channel?.value || '1', 10);
    const subtype = parseInt(_subtype?.value || '0', 10);

    if (!ip) return '';
    const creds = username ? `${username}:${password}@` : '';
    return `rtsp://${creds}${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
  }

  // ── Update the URL preview element ─────────────────────────────────────────
  function _updatePreview() {
    if (!_urlPreview) return;
    const url = _buildUrl();
    if (url) {
      _urlPreview.textContent = url;
      _urlPreview.style.color = 'var(--text-primary)';
    } else {
      _urlPreview.textContent = 'Fill in the IP address to generate a URL';
      _urlPreview.style.color = 'var(--text-muted)';
    }
  }

  // ── Get current field values as a payload object ───────────────────────────
  function _getPayload() {
    return {
      ip: (_ip?.value || '').trim(),
      port: parseInt(_port?.value || '554', 10),
      username: (_username?.value || '').trim(),
      password: (_password?.value || '').trim(),
      channel: parseInt(_channel?.value || '1', 10),
      subtype: parseInt(_subtype?.value || '0', 10),
    };
  }

  // ── Load saved settings from backend ───────────────────────────────────────
  async function _loadSettings() {
    try {
      const res = await fetch(BACKEND + '/rtsp-settings');
      const data = await res.json();
      if (_ip && data.ip) _ip.value = data.ip;
      if (_port && data.port) _port.value = data.port;
      if (_username && data.username) _username.value = data.username;
      if (_password && data.password) _password.value = data.password;
      if (_channel && data.channel) _channel.value = data.channel;
      if (_subtype && data.subtype != null) _subtype.value = data.subtype;
      _updatePreview();
      // If settings have a URL and camera is currently online, show connected
      if (data.rtsp_url) {
        _setPanelStatus('Settings loaded', '');
      }
    } catch (e) {
      console.warn('[RtspPanel] Could not load saved settings:', e);
    }
  }

  // ── Set panel status indicator ─────────────────────────────────────────────
  function _setPanelStatus(msg, cls) {
    const el = document.getElementById('rtsp-panel-status');
    const label = document.getElementById('rtsp-panel-label');
    if (label) label.textContent = msg;
    if (el) el.className = 'conn-status' + (cls ? ' ' + cls : '');
  }

  // ── Public: Test connection ────────────────────────────────────────────────
  async function testConnection() {
    const payload = _getPayload();
    if (!payload.ip) {
      _setPanelStatus('Enter an IP address first', 'failed');
      return;
    }

    const btn = document.getElementById('btn-rtsp-test');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Testing…'; }
    _setPanelStatus('Testing connection…', '');

    try {
      const res = await fetch(BACKEND + '/rtsp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.status === 'success') {
        _setPanelStatus('Connection successful', 'connected');
      } else {
        _setPanelStatus((data.message || 'Failed'), 'failed');
      }
    } catch (e) {
      _setPanelStatus(' Network error', 'failed');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
    }
  }

  // ── Public: Save settings + connect stream ─────────────────────────────────
  async function connectFromPanel() {
    const payload = _getPayload();
    if (!payload.ip) {
      _setPanelStatus('Enter an IP address first', 'failed');
      return;
    }

    const btn = document.getElementById('btn-rtsp-connect');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Connecting…'; }
    _setPanelStatus('Saving & connecting…', '');

    try {
      // 1. Save settings
      const saveRes = await fetch(BACKEND + '/rtsp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saveData = await saveRes.json();
      const rtspUrl = saveData.rtsp_url;

      // 2. Also populate the dashboard bar URL input for consistency
      const dashInput = document.getElementById('rtsp-input');
      if (dashInput) dashInput.value = rtspUrl;

      // 3. Start stream
      const streamRes = await fetch(BACKEND + '/set-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtsp: rtspUrl }),
      });
      const streamData = await streamRes.json();

      if (streamData.status === 'success') {
        _setPanelStatus('● RTSP Connected', 'connected');
        // Notify main.js to refresh camera feed
        if (typeof _setCamerasOnline === 'function') _setCamerasOnline();
        if (typeof _setConnStatus === 'function') _setConnStatus('RTSP Connected', 'connected');
      } else {
        _setPanelStatus((streamData.message || 'Failed to connect'), 'failed');
      }
    } catch (e) {
      _setPanelStatus(' Network error', 'failed');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save & Connect'; }
    }
  }

  // ── Public: Update status from stream stop ─────────────────────────────────
  function onStreamStopped() {
    _setPanelStatus('Stopped', '');
  }

  return { init, testConnection, connectFromPanel, onStreamStopped };
})();

// ── Global functions called from HTML onclick ─────────────────────────────────
function testRtspConnection() { RtspPanel.testConnection(); }
function connectRtspFromPanel() { RtspPanel.connectFromPanel(); }

// ── Auto-init on DOMContentLoaded ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => RtspPanel.init());
