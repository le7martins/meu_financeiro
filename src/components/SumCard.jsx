import { tint } from '../styles.js';

export default function SumCard({label,value,color,icon,wide,onAdd}){
  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:13,padding:"11px 12px",gridColumn:wide?"span 2":"span 1",display:"flex",alignItems:"center",gap:10}}>
      <div aria-hidden="true" style={{width:30,height:30,borderRadius:9,background:tint(color,9),display:"flex",alignItems:"center",justifyContent:"center",color,fontSize:"var(--fs-lg)",fontWeight:700,flexShrink:0}}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{label}</div>
        <div style={{fontSize:"var(--fs-xl)",fontWeight:700,color,letterSpacing:"-0.4px"}}>{value}</div>
      </div>
      {onAdd&&<button onClick={onAdd} className="sumAddBtn" aria-label={`Adicionar ${label.toLowerCase()}`} style={{width:40,height:40,margin:-6,borderRadius:"var(--radius-sm)",background:tint(color,13),border:`1px solid ${tint(color,27)}`,color,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0,lineHeight:1}}>+</button>}
    </div>
  );
}
