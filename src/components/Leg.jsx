export default function Leg({color,label,dashed}){
  return <div style={{display:"flex",alignItems:"center",gap:5}}><div aria-hidden="true" style={{width:20,height:2,borderTop:dashed?`2px dashed ${color}`:`2px solid ${color}`}}/><span style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>{label}</span></div>;
}
