import { CSS } from './appCss.js';

const btn = (primary) => ({
  width: '100%', padding: 13, minHeight: 44, borderRadius: 'var(--radius-md)', cursor: 'pointer',
  fontSize: 'var(--fs-lg)', fontWeight: 700, fontFamily: 'inherit',
  background: primary ? 'var(--primary-bg)' : 'var(--surface)',
  color: primary ? 'var(--primary-text)' : 'var(--text-3)',
  border: primary ? '1px solid var(--primary-border)' : '1px solid var(--border)',
});

// Conta criada, mas o e-mail ainda não está na lista de convidados do administrador.
export default function PendingAccessScreen({ email, onRetry, onLogout }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)' }}>
      <style>{CSS}</style>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">🔒</div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>Aguardando liberação</h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-md)', color: 'var(--text-3)', lineHeight: 1.5 }}>
          O acesso do e-mail <strong style={{ color: 'var(--text-1)' }}>{email}</strong> ainda não foi liberado pelo administrador. Peça a liberação e toque em "Verificar novamente".
        </p>
        <button type="button" style={btn(true)} onClick={onRetry}>Verificar novamente</button>
        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', minHeight: 40, fontFamily: 'inherit', fontSize: 'var(--fs-md)' }} onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}
