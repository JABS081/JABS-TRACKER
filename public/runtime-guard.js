(function () {
  function escapeHtml(value) {
    return String(value || 'Unknown browser error').replace(/[&<>"]/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
    });
  }

  window.__jabsRuntimeError = function (error) {
    var root = document.getElementById('root');
    if (!root || root.children.length) return;

    var message = error && error.message
      ? error.message
      : String(error || 'Unknown browser error');

    console.error('[JABS TRACKER] Runtime failure:', error);

    root.innerHTML =
      '<main style="min-height:100vh;background:#02080e;color:#e9f4f8;font-family:system-ui,sans-serif;display:grid;place-items:center;padding:24px">' +
        '<section style="width:min(680px,100%);background:#07131d;border:1px solid #173140;border-radius:16px;padding:24px;box-shadow:0 20px 60px #0008">' +
          '<div style="color:#43d9ff;font-size:11px;font-weight:800;letter-spacing:.15em">JABS TRACKER · RUNTIME SAFETY</div>' +
          '<h1 style="margin:10px 0">Dashboard startup failed</h1>' +
          '<p style="color:#8ba5b1;line-height:1.6">The application loaded, but the React dashboard could not start. Your authentication and stored data have not been deleted.</p>' +
          '<pre style="white-space:pre-wrap;overflow:auto;background:#030b12;border:1px solid #173140;border-radius:10px;padding:14px;color:#ff9aa7;font-size:12px">' +
            escapeHtml(message) +
          '</pre>' +
          '<button onclick="location.reload()" style="margin-top:14px;background:#43d9ff;color:#031018;border:0;border-radius:9px;padding:12px 16px;font-weight:800">RELOAD DASHBOARD</button>' +
        '</section>' +
      '</main>';
  };

  window.addEventListener('error', function (event) {
    window.__jabsRuntimeError(event.error || event.message);
  });

  window.addEventListener('unhandledrejection', function (event) {
    window.__jabsRuntimeError(event.reason);
  });

  setTimeout(function () {
    var root = document.getElementById('root');
    if (root && !root.children.length) {
      window.__jabsRuntimeError(
        new Error('React application did not mount. Check the browser console for the module or startup error.')
      );
    }
  }, 10000);
})();
