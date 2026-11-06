// Botão flutuante (mobile) com folha de escolha Receita / Despesa.
export default function FabMenu({ open, setOpen, onOpenForm }) {
  return (
        <div className="appFabWrap">
          {/* Backdrop escurecido com blur */}
          {open&&(
            <div
              onClick={()=>setOpen(false)}
              style={{position:"fixed",inset:0,zIndex:48,background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",animation:"fadeIn .18s ease"}}
            />
          )}

          {/* Bottom-sheet de escolha */}
          {open&&(
            <div className="fabSheet" style={{position:"fixed",bottom:72,left:0,right:0,zIndex:49,maxWidth:480,margin:"0 auto",padding:"0 12px 12px"}}>
              <div style={{background:"var(--card-bg,#0d1118)",border:"1px solid var(--border,#111820)",borderRadius:20,overflow:"hidden",boxShadow:"0 -2px 40px rgba(0,0,0,.7)",animation:"slideUp .22s cubic-bezier(.22,1,.36,1)"}}>
                {/* Handle */}
                <div style={{display:"flex",justifyContent:"center",paddingTop:10,paddingBottom:6}}>
                  <div style={{width:36,height:4,borderRadius:2,background:"var(--border,#1e293b)",opacity:.5}}/>
                </div>
                {/* Label */}
                <div style={{fontSize:11,fontWeight:700,color:"var(--text4,#334)",textTransform:"uppercase",letterSpacing:"0.09em",textAlign:"center",paddingBottom:12}}>Novo lançamento</div>

                {/* Receita row */}
                <button
                  onClick={()=>{onOpenForm("receita");setOpen(false);}}
                  className="fabSheetRow"
                  style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderTop:"1px solid var(--border2,#0f1825)"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"rgba(74,222,128,.12)",border:"1px solid rgba(74,222,128,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:700,color:"#4ade80",marginBottom:2}}>Receita</div>
                    <div style={{fontSize:11,color:"var(--text4,#556)"}}>Salário, freelance, transferência…</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text4,#556)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {/* Despesa row */}
                <button
                  onClick={()=>{onOpenForm("despesa");setOpen(false);}}
                  className="fabSheetRow"
                  style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderTop:"1px solid var(--border2,#0f1825)",borderBottom:"1px solid var(--border2,#0f1825)"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"rgba(251,146,60,.12)",border:"1px solid rgba(251,146,60,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:700,color:"#fb923c",marginBottom:2}}>Despesa</div>
                    <div style={{fontSize:11,color:"var(--text4,#556)"}}>Conta, compra, assinatura…</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text4,#556)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {/* Cancel */}
                <button
                  onClick={()=>setOpen(false)}
                  style={{width:"100%",padding:"13px",background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:"var(--text4,#556)",fontFamily:"inherit"}}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botão FAB principal */}
          <button
            className="fabBtn"
            onClick={()=>setOpen(p=>!p)}
            style={{position:"fixed",bottom:82,right:16,width:54,height:54,borderRadius:"50%",background:"linear-gradient(135deg,#1a6e3a,#0d4727)",border:"1.5px solid rgba(74,222,128,.3)",color:"#4ade80",cursor:"pointer",boxShadow:"0 4px 20px rgba(74,222,128,.25)",zIndex:49,display:"flex",alignItems:"center",justifyContent:"center",transition:"transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s",transform:open?"rotate(45deg) scale(1.05)":"rotate(0deg) scale(1)"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
  );
}
