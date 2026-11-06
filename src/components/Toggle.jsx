export default function Toggle({checked,onChange,disabled,label}){
  return(
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled} onClick={()=>!disabled&&onChange(!checked)}
      style={{width:44,height:24,borderRadius:"var(--radius-full)",background:checked?"var(--accent-muted)":"var(--surface-2)",border:`1.5px solid ${checked?"var(--accent)":"var(--border-strong)"}`,cursor:disabled?"default":"pointer",opacity:disabled?0.5:1,position:"relative",transition:"all .2s",flexShrink:0,padding:0}}>
      <div style={{width:18,height:18,borderRadius:"50%",background:checked?"var(--accent)":"var(--text-4)",position:"absolute",top:"50%",transform:`translateY(-50%) translateX(${checked?20:2}px)`,transition:"all .2s"}}/>
    </button>
  );
}
