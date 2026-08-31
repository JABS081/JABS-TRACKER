(function () {
  function escapeHtml(value) {
    return String(value || 'Unknown startup error').replace(/[&<>"]/g, function (c) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
      })[c];
    });
  }

  function showStartupFailure(error) {
    var root = document.getElementById('root');

    if (!root || root.children.length) return;

    var message = error && error.message
      ? error.message
      : String(error || 'Unknown startup error');

    var stack = error && error.stack
      ? '\n\n' + error.stack
      : '';

    var source = error && error.filename
      ? '\n\nSource: ' + error.filename +
        (error.lineno ? ':' + error.lineno : '')
      : '';

    console.error('[JABS TRACKER] Startup failure:', error);

    root.innerHTML =
      '<main style="min-height:100vh;background:#02080e;color:#e9f4f8;font-family:system-ui,sans-serif;display:grid;place-items:center;padding:24px">' +
        '<section style="width:min(720px,100%);background:#07131d;border:1px solid #173140;border-radius:16px;padding:24px;box-shadow:0 20px 60px #0008">' +
          '<div style="color:#43d9ff;font-size:11px;font-weight:800;letter-spacing:.15em">JABS TRACKER · STARTUP DIAGNOSTICS</div>' +
          '<h1 style="margin:10px 0">Dashboard startup failed</h1>' +
          '<p style="color:#8ba5b1;line-height:1.6">The production application could not mount. Authentication and stored data have not been deleted.</p>' +
          '<pre style="white-space:pre-wrap;overflow:auto;background:#030b12;border:1px solid #173140;border-radius:10px;padding:14px;color:#ff9aa7;font-size:12px">' +
            escapeHtml(message + source + stack) +
          '</pre>' +
          '<button onclick="location.reload()" style="margin-top:14px;background:#43d9ff;color:#031018;border:0;border-radius:9px;padding:12px 16px;font-weight:800">RELOAD DASHBOARD</button>' +
        '</section>' +
      '</main>';
  }


  // Final Leaflet safety net: malformed marker coordinates must never
  // take down the entire React dashboard.
  function hardenLeafletMarkers() {
    var L = window.L;
    if (!L || !L.Marker || !L.Marker.prototype) return;
    if (L.__jabsMarkerGuardInstalled) return;

    L.__jabsMarkerGuardInstalled = true;

    var proto = L.Marker.prototype;
    var originalOnAdd = proto.onAdd;
    var originalUpdate = proto.update;
    var originalSetLatLng = proto.setLatLng;
    var originalAnimateZoom = proto._animateZoom;

    function valid(point) {
      return point &&
        Number.isFinite(Number(point.lat)) &&
        Number.isFinite(Number(point.lng)) &&
        Number(point.lat) >= -90 &&
        Number(point.lat) <= 90 &&
        Number(point.lng) >= -180 &&
        Number(point.lng) <= 180;
    }

    proto.onAdd = function(map) {
      if (!valid(this._latlng)) {
        console.warn('[JABS TRACKER] Blocked malformed Leaflet marker:', this._latlng);
        return this;
      }
      return originalOnAdd.call(this,map);
    };

    proto.update = function() {
      if (!valid(this._latlng)) {
        console.warn('[JABS TRACKER] Blocked malformed Leaflet marker update:', this._latlng);
        return this;
      }
      return originalUpdate.call(this);
    };

    proto.setLatLng = function(latlng) {
      try {
        var candidate = L.latLng(latlng);
        if (!valid(candidate)) {
          console.warn('[JABS TRACKER] Rejected malformed marker coordinate:', latlng);
          return this;
        }
        return originalSetLatLng.call(this,candidate);
      } catch (error) {
        console.warn('[JABS TRACKER] Rejected invalid marker coordinate:', latlng);
        return this;
      }
    };

    proto._animateZoom = function(event) {
      if (!valid(this._latlng)) return;
      return originalAnimateZoom.call(this,event);
    };

    console.info('[JABS TRACKER] Leaflet marker safety guard enabled.');
  }

  try {
    hardenLeafletMarkers();
  } catch (error) {
    console.warn('[JABS TRACKER] Leaflet marker guard failed:',error);
  }

  window.__jabsRuntimeError = showStartupFailure;

  window.addEventListener('error', function (event) {
    var message = event && event.message
      ? String(event.message)
      : '';

    var filename = event && event.filename
      ? String(event.filename)
      : '';

    if (message === 'Script error.' && !filename) return;

    var error = new Error(
      message || 'A JavaScript resource failed to load.'
    );

    error.filename = filename;
    error.lineno = event && event.lineno;
    error.colno = event && event.colno;

    window.__jabsLastRuntimeError = error;
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;

    var error =
      reason instanceof Error
        ? reason
        : new Error(String(reason || 'Unhandled promise rejection.'));

    window.__jabsLastRuntimeError = error;
  });

  setTimeout(function () {
    var root = document.getElementById('root');

    if (root && !root.children.length) {
      showStartupFailure(
        window.__jabsLastRuntimeError ||
        new Error(
          'React application did not mount. The production JavaScript module may have failed to load.'
        )
      );
    }
  }, 10000);
})();
