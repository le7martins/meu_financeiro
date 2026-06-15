import { Check, Clock } from 'lucide-react';
import { fmt, eVal } from '../utils.js';

export default function RecentActivity({ entries, catColor, catName }) {
  const recent = [...entries]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,5);
  if (!recent.length) return null;
  return(
    <div style={{padding:"0 14px 8px"}}>
      <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Últimas movimentações</div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {recent.map((e)=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,background:"var(--card-bg)",borderRadius:10,padding:"8px 12px",border:"1px solid var(--border)"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:catColor(e.category),flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
              <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{catName(e.category)} · {e.date.split("-").reverse().join("/")}</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":e.isDivida?"#f87171":"var(--text1)",flexShrink:0}}>
              {e.type==="receita"?"+":"-"}{fmt(eVal(e))}
            </div>
            <div style={{width:20,height:20,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",background:e.statusForMonth==="pago"?"rgba(52,211,153,.12)":"rgba(249,115,22,.12)",color:e.statusForMonth==="pago"?"#34d399":"#f97316",flexShrink:0}}>
              {e.statusForMonth==="pago"?<Check size={11} strokeWidth={2.5}/>:<Clock size={11} strokeWidth={2}/>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
