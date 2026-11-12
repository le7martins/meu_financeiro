import { useState } from 'react';
import { fmt, fmtShort } from '../utils.js';

export default function DonutSVG({data,total}){
  const [hover,setHover]=useState(null);
  const CX=110,CY=90,R=78,r=50,W=220,H=180;
  let angle=-Math.PI/2;
  const slices=data.map(d=>{
    const pct=total>0?d.value/total:0;
    const a0=angle,a1=angle+pct*2*Math.PI-0.02;angle=a1+0.02;
    const x0=CX+R*Math.cos(a0),y0=CY+R*Math.sin(a0),x1=CX+R*Math.cos(a1),y1=CY+R*Math.sin(a1);
    const xi0=CX+r*Math.cos(a0),yi0=CY+r*Math.sin(a0),xi1=CX+r*Math.cos(a1),yi1=CY+r*Math.sin(a1);
    const large=pct>0.5?1:0;
    return{...d,pct,path:`M${xi0},${yi0} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${large} 0 ${xi0},${yi0} Z`};
  });

  const active = hover!==null ? slices[hover] : null;
  const ariaLabel = `Gráfico de rosca por categoria. Total ${fmt(total)}. `+data.map(d=>`${d.name}: ${fmt(d.value)} (${total>0?(d.value/total*100).toFixed(1):0}%)`).join('; ');

  return(
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{width:"100%",height:"auto",display:"block"}}>
      {/* Fatias */}
      {slices.map((s,i)=>(
        <path key={i} d={s.path} fill={s.color}
          opacity={hover===null||hover===i?1:0.35}
          transform={hover===i?`translate(${Math.cos(-Math.PI/2+(slices.slice(0,i).reduce((a,x)=>a+x.pct,0)+s.pct/2)*2*Math.PI)*4} ${Math.sin(-Math.PI/2+(slices.slice(0,i).reduce((a,x)=>a+x.pct,0)+s.pct/2)*2*Math.PI)*4})`:""}
          onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}
          onTouchStart={e=>{e.stopPropagation();setHover(hover===i?null:i);}}
          style={{cursor:"pointer",transition:"opacity .2s, transform .15s"}}/>
      ))}

      {/* Centro: dados do hover ou total */}
      {active?(
        <>
          <text x={CX} y={CY-14} textAnchor="middle" fontSize="13" fontWeight="800" style={{fill:active.color}}>{(active.pct*100).toFixed(1)}%</text>
          <text x={CX} y={CY+3}  textAnchor="middle" fontSize="12" fontWeight="700" style={{fill:"var(--text-1)"}}>{fmtShort(active.value)}</text>
          <text x={CX} y={CY+18} textAnchor="middle" fontSize="11" style={{fill:active.color}}>{active.name.length>14?active.name.slice(0,13)+"…":active.name}</text>
        </>
      ):(
        <>
          <text x={CX} y={CY-4} textAnchor="middle" fontSize="11" style={{fill:"var(--chart-label)"}}>Total</text>
          <text x={CX} y={CY+12} textAnchor="middle" fontSize="13" fontWeight="700" style={{fill:"var(--text-1)"}}>{fmtShort(total)}</text>
        </>
      )}

    </svg>
  );
}
