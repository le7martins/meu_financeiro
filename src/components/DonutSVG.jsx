import { useState } from 'react';
import { fmt, fmtShort } from '../utils.js';

export default function DonutSVG({data,total}){
  const [hover,setHover]=useState(null);
  const CX=110,CY=90,R=70,r=44,W=280,H=180;
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

  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
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
          <text x={CX} y={CY-14} textAnchor="middle" fill={active.color} fontSize="11" fontWeight="800">{(active.pct*100).toFixed(1)}%</text>
          <text x={CX} y={CY+3}  textAnchor="middle" fill="#fff"         fontSize="10" fontWeight="700">{fmtShort(active.value)}</text>
          <text x={CX} y={CY+18} textAnchor="middle" fill={active.color} fontSize="9">{active.name}</text>
        </>
      ):(
        <>
          <text x={CX} y={CY-4} textAnchor="middle" fill="#94a3b8" fontSize="9">Total</text>
          <text x={CX} y={CY+12} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">{fmtShort(total)}</text>
        </>
      )}

      {/* Legenda lateral */}
      {data.slice(0,6).map((d,i)=>{
        const lx=CX+R+18, ly=20+i*26;
        const pct=total>0?(d.value/total*100).toFixed(0):0;
        return(
          <g key={i} style={{cursor:"pointer"}}
            onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}
            onTouchStart={e=>{e.stopPropagation();setHover(hover===i?null:i);}}>
            <rect x={lx} y={ly-7} width={W-lx-4} height={20} rx="4"
              fill={hover===i?d.color+"18":"transparent"}/>
            <circle cx={lx+6} cy={ly+3} r="4" fill={d.color} opacity={hover===null||hover===i?1:0.4}/>
            <text x={lx+14} y={ly+7} fill={hover===i?d.color:"#94a3b8"}
              fontSize="9" fontWeight={hover===i?"700":"400"}
              opacity={hover===null||hover===i?1:0.5}>
              {d.name.length>10?d.name.slice(0,10)+"…":d.name}
            </text>
            <text x={W-6} y={ly+7} textAnchor="end" fill={hover===i?d.color:"#94a3b8"}
              fontSize="9" fontWeight={hover===i?"700":"400"}
              opacity={hover===null||hover===i?1:0.5}>
              {pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
