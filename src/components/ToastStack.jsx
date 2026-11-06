// Cor semântica por tipo de toast (error/celebrate/info; o resto é sucesso).
const TOAST_TOKEN = { error: "danger", celebrate: "emerald", info: "info" };

// Pilha de toasts — acima da bottom nav (no desktop, canto superior direito via CSS,
// que reposiciona .toastStack no canto superior direito).
export default function ToastStack({ toasts, dismiss }) {
  return (
      <div className="toastStack" role="status" aria-live="polite" style={{position:"fixed",bottom:82,left:"50%",transform:"translateX(-50%)",zIndex:999,display:"flex",flexDirection:"column",gap:6,alignItems:"center",pointerEvents:"none",width:"92%",maxWidth:380}}>
        {toasts.map(t=>{
          const icon=t.type==="error"?"❌":t.type==="celebrate"?"🎉":t.type==="info"?"ℹ️":"✅";
          const tk=TOAST_TOKEN[t.type]||"success";
          const color=`var(--${tk})`;
          return(
            <div key={t.id} className="toast-in"
              style={{background:`var(--${tk}-surface)`,border:`1.5px solid var(--${tk}-border)`,color,padding:"11px 14px",borderRadius:"var(--radius-lg)",fontSize:"var(--fs-base)",fontWeight:600,boxShadow:"var(--shadow-md)",display:"flex",alignItems:"center",gap:8,width:"100%",pointerEvents:t.actionLabel?"auto":"none"}}>
              <span aria-hidden="true" style={{fontSize:"var(--fs-2xl)",flexShrink:0}}>{icon}</span>
              <span style={{flex:1}}>{t.msg}</span>
              {t.actionLabel&&t.onAction&&(
                <button type="button" onClick={()=>{t.onAction();dismiss(t.id);}}
                  style={{background:"transparent",border:`1px solid ${color}`,borderRadius:"var(--radius-xs)",padding:"6px 12px",minHeight:32,color,fontSize:"var(--fs-sm)",fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  {t.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
  );
}
