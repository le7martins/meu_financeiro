// O jsdom não aplica CSS, então os testes de tela não pegam um CSS inválido.
// Estes checks estruturais protegem o bloco de tokens.
import { test, expect } from 'vitest';
import { CSS } from '../appCss.js';

// Remove comentários e @import (a URL da fonte contém ";", ex. wght@400;500)
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^\n]*\n/g, '');

test('chaves balanceadas', () => {
  const s = stripComments(CSS);
  expect((s.match(/{/g) || []).length).toBe((s.match(/}/g) || []).length);
});

test('nenhuma declaração solta fora de bloco (invalidaria o seletor seguinte, ex. :root)', () => {
  const s = stripComments(CSS);
  let depth = 0, buf = '';
  const stray = [];
  for (const ch of s) {
    if (ch === '{') { depth++; buf = ''; }
    else if (ch === '}') { depth--; buf = ''; }
    else if (depth === 0) {
      buf += ch;
      if (ch === ';') { if (!buf.trim().startsWith('@import')) stray.push(buf.trim()); buf = ''; }
    }
  }
  expect(stray).toEqual([]);
});

test('tokens essenciais definidos nos dois temas', () => {
  const s = stripComments(CSS);
  for (const sel of [':root', '.light-mode']) {
    const i = s.search(new RegExp(`(^|[},\\s])${sel.replace('.', '\\.')}\\s*\\{`));
    expect(i, `bloco ${sel}`).toBeGreaterThanOrEqual(0);
  }
  for (const v of ['--bg', '--text-1', '--accent', '--success', '--danger']) {
    expect((s.match(new RegExp(`${v}\\s*:`, 'g')) || []).length, v).toBeGreaterThanOrEqual(2);
  }
  expect(s).toMatch(/--font-sans\s*:/);
});

test('sem seletores de remendo [style*=] (dependem do texto do style inline)', () => {
  expect(CSS).not.toMatch(/\[style\*=/);
});
