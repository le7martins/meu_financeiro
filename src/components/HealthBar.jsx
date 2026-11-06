export default function HealthBar({ label, value, max, color, suffix, detail }) {
  const pct = Math.min(100, max>0?(value/max)*100:0);
  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"11px 13px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:"var(--fs-md)",color:"var(--text-2)",fontWeight:500}}>{label}</span>
        <span style={{fontSize:"var(--fs-base)",fontWeight:800,color}}>{value.toFixed(1)}{suffix}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
        style={{height:5,background:"var(--track)",borderRadius:3,overflow:"hidden",marginBottom:4}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .6s ease"}}/>
      </div>
      {detail&&<div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>{detail}</div>}
    </div>
  );
}
