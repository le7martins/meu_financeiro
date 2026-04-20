export default function GradCard({label,value,color,bg,icon,onAdd}){
  return(<div className="gradCard" style={{background:bg,border:`1px solid ${color}22`,borderRadius:16,padding:"14px 14px",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle at top right, ${color}18, transparent 70%)`,pointerEvents:"none"}}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div className="gradCardIcon" style={{width:34,height:34,borderRadius:10,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div>
      {onAdd&&<button onClick={onAdd} className="sumAddBtn" style={{width:26,height:26,borderRadius:7,background:`${color}22`,border:`1px solid ${color}44`,color,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,lineHeight:1}}>+</button>}
    </div>
    <div className="gradCardLabel" style={{fontSize:11,color:`${color}99`,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    <div className="gradCardValue" style={{fontSize:18,fontWeight:800,color:"var(--text1)",letterSpacing:"-0.5px"}}>{value}</div>
  </div>);
}
