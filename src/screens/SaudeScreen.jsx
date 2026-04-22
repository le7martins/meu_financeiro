import { useState, useCallback } from 'react';
import HealthBar from '../components/HealthBar.jsx';
import { getMonthEntries } from '../logic.js';
import { eVal, mLabel, mShort, addM, fmt, fmtShort } from '../utils.js';

// ─── Masked currency input ───────────────────────────────────
function CurrencyInput({ value, onChange, placeholder = "0,00", style = {} }) {
  const [display, setDisplay] = useState(() =>
    value > 0 ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  );
  const handle = useCallback((e) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setDisplay(''); onChange(0); return; }
    const num = parseInt(digits, 10) / 100;
    setDisplay(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    onChange(num);
  }, [onChange]);
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={handle}
      style={style}
    />
  );
}

export default function SaudeScreen({ entries, dividas, cards, cardPurchases, cardFaturas, categories, nowMonth, goals, onSaveGoals, budgets, onSaveBudgets }) {
  const me = getMonthEntries(entries, dividas, nowMonth, cards, cardPurchases, cardFaturas);
  const rec = me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
  const dep = me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
  const saldo = rec - dep;
  const pago = me.filter(e=>e.type==="despesa"&&e.statusForMonth==="pago").reduce((s,e)=>s+eVal(e),0);
  const pendente = me.filter(e=>e.type==="despesa"&&e.statusForMonth==="a_pagar").reduce((s,e)=>s+eVal(e),0);

  const fixos = me.filter(e=>e.type==="despesa"&&e.isRecurring).reduce((s,e)=>s+eVal(e),0);
  const fixosPct = rec>0?((fixos/rec)*100):0;

  const economizado = saldo>0?saldo:0;
  const economiaPct = rec>0?((economizado/rec)*100):0;
  const metaEcon = goals.savingsPct>0?((goals.savingsPct/100)*rec):0;
  const metaRenda = goals.monthly||0;

  const trend = Array.from({length:3},(_,i)=>{
    const m = addM(nowMonth,-(2-i));
    const me2 = getMonthEntries(entries,dividas,m,cards,cardPurchases,cardFaturas);
    const r2 = me2.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const d2 = me2.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return { month: mShort(m), saldo: r2-d2, rec:r2, dep:d2 };
  });

  // Mesma lógica do healthScore em App.jsx (limiares unificados: 80/60)
  let score = 100;
  if (fixosPct > 70) score -= 30;
  else if (fixosPct > 50) score -= 15;
  else if (fixosPct > 30) score -= 5;
  if (economiaPct < 10) score -= 20;
  else if (economiaPct < 20) score -= 10;
  if (pendente > 0 && rec > 0 && (pendente/rec) > 0.3) score -= 10;
  score = Math.max(0, Math.min(100, score));
  const scoreColor = score>=80?"#4ade80":score>=60?"#facc15":"#f87171";
  const scoreLabel = score>=80?"Saudável 💚":score>=60?"Atenção ⚠️":"Crítico 🚨";

  const catMap = {};
  me.filter(e=>e.type==="despesa").forEach(e=>{
    catMap[e.category]=(catMap[e.category]||0)+eVal(e);
  });
  const catRank = Object.entries(catMap)
    .map(([id,v])=>({id,name:(categories.find(c=>c.id===id)||{name:id}).name,color:(categories.find(c=>c.id===id)||{color:"#9E9E9E"}).color,value:v}))
    .sort((a,b)=>b.value-a.value).slice(0,5);

  const pct = (v,max) => max>0?Math.min(100,(v/max)*100):0;

  const inpStyle = {
    width:"100%", boxSizing:"border-box",
    background:"var(--bg)", border:"1px solid #1a3a6e44",
    borderRadius:9, padding:"8px 12px",
    color:"var(--text1)", fontSize:13, fontWeight:600,
    outline:"none", fontFamily:"inherit",
  };
  const budgetInpStyle = {
    flex:1, background:"var(--bg)",
    border:"1px solid #1a3a6e33", borderRadius:7,
    padding:"5px 9px", color:"#8ab4f8",
    fontSize:11, outline:"none", fontFamily:"inherit",
  };

  // Título de sessão padrão
  const SectionTitle = ({children, color="#8ab4f8"}) => (
    <div style={{fontSize:11,fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>{children}</div>
  );

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{padding:"14px 14px 10px",borderBottom:"1px solid var(--border2)"}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>Saúde Financeira</div>
        <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{mLabel(nowMonth)}</div>
      </div>

      <div style={{padding:"14px 14px 0",display:"flex",flexDirection:"column",gap:12}}>

        {/* Score circle */}
        <div className="scoreCard" style={{background:"linear-gradient(135deg,var(--card-bg),var(--card-bg2))",border:`1px solid ${scoreColor}33`,borderRadius:16,padding:"18px 18px",textAlign:"center"}}>
          <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Score do mês</div>
          <div style={{position:"relative",width:110,height:110,margin:"0 auto 12px"}}>
            <svg viewBox="0 0 110 110" style={{width:"100%",height:"100%"}}>
              <circle cx="55" cy="55" r="46" fill="none" stroke="#111820" strokeWidth="10"/>
              <circle cx="55" cy="55" r="46" fill="none" stroke={scoreColor} strokeWidth="10"
                strokeDasharray={`${(score/100)*289} 289`}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
                style={{transition:"stroke-dasharray .8s ease"}}/>
              <text x="55" y="52" textAnchor="middle" fill={scoreColor} fontSize="26" fontWeight="800">{score}</text>
              <text x="55" y="68" textAnchor="middle" fill="#94a3b8" fontSize="10">pontos</text>
            </svg>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:scoreColor}}>{scoreLabel}</div>
          {rec===0&&(
            <div style={{marginTop:8,fontSize:11,color:"var(--text3)"}}>Adicione receitas e despesas para calcular seu score</div>
          )}
        </div>

        {/* Health bars */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <HealthBar label="Gastos fixos / Renda" value={fixosPct} max={100} color={fixosPct>70?"#f87171":fixosPct>50?"#facc15":"#4ade80"} suffix="%" detail={`${fmt(fixos)} de ${fmt(rec)}`}/>
          <HealthBar label="Economia do mês" value={economiaPct} max={100} color={economiaPct>=20?"#4ade80":economiaPct>=10?"#facc15":"#f87171"} suffix="%" detail={`${fmt(economizado)} poupado`}/>
          {metaRenda>0&&<HealthBar label="Meta de renda" value={pct(rec,metaRenda)} max={100} color="#8ab4f8" suffix="%" detail={`${fmt(rec)} de ${fmt(metaRenda)}`}/>}
          {metaEcon>0&&<HealthBar label="Meta de economia" value={pct(economizado,metaEcon)} max={100} color="#a78bfa" suffix="%" detail={`${fmt(economizado)} de ${fmt(metaEcon)}`}/>}
        </div>

        {/* 3-month trend */}
        <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:"14px"}}>
          <SectionTitle>Tendência — 3 meses</SectionTitle>
          <div style={{display:"flex",gap:6}}>
            {trend.map((t,i)=>(
              <div key={i} style={{flex:1,textAlign:"center",padding:"6px 0",background:i===2?"var(--bg)":"transparent",borderRadius:8}}>
                <div style={{fontSize:10,color:i===2?"var(--text2)":"var(--text3)",fontWeight:i===2?700:400,marginBottom:6}}>{t.month}</div>
                <div style={{fontSize:11,color:"#4ade80"}}>↑ {fmtShort(t.rec)}</div>
                <div style={{fontSize:11,color:"#fb923c"}}>↓ {fmtShort(t.dep)}</div>
                <div style={{fontSize:12,fontWeight:700,color:t.saldo>=0?"#4ade80":"#f87171",marginTop:2}}>{fmtShort(t.saldo)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top categories */}
        {catRank.length>0&&(
          <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:"14px"}}>
            <SectionTitle>Top Gastos por Categoria</SectionTitle>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {catRank.map((c,i)=>(
                <div key={i}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:c.color}}/>
                      <span style={{fontSize:12,color:"var(--text2)"}}>{c.name}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"var(--text3)"}}>{dep>0?((c.value/dep)*100).toFixed(0):0}%</span>
                      <span style={{fontSize:12,fontWeight:700,color:c.color}}>{fmt(c.value)}</span>
                    </div>
                  </div>
                  <div style={{height:4,background:"var(--bg)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${dep>0?(c.value/dep)*100:0}%`,background:c.color,borderRadius:2,transition:"width .5s"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial goals */}
        <div style={{background:"rgba(138,180,248,.06)",border:"1px solid #1a3a6e",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8ab4f8",marginBottom:12}}>🎯 Metas financeiras</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Meta de renda mensal (R$)</div>
              <CurrencyInput
                value={goals.monthly||0}
                onChange={v=>onSaveGoals({...goals,monthly:v})}
                placeholder="Ex: 5.000,00"
                style={inpStyle}
              />
            </div>
            <div>
              <div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Meta de economia (% da renda)</div>
              <div style={{display:"flex",gap:6}}>
                {[0,10,15,20,30].map(p=>(
                  <button key={p} onClick={()=>onSaveGoals({...goals,savingsPct:p})}
                    style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${goals.savingsPct===p?"#8ab4f8":"#111820"}`,background:goals.savingsPct===p?"#0d1a2e":"transparent",color:goals.savingsPct===p?"#8ab4f8":"var(--text3)",fontSize:11,fontWeight:700,cursor:"pointer"}}>{p===0?"Nenhum":`${p}%`}</button>
                ))}
              </div>
              {goals.savingsPct>0&&metaRenda>0&&(
                <div style={{marginTop:6,fontSize:10,color:"var(--text3)"}}>
                  = {fmt((goals.savingsPct/100)*metaRenda)}/mês de economia
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Emergency reserve */}
        <div style={{background:"rgba(74,222,128,.05)",border:"1px solid #4ade8033",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#4ade80",marginBottom:4}}>🏦 Reserva de Emergência</div>
          <div style={{fontSize:10,color:"var(--text3)",marginBottom:12}}>
            Recomendado: 3–6× despesas fixas
            {fixos>0&&<span style={{color:"#4ade8099",fontWeight:600}}> ({fmt(fixos*3)} – {fmt(fixos*6)})</span>}
          </div>
          {goals.reservaMeta>0&&(
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:11,color:"var(--text2)"}}>{fmt(goals.reservaAtual||0)} <span style={{color:"var(--text3)"}}>de {fmt(goals.reservaMeta)}</span></span>
                <span style={{fontSize:11,fontWeight:700,color:pct(goals.reservaAtual||0,goals.reservaMeta)>=100?"#4ade80":"#8ab4f8"}}>{pct(goals.reservaAtual||0,goals.reservaMeta).toFixed(0)}%</span>
              </div>
              <div style={{height:8,background:"var(--bg)",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct(goals.reservaAtual||0,goals.reservaMeta)}%`,background:`linear-gradient(90deg,#4ade8088,#4ade80)`,borderRadius:4,transition:"width .6s"}}/>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Meta (R$)</div>
              <CurrencyInput
                value={goals.reservaMeta||0}
                onChange={v=>onSaveGoals({...goals,reservaMeta:v})}
                placeholder="Ex: 15.000,00"
                style={{...inpStyle,border:"1px solid #4ade8033"}}
              />
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Guardado hoje (R$)</div>
              <CurrencyInput
                value={goals.reservaAtual||0}
                onChange={v=>onSaveGoals({...goals,reservaAtual:v})}
                placeholder="0,00"
                style={{...inpStyle,border:"1px solid #4ade8033"}}
              />
            </div>
          </div>
        </div>

        {/* Budget per category */}
        {catRank.length>0&&(
          <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:"14px"}}>
            <SectionTitle>💰 Orçamento por Categoria</SectionTitle>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {catRank.map((c,i)=>{
                const budget=budgets[c.id]||0;
                const pctUsed=budget>0?Math.min(100,(c.value/budget)*100):0;
                return(
                  <div key={i}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:"var(--text2)",flex:1}}>{c.name}</span>
                      <span style={{fontSize:11,fontWeight:700,color:c.color}}>{fmt(c.value)}</span>
                      {budget>0&&<span style={{fontSize:10,color:pctUsed>100?"#f87171":"var(--text3)"}}>/ {fmt(budget)}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <CurrencyInput
                        value={budget}
                        onChange={v=>onSaveBudgets({...budgets,[c.id]:v})}
                        placeholder="Orçamento R$"
                        style={budgetInpStyle}
                      />
                      {budget>0&&<div style={{flex:2,height:5,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pctUsed}%`,background:pctUsed>100?"#f87171":pctUsed>80?"#facc15":c.color,borderRadius:3,transition:"width .5s"}}/></div>}
                    </div>
                    {budget>0&&pctUsed>80&&(
                      <div style={{marginTop:4,fontSize:10,color:pctUsed>100?"#f87171":"#facc15",fontWeight:600}}>
                        {pctUsed>100?`⚠️ Orçamento estourado em ${(pctUsed-100).toFixed(0)}%`:`⏳ ${(100-pctUsed).toFixed(0)}% restante do orçamento`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {rec===0&&dep===0&&(
          <div style={{textAlign:"center",padding:"24px 0",background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14}}>
            <div style={{fontSize:36,marginBottom:8}}>📊</div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--text2)",marginBottom:4}}>Sem dados este mês</div>
            <div style={{fontSize:11,color:"var(--text3)",lineHeight:1.5}}>Adicione receitas e despesas na aba Contas para ver sua saúde financeira aqui.</div>
          </div>
        )}
      </div>
    </div>
  );
}
