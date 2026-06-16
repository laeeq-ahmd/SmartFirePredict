/**
 * alerts.js — Alert Log Manager
 * Scrollable event log with emoji icons, timestamps, and auto-scroll.
 * Maximum 50 entries — oldest removed automatically.
 */

const AlertLog = (() => {
  const MAX_ENTRIES = 50;

  const ICONS = {
    HIGH: '🔴',
    MEDIUM: '⚠️',
    LOW: '✅',
    CALL: '📞',
    FLAME: '🔥',
    INFO: 'ℹ️',
  };

  let _logEl = null;
  let _lastRisk = null;   // Track risk level changes
  let _lastFlame = null;   // Track flame sensor changes
  let _callLogged = false;  // Prevent duplicate "call placed" log entries

  /**
   * Initialize the alert log.
   */
  function init() {
    _logEl = document.getElementById('alert-log');
    if (!_logEl) {
      console.warn('[AlertLog] #alert-log element not found.');
      return;
    }
    _addEntry('INFO', 'SmartFirePredict dashboard started.');
  }

  /**
   * Process a status update from the polling loop.
   * Adds log entries only when state changes.
   * @param {object} status - /status API response
   */
  function processStatus(status) {
    const { risk_level, flame_sensor } = status;

    // ── Risk level change ──────────────────────────────────────────────────
    if (risk_level !== _lastRisk) {
      const messages = {
        HIGH: 'HIGH risk! Fire or flame hazard detected.',
        MEDIUM: 'MEDIUM risk — smoke detected. Monitoring closely.',
        LOW: 'Risk level returned to LOW. System clear.',
      };
      _addEntry(risk_level, messages[risk_level] || `Risk: ${risk_level}`);

      // Log call trigger on HIGH
      if (risk_level === 'HIGH' && !_callLogged) {
        _callLogged = true;
        _addEntry('CALL', 'Automated Twilio alert call triggered.');
      }
      if (risk_level !== 'HIGH') {
        _callLogged = false;
      }

      _lastRisk = risk_level;
    }

    // ── Flame sensor change ────────────────────────────────────────────────
    if (flame_sensor !== _lastFlame) {
      if (flame_sensor) {
        _addEntry('FLAME', 'Hardware flame sensor activated.');
      } else if (_lastFlame !== null) {
        _addEntry('INFO', 'Flame sensor cleared.');
      }
      _lastFlame = flame_sensor;
    }
  }

  /**
   * Manually add an entry to the log.
   * @param {string} type    - Key from ICONS map
   * @param {string} message - Log message
   */
  function addEntry(type, message) {
    _addEntry(type, message);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  function _addEntry(type, message) {
    if (!_logEl) return;

    const icon = ICONS[type] || ICONS.INFO;
    const time = _timeNow();

    const makeEl = () => {
      const entry = document.createElement('div');
      entry.className = 'alert-entry';
      entry.innerHTML = `
        <span class="alert-icon">${icon}</span>
        <span class="alert-time">${time}</span>
        <span class="alert-msg">${_escape(message)}</span>
      `;
      return entry;
    };

    // Primary dashboard log
    _logEl.appendChild(makeEl());

    // Mirror to Full Event Log (Alerts section)
    const fullLog = document.getElementById('alert-log-full');
    if (fullLog) {
      fullLog.appendChild(makeEl());
      while (fullLog.children.length > MAX_ENTRIES) fullLog.removeChild(fullLog.firstChild);
      fullLog.scrollTop = fullLog.scrollHeight;
    }

    // Mirror to System Logs section (Logs sidebar page)
    const sysLog = document.getElementById('logs-section');
    if (sysLog) {
      const sysEntry = document.createElement('div');
      sysEntry.className = 'alert-entry';
      sysEntry.style.cssText = 'font-family:monospace;font-size:0.72rem;padding:4px 6px;border-radius:4px;background:var(--bg-card-2);';
      sysEntry.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> ${icon} <span style="color:var(--text-secondary)">${_escape(message)}</span>`;
      sysLog.appendChild(sysEntry);
      while (sysLog.children.length > MAX_ENTRIES) sysLog.removeChild(sysLog.firstChild);
      sysLog.scrollTop = sysLog.scrollHeight;
    }

    // Enforce max entries on primary log
    while (_logEl.children.length > MAX_ENTRIES) {
      _logEl.removeChild(_logEl.firstChild);
    }

    // Auto-scroll primary log
    _logEl.scrollTop = _logEl.scrollHeight;
  }

  function _timeNow() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  function _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, processStatus, addEntry };
})();
