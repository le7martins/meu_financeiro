// Transformações puras dos dados do usuário (sem React/Firebase).
// Cada função recebe o estado atual e devolve o novo — quem chama persiste.
import { todayISO, newId, fmtDate, mLabel, eVal, addM, mDiff, dateInMonth, parseISODate, installmentAmount } from './utils.js';
import { getMonthEntries, getCardBillingMonths, buildFatura, countOccurrencesInMonth } from './logic.js';

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

const round2 = (v) => Math.round(v * 100) / 100;

// Valor do lançamento no mês `mk` sem override (o que a lista mostra por padrão).
function monthBaseAmount(e, mk) {
  if (e.recurrence === 'installment') return installmentAmount(e.amount, e.installments, mDiff(e.date.substring(0, 7), mk) + 1);
  if (e.recurrence === 'weekly' || e.recurrence === 'biweekly') return round2(e.amount * (countOccurrencesInMonth(e.date, mk, e.recurrence === 'weekly' ? 7 : 14) || 1));
  return e.amount;
}

// Converte o valor digitado no modal (valor do mês) para o valor guardado na regra base.
function baseFromTyped(e, typed, mk) {
  if (e.recurrence === 'installment') return round2(typed * e.installments);
  if (e.recurrence === 'weekly' || e.recurrence === 'biweekly') return round2(typed / (countOccurrencesInMonth(e.date, mk, e.recurrence === 'weekly' ? 7 : 14) || 1));
  return typed;
}

// Primeira ocorrência semanal/quinzenal em ou depois de `onISO`, mantendo o ritmo da regra original.
function firstOccurrenceOnOrAfter(startDate, stepDays, onISO) {
  const d0 = parseISODate(startDate);
  const days = Math.round((parseISODate(onISO) - d0) / 86400000);
  const k = Math.max(0, Math.ceil(days / stepDays));
  return todayISO(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + k * stepDays));
}

const onlyFrom = (obj, mk) => Object.fromEntries(Object.entries(obj || {}).filter(([m]) => m >= mk));
const onlyBefore = (obj, mk) => Object.fromEntries(Object.entries(obj || {}).filter(([m]) => m < mk));

// scope: "this" (só o mês) | "future" (este mês em diante). Avulsos sempre alteram o próprio lançamento.
// "future" nunca reescreve meses anteriores: a regra é dividida em duas (a antiga termina no mês anterior).
export function applyEntryEdit(entries, entryId, changes, scope, monthKey) {
  return entries.flatMap(e => {
    if (e.id !== entryId) return [e];
    if (changes._resetAmount) {
      // Restaura o valor original: remove "amount" do override do mês
      const ov = e.overrides?.[monthKey];
      if (!ov) return [e];
      const { amount: _, ...rest } = ov;
      const overrides = { ...e.overrides };
      if (Object.keys(rest).length > 0) overrides[monthKey] = rest; else delete overrides[monthKey];
      return [{ ...e, overrides }];
    }
    const { amount: typed, ...others } = changes;
    if (e.recurrence === 'none') return [{ ...e, ...others, ...(typed !== undefined ? { amount: typed } : {}) }];

    // O valor digitado só vale se mudou — senão a edição "congelaria" o valor do mês no override.
    const amtChanged = typed !== undefined && Math.abs(typed - monthBaseAmount(e, monthKey)) > 0.004;
    const base = e.date.substring(0, 7);

    if (scope !== 'future') {
      return [{ ...e, overrides: { ...e.overrides, [monthKey]: { ...others, ...(amtChanged ? { amount: typed } : {}) } } }];
    }
    // Primeira ocorrência (ou anterior): editar a própria regra
    if (monthKey <= base) return [{ ...e, ...others, amount: amtChanged ? baseFromTyped(e, typed, monthKey) : e.amount }];

    if (e.recurrence === 'installment') {
      // Parcelas restantes: um override por mês (as parcelas já passadas não mudam)
      const { status, ...common } = others;
      const overrides = { ...e.overrides };
      for (let i = mDiff(base, monthKey); i < e.installments; i++) {
        const m = addM(base, i);
        overrides[m] = { ...(overrides[m] || {}), ...common, ...(amtChanged ? { amount: typed } : {}), ...(m === monthKey && status !== undefined ? { status } : {}) };
      }
      return [{ ...e, overrides }];
    }

    // Demais recorrências: a regra antiga termina no mês anterior e uma nova começa neste mês
    const day = e.date.split('-')[2];
    const step = e.recurrence === 'weekly' ? 7 : e.recurrence === 'biweekly' ? 14 : 0;
    const startDate = step ? firstOccurrenceOnOrAfter(e.date, step, `${monthKey}-01`) : dateInMonth(monthKey, day);
    const { status, ...rest } = others;
    const ended = { ...e, endMonth: addM(monthKey, -1), statusByMonth: onlyBefore(e.statusByMonth, monthKey), paidDateByMonth: onlyBefore(e.paidDateByMonth, monthKey), overrides: onlyBefore(e.overrides, monthKey) };
    const statusByMonth = { ...onlyFrom(e.statusByMonth, monthKey), ...(status !== undefined ? { [monthKey]: status } : {}) };
    const next = {
      ...e, ...rest, id: newId(), date: startDate,
      amount: amtChanged ? baseFromTyped(e, typed, monthKey) : e.amount,
      statusByMonth, paidDateByMonth: onlyFrom(e.paidDateByMonth, monthKey), overrides: onlyFrom(e.overrides, monthKey),
      deletedMonths: (e.deletedMonths || []).filter(m => m >= monthKey),
    };
    if (e.endMonth && e.endMonth < monthKey) return [e]; // regra já encerrada antes deste mês: nada a dividir
    return [ended, next];
  });
}

// scope: "all" (apaga) | "this" (só o mês) | qualquer outro (deste mês em diante)
export function deleteEntry(entries, entryId, scope, monthKey) {
  if (scope === 'all') return entries.filter(e => e.id !== entryId);
  if (scope === 'this') return entries.map(e => e.id !== entryId ? e : { ...e, deletedMonths: [...(e.deletedMonths || []), monthKey] });
  return entries.map(e => e.id !== entryId ? e : { ...e, deletedFrom: monthKey });
}

// Registra um pagamento de fatura. Os pagamentos se acumulam e nunca passam do que falta pagar.
// item = { faturaKey, amount (total da fatura) }; partial=false paga todo o restante.
export function payFatura(cardFaturas, item, amount, partial, today = todayISO()) {
  const cur = cardFaturas[item.faturaKey] || {};
  const already = cur.paidAmount || 0;
  const remaining = Math.max(0, round2(item.amount - already));
  const pay = partial ? Math.min(Math.max(0, Number(amount) || 0), remaining) : remaining;
  if (pay <= 0) return { cardFaturas, fullyPaid: false, noop: true };
  const totalPaid = round2(already + pay);
  const fullyPaid = totalPaid >= item.amount - 0.004;
  return {
    cardFaturas: { ...cardFaturas, [item.faturaKey]: { ...cur, paid: fullyPaid, paidAmount: fullyPaid ? item.amount : totalPaid, paidDate: today, partial: !fullyPaid } },
    fullyPaid,
  };
}

export function revertFatura(cardFaturas, faturaKey) {
  const next = { ...cardFaturas };
  delete next[faturaKey];
  return next;
}

// ─── Novo lançamento ─────────────────────────────────────────
// Erros por campo do formulário de novo lançamento (vazio = válido).
export function formErrors(form) {
  const err = {};
  if (!form.description.trim()) err.description = 'Informe a descrição';
  if (!(parseFloat(form.amount) > 0)) err.amount = 'Informe um valor maior que zero';
  if (!form.date) err.date = 'Informe a data';
  if (form.recurrence === 'installment') {
    const n = parseInt(form.installments);
    if (!(n >= 2 && n <= 60)) err.installments = 'Parcelas: de 2 a 60';
  }
  if (form.endMonth && form.date && form.endMonth < form.date.substring(0, 7)) err.endMonth = 'O fim não pode ser antes do início';
  return err;
}
export const isFormValid = (form) => Object.keys(formErrors(form)).length === 0;

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
    purchaseDate: form.date, category: form.category, notes: form.notes || '',
    installments: form.recurrence === 'installment' ? Math.min(48, Math.max(1, parseInt(form.installments) || 1)) : 1,
  };
}

// ─── Backup (JSON) ───────────────────────────────────────────
export const BACKUP_KEYS = ['entries', 'dividas', 'cards', 'cardPurchases', 'cardFaturas', 'categories', 'accounts', 'goals', 'budgets', 'notifSettings'];

export function buildBackup(data, now = new Date()) {
  return { version: 2, exportedAt: now.toISOString(), ...Object.fromEntries(BACKUP_KEYS.filter(k => data[k] !== undefined).map(k => [k, data[k]])) };
}

const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isNum = (v) => v !== '' && v !== null && Number.isFinite(Number(v));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const CHECKS = {
  entries:       ['lançamento', (x) => x.id != null && typeof x.description === 'string' && ['receita', 'despesa'].includes(x.type) && isISODate(x.date) && isNum(x.amount)],
  dividas:       ['dívida', (x) => x.id != null && typeof x.name === 'string' && isNum(x.totalAmount) && Number.isInteger(Number(x.installments)) && Number(x.installments) >= 1],
  cards:         ['cartão', (x) => x.id != null && typeof x.name === 'string' && Number(x.closeDay) >= 1 && Number(x.closeDay) <= 31 && Number(x.dueDay) >= 1 && Number(x.dueDay) <= 31],
  cardPurchases: ['compra no cartão', (x) => x.id != null && x.cardId != null && isNum(x.amount) && isISODate(x.purchaseDate)],
  categories:    ['categoria', (x) => x.id != null && typeof x.name === 'string'],
  accounts:      ['conta', (x) => x.id != null && typeof x.name === 'string'],
};

// Valida o arquivo ANTES de tocar nos dados. Devolve { ok, error } ou { ok, counts }.
export function validateBackup(data) {
  if (!isObj(data) || !data.version) return { ok: false, error: 'Arquivo de backup inválido' };
  if (!Array.isArray(data.entries)) return { ok: false, error: 'O backup não tem a lista de lançamentos' };
  const counts = {};
  for (const [key, [label, check]] of Object.entries(CHECKS)) {
    const list = data[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return { ok: false, error: `Backup corrompido: "${key}" deveria ser uma lista` };
    const i = list.findIndex(x => !isObj(x) || !check(x));
    if (i >= 0) return { ok: false, error: `Backup corrompido: ${label} ${i + 1} está incompleto` };
    counts[key] = list.length;
  }
  for (const key of ['cardFaturas', 'goals', 'budgets', 'notifSettings']) {
    if (data[key] !== undefined && !isObj(data[key])) return { ok: false, error: `Backup corrompido: "${key}" inválido` };
  }
  return { ok: true, counts };
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
