import { tint } from '../styles.js';

const rowStyle = {width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 18px",minHeight:56,background:"transparent",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderTop:"1px solid var(--border-subtle)"};

// Botão flutuante (mobile) com folha de escolha Receita / Despesa.
export default function FabMenu({ open, setOpen, onOpenForm }) {
  return (
        <div className="appFabWrap">
          {/* Backdrop escurecido com blur */}
          {open&&(
            <div
              aria-hidden="true"
              onClick={()=>setOpen(false)}
              style={{position:"fixed",inset:0,zIndex:48,background:"var(--backdrop-soft)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",animation:"fadeIn .18s ease"}}
            />
          )}

          {/* Bottom-sheet de escolha */}
          {open&&(
            <div className="fabSheet" id="fabSheet" role="dialog" aria-labelledby="fabSheetTitle" style={{position:"fixed",bottom:72,left:0,right:0,zIndex:49,maxWidth:480,margin:"0 auto",padding:"0 12px 12px"}}>
              <div style={{background:"var(--surface-raised)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",overflow:"hidden",boxShadow:"var(--shadow-lg)",animation:"slideUp .22s cubic-bezier(.22,1,.36,1)"}}>
                {/* Handle */}
                <div aria-hidden="true" style={{display:"flex",justifyContent:"center",paddingTop:10,paddingBottom:6}}>
                  <div style={{width:36,height:4,borderRadius:2,background:"var(--border)",opacity:.5}}/>
                </div>
                {/* Label */}
                <div id="fabSheetTitle" style={{fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.09em",textAlign:"center",paddingBottom:12}}>Novo lançamento</div>

                {/* Receita row */}
                <button
                  type="button"
                  onClick={()=>{onOpenForm("receita");setOpen(false);}}
                  className="fabSheetRow"
                  style={rowStyle}>
                  <div aria-hidden="true" style={{width:44,height:44,borderRadius:13,background:"var(--success-soft)",border:`1px solid ${tint("var(--success)",18)}`,color:"var(--success)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"var(--fs-xl)",fontWeight:700,color:"var(--success)",marginBottom:2}}>Receita</div>
                    <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>Salário, freelance, transferência…</div>
                  </div>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{color:"var(--text-4)"}}><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {/* Despesa row */}
                <button
                  type="button"
                  onClick={()=>{onOpenForm("despesa");setOpen(false);}}
                  className="fabSheetRow"
                  style={{...rowStyle,borderBottom:"1px solid var(--border-subtle)"}}>
                  <div aria-hidden="true" style={{width:44,height:44,borderRadius:13,background:"var(--orange-soft)",border:`1px solid ${tint("var(--orange)",18)}`,color:"var(--orange)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"var(--fs-xl)",fontWeight:700,color:"var(--orange)",marginBottom:2}}>Despesa</div>
                    <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>Conta, compra, assinatura…</div>
                  </div>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{color:"var(--text-4)"}}><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {/* Cancel */}
                <button
                  type="button"
                  onClick={()=>setOpen(false)}
                  style={{width:"100%",padding:"13px",minHeight:48,background:"transparent",border:"none",cursor:"pointer",fontSize:"var(--fs-base)",fontWeight:600,color:"var(--text-3)",fontFamily:"inherit"}}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botão FAB principal */}
          <button
            type="button"
            className="fabBtn"
            aria-label="Novo lançamento"
            aria-haspopup="dialog"
            aria-expanded={!!open}
            aria-controls="fabSheet"
            onClick={()=>setOpen(p=>!p)}
            style={{position:"fixed",bottom:82,right:16,width:54,height:54,borderRadius:"var(--radius-full)",background:"var(--fab-bg)",border:"1.5px solid var(--fab-border)",color:"var(--btn-success-text)",cursor:"pointer",boxShadow:"var(--fab-shadow)",zIndex:49,display:"flex",alignItems:"center",justifyContent:"center",transition:"transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s",transform:open?"rotate(45deg) scale(1.05)":"rotate(0deg) scale(1)"}}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
  );
}
