import { describe, test, expect } from 'vitest';
import {
  toggleEntryStatus, toggleDividaMonth, applyEntryEdit, deleteEntry, payFatura, revertFatura,
  findDuplicate, entryFromForm, cardPurchaseFromForm, buildCsv, csvFileName, isFormValid, formErrors, buildBackup, validateBackup,
} from '../entryActions.js';
import { getMonthEntries, debtStats, cardUsedLimit } from '../logic.js';

const base = (o) => ({ id: 'e1', description: 'Luz', amount: 100, date: '2026-10-10', type: 'despesa', status: 'a_pagar', category: 'outro', recurrence: 'none', ...o });
const itemFor = (entries, mk) => getMonthEntries(entries, [], mk, [], [], {}, '2026-11-05')[0];

describe('toggleEntryStatus', () => {
  test('avulso: alterna status e data de pagamento', () => {
    const entries = [base()];
    const r = toggleEntryStatus(entries, itemFor(entries, '2026-10'), '2026-10', '2026-11-05');
    expect(r.status).toBe('pago');
    expect(r.entries[0]).toMatchObject({ status: 'pago', paidDate: '2026-11-05' });
    const back = toggleEntryStatus(r.entries, itemFor(r.entries, '2026-10'), '2026-10', '2026-11-05');
    expect(back.entries[0]).toMatchObject({ status: 'a_pagar', paidDate: null });
  });
  test('recorrente: status só no mês, refletido mesmo com override existente', () => {
    const entries = [base({ recurrence: 'fixed', overrides: { '2026-11': { amount: 80 } } })];
    const r = toggleEntryStatus(entries, itemFor(entries, '2026-11'), '2026-11', '2026-11-05');
    expect(itemFor(r.entries, '2026-11')).toMatchObject({ statusForMonth: 'pago', displayAmount: 80 });
    expect(itemFor(r.entries, '2026-12').statusForMonth).toBe('a_pagar');
    expect(r.entries[0].paidDateByMonth['2026-11']).toBe('2026-11-05');
  });
});

test('toggleDividaMonth sinaliza quitação só ao pagar a última', () => {
  const d = [{ id: 'd1', installments: 2, paidMonths: ['2026-10'] }];
  const r = toggleDividaMonth(d, 'd1', '2026-11');
  expect(r).toEqual({ dividas: [{ id: 'd1', installments: 2, paidMonths: ['2026-10', '2026-11'] }], quitada: true });
  expect(toggleDividaMonth(r.dividas, 'd1', '2026-11')).toMatchObject({ quitada: false, dividas: [{ paidMonths: ['2026-10'] }] });
});

describe('applyEntryEdit', () => {
  test('"só este mês" grava override só se o valor mudou', () => {
    const entries = [base({ recurrence: 'fixed' })];
    expect(applyEntryEdit(entries, 'e1', { amount: 90 }, 'this', '2026-11')[0].overrides).toEqual({ '2026-11': { amount: 90 } });
    // mesmo valor do mês: não "congela" o valor no override
    expect(applyEntryEdit(entries, 'e1', { amount: 100, description: 'Luz 2' }, 'this', '2026-11')[0].overrides).toEqual({ '2026-11': { description: 'Luz 2' } });
  });
  test('"este e próximos" divide a regra e NÃO reescreve os meses anteriores', () => {
    const entries = [base({ recurrence: 'fixed', amount: 55.9, date: '2026-10-05' })];
    const r = applyEntryEdit(entries, 'e1', { amount: 50 }, 'future', '2026-11');
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ id: 'e1', endMonth: '2026-10', amount: 55.9 });
    expect(r[1]).toMatchObject({ amount: 50, date: '2026-11-05' });
    expect(r[1].id).not.toBe('e1');
    const val = (mk) => getMonthEntries(r, [], mk, [], [], {}, '2026-11-05').map(e => e.displayAmount ?? e.amount);
    expect(val('2026-09')).toEqual([]);
    expect(val('2026-10')).toEqual([55.9]);
    expect(val('2026-11')).toEqual([50]);
    expect(val('2027-03')).toEqual([50]);
  });
  test('"este e próximos" na primeira ocorrência edita a própria regra', () => {
    const entries = [base({ recurrence: 'fixed' })];
    const r = applyEntryEdit(entries, 'e1', { amount: 90 }, 'future', '2026-10');
    expect(r).toHaveLength(1);
    expect(r[0].amount).toBe(90);
  });
  test('divisão preserva status e overrides dos meses seguintes e dos anteriores', () => {
    const entries = [base({ recurrence: 'fixed', statusByMonth: { '2026-10': 'pago', '2026-12': 'pago' }, overrides: { '2026-12': { amount: 7 } }, endMonth: '2027-06' })];
    const [ended, next] = applyEntryEdit(entries, 'e1', { amount: 90, status: 'a_pagar' }, 'future', '2026-11');
    expect(ended.statusByMonth).toEqual({ '2026-10': 'pago' });
    expect(next.statusByMonth).toEqual({ '2026-12': 'pago', '2026-11': 'a_pagar' });
    expect(next.overrides).toEqual({ '2026-12': { amount: 7 } });
    expect(next.endMonth).toBe('2027-06');
  });
  test('semanal: a nova regra mantém o ritmo semanal', () => {
    const entries = [base({ recurrence: 'weekly', amount: 50, date: '2026-10-05' })]; // segundas-feiras
    const [, next] = applyEntryEdit(entries, 'e1', { amount: 60 }, 'future', '2026-11');
    expect(next.date).toBe('2026-11-02'); // próxima segunda em/depois de 01/11
  });
  test('parcelado: valor editado é da parcela, base guarda o total (primeira parcela)', () => {
    const entries = [base({ recurrence: 'installment', installments: 3 })]; // 100 em 3x, início 2026-10
    expect(applyEntryEdit(entries, 'e1', { amount: 40 }, 'future', '2026-10')[0].amount).toBe(120);
  });
  test('parcelado: "este e próximos" só altera as parcelas restantes', () => {
    const entries = [base({ recurrence: 'installment', installments: 3 })];
    const r = applyEntryEdit(entries, 'e1', { amount: 30 }, 'future', '2026-11');
    expect(r).toHaveLength(1);
    const val = (mk) => getMonthEntries(r, [], mk, [], [], {}, '2026-11-05')[0].displayAmount;
    expect(val('2026-10')).toBe(33.34);
    expect(val('2026-11')).toBe(30);
    expect(val('2026-12')).toBe(30);
  });
  test('_resetAmount remove só o valor do override', () => {
    const entries = [base({ recurrence: 'fixed', overrides: { '2026-11': { amount: 90, description: 'X' }, '2026-12': { amount: 1 } } })];
    const r = applyEntryEdit(entries, 'e1', { _resetAmount: true }, 'this', '2026-11');
    expect(r[0].overrides).toEqual({ '2026-11': { description: 'X' }, '2026-12': { amount: 1 } });
    const r2 = applyEntryEdit(entries, 'e1', { _resetAmount: true }, 'this', '2026-12');
    expect(r2[0].overrides).toEqual({ '2026-11': { amount: 90, description: 'X' } });
  });
});

test('deleteEntry: tudo, só o mês, daqui pra frente', () => {
  const entries = [base({ recurrence: 'fixed' }), base({ id: 'e2' })];
  expect(deleteEntry(entries, 'e1', 'all', '2026-11').map(e => e.id)).toEqual(['e2']);
  expect(deleteEntry(entries, 'e1', 'this', '2026-11')[0].deletedMonths).toEqual(['2026-11']);
  expect(deleteEntry(entries, 'e1', 'future', '2026-11')[0].deletedFrom).toBe('2026-11');
});

describe('fatura', () => {
  const item = { faturaKey: 'c1_2026-10', amount: 200 };
  test('pagamento integral e parcial', () => {
    expect(payFatura({}, item, 200, false, '2026-11-05')).toEqual({ fullyPaid: true, cardFaturas: { 'c1_2026-10': { paid: true, paidAmount: 200, paidDate: '2026-11-05', partial: false } } });
    expect(payFatura({}, item, 50, true, '2026-11-05').cardFaturas['c1_2026-10']).toMatchObject({ paid: false, partial: true, paidAmount: 50 });
    expect(payFatura({}, item, 250, true, '2026-11-05').fullyPaid).toBe(true);
  });
  test('pagamentos parciais se acumulam e nunca passam do restante', () => {
    const r1 = payFatura({}, item, 100, true, '2026-11-05');
    const r2 = payFatura(r1.cardFaturas, item, 60, true, '2026-11-06');
    expect(r2.cardFaturas['c1_2026-10']).toMatchObject({ paid: false, partial: true, paidAmount: 160 });
    const r3 = payFatura(r2.cardFaturas, item, 9999, true, '2026-11-07');
    expect(r3.fullyPaid).toBe(true);
    expect(r3.cardFaturas['c1_2026-10']).toMatchObject({ paid: true, partial: false, paidAmount: 200 });
  });
  test('pagar o total depois de um parcial paga só o restante; valor zero é ignorado', () => {
    const r1 = payFatura({}, item, 50, true, '2026-11-05');
    expect(payFatura(r1.cardFaturas, item, 0, false, '2026-11-06').cardFaturas['c1_2026-10']).toMatchObject({ paid: true, paidAmount: 200 });
    const noop = payFatura({}, item, 0, true, '2026-11-05');
    expect(noop).toMatchObject({ noop: true, fullyPaid: false, cardFaturas: {} });
  });
  test('estorno remove o registro', () => {
    expect(revertFatura({ a: 1, b: 2 }, 'a')).toEqual({ b: 2 });
  });
});

describe('novo lançamento', () => {
  const form = { description: '  Mercado ', amount: '50.5', date: '2026-11-05', type: 'despesa', status: 'a_pagar', category: 'outro', recurrence: 'installment', installments: '3', notes: '', endMonth: '' };
  test('validação e montagem', () => {
    expect(isFormValid(form)).toBe(true);
    expect(isFormValid({ ...form, description: ' ' })).toBe(false);
    const e = entryFromForm(form);
    expect(e).toMatchObject({ description: 'Mercado', amount: 50.5, installments: 3, statusByMonth: {}, overrides: {} });
    expect(e).not.toHaveProperty('endMonth');
    expect(e).not.toHaveProperty('tags');
    expect(entryFromForm({ ...form, tags: ['mercado'], accountId: 'a1' })).toMatchObject({ tags: ['mercado'], accountId: 'a1' });
    expect(cardPurchaseFromForm(form, 'c1')).toMatchObject({ cardId: 'c1', purchaseDate: '2026-11-05', installments: 3, amount: 50.5 });
    expect(cardPurchaseFromForm({ ...form, recurrence: 'none' }, 'c1').installments).toBe(1);
  });
  test('duplicado: mesma descrição (sem caixa), valor, data e tipo', () => {
    const entries = [base({ description: 'mercado', amount: 50.5, date: '2026-11-05' })];
    expect(findDuplicate(entries, form)?.id).toBe('e1');
    expect(findDuplicate(entries, { ...form, type: 'receita' })).toBeNull();
  });
});

describe('CSV', () => {
  const data = { entries: [base({ description: 'Conta "especial", luz', date: '2026-11-10' })], dividas: [], cards: [], cardPurchases: [], cardFaturas: {}, categories: [{ id: 'outro', name: 'Outros' }] };
  test('formato Excel pt-BR: ";" como separador e vírgula decimal; escapa aspas', () => {
    const csv = buildCsv(data, '2026-11');
    expect(csv.split('\n')[0]).toBe('Descrição;Tipo;Valor;Vencimento;Status;Categoria;Recorrência;Notas');
    expect(csv.split('\n')[1]).toBe('"Conta ""especial"", luz";despesa;100,00;10/11/2026;a_pagar;"Outros";none;""');
  });
  test('descrição que parece fórmula é neutralizada', () => {
    const d = { ...data, entries: [base({ description: '=HYPERLINK("x")', date: '2026-11-10' }), base({ id: 'e2', description: '-cmd', date: '2026-11-10' })] };
    const lines = buildCsv(d, '2026-11').split('\n');
    expect(lines[1].startsWith(`"'=HYPERLINK(""x"")";`)).toBe(true);
    expect(lines[2].startsWith(`"'-cmd";`)).toBe(true);
  });
  test('exportar tudo: dívida com valor, data de vencimento e status reais; fatura pelo vencimento', () => {
    const full = { ...data, entries: [], dividas: [{ id: 'd1', name: 'Carro', totalAmount: 1000, installments: 4, startMonth: '2026-10', dueDay: '15', paidMonths: ['2026-10', '2026-11', '2026-12', '2027-01'], category: 'outro' }],
      cards: [{ id: 'c1', name: 'Nubank', closeDay: 3, dueDay: 10 }], cardPurchases: [{ id: 'p', cardId: 'c1', amount: 250.5, installments: 1, purchaseDate: '2026-10-01' }], cardFaturas: {} };
    const lines = buildCsv(full, null).split('\n');
    expect(lines[1]).toBe('"Carro (dívida)";despesa;250,00;15/10/2026;pago;"Outros";4x;""');
    expect(lines[2]).toBe('"Fatura Nubank Out 2026";despesa;250,50;10/10/2026;a_pagar;"cartao";none;""');
  });
  test('intervalo percorre os meses', () => {
    const fixed = { ...data, entries: [base({ recurrence: 'fixed' })] };
    expect(buildCsv(fixed, '2026-10', '2026-12').split('\n')).toHaveLength(4);
  });
  test('nome do arquivo', () => {
    expect(csvFileName('2026-10', '2026-12')).toBe('financeiro_2026-10_a_2026-12.csv');
    expect(csvFileName(null)).toBe('financeiro_completo.csv');
  });
});

describe('editar semanal/quinzenal não multiplica o valor base', () => {
  test('salvar sem mudar o valor mantém a base (quinzenal)', () => {
    const entries = [base({ recurrence: 'biweekly', amount: 100, date: '2026-11-02' })];
    const item = itemFor(entries, '2026-11');
    const next = applyEntryEdit(entries, 'e1', { description: 'Academia', amount: item.displayAmount }, 'future', '2026-11');
    expect(next[0].amount).toBe(100);
    expect(itemFor(next, '2026-11').displayAmount).toBe(item.displayAmount);
  });
  test('alterar o total do mês recalcula o valor por ocorrência (semanal, 5x)', () => {
    const entries = [base({ recurrence: 'weekly', amount: 50, date: '2026-11-02' })];
    const next = applyEntryEdit(entries, 'e1', { amount: 300 }, 'future', '2026-11');
    expect(next[0].amount).toBe(60);
  });
});

describe('formErrors', () => {
  const ok = { description: 'Luz', amount: '10', date: '2026-11-05', recurrence: 'none', installments: 2, endMonth: '' };
  test('valor precisa ser positivo; parcelas de 2 a 60; fim depois do início', () => {
    expect(formErrors(ok)).toEqual({});
    expect(formErrors({ ...ok, amount: '0' })).toHaveProperty('amount');
    expect(formErrors({ ...ok, amount: '-5' })).toHaveProperty('amount');
    expect(formErrors({ ...ok, recurrence: 'installment', installments: '' })).toHaveProperty('installments');
    expect(formErrors({ ...ok, recurrence: 'installment', installments: 61 })).toHaveProperty('installments');
    expect(formErrors({ ...ok, recurrence: 'installment', installments: 12 })).toEqual({});
    expect(formErrors({ ...ok, recurrence: 'fixed', endMonth: '2026-10' })).toHaveProperty('endMonth');
  });
});

describe('backup', () => {
  const entry = { id: 'e1', description: 'Luz', type: 'despesa', date: '2026-11-05', amount: 10 };
  test('versão 2 inclui contas, metas e orçamentos', () => {
    const b = buildBackup({ entries: [entry], accounts: [{ id: 'a', name: 'X' }], goals: { monthly: 1 }, budgets: { moradia: 5 } }, new Date('2026-11-05T10:00:00Z'));
    expect(b).toMatchObject({ version: 2, exportedAt: '2026-11-05T10:00:00.000Z', accounts: [{ id: 'a' }], goals: { monthly: 1 }, budgets: { moradia: 5 } });
    expect(validateBackup(b)).toMatchObject({ ok: true, counts: { entries: 1, accounts: 1 } });
  });
  test('aceita backup antigo (versão 1)', () => {
    expect(validateBackup({ version: 1, entries: [entry], dividas: [], cards: [] }).ok).toBe(true);
  });
  test('rejeita arquivo malformado sem tocar nos dados', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ entries: [] }).ok).toBe(false);
    expect(validateBackup({ version: 1, entries: [{ foo: 1 }] })).toMatchObject({ ok: false });
    expect(validateBackup({ version: 1, entries: [{ ...entry, date: '05/11/2026' }] }).ok).toBe(false);
    expect(validateBackup({ version: 1, entries: [entry], dividas: [{ id: 'd', name: 'x', totalAmount: 10 }] }).ok).toBe(false);
    expect(validateBackup({ version: 1, entries: [entry], cards: 'oops' }).ok).toBe(false);
    expect(validateBackup({ version: 1, entries: [entry], cardFaturas: [] }).ok).toBe(false);
  });
});

describe('debtStats', () => {
  const d = { id: 'd1', name: 'X', totalAmount: 100, installments: 3, startMonth: '2026-01', paidMonths: [] };
  test('restante usa os valores reais das parcelas (resíduo na primeira)', () => {
    expect(debtStats({ ...d, paidMonths: ['2026-01'] })).toMatchObject({ paid: 1, remaining: 66.66, pct: 33 });
    expect(debtStats({ ...d, paidMonths: ['2026-02'] }).remaining).toBe(66.67);
    expect(debtStats({ ...d, paidMonths: ['2026-01', '2026-02', '2026-03'] })).toMatchObject({ quitada: true, remaining: 0 });
  });
  test('meses pagos fora do período não contam', () => {
    expect(debtStats({ ...d, paidMonths: ['2025-12', '2026-04', '2026-01'] }).paid).toBe(1);
  });
  test('parcelas inválidas viram 1 em vez de NaN', () => {
    expect(debtStats({ ...d, installments: '' }).n).toBe(1);
  });
});

describe('cardUsedLimit', () => {
  const card = { id: 'c1', name: 'N', closeDay: 3, dueDay: 10 };
  const purchases = [{ id: 'p', cardId: 'c1', amount: 300, installments: 3, purchaseDate: '2026-09-01' }]; // faturas set/out/nov de 100
  test('conta todas as faturas não pagas, inclusive vencidas, e abate pagamento parcial', () => {
    expect(cardUsedLimit(card, purchases, {}, '2026-11-05')).toBe(300);
    expect(cardUsedLimit(card, purchases, { 'c1_2026-09': { paid: true, paidAmount: 100 } }, '2026-11-05')).toBe(200);
    expect(cardUsedLimit(card, purchases, { 'c1_2026-10': { paid: false, partial: true, paidAmount: 40 } }, '2026-11-05')).toBe(260);
  });
});
