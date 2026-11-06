// Pilha de toasts — acima da bottom nav (no desktop, canto superior direito via CSS).
export default function ToastStack({ toasts, dismiss }) {
  return (
      <div style={{position:"fixed",bottom:82,left:"50%",transform:"translateX(-50%)",zIndex:999,display:"flex",flexDirection:"column",gap:6,alignItems:"center",pointerEvents:"none",width:"92%",maxWidth:380}}>
        {toasts.map(t=>{
          const icon=t.type==="error"?"❌":t.type==="celebrate"?"🎉":t.type==="info"?"ℹ️":"✅";
          const bg=t.type==="error"?"#2a0d0d":t.type==="celebrate"?"#0d2a1a":t.type==="info"?"#0d1a2e":"#0a2010";
          const border=t.type==="error"?"#f8717155":t.type==="celebrate"?"#4ade8055":t.type==="info"?"#8ab4f855":"#4ade8055";
          const color=t.type==="error"?"#fca5a5":t.type==="celebrate"?"#6ee7b7":t.type==="info"?"#93c5fd":"#4ade80";
          return(
            <div key={t.id} className="toast-in"
              style={{background:bg,border:`1.5px solid ${border}`,color,padding:"11px 14px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.6)",display:"flex",alignItems:"center",gap:8,width:"100%",pointerEvents:t.actionLabel?"auto":"none"}}>
              <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
              <span style={{flex:1}}>{t.msg}</span>
              {t.actionLabel&&t.onAction&&(
                <button onClick={()=>{t.onAction();dismiss(t.id);}}
                  style={{background:"transparent",border:`1px solid ${color}`,borderRadius:6,padding:"3px 9px",color,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  {t.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
  );
}
