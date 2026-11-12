import { useState, useMemo } from 'react';
import BarSVG from '../../components/BarSVG.jsx';
import Leg from '../../components/Leg.jsx';
import S from '../../styles.js';
import { fmt, mShort, mLabel, addM } from '../../utils.js';

// Projeção: o acumulado parte do saldo ACUMULADO ATÉ HOJE (mês atual incluso), não do mês aberto na tela de Contas.
export default function ProjectionTab({ summary, nowMonth, accumNow }) {
  const [n, setN] = useState(6);
  const rows = useMemo(() => {
    let running = Math.round(((accumNow || 0) + summary(nowMonth).saldo) * 100) / 100;
    return Array.from({ length: n }, (_, i) => {
      const s = summary(addM(nowMonth, i + 1));
      running = Math.round((running + s.saldo) * 100) / 100;
      return { month: s.month, label: mShort(s.month), receitas: s.rec, despesas: s.dep, saldo: s.saldo, cumulative: running };
    });
  }, [summary, nowMonth, accumNow, n]);
  const last = rows[rows.length - 1];
  const sameYear = rows.every(r => r.month.slice(0, 4) === rows[0].month.slice(0, 4));
  const lab = (r) => sameYear ? r.label : `${r.label} ${r.month.slice(2, 4)}`;
  return (
    <div style={S.chartBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ ...S.chartTitle, marginBottom: 0 }}>Projeção de saldo</div>
        <div role="group" aria-label="Meses à frente" style={{ display: 'flex', gap: 5 }}>
          {[3, 6, 12].map(v => (
            <button key={v} type="button" className="fTab" aria-pressed={n === v} aria-label={`Próximos ${v} meses`} onClick={() => setN(v)}
              style={{ ...S.fTab, ...(n === v ? S.fTabActive : {}), padding: '4px 10px', minHeight: 40, fontSize: 'var(--fs-sm)' }}>{v}M</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', margin: '6px 0 12px' }}>Inclui o que já está lançado para esses meses: fixos, parcelas, dívidas, faturas e lançamentos com data futura.</div>
      <BarSVG data={rows.map(r => ({ month: lab(r), receitas: r.receitas, despesas: r.despesas, saldo: r.saldo }))} type="barras" />
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 10 }}>
        <Leg color="var(--chart-2)" label="Receitas" /><Leg color="var(--chart-4)" label="Despesas" />
      </div>
      {last && (
        <div style={{ margin: '14px 0 10px', background: last.cumulative >= 0 ? 'var(--success-soft)' : 'var(--danger-soft)', border: `1px solid ${last.cumulative >= 0 ? 'var(--success-border)' : 'var(--danger-border)'}`, borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>Saldo acumulado em {mLabel(last.month)}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginTop: 2 }}>parte do acumulado até {mLabel(nowMonth)}: {fmt((accumNow || 0) + summary(nowMonth).saldo)}</div>
          </div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: last.cumulative >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>{fmt(last.cumulative)}</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6, padding: '0 10px', fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>
          <span style={{ width: 44 }}>Mês</span><span style={{ flex: 1 }}>Receitas</span><span style={{ flex: 1 }}>Despesas</span><span style={{ minWidth: 70, textAlign: 'right' }}>Acumulado</span>
        </div>
        {rows.map(d => (
          <div key={d.month} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--accent)', width: 44, flexShrink: 0 }}>{lab(d)}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', flex: 1, whiteSpace: 'nowrap' }}>{fmt(d.receitas)}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--orange)', flex: 1, whiteSpace: 'nowrap' }}>{fmt(d.despesas)}</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: d.cumulative >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: 70, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(d.cumulative)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
