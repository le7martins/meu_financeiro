// Cada categoria tem UM tipo (receita ou despesa). Esta migração ajusta categorias, lançamentos e orçamentos
// salvos antes dessa regra. É pura e idempotente: aplicar de novo não muda nada.
import { DEFAULT_CATS, RESERVED_CAT_IDS } from './constants.js';

export const INCOME_FALLBACK = 'outra_receita';
export const EXPENSE_FALLBACK = 'outro';
const NEW_DEFAULT_IDS = ['bonus', 'reembolso', 'presente', INCOME_FALLBACK]; // categorias de receita que passam a existir

// Categorias que o usuário pode escolher ao lançar um tipo (sem as reservadas de dívida e cartão).
export const pickableCategories = (categories, type) =>
  categories.filter(c => c.type === type && !RESERVED_CAT_IDS.includes(c.id));

export function migrateCategories({ categories, entries, budgets = {} }) {
  // 1) tipo único: "both" (ou ausente) vira despesa, mantendo id, nome e cor
  let changedCats = false;
  let cats = categories.map(c => (c.type === 'receita' || c.type === 'despesa') ? c : (changedCats = true, { ...c, type: 'despesa' }));
  // 2) categorias de receita novas (só as que faltam)
  const have = new Set(cats.map(c => c.id));
  const missing = DEFAULT_CATS.filter(d => NEW_DEFAULT_IDS.includes(d.id) && !have.has(d.id));
  if (missing.length) { cats = [...cats, ...missing]; changedCats = true; }
  const typeOf = Object.fromEntries(cats.map(c => [c.id, c.type]));

  // 3) lançamentos: receita só com categoria de receita; despesa nunca com categoria de receita
  const fix = (type, cat) => {
    if (type === 'receita') return typeOf[cat] === 'receita' ? cat : INCOME_FALLBACK;
    return typeOf[cat] === 'receita' ? EXPENSE_FALLBACK : cat;
  };
  let changedEntries = false;
  const ents = entries.map(e => {
    let next = e;
    const cat = fix(e.type, e.category);
    if (cat !== e.category) next = { ...next, category: cat };
    if (e.overrides) {
      let ov = null;
      for (const [m, o] of Object.entries(e.overrides)) {
        if (o && o.category !== undefined) {
          const oc = fix(e.type, o.category);
          if (oc !== o.category) { ov = ov || { ...e.overrides }; ov[m] = { ...o, category: oc }; }
        }
      }
      if (ov) next = { ...next, overrides: ov };
    }
    if (next !== e) changedEntries = true;
    return next;
  });

  // 4) orçamento é de despesa: remove limites de categorias que são de receita
  let changedBudgets = false;
  const bud = {};
  for (const [id, v] of Object.entries(budgets || {})) {
    if (typeOf[id] === 'receita') { changedBudgets = true; continue; }
    bud[id] = v;
  }
  return {
    categories: changedCats ? cats : categories, entries: changedEntries ? ents : entries, budgets: changedBudgets ? bud : budgets,
    changedCats, changedEntries, changedBudgets,
    changed: changedCats || changedEntries || changedBudgets,
  };
}
