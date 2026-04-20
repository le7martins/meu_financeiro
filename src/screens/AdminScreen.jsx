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

  if(loading) return <div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>Carregando...</div>;
  if(error)   return <div style={{padding:24,color:'#f87171',fontSize:13}}>{error}</div>;

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{padding:'20px 16px 12px',borderBottom:'1px solid #0f1825'}}>
        <div style={{fontSize:16,fontWeight:800,color:'var(--text1)'}}>🛡️ Painel Admin</div>
        <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{profiles.length} conta{profiles.length!==1?'s':''} cadastrada{profiles.length!==1?'s':''}</div>
      </div>
      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
        {profiles.map(p=>(
          <div key={p.uid} style={{background:'#0d1118',border:'1px solid #111820',borderRadius:12,padding:'13px 14px',display:'flex',gap:12,alignItems:'flex-start'}}>
            {p.photoURL
              ? <img src={p.photoURL} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              : <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#1a3a6e,#0d2247)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>👤</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text1)',marginBottom:2}}>
                {p.displayName||'Sem nome'} {p.email===ADMIN_EMAIL&&<span style={{fontSize:9,color:'#facc15',background:'rgba(250,204,21,.1)',border:'1px solid rgba(250,204,21,.2)',borderRadius:4,padding:'1px 6px',marginLeft:4}}>ADMIN</span>}
              </div>
              <div style={{fontSize:11,color:'#8ab4f8',marginBottom:4}}>{p.email}</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:10,color:'var(--text3)'}}>{providerIcon(p.provider)} {p.provider==='google.com'?'Google':'E-mail'}</span>
                <span style={{fontSize:10,color:'var(--text3)'}}>Cadastro: {fmtDt(p.createdAt)}</span>
              </div>
              <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>Último acesso: {fmtDt(p.lastLogin)}</div>
              <div style={{fontSize:9,color:'var(--text4)',marginTop:3,fontFamily:'monospace'}}>{p.uid}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
