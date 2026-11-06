import { useState, useMemo } from 'react';
import S from '../styles.js';
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

  const getCat   = (id) => categories.find(c => c.id === id) || { color: "#9E9E9E", name: id };
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
          <button className="arrowBtn" onClick={()=>setSelMonth(p=>addM(p,-1))} style={S.arrowBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{textAlign:"center"}}>
            <div className="monthLabel" style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{MNAMES[+selMonth.split("-")[1]-1]}</div>
            <div style={{fontSize:13,color:"var(--text3)",fontWeight:500,marginTop:-1}}>{selMonth.split("-")[0]}</div>
            {selMonth===NOW&&<div style={{fontSize:9,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:1}}>Mês atual</div>}
          </div>
          <button className="arrowBtn" onClick={()=>setSelMonth(p=>addM(p,1))} style={S.arrowBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Hero saldo */}
        <div style={{padding:"10px 14px 6px"}}>
          <div style={S.heroCard} className="heroCard">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:10,background:"rgba(74,222,128,.18)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <span className="heroSubtext" style={{fontSize:14,color:"rgba(255,255,255,.6)",fontWeight:500}}>Saldo do mês</span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10}}>
              <div style={{fontSize:28,fontWeight:800,letterSpacing:"-0.5px",lineHeight:1,background:saldo>=0?"linear-gradient(135deg,#4ade80,#34d399)":"linear-gradient(135deg,#f87171,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{fmt(saldo)}</div>
              {/* Mini-sparkline 6 meses */}
              {(()=>{
                const data=heroSparkData;
                const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
                const W=72,H=28,pts=data.map((v,i)=>{const x=(i/(data.length-1))*W;const y=H-((v-min)/range)*(H-6)-3;return`${x},${y}`;});
                const sparkColor=saldo>=0?"#4ade80":"#f87171";
                return(
                  <svg width={W} height={H} style={{opacity:0.7,flexShrink:0}}>
                    <polyline points={pts.join(' ')} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="2.5" fill={sparkColor}/>
                  </svg>
                );
              })()}
            </div>
            {/* Comparação mês anterior */}
            {prevSaldo !== 0 && (()=>{
              const pctChange = prevSaldo!==0?((saldoDiff/Math.abs(prevSaldo))*100):0;
              const isUp = saldoDiff>=0;
              return(
                <div className="heroCardFooter" style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span className="heroMuted" style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>vs mês anterior</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,padding:"2px 6px",borderRadius:5,fontWeight:700,
                      background:isUp?"rgba(74,222,128,.15)":"rgba(248,113,113,.15)",
                      color:isUp?"#4ade80":"#f87171",
                      border:`1px solid ${isUp?"#4ade8033":"#f8717133"}`}}>
                      {isUp?"▲":"▼"} {Math.abs(pctChange).toFixed(0)}%
                    </span>
                    <span style={{fontSize:11,fontWeight:600,color:isUp?"#4ade8088":"#f8717188"}}>
                      {isUp?"+":"-"} {fmt(Math.abs(saldoDiff))}
                    </span>
                  </div>
                </div>
              );
            })()}
            {accumSaldo!==null&&<div className="heroCardFooter" style={{marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span className="heroMuted" style={{fontSize:10,color:"rgba(255,255,255,.35)",display:"flex",alignItems:"center",gap:4}}>
                  Saldo acumulado
                  {accumSaldoCapped&&<span title="Calculado apenas nos últimos 36 meses (limite do histórico)" style={{cursor:"help",opacity:.6,color:"#facc15",fontSize:9}}>⚠️ 36m</span>}
                </span>
                <span style={{fontSize:12,fontWeight:700,color:(saldo+accumSaldo)>=0?"#4ade80":"#f87171"}}>{fmt(saldo+accumSaldo)}</span>
              </div>
              {accumSaldoCapped&&<div style={{fontSize:9,color:"rgba(255,255,255,.25)",marginTop:3}}>Histórico limitado a 36 meses</div>}
            </div>}
          </div>
        </div>

        {/* Account balance pills */}
        {accounts.length>0&&(
          <div className="hscroll" style={{display:"flex",gap:8,padding:"0 14px 4px",overflowX:"auto"}}>
            {accounts.map(acc=>{
              const bal=accountBalances[acc.id]??acc.initialBalance??0;
              return(
                <div key={acc.id} style={{flexShrink:0,background:"var(--card-bg)",border:`1px solid ${acc.color}44`,borderRadius:10,padding:"8px 12px",minWidth:110}}>
                  <div style={{fontSize:9,color:"var(--text4)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:100}}>{acc.name}</div>
                  <div style={{fontSize:13,fontWeight:800,color:bal>=0?acc.color:"#f87171",letterSpacing:"-0.3px"}}>{fmt(bal)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4 grad cards */}
        <div className="sumGrid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 14px 10px"}}>
          <GradCard label="Receitas" value={fmt(totRec)} color="#4ade80" bg="rgba(74,222,128,.08)" empty={totRec===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
            onAdd={()=>{onOpenForm("receita");}}/>
          <GradCard label="Despesas" value={fmt(totDesp)} color="#fb923c" bg="rgba(251,146,60,.08)" empty={totDesp===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>}
            onAdd={()=>{onOpenForm("despesa");}}/>
          <GradCard label="Pago" value={fmt(totPago)} color="#8ab4f8" bg="rgba(138,180,248,.08)" empty={totPago===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 9"/></svg>}/>
          <GradCard label="A pagar" value={fmt(totPend)} color="#facc15" bg="rgba(250,204,21,.08)" empty={totPend===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}/>
        </div>
        {/* Payment progress bar */}
        {totDesp>0&&(
          <div style={{padding:"0 14px 8px"}}>
            <div style={{background:"var(--card-bg)",border:"1px solid var(--border2)",borderRadius:10,padding:"9px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:9,color:"var(--text4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Progresso pagamentos</span>
                <span style={{fontSize:10,fontWeight:700,color:totPago>=totDesp?"#4ade80":totPend>0?"#facc15":"#8ab4f8"}}>
                  {totDesp>0?((totPago/totDesp)*100).toFixed(0):0}% pago
                </span>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden",display:"flex"}}>
                <div style={{height:"100%",width:`${totDesp>0?(totPago/totDesp)*100:0}%`,background:"linear-gradient(90deg,#8ab4f888,#8ab4f8)",borderRadius:"3px 0 0 3px",transition:"width .5s"}}/>
                <div style={{height:"100%",width:`${totDesp>0?(totPend/totDesp)*100:0}%`,background:"linear-gradient(90deg,#facc1566,#facc1533)",transition:"width .5s"}}/>
              </div>
            </div>
          </div>
        )}


        {/* ── Vencidos ─────────────────────────────────────────── */}
        {overdueDue.length>0&&(
          <div style={{padding:"0 14px 6px"}}>
            <button onClick={()=>setShowOverdue(p=>!p)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"0 0 8px",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:10,color:"#f87171",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}><svg style={{flexShrink:0}} width="10" height="10" viewBox="0 0 24 24" fill="#f87171"><circle cx="12" cy="12" r="10"/></svg> Contas Vencidas</span>
                <span style={{fontSize:9,background:"#f87171",color:"#fff",padding:"2px 7px",borderRadius:4,fontWeight:800}}>{overdueDue.length}</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showOverdue?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showOverdue&&(
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {overdueDue.map((e,i)=>{
                  const delay=Math.abs(e._days);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(248,113,113,.06)",border:"1.5px solid #f8717133",borderRadius:10,padding:"9px 11px"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"var(--text1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                        <div style={{fontSize:9,color:"#f8717188",marginTop:1}}>{fmtDate(e._due)}</div>
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:"#fb923c",flexShrink:0}}>{fmt(eVal(e))}</div>
                      <div style={{fontSize:9,fontWeight:800,color:"#f87171",background:"rgba(248,113,113,.15)",border:"1px solid #f8717133",borderRadius:4,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>{delay}d atraso</div>
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
            <button onClick={()=>setShowUpcoming(p=>!p)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"0 0 8px",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:10,color:"#facc15",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}><svg style={{flexShrink:0}} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Próximos Vencimentos</span>
                <span style={{fontSize:9,background:"#facc15",color:"#0d1118",padding:"2px 7px",borderRadius:4,fontWeight:800}}>{upcomingDue.length}</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showUpcoming?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showUpcoming&&(
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {upcomingDue.map((e,i)=>{
                  const dayColor=e._days===0?"#fb923c":e._days<=3?"#facc15":"#8ab4f8";
                  const dayLabel=e._days===0?"Hoje":`${e._days}d`;
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:e._days===0?"rgba(251,146,60,.07)":"var(--card-bg)",border:`1.5px solid ${dayColor}33`,borderRadius:10,padding:"9px 11px"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"var(--text1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                        <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{fmtDate(e._due)}</div>
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":"#fb923c",flexShrink:0}}>{e.type==="receita"?"+":""}{fmt(eVal(e))}</div>
                      <div style={{fontSize:9,fontWeight:700,color:dayColor,background:dayColor+"18",border:`1px solid ${dayColor}33`,borderRadius:4,padding:"2px 7px",flexShrink:0}}>{dayLabel}</div>
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
            <svg style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{...S.inp,paddingLeft:30,paddingRight:search?80:12,fontSize:12}} placeholder="Buscar por descrição ou observação..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&(
              <div style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:10,color:"var(--text3)",background:"var(--card-bg2)",borderRadius:4,padding:"1px 5px",fontWeight:600}}>{filtered.length}</span>
                <button onClick={()=>setSearch("")} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...S.selInput,flex:2}}>
              {FILTERS.map(([val,label,count])=>(
                <option key={val} value={val}>{label} ({count})</option>
              ))}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...S.selInput,flex:1}}>
              <option value="date">Data</option>
              <option value="amount">Valor</option>
              <option value="status">Status</option>
              <option value="name">Nome</option>
            </select>
            <button onClick={()=>setGroupBy(p=>!p)} className="fTab" style={{...S.fTab,...(groupBy?S.fTabActive:{}),padding:"5px 10px",fontSize:11,flexShrink:0}}>⊞</button>
          </div>
          {/* Category filter chips */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[{id:"all",name:"Todas"},...categories.filter(c=>{const used=monthEntries.some(e=>e.category===c.id);return used;})].map(c=>(
              <button key={c.id} onClick={()=>setFilterCat(c.id)}
                style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${filterCat===c.id?(c.color||"#8ab4f8"):"#111820"}`,background:filterCat===c.id?(c.color||"#8ab4f8")+"22":"transparent",color:filterCat===c.id?(c.color||"#8ab4f8"):"var(--text3)",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                {c.id!=="all"&&<span style={{width:5,height:5,borderRadius:"50%",background:c.color,display:"inline-block",marginRight:4,verticalAlign:"middle"}}/>}{c.name}
              </button>
            ))}
          </div>
          {/* Tag filter chips — só aparece se houver tags no mês */}
          {allTags.length>0&&(
            <div style={{display:"flex",gap:5,flexWrap:"wrap",paddingTop:2,borderTop:"1px solid var(--border2)"}}>
              <span style={{fontSize:9,color:"var(--text4)",alignSelf:"center",marginRight:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Tags:</span>
              {allTags.map(t=>(
                <button key={t} onClick={()=>setFilterTag(filterTag===t?"all":t)}
                  style={{padding:"2px 8px",borderRadius:5,border:`1px solid ${filterTag===t?"#8ab4f8":"#1a2840"}`,background:filterTag===t?"rgba(138,180,248,.18)":"transparent",color:filterTag===t?"#8ab4f8":"var(--text3)",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                  #{t}
                </button>
              ))}
              {filterTag!=="all"&&<button onClick={()=>setFilterTag("all")} style={{padding:"2px 6px",borderRadius:5,border:"none",background:"none",color:"#f87171",fontSize:10,cursor:"pointer"}}>✕ limpar</button>}
            </div>
          )}
        </div>

        {/* Banner — mês passado */}
        {selMonth<NOW&&(
          <div style={{margin:"4px 0 8px",padding:"8px 12px",background:"rgba(250,204,21,.07)",border:"1px solid rgba(250,204,21,.18)",borderRadius:10,display:"flex",alignItems:"center",gap:8,fontSize:11,color:"#facc15"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Visualizando mês passado — itens "a pagar" estão vencidos</span>
          </div>
        )}

        {/* List */}
        <div style={S.list}>
          {filtered.length===0&&(
            <div style={S.empty}>
              {search||filterCat!=="all"||filter!=="all"?(
                <>
                  <div style={{fontSize:36,opacity:0.3,marginBottom:8}}>🔍</div>
                  <div style={{color:"var(--text4)",fontSize:14,fontWeight:600}}>{search?"Nenhum resultado para busca":filterCat!=="all"?"Sem lançamentos nesta categoria":"Nenhum lançamento neste filtro"}</div>
                  <div style={{color:"var(--text4)",fontSize:12,marginTop:3}}>{search?"Tente outro termo":filterCat!=="all"?"Mude o filtro de categoria":"Remova o filtro para ver todos"}</div>
                </>
              ):(
                /* Estado de tela vazia — primeiro uso / mês sem dados */
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"8px 0"}}>
                  <div style={{width:72,height:72,borderRadius:20,background:"rgba(138,180,248,.08)",border:"1px solid #1a3a6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:4}}>💸</div>
                  <div style={{color:"var(--text1)",fontSize:15,fontWeight:700}}>Nenhum lançamento</div>
                  <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",lineHeight:1.5,maxWidth:220}}>Adicione receitas e despesas para visualizar seu saldo e relatórios.</div>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <button onClick={()=>{onOpenForm("receita");}}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"10px 14px",background:"rgba(74,222,128,.1)",border:"1px solid #4ade8033",borderRadius:10,color:"#4ade80",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      <span>📈</span> Receita
                    </button>
                    <button onClick={()=>{onOpenForm("despesa");}}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"10px 14px",background:"rgba(251,146,60,.1)",border:"1px solid #fb923c33",borderRadius:10,color:"#fb923c",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      <span>📉</span> Despesa
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
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0 5px",borderBottom:"1px solid var(--border2)",marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:catColor(catId)}}/>
                  <div style={{fontSize:11,fontWeight:700,color:catColor(catId),textTransform:"uppercase",letterSpacing:"0.06em",flex:1}}>{catName(catId)}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#8ab4f8"}}>{fmt(total)}{budget>0&&<span style={{fontSize:9,color:budgetPct>100?"#f87171":"var(--text3)",marginLeft:4}}>/ {fmt(budget)}</span>}</div>
                </div>
                {budget>0&&<div style={{height:3,background:"var(--bg)",borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${budgetPct}%`,background:budgetPct>100?"#f87171":budgetPct>80?"#facc15":catColor(catId),borderRadius:2,transition:"width .5s"}}/></div>}
                {items.map(renderCard)}
              </div>
            )})
            :filtered.map(renderCard)
          }
        </div>
  </>);
}
