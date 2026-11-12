import { describe, test, expect } from 'vitest';
import { migrateCategories, pickableCategories, INCOME_FALLBACK } from '../categoryMigration.js';
import { DEFAULT_CATS } from '../constants.js';

// Como as categorias eram salvas antes: 8 com type "both"
const OLD = [
  { id: 'moradia', name: 'Moradia', color: '#7b93e8', type: 'both' }, { id: 'lazer', name: 'Lazer', color: '#b06ee8', type: 'both' },
  { id: 'outro', name: 'Outro', color: '#8a9ab0', type: 'both' }, { id: 'salario', name: 'Salário', color: '#4ade80', type: 'receita' },
  { id: 'divida', name: 'Dívida', color: '#f87171', type: 'despesa' }, { id: 'meu_pet', name: 'Pet', color: '#fff', type: 'despesa' },
  { id: 'extra', name: 'Extra', color: '#fff', type: 'receita' },
];
const e = (o) => ({ id: 'e' + Math.random(), description: 'X', amount: 1, date: '2026-11-05', recurrence: 'none', ...o });
const mig = (o = {}) => migrateCategories({ categories: OLD, entries: [], budgets: {}, ...o });

describe('categorias padrão', () => {
  test('todas têm exatamente um tipo (receita ou despesa) e ids únicos', () => {
    expect(DEFAULT_CATS.every(c => c.type === 'receita' || c.type === 'despesa')).toBe(true);
    expect(new Set(DEFAULT_CATS.map(c => c.id)).size).toBe(DEFAULT_CATS.length);
    expect(DEFAULT_CATS.filter(c => c.type === 'receita').map(c => c.id)).toEqual(expect.arrayContaining(['salario', 'freelance', 'investimento', 'outra_receita']));
  });
  test('seletor: receita não oferece categorias de despesa e vice-versa; dívida/cartão ficam fora', () => {
    const rec = pickableCategories(DEFAULT_CATS, 'receita').map(c => c.id);
    const dep = pickableCategories(DEFAULT_CATS, 'despesa').map(c => c.id);
    expect(rec).toContain('salario'); expect(rec).not.toContain('moradia');
    expect(dep).toContain('moradia'); expect(dep).not.toContain('salario');
    expect(dep).not.toContain('divida'); expect(dep).not.toContain('cartao');
  });
});

describe('migrateCategories', () => {
  test('"both" vira despesa mantendo id, nome e cor; receitas novas são adicionadas', () => {
    const r = mig();
    expect(r.changedCats).toBe(true);
    expect(r.categories.find(c => c.id === 'moradia')).toEqual({ id: 'moradia', name: 'Moradia', color: '#7b93e8', type: 'despesa' });
    expect(r.categories.find(c => c.id === 'outro').type).toBe('despesa');
    expect(r.categories.map(c => c.id)).toEqual(expect.arrayContaining(['bonus', 'reembolso', 'presente', INCOME_FALLBACK]));
    expect(r.categories.some(c => c.type === 'both')).toBe(false);
  });
  test('categorias do usuário são preservadas', () => {
    const r = mig();
    expect(r.categories.find(c => c.id === 'meu_pet')).toEqual(OLD[5]);
    expect(r.categories.find(c => c.id === 'extra')).toEqual(OLD[6]);
  });
  test('receita com categoria de despesa/"outro"/inexistente vai para "Outra receita"; o resto fica', () => {
    const entries = [
      e({ type: 'receita', category: 'moradia' }), e({ type: 'receita', category: 'outro' }), e({ type: 'receita', category: 'apagada' }),
      e({ type: 'receita', category: 'salario' }), e({ type: 'receita', category: 'extra' }), e({ type: 'despesa', category: 'moradia' }),
    ];
    const r = mig({ entries });
    expect(r.entries.map(x => x.category)).toEqual([INCOME_FALLBACK, INCOME_FALLBACK, INCOME_FALLBACK, 'salario', 'extra', 'moradia']);
    expect(r.entries[3]).toBe(entries[3]); // intocados mantêm a mesma referência
  });
  test('despesa com categoria só de receita vai para "Outro"; override de categoria também é corrigido', () => {
    const entries = [e({ type: 'despesa', category: 'salario' }), e({ type: 'receita', category: 'salario', recurrence: 'fixed', overrides: { '2026-12': { category: 'lazer', amount: 5 } } })];
    const r = mig({ entries });
    expect(r.entries[0].category).toBe('outro');
    expect(r.entries[1].overrides['2026-12']).toEqual({ category: INCOME_FALLBACK, amount: 5 });
  });
  test('orçamento de categoria de receita é removido; os de despesa ficam', () => {
    const r = mig({ budgets: { moradia: 500, salario: 100, meu_pet: 50 } });
    expect(r.budgets).toEqual({ moradia: 500, meu_pet: 50 });
    expect(r.changedBudgets).toBe(true);
  });
  test('idempotente: a segunda passada não muda nada', () => {
    const entries = [e({ type: 'receita', category: 'moradia' })];
    const a = mig({ entries, budgets: { salario: 1 } });
    const b = migrateCategories({ categories: a.categories, entries: a.entries, budgets: a.budgets });
    expect(b.changed).toBe(false);
    expect(b.categories).toBe(a.categories); expect(b.entries).toBe(a.entries); expect(b.budgets).toBe(a.budgets);
  });
  test('dados já corretos não geram escrita', () => {
    const r = migrateCategories({ categories: DEFAULT_CATS, entries: [e({ type: 'receita', category: 'salario' })], budgets: { moradia: 1 } });
    expect(r.changed).toBe(false);
  });
  test('backup antigo (categorias "both") é migrado como qualquer outro dado', () => {
    const r = migrateCategories({ categories: OLD, entries: [e({ type: 'receita', category: 'lazer' })], budgets: undefined });
    expect(r.entries[0].category).toBe(INCOME_FALLBACK);
    expect(r.changedBudgets).toBe(false);
  });
});
