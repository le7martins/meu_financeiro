import { useState } from 'react';
import { fmtShort } from '../utils.js';

export default function BarSVG({data,type,faded}){
  const [tip,setTip]=useState(null);
  const W=320,H=180,PL=44,PB=24,PT=10,PR=8,cW=W-PL-PR,cH=H-PB-PT;
  if(!data||data.length===0) return null;
  const series=type==="evolucao"
    ?[{key:"receitas",color:"#4ade80"},{key:"despesas",color:"#fb923c"},{key:"saldo",color:"#8ab4f8",line:true}]
    :[{key:"receitas",color:faded?"#4ade8066":"#4ade80"},{key:"despesas",color:faded?"#fb923c66":"#fb923c"}];
  const allVals=data.flatMap(d=>series.map(s=>d[s.key]||0));
  const maxVal=Math.max(...allVals,1),minVal=type==="evolucao"?Math.min(...allVals,0):0,range2=maxVal-minVal||1;
  const toY=(v)=>PT+cH-((v-minVal)/range2)*cH;
  const toX=(i)=>PL+(i/(data.length-1||1))*cW;
  const barCount=series.filter(s=>!s.line).length;
  const totalW=cW/data.length,barW=Math.min(20,(totalW*0.7)/barCount);
  const groupOff=(i)=>-((barCount-1)/2)*barW+i*barW;
  const yTicks=Array.from({length:5},(_,i)=>minVal+(range2/4)*i);
  const pathFor=(key)=>data.map((d,i)=>i===0?`M${toX(i)},${toY(d[key]||0)}`:`L${toX(i)},${toY(d[key]||0)}`).join(" ");
  const areaFor=(key)=>{const pts=data.map((d,i)=>({x:toX(i),y:toY(d[key]||0)}));const base=toY(0);return `${pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ")} L${pts[pts.length-1].x},${base} L${pts[0].x},${base} Z`;};
  return(
    <div style={{position:"relative",width:"100%"}} onMouseLeave={()=>setTip(null)} onTouchEnd={()=>setTimeout(()=>setTip(null),2000)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        <defs>{series.filter(s=>s.line).map(s=>(<linearGradient key={s.key} id={`g_${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.2"/><stop offset="100%" stopColor={s.color} stopOpacity="0"/></linearGradient>))}</defs>
        {yTicks.map((v,i)=>(<g key={i}><line x1={PL} x2={W-PR} y1={toY(v)} y2={toY(v)} stroke="#111820" strokeDasharray="3 3"/><text x={PL-4} y={toY(v)+4} textAnchor="end" fill="#94a3b8" fontSize="9">{fmtShort(v)}</text></g>))}
        {minVal<0&&<line x1={PL} x2={W-PR} y1={toY(0)} y2={toY(0)} stroke="#64748b" strokeWidth="1"/>}
        {type==="evolucao"&&series.filter(s=>!s.line).map(s=>(<path key={s.key+"_a"} d={areaFor(s.key)} fill={s.color} opacity="0.12"/>))}
        {type==="evolucao"&&series.filter(s=>s.line).map(s=>(<path key={s.key+"_a"} d={areaFor(s.key)} fill={`url(#g_${s.key})`}/>))}
        {type==="evolucao"&&series.map(s=>(<path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth={s.line?"1.5":"2"} strokeDasharray={s.line?"4 2":"none"}/>))}
        {type!=="evolucao"&&data.map((d,di)=>{
          const cx=PL+(di+0.5)*(cW/data.length);
          return series.filter(s=>!s.line).map((s,si)=>{
            const x=cx+groupOff(si)-barW/2,y0=toY(0),y1=toY(d[s.key]||0),bH=Math.abs(y1-y0);
            return(<rect key={s.key} x={x} y={Math.min(y0,y1)} width={barW} height={Math.max(bH,2)} fill={s.color} rx="3" opacity={faded?0.7:1} onMouseEnter={()=>setTip({di,d,x:cx})} onTouchStart={()=>setTip({di,d,x:cx})}/>);
          });
        })}
        {type==="evolucao"&&series.filter(s=>s.line).map(s=>data.map((d,i)=>(<circle key={i} cx={toX(i)} cy={toY(d[s.key]||0)} r="3" fill={s.color} onMouseEnter={()=>setTip({di:i,d,x:toX(i)})} onTouchStart={()=>setTip({di:i,d,x:toX(i)})}/>)))}
        {data.map((d,i)=>(<text key={i} x={PL+(i+0.5)*(cW/data.length)} y={H-6} textAnchor="middle" fill="#94a3b8" fontSize="9">{d.month}</text>))}
        {tip&&(()=>{const tx=Math.min(Math.max(tip.x-44,PL),W-92),ty=PT+8,d=tip.d;return(<g><rect x={tx} y={ty} width={90} height={type==="evolucao"?56:42} rx="6" fill="#0d1118" stroke="#1a2840" strokeWidth="1"/><text x={tx+45} y={ty+14} textAnchor="middle" fill="#8ab4f8" fontSize="9" fontWeight="bold">{d.month}</text><text x={tx+4} y={ty+27} fill="#4ade80" fontSize="9">↑ {fmtShort(d.receitas)}</text><text x={tx+4} y={ty+40} fill="#fb923c" fontSize="9">↓ {fmtShort(d.despesas)}</text>{type==="evolucao"&&<text x={tx+4} y={ty+53} fill="#8ab4f8" fontSize="9">≈ {fmtShort(d.saldo)}</text>}</g>);})()}
      </svg>
    </div>
  );
}
