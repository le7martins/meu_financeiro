import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { CSS } from './appCss.js';

const btn = (primary) => ({
  width: '100%', padding: 13, minHeight: 44, borderRadius: 'var(--radius-md)', cursor: 'pointer',
  fontSize: 'var(--fs-lg)', fontWeight: 700, fontFamily: 'inherit',
  background: primary ? 'var(--primary-bg)' : 'var(--surface)',
  color: primary ? 'var(--primary-text)' : 'var(--text-3)',
  border: primary ? '1px solid var(--primary-border)' : '1px solid var(--border)',
});

// Tela exibida a quem entrou com e-mail/senha e ainda não confirmou o e-mail.
export default function VerifyEmailScreen({ user, onChecked, onLogout }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn, okMsg) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(okMsg()); }
    catch (e) {
      setMsg(e.code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não foi possível concluir. Tente novamente.');
    }
    setBusy(false);
  };
  const resend = () => run(() => sendEmailVerification(user), () => 'E-mail reenviado. Confira também o spam.');
  const check = () => run(async () => { await user.reload(); onChecked(); }, () => (user.emailVerified ? '' : 'Ainda não confirmado. Abra o link que enviamos por e-mail.'));

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)' }}>
      <style>{CSS}</style>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">✉️</div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>Confirme seu e-mail</h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-md)', color: 'var(--text-3)', lineHeight: 1.5 }}>
          Enviamos um link de confirmação para <strong style={{ color: 'var(--text-1)' }}>{user.email}</strong>. Abra o link e volte aqui.
        </p>
        {msg && <div role="status" style={{ fontSize: 'var(--fs-md)', color: 'var(--text-2)' }}>{msg}</div>}
        <button type="button" disabled={busy} style={btn(true)} onClick={check}>Já confirmei</button>
        <button type="button" disabled={busy} style={btn(false)} onClick={resend}>Reenviar e-mail</button>
        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', minHeight: 40, fontFamily: 'inherit', fontSize: 'var(--fs-md)' }} onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}
