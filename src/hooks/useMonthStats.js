import { useMemo } from 'react';
import { getMonthEntries, accumulatedBalance } from '../logic.js';
import { addM, daysUntil, dueDateFor, eVal } from '../utils.js';

export function useMonthStats({ entries, dividas, cards, cardPurchases, cardFaturas, budgets, selMonth, today }) {
  const NOW = today.substring(0, 7);

  const monthEntries = useMemo(
    () => getMonthEntries(entries, dividas, selMonth, cards, cardPurchases, cardFaturas, today),
    [entries, dividas, selMonth, cards, cardPurchases, cardFaturas, today]
  );

  const totRec  = useMemo(() => monthEntries.filter(e => e.type === 'receita').reduce((s, e) => s + eVal(e), 0), [monthEntries]);
  const totDesp = useMemo(() => monthEntries.filter(e => e.type === 'despesa').reduce((s, e) => s + eVal(e), 0), [monthEntries]);
  const totPend = useMemo(() => monthEntries.filter(e => e.statusForMonth === 'a_pagar' && e.type === 'despesa').reduce((s, e) => s + eVal(e), 0), [monthEntries]);
  const totPago = useMemo(() => monthEntries.filter(e => e.statusForMonth === 'pago' && e.type === 'despesa').reduce((s, e) => s + eVal(e), 0), [monthEntries]);

  const accumSaldoResult = useMemo(
    () => accumulatedBalance({ entries, dividas, cards, cardPurchases, cardFaturas }, selMonth, today),
    [entries, dividas, selMonth, cards, cardPurchases, cardFaturas, today]
  );

  const healthScore = useMemo(() => {
    if (totRec === 0) return null;
    const fixedDesp  = entries.filter(e => e.recurrence !== 'none' && e.type === 'despesa')
      .reduce((s, e) => s + (e.recurrence === 'installment' ? e.amount / e.installments : e.amount), 0);
    const dividaDesp = dividas.reduce((s, d) => s + d.totalAmount / d.installments, 0);
    const fixedPct   = Math.min(100, ((fixedDesp + dividaDesp) / totRec) * 100);
    const savingPct  = Math.max(0, ((totRec - totDesp) / totRec) * 100);
    let score = 100;
    if (fixedPct > 70) score -= 30; else if (fixedPct > 50) score -= 15; else if (fixedPct > 30) score -= 5;
    if (savingPct < 10) score -= 20; else if (savingPct < 20) score -= 10;
    if (totPend > totRec * 0.3) score -= 10;
    score = Math.max(0, Math.min(100, score));
    const level = score >= 80 ? 'Saudável' : score >= 60 ? 'Atenção' : 'Crítico';
    const color = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#f87171';
    return { score, level, color, fixedPct, savingPct };
  }, [entries, dividas, totRec, totDesp, totPend]);

  const budgetOverCount = useMemo(() => {
    if (!Object.keys(budgets).length) return 0;
    const catTotals = {};
    monthEntries.filter(e => e.type === 'despesa').forEach(e => {
      catTotals[e.category] = (catTotals[e.category] || 0) + eVal(e);
    });
    return Object.entries(budgets).filter(([id, limit]) => limit > 0 && (catTotals[id] || 0) > limit).length;
  }, [budgets, monthEntries]);

  const { overdueDue, upcomingDue } = useMemo(() => {
    const overdue = [], upcoming = [];
    const seen = new Set();
    for (let i = -1; i <= 2; i++) {
      const m = addM(NOW, i);
      const me = getMonthEntries(entries, dividas, m, cards, cardPurchases, cardFaturas, today);
      me.filter(e => e.statusForMonth === 'a_pagar').forEach(e => {
        const due = dueDateFor(e, m);
        const days = daysUntil(due, today);
        if (days === null) return;
        const key = `${e.id || e.dividaId || e.faturaKey}_${m}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (days < 0)       overdue.push({ ...e, _mk: m, _due: due, _days: days });
        else if (days <= 30 || (e.isFatura && !e.isOpenFatura)) upcoming.push({ ...e, _mk: m, _due: due, _days: days });
      });
    }
    return {
      overdueDue:  overdue.sort((a, b) => a._days - b._days),
      upcomingDue: upcoming.sort((a, b) => a._days - b._days).slice(0, 10),
    };
  }, [entries, dividas, cards, cardPurchases, cardFaturas, NOW, today]);

  return {
    monthEntries,
    totRec, totDesp, totPend, totPago,
    saldo: totRec - totDesp,
    accumSaldo:       accumSaldoResult?.value ?? null,
    accumSaldoCapped: accumSaldoResult?.capped ?? false,
    healthScore,
    budgetOverCount,
    overdueDue,
    upcomingDue,
  };
}
