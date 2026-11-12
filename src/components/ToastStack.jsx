// Cor semântica por tipo de toast (error/celebrate/info; o resto é sucesso).
const TOAST_TOKEN = { error: "danger", celebrate: "emerald", info: "info" };

const ico = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, style: { flexShrink: 0 } };
const ICONS = {
  success: <svg {...ico}><circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16 9"/></svg>,
  error: <svg {...ico}><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  info: <svg {...ico}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  celebrate: <svg {...ico}><polygon points="12 2 15.1 8.6 22 9.3 16.8 14 18.2 21 12 17.5 5.8 21 7.2 14 2 9.3 8.9 8.6"/></svg>,
};
// O ícone já indica o tipo: tira emoji/símbolo do começo do texto
const plain = (msg) => String(msg).replace(/^(?:\p{Extended_Pictographic}|\uFE0F|\u200d|[✓✔↩])+\s*/u, "");

// Pilha de toasts — acima da bottom nav (no desktop, canto superior direito via CSS,
// que reposiciona .toastStack no canto superior direito).
export default function ToastStack({ toasts, dismiss }) {
  return (
      <div className="toastStack" role="status" aria-live="polite" style={{position:"fixed",bottom:82,left:"50%",transform:"translateX(-50%)",zIndex:999,display:"flex",flexDirection:"column",gap:6,alignItems:"center",pointerEvents:"none",width:"92%",maxWidth:380}}>
        {toasts.map(t=>{
          const icon=ICONS[t.type]||ICONS.success;
          const tk=TOAST_TOKEN[t.type]||"success";
          const color=`var(--${tk})`;
          return(
            <div key={t.id} className="toast-in"
              style={{background:`var(--${tk}-surface)`,border:`1.5px solid var(--${tk}-border)`,color,padding:"11px 14px",borderRadius:"var(--radius-lg)",fontSize:"var(--fs-base)",fontWeight:600,boxShadow:"var(--shadow-md)",display:"flex",alignItems:"center",gap:8,width:"100%",pointerEvents:t.actionLabel?"auto":"none"}}>
              {icon}
              <span style={{flex:1}}>{plain(t.msg)}</span>
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
