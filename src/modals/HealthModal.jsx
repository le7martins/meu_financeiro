import { mLabel } from '../utils.js';

export default function HealthModal({ open, healthScore, selMonth, onClose }) {
  return (<>
      {open&&healthScore&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>onClose()}>
          <div className="modal-in" onClick={e=>e.stopPropagation()}
            style={{background:"var(--card-bg)",borderTopLeftRadius:22,borderTopRightRadius:22,width:"100%",maxWidth:480,maxHeight:"88vh",overflowY:"auto",padding:"20px 18px 40px",border:"1px solid var(--border)"}}>
            {/* Handle */}
            <div style={{width:36,height:4,borderRadius:2,background:"var(--border)",margin:"0 auto 18px"}}/>
            {/* Score circle */}
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Saúde Financeira — {mLabel(selMonth)}</div>
              <div style={{position:"relative",width:100,height:100,margin:"0 auto 10px"}}>
                <svg viewBox="0 0 110 110" style={{width:"100%",height:"100%"}}>
                  <circle cx="55" cy="55" r="46" fill="none" stroke="var(--card-bg2)" strokeWidth="10"/>
                  <circle cx="55" cy="55" r="46" fill="none" stroke={healthScore.color} strokeWidth="10"
                    strokeDasharray={`${(healthScore.score/100)*289} 289`} strokeLinecap="round"
                    transform="rotate(-90 55 55)" style={{transition:"stroke-dasharray .8s ease"}}/>
                  <text x="55" y="52" textAnchor="middle" fill={healthScore.color} fontSize="26" fontWeight="800">{healthScore.score}</text>
                  <text x="55" y="68" textAnchor="middle" fill="#94a3b8" fontSize="10">pontos</text>
                </svg>
              </div>
              <div style={{fontSize:17,fontWeight:700,color:healthScore.color}}>{healthScore.level==="Saudável"?"Saudável 💚":healthScore.level==="Atenção"?"Atenção ⚠️":"Crítico 🚨"}</div>
            </div>
            {/* Barra progresso */}
            <div style={{height:6,background:"var(--bg)",borderRadius:3,marginBottom:16,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${healthScore.score}%`,background:`linear-gradient(90deg,${healthScore.color}88,${healthScore.color})`,borderRadius:3,transition:"width .8s"}}/>
            </div>
            {/* Indicadores */}
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {[
                {label:"Gastos fixos / Renda",value:`${healthScore.fixedPct.toFixed(0)}%`,color:healthScore.fixedPct>70?"#f87171":healthScore.fixedPct>50?"#facc15":"#4ade80",detail:healthScore.fixedPct>70?"Acima do ideal (máx 70%)":healthScore.fixedPct>50?"Atenção (ideal < 50%)":"Ótimo"},
                {label:"Taxa de economia",value:`${healthScore.savingPct.toFixed(0)}%`,color:healthScore.savingPct<10?"#f87171":healthScore.savingPct<20?"#facc15":"#4ade80",detail:healthScore.savingPct<10?"Abaixo do mínimo (10%)":healthScore.savingPct<20?"Pode melhorar (ideal 20%+)":"Excelente"},
              ].map(({label,value,color,detail})=>(
                <div key={label} style={{background:"var(--bg)",borderRadius:11,padding:"11px 13px",border:"1px solid var(--border)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{label}</span>
                    <span style={{fontSize:14,fontWeight:800,color}}>{value}</span>
                  </div>
                  <div style={{height:4,background:"var(--card-bg2)",borderRadius:2,overflow:"hidden",marginBottom:5}}>
                    <div style={{height:"100%",width:value,background:color,borderRadius:2,transition:"width .6s"}}/>
                  </div>
                  <div style={{fontSize:10,color:"var(--text3)"}}>{detail}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>onClose()}
              style={{width:"100%",padding:"12px",background:"var(--card-bg2)",border:"1px solid var(--border)",borderRadius:12,color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Fechar
            </button>
          </div>
        </div>
      )}
  </>);
}
