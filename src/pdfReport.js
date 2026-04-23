// ─── PDF Report Generator (sem dependências externas) ────────────────────────
// Gera um HTML estilizado e abre a janela de impressão do browser (Save as PDF)

export function generateMonthPDF({ entries, monthKey, categories, mLabel, fmt, fmtDate, eVal, getMonthEntries, dividas, cards, cardPurchases, cardFaturas }) {
  const me = getMonthEntries(entries, dividas, monthKey, cards, cardPurchases, cardFaturas);
  const getCatName = (id) => (categories.find(c => c.id === id) || { name: id }).name;
  const getCatColor = (id) => (categories.find(c => c.id === id) || { color: '#9E9E9E' }).color;

  const rec    = me.filter(e => e.type === 'receita').reduce((s, e) => s + eVal(e), 0);
  const dep    = me.filter(e => e.type === 'despesa').reduce((s, e) => s + eVal(e), 0);
  const saldo  = rec - dep;
  const pago   = me.filter(e => e.type === 'despesa' && e.statusForMonth === 'pago').reduce((s, e) => s + eVal(e), 0);
  const pend   = me.filter(e => e.type === 'despesa' && e.statusForMonth === 'a_pagar').reduce((s, e) => s + eVal(e), 0);

  // Gastos por categoria (top 8)
  const catMap = {};
  me.filter(e => e.type === 'despesa').forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + eVal(e); });
  const catRank = Object.entries(catMap)
    .map(([id, v]) => ({ name: getCatName(id), color: getCatColor(id), value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  const receitas = me.filter(e => e.type === 'receita');
  const despesas = me.filter(e => e.type === 'despesa');

  // Bar chart SVG por categoria
  const maxCat = catRank[0]?.value || 1;
  const catBars = catRank.map(c => {
    const pct = Math.round((c.value / maxCat) * 100);
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;color:#374151;font-weight:600;">${c.name}</span>
          <span style="font-size:12px;color:#6b7280;">${fmt(c.value)}</span>
        </div>
        <div style="height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${c.color};border-radius:3px;"></div>
        </div>
      </div>`;
  }).join('');

  const renderRows = (list) => list.map(e => `
    <tr>
      <td style="padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111827;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.description}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;">${getCatName(e.category)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;">${fmtDate(e.date)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:700;color:${e.type === 'receita' ? '#16a34a' : '#dc2626'};text-align:right;">${e.type === 'receita' ? '+' : ''}${fmt(eVal(e))}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f3f4f6;text-align:center;">
        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${e.statusForMonth === 'pago' ? '#dcfce7' : '#fff7ed'};color:${e.statusForMonth === 'pago' ? '#16a34a' : '#c2410c'};">
          ${e.statusForMonth === 'pago' ? (e.type === 'receita' ? 'Recebido' : 'Pago') : (e.type === 'receita' ? 'A Receber' : 'A Pagar')}
        </span>
      </td>
    </tr>`).join('');

  const now = new Date();
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CashUp — Relatório ${mLabel(monthKey)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #fff; color: #111827; padding: 32px; max-width: 820px; margin: 0 auto; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none !important; }
    @page { margin: 1cm; size: A4; }
  }
  h1 { font-size: 22px; font-weight: 800; color: #111827; }
  h2 { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #f3f4f6; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #111827; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-box { width: 38px; height: 38px; background: linear-gradient(135deg,#0a2a1a,#0d4727); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .meta { font-size: 12px; color: #6b7280; text-align: right; }
  .cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
  .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
  .card-value { font-size: 18px; font-weight: 800; }
  .section { margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { padding: 8px; background: #f9fafb; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; text-align: left; border-bottom: 2px solid #e5e7eb; }
  thead th:last-child, thead th:nth-child(4) { text-align: right; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  .print-btn { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; background: #111827; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 4px 14px rgba(0,0,0,.2); }
  .print-btn:hover { background: #1f2937; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <div class="logo-box">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
    </div>
    <div>
      <h1>CashUp</h1>
      <div style="font-size:12px;color:#6b7280;margin-top:1px;">Relatório Mensal</div>
    </div>
  </div>
  <div class="meta">
    <div style="font-size:18px;font-weight:800;color:#111827;margin-bottom:2px;">${mLabel(monthKey)}</div>
    <div>Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
</div>

<!-- Summary cards -->
<div class="cards">
  <div class="card">
    <div class="card-label">Receitas</div>
    <div class="card-value" style="color:#16a34a;">${fmt(rec)}</div>
  </div>
  <div class="card">
    <div class="card-label">Despesas</div>
    <div class="card-value" style="color:#dc2626;">${fmt(dep)}</div>
  </div>
  <div class="card">
    <div class="card-label">Saldo</div>
    <div class="card-value" style="color:${saldo >= 0 ? '#16a34a' : '#dc2626'};">${fmt(saldo)}</div>
  </div>
  <div class="card" style="background:${saldo >= 0 ? '#f0fdf4' : '#fef2f2'};border-color:${saldo >= 0 ? '#bbf7d0' : '#fecaca'};">
    <div class="card-label">A Pagar</div>
    <div class="card-value" style="color:#c2410c;">${fmt(pend)}</div>
  </div>
</div>

<div class="two-col">
  <!-- Gastos por categoria -->
  ${catRank.length > 0 ? `
  <div class="section">
    <h2>Gastos por Categoria</h2>
    ${catBars}
  </div>` : ''}

  <!-- Resumo -->
  <div class="section">
    <h2>Resumo</h2>
    <table>
      <tbody>
        <tr><td style="padding:7px 0;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Total de lançamentos</td><td style="padding:7px 0;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid #f3f4f6;">${me.length}</td></tr>
        <tr><td style="padding:7px 0;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Receitas</td><td style="padding:7px 0;font-size:12px;font-weight:700;color:#16a34a;text-align:right;border-bottom:1px solid #f3f4f6;">${receitas.length} lançamentos</td></tr>
        <tr><td style="padding:7px 0;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Despesas</td><td style="padding:7px 0;font-size:12px;font-weight:700;color:#dc2626;text-align:right;border-bottom:1px solid #f3f4f6;">${despesas.length} lançamentos</td></tr>
        <tr><td style="padding:7px 0;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Total pago</td><td style="padding:7px 0;font-size:12px;font-weight:700;color:#16a34a;text-align:right;border-bottom:1px solid #f3f4f6;">${fmt(pago)}</td></tr>
        <tr><td style="padding:7px 0;font-size:12px;color:#6b7280;">A pagar / receber</td><td style="padding:7px 0;font-size:12px;font-weight:700;color:#c2410c;text-align:right;">${fmt(pend)}</td></tr>
      </tbody>
    </table>
    ${rec > 0 ? `
    <div style="margin-top:14px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Taxa de economia</div>
      <div style="font-size:22px;font-weight:800;color:${saldo >= 0 ? '#16a34a' : '#dc2626'};">${((Math.max(0, saldo) / rec) * 100).toFixed(1)}%</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px;">do total de receitas</div>
    </div>` : ''}
  </div>
</div>

<!-- Receitas -->
${receitas.length > 0 ? `
<div class="section">
  <h2>Receitas (${receitas.length})</h2>
  <table>
    <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th style="text-align:right;">Valor</th><th style="text-align:center;">Status</th></tr></thead>
    <tbody>${renderRows(receitas)}</tbody>
  </table>
</div>` : ''}

<!-- Despesas -->
${despesas.length > 0 ? `
<div class="section">
  <h2>Despesas (${despesas.length})</h2>
  <table>
    <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th style="text-align:right;">Valor</th><th style="text-align:center;">Status</th></tr></thead>
    <tbody>${renderRows(despesas)}</tbody>
  </table>
</div>` : ''}

<div class="footer">
  <span>CashUp — Controle Financeiro Pessoal</span>
  <span>Relatório de ${mLabel(monthKey)}</span>
</div>

<button class="print-btn no-print" onclick="window.print()">🖨️ Salvar como PDF</button>

<script>
  // Auto-abre o diálogo de impressão após 400ms (tempo para o CSS carregar)
  setTimeout(() => window.print(), 400);
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Fallback: download direto
    Object.assign(document.createElement('a'), { href: url, download: `cashup_${monthKey}.html` }).click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
