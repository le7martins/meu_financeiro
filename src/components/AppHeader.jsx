import S, { tint } from '../styles.js';

// Aparência do indicador de sincronização por estado.
const SYNC = {
  saving:  { token: "info",    label: "Salvando", title: "Salvando..." },
  saved:   { token: "success", label: "Salvo",    title: "Salvo na nuvem" },
  offline: { token: "danger",  label: "Offline",  title: "Offline — salvo no aparelho, será enviado ao reconectar" },
  error:   { token: "danger",  label: "Não salvo", title: "Falha ao salvar na nuvem — os dados estão só neste aparelho" },
};

export default function AppHeader({ fbUser, syncStatus, healthScore, activeTab, onShowHealth, searchOpen, onToggleSearch, theme, onToggleTheme }) {
  const sync = SYNC[syncStatus] || SYNC.offline;
  const iconBtn = {display:"flex",alignItems:"center",justifyContent:"center",width:44,height:44,borderRadius:"var(--radius-md)",cursor:"pointer",fontFamily:"inherit"};
  return (
      <header style={S.header}>
        <div style={S.headerLeft}>
          <img src="/meu_financeiro/icon-192.png" alt="CashUp" style={{width:32,height:32,borderRadius:"var(--radius-sm)",objectFit:"cover"}}/>
          <div style={{minWidth:0}}><div className="appName" style={S.appName}>CashUp</div><div className="appSub" style={S.appSub}>Controle seus lançamentos</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Demo badge */}
          {fbUser._isDemo&&(
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:"var(--radius-xs)",background:"var(--warning-soft)",border:"1px solid var(--warning-border)"}}>
              <span style={{fontSize:"var(--fs-2xs)",fontWeight:700,color:"var(--warning)"}}>DEMO</span>
            </div>
          )}
          {/* Sync status indicator */}
          {!fbUser._isDemo&&syncStatus!=="idle"&&(
            <div role="status" title={sync.title} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:"var(--radius-xs)",color:`var(--${sync.token})`,background:`var(--${sync.token}-soft)`,border:`1px solid var(--${sync.token}-border)`,transition:"all .3s"}}>
              {syncStatus==="saving"&&<div aria-hidden="true" style={{width:7,height:7,borderRadius:"var(--radius-full)",background:"currentColor",animation:"pulse 1s ease-in-out infinite"}}/>}
              {syncStatus==="saved"&&<svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              {(syncStatus==="offline"||syncStatus==="error")&&<svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>}
              <span className="syncLabel" style={{fontSize:"var(--fs-2xs)",fontWeight:700}}>{sync.label}</span>
            </div>
          )}
          {/* Health indicator in header — clicável */}
          {healthScore&&activeTab==="lancamentos"&&(
            <button type="button" onClick={onShowHealth} aria-label={`Saúde financeira: ${healthScore.level}`} aria-haspopup="dialog" style={{display:"flex",alignItems:"center",gap:5,background:"var(--surface)",border:`1px solid ${tint(healthScore.color,27)}`,borderRadius:"var(--radius-sm)",padding:"5px 10px",minHeight:44,cursor:"pointer",fontFamily:"inherit"}}>
              <div aria-hidden="true" style={{width:7,height:7,borderRadius:"var(--radius-full)",background:healthScore.color,boxShadow:`0 0 6px ${healthScore.color}`}}/>
              <span style={{fontSize:"var(--fs-xs)",color:healthScore.color,fontWeight:700}}>{healthScore.level}</span>
            </button>
          )}
          {/* Global search button */}
          <button type="button" onClick={onToggleSearch} title="Busca global (Ctrl+G)" aria-label="Busca global" aria-pressed={!!searchOpen}
            style={{...iconBtn,background:searchOpen?"var(--accent-surface)":"var(--surface)",border:`1px solid ${searchOpen?"var(--accent)":"var(--border)"}`,color:searchOpen?"var(--accent)":"var(--text-2)"}}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          {/* Theme toggle */}
          <button type="button" onClick={onToggleTheme}
            title={theme==="dark"?"Mudar para tema claro":"Mudar para tema escuro"}
            aria-label={theme==="dark"?"Mudar para tema claro":"Mudar para tema escuro"}
            style={{...iconBtn,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text-2)"}}>
            {theme==="dark"?(
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ):(
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            )}
          </button>
        </div>
      </header>
  );
}
