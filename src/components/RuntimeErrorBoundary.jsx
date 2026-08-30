import React from 'react';

export default class RuntimeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[JABS TRACKER] React render failure:', error);
    console.error('[JABS TRACKER] Component stack:', info?.componentStack || '');
    window.__jabsReactError = error;
    window.__jabsReactComponentStack = info?.componentStack || '';
  }

  render() {
    if (!this.state.error) return this.props.children;

    const error = this.state.error;

    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#02080e',
          color: '#e9f4f8',
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          padding: 24
        }}
      >
        <section
          style={{
            width: 'min(720px, 100%)',
            background: '#07131d',
            border: '1px solid #173140',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 20px 60px #0008'
          }}
        >
          <div
            style={{
              color: '#43d9ff',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '.15em'
            }}
          >
            JABS TRACKER · REACT DIAGNOSTICS
          </div>

          <h1 style={{ margin: '10px 0' }}>
            Dashboard render failed
          </h1>

          <p style={{ color: '#8ba5b1', lineHeight: 1.6 }}>
            The application loaded successfully, but a dashboard component
            threw an error while rendering. Your authentication and stored
            data have not been deleted.
          </p>

          <pre
            style={{
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              background: '#030b12',
              border: '1px solid #173140',
              borderRadius: 10,
              padding: 14,
              color: '#ff9aa7',
              fontSize: 12
            }}
          >
            {error?.stack || error?.message || String(error)}
          </pre>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 14,
              background: '#43d9ff',
              color: '#031018',
              border: 0,
              borderRadius: 9,
              padding: '12px 16px',
              fontWeight: 800
            }}
          >
            RELOAD DASHBOARD
          </button>
        </section>
      </main>
    );
  }
}
