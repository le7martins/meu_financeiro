import { describe, test, expect } from 'vitest';
import {
  getBillingMonth, getFaturaDueDate, getFaturaCloseDate, isFaturaOpen,
  getPurchaseInstallmentsForBilling, buildFatura, getCardBillingMonths,
  countOccurrencesInMonth, getMonthEntries, collectDueAlerts, formatDueAlerts,
} from '../logic.js';

const card = { id: 'c1', name: 'Nubank', closeDay: 3, dueDay: 10, color: '#820ad1' };
const purchase = (o) => ({ id: 'p' + Math.random(), cardId: 'c1', description: 'Compra', amount: 300, purchaseDate: '2026-11-01', installments: 1, ...o });

describe('cartão: faturamento', () => {
  test('compra até o dia de fechamento entra na fatura do mês', () => {
    expect(getBillingMonth('2026-11-03', 3)).toBe('2026-11');
  });
  test('compra após o fechamento vai para o mês seguinte (inclusive virada de ano)', () => {
    expect(getBillingMonth('2026-11-04', 3)).toBe('2026-12');
    expect(getBillingMonth('2026-12-20', 3)).toBe('2027-01');
  });
  test('datas de fechamento e vencimento', () => {
    expect(getFaturaCloseDate('2026-11', 3)).toBe('2026-11-03');
    expect(getFaturaDueDate('2026-11', 10)).toBe('2026-12-10');
    expect(getFaturaDueDate('2026-01', 30)).toBe('2026-02-28');
  });
  test('isFaturaOpen depende do hoje injetado', () => {
    expect(isFaturaOpen('2026-11', 3, '2026-11-02')).toBe(true);
    expect(isFaturaOpen('2026-11', 3, '2026-11-03')).toBe(false);
  });
  test('parcelas distribuídas pelos meses de faturamento', () => {
    const p = purchase({ amount: 100, installments: 3 });
    expect(getPurchaseInstallmentsForBilling(p, '2026-11', 3)).toEqual({ installmentNum: 1, total: 3, amount: 33.34 });
    expect(getPurchaseInstallmentsForBilling(p, '2027-01', 3)).toEqual({ installmentNum: 3, total: 3, amount: 33.33 });
    expect(getPurchaseInstallmentsForBilling(p, '2027-02', 3)).toBeNull();
    expect(getPurchaseInstallmentsForBilling(p, '2026-10', 3)).toBeNull();
  });
  test('getCardBillingMonths lista todos os meses com parcelas', () => {
    const ps = [purchase({ installments: 2 }), purchase({ purchaseDate: '2026-11-10' }), purchase({ cardId: 'outro' })];
    expect(getCardBillingMonths(card, ps)).toEqual(['2026-11', '2026-12']);
  });
});

describe('buildFatura', () => {
  const ps = [purchase({ amount: 100, installments: 3 }), purchase({ amount: 50.5 })];
  test('soma itens e marca aberta/fechada pelo hoje', () => {
    const open = buildFatura(card, ps, {}, '2026-11', '2026-11-02');
    expect(open.total).toBe(83.84);
    expect(open.items).toHaveLength(2);
    expect(open.open).toBe(true);
    expect(buildFatura(card, ps, {}, '2026-11', '2026-11-03').open).toBe(false);
  });
  test('lê registro de pagamento', () => {
    const f = buildFatura(card, ps, { 'c1_2026-11': { paid: false, paidAmount: 40, partial: true } }, '2026-11', '2026-11-20');
    expect(f).toMatchObject({ key: 'c1_2026-11', paid: false, paidAmount: 40, partial: true, dueDate: '2026-12-10' });
  });
});

describe('recorrência', () => {
  test('countOccurrencesInMonth semanal: só a partir da data inicial', () => {
    // 2026-11-02 é segunda-feira; segundas em nov/2026: 2, 9, 16, 23, 30
    expect(countOccurrencesInMonth('2026-11-02', '2026-11', 7)).toBe(5);
    expect(countOccurrencesInMonth('2026-11-16', '2026-11', 7)).toBe(3);
    // dez/2026: segundas 7, 14, 21, 28
    expect(countOccurrencesInMonth('2026-11-02', '2026-12', 7)).toBe(4);
  });
  test('countOccurrencesInMonth quinzenal', () => {
    expect(countOccurrencesInMonth('2026-11-02', '2026-11', 14)).toBe(3); // 2, 16, 30
    expect(countOccurrencesInMonth('2026-11-02', '2026-12', 14)).toBe(2); // 14, 28
  });

  const entry = (o) => ({ id: 'e1', description: 'X', amount: 100, date: '2026-09-15', type: 'despesa', status: 'a_pagar', category: 'outro', recurrence: 'none', ...o });
  const month = (entries, mk) => getMonthEntries(entries, [], mk, [], [], {}, '2026-11-05');

  test('avulso aparece só no próprio mês', () => {
    expect(month([entry()], '2026-09')).toHaveLength(1);
    expect(month([entry()], '2026-10')).toHaveLength(0);
  });
  test('fixo respeita endMonth e status por mês', () => {
    const e = entry({ recurrence: 'fixed', endMonth: '2026-11', statusByMonth: { '2026-10': 'pago' } });
    expect(month([e], '2026-10')[0].statusForMonth).toBe('pago');
    expect(month([e], '2026-11')[0].statusForMonth).toBe('a_pagar');
    expect(month([e], '2026-12')).toHaveLength(0);
    expect(month([e], '2026-08')).toHaveLength(0);
  });
  test('trimestral e anual', () => {
    const q = entry({ recurrence: 'quarterly' });
    expect(['2026-09', '2026-10', '2026-11', '2026-12'].map(m => month([q], m).length)).toEqual([1, 0, 0, 1]);
    const a = entry({ recurrence: 'annual' });
    expect(month([a], '2027-09')).toHaveLength(1);
    expect(month([a], '2027-08')).toHaveLength(0);
  });
  test('parcelado: valor por parcela fecha o total', () => {
    const e = entry({ recurrence: 'installment', installments: 3 });
    const vals = ['2026-09', '2026-10', '2026-11'].map(m => month([e], m)[0].displayAmount);
    expect(vals).toEqual([33.34, 33.33, 33.33]);
    expect(month([e], '2026-12')).toHaveLength(0);
    expect(month([e], '2026-10')[0].recurLabel).toBe('2/3×');
  });
  test('semanal multiplica pelas ocorrências reais', () => {
    const e = entry({ recurrence: 'weekly', amount: 50, date: '2026-11-02' });
    expect(month([e], '2026-11')[0].displayAmount).toBe(250);
    expect(month([e], '2026-12')[0].displayAmount).toBe(200);
    expect(month([e], '2026-11')[0].amount).toBe(50);
  });
  test('override do mês altera valor; statusByMonth vence o status do override', () => {
    const e = entry({ recurrence: 'fixed', overrides: { '2026-10': { amount: 80, status: 'a_pagar', description: 'Y' } }, statusByMonth: { '2026-10': 'pago' } });
    const [it] = month([e], '2026-10');
    expect(it).toMatchObject({ displayAmount: 80, statusForMonth: 'pago', description: 'Y' });
  });
  test('exclusão: só este mês e daqui pra frente', () => {
    const e = entry({ recurrence: 'fixed', deletedMonths: ['2026-10'], deletedFrom: '2026-12' });
    expect(['2026-09', '2026-10', '2026-11', '2026-12'].map(m => month([e], m).length)).toEqual([1, 0, 1, 0]);
  });
});

describe('getMonthEntries: dívidas e faturas', () => {
  test('dívida gera parcela com vencimento limitado ao fim do mês', () => {
    const d = { id: 'd1', name: 'Empréstimo', totalAmount: 1000, installments: 3, startMonth: '2026-01', dueDay: 31, paidMonths: ['2026-01'] };
    const jan = getMonthEntries([], [d], '2026-01', [], [], {}, '2026-11-05')[0];
    const feb = getMonthEntries([], [d], '2026-02', [], [], {}, '2026-11-05')[0];
    expect(jan).toMatchObject({ isDivida: true, statusForMonth: 'pago', displayAmount: 333.34 });
    expect(feb).toMatchObject({ statusForMonth: 'a_pagar', displayAmount: 333.33, date: '2026-02-28' });
  });
  test('fatura conta no mês do vencimento, não no do fechamento', () => {
    const ps = [purchase({ amount: 200 })];
    // fatura de nov fecha 03/11 e vence 10/12: só aparece em dezembro, com a data de vencimento
    expect(getMonthEntries([], [], '2026-11', [card], ps, {}, '2026-11-02')).toHaveLength(0);
    const [f] = getMonthEntries([], [], '2026-12', [card], ps, {}, '2026-11-02');
    expect(f).toMatchObject({ isFatura: true, isOpenFatura: true, date: '2026-12-10', closeDate: '2026-11-03', displayAmount: 200, description: 'Fatura Nubank — Nov 2026' });
  });
  test('fatura fechada com pagamento parcial mostra o restante', () => {
    const ps = [purchase({ amount: 200 })];
    const [f] = getMonthEntries([], [], '2026-12', [card], ps, { 'c1_2026-11': { paid: false, paidAmount: 50, partial: true } }, '2026-11-05');
    expect(f).toMatchObject({ isOpenFatura: false, date: '2026-12-10', amount: 200, displayAmount: 150, statusForMonth: 'a_pagar' });
    expect(getMonthEntries([], [], '2026-11', [card], ps, {}, '2026-11-05')).toHaveLength(0);
  });
  test('fatura paga aparece como paga no mês do vencimento', () => {
    const ps = [purchase({ amount: 200 })];
    const [f] = getMonthEntries([], [], '2026-12', [card], ps, { 'c1_2026-11': { paid: true, paidAmount: 200 } }, '2026-12-11');
    expect(f).toMatchObject({ statusForMonth: 'pago', displayAmount: 200 });
  });
});

describe('alertas de vencimento', () => {
  const today = '2026-11-05';
  const base = { dividas: [], cards: [], cardPurchases: [], cardFaturas: {} };
  const e = (o) => ({ id: Math.random() + '', description: 'Conta', amount: 10, type: 'despesa', status: 'a_pagar', category: 'outro', recurrence: 'none', ...o });

  test('classifica vencidos, hoje, em breve e recebimentos', () => {
    const entries = [
      e({ description: 'Luz', date: '2026-11-01' }),
      e({ description: 'Água', date: '2026-11-05' }),
      e({ description: 'Net', date: '2026-11-07' }),
      e({ description: 'Longe', date: '2026-11-20' }),
      e({ description: 'Pago', date: '2026-11-05', status: 'pago' }),
      e({ description: 'Salário', date: '2026-11-06', type: 'receita' }),
    ];
    const a = collectDueAlerts({ ...base, entries }, { daysBefore: 3 }, today);
    expect(a.overdue.map(x => x.description)).toEqual(['Luz']);
    expect(a.dueToday.map(x => x.description)).toEqual(['Água']);
    expect(a.dueSoon.map(x => x.description)).toEqual(['Net']);
    expect(a.incSoon.map(x => x.description)).toEqual(['Salário']);
  });
  test('fixo recorrente gera alerta no mês atual, respeitando opções desligadas', () => {
    const entries = [e({ description: 'Aluguel', date: '2026-01-05', recurrence: 'fixed' })];
    const a = collectDueAlerts({ ...base, entries }, { daysBefore: 3, overdueAlert: false, incomeAlert: false }, today);
    expect(a.dueToday.map(x => x.description)).toEqual(['Aluguel']);
    // mês anterior (outubro) pendente seria vencido, mas overdueAlert está desligado
    expect(a.overdue).toEqual([]);
  });
  test('fatura fechada e não paga alerta pelo vencimento; aberta não alerta', () => {
    const cardPurchases = [purchase({ purchaseDate: '2026-10-01' }), purchase({ purchaseDate: '2026-11-04' })];
    const a = collectDueAlerts({ ...base, entries: [], cards: [{ ...card, dueDay: 7 }], cardPurchases }, { daysBefore: 3 }, today);
    // fatura de out/2026 vence 07/11; fatura de dez (aberta) não aparece
    expect(a.dueSoon.map(x => x.description)).toEqual(['Fatura Nubank — Out 2026']);
  });
  test('formatDueAlerts gera títulos no singular/plural', () => {
    const msgs = formatDueAlerts({ overdue: [{ description: 'A', days: -2 }], dueToday: [{ description: 'B' }, { description: 'C' }], dueSoon: [], incToday: [], incSoon: [] });
    expect(msgs).toEqual([
      { tag: 'mf-overdue', title: '⚠️ 1 conta vencida', body: 'A (2d atraso)' },
      { tag: 'mf-today', title: '🔴 2 contas vencem hoje', body: 'B, C' },
    ]);
  });
});
