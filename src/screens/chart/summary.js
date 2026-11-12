// Dados da Análise: um resumo por mês (cacheado enquanto os dados não mudam) e agregações sobre ele.
import { useMemo } from 'react';
import { getMonthEntries, buildFatura, getCardBillingMonths } from '../../logic.js';
import { eVal } from '../../utils.js';

const r2 = (v) => Math.round(v * 100) / 100;

// summary(m) → { month, rec, dep, saldo, pago, byCat: { despesa: {id: valor}, receita: {id: valor} } }
export function makeSummary({ entries, dividas, cards, cardPurchases, cardFaturas, today }) {
  const cache = new Map();
  return (m) => {
    if (cache.has(m)) return cache.get(m);
    const list = getMonthEntries(entries, dividas, m, cards, cardPurchases, cardFaturas, today);
    const byCat = { despesa: {}, receita: {} };
    let rec = 0, dep = 0, pago = 0;
    for (const e of list) {
      const v = eVal(e);
      byCat[e.type][e.category] = (byCat[e.type][e.category] || 0) + v;
      if (e.type === 'receita') rec += v;
      else { dep += v; if (e.statusForMonth === 'pago') pago += v; }
    }
    const s = { month: m, rec: r2(rec), dep: r2(dep), saldo: r2(rec - dep), pago: r2(pago), byCat };
    cache.set(m, s);
    return s;
  };
}

export function useChartSummary({ entries, dividas, cards, cardPurchases, cardFaturas, today }) {
  return useMemo(
    () => makeSummary({ entries, dividas, cards, cardPurchases, cardFaturas, today }),
    [entries, dividas, cards, cardPurchases, cardFaturas, today]
  );
}

export function sumMonths(summary, months) {
  const rec = r2(months.reduce((s, m) => s + summary(m).rec, 0));
  const dep = r2(months.reduce((s, m) => s + summary(m).dep, 0));
  return { rec, dep, saldo: r2(rec - dep) };
}

// Ranking de categorias (maior primeiro) somando os meses. type: "despesa" | "receita".
export function categoryRanking(summary, months, type, catOf) {
  const map = {};
  for (const m of months) for (const [id, v] of Object.entries(summary(m).byCat[type])) map[id] = (map[id] || 0) + v;
  return Object.entries(map)
    .map(([id, value]) => ({ id, name: catOf(id).name, color: catOf(id).color, value: r2(value) }))
    .sort((a, b) => b.value - a.value);
}

// Faturas que VENCEM nos meses dados (mesma regra de Contas): por mês, por categoria e por cartão.
export function cardStats({ cards, cardPurchases, cardFaturas, today }, months, catOf) {
  const wanted = new Set(months);
  const monthly = Object.fromEntries(months.map(m => [m, { month: m, total: 0, byCard: {} }]));
  const cats = {}; const perCard = {};
  for (const card of cards) {
    for (const bm of getCardBillingMonths(card, cardPurchases)) {
      const fat = buildFatura(card, cardPurchases, cardFaturas, bm, today);
      const due = fat.dueDate.substring(0, 7);
      if (!wanted.has(due) || fat.total <= 0) continue;
      monthly[due].total += fat.total;
      monthly[due].byCard[card.id] = (monthly[due].byCard[card.id] || 0) + fat.total;
      perCard[card.id] = (perCard[card.id] || 0) + fat.total;
      for (const it of fat.items) { const id = it.category || 'outro'; cats[id] = (cats[id] || 0) + it.amount; }
    }
  }
  const catList = Object.entries(cats).map(([id, value]) => ({ id, name: catOf(id).name, color: catOf(id).color, value: r2(value) })).sort((a, b) => b.value - a.value);
  const total = r2(Object.values(monthly).reduce((s, x) => s + x.total, 0));
  return {
    monthly: months.map(m => ({ ...monthly[m], total: r2(monthly[m].total) })),
    cats: catList, total,
    perCard: cards.map(c => ({ card: c, total: r2(perCard[c.id] || 0) })).filter(x => x.total > 0),
  };
}
