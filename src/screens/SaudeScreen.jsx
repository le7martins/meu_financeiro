import { useState, useCallback } from 'react';
import HealthBar from '../components/HealthBar.jsx';
import { getMonthEntries } from '../logic.js';
import { eVal, mLabel, mShort, addM, mDiff, fmt, fmtShort } from '../utils.js';

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

// ─── Mini sparkline SVG ──────────────────────────────────────
function Sparkline({ data, color = "#4ade80", width = 60, height = 22 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="2.5" fill={color} />
    </svg>
  );
}

export default function SaudeScreen({ entries, dividas, cards, cardPurchases, cardFaturas, categories, nowMonth, goals, onSaveGoals, budgets, onSaveBudgets, todayWidget }) {
  const [showAllBudget, setShowAllBudget] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const blankDraft = () => ({name:'',targetAmount:0,targetMonth:addM(nowMonth,6),currentAmount:0});
  const [goalDraft, setGoalDraft] = useState(blankDraft);

  const goalsList = goals.savingsGoals || [];
  const addGoal = () => {
    if(!goalDraft.name.trim()||goalDraft.targetAmount<=0) return;
    onSaveGoals({...goals,savingsGoals:[...goalsList,{id:Date.now().toString(),...goalDraft}]});
    setGoalDraft(blankDraft());setShowGoalForm(false);
  };
  const removeGoal = (id) => onSaveGoals({...goals,savingsGoals:goalsList.filter(g=>g.id!==id)});
  const updateGoalAmount = (id,v) => onSaveGoals({...goals,savingsGoals:goalsList.map(g=>g.id===id?{...g,currentAmount:v}:g)});

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

  // 6-month trend for sparklines
  const trend6 = Array.from({length:6},(_,i)=>{
    const m = addM(nowMonth,-(5-i));
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

  // All categories with spending this month
  const catMap = {};
  me.filter(e=>e.type==="despesa").forEach(e=>{
    catMap[e.category]=(catMap[e.category]||0)+eVal(e);
  });

  const catRank = Object.entries(catMap)
    .map(([id,v])=>({id,name:(categories.find(c=>c.id===id)||{name:id}).name,color:(categories.find(c=>c.id===id)||{color:"#9E9E9E"}).color,value:v}))
    .sort((a,b)=>b.value-a.value);

  // Categories with budget set but no spending this month — show in budget section
  const catsWithBudgetOnly = categories.filter(c =>
    budgets[c.id] > 0 && !catMap[c.id]
  ).map(c => ({ id: c.id, name: c.name, color: c.color, value: 0 }));

  // Combined budget list: spending cats + budget-only cats
  const budgetList = [...catRank, ...catsWithBudgetOnly];
  const budgetListVisible = showAllBudget ? budgetList : budgetList.slice(0, 6);
  const hasBudgetOverrun = budgetList.some(c => budgets[c.id] > 0 && c.value > budgets[c.id]);

  const pct = (v,max) => max>0?Math.min(100,(v/max)*100):0;

  const inpStyle = {
    width:"100%", boxSizing:"border-box",
    background:"var(--bg)", border:"1px solid #1a3a6e44",
    borderRadius:9, padding:"8px 12px",
    color:"var(--text1)", fontSize:13, fontWeight:600,
    outline:"none", fontFamily:"inherit",
  };
  const budgetInpStyle = {
    width:90, background:"var(--bg)",
    border:"1px solid #1a3a6e33", borderRadius:7,
    padding:"5px 9px", color:"#8ab4f8",
    fontSize:11, outline:"none", fontFamily:"inherit",
    flexShrink: 0,
  };

  // Título de sessão padrão
  const SectionTitle = ({children, color="#8ab4f8", extra=null}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.06em"}}>{children}</div>
      {extra}
    </div>
  );

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{padding:"14px 14px 10px",borderBottom:"1px solid var(--border2)"}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>Saúde Financeira</div>
        <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{mLabel(nowMonth)}</div>
      </div>

      <div style={{padding:"14px 14px 0",display:"flex",flexDirection:"column",gap:12}}>

        {/* Score circle + sparkline */}
        <div className="scoreCard" style={{background:"linear-gradient(135deg,var(--card-bg),var(--card-bg2))",border:`1px solid ${scoreColor}33`,borderRadius:16,padding:"18px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            {/* Círculo */}
            <div style={{position:"relative",width:90,height:90,flexShrink:0}}>
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
            {/* Info + sparkline */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Score do mês</div>
              <div style={{fontSize:16,fontWeight:700,color:scoreColor,marginBottom:10}}>{scoreLabel}</div>
              {/* Mini sparkline saldo 6m */}
              <div style={{fontSize:9,color:"var(--text4)",marginBottom:3}}>Saldo — últimos 6 meses</div>
              <Sparkline data={trend6.map(t=>t.saldo)} color={trend6[5]?.saldo>=0?"#4ade80":"#f87171"} width={100} height={24}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                <span style={{fontSize:8,color:"var(--text4)"}}>{trend6[0]?.month}</span>
                <span style={{fontSize:8,color:"var(--text4)"}}>{trend6[5]?.month}</span>
              </div>
            </div>
          </div>
          {rec===0&&(
            <div style={{marginTop:10,fontSize:11,color:"var(--text3)",textAlign:"center"}}>Adicione receitas e despesas para calcular seu score</div>
          )}
        </div>

        {/* Widget "Quanto posso gastar hoje" */}
        {todayWidget && (
          <div style={{background:"linear-gradient(135deg,rgba(138,180,248,.07),rgba(138,180,248,.03))",border:"1px solid #1a3a6e44",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:11,background:"rgba(138,180,248,.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>Quanto posso gastar hoje</div>
              <div style={{fontSize:22,fontWeight:800,color:todayWidget.perDay>=0?"#8ab4f8":"#f87171",letterSpacing:"-0.5px",lineHeight:1}}>
                {fmt(Math.max(0,todayWidget.perDay))}
                <span style={{fontSize:12,fontWeight:500,color:"var(--text4)",marginLeft:5}}>/dia</span>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:9,color:"var(--text4)",marginBottom:2}}>Disponível</div>
              <div style={{fontSize:13,fontWeight:700,color:todayWidget.available>=0?"#4ade80":"#f87171"}}>{fmt(Math.max(0,todayWidget.available))}</div>
              <div style={{fontSize:9,color:"var(--text4)",marginTop:2}}>{todayWidget.daysLeft}d restantes</div>
            </div>
          </div>
        )}

        {/* Resumo rápido */}
        {rec>0&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {label:"Recebido",value:rec,color:"#4ade80",icon:"↑"},
              {label:"Gasto",value:dep,color:"#fb923c",icon:"↓"},
              {label:"Pago",value:pago,color:"#8ab4f8",icon:"✓"},
            ].map(({label,value,color,icon})=>(
              <div key={label} style={{background:"var(--card-bg)",border:`1px solid ${color}22`,borderRadius:12,padding:"10px 10px",textAlign:"center"}}>
                <div style={{fontSize:16,marginBottom:4}}>{icon}</div>
                <div style={{fontSize:11,fontWeight:800,color}}>{fmtShort(value)}</div>
                <div style={{fontSize:9,color:"var(--text3)",marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Health bars */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <HealthBar label="Gastos fixos / Renda" value={fixosPct} max={100} color={fixosPct>70?"#f87171":fixosPct>50?"#facc15":"#4ade80"} suffix="%" detail={`${fmt(fixos)} de ${fmt(rec)}`}/>
          <HealthBar label="Economia do mês" value={economiaPct} max={100} color={economiaPct>=20?"#4ade80":economiaPct>=10?"#facc15":"#f87171"} suffix="%" detail={`${fmt(economizado)} poupado`}/>
          {metaRenda>0&&<HealthBar label="Meta de renda" value={pct(rec,metaRenda)} max={100} color="#8ab4f8" suffix="%" detail={`${fmt(rec)} de ${fmt(metaRenda)}`}/>}
          {metaEcon>0&&<HealthBar label="Meta de economia" value={pct(economizado,metaEcon)} max={100} color="#a78bfa" suffix="%" detail={`${fmt(economizado)} de ${fmt(metaEcon)}`}/>}
        </div>

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

        {/* Savings goals with target date */}
        <div style={{background:"rgba(167,139,250,.06)",border:"1px solid #a78bfa33",borderRadius:14,padding:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:goalsList.length>0||showGoalForm?12:0}}>
            <div style={{fontSize:12,fontWeight:700,color:"#a78bfa"}}>🏁 Objetivos de poupança</div>
            {!showGoalForm&&<button onClick={()=>{setGoalDraft(blankDraft());setShowGoalForm(true);}}
              style={{fontSize:11,fontWeight:700,color:"#a78bfa",background:"rgba(167,139,250,.12)",border:"1px solid #a78bfa33",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>
              + Novo
            </button>}
          </div>

          {goalsList.length===0&&!showGoalForm&&(
            <div style={{fontSize:11,color:"var(--text3)",textAlign:"center",padding:"8px 0",lineHeight:1.6}}>
              Viagem, carro, curso... defina um objetivo e acompanhe mês a mês.
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {goalsList.map(goal=>{
              const monthsLeft=mDiff(nowMonth,goal.targetMonth);
              const pctVal=goal.targetAmount>0?Math.min(100,(goal.currentAmount/goal.targetAmount)*100):0;
              const remaining=Math.max(0,goal.targetAmount-goal.currentAmount);
              const needed=monthsLeft>0?remaining/monthsLeft:null;
              const isComplete=goal.currentAmount>=goal.targetAmount;
              const isOverdue=monthsLeft<0&&!isComplete;
              const barColor=isComplete?"#4ade80":isOverdue?"#f87171":"#a78bfa";
              return(
                <div key={goal.id} style={{background:"var(--bg)",borderRadius:10,padding:"12px",border:`1px solid ${isComplete?"#4ade8033":isOverdue?"#f8717133":"#a78bfa22"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--text1)"}}>{goal.name}</div>
                      <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>
                        {isComplete?"🎉 Concluído!":isOverdue?`⚠️ Prazo vencido (${mLabel(goal.targetMonth)})`:`Até ${mLabel(goal.targetMonth)} · ${monthsLeft} ${monthsLeft===1?"mês":"meses"}`}
                      </div>
                    </div>
                    <button onClick={()=>removeGoal(goal.id)}
                      style={{background:"transparent",border:"none",color:"var(--text4)",cursor:"pointer",fontSize:14,lineHeight:1,padding:"2px 4px",flexShrink:0}}>✕</button>
                  </div>
                  <div style={{height:6,background:"var(--border)",borderRadius:3,overflow:"hidden",marginBottom:6}}>
                    <div style={{height:"100%",width:`${pctVal}%`,background:barColor,borderRadius:3,transition:"width .6s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isComplete?0:8}}>
                    <div style={{fontSize:11,color:"var(--text2)"}}>
                      <span style={{fontWeight:700,color:barColor}}>{fmt(goal.currentAmount)}</span>
                      <span style={{color:"var(--text3)"}}> de {fmt(goal.targetAmount)}</span>
                      <span style={{color:"var(--text4)",fontSize:10}}> · {pctVal.toFixed(0)}%</span>
                    </div>
                    {!isComplete&&needed!==null&&(
                      <span style={{fontSize:10,fontWeight:700,color:"#facc15"}}>{fmt(needed)}/mês</span>
                    )}
                    {isComplete&&<span style={{fontSize:10,fontWeight:700,color:"#4ade80"}}>Meta atingida!</span>}
                  </div>
                  {!isComplete&&(
                    <CurrencyInput
                      key={goal.id+goal.currentAmount}
                      value={goal.currentAmount}
                      onChange={v=>updateGoalAmount(goal.id,v)}
                      placeholder="Guardado hoje (R$)"
                      style={{...inpStyle,fontSize:12,padding:"6px 10px",border:"1px solid #a78bfa22"}}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {showGoalForm&&(
            <div style={{marginTop:goalsList.length>0?12:0,background:"var(--bg)",borderRadius:10,padding:"12px",border:"1px solid #a78bfa33"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:10}}>Novo objetivo</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input style={{...inpStyle,fontSize:13}} placeholder="Nome (ex: Viagem, Carro, Curso...)"
                  value={goalDraft.name} onChange={e=>setGoalDraft(p=>({...p,name:e.target.value}))}/>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Quero juntar (R$)</div>
                    <CurrencyInput value={goalDraft.targetAmount} onChange={v=>setGoalDraft(p=>({...p,targetAmount:v}))}
                      placeholder="0,00" style={{...inpStyle,fontSize:12,padding:"7px 10px"}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Já tenho (R$)</div>
                    <CurrencyInput value={goalDraft.currentAmount} onChange={v=>setGoalDraft(p=>({...p,currentAmount:v}))}
                      placeholder="0,00" style={{...inpStyle,fontSize:12,padding:"7px 10px"}}/>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Prazo</div>
                  <input type="month" style={{...inpStyle,fontSize:12,padding:"7px 10px"}}
                    value={goalDraft.targetMonth} onChange={e=>setGoalDraft(p=>({...p,targetMonth:e.target.value}))}/>
                </div>
                {goalDraft.targetAmount>0&&goalDraft.targetMonth&&(()=>{
                  const ml=mDiff(nowMonth,goalDraft.targetMonth);
                  const need=ml>0?(goalDraft.targetAmount-goalDraft.currentAmount)/ml:null;
                  return need!==null&&need>0?(
                    <div style={{fontSize:11,color:"#a78bfa",background:"rgba(167,139,250,.1)",borderRadius:8,padding:"7px 10px"}}>
                      Guardar <strong>{fmt(need)}/mês</strong> por {ml} {ml===1?"mês":"meses"} para atingir a meta
                    </div>
                  ):null;
                })()}
                <div style={{display:"flex",gap:8,marginTop:2}}>
                  <button onClick={()=>setShowGoalForm(false)}
                    style={{flex:1,padding:"9px",background:"transparent",border:"1px solid var(--border)",borderRadius:10,color:"var(--text3)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    Cancelar
                  </button>
                  <button onClick={addGoal} disabled={!goalDraft.name.trim()||goalDraft.targetAmount<=0}
                    style={{flex:2,padding:"9px",background:"linear-gradient(135deg,#4a2a8e,#2d1a6e)",border:"1px solid #a78bfa33",color:"#a78bfa",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!goalDraft.name.trim()||goalDraft.targetAmount<=0)?0.5:1}}>
                    Salvar objetivo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Budget per category — enhanced */}
        {budgetList.length>0&&(
          <div style={{background:"var(--card-bg)",border:`1px solid ${hasBudgetOverrun?"#f8717133":"var(--border)"}`,borderRadius:14,padding:"14px"}}>
            <SectionTitle color={hasBudgetOverrun?"#f87171":"#8ab4f8"}
              extra={hasBudgetOverrun&&<span style={{fontSize:9,background:"#f8717122",color:"#f87171",border:"1px solid #f8717144",borderRadius:5,padding:"2px 7px",fontWeight:700}}>⚠️ Orçamento estourado</span>}>
              💰 Orçamento por Categoria
            </SectionTitle>

            {/* Summary totals row */}
            {Object.keys(budgets).length>0&&(()=>{
              const totalBudget = Object.values(budgets).reduce((s,v)=>s+(v||0),0);
              const totalSpent  = budgetList.reduce((s,c)=>s+c.value,0);
              const pctTot = totalBudget>0?Math.min(100,(totalSpent/totalBudget)*100):0;
              return (
                <div style={{background:"var(--bg)",borderRadius:10,padding:"10px 12px",marginBottom:12,display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:10,color:"var(--text3)"}}>Total gasto / orçamento</span>
                      <span style={{fontSize:10,fontWeight:700,color:pctTot>100?"#f87171":pctTot>80?"#facc15":"#4ade80"}}>{pctTot.toFixed(0)}%</span>
                    </div>
                    <div style={{height:6,background:"#111820",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pctTot}%`,background:pctTot>100?"linear-gradient(90deg,#f87171,#ef4444)":pctTot>80?"linear-gradient(90deg,#facc15,#f59e0b)":"linear-gradient(90deg,#4ade80,#22d3ee)",borderRadius:3,transition:"width .6s"}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:800,color:pctTot>100?"#f87171":"var(--text1)"}}>{fmt(totalSpent)}</div>
                    <div style={{fontSize:9,color:"var(--text3)"}}>de {fmt(totalBudget)}</div>
                  </div>
                </div>
              );
            })()}

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {budgetListVisible.map((c,i)=>{
                const budget=budgets[c.id]||0;
                const pctUsed=budget>0?Math.min(120,(c.value/budget)*100):0;
                const overrun = budget>0 && c.value>budget;
                const barColor = overrun?"#f87171":pctUsed>80?"#facc15":c.color;
                return(
                  <div key={i} style={{background:"var(--bg)",borderRadius:10,padding:"10px 12px",border:`1px solid ${overrun?"#f8717133":budget>0?"#1a3a6e22":"transparent"}`}}>
                    {/* Header row */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:budget>0?7:5}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:"var(--text2)",flex:1,fontWeight:500}}>{c.name}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <span style={{fontSize:12,fontWeight:700,color:overrun?"#f87171":c.color}}>{fmt(c.value)}</span>
                        {budget>0&&(
                          <span style={{fontSize:10,color:"var(--text4)"}}>/ {fmt(budget)}</span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar — only when budget set */}
                    {budget>0&&(
                      <div style={{marginBottom:6}}>
                        <div style={{height:6,background:"#111820",borderRadius:3,overflow:"hidden",position:"relative"}}>
                          <div style={{
                            height:"100%",
                            width:`${Math.min(100,pctUsed)}%`,
                            background:overrun
                              ?"linear-gradient(90deg,#f87171,#ef4444)"
                              :pctUsed>80
                              ?"linear-gradient(90deg,#facc15,#f59e0b)"
                              :`linear-gradient(90deg,${c.color}99,${c.color})`,
                            borderRadius:3,
                            transition:"width .5s"
                          }}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                          <span style={{fontSize:9,color:barColor,fontWeight:600}}>
                            {overrun
                              ?`⚠️ +${fmt(c.value-budget)} acima`
                              :pctUsed>80
                              ?`⏳ ${fmt(budget-c.value)} restante`
                              :`${(100-pctUsed).toFixed(0)}% livre`}
                          </span>
                          <span style={{fontSize:9,color:"var(--text4)"}}>{pctUsed.toFixed(0)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Budget input */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:"var(--text4)",flexShrink:0}}>Limite:</span>
                      <CurrencyInput
                        value={budget}
                        onChange={v=>onSaveBudgets({...budgets,[c.id]:v})}
                        placeholder="R$ 0,00"
                        style={budgetInpStyle}
                      />
                      {budget>0&&(
                        <button onClick={()=>onSaveBudgets({...budgets,[c.id]:0})}
                          style={{background:"none",border:"none",color:"var(--text4)",cursor:"pointer",fontSize:14,padding:"0 4px",lineHeight:1,flexShrink:0}}
                          title="Remover limite">✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show more / less */}
            {budgetList.length>6&&(
              <button onClick={()=>setShowAllBudget(p=>!p)}
                style={{width:"100%",marginTop:10,padding:"8px",background:"none",border:"1px solid var(--border2)",borderRadius:8,color:"var(--text3)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                {showAllBudget?`▲ Mostrar menos`:`▼ Ver mais ${budgetList.length-6} categorias`}
              </button>
            )}

            {/* Add budget hint when no budgets set */}
            {Object.keys(budgets).filter(k=>budgets[k]>0).length===0&&(
              <div style={{marginTop:8,fontSize:11,color:"var(--text3)",textAlign:"center",lineHeight:1.5}}>
                💡 Defina limites de orçamento para cada categoria e receba alertas quando ultrapassar
              </div>
            )}
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
