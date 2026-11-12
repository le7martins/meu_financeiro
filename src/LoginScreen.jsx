import { useState } from 'react';
import {
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { seedDemo } from './demoData';
import { CSS } from './appCss.js';
import { tint } from './styles.js';

const S = {
  root: { position:'fixed', inset:0, background:'var(--bg)', color:'var(--text-1)', fontFamily:'var(--font-sans)', display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center', padding:'24px 20px', overflowY:'auto' },
  card: { width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:16 },
  logo: { textAlign:'center', marginBottom:8 },
  logoTitle: { fontSize:'var(--fs-5xl)', fontWeight:800, color:'var(--text-1)', letterSpacing:-.5 },
  logoSub: { fontSize:'var(--fs-md)', color:'var(--text-3)', marginTop:4 },
  tabs: { display:'flex', background:'var(--surface)', borderRadius:'var(--radius-md)', padding:3, gap:3 },
  tab: (active) => ({
    flex:1, padding:'9px 0', minHeight:40, borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer', fontSize:'var(--fs-base)',
    fontWeight:700, transition:'all .2s', fontFamily:'inherit',
    background: active ? 'var(--accent-muted)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-3)',
  }),
  input: { width:'100%', background:'var(--input-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)',
    padding:'12px 14px', color:'var(--text-1)', fontSize:'var(--fs-lg)', outline:'none', fontFamily:'inherit',
    boxSizing:'border-box' },
  label: { fontSize:'var(--fs-sm)', color:'var(--text-3)', marginBottom:4, display:'block' },
  btn: (primary) => ({
    width:'100%', padding:'13px', minHeight:44, borderRadius:'var(--radius-md)', cursor:'pointer',
    fontSize:'var(--fs-lg)', fontWeight:700, fontFamily:'inherit', transition:'opacity .15s',
    background: primary ? 'var(--primary-bg)' : 'var(--surface)',
    color: primary ? 'var(--primary-text)' : 'var(--text-3)',
    border: primary ? '1px solid var(--primary-border)' : '1px solid var(--border)',
  }),
  // Botão do Google: branco/cinza são da marca (não seguem o tema).
  googleBtn: { width:'100%', padding:'13px', minHeight:44, borderRadius:'var(--radius-md)', cursor:'pointer',
    fontSize:'var(--fs-lg)', fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center',
    justifyContent:'center', gap:10, background:'#fff', color:'#333', border:'none',
    transition:'opacity .15s' },
  divider: { display:'flex', alignItems:'center', gap:10 },
  divLine: { flex:1, height:1, background:'var(--border)' },
  divText: { fontSize:'var(--fs-sm)', color:'var(--text-4)' },
  error: { background:'var(--danger-soft)', border:'1px solid var(--danger-border)',
    borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'var(--fs-md)', color:'var(--danger)', textAlign:'center' },
  link: { textAlign:'center', fontSize:'var(--fs-md)', color:'var(--accent)', cursor:'pointer', background:'none',
    border:'none', fontFamily:'inherit', padding:'10px 0', minHeight:40 },
};

export default function LoginScreen({ onLogin }) {
  const [tab, setTab]       = useState('enter');   // 'enter' | 'create'
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [pw, setPw]         = useState('');
  const [pw2, setPw2]       = useState('');
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [reset, setReset]   = useState(false);

  const fbErr = (e) => {
    const map = {
      'auth/invalid-email':          'E-mail inválido.',
      'auth/user-not-found':         'Conta não encontrada.',
      'auth/wrong-password':         'Senha incorreta.',
      'auth/email-already-in-use':   'Este e-mail já está cadastrado.',
      'auth/weak-password':          'Senha muito fraca (mín. 8 caracteres).',
      'auth/too-many-requests':      'Muitas tentativas. Tente mais tarde.',
      'auth/popup-closed-by-user':   '',
      'auth/cancelled-popup-request':'',
      'auth/invalid-credential':     'E-mail ou senha incorretos.',
    };
    return map[e.code] ?? 'Não foi possível concluir. Tente novamente.';
  };

  async function handleGoogle() {
    setError(''); setBusy(true);
    try {
      const r = await signInWithPopup(auth, googleProvider);
      onLogin(r.user);
    } catch(e) {
      const msg = fbErr(e);
      if (msg) setError(msg);
    } finally { setBusy(false); }
  }

  function handleDemo() {
    const uid = 'demo_' + Date.now();
    seedDemo(uid);
    // Fake fbUser — bypasses Firebase auth entirely
    onLogin({ uid, isAnonymous:true, displayName:'Conta Demo', email:null, providerData:[], _isDemo:true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);

    if (reset) {
      try {
        await sendPasswordResetEmail(auth, email);
        setInfo('E-mail de redefinição enviado!');
        setReset(false);
      } catch(e) { setError(fbErr(e)); }
      setBusy(false); return;
    }

    try {
      if (tab === 'create') {
        if (pw.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); setBusy(false); return; }
        if (pw !== pw2) { setError('As senhas não coincidem.'); setBusy(false); return; }
        const r = await createUserWithEmailAndPassword(auth, email, pw);
        if (name.trim()) await updateProfile(r.user, { displayName: name.trim() });
        onLogin(r.user);
      } else {
        const r = await signInWithEmailAndPassword(auth, email, pw);
        onLogin(r.user);
      }
    } catch(e) { setError(fbErr(e)); }
    setBusy(false);
  }

  return (
    <div style={S.root}>
      {/* Fora de .appRoot: injeta os tokens (tema escuro) para esta tela */}
      <style>{CSS}</style>
      <div style={S.card}>

        {/* Logo */}
        <div style={S.logo}>
          <img src="/meu_financeiro/icon-192.png" alt="CashUp" style={{width:72,height:72,borderRadius:18,objectFit:'cover',display:'block',margin:'0 auto 12px',boxShadow:`0 8px 32px ${tint('var(--success)',18)}`}}/>
          <div style={S.logoTitle}>CashUp</div>
          <div style={S.logoSub}>Controle suas finanças com segurança</div>
        </div>

        {/* Google */}
        <button type="button" style={S.googleBtn} onClick={handleGoogle} disabled={busy}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {busy ? 'Aguarde...' : 'Continuar com Google'}
        </button>

        {/* Demo button */}
        <button type="button" style={{...S.btn(false), border:'1px solid var(--warning-border)', color:'var(--warning)', background:'var(--warning-soft)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}} onClick={handleDemo} disabled={busy}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {busy ? 'Aguarde...' : 'Experimentar sem cadastro (demo)'}
        </button>

        {/* Divider */}
        <div style={S.divider}>
          <div style={S.divLine}/>
          <span style={S.divText}>ou entre com sua conta</span>
          <div style={S.divLine}/>
        </div>

        {/* Tabs */}
        {!reset && (
          <div style={S.tabs}>
            <button type="button" style={S.tab(tab==='enter')}  aria-pressed={tab==='enter'}  onClick={()=>setTab('enter')}>Entrar</button>
            <button type="button" style={S.tab(tab==='create')} aria-pressed={tab==='create'} onClick={()=>setTab('create')}>Criar conta</button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
          {reset && <div style={{fontSize:'var(--fs-base)',color:'var(--accent)',textAlign:'center',paddingBottom:4}}>
            Informe seu e-mail para redefinir a senha</div>}

          {tab==='create' && !reset && (
            <div>
              <label htmlFor="loginName" style={S.label}>Nome</label>
              <input id="loginName" style={S.input} type="text" placeholder="Seu nome" value={name}
                onChange={e=>setName(e.target.value)} autoComplete="name"/>
            </div>
          )}

          <div>
            <label htmlFor="loginEmail" style={S.label}>E-mail</label>
            <input id="loginEmail" style={S.input} type="email" placeholder="seu@email.com" value={email}
              onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
          </div>

          {!reset && (
            <div>
              <label htmlFor="loginPw" style={S.label}>Senha</label>
              <input id="loginPw" style={S.input} type="password" placeholder="••••••••" value={pw}
                onChange={e=>setPw(e.target.value)} required autoComplete={tab==='create'?'new-password':'current-password'}/>
            </div>
          )}

          {tab==='create' && !reset && (
            <div>
              <label htmlFor="loginPw2" style={S.label}>Confirmar senha</label>
              <input id="loginPw2" style={S.input} type="password" placeholder="••••••••" value={pw2}
                onChange={e=>setPw2(e.target.value)} required autoComplete="new-password"/>
            </div>
          )}

          {error && <div role="alert" style={S.error}>{error}</div>}
          {info  && <div role="status" style={{...S.error, background:'var(--success-soft)', borderColor:'var(--success-border)', color:'var(--success)'}}>{info}</div>}

          <button type="submit" style={S.btn(true)} disabled={busy}>
            {busy ? 'Aguarde...' : reset ? 'Enviar e-mail' : tab==='create' ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        {/* Esqueci senha / Cancelar reset */}
        {!reset && tab==='enter' && (
          <button type="button" style={S.link} onClick={()=>{setReset(true);setError('');setInfo('');}}>
            Esqueci minha senha
          </button>
        )}
        {reset && (
          <button type="button" style={S.link} onClick={()=>setReset(false)}>← Voltar</button>
        )}

      </div>
    </div>
  );
}
