import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage before importing utils (utils.js runs code at module level)
globalThis.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] ?? null; },
  setItem(k, v) { this._store[k] = v; },
  removeItem(k) { delete this._store[k]; },
};

import { mDiff, addM, fmtShort, daysUntil, TODAY, fmt, fmtDate, mLabel } from '../utils.js';

describe('mDiff', () => {
  it('same month', () => expect(mDiff('2024-01', '2024-01')).toBe(0));
  it('forward 1 month', () => expect(mDiff('2024-01', '2024-02')).toBe(1));
  it('forward 12 months', () => expect(mDiff('2024-01', '2025-01')).toBe(12));
  it('year boundary', () => expect(mDiff('2023-11', '2024-02')).toBe(3));
  it('negative (b before a)', () => expect(mDiff('2024-03', '2024-01')).toBe(-2));
  it('large span', () => expect(mDiff('2020-01', '2025-06')).toBe(65));
});

describe('addM', () => {
  it('adds 1 month', () => expect(addM('2024-01', 1)).toBe('2024-02'));
  it('year rollover', () => expect(addM('2024-12', 1)).toBe('2025-01'));
  it('subtracts months', () => expect(addM('2024-03', -2)).toBe('2024-01'));
  it('subtract across year', () => expect(addM('2025-01', -1)).toBe('2024-12'));
  it('adds many months', () => expect(addM('2024-01', 14)).toBe('2025-03'));
  it('pads single digit month', () => expect(addM('2024-01', 0)).toBe('2024-01'));
});

describe('fmtShort', () => {
  it('zero', () => expect(fmtShort(0)).toBe('R$0'));
  it('small positive', () => expect(fmtShort(500)).toBe('R$500'));
  it('exactly 1000', () => expect(fmtShort(1000)).toBe('R$1.0k'));
  it('large positive', () => expect(fmtShort(2500)).toBe('R$2.5k'));
  it('negative small', () => expect(fmtShort(-500)).toBe('-R$500'));
  it('negative large', () => expect(fmtShort(-1500)).toBe('-R$1.5k'));
  it('negative exactly -1000', () => expect(fmtShort(-1000)).toBe('-R$1.0k'));
  it('does not produce double minus', () => expect(fmtShort(-200)).not.toMatch(/--/));
  it('does not put minus after R$', () => expect(fmtShort(-200)).not.toMatch(/R\$-/));
});

describe('daysUntil', () => {
  it('returns null for falsy input', () => expect(daysUntil(null)).toBeNull());
  it('returns null for empty string', () => expect(daysUntil('')).toBeNull());
  it('returns 0 for TODAY', () => expect(daysUntil(TODAY)).toBe(0));
  it('returns positive for future date', () => {
    const future = addM(TODAY.substring(0, 7), 1) + '-01';
    expect(daysUntil(future)).toBeGreaterThan(0);
  });
  it('returns negative for past date', () => {
    const past = addM(TODAY.substring(0, 7), -1) + '-01';
    expect(daysUntil(past)).toBeLessThan(0);
  });
});

describe('TODAY format', () => {
  it('matches YYYY-MM-DD', () => expect(TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  it('is current local date (not UTC shifted)', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(TODAY).toBe(expected);
  });
});

describe('fmt', () => {
  it('formats BRL currency', () => expect(fmt(1000)).toMatch(/1\.000/));
  it('formats zero', () => expect(fmt(0)).toMatch(/0/));
});

describe('fmtDate', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => expect(fmtDate('2024-06-15')).toBe('15/06/2024'));
});

describe('mLabel', () => {
  it('formats Jan 2024', () => expect(mLabel('2024-01')).toBe('Jan 2024'));
  it('formats Dec 2023', () => expect(mLabel('2023-12')).toBe('Dez 2023'));
});
