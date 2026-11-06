import S from '../styles.js';

// Navegação: barra inferior no mobile, sidebar no desktop (via CSS).
export default function BottomNav({ activeTab, setActiveTab, showMoreNav, setShowMoreNav, setShowFabMenu, overdueCount, budgetOverCount, isAdmin, onOpenForm }) {
  return (<>
      <nav className="appBottomNav" style={S.bottomNav}>
        {/* Desktop-only: botões "+ Receita" e "+ Despesa" no topo */}
        <button className="navDesktopOnly navAddReceita"
          onClick={()=>{onOpenForm("receita");}}
          style={{display:"none",alignItems:"center",gap:10,padding:"10px 14px",background:"#0d2a1a",border:"1.5px solid #4ade8066",borderRadius:10,color:"#4ade80",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:2}}>
          <span style={{fontSize:15}}>📈</span><span>+ Receita</span>
        </button>
        <button className="navDesktopOnly navAddDespesa"
          onClick={()=>{onOpenForm("despesa");}}
          style={{display:"none",alignItems:"center",gap:10,padding:"10px 14px",background:"#1a1208",border:"1.5px solid #fb923c66",borderRadius:10,color:"#fb923c",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
          <span style={{fontSize:15}}>📉</span><span>+ Despesa</span>
        </button>

        {[
          ["lancamentos","Contas",<span key="l" style={{position:"relative",display:"inline-flex"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>{overdueCount>0&&<span style={{position:"absolute",top:-4,right:-5,minWidth:14,height:14,borderRadius:7,background:"#f87171",border:"1.5px solid var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#fff",padding:"0 2px"}}>{overdueCount}</span>}</span>],
          ["graficos","Análise",<svg key="g" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>],
          ["cartoes","Cartões",<svg key="c" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>],
          ["dividas","Dívidas",<svg key="d" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>],
        ].map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);setShowFabMenu(false);}} className="navBtn"
            style={{...S.navBtn,borderTop:activeTab===tab?"2px solid #8ab4f8":"2px solid transparent",...(activeTab===tab?S.navBtnActive:{})}}>
            <span style={{color:activeTab===tab?"#8ab4f8":"var(--text3)",transition:"all .2s",opacity:activeTab===tab?1:0.75,display:"inline-flex"}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:activeTab===tab?700:500,color:activeTab===tab?"#8ab4f8":"var(--text3)",marginTop:2}}>{label}</span>
          </button>
        ))}

        {/* Desktop-only: Saúde, Perfil, Admin direto no sidebar */}
        {[
          ["saude","Saúde",<svg key="s" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>],
          ["perfil","Perfil",<svg key="p" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
          ...(isAdmin?[["admin","Admin",<svg key="a" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>]]:[]),
        ].map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>{setActiveTab(tab);setShowFabMenu(false);}} className="navDesktopOnly navBtn"
            style={{...S.navBtn,display:"none",borderTop:activeTab===tab?"2px solid #8ab4f8":"2px solid transparent",...(activeTab===tab?S.navBtnActive:{})}}>
            <div style={{position:"relative",display:"inline-flex"}}>
              <span style={{color:activeTab===tab?"#8ab4f8":"var(--text3)",transition:"all .2s",opacity:activeTab===tab?1:0.75}}>{icon}</span>
              {tab==="saude"&&budgetOverCount>0&&<div style={{position:"absolute",top:-4,right:-4,width:8,height:8,borderRadius:"50%",background:"#f87171",border:"1.5px solid var(--bg)"}}/>}
            </div>
            <span style={{fontSize:9,fontWeight:activeTab===tab?700:500,color:activeTab===tab?"#8ab4f8":"var(--text3)",marginTop:2}}>{label}</span>
          </button>
        ))}

        {/* Mobile-only: Botão "Mais" */}
        <button className="navMobileOnly navBtn" onClick={()=>setShowMoreNav(p=>!p)}
          style={{...S.navBtn,borderTop:["saude","perfil","admin"].includes(activeTab)?"2px solid #8ab4f8":"2px solid transparent",...(["saude","perfil","admin"].includes(activeTab)?S.navBtnActive:{})}}>
          <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:showMoreNav||["saude","perfil","admin"].includes(activeTab)?"#8ab4f8":"var(--text3)",fontSize:20,lineHeight:1,opacity:showMoreNav||["saude","perfil","admin"].includes(activeTab)?1:0.75}}>⋯</span>
            {budgetOverCount>0&&!["saude","perfil","admin"].includes(activeTab)&&(
              <div style={{position:"absolute",top:-5,right:-5,width:8,height:8,borderRadius:"50%",background:"#f87171",border:"1.5px solid var(--bg)"}}/>
            )}
          </div>
          <span style={{fontSize:9,fontWeight:["saude","perfil","admin"].includes(activeTab)?700:500,color:["saude","perfil","admin"].includes(activeTab)?"#8ab4f8":"var(--text3)",marginTop:2}}>Mais</span>
        </button>
      </nav>

      {/* Menu "Mais" expandido */}
      {showMoreNav&&(
        <div className="appMoreMenu" style={{position:"fixed",bottom:68,right:8,background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:6,zIndex:51,boxShadow:"0 8px 32px rgba(0,0,0,.7)",minWidth:150}}>
          {[
            ["saude","💊 Saúde"],
            ["perfil","👤 Perfil"],
            ...(isAdmin?[["admin","🛡 Admin"]]:[] ),
          ].map(([tab,label])=>(
            <button key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"11px 14px",background:activeTab===tab?"#111820":"transparent",border:"none",borderRadius:9,color:activeTab===tab?"#8ab4f8":"#ccd",fontSize:13,fontWeight:activeTab===tab?700:500,cursor:"pointer",textAlign:"left"}}>
              {label}
              {tab==="saude"&&budgetOverCount>0&&(
                <span style={{marginLeft:"auto",fontSize:9,background:"#f87171",color:"#fff",padding:"1px 6px",borderRadius:4,fontWeight:800}}>{budgetOverCount}</span>
              )}
            </button>
          ))}
        </div>
      )}
  </>);
}
