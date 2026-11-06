import { useState, useEffect } from 'react';
import { loadAllProfiles, ADMIN_EMAIL } from '../db';

export default function AdminScreen({ fbUser }) {
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(()=>{
    loadAllProfiles()
      .then(p=>{ setProfiles(p.sort((a,b)=>new Date(b.lastLogin)-new Date(a.lastLogin))); setLoading(false); })
      .catch(e=>{ setError('Sem permissão ou erro: '+e.message); setLoading(false); });
  },[]);

  const fmtDt = (iso) => { try{ const d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }catch{ return iso; } };
  const providerIcon = (p) => p==='google.com'?'🔵':p==='password'?'📧':'🔗';

  if(loading) return <div role="status" style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Carregando...</div>;
  if(error)   return <div role="alert" style={{padding:24,color:'var(--danger)',fontSize:'var(--fs-base)'}}>{error}</div>;

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{padding:'20px 16px 12px',borderBottom:'1px solid var(--border-subtle)'}}>
        <div style={{fontSize:'var(--fs-2xl)',fontWeight:800,color:'var(--text-1)'}}>🛡️ Painel Admin</div>
        <div style={{fontSize:'var(--fs-sm)',color:'var(--text-3)',marginTop:2}}>{profiles.length} conta{profiles.length!==1?'s':''} cadastrada{profiles.length!==1?'s':''}</div>
      </div>
      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
        {profiles.map(p=>(
          <div key={p.uid} style={{background:'var(--surface)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'13px 14px',display:'flex',gap:12,alignItems:'flex-start'}}>
            {p.photoURL
              ? <img src={p.photoURL} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              : <div aria-hidden="true" style={{width:40,height:40,borderRadius:'50%',background:'var(--primary-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--fs-3xl)',flexShrink:0}}>👤</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'var(--fs-base)',fontWeight:700,color:'var(--text-1)',marginBottom:2}}>
                {p.displayName||'Sem nome'} {p.email===ADMIN_EMAIL&&<span style={{fontSize:'var(--fs-2xs)',color:'var(--warning)',background:'var(--warning-soft)',border:'1px solid var(--warning-border)',borderRadius:4,padding:'1px 6px',marginLeft:4}}>ADMIN</span>}
              </div>
              <div style={{fontSize:'var(--fs-sm)',color:'var(--accent)',marginBottom:4,wordBreak:'break-all'}}>{p.email}</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:'var(--fs-xs)',color:'var(--text-3)'}}>{providerIcon(p.provider)} {p.provider==='google.com'?'Google':'E-mail'}</span>
                <span style={{fontSize:'var(--fs-xs)',color:'var(--text-3)'}}>Cadastro: {fmtDt(p.createdAt)}</span>
              </div>
              <div style={{fontSize:'var(--fs-xs)',color:'var(--text-3)',marginTop:2}}>Último acesso: {fmtDt(p.lastLogin)}</div>
              <div style={{fontSize:'var(--fs-2xs)',color:'var(--text-4)',marginTop:3,fontFamily:'monospace',wordBreak:'break-all'}}>{p.uid}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
