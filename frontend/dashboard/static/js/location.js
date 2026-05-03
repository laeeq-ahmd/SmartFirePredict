/**
 * location.js — Browser Geolocation Handler
 * Requests geolocation on page load, displays coordinates,
 * and pushes updates to the backend every 5 seconds.
 */

const LocationManager = (() => {
  const POST_INTERVAL = 5000; // ms between backend pushes
  const API_ENDPOINT  = '/location';

  let _watchId     = null;
  let _lastLat     = null;
  let _lastLon     = null;
  let _lastAcc     = null;
  let _mapsUrl     = null;
  let _postTimer   = null;
  let _leafletMap  = null;
  let _leafletMarker = null;
  let _leafletCircle = null;
  let _miniMap     = null;
  let _miniMarker  = null;

  // DOM elements (populated on init)
  let _coordsEl    = null;
  let _accuracyEl  = null;
  let _statusEl    = null;
  let _mapsBtn     = null;

  /**
   * Initialize location module and start watching position.
   */
  function init() {
    _coordsEl   = document.getElementById('location-coords');
    _accuracyEl = document.getElementById('location-accuracy');
    _statusEl   = document.getElementById('location-status');
    _mapsBtn    = document.getElementById('btn-maps');

    _initLeaflet();

    if (!navigator.geolocation) {
      _setStatus('Geolocation not supported by this browser.');
      return;
    }

    _setStatus('Acquiring location…');

    _watchId = navigator.geolocation.watchPosition(
      _onSuccess, _onError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    _postTimer = setInterval(_postToBackend, POST_INTERVAL);
  }

  function _initLeaflet() {
    if (typeof L === 'undefined') return;
    const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const opts = { attribution: false, zoomControl: false };

    // Full map
    const mapEl = document.getElementById('location-map');
    if (mapEl) {
      _leafletMap = L.map(mapEl, { ...opts, zoom: 15, center: [20, 78] });
      L.tileLayer(darkTiles).addTo(_leafletMap);
    }

    // Mini map
    const miniEl = document.getElementById('mini-map');
    if (miniEl) {
      _miniMap = L.map(miniEl, { ...opts, zoom: 13, center: [20, 78], dragging: false, scrollWheelZoom: false });
      L.tileLayer(darkTiles).addTo(_miniMap);
    }
  }

  /**
   * Return the latest coordinates object, or null.
   */
  function getCoords() {
    if (_lastLat === null) return null;
    return { lat: _lastLat, lon: _lastLon, accuracy: _lastAcc };
  }

  // ── Callbacks ──────────────────────────────────────────────────────────────

  function _onSuccess(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    _lastLat = latitude; _lastLon = longitude; _lastAcc = accuracy;
    _mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    if (_coordsEl)   _coordsEl.textContent  = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    if (_accuracyEl) _accuracyEl.textContent = `Accuracy: \xb1${Math.round(accuracy)}m`;
    if (_statusEl)   { _statusEl.textContent = 'Location active'; _statusEl.style.color = 'var(--green)'; }
    if (_mapsBtn)    { _mapsBtn.href = _mapsUrl; _mapsBtn.classList.remove('disabled'); }

    const setVal = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    setVal('map-lat',   latitude.toFixed(4)+'\xb0 N');
    setVal('map-lon',   longitude.toFixed(4)+'\xb0 E');
    setVal('map-acc',   Math.round(accuracy)+' m');
    setVal('map-speed', pos.coords.speed ? (pos.coords.speed*3.6).toFixed(1)+' km/h' : '0 km/h');

    if (typeof L !== 'undefined') {
      const ll = [latitude, longitude];
      if (_leafletMap) {
        _leafletMap.setView(ll, 15);
        if (_leafletMarker) _leafletMarker.setLatLng(ll);
        else _leafletMarker = L.circleMarker(ll,{radius:8,color:'#2563eb',fillColor:'#3b82f6',fillOpacity:0.9}).addTo(_leafletMap);
        if (_leafletCircle) _leafletCircle.setLatLng(ll).setRadius(accuracy);
        else _leafletCircle = L.circle(ll,{radius:accuracy,color:'#3b82f6',fillColor:'#3b82f6',fillOpacity:0.12,weight:1}).addTo(_leafletMap);
      }
      if (_miniMap) {
        _miniMap.setView(ll, 13);
        if (_miniMarker) _miniMarker.setLatLng(ll);
        else _miniMarker = L.circleMarker(ll,{radius:5,color:'#2563eb',fillColor:'#3b82f6',fillOpacity:0.9}).addTo(_miniMap);
      }
    }
  }

  function _onError(err) {
    const messages = {
      1: 'Permission denied. Allow location access to enable this feature.',
      2: 'Position unavailable.',
      3: 'Location request timed out.',
    };
    _setStatus(messages[err.code] || 'Unknown error.');
  }

  // ── Backend push ───────────────────────────────────────────────────────────

  async function _postToBackend() {
    if (_lastLat === null) return; // nothing to send yet

    try {
      await fetch(API_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          lat:      _lastLat,
          lon:      _lastLon,
          accuracy: _lastAcc,
        }),
      });
    } catch (err) {
      console.warn('[Location] Failed to post to backend:', err.message);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _setStatus(msg) {
    if (_statusEl) {
      _statusEl.textContent = msg;
      _statusEl.style.color = '';
    }
    if (_coordsEl) {
      _coordsEl.textContent = '— , —';
    }
    if (_mapsBtn) {
      _mapsBtn.classList.add('disabled');
    }
  }

  function destroy() {
    if (_watchId !== null) navigator.geolocation.clearWatch(_watchId);
    if (_postTimer)        clearInterval(_postTimer);
  }

  return { init, getCoords, destroy };
})();
