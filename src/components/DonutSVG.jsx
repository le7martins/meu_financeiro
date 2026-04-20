import { useState } from 'react';

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
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
      {slices.map((s,i)=>(<path key={i} d={s.path} fill={s.color} opacity={hover===null||hover===i?1:0.4} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onTouchStart={()=>setHover(i)} style={{cursor:"pointer",transition:"opacity .2s"}}/>))}
      {hover!==null&&slices[hover]?(<><text x={CX} y={CY-8} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">{(slices[hover].pct*100).toFixed(1)}%</text><text x={CX} y={CY+10} textAnchor="middle" fill={slices[hover].color} fontSize="9">{slices[hover].name}</text></>):(<text x={CX} y={CY+5} textAnchor="middle" fill="#94a3b8" fontSize="10">Total</text>)}
    </svg>
  );
}
