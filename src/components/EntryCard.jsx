import { useState } from 'react';
import S, { tint } from '../styles.js';
import EntryActionsSheet from './EntryActionsSheet.jsx';
import { fmt, fmtDate, mDiff, dueLine, eVal, originalMonthAmount } from '../utils.js';

const chip = { fontSize: "var(--fs-sm)", fontWeight: 700, padding: "1px 6px", borderRadius: "var(--radius-xs)", flexShrink: 0 };
const svgProps = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };

// Avisos do lançamento: aparecem como um ícone ao lado do valor; o texto completo vai no painel ⋯.
function entryFlags(entry, origAmt, hasAmtOverride, budgets, catTotals) {
  const flags = [];
  if (hasAmtOverride) flags.push({ key: "adj", glyph: "⚙", token: "warning", text: `Valor ajustado neste mês (original ${fmt(origAmt)})` });
  const lim = budgets[entry.category];
  if (entry.type === "despesa" && lim) {
    const spent = catTotals[entry.category] || 0;
    if (spent > lim) flags.push({ key: "over", glyph: "⚠", token: "danger", text: `Orçamento da categoria estourado: ${fmt(spent)} de ${fmt(lim)}` });
    else if (spent / lim >= 0.8) flags.push({ key: "near", glyph: "⚡", token: "orange", text: `${((spent / lim) * 100).toFixed(0)}% do orçamento da categoria: ${fmt(spent)} de ${fmt(lim)}` });
  }
  return flags;
}

// Card de um lançamento do mês. Deslizar para o lado alterna pago/a pagar.
export default function EntryCard({ entry, selMonth, catColor, catName, budgets, catTotals, onToggle, onClone, onEdit, onDelete }) {
    const [menuOpen,setMenuOpen]=useState(false);
    const due=dueLine(entry,selMonth);
    const paidDt=entry.isRecurring?entry.paidDateByMonth?.[selMonth]:entry.paidDate;
    const borderColor=entry.type==="receita"?"var(--success-border)":entry.isDivida?"var(--danger-border)":entry.isFatura?tint(entry.cardColor,33):"var(--border)";
    const amtColor=entry.type==="receita"?"var(--success)":entry.isDivida?"var(--danger)":entry.isFatura?entry.cardColor:"var(--text-1)";
    const openStyle=entry.isOpenFatura?{opacity:0.75,borderStyle:"dashed"}:{};
    const origAmt=originalMonthAmount(entry);
    const hasAmtOverride=entry.isRecurring&&!entry.isDivida&&!entry.isFatura&&entry.displayAmount!==undefined&&Math.abs(entry.displayAmount-origAmt)>0.01;
    const flags=entryFlags(entry,origAmt,hasAmtOverride,budgets,catTotals);
    const hasMenu=!entry.isDivida&&!entry.isFatura;
    const paid=entry.statusForMonth==="pago";
    const isFixed=entry.recurrence==="fixed";
    const tags=entry.tags||[];
    const noteLine=[entry.notes,...tags.map(t=>`#${t}`)].filter(Boolean).join(" · ");
    const showPaidInMeta=paid&&paidDt&&!entry.isDivida&&!entry.isFatura;
    const hasFooter=(!entry.isFatura||due)||noteLine;
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
    return(
      <div className="eCard"
        style={{...S.card,alignItems:"stretch",borderLeft:`3px solid ${borderColor}`,...openStyle}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div style={{...S.cardL,alignItems:"stretch"}}>
          <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:entry.isFatura?entry.cardColor:catColor(entry.category),flexShrink:0,marginTop:5,alignSelf:"flex-start"}}/>
          <div style={{minWidth:0,flex:1,display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,minHeight:18,lineHeight:"18px"}}>
              <div style={S.cardTitle}>{entry.description}</div>
              {isFixed&&<svg {...svgProps} role="img" aria-label="Fixo: repete todo mês" width="12" height="12" strokeWidth="2.4" style={{flexShrink:0,color:"var(--text-3)"}}><title>Fixo: repete todo mês</title><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>}
              {entry.recurrence!=="none"&&!isFixed&&<span style={{...chip,color:entry.isDivida?"var(--danger)":"var(--accent)",background:entry.isDivida?"var(--danger-soft)":"var(--accent-surface)",border:`1px solid ${entry.isDivida?"var(--danger-border)":"var(--accent-border)"}`}}>{entry.recurLabel}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:3,minHeight:20}}>
              <span style={{fontSize:"var(--fs-lg)",fontWeight:700,color:amtColor,letterSpacing:"-0.3px"}}>
                {entry.type==="receita"?"+":""}{fmt(eVal(entry))}
              </span>
              {flags.map(f=><span key={f.key} role="img" aria-label={f.text} title={f.text} style={{fontSize:"var(--fs-base)",lineHeight:1,color:`var(--${f.token})`}}>{f.glyph}</span>)}
            </div>
            {entry.recurrence==="installment"&&entry.installments>1&&(()=>{
              const cur=Math.min(entry.installments,Math.max(1,mDiff(entry.date.substring(0,7),selMonth)+1));
              const pct=cur/entry.installments;
              return(
                <div role="progressbar" aria-label={`Parcela ${cur} de ${entry.installments}`} aria-valuemin={0} aria-valuemax={entry.installments} aria-valuenow={cur}
                  style={{marginTop:5,height:2,background:"var(--border)",borderRadius:1,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct*100}%`,background:pct>=1?"var(--success)":"var(--accent)",transition:"width .4s"}}/>
                </div>
              );
            })()}
            {hasFooter&&(
              <div style={{marginTop:"auto",paddingTop:4,display:"flex",flexDirection:"column",gap:2}}>
                {(!entry.isFatura||due)&&(
                  <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",display:"flex",columnGap:8,flexWrap:"wrap",alignItems:"baseline"}}>
                    {!entry.isFatura&&<span>{catName(entry.category)}</span>}
                    {showPaidInMeta
                      ?<span style={{fontWeight:600,color:"var(--success)"}}>✓ {entry.type==="receita"?"Recebido":"Pago"} em {fmtDate(paidDt)}</span>
                      :due&&<span style={{fontWeight:due.token?700:500,color:due.token?`var(--${due.token})`:entry.isOpenFatura?entry.cardColor:"var(--text-3)"}}>{due.text}</span>}
                  </div>
                )}
                {noteLine&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:"var(--fs-sm)",color:"var(--text-3)",minWidth:0}}>
                  <svg {...svgProps} width="11" height="11" strokeWidth="2" style={{flexShrink:0}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{noteLine}</span>
                </div>}
              </div>
            )}
          </div>
        </div>
        <div style={{...S.cardR,justifyContent:hasMenu?"space-between":"flex-end"}}>
          {hasMenu&&(
            <button type="button" className="iconBtn" aria-label={`Ações de ${entry.description}`} aria-haspopup="dialog" onClick={()=>setMenuOpen(true)}
              style={{...S.iconBtn,width:44,height:36,background:"transparent",color:"var(--text-3)"}}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
          )}
          {entry.isOpenFatura?(
            <span style={{...S.badge,background:"var(--info-soft)",color:"var(--info)",border:"1px solid var(--info-border)",padding:"4px 8px",fontSize:"var(--fs-sm)",display:"flex",alignItems:"center",gap:4}}>em aberto</span>
          ):paid?(
            <button type="button" onClick={()=>onToggle(entry)} className="statusToggleBtn"
              aria-label={`${entry.type==="receita"?"Recebido":"Pago"}: marcar ${entry.description} como ${entry.type==="receita"?"a receber":"a pagar"}`}
              title={entry.type==="receita"?"Recebido — toque para marcar como a receber":"Pago — toque para marcar como a pagar"}
              style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"var(--radius-full)",border:"none",cursor:"pointer",background:"var(--success-soft)",color:"var(--success)",transition:"all .15s"}}>
              <svg {...svgProps} width="18" height="18" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          ):(
            <button type="button" onClick={()=>onToggle(entry)} className="statusToggleBtn"
              aria-label={`Marcar ${entry.description} como ${entry.type==="receita"?"recebido":"pago"}`}
              title={entry.type==="receita"?"Toque para marcar como recebido":"Toque para marcar como pago"}
              style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",minHeight:44,borderRadius:"var(--radius-md)",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:"var(--fs-sm)",fontWeight:700,background:"var(--orange-soft)",color:"var(--orange)",transition:"all .15s"}}>
              <svg {...svgProps} width="12" height="12" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{entry.type==="receita"?"A receber":"A pagar"}
            </button>
          )}
        </div>
        {menuOpen&&<EntryActionsSheet entry={entry} flags={flags} extra={showPaidInMeta?due?.text:null} onEdit={onEdit} onClone={onClone} onDelete={onDelete} onClose={()=>setMenuOpen(false)}/>}
      </div>
    );
}
