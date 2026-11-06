// Transformações puras dos dados do usuário (sem React/Firebase).
// Cada função recebe o estado atual e devolve o novo — quem chama persiste.
import { todayISO, newId, fmtDate, mLabel, eVal, addM, installmentAmount } from './utils.js';
import { getMonthEntries, getCardBillingMonths, buildFatura } from './logic.js';

// Alterna pago/a pagar de um lançamento (item vindo de getMonthEntries) no mês.
export function toggleEntryStatus(entries, item, monthKey, today = todayISO()) {
  const newSt = item.statusForMonth === 'pago' ? 'a_pagar' : 'pago';
  const paidDt = newSt === 'pago' ? today : null;
  const next = entries.map(e => {
    if (e.id !== item.id) return e;
    if (!item.isRecurring) return { ...e, status: newSt, paidDate: paidDt };
    // O status também vai para o override do mês, se existir — senão a edição
    // "só este mês" salva antes sobrescreveria o statusByMonth.
    const ov = e.overrides?.[monthKey];
    return {
      ...e,
      statusByMonth: { ...e.statusByMonth, [monthKey]: newSt },
      paidDateByMonth: { ...e.paidDateByMonth, [monthKey]: paidDt },
      overrides: { ...e.overrides, [monthKey]: ov ? { ...ov, status: newSt } : { status: newSt } },
    };
  });
  return { entries: next, status: newSt };
}

// Alterna a parcela do mês de uma dívida. `quitada` = acabou de ser quitada.
export function toggleDividaMonth(dividas, dividaId, monthKey) {
  let quitada = false;
  const next = dividas.map(d => {
    if (d.id !== dividaId) return d;
    const pm = d.paidMonths || [];
    const wasPaid = pm.includes(monthKey);
    const paidMonths = wasPaid ? pm.filter(m => m !== monthKey) : [...pm, monthKey];
    if (!wasPaid && paidMonths.length >= d.installments) quitada = true;
    return { ...d, paidMonths };
  });
  return { dividas: next, quitada };
}

// scope: "this" (só o mês) | "future" (altera a regra base). Avulsos sempre alteram a base.
export function applyEntryEdit(entries, entryId, changes, scope, monthKey) {
  return entries.map(e => {
    if (e.id !== entryId) return e;
    if (changes._resetAmount) {
      // Restaura o valor original: remove "amount" do override do mês
      const ov = e.overrides?.[monthKey];
      if (!ov) return e;
      const { amount: _, ...rest } = ov;
      const overrides = { ...e.overrides };
      if (Object.keys(rest).length > 0) overrides[monthKey] = rest; else delete overrides[monthKey];
      return { ...e, overrides };
    }
    if (e.recurrence === 'none' || scope === 'future') {
      // No parcelado o usuário edita o valor da parcela; a base guarda o total
      const amount = (e.recurrence === 'installment' && changes.amount !== undefined)
        ? Math.round(changes.amount * e.installments * 100) / 100
        : (changes.amount ?? e.amount);
      return { ...e, ...changes, amount };
    }
    return { ...e, overrides: { ...e.overrides, [monthKey]: changes } };
  });
}

// scope: "all" (apaga) | "this" (só o mês) | qualquer outro (deste mês em diante)
export function deleteEntry(entries, entryId, scope, monthKey) {
  if (scope === 'all') return entries.filter(e => e.id !== entryId);
  if (scope === 'this') return entries.map(e => e.id !== entryId ? e : { ...e, deletedMonths: [...(e.deletedMonths || []), monthKey] });
  return entries.map(e => e.id !== entryId ? e : { ...e, deletedFrom: monthKey });
}

export function payFatura(cardFaturas, item, amount, partial, today = todayISO()) {
  const cur = cardFaturas[item.faturaKey] || {};
  const fullyPaid = !partial || amount >= item.amount;
  return {
    cardFaturas: { ...cardFaturas, [item.faturaKey]: { ...cur, paid: fullyPaid, paidAmount: amount, paidDate: today, partial: partial && !fullyPaid } },
    fullyPaid,
  };
}

export function revertFatura(cardFaturas, faturaKey) {
  const next = { ...cardFaturas };
  delete next[faturaKey];
  return next;
}

// ─── Novo lançamento ─────────────────────────────────────────
export const isFormValid = (form) => Boolean(form.description.trim() && form.amount && form.date);

export function findDuplicate(entries, form) {
  const desc = form.description.trim().toLowerCase();
  return entries.find(e => e.description.toLowerCase() === desc
    && Math.abs(parseFloat(e.amount) - parseFloat(form.amount)) < 0.01
    && e.date === form.date && e.type === form.type) || null;
}

export function entryFromForm(form) {
  return {
    id: newId(), description: form.description.trim(), amount: parseFloat(form.amount), date: form.date,
    type: form.type, status: form.status, category: form.category, recurrence: form.recurrence, notes: form.notes,
    ...(form.recurrence === 'installment' ? { installments: parseInt(form.installments) } : {}),
    ...(form.endMonth ? { endMonth: form.endMonth } : {}),
    ...(form.tags?.length ? { tags: form.tags } : {}),
    ...(form.accountId ? { accountId: form.accountId } : {}),
    statusByMonth: {}, overrides: {},
  };
}

export function cardPurchaseFromForm(form, cardId) {
  return {
    id: newId(), cardId, description: form.description.trim(), amount: parseFloat(form.amount) || 0,
    purchaseDate: form.date, category: form.category, installments: 1, notes: form.notes || '',
  };
}

// ─── Exportação CSV ──────────────────────────────────────────
const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
export const CSV_HEADER = ['Descrição', 'Tipo', 'Valor', 'Vencimento', 'Status', 'Categoria', 'Recorrência', 'Notas'];

// fromMk+toMk: intervalo; só fromMk: um mês; nenhum: base completa (regras, não ocorrências).
export function buildCsv({ entries, dividas, cards, cardPurchases, cardFaturas, categories }, fromMk, toMk) {
  const catName = (id) => (categories.find(c => c.id === id) || { name: id }).name;
  const monthRow = (e) => [q(e.description), e.type, eVal(e).toFixed(2), fmtDate(e.date), e.statusForMonth || e.status, q(catName(e.category)), e.recurrence || 'none', q(e.notes)];
  const month = (mk) => getMonthEntries(entries, dividas, mk, cards, cardPurchases, cardFaturas).map(monthRow);
  let rows = [];
  if (fromMk && toMk) {
    for (let cur = fromMk; cur <= toMk; cur = addM(cur, 1)) rows.push(...month(cur));
  } else if (fromMk) {
    rows = month(fromMk);
  } else {
    rows = entries.map(e => [q(e.description), e.type, e.amount.toFixed(2), fmtDate(e.date), e.status, q(catName(e.category)), e.recurrence || 'none', q(e.notes)]);
    dividas.forEach(d => rows.push([q(`${d.name} (dívida)`), q('despesa'), installmentAmount(d.totalAmount, d.installments, 2).toFixed(2), q(d.startMonth), q('parcelado'), q(catName(d.category || 'divida')), q(`${d.installments}x`), q(d.notes)]));
    cards.forEach(card => getCardBillingMonths(card, cardPurchases).forEach(bm => {
      const fat = buildFatura(card, cardPurchases, cardFaturas, bm);
      if (fat.total > 0) rows.push([q(`Fatura ${card.name} ${mLabel(bm)}`), q('despesa'), fat.total.toFixed(2), fmtDate(fat.dueDate), fat.paid ? 'pago' : 'a_pagar', q('cartao'), q('none'), q('')]);
    }));
  }
  return [CSV_HEADER.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export const csvFileName = (fromMk, toMk) =>
  fromMk && toMk ? `financeiro_${fromMk}_a_${toMk}.csv` : fromMk ? `financeiro_${fromMk}.csv` : 'financeiro_completo.csv';
