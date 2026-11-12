import { describe, test, expect } from 'vitest';
import { todayISO, daysUntil, dateInMonth, dueDateFor, dueLine, installmentAmount, addM, mDiff, newId } from '../utils.js';

describe('todayISO', () => {
  test('usa a data local, não UTC (22h em Brasília continua sendo o mesmo dia)', () => {
    // Date construída com componentes locais: 05/11/2026 23:30 no fuso do aparelho
    expect(todayISO(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05');
    expect(todayISO(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('datas', () => {
  test('daysUntil com hoje injetado', () => {
    expect(daysUntil('2026-11-10', '2026-11-05')).toBe(5);
    expect(daysUntil('2026-11-05', '2026-11-05')).toBe(0);
    expect(daysUntil('2026-10-31', '2026-11-05')).toBe(-5);
    expect(daysUntil(null, '2026-11-05')).toBeNull();
  });
  test('daysUntil atravessando horário de verão / virada de ano', () => {
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
    expect(daysUntil('2026-03-01', '2026-02-01')).toBe(28);
  });
  test('dateInMonth limita ao último dia do mês', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2028-02', 30)).toBe('2028-02-29');
    expect(dateInMonth('2026-11', 5)).toBe('2026-11-05');
    expect(dateInMonth('2026-11', '5')).toBe('2026-11-05');
  });
  test('addM / mDiff', () => {
    expect(addM('2026-12', 1)).toBe('2027-01');
    expect(addM('2026-01', -1)).toBe('2025-12');
    expect(mDiff('2025-11', '2026-02')).toBe(3);
  });
  test('dueDateFor: recorrente usa o dia no mês exibido (com limite)', () => {
    expect(dueDateFor({ recurrence: 'fixed', date: '2026-01-31' }, '2026-02')).toBe('2026-02-28');
    expect(dueDateFor({ recurrence: 'none', date: '2026-01-31' }, '2026-02')).toBe('2026-01-31');
    expect(dueDateFor({ recurrence: 'installment', isDivida: true, date: '2026-02-10' }, '2026-02')).toBe('2026-02-10');
  });
  test('dueLine: despesa a pagar', () => {
    const e = { statusForMonth: 'a_pagar', type: 'despesa', recurrence: 'none', date: '2026-11-05' };
    const line = (today) => dueLine(e, '2026-11', today);
    expect(line('2026-11-05')).toEqual({ text: 'Vence hoje · 05/11', token: 'orange' });
    expect(line('2026-11-04')).toEqual({ text: 'Vence amanhã · 05/11', token: 'orange' });
    expect(line('2026-11-01')).toEqual({ text: 'Vence em 4 dias · 05/11', token: 'orange' });
    expect(line('2026-10-29')).toEqual({ text: 'Vence em 7 dias · 05/11', token: 'orange' });
    expect(line('2026-10-28')).toEqual({ text: 'Vence em 8 dias · 05/11', token: null });
    expect(line('2026-10-20')).toEqual({ text: 'Vence em 16 dias · 05/11', token: null });
    expect(line('2026-11-07')).toEqual({ text: 'Venceu em 05/11 · há 2 dias', token: 'danger' });
    expect(line('2026-11-06').text).toBe('Venceu em 05/11 · há 1 dia');
  });
  test('dueLine: receita, paga, fatura aberta e outro ano', () => {
    const base = { statusForMonth: 'a_pagar', type: 'despesa', recurrence: 'none', date: '2026-11-05' };
    expect(dueLine({ ...base, type: 'receita' }, '2026-11', '2026-11-03').text).toBe('Recebe em 2 dias · 05/11');
    expect(dueLine({ ...base, type: 'receita' }, '2026-11', '2026-11-09').text).toBe('Recebimento 05/11 · há 4 dias');
    expect(dueLine({ ...base, statusForMonth: 'pago' }, '2026-11', '2026-11-09')).toEqual({ text: 'Vencimento 05/11', token: null });
    expect(dueLine({ ...base, isFatura: true, isOpenFatura: true }, '2026-11', '2026-11-01')).toEqual({ text: 'Fecha em 05/11', token: null });
    expect(dueLine({ ...base, date: '2027-01-10' }, '2027-01', '2026-12-30').text).toBe('Vence em 11 dias · 10/01/27');
  });
});

describe('installmentAmount', () => {
  test('soma das parcelas é exatamente o total', () => {
    for (const [total, n] of [[100, 3], [1000, 7], [99.99, 12], [0.1, 3], [1234.56, 10]]) {
      let sum = 0;
      for (let i = 1; i <= n; i++) sum += Math.round(installmentAmount(total, n, i) * 100);
      expect(sum).toBe(Math.round(total * 100));
    }
  });
  test('sobra do arredondamento vai na 1ª parcela', () => {
    expect(installmentAmount(100, 3, 1)).toBe(33.34);
    expect(installmentAmount(100, 3, 2)).toBe(33.33);
    expect(installmentAmount(100, 3, 3)).toBe(33.33);
    expect(installmentAmount(50, 1, 1)).toBe(50);
  });
});

test('newId gera ids únicos', () => {
  const ids = new Set(Array.from({ length: 1000 }, newId));
  expect(ids.size).toBe(1000);
});
