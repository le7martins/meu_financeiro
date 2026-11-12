import { useState, useEffect, useCallback } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { loadAllProfiles, loadAllowedEmails, allowEmail, revokeEmail, ADMIN_EMAIL } from '../db';

const DAY = 86400000;
const norm = (e) => String(e || '').trim().toLowerCase();
const chip = (color) => ({ fontSize: 'var(--fs-2xs)', color: `var(--${color})`, background: `var(--${color}-soft)`, border: `1px solid var(--${color}-border)`, borderRadius: 4, padding: '1px 6px' });
const smallBtn = (color = 'text-2') => ({ minHeight: 36, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', color: `var(--${color})`, fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' });

export default function AdminScreen() {
  const [profiles, setProfiles] = useState([]);
  const [allowed,  setAllowed]  = useState(new Set());
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [msg,      setMsg]      = useState('');
  const [busy,     setBusy]     = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([loadAllProfiles(), loadAllowedEmails()]);
      setProfiles(p.sort((x, y) => new Date(y.lastLogin) - new Date(x.lastLogin)));
      setAllowed(new Set(a));
    } catch (e) { setError('Sem permissão ou erro: ' + e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(ok); await load(); }
    catch (e) { setMsg('Erro: ' + (e.code || e.message)); }
    setBusy(false);
  };
  const isOk = (p) => p.email === ADMIN_EMAIL || allowed.has(norm(p.email));
  const profileEmails = new Set(profiles.map(p => norm(p.email)));
  const invited = [...allowed].filter(e => !profileEmails.has(e)).sort();
  const pending = profiles.filter(p => !isOk(p));

  const addNew = () => {
    const e = norm(newEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setMsg('E-mail inválido.'); return; }
    run(async () => { await allowEmail(e); setNewEmail(''); }, `${e} liberado.`);
  };
  const releaseAll = () => run(
    () => Promise.all(profiles.filter(p => p.email && !isOk(p)).map(p => allowEmail(p.email))),
    'Todas as contas atuais foram liberadas.');
  const reset = (p) => run(() => sendPasswordResetEmail(auth, p.email), `Link de redefinição enviado para ${p.email}.`);
  const copyUid = (uid) => { navigator.clipboard?.writeText(uid).then(() => setMsg('UID copiado.'), () => setMsg('Não foi possível copiar.')); };

  const fmtDt = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
  const providerIcon = (p) => p === 'google.com' ? '🔵' : p === 'password' ? '📧' : '🔗';

  if (loading) return <div role="status" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>;
  if (error)   return <div role="alert" style={{ padding: 24, color: 'var(--danger)', fontSize: 'var(--fs-base)' }}>{error}</div>;

  return (
    <div style={{ paddingBottom: 90, paddingTop: 4 }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-1)' }}>🛡️ Painel Admin</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginTop: 2 }}>
          {profiles.length} conta{profiles.length !== 1 ? 's' : ''} · {pending.length} aguardando liberação
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '13px 14px' }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>Liberar acesso</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.4 }}>
            Só e-mails liberados usam o app. Pode liberar antes de a pessoa criar a conta.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label="E-mail para liberar" type="email" inputMode="email" autoComplete="off" maxLength={200} placeholder="email@exemplo.com" value={newEmail}
              onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNew()}
              style={{ flex: 1, minWidth: 0, minHeight: 44, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', color: 'var(--text-1)', fontSize: 'var(--fs-base)', fontFamily: 'inherit', boxSizing: 'border-box' }}/>
            <button type="button" disabled={busy || !newEmail.trim()} onClick={addNew} style={{ ...smallBtn('accent'), minHeight: 44, opacity: newEmail.trim() ? 1 : 0.5 }}>Liberar</button>
          </div>
          {pending.length > 0 && (
            <button type="button" disabled={busy} onClick={releaseAll} style={{ ...smallBtn('warning'), marginTop: 8, width: '100%' }}>
              Liberar as {pending.length} conta{pending.length !== 1 ? 's' : ''} que aguarda{pending.length !== 1 ? 'm' : ''}
            </button>
          )}
          {msg && <div role="status" style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>{msg}</div>}
        </div>

        {profiles.map(p => {
          const ok = isOk(p), isAdm = p.email === ADMIN_EMAIL;
          const idle = p.lastLogin && Date.now() - new Date(p.lastLogin) > 30 * DAY;
          return (
            <div key={p.uid} style={{ background: 'var(--surface)', border: `1px solid ${ok ? 'var(--border-subtle)' : 'var(--warning-border)'}`, borderRadius: 'var(--radius-lg)', padding: '13px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {p.photoURL
                ? <img src={p.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
                : <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-3xl)', flexShrink: 0 }}>👤</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>{p.displayName || 'Sem nome'}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', marginBottom: 4, wordBreak: 'break-all' }}>{p.email}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {isAdm && <span style={chip('warning')}>ADMIN</span>}
                  {!isAdm && <span style={chip(ok ? 'success' : 'orange')}>{ok ? 'Liberado' : 'Aguardando'}</span>}
                  {p.provider === 'password' && <span style={chip(p.emailVerified ? 'success' : 'orange')}>{p.emailVerified ? 'E-mail confirmado' : 'E-mail não confirmado'}</span>}
                  {p.fcmToken && <span style={chip('info')}>🔔 Notificações</span>}
                  {idle && <span style={chip('danger')}>Sem acesso há 30+ dias</span>}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>{providerIcon(p.provider)} {p.provider === 'google.com' ? 'Google' : 'E-mail'} · Cadastro: {fmtDt(p.createdAt)}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>Último acesso: {fmtDt(p.lastLogin)}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {!isAdm && (ok
                    ? <button type="button" disabled={busy} style={smallBtn('danger')} onClick={() => run(() => revokeEmail(p.email), `Acesso de ${p.email} revogado.`)}>Revogar acesso</button>
                    : <button type="button" disabled={busy} style={smallBtn('success')} onClick={() => run(() => allowEmail(p.email), `${p.email} liberado.`)}>Liberar</button>)}
                  {p.provider === 'password' && <button type="button" disabled={busy} style={smallBtn()} onClick={() => reset(p)}>Enviar redefinição de senha</button>}
                  <button type="button" style={smallBtn()} onClick={() => copyUid(p.uid)}>Copiar UID</button>
                </div>
              </div>
            </div>
          );
        })}

        {invited.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '13px 14px' }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Convidados que ainda não entraram</div>
            {invited.map(e => (
              <div key={e} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', wordBreak: 'break-all' }}>{e}</span>
                <button type="button" disabled={busy} style={smallBtn('danger')} onClick={() => run(() => revokeEmail(e), `${e} removido.`)}>Remover</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
