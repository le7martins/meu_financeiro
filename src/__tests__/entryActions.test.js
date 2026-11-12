import { describe, test, expect } from 'vitest';
import {
  toggleEntryStatus, toggleDividaMonth, applyEntryEdit, deleteEntry, payFatura, revertFatura,
  findDuplicate, entryFromForm, cardPurchaseFromForm, buildCsv, csvFileName, isFormValid,
} from '../entryActions.js';
import { getMonthEntries } from '../logic.js';

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
  test('"só este mês" grava override; "daqui pra frente" altera a base', () => {
    const entries = [base({ recurrence: 'fixed' })];
    expect(applyEntryEdit(entries, 'e1', { amount: 90 }, 'this', '2026-11')[0].overrides).toEqual({ '2026-11': { amount: 90 } });
    expect(applyEntryEdit(entries, 'e1', { amount: 90 }, 'future', '2026-11')[0].amount).toBe(90);
  });
  test('parcelado: valor editado é da parcela, base guarda o total', () => {
    const entries = [base({ recurrence: 'installment', installments: 3 })];
    expect(applyEntryEdit(entries, 'e1', { amount: 33.33 }, 'future', '2026-11')[0].amount).toBe(99.99);
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
    expect(cardPurchaseFromForm(form, 'c1')).toMatchObject({ cardId: 'c1', purchaseDate: '2026-11-05', installments: 1, amount: 50.5 });
  });
  test('duplicado: mesma descrição (sem caixa), valor, data e tipo', () => {
    const entries = [base({ description: 'mercado', amount: 50.5, date: '2026-11-05' })];
    expect(findDuplicate(entries, form)?.id).toBe('e1');
    expect(findDuplicate(entries, { ...form, type: 'receita' })).toBeNull();
  });
});

describe('CSV', () => {
  const data = { entries: [base({ description: 'Conta "especial", luz', date: '2026-11-10' })], dividas: [], cards: [], cardPurchases: [], cardFaturas: {}, categories: [{ id: 'outro', name: 'Outros' }] };
  test('escapa aspas e vírgulas da descrição', () => {
    const csv = buildCsv(data, '2026-11');
    expect(csv.split('\n')[1]).toBe('"Conta ""especial"", luz",despesa,100.00,10/11/2026,a_pagar,"Outros",none,""');
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
