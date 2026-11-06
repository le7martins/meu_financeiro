// @vitest-environment jsdom
// O modo demo precisa funcionar: os dados de exemplo passam por todas as regras do app.
import { test, expect } from 'vitest';
import { seedDemo } from '../demoData.js';
import { getMonthEntries, collectDueAlerts } from '../logic.js';
import { addM, getNow } from '../utils.js';

test('dados de demo carregam em todos os meses sem erro', () => {
  localStorage.clear();
  seedDemo('demo_x');
  const read = (k, def) => JSON.parse(localStorage.getItem(`mf2_demo_x_${k}`) ?? JSON.stringify(def));
  const data = {
    entries: read('entries', []), dividas: read('dividas', []), cards: read('cards', []),
    cardPurchases: read('cpurchases', []), cardFaturas: read('cfaturas', {}),
  };
  for (const d of data.dividas) expect(Array.isArray(d.paidMonths)).toBe(true);
  const now = getNow();
  for (let i = -12; i <= 12; i++) {
    expect(() => getMonthEntries(data.entries, data.dividas, addM(now, i), data.cards, data.cardPurchases, data.cardFaturas)).not.toThrow();
  }
  const current = getMonthEntries(data.entries, data.dividas, now, data.cards, data.cardPurchases, data.cardFaturas).map(e => e.description);
  // recorrências mensais (salário, aluguel, assinaturas) aparecem no mês atual
  for (const d of ['Salário CLT', 'Aluguel']) expect(current.some(c => c.startsWith(d)), d).toBe(true);
  expect(() => collectDueAlerts(data, { daysBefore: 3 })).not.toThrow();
});
