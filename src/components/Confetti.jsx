// Cores dos confetes: tokens semânticos (seguem o tema).
const COLORS = ["var(--success)","var(--warning)","var(--accent)","var(--danger)","var(--purple)","var(--orange)"];

export default function Confetti({ show }) {
  return (<>
      {show&&(
        <div aria-hidden="true" style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1000,overflow:"hidden"}}>
          {Array.from({length:30},(_,i)=>{
            const c=COLORS[i%COLORS.length];
            const left=Math.random()*100;
            const delay=Math.random()*1.5;
            const dur=2+Math.random()*2;
            const size=6+Math.random()*8;
            const rot=Math.random()*360;
            return(
              <div key={i} style={{
                position:"absolute",top:-20,left:`${left}%`,
                width:size,height:size,borderRadius:Math.random()>0.5?"50%":2,
                background:c,opacity:0.9,
                animation:`confettiFall ${dur}s ${delay}s ease-in forwards`,
                transform:`rotate(${rot}deg)`,
              }}/>
            );
          })}
        </div>
      )}
  </>);
}
