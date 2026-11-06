import S from '../styles.js';

export default function AppHeader({ fbUser, syncStatus, healthScore, activeTab, onShowHealth, searchOpen, onToggleSearch, theme, onToggleTheme }) {
  return (
      <header style={S.header}>
        <div style={S.headerLeft}>
          <img src="/meu_financeiro/icon-192.png" alt="CashUp" style={{width:32,height:32,borderRadius:8,objectFit:"cover"}}/>
          <div><div style={S.appName}>CashUp</div><div style={S.appSub}>Controle seus lançamentos</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Demo badge */}
          {fbUser._isDemo&&(
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,background:"rgba(250,204,21,.1)",border:"1px solid #facc1533"}}>
              <span style={{fontSize:9,fontWeight:700,color:"#facc15"}}>DEMO</span>
            </div>
          )}
          {/* Sync status indicator */}
          {!fbUser._isDemo&&syncStatus!=="idle"&&(
            <div title={syncStatus==="saving"?"Salvando...":syncStatus==="saved"?"Salvo na nuvem":"Offline — dados locais"} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,background:syncStatus==="offline"?"rgba(248,113,113,.1)":syncStatus==="saved"?"rgba(74,222,128,.1)":"rgba(138,180,248,.1)",border:`1px solid ${syncStatus==="offline"?"#f8717133":syncStatus==="saved"?"#4ade8033":"#8ab4f833"}`,transition:"all .3s"}}>
              {syncStatus==="saving"&&<div style={{width:7,height:7,borderRadius:"50%",background:"#8ab4f8",animation:"pulse 1s ease-in-out infinite"}}/>}
              {syncStatus==="saved"&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              {syncStatus==="offline"&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>}
              <span style={{fontSize:9,fontWeight:700,color:syncStatus==="offline"?"#f87171":syncStatus==="saved"?"#4ade80":"#8ab4f8"}}>
                {syncStatus==="saving"?"Salvando":syncStatus==="saved"?"Salvo":"Offline"}
              </span>
            </div>
          )}
          {/* Health indicator in header — clicável */}
          {healthScore&&activeTab==="lancamentos"&&(
            <button onClick={onShowHealth} style={{display:"flex",alignItems:"center",gap:5,background:"var(--card-bg)",border:`1px solid ${healthScore.color}44`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:"inherit"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:healthScore.color,boxShadow:`0 0 6px ${healthScore.color}`}}/>
              <span style={{fontSize:10,color:healthScore.color,fontWeight:700}}>{healthScore.level}</span>
            </button>
          )}
          {/* Global search button */}
          <button onClick={onToggleSearch} title="Busca global (Ctrl+G)"
            style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:searchOpen?"#0d1a2e":"var(--card-bg)",border:`1px solid ${searchOpen?"#8ab4f8":"var(--border)"}`,borderRadius:9,cursor:"pointer",color:searchOpen?"#8ab4f8":"var(--text2)"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          {/* Theme toggle */}
          <button onClick={onToggleTheme}
            title={theme==="dark"?"Mudar para tema claro":"Mudar para tema escuro"}
            style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:9,cursor:"pointer",fontFamily:"inherit",color:"var(--text2)"}}>
            {theme==="dark"?(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ):(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            )}
          </button>
        </div>
      </header>
  );
}
