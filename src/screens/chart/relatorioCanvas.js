// Imagem do relatório mensal (PNG) desenhada direto no canvas, em 2x.
import { fmt, mLabel } from '../../utils.js';

const rr = (ctx, x, y, w, h, r = 8) => {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
};

// cats: [{ name, value, color }] — as 5 maiores; o resto vira "Outras" para as barras fecharem com o total.
export function topWithOthers(list, n = 5) {
  if (list.length <= n) return list;
  const rest = list.slice(n).reduce((s, c) => s + c.value, 0);
  return [...list.slice(0, n), { id: '__outras', name: 'Outras', value: rest, color: '#64748b' }];
}

export function renderRelatorio({ month, rec, dep, pago, cats }) {
  const W = 390, PAD = 24, saldo = rec - dep, pend = dep - pago;
  const rows = topWithOthers(cats);
  const H = 120 + 78 + 34 + rows.length * 42 + 16 + 78 + 40;
  const cv = document.createElement('canvas');
  cv.width = W * 2; cv.height = H * 2;
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  const font = (px, weight = '') => `${weight} ${px}px system-ui,-apple-system,"Segoe UI",sans-serif`.trim();
  const MUTED = '#9aa4b2';

  ctx.fillStyle = '#080c12'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4ade80'; ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = '#4ade80'; ctx.font = font(22, 'bold'); ctx.fillText('CashUp', PAD, 40);
  ctx.fillStyle = MUTED; ctx.font = font(12); ctx.fillText('Relatório mensal', PAD, 58);
  ctx.fillStyle = '#e6edf5'; ctx.font = font(26, 'bold'); ctx.fillText(mLabel(month), PAD, 94);

  // Resumo: receitas, despesas, saldo
  const cW = (W - PAD * 2 - 16) / 3;
  [{ l: 'RECEITAS', v: rec, c: '#4ade80' }, { l: 'DESPESAS', v: dep, c: '#fb923c' }, { l: 'SALDO', v: saldo, c: saldo >= 0 ? '#4ade80' : '#f87171' }].forEach(({ l, v, c }, i) => {
    const x = PAD + i * (cW + 8), y = 112, h = 66;
    ctx.fillStyle = '#0d1118'; rr(ctx, x, y, cW, h); ctx.fill();
    ctx.strokeStyle = '#1e2a3a'; ctx.lineWidth = 1; rr(ctx, x, y, cW, h); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.font = font(10, 'bold'); ctx.fillText(l, x + 10, y + 20);
    ctx.fillStyle = c; ctx.font = font(14, 'bold'); ctx.fillText(fmt(v), x + 10, y + 46);
  });

  // Despesas por categoria
  let cy = 112 + 66 + 30;
  ctx.fillStyle = MUTED; ctx.font = font(11, 'bold'); ctx.fillText('DESPESAS POR CATEGORIA', PAD, cy);
  cy += 12;
  const barW = W - PAD * 2, maxC = rows[0]?.value || 1;
  rows.forEach(({ name, value, color }) => {
    ctx.fillStyle = '#dbe3ee'; ctx.font = font(13); ctx.fillText(name, PAD, cy + 14);
    const vs = fmt(value);
    ctx.fillStyle = color; ctx.font = font(12, 'bold'); ctx.fillText(vs, W - PAD - ctx.measureText(vs).width, cy + 14);
    ctx.fillStyle = '#1a2840'; rr(ctx, PAD, cy + 20, barW, 8, 4); ctx.fill();
    ctx.fillStyle = color; rr(ctx, PAD, cy + 20, Math.max(8, (value / maxC) * barW), 8, 4); ctx.fill();
    cy += 42;
  });

  // Pagamentos
  cy += 8;
  ctx.fillStyle = MUTED; ctx.font = font(11, 'bold'); ctx.fillText('PAGAMENTOS', PAD, cy);
  cy += 12;
  ctx.fillStyle = '#1a2840'; rr(ctx, PAD, cy, barW, 10, 5); ctx.fill();
  if (dep > 0 && pago > 0) { ctx.fillStyle = '#4ade80'; rr(ctx, PAD, cy, Math.max(10, (pago / dep) * barW), 10, 5); ctx.fill(); }
  cy += 30;
  ctx.fillStyle = '#4ade80'; ctx.font = font(13, 'bold'); ctx.fillText(`Pago: ${fmt(pago)}`, PAD, cy);
  ctx.fillStyle = '#fb923c'; ctx.fillText(`Pendente: ${fmt(pend)}`, PAD + 170, cy);

  ctx.fillStyle = '#6b7482'; ctx.font = font(11);
  ctx.fillText(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · CashUp`, PAD, H - 16);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}
