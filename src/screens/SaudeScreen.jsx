import { useState, useCallback } from 'react';
import HealthBar from '../components/HealthBar.jsx';
import { getMonthEntries } from '../logic.js';
import { tint } from '../styles.js';
import { eVal, mLabel, mShort, addM, mDiff, fmt, fmtShort, newId } from '../utils.js';

// ─── Masked currency input ───────────────────────────────────
function CurrencyInput({ value, onChange, placeholder = "0,00", style = {}, ...rest }) {
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
      {...rest}
    />
  );
}

// ─── Mini sparkline SVG ──────────────────────────────────────
function Sparkline({ data, label = "Tendência", color = "var(--success)", width = 60, height = 22 }) {
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
    <svg width={width} height={height} role="img" aria-label={label} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }} />
      <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="2.5" style={{ fill: color }} />
    </svg>
  );
}

export default function SaudeScreen({ entries, dividas, cards, cardPurchases, cardFaturas, categories, nowMonth, goals, onSaveGoals, budgets, onSaveBudgets, todayWidget, accounts=[], accountBalances={} }) {
  const [showAllBudget, setShowAllBudget] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const blankDraft = () => ({name:'',targetAmount:0,targetMonth:addM(nowMonth,6),currentAmount:0});
  const [goalDraft, setGoalDraft] = useState(blankDraft);

  const goalsList = goals.savingsGoals || [];
  const addGoal = () => {
    if(!goalDraft.name.trim()||goalDraft.targetAmount<=0) return;
    onSaveGoals({...goals,savingsGoals:[...goalsList,{id:newId(),...goalDraft}]});
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
  const scoreColor = score>=80?"var(--success)":score>=60?"var(--warning)":"var(--danger)";
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
    background:"var(--input-bg)", border:`1px solid ${tint("var(--accent-border)",40)}`,
    borderRadius:9, padding:"8px 12px",
    color:"var(--text-1)", fontSize:"var(--fs-base)", fontWeight:600,
    outline:"none", fontFamily:"inherit",
  };
  const budgetInpStyle = {
    width:90, background:"var(--input-bg)",
    border:`1px solid ${tint("var(--accent-border)",40)}`, borderRadius:7,
    padding:"5px 9px", color:"var(--accent)",
    fontSize:"var(--fs-sm)", outline:"none", fontFamily:"inherit",
    flexShrink: 0,
  };

  // Título de sessão padrão
  const SectionTitle = ({children, color="var(--accent)", extra=null}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontSize:"var(--fs-sm)",fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.06em"}}>{children}</div>
      {extra}
    </div>
  );

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{padding:"14px 14px 10px",borderBottom:"1px solid var(--border-subtle)"}}>
        <div style={{fontSize:"var(--fs-lg)",fontWeight:700,color:"var(--text-1)"}}>Saúde Financeira</div>
        <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>{mLabel(nowMonth)}</div>
      </div>

      <div style={{padding:"14px 14px 0",display:"flex",flexDirection:"column",gap:12}}>

        {/* Score circle + sparkline */}
        <div className="scoreCard" style={{background:"linear-gradient(135deg,var(--surface),var(--surface-2))",border:`1px solid ${tint(scoreColor,20)}`,borderRadius:"var(--radius-xl)",padding:"18px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            {/* Círculo */}
            <div style={{position:"relative",width:90,height:90,flexShrink:0}}>
              <svg viewBox="0 0 110 110" role="img" aria-label={`Score do mês: ${score} de 100 pontos, ${scoreLabel.replace(/[^\p{L}\s]/gu,"").trim()}`} style={{width:"100%",height:"100%"}}>
                <circle cx="55" cy="55" r="46" fill="none" strokeWidth="10" style={{stroke:"var(--chart-grid)"}}/>
                <circle cx="55" cy="55" r="46" fill="none" strokeWidth="10"
                  strokeDasharray={`${(score/100)*289} 289`}
                  strokeLinecap="round"
                  transform="rotate(-90 55 55)"
                  style={{stroke:scoreColor,transition:"stroke-dasharray .8s ease"}}/>
                <text x="55" y="52" textAnchor="middle" fontSize="26" fontWeight="800" style={{fill:scoreColor}}>{score}</text>
                <text x="55" y="68" textAnchor="middle" fontSize="10" style={{fill:"var(--chart-label)"}}>pontos</text>
              </svg>
            </div>
            {/* Info + sparkline */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Score do mês</div>
              <div style={{fontSize:"var(--fs-2xl)",fontWeight:700,color:scoreColor,marginBottom:10}}>{scoreLabel}</div>
              {/* Mini sparkline saldo 6m */}
              <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:3}}>Saldo — últimos 6 meses</div>
              <Sparkline data={trend6.map(t=>t.saldo)} label={`Saldo dos últimos 6 meses, de ${trend6[0]?.month} a ${trend6[5]?.month}: ${trend6.map(t=>fmtShort(t.saldo)).join(", ")}`} color={trend6[5]?.saldo>=0?"var(--success)":"var(--danger)"} width={100} height={24}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                <span style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)"}}>{trend6[0]?.month}</span>
                <span style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)"}}>{trend6[5]?.month}</span>
              </div>
            </div>
          </div>
          {rec===0&&(
            <div style={{marginTop:10,fontSize:"var(--fs-sm)",color:"var(--text-3)",textAlign:"center"}}>Adicione receitas e despesas para calcular seu score</div>
          )}
        </div>

        {/* Widget "Quanto posso gastar hoje" */}
        {todayWidget && (
          <div style={{background:"var(--accent-soft)",border:`1px solid ${tint("var(--accent-border)",40)}`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:11,background:"var(--accent-soft)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" style={{stroke:"var(--accent)"}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>Quanto posso gastar hoje</div>
              <div style={{fontSize:"var(--fs-5xl)",fontWeight:800,color:todayWidget.perDay>=0?"var(--accent)":"var(--danger)",letterSpacing:"-0.5px",lineHeight:1}}>
                {fmt(Math.max(0,todayWidget.perDay))}
                <span style={{fontSize:"var(--fs-md)",fontWeight:500,color:"var(--text-3)",marginLeft:5}}>/dia</span>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:2}}>Disponível</div>
              <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:todayWidget.available>=0?"var(--success)":"var(--danger)"}}>{fmt(Math.max(0,todayWidget.available))}</div>
              <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginTop:2}}>{todayWidget.daysLeft}d restantes</div>
            </div>
          </div>
        )}

        {/* Resumo rápido */}
        {rec>0&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {label:"Recebido",value:rec,color:"var(--success)",icon:"↑"},
              {label:"Gasto",value:dep,color:"var(--orange)",icon:"↓"},
              {label:"Pago",value:pago,color:"var(--accent)",icon:"✓"},
            ].map(({label,value,color,icon})=>(
              <div key={label} style={{background:"var(--surface)",border:`1px solid ${tint(color,13)}`,borderRadius:"var(--radius-lg)",padding:"10px 10px",textAlign:"center"}}>
                <div aria-hidden="true" style={{fontSize:"var(--fs-2xl)",marginBottom:4}}>{icon}</div>
                <div style={{fontSize:"var(--fs-sm)",fontWeight:800,color}}>{fmtShort(value)}</div>
                <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Health bars */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <HealthBar label="Gastos fixos / Renda" value={fixosPct} max={100} color={fixosPct>70?"var(--danger)":fixosPct>50?"var(--warning)":"var(--success)"} suffix="%" detail={`${fmt(fixos)} de ${fmt(rec)}`}/>
          <HealthBar label="Economia do mês" value={economiaPct} max={100} color={economiaPct>=20?"var(--success)":economiaPct>=10?"var(--warning)":"var(--danger)"} suffix="%" detail={`${fmt(economizado)} poupado`}/>
          {metaRenda>0&&<HealthBar label="Meta de renda" value={pct(rec,metaRenda)} max={100} color="var(--accent)" suffix="%" detail={`${fmt(rec)} de ${fmt(metaRenda)}`}/>}
          {metaEcon>0&&<HealthBar label="Meta de economia" value={pct(economizado,metaEcon)} max={100} color="var(--purple)" suffix="%" detail={`${fmt(economizado)} de ${fmt(metaEcon)}`}/>}
        </div>

        {/* Net worth */}
        {(accounts.length>0||dividas.length>0)&&(()=>{
          const totalAssets=accounts.reduce((s,acc)=>s+(accountBalances[acc.id]??acc.initialBalance??0),0);
          const totalLiabilities=dividas.reduce((s,d)=>{
            const instPaid=Math.min(d.installments,Math.max(0,mDiff(d.startMonth,nowMonth)));
            return s+Math.max(0,d.totalAmount-instPaid*(d.totalAmount/d.installments));
          },0);
          const netWorth=totalAssets-totalLiabilities;
          const pos=netWorth>=0;
          return(
            <div style={{background:"var(--success-soft)",border:"1px solid var(--success-border)",borderRadius:14,padding:"14px"}}>
              <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--success)",marginBottom:12}}>🏛️ Patrimônio Líquido</div>
              <div style={{textAlign:"center",marginBottom:14}}>
                <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:3}}>Patrimônio líquido</div>
                <div style={{fontSize:26,fontWeight:800,color:pos?"var(--success)":"var(--danger)",letterSpacing:"-1px"}}>{fmt(netWorth)}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:accounts.length>0?10:0}}>
                <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-md)",padding:"10px 12px"}}>
                  <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:4}}>↑ Ativos</div>
                  <div style={{fontSize:"var(--fs-lg)",fontWeight:700,color:"var(--success)"}}>{fmt(totalAssets)}</div>
                  {accounts.length>0&&<div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:2}}>{accounts.length} conta{accounts.length!==1?"s":""}</div>}
                </div>
                <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-md)",padding:"10px 12px"}}>
                  <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:4}}>↓ Passivos</div>
                  <div style={{fontSize:"var(--fs-lg)",fontWeight:700,color:totalLiabilities>0?"var(--danger)":"var(--success)"}}>{fmt(totalLiabilities)}</div>
                  {dividas.length>0&&<div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:2}}>{dividas.length} dívida{dividas.length!==1?"s":""}</div>}
                </div>
              </div>
              {accounts.length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {accounts.map((acc,i)=>{
                    const bal=accountBalances[acc.id]??acc.initialBalance??0;
                    return(
                      <div key={acc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid var(--border-subtle)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:acc.color||"var(--success)"}}/>
                          <span style={{fontSize:"var(--fs-md)",color:"var(--text-2)"}}>{acc.name}</span>
                        </div>
                        <span style={{fontSize:"var(--fs-md)",fontWeight:700,color:bal>=0?"var(--success)":"var(--danger)"}}>{fmt(bal)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Financial goals */}
        <div style={{background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--accent)",marginBottom:12}}>🎯 Metas financeiras</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:5}}>Meta de renda mensal</div>
              <CurrencyInput
                value={goals.monthly||0}
                onChange={v=>onSaveGoals({...goals,monthly:v})}
                placeholder="Ex: 5.000,00"
                aria-label="Meta de renda mensal"
                style={inpStyle}
              />
            </div>
            <div>
              <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:5}}>Meta de economia (% da renda)</div>
              <div style={{display:"flex",gap:6}}>
                {[0,10,15,20,30].map(p=>(
                  <button key={p} aria-pressed={goals.savingsPct===p} onClick={()=>onSaveGoals({...goals,savingsPct:p})}
                    style={{flex:1,padding:"7px 0",borderRadius:"var(--radius-sm)",border:`1px solid ${goals.savingsPct===p?"var(--accent)":"var(--border)"}`,background:goals.savingsPct===p?"var(--accent-surface)":"transparent",color:goals.savingsPct===p?"var(--accent)":"var(--text-3)",fontSize:"var(--fs-sm)",fontWeight:700,cursor:"pointer",minHeight:36}}>{p===0?"Nenhum":`${p}%`}</button>
                ))}
              </div>
              {goals.savingsPct>0&&metaRenda>0&&(
                <div style={{marginTop:6,fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>
                  = {fmt((goals.savingsPct/100)*metaRenda)}/mês de economia
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Emergency reserve */}
        <div style={{background:"var(--success-soft)",border:"1px solid var(--success-border)",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--success)",marginBottom:4}}>🏦 Reserva de Emergência</div>
          <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:12}}>
            Recomendado: 3–6× despesas fixas
            {fixos>0&&<span style={{color:"var(--success)",fontWeight:600}}> ({fmt(fixos*3)} – {fmt(fixos*6)})</span>}
          </div>
          {goals.reservaMeta>0&&(
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:"var(--fs-sm)",color:"var(--text-2)"}}>{fmt(goals.reservaAtual||0)} <span style={{color:"var(--text-3)"}}>de {fmt(goals.reservaMeta)}</span></span>
                <span style={{fontSize:"var(--fs-sm)",fontWeight:700,color:pct(goals.reservaAtual||0,goals.reservaMeta)>=100?"var(--success)":"var(--accent)"}}>{pct(goals.reservaAtual||0,goals.reservaMeta).toFixed(0)}%</span>
              </div>
              <div role="progressbar" aria-label="Reserva de emergência" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct(goals.reservaAtual||0,goals.reservaMeta))} style={{height:8,background:"var(--track)",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct(goals.reservaAtual||0,goals.reservaMeta)}%`,background:"var(--progress-success)",borderRadius:4,transition:"width .6s"}}/>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:5}}>Meta</div>
              <CurrencyInput
                value={goals.reservaMeta||0}
                onChange={v=>onSaveGoals({...goals,reservaMeta:v})}
                placeholder="Ex: 15.000,00"
                aria-label="Meta da reserva de emergência"
                style={{...inpStyle,border:"1px solid var(--success-border)"}}
              />
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:5}}>Guardado hoje</div>
              <CurrencyInput
                value={goals.reservaAtual||0}
                onChange={v=>onSaveGoals({...goals,reservaAtual:v})}
                placeholder="0,00"
                aria-label="Guardado hoje na reserva"
                style={{...inpStyle,border:"1px solid var(--success-border)"}}
              />
            </div>
          </div>
        </div>

        {/* Savings goals with target date */}
        <div style={{background:"var(--purple-soft)",border:"1px solid var(--purple-border)",borderRadius:14,padding:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:goalsList.length>0||showGoalForm?12:0}}>
            <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--purple)"}}>🏁 Objetivos de poupança</div>
            {!showGoalForm&&<button onClick={()=>{setGoalDraft(blankDraft());setShowGoalForm(true);}}
              style={{fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--purple)",background:"var(--purple-soft)",border:"1px solid var(--purple-border)",borderRadius:7,padding:"4px 10px",minHeight:32,cursor:"pointer",fontFamily:"inherit"}}>
              + Novo
            </button>}
          </div>

          {goalsList.length===0&&!showGoalForm&&(
            <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",textAlign:"center",padding:"8px 0",lineHeight:1.6}}>
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
              const barColor=isComplete?"var(--success)":isOverdue?"var(--danger)":"var(--purple)";
              return(
                <div key={goal.id} style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-md)",padding:"12px",border:`1px solid ${isComplete?"var(--success-border)":isOverdue?"var(--danger-border)":tint("var(--purple)",13)}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)"}}>{goal.name}</div>
                      <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>
                        {isComplete?"🎉 Concluído!":isOverdue?`⚠️ Prazo vencido (${mLabel(goal.targetMonth)})`:`Até ${mLabel(goal.targetMonth)} · ${monthsLeft} ${monthsLeft===1?"mês":"meses"}`}
                      </div>
                    </div>
                    <button onClick={()=>removeGoal(goal.id)} aria-label={`Remover objetivo ${goal.name}`}
                      style={{background:"transparent",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:"var(--fs-lg)",lineHeight:1,padding:"2px 4px",minWidth:36,minHeight:36,flexShrink:0}}>✕</button>
                  </div>
                  <div role="progressbar" aria-label={`Progresso de ${goal.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctVal)} style={{height:6,background:"var(--track)",borderRadius:3,overflow:"hidden",marginBottom:6}}>
                    <div style={{height:"100%",width:`${pctVal}%`,background:barColor,borderRadius:3,transition:"width .6s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isComplete?0:8}}>
                    <div style={{fontSize:"var(--fs-sm)",color:"var(--text-2)"}}>
                      <span style={{fontWeight:700,color:barColor}}>{fmt(goal.currentAmount)}</span>
                      <span style={{color:"var(--text-3)"}}> de {fmt(goal.targetAmount)}</span>
                      <span style={{color:"var(--text-3)",fontSize:"var(--fs-xs)"}}> · {pctVal.toFixed(0)}%</span>
                    </div>
                    {!isComplete&&needed!==null&&(
                      <span style={{fontSize:"var(--fs-xs)",fontWeight:700,color:"var(--warning)"}}>{fmt(needed)}/mês</span>
                    )}
                    {isComplete&&<span style={{fontSize:"var(--fs-xs)",fontWeight:700,color:"var(--success)"}}>Meta atingida!</span>}
                  </div>
                  {!isComplete&&(
                    <CurrencyInput
                      key={goal.id+goal.currentAmount}
                      value={goal.currentAmount}
                      onChange={v=>updateGoalAmount(goal.id,v)}
                      placeholder="Guardado hoje"
                      style={{...inpStyle,fontSize:"var(--fs-md)",padding:"6px 10px",border:`1px solid ${tint("var(--purple)",13)}`}}
                      aria-label={`Valor guardado em ${goal.name}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {showGoalForm&&(
            <div style={{marginTop:goalsList.length>0?12:0,background:"var(--surface-sunken)",borderRadius:"var(--radius-md)",padding:"12px",border:"1px solid var(--purple-border)"}}>
              <div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--purple)",marginBottom:10}}>Novo objetivo</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input style={{...inpStyle,fontSize:"var(--fs-base)"}} placeholder="Nome (ex: Viagem, Carro, Curso...)" aria-label="Nome do objetivo"
                  value={goalDraft.name} onChange={e=>setGoalDraft(p=>({...p,name:e.target.value}))}/>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:4}}>Quero juntar</div>
                    <CurrencyInput aria-label="Quero juntar" value={goalDraft.targetAmount} onChange={v=>setGoalDraft(p=>({...p,targetAmount:v}))}
                      placeholder="0,00" style={{...inpStyle,fontSize:"var(--fs-md)",padding:"7px 10px"}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:4}}>Já tenho</div>
                    <CurrencyInput aria-label="Já tenho" value={goalDraft.currentAmount} onChange={v=>setGoalDraft(p=>({...p,currentAmount:v}))}
                      placeholder="0,00" style={{...inpStyle,fontSize:"var(--fs-md)",padding:"7px 10px"}}/>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:4}}>Prazo</div>
                  <input type="month" aria-label="Prazo do objetivo" style={{...inpStyle,fontSize:"var(--fs-md)",padding:"7px 10px"}}
                    value={goalDraft.targetMonth} onChange={e=>setGoalDraft(p=>({...p,targetMonth:e.target.value}))}/>
                </div>
                {goalDraft.targetAmount>0&&goalDraft.targetMonth&&(()=>{
                  const ml=mDiff(nowMonth,goalDraft.targetMonth);
                  const need=ml>0?(goalDraft.targetAmount-goalDraft.currentAmount)/ml:null;
                  return need!==null&&need>0?(
                    <div style={{fontSize:"var(--fs-sm)",color:"var(--purple)",background:"var(--purple-soft)",borderRadius:"var(--radius-sm)",padding:"7px 10px"}}>
                      Guardar <strong>{fmt(need)}/mês</strong> por {ml} {ml===1?"mês":"meses"} para atingir a meta
                    </div>
                  ):null;
                })()}
                <div style={{display:"flex",gap:8,marginTop:2}}>
                  <button onClick={()=>setShowGoalForm(false)}
                    style={{flex:1,padding:"9px",background:"transparent",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-md)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    Cancelar
                  </button>
                  <button onClick={addGoal} disabled={!goalDraft.name.trim()||goalDraft.targetAmount<=0}
                    style={{flex:2,padding:"9px",background:"var(--btn-purple-bg)",border:"1px solid var(--btn-purple-border)",color:"var(--btn-purple-text)",borderRadius:"var(--radius-md)",fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!goalDraft.name.trim()||goalDraft.targetAmount<=0)?0.5:1}}>
                    Salvar objetivo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Budget per category — enhanced */}
        {budgetList.length>0&&(
          <div style={{background:"var(--surface)",border:`1px solid ${hasBudgetOverrun?"var(--danger-border)":"var(--border)"}`,borderRadius:14,padding:"14px"}}>
            <SectionTitle color={hasBudgetOverrun?"var(--danger)":"var(--accent)"}
              extra={hasBudgetOverrun&&<span style={{fontSize:"var(--fs-2xs)",background:"var(--danger-soft)",color:"var(--danger)",border:"1px solid var(--danger-border)",borderRadius:5,padding:"2px 7px",fontWeight:700}}>⚠️ Orçamento estourado</span>}>
              💰 Orçamento por Categoria
            </SectionTitle>

            {/* Summary totals row */}
            {Object.keys(budgets).length>0&&(()=>{
              const totalBudget = Object.values(budgets).reduce((s,v)=>s+(v||0),0);
              const totalSpent  = budgetList.reduce((s,c)=>s+c.value,0);
              const pctTot = totalBudget>0?Math.min(100,(totalSpent/totalBudget)*100):0;
              return (
                <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-md)",padding:"10px 12px",marginBottom:12,display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>Total gasto / orçamento</span>
                      <span style={{fontSize:"var(--fs-xs)",fontWeight:700,color:pctTot>100?"var(--danger)":pctTot>80?"var(--warning)":"var(--success)"}}>{pctTot.toFixed(0)}%</span>
                    </div>
                    <div role="progressbar" aria-label="Total gasto / orçamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctTot)} style={{height:6,background:"var(--track)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pctTot}%`,background:pctTot>100?"var(--progress-danger)":pctTot>80?"var(--progress-warning)":"var(--progress-success)",borderRadius:3,transition:"width .6s"}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:"var(--fs-md)",fontWeight:800,color:pctTot>100?"var(--danger)":"var(--text-1)"}}>{fmt(totalSpent)}</div>
                    <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)"}}>de {fmt(totalBudget)}</div>
                  </div>
                </div>
              );
            })()}

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {budgetListVisible.map((c,i)=>{
                const budget=budgets[c.id]||0;
                const pctUsed=budget>0?Math.min(120,(c.value/budget)*100):0;
                const overrun = budget>0 && c.value>budget;
                const barColor = overrun?"var(--danger)":pctUsed>80?"var(--warning)":c.color;
                return(
                  <div key={i} style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-md)",padding:"10px 12px",border:`1px solid ${overrun?"var(--danger-border)":budget>0?"var(--border-subtle)":"transparent"}`}}>
                    {/* Header row */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:budget>0?7:5}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                      <span style={{fontSize:"var(--fs-md)",color:"var(--text-2)",flex:1,fontWeight:500}}>{c.name}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <span style={{fontSize:"var(--fs-md)",fontWeight:700,color:overrun?"var(--danger)":c.color}}>{fmt(c.value)}</span>
                        {budget>0&&(
                          <span style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>/ {fmt(budget)}</span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar — only when budget set */}
                    {budget>0&&(
                      <div style={{marginBottom:6}}>
                        <div role="progressbar" aria-label={`Orçamento de ${c.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100,pctUsed))} style={{height:6,background:"var(--track)",borderRadius:3,overflow:"hidden",position:"relative"}}>
                          <div style={{
                            height:"100%",
                            width:`${Math.min(100,pctUsed)}%`,
                            background:overrun
                              ?"var(--progress-danger)"
                              :pctUsed>80
                              ?"var(--progress-warning)"
                              :`linear-gradient(90deg,${tint(c.color,60)},${c.color})`,
                            borderRadius:3,
                            transition:"width .5s"
                          }}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                          <span style={{fontSize:"var(--fs-2xs)",color:barColor,fontWeight:600}}>
                            {overrun
                              ?`⚠️ +${fmt(c.value-budget)} acima`
                              :pctUsed>80
                              ?`⏳ ${fmt(budget-c.value)} restante`
                              :`${(100-pctUsed).toFixed(0)}% livre`}
                          </span>
                          <span style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)"}}>{pctUsed.toFixed(0)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Budget input */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",flexShrink:0}}>Limite:</span>
                      <CurrencyInput
                        value={budget}
                        onChange={v=>onSaveBudgets({...budgets,[c.id]:v})}
                        placeholder="0,00"
                        aria-label={`Limite de ${c.name}`}
                        style={budgetInpStyle}
                      />
                      {budget>0&&(
                        <button onClick={()=>onSaveBudgets({...budgets,[c.id]:0})}
                          style={{background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:"var(--fs-lg)",padding:"0 4px",minWidth:36,minHeight:36,lineHeight:1,flexShrink:0}}
                          title="Remover limite" aria-label={`Remover limite de ${c.name}`}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show more / less */}
            {budgetList.length>6&&(
              <button onClick={()=>setShowAllBudget(p=>!p)} aria-expanded={showAllBudget}
                style={{width:"100%",marginTop:10,padding:"8px",background:"none",border:"1px solid var(--border-subtle)",borderRadius:"var(--radius-sm)",color:"var(--text-3)",fontSize:"var(--fs-sm)",cursor:"pointer",fontFamily:"inherit"}}>
                {showAllBudget?`▲ Mostrar menos`:`▼ Ver mais ${budgetList.length-6} categorias`}
              </button>
            )}

            {/* Add budget hint when no budgets set */}
            {Object.keys(budgets).filter(k=>budgets[k]>0).length===0&&(
              <div style={{marginTop:8,fontSize:"var(--fs-sm)",color:"var(--text-3)",textAlign:"center",lineHeight:1.5}}>
                💡 Defina limites de orçamento para cada categoria e receba alertas quando ultrapassar
              </div>
            )}
          </div>
        )}

        {/* Envelope planning */}
        {(goals.monthly>0||Object.values(budgets).some(v=>v>0))&&(()=>{
          const incomeTarget=goals.monthly||rec||0;
          const totalAllocated=Object.values(budgets).reduce((s,v)=>s+(v||0),0);
          const unallocated=incomeTarget-totalAllocated;
          const allocPct=incomeTarget>0?Math.min(100,(totalAllocated/incomeTarget)*100):0;
          const over=totalAllocated>incomeTarget;
          const catsEnv=categories.filter(c=>budgets[c.id]>0).map(c=>({...c,budget:budgets[c.id],spent:catMap[c.id]||0})).sort((a,b)=>b.budget-a.budget);
          return(
            <div style={{background:"var(--warning-soft)",border:"1px solid var(--warning-border)",borderRadius:14,padding:"14px"}}>
              <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--warning)",marginBottom:12}}>📋 Planejamento do mês</div>
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>Envelopes alocados{incomeTarget>0?` / renda${goals.monthly>0?" meta":""}`:""}</span>
                  <span style={{fontSize:"var(--fs-xs)",fontWeight:700,color:over?"var(--danger)":allocPct>=90?"var(--success)":"var(--warning)"}}>{allocPct.toFixed(0)}%</span>
                </div>
                <div role="progressbar" aria-label="Envelopes alocados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(allocPct)} style={{height:8,background:"var(--track)",borderRadius:4,overflow:"hidden",marginBottom:5}}>
                  <div style={{height:"100%",width:`${allocPct}%`,background:over?"var(--progress-danger)":"var(--progress-warning)",borderRadius:4,transition:"width .6s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:"var(--fs-xs)",color:over?"var(--danger)":"var(--text-2)",fontWeight:600}}>
                    {over?`⚠️ +${fmt(totalAllocated-incomeTarget)} acima da renda`:`${fmt(Math.abs(unallocated))} ${unallocated>=0?"livre":"excedido"}`}
                  </span>
                  {incomeTarget>0&&<span style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>{fmt(totalAllocated)} de {fmt(incomeTarget)}</span>}
                </div>
              </div>
              {catsEnv.length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {catsEnv.map(c=>{
                    const pctSpent=c.budget>0?Math.min(100,(c.spent/c.budget)*100):0;
                    const pctOfIncome=incomeTarget>0?((c.budget/incomeTarget)*100):0;
                    const overCat=c.spent>c.budget;
                    return(
                      <div key={c.id} style={{background:"var(--surface-sunken)",borderRadius:9,padding:"9px 11px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                          <span style={{fontSize:"var(--fs-sm)",color:"var(--text-2)",flex:1}}>{c.name}</span>
                          {incomeTarget>0&&<span style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginRight:4}}>{pctOfIncome.toFixed(0)}% da renda</span>}
                          <span style={{fontSize:"var(--fs-sm)",fontWeight:700,color:overCat?"var(--danger)":c.color}}>{fmt(c.budget)}</span>
                        </div>
                        <div role="progressbar" aria-label={`Gasto em ${c.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctSpent)} style={{height:4,background:"var(--track)",borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pctSpent}%`,background:overCat?"var(--danger)":pctSpent>80?"var(--warning)":c.color,borderRadius:2,transition:"width .5s"}}/>
                        </div>
                        <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginTop:3,textAlign:"right"}}>gasto {fmt(c.spent)} · {pctSpent.toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {catsEnv.length===0&&(
                <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",textAlign:"center",padding:"4px 0",lineHeight:1.6}}>
                  Defina orçamentos por categoria para usar o método envelope
                </div>
              )}
            </div>
          );
        })()}

        {/* Empty state */}
        {rec===0&&dep===0&&(
          <div style={{textAlign:"center",padding:"24px 0",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14}}>
            <div style={{fontSize:36,marginBottom:8}}>📊</div>
            <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-2)",marginBottom:4}}>Sem dados este mês</div>
            <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",lineHeight:1.5}}>Adicione receitas e despesas na aba Contas para ver sua saúde financeira aqui.</div>
          </div>
        )}
      </div>
    </div>
  );
}
