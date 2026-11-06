import { describe, it, expect } from 'vitest';
import { getNow, addM } from './utils.js';
import {
  getBillingMonth,
  getFaturaDueDate,
  getFaturaCloseDate,
  isFaturaOpen,
  getPurchaseInstallmentsForBilling,
  buildFatura,
  getCardBillingMonths,
  getMonthEntries,
} from './logic.js';

describe('getBillingMonth', () => {
  it('cai no mês da compra quando o dia é antes ou igual ao fechamento', () => {
    expect(getBillingMonth('2026-03-10', 15)).toBe('2026-03');
    expect(getBillingMonth('2026-03-15', 15)).toBe('2026-03');
  });
  it('cai no mês seguinte quando o dia é depois do fechamento', () => {
    expect(getBillingMonth('2026-03-20', 15)).toBe('2026-04');
  });
  it('rola o ano quando a compra é em dezembro', () => {
    expect(getBillingMonth('2026-12-20', 15)).toBe('2027-01');
  });
});

describe('getFaturaDueDate / getFaturaCloseDate', () => {
  it('vencimento é no mês seguinte ao de faturamento', () => {
    expect(getFaturaDueDate('2026-03', 10)).toBe('2026-04-10');
  });
  it('rola o ano no vencimento de dezembro', () => {
    expect(getFaturaDueDate('2026-12', 10)).toBe('2027-01-10');
  });
  it('fechamento é no próprio mês de faturamento', () => {
    expect(getFaturaCloseDate('2026-03', 15)).toBe('2026-03-15');
  });
});

describe('isFaturaOpen', () => {
  it('está aberta para um mês de faturamento futuro', () => {
    const futureMonth = addM(getNow(), 2);
    expect(isFaturaOpen(futureMonth, 15)).toBe(true);
  });
  it('está fechada para um mês de faturamento já passado', () => {
    const pastMonth = addM(getNow(), -2);
    expect(isFaturaOpen(pastMonth, 15)).toBe(false);
  });
});

describe('getPurchaseInstallmentsForBilling', () => {
  const purchase = { purchaseDate: '2026-03-10', amount: 300, installments: 3 };
  it('calcula a 1ª parcela no mês base de faturamento', () => {
    const r = getPurchaseInstallmentsForBilling(purchase, '2026-03', 15);
    expect(r).toEqual({ installmentNum: 1, total: 3, amount: 100 });
  });
  it('calcula parcelas intermediárias', () => {
    const r = getPurchaseInstallmentsForBilling(purchase, '2026-04', 15);
    expect(r).toEqual({ installmentNum: 2, total: 3, amount: 100 });
  });
  it('retorna null fora da janela de parcelas', () => {
    expect(getPurchaseInstallmentsForBilling(purchase, '2026-06', 15)).toBeNull();
    expect(getPurchaseInstallmentsForBilling(purchase, '2026-02', 15)).toBeNull();
  });
  it('usa o mês de faturamento (não o de compra) quando a compra é após o fechamento', () => {
    const late = { purchaseDate: '2026-03-20', amount: 100, installments: 1 };
    expect(getPurchaseInstallmentsForBilling(late, '2026-03', 15)).toBeNull();
    expect(getPurchaseInstallmentsForBilling(late, '2026-04', 15)).toEqual({ installmentNum: 1, total: 1, amount: 100 });
  });
});

describe('buildFatura', () => {
  const card = { id: 'c1', name: 'Nubank', closeDay: 15, dueDay: 10, color: '#fff' };
  const purchases = [{ cardId: 'c1', purchaseDate: '2026-03-10', amount: 300, installments: 3 }];

  it('soma os itens do mês de faturamento e calcula datas', () => {
    const f = buildFatura(card, purchases, {}, '2026-03');
    expect(f.total).toBe(100);
    expect(f.items).toHaveLength(1);
    expect(f.closeDate).toBe('2026-03-15');
    expect(f.dueDate).toBe('2026-04-10');
    expect(f.paid).toBe(false);
  });
  it('ignora compras de outros cartões', () => {
    const otherCardPurchases = [...purchases, { cardId: 'c2', purchaseDate: '2026-03-05', amount: 50, installments: 1 }];
    const f = buildFatura(card, otherCardPurchases, {}, '2026-03');
    expect(f.items).toHaveLength(1);
    expect(f.total).toBe(100);
  });
  it('aplica registro de pagamento parcial', () => {
    const cardFaturas = { 'c1_2026-03': { paid: false, partial: true, paidAmount: 40 } };
    const f = buildFatura(card, purchases, cardFaturas, '2026-03');
    expect(f.partial).toBe(true);
    expect(f.paidAmount).toBe(40);
    expect(f.paid).toBe(false);
  });
});

describe('getCardBillingMonths', () => {
  it('lista todos os meses de faturamento cobertos pelas parcelas', () => {
    const card = { id: 'c1', closeDay: 15 };
    const purchases = [{ cardId: 'c1', purchaseDate: '2026-03-10', amount: 300, installments: 3 }];
    expect(getCardBillingMonths(card, purchases)).toEqual(['2026-03', '2026-04', '2026-05']);
  });
  it('ignora compras de outros cartões', () => {
    const card = { id: 'c1', closeDay: 15 };
    const purchases = [{ cardId: 'c2', purchaseDate: '2026-03-10', amount: 300, installments: 3 }];
    expect(getCardBillingMonths(card, purchases)).toEqual([]);
  });
});

describe('getMonthEntries', () => {
  it('entrada "none" aparece só no mês da data', () => {
    const entries = [{ id: '1', date: '2026-03-10', recurrence: 'none', status: 'a_pagar', type: 'despesa' }];
    expect(getMonthEntries(entries, [], '2026-03', [], [], {})).toHaveLength(1);
    expect(getMonthEntries(entries, [], '2026-04', [], [], {})).toHaveLength(0);
  });

  it('entrada "fixed" se repete em todos os meses a partir da data base', () => {
    const entries = [{ id: '1', date: '2026-01-05', recurrence: 'fixed', type: 'despesa' }];
    expect(getMonthEntries(entries, [], '2026-01', [], [], {})).toHaveLength(1);
    expect(getMonthEntries(entries, [], '2026-06', [], [], {})).toHaveLength(1);
    expect(getMonthEntries(entries, [], '2025-12', [], [], {})).toHaveLength(0);
  });

  it('entrada "fixed" respeita endMonth', () => {
    const entries = [{ id: '1', date: '2026-01-05', recurrence: 'fixed', type: 'despesa', endMonth: '2026-03' }];
    expect(getMonthEntries(entries, [], '2026-03', [], [], {})).toHaveLength(1);
    expect(getMonthEntries(entries, [], '2026-04', [], [], {})).toHaveLength(0);
  });

  it('entrada "fixed" respeita deletedFrom', () => {
    const entries = [{ id: '1', date: '2026-01-05', recurrence: 'fixed', type: 'despesa', deletedFrom: '2026-04' }];
    expect(getMonthEntries(entries, [], '2026-03', [], [], {})).toHaveLength(1);
    expect(getMonthEntries(entries, [], '2026-04', [], [], {})).toHaveLength(0);
  });

  it('entrada "fixed" respeita deletedMonths (exclusão pontual)', () => {
    const entries = [{ id: '1', date: '2026-01-05', recurrence: 'fixed', type: 'despesa', deletedMonths: ['2026-03'] }];
    expect(getMonthEntries(entries, [], '2026-02', [], [], {})).toHaveLength(1);
    expect(getMonthEntries(entries, [], '2026-03', [], [], {})).toHaveLength(0);
    expect(getMonthEntries(entries, [], '2026-04', [], [], {})).toHaveLength(1);
  });

  it('entrada "fixed" usa status específico do mês (statusByMonth)', () => {
    const entries = [{ id: '1', date: '2026-01-05', recurrence: 'fixed', type: 'despesa', statusByMonth: { '2026-02': 'pago' } }];
    const jan = getMonthEntries(entries, [], '2026-01', [], [], {});
    const fev = getMonthEntries(entries, [], '2026-02', [], [], {});
    expect(jan[0].statusForMonth).toBe('a_pagar');
    expect(fev[0].statusForMonth).toBe('pago');
  });

  it('entrada "installment" divide o valor pelo total de parcelas', () => {
    const entries = [{ id: '1', date: '2026-01-10', recurrence: 'installment', type: 'despesa', amount: 300, installments: 3 }];
    const m1 = getMonthEntries(entries, [], '2026-01', [], [], {})[0];
    const m3 = getMonthEntries(entries, [], '2026-03', [], [], {})[0];
    expect(m1.displayAmount).toBe(100);
    expect(m1.installmentNum).toBe(1);
    expect(m3.installmentNum).toBe(3);
    expect(getMonthEntries(entries, [], '2026-04', [], [], {})).toHaveLength(0);
  });

  it('override de valor/status substitui o valor calculado do mês', () => {
    const entries = [{ id: '1', date: '2026-01-10', recurrence: 'fixed', type: 'despesa', amount: 100, overrides: { '2026-02': { amount: 150 } } }];
    const fev = getMonthEntries(entries, [], '2026-02', [], [], {})[0];
    expect(fev.displayAmount).toBe(150);
  });

  it('inclui parcela de dívida no mês correto com status pago/a_pagar', () => {
    const dividas = [{ id: 'd1', name: 'Empréstimo', totalAmount: 1000, installments: 10, startMonth: '2026-01', paidMonths: ['2026-01'] }];
    const jan = getMonthEntries([], dividas, '2026-01', [], [], {})[0];
    const fev = getMonthEntries([], dividas, '2026-02', [], [], {})[0];
    expect(jan.amount).toBe(100);
    expect(jan.status).toBe('pago');
    expect(fev.status).toBe('a_pagar');
    expect(getMonthEntries([], dividas, '2026-11', [], [], {})).toHaveLength(0);
  });

  it('fatura aberta aparece com a data de fechamento e valor total', () => {
    const card = { id: 'c1', name: 'Nubank', closeDay: 20, dueDay: 10, color: '#fff' };
    const futureMonth = addM(getNow(), 2); // garante que o fechamento ainda não chegou
    const purchases = [{ cardId: 'c1', purchaseDate: `${futureMonth}-05`, amount: 200, installments: 1 }];
    const res = getMonthEntries([], [], futureMonth, [card], purchases, {});
    expect(res).toHaveLength(1);
    expect(res[0].isFatura).toBe(true);
    expect(res[0].isOpenFatura).toBe(true);
    expect(res[0].date).toBe(`${futureMonth}-20`);
    expect(res[0].displayAmount).toBe(200);
  });

  it('fatura fechada com pagamento parcial mostra o valor restante', () => {
    const card = { id: 'c1', name: 'Nubank', closeDay: 20, dueDay: 10, color: '#fff' };
    const pastMonth = addM(getNow(), -2); // garante que o fechamento já passou
    const purchases = [{ cardId: 'c1', purchaseDate: `${pastMonth}-05`, amount: 200, installments: 1 }];
    const cardFaturas = { [`c1_${pastMonth}`]: { partial: true, paidAmount: 50 } };
    const res = getMonthEntries([], [], pastMonth, [card], purchases, cardFaturas);
    expect(res[0].isOpenFatura).toBe(false);
    expect(res[0].date).toBe(getFaturaDueDate(pastMonth, 10));
    expect(res[0].amount).toBe(200);
    expect(res[0].displayAmount).toBe(150);
    expect(res[0].status).toBe('a_pagar');
  });

  it('fatura com total zero não aparece', () => {
    const card = { id: 'c1', name: 'Nubank', closeDay: 20, dueDay: 10, color: '#fff' };
    const res = getMonthEntries([], [], getNow(), [card], [], {});
    expect(res).toHaveLength(0);
  });
});
