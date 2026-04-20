export default function HealthBar({ label, value, max, color, suffix, detail }) {
  const pct = Math.min(100, max>0?(value/max)*100:0);
  return(
    <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:11,padding:"11px 13px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{label}</span>
        <span style={{fontSize:13,fontWeight:800,color}}>{value.toFixed(1)}{suffix}</span>
      </div>
      <div style={{height:5,background:"var(--bg)",borderRadius:3,overflow:"hidden",marginBottom:4}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .6s ease"}}/>
      </div>
      {detail&&<div style={{fontSize:10,color:"var(--text3)"}}>{detail}</div>}
    </div>
  );
}
