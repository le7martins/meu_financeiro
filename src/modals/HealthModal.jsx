import { mLabel } from '../utils.js';
import { tint } from '../styles.js';

export default function HealthModal({ open, healthScore, selMonth, onClose }) {
  return (<>
      {open&&healthScore&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"var(--backdrop-soft)"}} onClick={()=>onClose()}>
          <div className="modal-in" role="dialog" aria-modal="true" aria-labelledby="healthModalTitle" onClick={e=>e.stopPropagation()}
            style={{background:"var(--surface-raised)",borderTopLeftRadius:22,borderTopRightRadius:22,width:"100%",maxWidth:480,maxHeight:"88vh",overflowY:"auto",padding:"20px 18px 40px",border:"1px solid var(--border)"}}>
            {/* Handle */}
            <div aria-hidden="true" style={{width:36,height:4,borderRadius:2,background:"var(--border)",margin:"0 auto 18px"}}/>
            {/* Score circle */}
            <div style={{textAlign:"center",marginBottom:18}}>
              <div id="healthModalTitle" style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Saúde Financeira — {mLabel(selMonth)}</div>
              <div style={{position:"relative",width:100,height:100,margin:"0 auto 10px"}}>
                <svg viewBox="0 0 110 110" role="img" aria-label={`Pontuação ${healthScore.score} de 100`} style={{width:"100%",height:"100%"}}>
                  <circle cx="55" cy="55" r="46" fill="none" strokeWidth="10" style={{stroke:"var(--surface-3)"}}/>
                  <circle cx="55" cy="55" r="46" fill="none" stroke={healthScore.color} strokeWidth="10"
                    strokeDasharray={`${(healthScore.score/100)*289} 289`} strokeLinecap="round"
                    transform="rotate(-90 55 55)" style={{transition:"stroke-dasharray .8s ease"}}/>
                  <text x="55" y="52" textAnchor="middle" fontSize="26" fontWeight="800" style={{fill:healthScore.color}}>{healthScore.score}</text>
                  <text x="55" y="68" textAnchor="middle" fontSize="10" style={{fill:"var(--chart-label)"}}>pontos</text>
                </svg>
              </div>
              <div style={{fontSize:"var(--fs-3xl)",fontWeight:700,color:healthScore.color}}>{healthScore.level==="Saudável"?"Saudável 💚":healthScore.level==="Atenção"?"Atenção ⚠️":"Crítico 🚨"}</div>
            </div>
            {/* Barra progresso */}
            <div role="progressbar" aria-label="Pontuação de saúde financeira" aria-valuemin={0} aria-valuemax={100} aria-valuenow={healthScore.score}
              style={{height:6,background:"var(--track)",borderRadius:3,marginBottom:16,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${healthScore.score}%`,background:`linear-gradient(90deg,${tint(healthScore.color,53)},${healthScore.color})`,borderRadius:3,transition:"width .8s"}}/>
            </div>
            {/* Indicadores */}
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {[
                {label:"Gastos fixos / Renda",value:`${healthScore.fixedPct.toFixed(0)}%`,color:healthScore.fixedPct>70?"var(--danger)":healthScore.fixedPct>50?"var(--warning)":"var(--success)",detail:healthScore.fixedPct>70?"Acima do ideal (máx 70%)":healthScore.fixedPct>50?"Atenção (ideal < 50%)":"Ótimo"},
                {label:"Taxa de economia",value:`${healthScore.savingPct.toFixed(0)}%`,color:healthScore.savingPct<10?"var(--danger)":healthScore.savingPct<20?"var(--warning)":"var(--success)",detail:healthScore.savingPct<10?"Abaixo do mínimo (10%)":healthScore.savingPct<20?"Pode melhorar (ideal 20%+)":"Excelente"},
              ].map(({label,value,color,detail})=>(
                <div key={label} style={{background:"var(--surface-sunken)",borderRadius:11,padding:"11px 13px",border:"1px solid var(--border)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:"var(--fs-md)",color:"var(--text-2)",fontWeight:500}}>{label}</span>
                    <span style={{fontSize:"var(--fs-lg)",fontWeight:800,color}}>{value}</span>
                  </div>
                  <div aria-hidden="true" style={{height:4,background:"var(--surface-3)",borderRadius:2,overflow:"hidden",marginBottom:5}}>
                    <div style={{height:"100%",width:value,background:color,borderRadius:2,transition:"width .6s"}}/>
                  </div>
                  <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>{detail}</div>
                </div>
              ))}
            </div>
            <button type="button" onClick={()=>onClose()}
              style={{width:"100%",padding:"12px",minHeight:44,background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",color:"var(--text-2)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Fechar
            </button>
          </div>
        </div>
      )}
  </>);
}
