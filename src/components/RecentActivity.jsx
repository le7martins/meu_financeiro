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
        {recent.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"var(--card-bg)",borderRadius:10,padding:"8px 12px",border:"1px solid var(--border)"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:catColor(e.category),flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
              <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{catName(e.category)} · {e.date.split("-").reverse().join("/")}</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":e.isDivida?"#f87171":"var(--text1)",flexShrink:0}}>
              {e.type==="receita"?"+":"-"}{fmt(eVal(e))}
            </div>
            <div style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:e.statusForMonth==="pago"?"rgba(74,222,128,.12)":"rgba(251,146,60,.12)",color:e.statusForMonth==="pago"?"#4ade80":"#fb923c",fontWeight:700}}>
              {e.statusForMonth==="pago"?"✓":"⏳"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
