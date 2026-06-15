import { memo } from 'react';
import { fmt, fmtDate, eVal, dueBadge, mDiff } from '../utils.js';
import S from '../styles.js';

const EntryCard = memo(function EntryCard({ entry, selMonth, catColor, catName, catTotals, budgets, handleToggle, handleClone, onEdit, onDelete }) {
  const badge = dueBadge(entry, selMonth);
  const paidDt = entry.isRecurring ? entry.paidDateByMonth?.[selMonth] : entry.paidDate;
  const borderColor = entry.type === "receita" ? "#4ade8055" : entry.isDivida ? "#f8717155" : entry.isFatura ? `${entry.cardColor}55` : "var(--border)";
  const amtColor = entry.type === "receita" ? "#4ade80" : entry.isDivida ? "#f87171" : entry.isFatura ? entry.cardColor : "var(--text1)";
  const openStyle = entry.isOpenFatura ? { opacity: 0.75, borderStyle: "dashed" } : {};
  const origAmt = entry.recurrence === "installment" ? entry.amount / entry.installments : entry.amount;
  const hasAmtOverride = entry.isRecurring && !entry.isDivida && !entry.isFatura && entry.displayAmount !== undefined && Math.abs(entry.displayAmount - origAmt) > 0.01;
  const canSwipe = !entry.isOpenFatura;

  const onTouchStart = (ev) => { ev.currentTarget._tx = ev.touches[0].clientX; ev.currentTarget._ty = ev.touches[0].clientY; };
  const onTouchMove = (ev) => {
    if (!canSwipe) return;
    const dx = ev.touches[0].clientX - (ev.currentTarget._tx || 0);
    const dy = ev.touches[0].clientY - (ev.currentTarget._ty || 0);
    if (Math.abs(dx) < Math.abs(dy)) return;
    ev.currentTarget.style.transform = `translateX(${dx * 0.35}px)`;
    ev.currentTarget.style.transition = 'none';
    const pct = Math.min(Math.abs(dx) / 80, 1);
    ev.currentTarget.style.opacity = String(1 - pct * 0.25);
  };
  const onTouchEnd = (ev) => {
    ev.currentTarget.style.transform = '';
    ev.currentTarget.style.transition = 'transform .2s,opacity .2s';
    ev.currentTarget.style.opacity = '';
    setTimeout(() => { if (ev.currentTarget) ev.currentTarget.style.transition = ''; }, 220);
    if (!canSwipe) return;
    const dx = ev.changedTouches[0].clientX - (ev.currentTarget._tx || 0);
    const dy = ev.changedTouches[0].clientY - (ev.currentTarget._ty || 0);
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) handleToggle(entry);
  };

  return (
    <div className="eCard"
      style={{ ...S.card, borderLeft: `3px solid ${borderColor}`, ...openStyle }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div style={S.cardL}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.isFatura ? entry.cardColor : catColor(entry.category), flexShrink: 0, marginTop: 3 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={S.cardTitle}>{entry.description}</div>
          <div style={S.cardMeta}>
            {!entry.isFatura && <span style={{ ...S.tag, color: catColor(entry.category), borderColor: catColor(entry.category) + "44", background: catColor(entry.category) + "18" }}>{catName(entry.category)}</span>}
            {entry.recurrence !== "none" && <span style={{ ...S.tag, color: entry.isDivida ? "#f87171" : "#8ab4f8", borderColor: entry.isDivida ? "#f8717144" : "#1a3a6e", background: entry.isDivida ? "rgba(248,113,113,.12)" : "#0d1a2e" }}>{entry.recurLabel}</span>}
            <span style={{ fontSize: 10, color: "var(--text4)" }}>{fmtDate(entry.isRecurring && entry.recurrence !== "none" && !entry.isDivida && !entry.isFatura ? `${selMonth}-${entry.date.split("-")[2]}` : entry.date)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: amtColor, letterSpacing: "-0.3px" }}>
              {entry.type === "receita" ? "+" : ""}{fmt(eVal(entry))}
            </span>
            {hasAmtOverride && (
              <span title={`Valor original: ${fmt(origAmt)}`} style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(250,204,21,.12)", border: "1px solid rgba(250,204,21,.3)", color: "#facc15", letterSpacing: "0.03em", cursor: "default" }}>
                ⚙ ajustado
              </span>
            )}
            {(() => {
              if (entry.type !== "despesa" || !budgets[entry.category]) return null;
              const lim = budgets[entry.category];
              const spent = catTotals[entry.category] || 0;
              if (spent > lim) return <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", color: "#f87171", cursor: "default" }}>⚠ estourado</span>;
              if (spent / lim >= 0.8) return <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(251,146,60,.12)", border: "1px solid rgba(251,146,60,.3)", color: "#fb923c", cursor: "default" }}>⚡ {((spent / lim) * 100).toFixed(0)}%</span>;
              return null;
            })()}
          </div>
          {entry.recurrence === "installment" && entry.installments > 1 && (() => {
            const cur = Math.min(entry.installments, Math.max(1, mDiff(entry.date.substring(0, 7), selMonth) + 1));
            const pct = cur / entry.installments;
            return (
              <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct * 100}%`, background: pct >= 1 ? "#4ade80" : "#8ab4f8", borderRadius: 2, transition: "width .4s" }} />
                </div>
                <span style={{ fontSize: 9, color: "var(--text4)", flexShrink: 0 }}>{cur}/{entry.installments}</span>
              </div>
            );
          })()}
          {badge && <div style={{ display: "inline-block", marginTop: 4, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: badge.bg, color: badge.color }}>{badge.text}</div>}
          {entry.notes && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3, fontStyle: "italic", display: "flex", alignItems: "flex-start", gap: 4 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3, flexShrink: 0 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg><span>{entry.notes}</span></div>}
          {(entry.tags || []).length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{(entry.tags || []).map(t => <span key={t} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(138,180,248,.12)", border: "1px solid #8ab4f822", color: "#8ab4f8", fontWeight: 600 }}>#{t}</span>)}</div>}
          {entry.isOpenFatura && <div style={{ fontSize: 10, color: entry.cardColor, marginTop: 3, opacity: 0.8, display: "flex", alignItems: "center", gap: 4 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 3, flexShrink: 0 }}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg><span>Fecha em {fmtDate(entry.closeDate)}</span></div>}
          {paidDt && !entry.isDivida && !entry.isFatura && <div style={{ fontSize: 10, color: "#4ade8066", marginTop: 2 }}>✓ Pago em {fmtDate(paidDt)}</div>}
        </div>
      </div>
      <div style={S.cardR}>
        <div style={{ display: "flex", gap: 4 }}>
          {!entry.isDivida && !entry.isFatura && (
            <button className="iconBtn" title="Clonar" onClick={() => handleClone(entry)}
              style={{ ...S.iconBtn, background: "rgba(74,222,128,.08)", color: "#4ade80" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            </button>
          )}
          {!entry.isDivida && !entry.isFatura && (
            <button className="iconBtn" onClick={() => onEdit(entry)}
              style={{ ...S.iconBtn, background: "rgba(138,180,248,.1)", color: "#8ab4f8" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
          )}
          {!entry.isDivida && !entry.isFatura && (
            <button className="iconBtn" onClick={() => onDelete(entry)} style={{ ...S.iconBtn, background: "rgba(239,68,68,.1)", color: "#f87171" }}>✕</button>
          )}
        </div>
        {entry.isOpenFatura ? (
          <span style={{ ...S.badge, background: "rgba(138,180,248,.1)", color: "#8ab4f8", border: "1px solid #8ab4f833", padding: "4px 8px", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 3, flexShrink: 0 }}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg> em aberto</span>
        ) : (
          <button onClick={() => handleToggle(entry)} className="statusToggleBtn"
            title={entry.statusForMonth === "pago" ? (entry.type === "receita" ? "Clique para marcar como a receber" : "Clique para marcar como a pagar") : (entry.type === "receita" ? "Clique para marcar como recebido" : "Clique para marcar como pago")}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700,
              background: entry.statusForMonth === "pago" ? "rgba(74,222,128,.18)" : "rgba(251,146,60,.15)",
              color: entry.statusForMonth === "pago" ? "#4ade80" : "#fb923c",
              transition: "all .15s" }}>
            {entry.statusForMonth === "pago" ? (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>{entry.type === "receita" ? "Recebido" : "Pago"}</>
            ) : (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{entry.type === "receita" ? "A receber" : "A pagar"}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
});

export default EntryCard;
