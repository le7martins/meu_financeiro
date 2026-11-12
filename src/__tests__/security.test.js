import { describe, it, expect } from 'vitest';
import { buildMonthReportHtml, esc, safeColor } from '../pdfReport.js';
import { validateBackup } from '../entryActions.js';

describe('esc / safeColor', () => {
  it('escapa HTML', () => {
    expect(esc('<img src=x onerror=alert(1)>"\'&')).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(esc(null)).toBe('');
  });
  it('aceita só cores hex', () => {
    expect(safeColor('#6C8EEF')).toBe('#6C8EEF');
    expect(safeColor('red;background:url(//x)')).toBe('#9E9E9E');
    expect(safeColor(undefined)).toBe('#9E9E9E');
  });
});

describe('relatório HTML', () => {
  it('não deixa texto do usuário virar tag e usa CSP com nonce', () => {
    const evil = '</td><script>alert(1)</script>';
    const html = buildMonthReportHtml({
      entries: [], monthKey: '2026-01', categories: [{ id: 'x', name: evil, color: 'red;x', type: 'despesa' }],
      mLabel: () => 'Jan 2026', fmt: String, fmtDate: String, eVal: e => e.amount,
      getMonthEntries: () => [{ id: 1, description: evil, amount: 10, type: 'despesa', category: 'x', statusForMonth: 'pago', date: '2026-01-05' }],
      dividas: [], cards: [], cardPurchases: [], cardFaturas: {},
    }, 'abc123');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain("script-src 'nonce-abc123'");
    expect(html).not.toContain('onclick=');
  });
});

describe('validateBackup endurecido', () => {
  const base = { version: 1, entries: [{ id: 'a', description: 'x', type: 'despesa', date: '2026-01-01', amount: 10 }] };
  it('aceita backup normal', () => expect(validateBackup(base).ok).toBe(true));
  it('rejeita valores absurdos e Infinity', () => {
    expect(validateBackup({ ...base, entries: [{ ...base.entries[0], amount: 1e15 }] }).ok).toBe(false);
    expect(validateBackup({ ...base, entries: [{ ...base.entries[0], amount: 'Infinity' }] }).ok).toBe(false);
  });
  it('rejeita cor inválida e nome gigante', () => {
    expect(validateBackup({ ...base, categories: [{ id: 'c', name: 'ok', color: 'url(x)' }] }).ok).toBe(false);
    expect(validateBackup({ ...base, categories: [{ id: 'c', name: 'a'.repeat(500) }] }).ok).toBe(false);
  });
  it('rejeita listas enormes', () => {
    const big = Array.from({ length: 20001 }, (_, i) => ({ ...base.entries[0], id: String(i) }));
    expect(validateBackup({ ...base, entries: big }).ok).toBe(false);
  });
});
