import { useState } from 'react';
import MonthPicker from '../../components/MonthPicker.jsx';
import S from '../../styles.js';
import { fmt, mLabel } from '../../utils.js';
import { categoryRanking } from './summary.js';
import { renderRelatorio } from './relatorioCanvas.js';

// Relatório mensal em imagem (PNG): compartilha pelo celular ou baixa no computador.
export default function ReportCard({ summary, nowMonth, catOf, toast }) {
  const [month, setMonth] = useState(nowMonth);
  const [busy, setBusy] = useState(false);
  const s = summary(month);
  const cats = categoryRanking(summary, [month], 'despesa', catOf);
  const top = cats[0];

  const generate = async () => {
    setBusy(true);
    try {
      const blob = await renderRelatorio({ month, rec: s.rec, dep: s.dep, pago: s.pago, cats });
      const file = new File([blob], `cashup-${month}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Relatório CashUp – ${mLabel(month)}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `cashup-${month}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast?.('Imagem do relatório baixada');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') { console.error(e); toast?.('Não foi possível gerar a imagem do relatório', 'error'); }
    }
    setBusy(false);
  };

  const Stat = ({ l, v, c }) => <div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>{l}</div><div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: c }}>{v}</div></div>;
  return (
    <div style={S.chartBox}>
      <div style={S.chartTitle}>Relatório mensal</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', margin: '-8px 0 12px' }}>Gera uma imagem para compartilhar</div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ ...S.lbl, marginBottom: 6 }}>Mês do relatório</label>
        <MonthPicker value={month} onChange={setMonth} now={nowMonth} />
      </div>
      <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: top ? 8 : 0 }}>
          <Stat l="Receitas" v={fmt(s.rec)} c="var(--success)" />
          <Stat l="Despesas" v={fmt(s.dep)} c="var(--orange)" />
          <Stat l="Saldo" v={fmt(s.saldo)} c={s.saldo >= 0 ? 'var(--success)' : 'var(--danger)'} />
          <Stat l="% pago" v={`${s.dep > 0 ? Math.round((s.pago / s.dep) * 100) : 0}%`} c="var(--text-1)" />
        </div>
        {top && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>Maior gasto: <span style={{ color: top.color, fontWeight: 600 }}>{top.name} ({fmt(top.value)})</span></div>}
      </div>
      <button type="button" onClick={generate} disabled={busy}
        style={{ width: '100%', minHeight: 46, background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 'var(--radius-md)', color: 'var(--primary-text)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}>
        {busy ? 'Gerando…' : 'Gerar e compartilhar'}
      </button>
    </div>
  );
}
