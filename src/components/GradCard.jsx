import { tint } from '../styles.js';

// Card de resumo compacto (Receitas/Despesas/Pago/A pagar). `color` aceita token (var(--success)) ou hex de dados.
export default function GradCard({label,value,color,bg,icon,empty}){
  return(<div className="gradCard" style={{background:bg,border:`1px solid ${empty?"var(--border)":tint(color,13)}`,borderRadius:"var(--radius-lg)",padding:"10px 12px",display:"flex",alignItems:"center",gap:10,position:"relative",overflow:"hidden",opacity:empty?0.6:1,transition:"opacity .2s",minWidth:0}}>
    <div className="gradCardIcon" aria-hidden="true" style={{width:30,height:30,borderRadius:"var(--radius-sm)",background:tint(color,13),color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{icon}</div>
    <div style={{minWidth:0}}>
      <div className="gradCardLabel" style={{fontSize:"var(--fs-sm)",color,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
      <div className="gradCardValue" style={{fontSize:"var(--fs-xl)",fontWeight:800,color:empty?"var(--text-4)":"var(--text-1)",letterSpacing:"-0.3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{empty?"—":value}</div>
    </div>
  </div>);
}
