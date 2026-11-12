import S, { tint } from '../styles.js';
import { fmt, fmtDate, mDiff, dueBadge, dueDateFor, eVal, originalMonthAmount } from '../utils.js';

// Cores semânticas do badge de vencimento (dueBadge em utils.js ainda devolve hex).
const BADGE_TOKEN = { "#f87171": "danger", "#fb923c": "orange", "#facc15": "warning" };

// Card de um lançamento do mês. Deslizar para o lado alterna pago/a pagar.
export default function EntryCard({ entry, selMonth, catColor, catName, budgets, catTotals, onToggle, onClone, onEdit, onDelete }) {
    const badge=dueBadge(entry,selMonth);
    const paidDt=entry.isRecurring?entry.paidDateByMonth?.[selMonth]:entry.paidDate;
    const borderColor=entry.type==="receita"?"var(--success-border)":entry.isDivida?"var(--danger-border)":entry.isFatura?tint(entry.cardColor,33):"var(--border)";
    const amtColor=entry.type==="receita"?"var(--success)":entry.isDivida?"var(--danger)":entry.isFatura?entry.cardColor:"var(--text-1)";
    const bt=badge&&BADGE_TOKEN[badge.color];
    const badgeColor=bt?`var(--${bt})`:badge?.color;
    const badgeBg=bt?`var(--${bt}-soft)`:badge?.bg;
    const openStyle=entry.isOpenFatura?{opacity:0.75,borderStyle:"dashed"}:{};
    const origAmt=originalMonthAmount(entry);
    const hasAmtOverride=entry.isRecurring&&!entry.isDivida&&!entry.isFatura&&entry.displayAmount!==undefined&&Math.abs(entry.displayAmount-origAmt)>0.01;
    const canSwipe=!entry.isOpenFatura;
    const onTouchStart=(ev)=>{ ev.currentTarget._tx=ev.touches[0].clientX; ev.currentTarget._ty=ev.touches[0].clientY; };
    const onTouchMove=(ev)=>{
      if(!canSwipe) return;
      const dx=ev.touches[0].clientX-(ev.currentTarget._tx||0);
      const dy=ev.touches[0].clientY-(ev.currentTarget._ty||0);
      if(Math.abs(dx)<Math.abs(dy)) return;
      ev.currentTarget.style.transform=`translateX(${dx*0.35}px)`;
      ev.currentTarget.style.transition='none';
      const pct=Math.min(Math.abs(dx)/80,1);
      ev.currentTarget.style.opacity=String(1-pct*0.25);
    };
    const onTouchEnd=(ev)=>{
      ev.currentTarget.style.transform='';
      ev.currentTarget.style.transition='transform .2s,opacity .2s';
      ev.currentTarget.style.opacity='';
      setTimeout(()=>{ if(ev.currentTarget) ev.currentTarget.style.transition=''; },220);
      if(!canSwipe) return;
      const dx=ev.changedTouches[0].clientX-(ev.currentTarget._tx||0);
      const dy=ev.changedTouches[0].clientY-(ev.currentTarget._ty||0);
      if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5) onToggle(entry);
    };
    const chipBase={fontSize:"var(--fs-2xs)",fontWeight:700,padding:"1px 6px",borderRadius:4,cursor:"default"};
    return(
      <div className="eCard"
        style={{...S.card,borderLeft:`3px solid ${borderColor}`,...openStyle}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div style={S.cardL}>
          <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:entry.isFatura?entry.cardColor:catColor(entry.category),flexShrink:0,marginTop:3}}/>
          <div style={{minWidth:0,flex:1}}>
            <div style={S.cardTitle}>{entry.description}</div>
            <div style={S.cardMeta}>
              {!entry.isFatura&&<span style={{...S.tag,color:catColor(entry.category),borderColor:tint(catColor(entry.category),27),background:tint(catColor(entry.category),9)}}>{catName(entry.category)}</span>}
              {entry.recurrence!=="none"&&<span style={{...S.tag,color:entry.isDivida?"var(--danger)":"var(--accent)",borderColor:entry.isDivida?"var(--danger-border)":"var(--accent-border)",background:entry.isDivida?"var(--danger-soft)":"var(--accent-surface)"}}>{entry.recurLabel}</span>}
              <span style={{fontSize:"var(--fs-xs)",color:"var(--text-4)"}}>{fmtDate(dueDateFor(entry,selMonth))}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4,flexWrap:"wrap"}}>
              <span style={{fontSize:"var(--fs-lg)",fontWeight:700,color:amtColor,letterSpacing:"-0.3px"}}>
                {entry.type==="receita"?"+":""}{fmt(eVal(entry))}
              </span>
              {hasAmtOverride&&(
                <span title={`Valor original: ${fmt(origAmt)}`} style={{...chipBase,background:"var(--warning-soft)",border:"1px solid var(--warning-border)",color:"var(--warning)",letterSpacing:"0.03em"}}>
                  ⚙ ajustado
                </span>
              )}
              {(()=>{if(entry.type!=="despesa"||!budgets[entry.category])return null;const lim=budgets[entry.category];const spent=catTotals[entry.category]||0;if(spent>lim)return<span style={{...chipBase,background:"var(--danger-soft)",border:"1px solid var(--danger-border)",color:"var(--danger)"}}>⚠ estourado</span>;if(spent/lim>=0.8)return<span style={{...chipBase,background:"var(--orange-soft)",border:"1px solid var(--orange-border)",color:"var(--orange)"}}>⚡ {((spent/lim)*100).toFixed(0)}%</span>;return null;})()}
            </div>
            {entry.recurrence==="installment"&&entry.installments>1&&(()=>{
              const cur=Math.min(entry.installments,Math.max(1,mDiff(entry.date.substring(0,7),selMonth)+1));
              const pct=cur/entry.installments;
              return(
                <div style={{marginTop:5,display:"flex",alignItems:"center",gap:6}}>
                  <div style={{flex:1,height:3,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct*100}%`,background:pct>=1?"var(--success)":"var(--accent)",borderRadius:2,transition:"width .4s"}}/>
                  </div>
                  <span style={{fontSize:"var(--fs-2xs)",color:"var(--text-4)",flexShrink:0}}>{cur}/{entry.installments}</span>
                </div>
              );
            })()}
            {badge&&<div style={{display:"inline-block",marginTop:4,fontSize:"var(--fs-2xs)",fontWeight:700,padding:"2px 7px",borderRadius:4,background:badgeBg,color:badgeColor}}>{badge.text}</div>}
            {entry.notes&&<div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:3,fontStyle:"italic",display:"flex",alignItems:"flex-start",gap:4}}><svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:3,flexShrink:0}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span>{entry.notes}</span></div>}
            {(entry.tags||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{(entry.tags||[]).map(t=><span key={t} style={{fontSize:"var(--fs-2xs)",padding:"1px 6px",borderRadius:4,background:"var(--accent-soft)",border:`1px solid ${tint("var(--accent)",13)}`,color:"var(--accent)",fontWeight:600}}>#{t}</span>)}</div>}
            {entry.isOpenFatura&&<div style={{fontSize:"var(--fs-xs)",color:entry.cardColor,marginTop:3,opacity:0.8,display:"flex",alignItems:"center",gap:4}}><svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{marginRight:3,flexShrink:0}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg><span>Fecha em {fmtDate(entry.closeDate)}</span></div>}
            {paidDt&&!entry.isDivida&&!entry.isFatura&&<div style={{fontSize:"var(--fs-xs)",color:"var(--success)",marginTop:2}}>✓ Pago em {fmtDate(paidDt)}</div>}
          </div>
        </div>
        <div style={S.cardR}>
          <div style={{display:"flex",gap:4}}>
            {!entry.isDivida&&!entry.isFatura&&(
              <button type="button" className="iconBtn" title="Clonar" aria-label={`Clonar ${entry.description}`} onClick={()=>onClone(entry)}
                style={{...S.iconBtn,background:"var(--success-soft)",color:"var(--success)"}}>
                <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            )}
            {!entry.isDivida&&!entry.isFatura&&(
              <button type="button" className="iconBtn" aria-label={`Editar ${entry.description}`} onClick={()=>onEdit(entry)}
                style={{...S.iconBtn,background:"var(--accent-soft)",color:"var(--accent)"}}>
                <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            {!entry.isDivida&&!entry.isFatura&&(
              <button type="button" className="iconBtn" aria-label={`Excluir ${entry.description}`} onClick={()=>onDelete(entry)} style={{...S.iconBtn,background:"var(--danger-soft)",color:"var(--danger)"}}><span aria-hidden="true">✕</span></button>
            )}
          </div>
          {entry.isOpenFatura?(
            <span style={{...S.badge,background:"var(--info-soft)",color:"var(--info)",border:"1px solid var(--info-border)",padding:"4px 8px",fontSize:"var(--fs-xs)",display:"flex",alignItems:"center",gap:4}}><svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{marginRight:3,flexShrink:0}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> em aberto</span>
          ):(
            <button type="button" onClick={()=>onToggle(entry)} className="statusToggleBtn" aria-pressed={entry.statusForMonth==="pago"}
              title={entry.statusForMonth==="pago"?(entry.type==="receita"?"Clique para marcar como a receber":"Clique para marcar como a pagar"):(entry.type==="receita"?"Clique para marcar como recebido":"Clique para marcar como pago")}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 9px",minHeight:32,borderRadius:"var(--radius-sm)",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:"var(--fs-xs)",fontWeight:700,
                background:entry.statusForMonth==="pago"?"var(--success-soft)":"var(--orange-soft)",
                color:entry.statusForMonth==="pago"?"var(--success)":"var(--orange)",
                transition:"all .15s"}}>
              {entry.statusForMonth==="pago"?(
                <><svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>{entry.type==="receita"?"Recebido":"Pago"}</>
              ):(
                <><svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{entry.type==="receita"?"A receber":"A pagar"}</>
              )}
            </button>
          )}
        </div>
      </div>
    );
}
