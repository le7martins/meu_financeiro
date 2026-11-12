import { useState, useMemo } from 'react';
import S, { tint } from '../styles.js';
import { fmt, fmtDate, MNAMES, mLabel, addM, eVal } from '../utils.js';
import { getMonthEntries } from '../logic.js';
import EntryCard from '../components/EntryCard.jsx';
import FiltersSheet from '../components/FiltersSheet.jsx';

// Estado de UI da aba Contas. Fica no App (via hook) para os filtros
// sobreviverem à troca de abas.
export function useHomeUi() {
  const [filter,       setFilter]       = useState("all");
  const [sortBy,       setSortBy]       = useState("date");
  const [groupBy,      setGroupBy]      = useState(false);
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterTag,    setFilterTag]    = useState("all");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showOverdue,  setShowOverdue]  = useState(false); // listas de vencimento recolhidas por padrão
  return { filter, setFilter, sortBy, setSortBy, groupBy, setGroupBy, filterCat, setFilterCat,
    filterTag, setFilterTag, showUpcoming, setShowUpcoming, showOverdue, setShowOverdue };
}

const SR_ONLY = {position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)",whiteSpace:"nowrap"};
const sumBy = (list, type) => list.filter(e => e.type === type).reduce((s, e) => s + eVal(e), 0);

// Aba "Contas": navegação de mês, resumo, vencimentos, filtros e lista.
export default function HomeScreen({ data, stats, today, selMonth, setSelMonth, ui, accountBalances, onOpenForm, onToggle, onClone, onEdit, onDelete }) {
  const { entries, dividas, cards, cardPurchases, cardFaturas, categories, budgets, accounts } = data;
  const { monthEntries, totRec, totDesp, totPend, totPago, saldo, accumSaldo, accumSaldoCapped, overdueDue, upcomingDue } = stats;
  const { filter, setFilter, sortBy, setSortBy, groupBy, setGroupBy, filterCat, setFilterCat,
    filterTag, setFilterTag, showUpcoming, setShowUpcoming, showOverdue, setShowOverdue } = ui;
  const NOW = today.substring(0, 7);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    const pendingFirst = (e) => e.statusForMonth === "a_pagar" ? 0 : 1;
    if (sortBy === "amount") return [...list].sort((a, b) => eVal(b) - eVal(a));
    if (sortBy === "name") return [...list].sort((a, b) => a.description.localeCompare(b.description));
    if (sortBy === "status") return [...list].sort((a, b) => pendingFirst(a) - pendingFirst(b));
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [monthEntries, filter, filterCat, filterTag, sortBy]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = {};
    filtered.forEach(e => { if (!map[e.category]) map[e.category] = { items: [], total: 0 }; map[e.category].items.push(e); if (e.type === "despesa") map[e.category].total += eVal(e); });
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

  const SORT_LABEL = { date: "Data", amount: "Valor", status: "Status", name: "Nome" };
  const typeFilter = filter === "despesa" || filter === "receita" ? filter : null;
  const usedCategories = categories.filter(c => monthEntries.some(e => e.category === c.id && (!typeFilter || e.type === typeFilter)));
  const activeChips = [
    filter !== "all" && { key: "status", label: FILTERS.find(f => f[0] === filter)?.[1] || filter, clear: () => setFilter("all") },
    filterCat !== "all" && { key: "cat", label: catName(filterCat), clear: () => setFilterCat("all") },
    filterTag !== "all" && { key: "tag", label: `#${filterTag}`, clear: () => setFilterTag("all") },
    sortBy !== "date" && { key: "sort", label: `Ordem: ${SORT_LABEL[sortBy]}`, clear: () => setSortBy("date") },
    groupBy && { key: "group", label: "Agrupado", clear: () => setGroupBy(false) },
  ].filter(Boolean);
  const clearFilters = () => { setFilter("all"); setFilterCat("all"); setFilterTag("all"); setSortBy("date"); setGroupBy(false); };

  const filtersButton = (
    <button type="button" onClick={()=>setFiltersOpen(true)} aria-haspopup="dialog"
      aria-label={activeChips.length>0?`Filtros, ${activeChips.length} ativo${activeChips.length>1?"s":""}`:"Filtros"}
      style={{position:"relative",flexShrink:0,marginLeft:"auto",width:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"var(--radius-md)",cursor:"pointer",fontFamily:"inherit",
        background:activeChips.length>0?"var(--accent-surface)":"var(--surface)",border:`1px solid ${activeChips.length>0?"var(--accent)":"var(--border)"}`,color:activeChips.length>0?"var(--accent)":"var(--text-2)"}}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
      {activeChips.length>0&&<span aria-hidden="true" style={{position:"absolute",top:-5,right:-5,minWidth:18,height:18,padding:"0 4px",borderRadius:"var(--radius-full)",background:"var(--accent)",color:"var(--success-on)",fontSize:"var(--fs-xs)",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{activeChips.length}</span>}
    </button>
  );

  const dueToggle = (token, label, open, onClick, controls) => (
    <button type="button" onClick={onClick} aria-expanded={!!open} aria-controls={controls}
      style={{flex:1,minWidth:0,display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,minHeight:44,padding:"0 12px",borderRadius:"var(--radius-md)",border:`1px solid var(--${token}-border)`,background:`var(--${token}-soft)`,color:`var(--${token})`,fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
      <span>{label}</span>
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  );

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
        <div style={{padding:"8px 14px 6px"}}>
          <div style={{...S.heroCard,padding:"12px 16px"}} className="heroCard">
            <div className="heroSubtext" style={{fontSize:"var(--fs-md)",color:"var(--hero-text-2)",fontWeight:500,marginBottom:4}}>Saldo do mês</div>
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
            {/* Rodapé em duas colunas: comparação com o mês anterior | saldo acumulado */}
            {(prevSaldo!==0||accumSaldo!==null)&&(
              <div className="heroCardFooter" style={{marginTop:8,paddingTop:8,borderTop:"1px solid var(--hero-divider)",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"6px 12px",flexWrap:"wrap"}}>
                {prevSaldo!==0&&(()=>{
                  const pctChange=(saldoDiff/Math.abs(prevSaldo))*100;
                  const isUp=saldoDiff>=0;
                  const tk=isUp?"success":"danger";
                  return(
                    <div>
                      <div className="heroMuted" style={{fontSize:"var(--fs-sm)",color:"var(--hero-text-3)",marginBottom:2}}>vs mês anterior</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:"var(--fs-sm)",padding:"1px 6px",borderRadius:5,fontWeight:700,background:`var(--${tk}-soft)`,color:`var(--${tk})`,border:`1px solid var(--${tk}-border)`}}>{isUp?"▲":"▼"} {Math.abs(pctChange).toFixed(0)}%</span>
                        <span style={{fontSize:"var(--fs-sm)",fontWeight:600,color:`var(--${tk})`}}>{isUp?"+":"-"} {fmt(Math.abs(saldoDiff))}</span>
                      </div>
                    </div>
                  );
                })()}
                {accumSaldo!==null&&(
                  <div style={{textAlign:"right",marginLeft:"auto"}}>
                    <div className="heroMuted" style={{fontSize:"var(--fs-sm)",color:"var(--hero-text-3)",marginBottom:2}}>
                      Acumulado até {mLabel(selMonth)}{accumSaldoCapped&&<span title="Calculado apenas nos últimos 36 meses (limite do histórico)" style={{marginLeft:4,color:"var(--warning)"}}>⚠ 36m</span>}
                    </div>
                    <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:(saldo+accumSaldo)>=0?"var(--success)":"var(--danger)"}}>{fmt(saldo+accumSaldo)}</div>
                  </div>
                )}
              </div>
            )}
            {accumSaldo!==null&&accumSaldoCapped&&<div style={{fontSize:"var(--fs-sm)",color:"var(--hero-text-3)",marginTop:4}}>Histórico limitado a 36 meses</div>}
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

        {/* Resumo do mês: um card só (2×2) com a barra de progresso embaixo */}
        <div style={{padding:"0 14px 8px"}}>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"10px 12px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"8px 18px"}}>
              {[["Receitas",totRec,"success"],["Despesas",totDesp,"orange"],["Pago",totPago,"accent"],["A pagar",totPend,"warning"]].map(([label,val,tk])=>(
                <div key={label} style={{display:"flex",flexWrap:"wrap",alignItems:"baseline",justifyContent:"space-between",columnGap:6,minWidth:0}}>
                  <span style={{display:"flex",alignItems:"center",gap:5,fontSize:"var(--fs-sm)",fontWeight:700,color:`var(--${tk})`,textTransform:"uppercase",letterSpacing:"0.05em",flexShrink:0}}>
                    <span aria-hidden="true" style={{width:6,height:6,borderRadius:"var(--radius-full)",background:`var(--${tk})`}}/>{label}
                  </span>
                  <span style={{fontSize:"var(--fs-base)",fontWeight:800,color:val===0?"var(--text-4)":"var(--text-1)",letterSpacing:"-0.2px",whiteSpace:"nowrap",marginLeft:"auto"}}>{val===0?"—":fmt(val)}</span>
                </div>
              ))}
            </div>
            {totDesp>0&&(
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:9}}>
                <div role="progressbar" aria-label="Progresso de pagamentos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((totPago/totDesp)*100)}
                  style={{flex:1,height:4,background:"var(--track)",borderRadius:2,overflow:"hidden",display:"flex"}}>
                  <div style={{height:"100%",width:`${(totPago/totDesp)*100}%`,background:`linear-gradient(90deg,${tint("var(--accent)",53)},var(--accent))`,transition:"width .5s"}}/>
                  <div style={{height:"100%",width:`${(totPend/totDesp)*100}%`,background:`linear-gradient(90deg,${tint("var(--warning)",40)},${tint("var(--warning)",20)})`,transition:"width .5s"}}/>
                </div>
                <span style={{fontSize:"var(--fs-sm)",fontWeight:700,flexShrink:0,color:totPago>=totDesp?"var(--success)":totPend>0?"var(--warning)":"var(--accent)"}}>{((totPago/totDesp)*100).toFixed(0)}% pago</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Vencidas / próximos + filtros: uma linha; toque abre a lista ── */}
        <div style={{padding:"0 14px 8px"}}>
            <div style={{display:"flex",gap:8,alignItems:"stretch"}}>
              {overdueDue.length>0&&dueToggle("danger",`${overdueDue.length} ${overdueDue.length===1?"vencida":"vencidas"}`,showOverdue,()=>setShowOverdue(p=>!p),"overdueList")}
              {upcomingDue.length>0&&dueToggle("warning",`${upcomingDue.length} ${upcomingDue.length===1?"próximo":"próximos"}`,showUpcoming,()=>setShowUpcoming(p=>!p),"upcomingList")}
              {filtersButton}
            </div>
            {activeChips.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                {activeChips.map(c=>(
                  <button type="button" key={c.key} onClick={c.clear} aria-label={`Remover filtro ${c.label}`}
                    style={{minHeight:36,padding:"0 10px",borderRadius:"var(--radius-xs)",border:"1px solid var(--accent-border)",background:"var(--accent-surface)",color:"var(--accent)",fontSize:"var(--fs-sm)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {c.label} <span aria-hidden="true">✕</span>
                  </button>
                ))}
              </div>
            )}
            {showOverdue&&overdueDue.length>0&&(
              <div id="overdueList" style={{display:"flex",flexDirection:"column",gap:5,marginTop:6}}>
                {overdueDue.map((e,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",padding:"9px 11px"}}>
                    <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"var(--fs-md)",color:"var(--text-1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                      <div style={{fontSize:"var(--fs-sm)",color:"var(--danger)",marginTop:1}}>{fmtDate(e._due)} · {Math.abs(e._days)}d de atraso</div>
                    </div>
                    <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--text-1)",flexShrink:0}}>{fmt(eVal(e))}</div>
                  </div>
                ))}
              </div>
            )}
            {showUpcoming&&upcomingDue.length>0&&(
              <div id="upcomingList" style={{display:"flex",flexDirection:"column",gap:5,marginTop:6}}>
                {upcomingDue.map((e,i)=>{
                  const soon=e._days<=7;
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"var(--surface)",border:`1px solid ${soon?"var(--orange-border)":"var(--border)"}`,borderRadius:"var(--radius-md)",padding:"9px 11px"}}>
                      <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"var(--fs-md)",color:"var(--text-1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                        <div style={{fontSize:"var(--fs-sm)",color:soon?"var(--orange)":"var(--text-3)",fontWeight:soon?700:500,marginTop:1}}>{fmtDate(e._due)} · {e._days===0?"hoje":e._days===1?"amanhã":`em ${e._days} dias`}</div>
                      </div>
                      <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:e.type==="receita"?"var(--success)":"var(--text-1)",flexShrink:0}}>{e.type==="receita"?"+":""}{fmt(eVal(e))}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        {filtersOpen&&<FiltersSheet statusOptions={FILTERS} filter={filter} setFilter={setFilter} sortBy={sortBy} setSortBy={setSortBy} groupBy={groupBy} setGroupBy={setGroupBy}
          categories={usedCategories} filterCat={filterCat} setFilterCat={setFilterCat} allTags={allTags} filterTag={filterTag} setFilterTag={setFilterTag}
          resultCount={filtered.length} canClear={activeChips.length>0} onClear={clearFilters} onClose={()=>setFiltersOpen(false)}/>}
        <div role="status" aria-live="polite" style={SR_ONLY}>{filtered.length} {filtered.length===1?"lançamento":"lançamentos"}</div>

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
              {filterCat!=="all"||filter!=="all"||filterTag!=="all"?(
                <>
                  <div aria-hidden="true" style={{fontSize:36,opacity:0.3,marginBottom:8}}>🔍</div>
                  <div style={{color:"var(--text-4)",fontSize:"var(--fs-lg)",fontWeight:600}}>{filterCat!=="all"?"Sem lançamentos nesta categoria":"Nenhum lançamento neste filtro"}</div>
                  <div style={{color:"var(--text-4)",fontSize:"var(--fs-md)",marginTop:3}}>{filterCat!=="all"?"Mude o filtro de categoria":"Remova o filtro para ver todos"}</div>
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
              const budgetRaw=budget>0?(total/budget)*100:null;
              const budgetPct=budgetRaw===null?null:Math.min(100,budgetRaw);
              return(
              <div key={catId} style={{marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0 5px",borderBottom:"1px solid var(--border-subtle)",marginBottom:6}}>
                  <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:catColor(catId)}}/>
                  <div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:catColor(catId),textTransform:"uppercase",letterSpacing:"0.06em",flex:1}}>{catName(catId)}</div>
                  <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--accent)"}}>{fmt(total)}{budget>0&&<span style={{fontSize:"var(--fs-2xs)",color:budgetRaw>100?"var(--danger)":"var(--text-3)",marginLeft:4}}>/ {fmt(budget)}</span>}</div>
                </div>
                {budget>0&&<div style={{height:3,background:"var(--track)",borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${budgetPct}%`,background:budgetRaw>100?"var(--danger)":budgetPct>80?"var(--warning)":catColor(catId),borderRadius:2,transition:"width .5s"}}/></div>}
                {items.map(renderCard)}
              </div>
            )})
            :filtered.map(renderCard)
          }
        </div>
  </>);
}
