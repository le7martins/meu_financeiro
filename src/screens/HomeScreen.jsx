import { useState, useMemo } from 'react';
import S, { tint } from '../styles.js';
import { fmt, fmtDate, MNAMES, addM, eVal } from '../utils.js';
import { getMonthEntries } from '../logic.js';
import GradCard from '../components/GradCard.jsx';
import EntryCard from '../components/EntryCard.jsx';

// Estado de UI da aba Contas. Fica no App (via hook) para os filtros
// sobreviverem à troca de abas.
export function useHomeUi() {
  const [filter,       setFilter]       = useState("all");
  const [sortBy,       setSortBy]       = useState("date");
  const [search,       setSearch]       = useState("");
  const [groupBy,      setGroupBy]      = useState(false);
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterTag,    setFilterTag]    = useState("all");
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showOverdue,  setShowOverdue]  = useState(false); // vencidos ocultos por padrão
  return { filter, setFilter, sortBy, setSortBy, search, setSearch, groupBy, setGroupBy, filterCat, setFilterCat,
    filterTag, setFilterTag, showUpcoming, setShowUpcoming, showOverdue, setShowOverdue };
}

const normStr = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""); // remove acentos (marcas combinantes)
const sumBy = (list, type) => list.filter(e => e.type === type).reduce((s, e) => s + eVal(e), 0);

// Aba "Contas": navegação de mês, resumo, vencimentos, filtros e lista.
export default function HomeScreen({ data, stats, today, selMonth, setSelMonth, ui, accountBalances, onOpenForm, onToggle, onClone, onEdit, onDelete }) {
  const { entries, dividas, cards, cardPurchases, cardFaturas, categories, budgets, accounts } = data;
  const { monthEntries, totRec, totDesp, totPend, totPago, saldo, accumSaldo, accumSaldoCapped, overdueDue, upcomingDue } = stats;
  const { filter, setFilter, sortBy, setSortBy, search, setSearch, groupBy, setGroupBy, filterCat, setFilterCat,
    filterTag, setFilterTag, showUpcoming, setShowUpcoming, showOverdue, setShowOverdue } = ui;
  const NOW = today.substring(0, 7);

  const getCat   = (id) => categories.find(c => c.id === id) || { color: "var(--text-4)", name: id };
  const catColor = (id) => getCat(id).color;
  const catName  = (id) => getCat(id).name;

  // Comparação com mês anterior
  const prevSaldo = useMemo(() => {
    const me = getMonthEntries(entries, dividas, addM(selMonth, -1), cards, cardPurchases, cardFaturas, today);
    return sumBy(me, "receita") - sumBy(me, "despesa");
  }, [entries, dividas, selMonth, cards, cardPurchases, cardFaturas, today]);
  const saldoDiff = saldo - prevSaldo;

  // Mini-sparkline: saldo dos últimos 6 meses
  const heroSparkData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const me = getMonthEntries(entries, dividas, addM(selMonth, -(5 - i)), cards, cardPurchases, cardFaturas, today);
    return sumBy(me, "receita") - sumBy(me, "despesa");
  }), [entries, dividas, selMonth, cards, cardPurchases, cardFaturas, today]);

  const catTotals = useMemo(() => {
    const map = {};
    monthEntries.filter(e => e.type === "despesa").forEach(e => { map[e.category] = (map[e.category] || 0) + eVal(e); });
    return map;
  }, [monthEntries]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? monthEntries
      : filter === "despesa" || filter === "receita" ? monthEntries.filter(e => e.type === filter)
      : monthEntries.filter(e => e.statusForMonth === filter);
    if (filterCat !== "all") list = list.filter(e => e.category === filterCat);
    if (filterTag !== "all") list = list.filter(e => (e.tags || []).includes(filterTag));
    if (search.trim()) {
      const q = normStr(search);
      list = list.filter(e => normStr(e.description).includes(q) || normStr(e.notes || "").includes(q) || (e.tags || []).some(t => normStr(t).includes(q)));
    }
    const pendingFirst = (e) => e.statusForMonth === "a_pagar" ? 0 : 1;
    if (sortBy === "amount") return [...list].sort((a, b) => eVal(b) - eVal(a));
    if (sortBy === "name") return [...list].sort((a, b) => a.description.localeCompare(b.description));
    if (sortBy === "status") return [...list].sort((a, b) => pendingFirst(a) - pendingFirst(b));
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [monthEntries, filter, filterCat, filterTag, search, sortBy]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = {};
    filtered.forEach(e => { if (!map[e.category]) map[e.category] = { items: [], total: 0 }; map[e.category].items.push(e); map[e.category].total += eVal(e); });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered, groupBy]);

  // Tags únicas dos lançamentos do mês
  const allTags = useMemo(() => [...new Set(monthEntries.flatMap(e => e.tags || []))].sort(), [monthEntries]);

  const FILTERS = [
    ["all", "Todos", monthEntries.length],
    ["despesa", "Despesas", monthEntries.filter(e => e.type === "despesa").length],
    ["receita", "Receitas", monthEntries.filter(e => e.type === "receita").length],
    ["a_pagar", "Pendente Pagamento", monthEntries.filter(e => e.statusForMonth === "a_pagar").length],
    ["pago", "Pagos", monthEntries.filter(e => e.statusForMonth === "pago").length],
  ];

  const renderCard = (entry) => (
    <EntryCard key={`${entry.id}-${selMonth}`} entry={entry} selMonth={selMonth} catColor={catColor} catName={catName}
      budgets={budgets} catTotals={catTotals} onToggle={onToggle} onClone={onClone} onEdit={onEdit} onDelete={onDelete}/>
  );

  return (<>
        {/* Month navigator */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px 4px"}}>
          <button type="button" className="arrowBtn" aria-label="Mês anterior" title="Mês anterior" onClick={()=>setSelMonth(p=>addM(p,-1))} style={S.arrowBtn}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div aria-live="polite" style={{textAlign:"center"}}>
            <div className="monthLabel" style={{fontSize:"var(--fs-5xl)",fontWeight:800,color:"var(--text-1)",letterSpacing:"-0.5px"}}>{MNAMES[+selMonth.split("-")[1]-1]}</div>
            <div style={{fontSize:"var(--fs-base)",color:"var(--text-3)",fontWeight:500,marginTop:-1}}>{selMonth.split("-")[0]}</div>
            {selMonth===NOW&&<div style={{fontSize:"var(--fs-2xs)",color:"var(--success)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:1}}>Mês atual</div>}
          </div>
          <button type="button" className="arrowBtn" aria-label="Próximo mês" title="Próximo mês" onClick={()=>setSelMonth(p=>addM(p,1))} style={S.arrowBtn}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Hero saldo */}
        <div style={{padding:"10px 14px 6px"}}>
          <div style={S.heroCard} className="heroCard">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div aria-hidden="true" style={{width:36,height:36,borderRadius:"var(--radius-md)",background:"var(--success-soft)",color:"var(--success)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <span className="heroSubtext" style={{fontSize:"var(--fs-lg)",color:"var(--hero-text-2)",fontWeight:500}}>Saldo do mês</span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10}}>
              <div style={{fontSize:"var(--fs-6xl)",fontWeight:800,letterSpacing:"-0.5px",lineHeight:1,background:saldo>=0?"linear-gradient(135deg,var(--success),var(--emerald))":"linear-gradient(135deg,var(--danger),var(--danger-strong))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{fmt(saldo)}</div>
              {/* Mini-sparkline 6 meses */}
              {(()=>{
                const data=heroSparkData;
                const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
                const W=72,H=28,pts=data.map((v,i)=>{const x=(i/(data.length-1))*W;const y=H-((v-min)/range)*(H-6)-3;return`${x},${y}`;});
                const sparkColor=saldo>=0?"var(--success)":"var(--danger)";
                return(
                  <svg aria-hidden="true" width={W} height={H} style={{opacity:0.7,flexShrink:0,color:sparkColor}}>
                    <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="2.5" fill="currentColor"/>
                  </svg>
                );
              })()}
            </div>
            {/* Comparação mês anterior */}
            {prevSaldo !== 0 && (()=>{
              const pctChange = prevSaldo!==0?((saldoDiff/Math.abs(prevSaldo))*100):0;
              const isUp = saldoDiff>=0;
              const tk = isUp?"success":"danger";
              return(
                <div className="heroCardFooter" style={{marginTop:8,paddingTop:8,borderTop:"1px solid var(--hero-divider)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span className="heroMuted" style={{fontSize:"var(--fs-xs)",color:"var(--hero-text-3)"}}>vs mês anterior</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:"var(--fs-xs)",padding:"2px 6px",borderRadius:5,fontWeight:700,
                      background:`var(--${tk}-soft)`,
                      color:`var(--${tk})`,
                      border:`1px solid var(--${tk}-border)`}}>
                      {isUp?"▲":"▼"} {Math.abs(pctChange).toFixed(0)}%
                    </span>
                    <span style={{fontSize:"var(--fs-sm)",fontWeight:600,color:`var(--${tk})`}}>
                      {isUp?"+":"-"} {fmt(Math.abs(saldoDiff))}
                    </span>
                  </div>
                </div>
              );
            })()}
            {accumSaldo!==null&&<div className="heroCardFooter" style={{marginTop:6,paddingTop:6,borderTop:"1px solid var(--hero-divider)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span className="heroMuted" style={{fontSize:"var(--fs-xs)",color:"var(--hero-text-3)",display:"flex",alignItems:"center",gap:4}}>
                  Saldo acumulado
                  {accumSaldoCapped&&<span title="Calculado apenas nos últimos 36 meses (limite do histórico)" style={{cursor:"help",color:"var(--warning)",fontSize:"var(--fs-2xs)"}}>⚠️ 36m</span>}
                </span>
                <span style={{fontSize:"var(--fs-md)",fontWeight:700,color:(saldo+accumSaldo)>=0?"var(--success)":"var(--danger)"}}>{fmt(saldo+accumSaldo)}</span>
              </div>
              {accumSaldoCapped&&<div style={{fontSize:"var(--fs-2xs)",color:"var(--hero-text-3)",marginTop:3}}>Histórico limitado a 36 meses</div>}
            </div>}
          </div>
        </div>

        {/* Account balance pills */}
        {accounts.length>0&&(
          <div className="hscroll" style={{display:"flex",gap:8,padding:"0 14px 4px",overflowX:"auto"}}>
            {accounts.map(acc=>{
              const bal=accountBalances[acc.id]??acc.initialBalance??0;
              return(
                <div key={acc.id} style={{flexShrink:0,background:"var(--surface)",border:`1px solid ${tint(acc.color,27)}`,borderRadius:"var(--radius-md)",padding:"8px 12px",minWidth:110}}>
                  <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:100}}>{acc.name}</div>
                  <div style={{fontSize:"var(--fs-base)",fontWeight:800,color:bal>=0?acc.color:"var(--danger)",letterSpacing:"-0.3px"}}>{fmt(bal)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4 grad cards */}
        <div className="sumGrid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 14px 10px"}}>
          <GradCard label="Receitas" value={fmt(totRec)} color="var(--success)" bg="var(--success-soft)" empty={totRec===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
            onAdd={()=>{onOpenForm("receita");}}/>
          <GradCard label="Despesas" value={fmt(totDesp)} color="var(--orange)" bg="var(--orange-soft)" empty={totDesp===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>}
            onAdd={()=>{onOpenForm("despesa");}}/>
          <GradCard label="Pago" value={fmt(totPago)} color="var(--accent)" bg="var(--accent-soft)" empty={totPago===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 9"/></svg>}/>
          <GradCard label="A pagar" value={fmt(totPend)} color="var(--warning)" bg="var(--warning-soft)" empty={totPend===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}/>
        </div>
        {/* Payment progress bar */}
        {totDesp>0&&(
          <div style={{padding:"0 14px 8px"}}>
            <div style={{background:"var(--surface)",border:"1px solid var(--border-subtle)",borderRadius:"var(--radius-md)",padding:"9px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:"var(--fs-2xs)",color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Progresso pagamentos</span>
                <span style={{fontSize:"var(--fs-xs)",fontWeight:700,color:totPago>=totDesp?"var(--success)":totPend>0?"var(--warning)":"var(--accent)"}}>
                  {totDesp>0?((totPago/totDesp)*100).toFixed(0):0}% pago
                </span>
              </div>
              <div role="progressbar" aria-label="Progresso de pagamentos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((totPago/totDesp)*100)}
                style={{height:6,background:"var(--track)",borderRadius:3,overflow:"hidden",display:"flex"}}>
                <div style={{height:"100%",width:`${totDesp>0?(totPago/totDesp)*100:0}%`,background:`linear-gradient(90deg,${tint("var(--accent)",53)},var(--accent))`,borderRadius:"3px 0 0 3px",transition:"width .5s"}}/>
                <div style={{height:"100%",width:`${totDesp>0?(totPend/totDesp)*100:0}%`,background:`linear-gradient(90deg,${tint("var(--warning)",40)},${tint("var(--warning)",20)})`,transition:"width .5s"}}/>
              </div>
            </div>
          </div>
        )}


        {/* ── Vencidos ─────────────────────────────────────────── */}
        {overdueDue.length>0&&(
          <div style={{padding:"0 14px 6px"}}>
            <button type="button" onClick={()=>setShowOverdue(p=>!p)} aria-expanded={!!showOverdue} aria-controls="overdueList"
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",minHeight:40,background:"none",border:"none",cursor:"pointer",padding:"0 0 4px",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:"var(--fs-xs)",color:"var(--danger)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}><svg aria-hidden="true" style={{flexShrink:0}} width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg> Contas Vencidas</span>
                <span style={{fontSize:"var(--fs-2xs)",background:"var(--danger)",color:"var(--danger-on)",padding:"2px 7px",borderRadius:4,fontWeight:800}}>{overdueDue.length}</span>
              </div>
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showOverdue?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0,stroke:"var(--danger)"}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showOverdue&&(
              <div id="overdueList" style={{display:"flex",flexDirection:"column",gap:5}}>
                {overdueDue.map((e,i)=>{
                  const delay=Math.abs(e._days);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"var(--danger-soft)",border:"1.5px solid var(--danger-border)",borderRadius:"var(--radius-md)",padding:"9px 11px"}}>
                      <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"var(--fs-md)",color:"var(--text-1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                        <div style={{fontSize:"var(--fs-2xs)",color:"var(--danger)",marginTop:1}}>{fmtDate(e._due)}</div>
                      </div>
                      <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--orange)",flexShrink:0}}>{fmt(eVal(e))}</div>
                      <div style={{fontSize:"var(--fs-2xs)",fontWeight:800,color:"var(--danger)",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:4,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>{delay}d atraso</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Próximos vencimentos ─────────────────────────────── */}
        {upcomingDue.length>0&&(
          <div style={{padding:"0 14px 10px"}}>
            <button type="button" onClick={()=>setShowUpcoming(p=>!p)} aria-expanded={!!showUpcoming} aria-controls="upcomingList"
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",minHeight:40,background:"none",border:"none",cursor:"pointer",padding:"0 0 4px",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:"var(--fs-xs)",color:"var(--warning)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}><svg aria-hidden="true" style={{flexShrink:0}} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Próximos Vencimentos</span>
                <span style={{fontSize:"var(--fs-2xs)",background:"var(--warning)",color:"var(--warning-on)",padding:"2px 7px",borderRadius:4,fontWeight:800}}>{upcomingDue.length}</span>
              </div>
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showUpcoming?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0,stroke:"var(--warning)"}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showUpcoming&&(
              <div id="upcomingList" style={{display:"flex",flexDirection:"column",gap:5}}>
                {upcomingDue.map((e,i)=>{
                  const dayColor=e._days===0?"var(--orange)":e._days<=3?"var(--warning)":"var(--accent)";
                  const dayLabel=e._days===0?"Hoje":`${e._days}d`;
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:e._days===0?"var(--orange-soft)":"var(--surface)",border:`1.5px solid ${tint(dayColor,20)}`,borderRadius:"var(--radius-md)",padding:"9px 11px"}}>
                      <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"var(--fs-md)",color:"var(--text-1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                        <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginTop:1}}>{fmtDate(e._due)}</div>
                      </div>
                      <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:e.type==="receita"?"var(--success)":"var(--orange)",flexShrink:0}}>{e.type==="receita"?"+":""}{fmt(eVal(e))}</div>
                      <div style={{fontSize:"var(--fs-2xs)",fontWeight:700,color:dayColor,background:tint(dayColor,9),border:`1px solid ${tint(dayColor,20)}`,borderRadius:4,padding:"2px 7px",flexShrink:0}}>{dayLabel}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Search + controls — always visible */}
        <div style={{padding:"0 14px 8px",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{position:"relative"}}>
            <svg aria-hidden="true" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text-3)"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{...S.inp,paddingLeft:30,paddingRight:search?80:12,fontSize:"var(--fs-md)"}} aria-label="Buscar lançamentos" placeholder="Buscar por descrição ou observação..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&(
              <div style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:2}}>
                <span aria-label={`${filtered.length} resultados`} style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",background:"var(--surface-2)",borderRadius:4,padding:"1px 5px",fontWeight:600}}>{filtered.length}</span>
                <button type="button" onClick={()=>setSearch("")} aria-label="Limpar busca" style={{background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:"var(--fs-lg)",lineHeight:1,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}><span aria-hidden="true">✕</span></button>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <select aria-label="Filtrar lançamentos" value={filter} onChange={e=>setFilter(e.target.value)} style={{...S.selInput,flex:2}}>
              {FILTERS.map(([val,label,count])=>(
                <option key={val} value={val}>{label} ({count})</option>
              ))}
            </select>
            <select aria-label="Ordenar por" value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...S.selInput,flex:1}}>
              <option value="date">Data</option>
              <option value="amount">Valor</option>
              <option value="status">Status</option>
              <option value="name">Nome</option>
            </select>
            <button type="button" onClick={()=>setGroupBy(p=>!p)} className="fTab" aria-label="Agrupar por categoria" title="Agrupar por categoria" aria-pressed={!!groupBy} style={{...S.fTab,...(groupBy?S.fTabActive:{}),padding:"5px 10px",minWidth:40,minHeight:36,justifyContent:"center",fontSize:"var(--fs-sm)",flexShrink:0}}><span aria-hidden="true">⊞</span></button>
          </div>
          {/* Category filter chips */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[{id:"all",name:"Todas"},...categories.filter(c=>{const used=monthEntries.some(e=>e.category===c.id);return used;})].map(c=>{
              const cc=c.color||"var(--accent)";
              const on=filterCat===c.id;
              return(
              <button type="button" key={c.id} onClick={()=>setFilterCat(c.id)} aria-pressed={on}
                style={{padding:"4px 10px",minHeight:30,borderRadius:"var(--radius-xs)",border:`1px solid ${on?cc:"var(--border-subtle)"}`,background:on?tint(cc,13):"transparent",color:on?cc:"var(--text-3)",fontSize:"var(--fs-xs)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                {c.id!=="all"&&<span aria-hidden="true" style={{width:5,height:5,borderRadius:"var(--radius-full)",background:c.color,display:"inline-block",marginRight:4,verticalAlign:"middle"}}/>}{c.name}
              </button>
            );})}
          </div>
          {/* Tag filter chips — só aparece se houver tags no mês */}
          {allTags.length>0&&(
            <div style={{display:"flex",gap:5,flexWrap:"wrap",paddingTop:2,borderTop:"1px solid var(--border-subtle)"}}>
              <span style={{fontSize:"var(--fs-2xs)",color:"var(--text-4)",alignSelf:"center",marginRight:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Tags:</span>
              {allTags.map(t=>(
                <button type="button" key={t} onClick={()=>setFilterTag(filterTag===t?"all":t)} aria-pressed={filterTag===t}
                  style={{padding:"4px 9px",minHeight:30,borderRadius:5,border:`1px solid ${filterTag===t?"var(--accent)":"var(--border-strong)"}`,background:filterTag===t?"var(--accent-soft)":"transparent",color:filterTag===t?"var(--accent)":"var(--text-3)",fontSize:"var(--fs-xs)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  #{t}
                </button>
              ))}
              {filterTag!=="all"&&<button type="button" onClick={()=>setFilterTag("all")} style={{padding:"4px 8px",minHeight:30,borderRadius:5,border:"none",background:"none",color:"var(--danger)",fontSize:"var(--fs-xs)",cursor:"pointer",fontFamily:"inherit"}}>✕ limpar</button>}
            </div>
          )}
        </div>

        {/* Banner — mês passado */}
        {selMonth<NOW&&(
          <div style={{margin:"4px 14px 8px",padding:"8px 12px",background:"var(--warning-soft)",border:"1px solid var(--warning-border)",borderRadius:"var(--radius-md)",display:"flex",alignItems:"center",gap:8,fontSize:"var(--fs-sm)",color:"var(--warning)"}}>
            <svg aria-hidden="true" style={{flexShrink:0}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Visualizando mês passado — itens "a pagar" estão vencidos</span>
          </div>
        )}

        {/* List */}
        <div style={S.list}>
          {filtered.length===0&&(
            <div style={S.empty}>
              {search||filterCat!=="all"||filter!=="all"?(
                <>
                  <div aria-hidden="true" style={{fontSize:36,opacity:0.3,marginBottom:8}}>🔍</div>
                  <div style={{color:"var(--text-4)",fontSize:"var(--fs-lg)",fontWeight:600}}>{search?"Nenhum resultado para busca":filterCat!=="all"?"Sem lançamentos nesta categoria":"Nenhum lançamento neste filtro"}</div>
                  <div style={{color:"var(--text-4)",fontSize:"var(--fs-md)",marginTop:3}}>{search?"Tente outro termo":filterCat!=="all"?"Mude o filtro de categoria":"Remova o filtro para ver todos"}</div>
                </>
              ):(
                /* Estado de tela vazia — primeiro uso / mês sem dados */
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"8px 0"}}>
                  <div aria-hidden="true" style={{width:72,height:72,borderRadius:"var(--radius-2xl)",background:"var(--accent-soft)",border:"1px solid var(--accent-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:4}}>💸</div>
                  <div style={{color:"var(--text-1)",fontSize:"var(--fs-xl)",fontWeight:700}}>Nenhum lançamento</div>
                  <div style={{color:"var(--text-3)",fontSize:"var(--fs-md)",textAlign:"center",lineHeight:1.5,maxWidth:220}}>Adicione receitas e despesas para visualizar seu saldo e relatórios.</div>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <button type="button" onClick={()=>{onOpenForm("receita");}}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"10px 14px",minHeight:40,background:"var(--success-soft)",border:"1px solid var(--success-border)",borderRadius:"var(--radius-md)",color:"var(--success)",fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      <span aria-hidden="true">📈</span> Receita
                    </button>
                    <button type="button" onClick={()=>{onOpenForm("despesa");}}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"10px 14px",minHeight:40,background:"var(--orange-soft)",border:"1px solid var(--orange-border)",borderRadius:"var(--radius-md)",color:"var(--orange)",fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      <span aria-hidden="true">📉</span> Despesa
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {grouped
            ?grouped.map(([catId,{items,total}])=>{
              const budget=budgets[catId];
              const budgetPct=budget>0?Math.min(100,(total/budget)*100):null;
              return(
              <div key={catId} style={{marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0 5px",borderBottom:"1px solid var(--border-subtle)",marginBottom:6}}>
                  <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:catColor(catId)}}/>
                  <div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:catColor(catId),textTransform:"uppercase",letterSpacing:"0.06em",flex:1}}>{catName(catId)}</div>
                  <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--accent)"}}>{fmt(total)}{budget>0&&<span style={{fontSize:"var(--fs-2xs)",color:budgetPct>100?"var(--danger)":"var(--text-3)",marginLeft:4}}>/ {fmt(budget)}</span>}</div>
                </div>
                {budget>0&&<div style={{height:3,background:"var(--track)",borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${budgetPct}%`,background:budgetPct>100?"var(--danger)":budgetPct>80?"var(--warning)":catColor(catId),borderRadius:2,transition:"width .5s"}}/></div>}
                {items.map(renderCard)}
              </div>
            )})
            :filtered.map(renderCard)
          }
        </div>
  </>);
}
