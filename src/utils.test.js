import { describe, it, expect } from 'vitest';
import { fmt, fmtShort, fmtDate, TODAY, mLabel, mShort, getNow, mDiff, addM, daysUntil, dueBadge, eVal } from './utils.js';

describe('fmt', () => {
  it('formata valor em BRL', () => {
    expect(fmt(1234.5)).toMatch(/R\$\s?1\.234,50/);
  });
  it('formata zero', () => {
    expect(fmt(0)).toMatch(/R\$\s?0,00/);
  });
});

describe('fmtShort', () => {
  it('mantém valores abaixo de 1000 sem sufixo k', () => {
    expect(fmtShort(999)).toBe('R$999');
  });
  it('abrevia valores >= 1000 com k', () => {
    expect(fmtShort(1500)).toBe('R$1.5k');
  });
  it('abrevia negativos usando o valor absoluto só para decidir o sufixo', () => {
    expect(fmtShort(-2000)).toBe('R$-2.0k');
  });
});

describe('fmtDate', () => {
  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(fmtDate('2026-03-05')).toBe('05/03/2026');
  });
});

describe('mLabel / mShort', () => {
  it('monta label com nome do mês e ano', () => {
    expect(mLabel('2026-03')).toBe('Mar 2026');
  });
  it('retorna só o nome curto do mês', () => {
    expect(mShort('2026-03')).toBe('Mar');
  });
});

describe('getNow', () => {
  it('retorna o mês atual no formato YYYY-MM', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expect(getNow()).toBe(expected);
  });
});

describe('mDiff', () => {
  it('calcula diferença em meses entre duas chaves', () => {
    expect(mDiff('2026-01', '2026-04')).toBe(3);
    expect(mDiff('2026-04', '2026-01')).toBe(-3);
    expect(mDiff('2026-01', '2026-01')).toBe(0);
  });
  it('atravessa a virada de ano', () => {
    expect(mDiff('2025-11', '2026-02')).toBe(3);
  });
});

describe('addM', () => {
  it('soma meses dentro do mesmo ano', () => {
    expect(addM('2026-01', 1)).toBe('2026-02');
  });
  it('rola o ano ao somar além de dezembro', () => {
    expect(addM('2026-12', 1)).toBe('2027-01');
  });
  it('rola o ano ao subtrair antes de janeiro', () => {
    expect(addM('2026-01', -1)).toBe('2025-12');
  });
});

describe('daysUntil', () => {
  it('retorna null para data vazia', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil('')).toBeNull();
  });
  it('retorna 0 para a data de hoje', () => {
    expect(daysUntil(TODAY)).toBe(0);
  });
  it('retorna valor positivo para datas futuras', () => {
    const [y, m, d] = TODAY.split('-').map(Number);
    const future = new Date(y, m - 1, d + 5);
    const futureKey = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(daysUntil(futureKey)).toBe(5);
  });
  it('retorna valor negativo para datas passadas', () => {
    const [y, m, d] = TODAY.split('-').map(Number);
    const past = new Date(y, m - 1, d - 3);
    const pastKey = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    expect(daysUntil(pastKey)).toBe(-3);
  });
});

describe('dueBadge', () => {
  it('não mostra badge quando já está pago', () => {
    expect(dueBadge({ statusForMonth: 'pago', date: TODAY }, getNow())).toBeNull();
  });
  it('não mostra badge para fatura aberta', () => {
    expect(dueBadge({ statusForMonth: 'a_pagar', isOpenFatura: true, date: TODAY }, getNow())).toBeNull();
  });
  it('mostra "Vence hoje!" quando vence hoje', () => {
    const badge = dueBadge({ statusForMonth: 'a_pagar', date: TODAY, recurrence: 'none' }, getNow());
    expect(badge.text).toBe('Vence hoje!');
  });
  it('mostra "Vencido" quando a data já passou', () => {
    const [y, m, d] = TODAY.split('-').map(Number);
    const past = new Date(y, m - 1, d - 4);
    const pastKey = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    const badge = dueBadge({ statusForMonth: 'a_pagar', date: pastKey, recurrence: 'none' }, getNow());
    expect(badge.text).toBe('Vencido há 4d');
  });
  it('não mostra badge quando vence em mais de 7 dias', () => {
    const [y, m, d] = TODAY.split('-').map(Number);
    const future = new Date(y, m - 1, d + 10);
    const futureKey = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(dueBadge({ statusForMonth: 'a_pagar', date: futureKey, recurrence: 'none' }, getNow())).toBeNull();
  });
});

describe('eVal', () => {
  it('prioriza displayAmount quando presente', () => {
    expect(eVal({ amount: 10, displayAmount: 5 })).toBe(5);
  });
  it('cai para amount quando não há displayAmount', () => {
    expect(eVal({ amount: 10 })).toBe(10);
  });
});
