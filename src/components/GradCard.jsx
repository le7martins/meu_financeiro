import { tint } from '../styles.js';

// Card de resumo (Receitas/Despesas/Pago/A pagar). `color` aceita token (var(--success)) ou hex de dados.
export default function GradCard({label,value,color,bg,icon,onAdd,empty}){
  return(<div className="gradCard" style={{background:bg,border:`1px solid ${empty?"var(--border)":tint(color,13)}`,borderRadius:"var(--radius-xl)",padding:14,position:"relative",overflow:"hidden",opacity:empty?0.6:1,transition:"opacity .2s"}}>
    <div aria-hidden="true" style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"var(--radius-full)",background:`radial-gradient(circle at top right, ${tint(color,9)}, transparent 70%)`,pointerEvents:"none"}}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div className="gradCardIcon" aria-hidden="true" style={{width:34,height:34,borderRadius:"var(--radius-md)",background:tint(color,13),color,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div>
      {onAdd&&<button type="button" onClick={onAdd} className="sumAddBtn" aria-label={`Adicionar em ${label}`} title={`Adicionar em ${label}`} style={{width:34,height:34,borderRadius:"var(--radius-sm)",background:tint(color,13),border:`1px solid ${tint(color,27)}`,color,fontSize:"var(--fs-3xl)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,lineHeight:1}}><span aria-hidden="true">+</span></button>}
    </div>
    <div className="gradCardLabel" style={{fontSize:"var(--fs-sm)",color,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    <div className="gradCardValue" style={{fontSize:empty?"var(--fs-5xl)":"var(--fs-3xl)",fontWeight:800,color:empty?"var(--text-4)":"var(--text-1)",letterSpacing:"-0.5px"}}>{empty?"—":value}</div>
  </div>);
}
