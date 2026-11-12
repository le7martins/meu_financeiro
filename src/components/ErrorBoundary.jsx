import { Component } from 'react';

// Evita tela branca: erro de render ou chunk que não existe mais após um deploy.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) { console.error('[ErrorBoundary]', error); }

  render() {
    if (!this.state.error) return this.props.children;
    const stale = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(String(this.state.error?.message));
    return (
      <div role="alert" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: 'var(--bg, #080c12)', color: 'var(--text-1, #e6edf5)', fontFamily: 'inherit' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{stale ? 'Há uma nova versão do app' : 'Algo deu errado'}</div>
        <div style={{ fontSize: 14, opacity: 0.75, maxWidth: 320 }}>
          {stale ? 'Recarregue para carregar a versão mais recente. Seus dados estão salvos.' : 'Seus dados estão salvos. Recarregue para continuar.'}
        </div>
        <button type="button" onClick={() => window.location.reload()}
          style={{ minHeight: 44, padding: '0 22px', borderRadius: 12, border: '1px solid var(--accent, #4ade80)', background: 'transparent', color: 'var(--accent, #4ade80)', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
          Recarregar
        </button>
      </div>
    );
  }
}
