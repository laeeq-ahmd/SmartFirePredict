/**
 * location.js — Browser Geolocation Handler
 * Requests geolocation, displays coordinates, sends to backend every 5s.
 * Uses CartoDB dark/light tiles that switch with the app theme.
 */

const LocationManager = (() => {
  const POST_INTERVAL = 5000;

  // CartoDB tile URLs — no {r} suffix (that was causing 404s)
  const TILES = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  };
  const TILE_OPTS = {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  };

  let _watchId = null;
  let _lastLat = null;
  let _lastLon = null;
  let _lastAcc = null;
  let _postTimer = null;

  // Maps
  let _leafletMap = null;
  let _leafletMarker = null;
  let _leafletCircle = null;
  let _miniMap = null;
  let _miniMarker = null;
  let _fullMap = null;   // Sidebar Map section — lazily created
  let _fullMarker = null;

  // Tile layers keyed per map instance for clean swapping
  const _tileOf = new WeakMap();   // map → tileLayer

  let _coordsEl = null;
  let _accuracyEl = null;
  let _statusEl = null;
  let _mapsBtn = null;

  /* ── SVG pin icon factory ── */
  function _pinIcon(size = 32, color = '#ff6b00') {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.2">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/>
      </svg>`;
    return L.divIcon({
      html: svg,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size],
      className: ''
    });
  }

  /* ── Current theme ── */
  function _isDark() {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }
  function _tileUrl() {
    return _isDark() ? TILES.dark : TILES.light;
  }

  /* ── Add tile layer to a map and track it ── */
  function _addTiles(leafletMap) {
    const layer = L.tileLayer(_tileUrl(), TILE_OPTS).addTo(leafletMap);
    _tileOf.set(leafletMap, layer);
    return layer;
  }

  /* ── Swap all tile layers when theme changes — fixed version ── */
  function _swapTiles() {
    const url = _tileUrl();
    [_leafletMap, _miniMap, _fullMap].forEach(m => {
      if (!m) return;
      const old = _tileOf.get(m);
      if (old) m.removeLayer(old);
      const fresh = L.tileLayer(url, TILE_OPTS).addTo(m);
      _tileOf.set(m, fresh);
    });
  }

  /* ── Watch for theme attribute changes ── */
  function _watchTheme() {
    new MutationObserver(() => _swapTiles())
      .observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
  }

  /* ── Initialize dashboard + mini maps ── */
  function _initLeaflet() {
    if (typeof L === 'undefined') return;

    const mapEl = document.getElementById('location-map');
    if (mapEl) {
      _leafletMap = L.map(mapEl, { zoomControl: true, zoom: 15, center: [20, 78] });
      _addTiles(_leafletMap);
    }

    const miniEl = document.getElementById('mini-map');
    if (miniEl) {
      _miniMap = L.map(miniEl, {
        zoomControl: false, dragging: false, scrollWheelZoom: false,
        zoom: 13, center: [20, 78],
      });
      _addTiles(_miniMap);
    }

    // _fullMap is lazily created on first click of the Map sidebar section
    _watchTheme();
  }

  /* ── Lazy init for the sidebar fullscreen map ──
     Called after the section is made visible. ── */
  function _initFullMap() {
    if (_fullMap) {
      _fullMap.invalidateSize();
      return;
    }
    
    if (typeof L === 'undefined') return;

    const fullEl = document.getElementById('location-map-fullscreen');
    if (!fullEl) return;

    try {
      const center = _lastLat !== null ? [_lastLat, _lastLon] : [20, 78];
      _fullMap = L.map(fullEl, { zoomControl: true, zoom: 15, center });
      
      _addTiles(_fullMap);

      if (_lastLat !== null) {
        const ll = [_lastLat, _lastLon];
        _fullMap.setView(ll, 15);
        _fullMarker = L.marker(ll, { icon: _pinIcon(36, '#ff6b00') }).addTo(_fullMap);
      }

      _fullMap.invalidateSize();
      setTimeout(() => { if (_fullMap) _fullMap.invalidateSize(); }, 250);
      setTimeout(() => { if (_fullMap) _fullMap.invalidateSize(); }, 700);
    } catch (err) {
      console.error('[Location] Failed to init full map:', err);
    }
  }

  function _invalidateMaps() {
    if (_leafletMap) _leafletMap.invalidateSize();
    if (_miniMap) _miniMap.invalidateSize();
    if (_fullMap) _fullMap.invalidateSize();
  }

  function init() {
    _coordsEl = document.getElementById('location-coords');
    _accuracyEl = document.getElementById('location-accuracy');
    _statusEl = document.getElementById('location-status');
    _mapsBtn = document.getElementById('btn-maps');

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

  function getCoords() {
    if (_lastLat === null) return null;
    return { lat: _lastLat, lon: _lastLon, accuracy: _lastAcc };
  }

  function _onSuccess(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    _lastLat = latitude; _lastLon = longitude; _lastAcc = accuracy;
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    if (_coordsEl) _coordsEl.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    if (_accuracyEl) _accuracyEl.textContent = `Accuracy: \xb1${Math.round(accuracy)}m`;
    if (_statusEl) { _statusEl.textContent = 'Location active'; _statusEl.style.color = 'var(--green)'; }
    if (_mapsBtn) { _mapsBtn.href = mapsUrl; _mapsBtn.classList.remove('disabled'); }

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const latStr = latitude.toFixed(4) + '\xb0 N';
    const lonStr = longitude.toFixed(4) + '\xb0 E';
    const accStr = Math.round(accuracy) + ' m';
    const spdStr = pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(1) + ' km/h' : '0 km/h';

    setVal('map-lat', latStr);
    setVal('map-lon', lonStr);
    setVal('map-acc', accStr);
    setVal('map-speed', spdStr);
    setVal('map-lat2', latStr);
    setVal('map-lon2', lonStr);
    setVal('map-acc2', accStr);
    setVal('map-speed2', spdStr);

    if (typeof L !== 'undefined') {
      const ll = [latitude, longitude];

      if (_leafletMap) {
        _leafletMap.setView(ll, 15);
        if (_leafletMarker) {
          _leafletMarker.setLatLng(ll);
        } else {
          _leafletMarker = L.marker(ll, { icon: _pinIcon(36, '#ff6b00') }).addTo(_leafletMap);
        }
        if (_leafletCircle) {
          _leafletCircle.setLatLng(ll).setRadius(accuracy);
        } else {
          _leafletCircle = L.circle(ll, {
            radius: accuracy, color: '#ff6b00',
            fillColor: '#ff6b00', fillOpacity: 0.1, weight: 1,
          }).addTo(_leafletMap);
        }
      }

      if (_miniMap) {
        _miniMap.setView(ll, 13);
        if (_miniMarker) {
          _miniMarker.setLatLng(ll);
        } else {
          _miniMarker = L.marker(ll, { icon: _pinIcon(28, '#ff6b00') }).addTo(_miniMap);
        }
      }

      if (_fullMap) {
        _fullMap.setView(ll, 15);
        if (_fullMarker) {
          _fullMarker.setLatLng(ll);
        } else {
          _fullMarker = L.marker(ll, { icon: _pinIcon(36, '#ff6b00') }).addTo(_fullMap);
        }
      }
    }
  }

  function _onError(err) {
    const messages = {
      1: 'Permission denied. Allow location access.',
      2: 'Position unavailable.',
      3: 'Location request timed out.',
    };
    _setStatus(messages[err.code] || 'Unknown error.');
  }

  async function _postToBackend() {
    if (_lastLat === null) return;
    try {
      await fetch(BACKEND_URL + '/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: _lastLat, lon: _lastLon, accuracy: _lastAcc }),
      });
    } catch (err) {
      console.warn('[Location] Failed to post:', err.message);
    }
  }

  function _setStatus(msg) {
    if (_statusEl) { _statusEl.textContent = msg; _statusEl.style.color = ''; }
    if (_coordsEl) _coordsEl.textContent = '— , —';
    if (_mapsBtn) _mapsBtn.classList.add('disabled');
  }

  function destroy() {
    if (_watchId !== null) navigator.geolocation.clearWatch(_watchId);
    if (_postTimer) clearInterval(_postTimer);
  }

  return { init, getCoords, destroy, _invalidateMaps, _initFullMap };
})();
