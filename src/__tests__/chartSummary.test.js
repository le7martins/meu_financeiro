import { describe, test, expect } from 'vitest';
import { makeSummary, sumMonths, categoryRanking, cardStats } from '../screens/chart/summary.js';
import { topWithOthers } from '../screens/chart/relatorioCanvas.js';
import { getMonthEntries, accumulatedBalance } from '../logic.js';

const card = { id: 'c1', name: 'Nubank', closeDay: 3, dueDay: 10, color: '#820ad1' };
const e = (o) => ({ id: 'e' + Math.random(), description: 'X', type: 'despesa', amount: 100, date: '2026-11-05', category: 'moradia', recurrence: 'none', status: 'a_pagar', statusByMonth: {}, overrides: {}, ...o });
const purchases = [{ id: 'p1', cardId: 'c1', description: 'Notebook', amount: 300, installments: 3, purchaseDate: '2026-10-01', category: 'lazer' }]; // faturas out/nov/dez de 100
const ctx = (o = {}) => ({ entries: [], dividas: [], cards: [card], cardPurchases: purchases, cardFaturas: {}, today: '2026-11-12', ...o });
const catOf = (id) => ({ id, name: id.toUpperCase(), color: '#fff' });

describe('makeSummary', () => {
  test('totais batem com getMonthEntries (inclui fatura no mês do vencimento) e ficam em cache', () => {
    const c = ctx({ entries: [e({ amount: 50 }), e({ type: 'receita', amount: 1000, category: 'salario', status: 'pago' })] });
    const summary = makeSummary(c);
    const s = summary('2026-11');
    expect(s).toMatchObject({ rec: 1000, dep: 150, saldo: 850 }); // 50 + fatura de out/nov? (fecha 03/11, vence 10/11 = parcela 2: 100)
    expect(summary('2026-11')).toBe(s);
    const direct = getMonthEntries(c.entries, c.dividas, '2026-11', c.cards, c.cardPurchases, c.cardFaturas, c.today);
    expect(s.dep).toBe(direct.filter(x => x.type === 'despesa').reduce((a, x) => a + (x.displayAmount ?? x.amount), 0));
  });
  test('pago e categorias por tipo', () => {
    const c = ctx({ cards: [], entries: [e({ amount: 40, status: 'pago' }), e({ amount: 60, category: 'lazer' })] });
    const s = makeSummary(c)('2026-11');
    expect(s.pago).toBe(40);
    expect(s.byCat.despesa).toEqual({ moradia: 40, lazer: 60 });
  });
});

describe('agregações', () => {
  test('sumMonths e categoryRanking', () => {
    const c = ctx({ cards: [], entries: [e({ amount: 40, date: '2026-10-05' }), e({ amount: 60, category: 'lazer' }), e({ amount: 25, category: 'lazer', date: '2026-10-07' })] });
    const summary = makeSummary(c);
    expect(sumMonths(summary, ['2026-10', '2026-11'])).toEqual({ rec: 0, dep: 125, saldo: -125 });
    expect(categoryRanking(summary, ['2026-10', '2026-11'], 'despesa', catOf).map(x => [x.id, x.value])).toEqual([['lazer', 85], ['moradia', 40]]);
  });
});

describe('cardStats: mesma regra de Contas', () => {
  test('o total por mês de vencimento é igual à soma das faturas em getMonthEntries', () => {
    const c = ctx();
    const months = ['2026-10', '2026-11', '2026-12', '2027-01'];
    const st = cardStats(c, months, catOf);
    for (const m of months) {
      const fat = getMonthEntries([], [], m, c.cards, c.cardPurchases, c.cardFaturas, c.today).filter(x => x.isFatura).reduce((a, x) => a + x.amount, 0);
      expect(st.monthly.find(x => x.month === m).total).toBe(fat);
    }
    expect(st.total).toBe(300);
    expect(st.cats).toEqual([{ id: 'lazer', name: 'LAZER', color: '#fff', value: 300 }]);
    expect(st.perCard).toHaveLength(1);
  });
  test('fora do período não entra', () => {
    expect(cardStats(ctx(), ['2026-11'], catOf).total).toBe(100);
  });
});

describe('accumulatedBalance', () => {
  test('soma os meses anteriores ao mês pedido; null se não há histórico', () => {
    const c = ctx({ cards: [], cardPurchases: [], entries: [e({ type: 'receita', amount: 500, date: '2026-09-05', category: 'salario' }), e({ amount: 200, date: '2026-10-05' })] });
    expect(accumulatedBalance(c, '2026-11', c.today)).toEqual({ value: 300, capped: false });
    expect(accumulatedBalance(c, '2026-09', c.today)).toBeNull();
    expect(accumulatedBalance({ ...c, entries: [] }, '2026-11', c.today)).toBeNull();
  });
});

describe('relatório', () => {
  test('as 5 maiores categorias + "Outras" para fechar o total', () => {
    const list = [10, 9, 8, 7, 6, 5, 4].map((v, i) => ({ id: 'c' + i, name: 'C' + i, value: v, color: '#fff' }));
    const rows = topWithOthers(list, 5);
    expect(rows).toHaveLength(6);
    expect(rows[5]).toMatchObject({ name: 'Outras', value: 9 });
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(49);
    expect(topWithOthers(list.slice(0, 3), 5)).toHaveLength(3);
  });
});

describe('computeHealth (regra única do score)', () => {
  test('limiares e rótulos', async () => {
    const { computeHealth } = await import('../logic.js');
    expect(computeHealth({ rec: 0, dep: 0, fixos: 0, pend: 0 })).toBeNull();
    expect(computeHealth({ rec: 1000, dep: 500, fixos: 200, pend: 0 })).toMatchObject({ score: 100, level: 'Saudável' });
    // fixos 60% (-15), poupança 5% (-20), pendente > 30% (-10) => 55
    expect(computeHealth({ rec: 1000, dep: 950, fixos: 600, pend: 400 })).toMatchObject({ score: 55, level: 'Crítico', fixedPct: 60 });
    expect(computeHealth({ rec: 1000, dep: 800, fixos: 350, pend: 0 })).toMatchObject({ score: 95, level: 'Saudável' });
  });
  test('despesas semanais e parcelas entram nos fixos (vêm expandidas do mês)', async () => {
    const { computeHealth, getMonthEntries } = await import('../logic.js');
    const entries = [e({ recurrence: 'weekly', amount: 50, date: '2026-11-02' }), e({ type: 'receita', amount: 1000, category: 'salario' })];
    const month = getMonthEntries(entries, [], '2026-11', [], [], {}, '2026-11-12');
    const fixos = month.filter(x => x.type === 'despesa' && x.isRecurring).reduce((s, x) => s + (x.displayAmount ?? x.amount), 0);
    expect(fixos).toBe(250); // 5 segundas-feiras em novembro
    expect(computeHealth({ rec: 1000, dep: 250, fixos, pend: 250 }).fixedPct).toBe(25);
  });
});

describe('accountBalances', () => {
  test('inclui recorrentes pagos, ignora pendentes e aceita saldo inicial negativo', async () => {
    const { accountBalances } = await import('../logic.js');
    const accounts = [{ id: 'a1', initialBalance: -100 }, { id: 'a2', initialBalance: 50 }];
    const entries = [
      e({ accountId: 'a1', type: 'receita', amount: 500, date: '2026-10-05', status: 'pago', category: 'salario' }),
      e({ accountId: 'a1', recurrence: 'fixed', amount: 30, date: '2026-09-10', statusByMonth: { '2026-09': 'pago', '2026-10': 'pago' } }), // 2 meses pagos, nov pendente
      e({ accountId: 'a2', amount: 20, date: '2026-11-03', status: 'a_pagar' }),
      e({ amount: 999, date: '2026-11-03', status: 'pago' }), // sem conta: ignorado
    ];
    expect(accountBalances(accounts, { entries }, '2026-11-12')).toEqual({ a1: -100 + 500 - 60, a2: 50 });
  });
  test('sem lançamentos vinculados devolve o saldo inicial', async () => {
    const { accountBalances } = await import('../logic.js');
    expect(accountBalances([{ id: 'a', initialBalance: 10 }], { entries: [] }, '2026-11-12')).toEqual({ a: 10 });
  });
});
