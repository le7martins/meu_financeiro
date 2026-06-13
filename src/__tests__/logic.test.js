import { describe, it, expect } from 'vitest';

globalThis.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] ?? null; },
  setItem(k, v) { this._store[k] = v; },
  removeItem(k) { delete this._store[k]; },
};

import {
  getBillingMonth,
  getFaturaDueDate,
  getPurchaseInstallmentsForBilling,
  getMonthEntries,
} from '../logic.js';

// ─── getBillingMonth ──────────────────────────────────────────────────────────
describe('getBillingMonth', () => {
  it('purchase on close day → current month', () => {
    expect(getBillingMonth('2024-06-10', 10)).toBe('2024-06');
  });
  it('purchase before close day → current month', () => {
    expect(getBillingMonth('2024-06-05', 10)).toBe('2024-06');
  });
  it('purchase after close day → next month', () => {
    expect(getBillingMonth('2024-06-11', 10)).toBe('2024-07');
  });
  it('year boundary: Dec purchase after close → Jan next year', () => {
    expect(getBillingMonth('2024-12-20', 15)).toBe('2025-01');
  });
  it('year boundary: Dec purchase on close → Dec', () => {
    expect(getBillingMonth('2024-12-15', 15)).toBe('2024-12');
  });
});

// ─── getFaturaDueDate ─────────────────────────────────────────────────────────
describe('getFaturaDueDate', () => {
  it('billing Jun → due Jul', () => {
    expect(getFaturaDueDate('2024-06', 10)).toBe('2024-07-10');
  });
  it('billing Dec → due Jan next year', () => {
    expect(getFaturaDueDate('2024-12', 10)).toBe('2025-01-10');
  });
  it('pads single digit due day', () => {
    expect(getFaturaDueDate('2024-06', 5)).toBe('2024-07-05');
  });
});

// ─── getPurchaseInstallmentsForBilling ────────────────────────────────────────
describe('getPurchaseInstallmentsForBilling', () => {
  const purchase = { purchaseDate: '2024-06-05', amount: 300, installments: 3 };
  const closeDay = 10;

  it('first installment matches billing month of purchase', () => {
    const result = getPurchaseInstallmentsForBilling(purchase, '2024-06', closeDay);
    expect(result).toMatchObject({ installmentNum: 1, total: 3, amount: 100 });
  });
  it('second installment', () => {
    const result = getPurchaseInstallmentsForBilling(purchase, '2024-07', closeDay);
    expect(result).toMatchObject({ installmentNum: 2, total: 3, amount: 100 });
  });
  it('last installment', () => {
    const result = getPurchaseInstallmentsForBilling(purchase, '2024-08', closeDay);
    expect(result).toMatchObject({ installmentNum: 3, total: 3, amount: 100 });
  });
  it('returns null after all installments paid', () => {
    expect(getPurchaseInstallmentsForBilling(purchase, '2024-09', closeDay)).toBeNull();
  });
  it('returns null for month before purchase', () => {
    expect(getPurchaseInstallmentsForBilling(purchase, '2024-05', closeDay)).toBeNull();
  });
  it('single installment purchase', () => {
    const single = { purchaseDate: '2024-06-05', amount: 150, installments: 1 };
    expect(getPurchaseInstallmentsForBilling(single, '2024-06', closeDay)).toMatchObject({ installmentNum: 1, total: 1, amount: 150 });
    expect(getPurchaseInstallmentsForBilling(single, '2024-07', closeDay)).toBeNull();
  });
});

// ─── getMonthEntries ──────────────────────────────────────────────────────────
describe('getMonthEntries — recurrence: none', () => {
  const entry = { id: 'e1', date: '2024-06-15', type: 'despesa', description: 'Test', amount: 100, recurrence: 'none', status: 'a_pagar' };

  it('appears in matching month', () => {
    const res = getMonthEntries([entry], [], '2024-06', [], [], {});
    expect(res).toHaveLength(1);
    expect(res[0].statusForMonth).toBe('a_pagar');
  });
  it('does not appear in different month', () => {
    expect(getMonthEntries([entry], [], '2024-07', [], [], {})).toHaveLength(0);
  });
});

describe('getMonthEntries — recurrence: fixed', () => {
  const entry = { id: 'e2', date: '2024-01-05', type: 'despesa', description: 'Aluguel', amount: 1500, recurrence: 'fixed', statusByMonth: {} };

  it('appears in start month', () => {
    expect(getMonthEntries([entry], [], '2024-01', [], [], {})).toHaveLength(1);
  });
  it('appears in later month', () => {
    expect(getMonthEntries([entry], [], '2024-06', [], [], {})).toHaveLength(1);
  });
  it('does not appear before start month', () => {
    expect(getMonthEntries([entry], [], '2023-12', [], [], {})).toHaveLength(0);
  });
  it('respects endMonth', () => {
    const withEnd = { ...entry, endMonth: '2024-03' };
    expect(getMonthEntries([withEnd], [], '2024-03', [], [], {})).toHaveLength(1);
    expect(getMonthEntries([withEnd], [], '2024-04', [], [], {})).toHaveLength(0);
  });
  it('uses statusByMonth when set', () => {
    const paid = { ...entry, statusByMonth: { '2024-06': 'pago' } };
    const res = getMonthEntries([paid], [], '2024-06', [], [], {});
    expect(res[0].statusForMonth).toBe('pago');
  });
});

describe('getMonthEntries — recurrence: installment', () => {
  const entry = { id: 'e3', date: '2024-01-10', type: 'despesa', description: 'Parcelado', amount: 600, recurrence: 'installment', installments: 3, statusByMonth: {} };

  it('first installment', () => {
    const res = getMonthEntries([entry], [], '2024-01', [], [], {});
    expect(res).toHaveLength(1);
    expect(res[0].installmentNum).toBe(1);
    expect(res[0].displayAmount).toBeCloseTo(200, 1);
  });
  it('last installment', () => {
    const res = getMonthEntries([entry], [], '2024-03', [], [], {});
    expect(res[0].installmentNum).toBe(3);
  });
  it('does not appear after all installments', () => {
    expect(getMonthEntries([entry], [], '2024-04', [], [], {})).toHaveLength(0);
  });
  it('does not appear before start', () => {
    expect(getMonthEntries([entry], [], '2023-12', [], [], {})).toHaveLength(0);
  });
});

describe('getMonthEntries — recurrence: quarterly', () => {
  const entry = { id: 'e4', date: '2024-01-01', type: 'despesa', description: 'Trim', amount: 300, recurrence: 'quarterly', statusByMonth: {} };

  it('appears in start month (diff=0)', () => {
    expect(getMonthEntries([entry], [], '2024-01', [], [], {})).toHaveLength(1);
  });
  it('appears 3 months later', () => {
    expect(getMonthEntries([entry], [], '2024-04', [], [], {})).toHaveLength(1);
  });
  it('does not appear in non-quarter month', () => {
    expect(getMonthEntries([entry], [], '2024-02', [], [], {})).toHaveLength(0);
    expect(getMonthEntries([entry], [], '2024-03', [], [], {})).toHaveLength(0);
  });
});

describe('getMonthEntries — recurrence: annual', () => {
  const entry = { id: 'e5', date: '2024-06-01', type: 'despesa', description: 'Anual', amount: 1200, recurrence: 'annual', statusByMonth: {} };

  it('appears in origin month', () => {
    expect(getMonthEntries([entry], [], '2024-06', [], [], {})).toHaveLength(1);
  });
  it('appears exactly 12 months later', () => {
    expect(getMonthEntries([entry], [], '2025-06', [], [], {})).toHaveLength(1);
  });
  it('does not appear 6 months later', () => {
    expect(getMonthEntries([entry], [], '2024-12', [], [], {})).toHaveLength(0);
  });
  it('does not appear before origin', () => {
    expect(getMonthEntries([entry], [], '2024-05', [], [], {})).toHaveLength(0);
  });
});

describe('getMonthEntries — recurrence: monthly (invalid)', () => {
  // 'monthly' is NOT a valid recurrence type — it silently produces no output.
  // All monthly-recurring entries should use 'fixed' instead.
  const entry = { id: 'e6', date: '2024-01-01', type: 'despesa', description: 'Salário', amount: 5000, recurrence: 'monthly', status: 'a_pagar' };

  it('produces no entries (monthly is unhandled)', () => {
    expect(getMonthEntries([entry], [], '2024-01', [], [], {})).toHaveLength(0);
    expect(getMonthEntries([entry], [], '2024-06', [], [], {})).toHaveLength(0);
  });
});

describe('getMonthEntries — deletedMonths / deletedFrom', () => {
  const base = { id: 'e7', date: '2024-01-01', type: 'despesa', description: 'X', amount: 50, recurrence: 'fixed', statusByMonth: {} };

  it('skips entry in deletedMonths', () => {
    const e = { ...base, deletedMonths: ['2024-03'] };
    expect(getMonthEntries([e], [], '2024-03', [], [], {})).toHaveLength(0);
    expect(getMonthEntries([e], [], '2024-04', [], [], {})).toHaveLength(1);
  });
  it('skips entry from deletedFrom onwards', () => {
    const e = { ...base, deletedFrom: '2024-04' };
    expect(getMonthEntries([e], [], '2024-03', [], [], {})).toHaveLength(1);
    expect(getMonthEntries([e], [], '2024-04', [], [], {})).toHaveLength(0);
  });
});

describe('getMonthEntries — dividas', () => {
  const divida = { id: 'd1', name: 'Empréstimo', startMonth: '2024-01', installments: 3, totalAmount: 900, dueDay: '10', category: 'outro' };

  it('appears in first month', () => {
    const res = getMonthEntries([], [divida], '2024-01', [], [], {});
    expect(res).toHaveLength(1);
    expect(res[0].isDivida).toBe(true);
    expect(res[0].installmentNum).toBe(1);
    expect(res[0].displayAmount).toBeCloseTo(300, 1);
  });
  it('appears in last month', () => {
    const res = getMonthEntries([], [divida], '2024-03', [], [], {});
    expect(res[0].installmentNum).toBe(3);
  });
  it('does not appear after all installments', () => {
    expect(getMonthEntries([], [divida], '2024-04', [], [], {})).toHaveLength(0);
  });
  it('marks as pago when month in paidMonths', () => {
    const paid = { ...divida, paidMonths: ['2024-02'] };
    const res = getMonthEntries([], [paid], '2024-02', [], [], {});
    expect(res[0].statusForMonth).toBe('pago');
  });
});
