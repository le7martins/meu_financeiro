import S from '../styles.js';

const MORE_TABS = ["saude","perfil","admin"];

// Navegação: barra inferior no mobile, sidebar no desktop (via CSS).
export default function BottomNav({ activeTab, setActiveTab, showMoreNav, setShowMoreNav, setShowFabMenu, overdueCount, budgetOverCount, isAdmin, onOpenForm }) {
  const moreActive = MORE_TABS.includes(activeTab);
  const ico = { width:20, height:20, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round", "aria-hidden":"true" };
  const navStyle = (active, extra) => ({...S.navBtn,...extra,borderTop:active?"2px solid var(--accent)":"2px solid transparent",...(active?S.navBtnActive:{})});
  const labelStyle = (active) => ({fontSize:"var(--fs-2xs)",fontWeight:active?700:500,color:active?"var(--accent)":"var(--text-3)",marginTop:2});
  return (<>
      <nav className="appBottomNav" aria-label="Navegação principal" style={S.bottomNav}>
        {/* Desktop-only: botões "+ Receita" e "+ Despesa" no topo */}
        <button type="button" className="navDesktopOnly navAddReceita"
          onClick={()=>{onOpenForm("receita");}}
          style={{display:"none",alignItems:"center",gap:10,padding:"10px 14px",background:"var(--success-surface)",border:"1.5px solid var(--success-border)",borderRadius:"var(--radius-md)",color:"var(--success)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:2}}>
          <span aria-hidden="true" style={{fontSize:"var(--fs-xl)"}}>📈</span><span>+ Receita</span>
        </button>
        <button type="button" className="navDesktopOnly navAddDespesa"
          onClick={()=>{onOpenForm("despesa");}}
          style={{display:"none",alignItems:"center",gap:10,padding:"10px 14px",background:"var(--orange-surface)",border:"1.5px solid var(--orange-border)",borderRadius:"var(--radius-md)",color:"var(--orange)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
          <span aria-hidden="true" style={{fontSize:"var(--fs-xl)"}}>📉</span><span>+ Despesa</span>
        </button>

        {[
          ["lancamentos","Contas",<span key="l" style={{position:"relative",display:"inline-flex"}}><svg {...ico}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>{overdueCount>0&&<span style={{position:"absolute",top:-6,right:-9,minWidth:18,height:18,borderRadius:9,background:"var(--danger)",border:"1.5px solid var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"var(--danger-on)",padding:"0 3px"}}>{overdueCount}</span>}</span>],
          ["graficos","Análise",<svg key="g" {...ico}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>],
          ["cartoes","Cartões",<svg key="c" {...ico}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>],
          ["dividas","Dívidas",<svg key="d" {...ico}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>],
        ].map(([tab,label,icon])=>{
          const active=activeTab===tab;
          return(
          <button type="button" key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);setShowFabMenu(false);}} className="navBtn"
            aria-current={active?"page":undefined}
            style={navStyle(active)}>
            <span style={{color:active?"var(--accent)":"var(--text-3)",transition:"all .2s",opacity:active?1:0.75,display:"inline-flex"}}>{icon}</span>
            <span style={labelStyle(active)}>{label}</span>
          </button>
        );})}

        {/* Desktop-only: Saúde, Perfil, Admin direto no sidebar */}
        {[
          ["saude","Saúde",<svg key="s" {...ico}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>],
          ["perfil","Perfil",<svg key="p" {...ico}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
          ...(isAdmin?[["admin","Admin",<svg key="a" {...ico}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>]]:[]),
        ].map(([tab,label,icon])=>{
          const active=activeTab===tab;
          return(
          <button type="button" key={tab} onClick={()=>{setActiveTab(tab);setShowFabMenu(false);}} className="navDesktopOnly navBtn"
            aria-current={active?"page":undefined}
            style={navStyle(active,{display:"none"})}>
            <div style={{position:"relative",display:"inline-flex"}}>
              <span style={{color:active?"var(--accent)":"var(--text-3)",transition:"all .2s",opacity:active?1:0.75}}>{icon}</span>
              {tab==="saude"&&budgetOverCount>0&&<div aria-hidden="true" style={{position:"absolute",top:-4,right:-4,width:8,height:8,borderRadius:"var(--radius-full)",background:"var(--danger)",border:"1.5px solid var(--bg)"}}/>}
            </div>
            <span style={labelStyle(active)}>{label}</span>
          </button>
        );})}

        {/* Mobile-only: Botão "Mais" */}
        <button type="button" className="navMobileOnly navBtn" onClick={()=>setShowMoreNav(p=>!p)}
          aria-expanded={!!showMoreNav} aria-controls="appMoreMenu" aria-haspopup="true"
          style={navStyle(moreActive)}>
          <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <span aria-hidden="true" style={{color:showMoreNav||moreActive?"var(--accent)":"var(--text-3)",fontSize:"var(--fs-4xl)",lineHeight:1,opacity:showMoreNav||moreActive?1:0.75}}>⋯</span>
            {budgetOverCount>0&&!moreActive&&(
              <div aria-hidden="true" style={{position:"absolute",top:-5,right:-5,width:8,height:8,borderRadius:"var(--radius-full)",background:"var(--danger)",border:"1.5px solid var(--bg)"}}/>
            )}
          </div>
          <span style={labelStyle(moreActive)}>Mais</span>
        </button>
      </nav>

      {/* Menu "Mais" expandido */}
      {showMoreNav&&(
        <div id="appMoreMenu" className="appMoreMenu" style={{position:"fixed",bottom:68,right:8,background:"var(--surface-raised)",border:"1px solid var(--border)",borderRadius:14,padding:6,zIndex:51,boxShadow:"var(--shadow-lg)",minWidth:150}}>
          {[
            ["saude","💊 Saúde"],
            ["perfil","👤 Perfil"],
            ...(isAdmin?[["admin","🛡 Admin"]]:[] ),
          ].map(([tab,label])=>{
            const active=activeTab===tab;
            return(
            <button type="button" key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);}}
              aria-current={active?"page":undefined}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",minHeight:44,padding:"11px 14px",background:active?"var(--surface-2)":"transparent",border:"none",borderRadius:9,color:active?"var(--accent)":"var(--text-2)",fontSize:"var(--fs-base)",fontWeight:active?700:500,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
              {label}
              {tab==="saude"&&budgetOverCount>0&&(
                <span style={{marginLeft:"auto",fontSize:"var(--fs-2xs)",background:"var(--danger)",color:"var(--danger-on)",padding:"1px 6px",borderRadius:4,fontWeight:800}}>{budgetOverCount}</span>
              )}
            </button>
          );})}
        </div>
      )}
  </>);
}
