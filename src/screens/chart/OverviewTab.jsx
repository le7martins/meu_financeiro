import { useState, useMemo } from 'react';
import BarSVG from '../../components/BarSVG.jsx';
import Leg from '../../components/Leg.jsx';
import S from '../../styles.js';
import { fmt, fmtShort, mShort, mLabel, addM } from '../../utils.js';

const seg = (on) => ({ ...S.fTab, ...(on ? S.fTabActive : {}), padding: '4px 12px', minHeight: 40, fontSize: 'var(--fs-sm)' });

// Visão geral: receitas × despesas (barras) ou saldo (linha) mês a mês.
// Em "mês" mostra a tendência até o mês escolhido (6/12 meses ou o ano); em "período" usa o intervalo.
export default function OverviewTab({ summary, nowMonth, specMonth, range, mode }) {
  const [win, setWin] = useState('6');
  const [view, setView] = useState('barras');

  const months = useMemo(() => {
    if (mode === 'periodo') return range;
    if (win === 'ano') { const y = specMonth.slice(0, 4); return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`); }
    const n = parseInt(win);
    return Array.from({ length: n }, (_, i) => addM(specMonth, i - n + 1));
  }, [mode, win, specMonth, range]);

  const rows = months.map(m => ({ ...summary(m), future: m > nowMonth }));
  const sameYear = months.every(m => m.slice(0, 4) === months[0].slice(0, 4));
  const label = (m) => sameYear ? mShort(m) : `${mShort(m)} ${m.slice(2, 4)}`;
  const data = rows.map(r => ({ month: label(r.month), receitas: r.rec, despesas: r.dep, saldo: r.saldo }));

  // Médias só sobre meses já ocorridos e com movimento (meses vazios não puxam a média para baixo)
  const withData = rows.filter(r => !r.future && (r.rec > 0 || r.dep > 0));
  const avg = (k) => withData.length ? withData.reduce((s, r) => s + r[k], 0) / withData.length : 0;
  const best = withData.reduce((b, r) => (!b || r.saldo > b.saldo ? r : b), null);
  const hasFuture = rows.some(r => r.future);
  const real = rows.filter(r => !r.future);
  const totRec = real.reduce((s, r) => s + r.rec, 0), totDep = real.reduce((s, r) => s + r.dep, 0);
  const planned = rows.filter(r => r.future);
  const plRec = planned.reduce((s, r) => s + r.rec, 0), plDep = planned.reduce((s, r) => s + r.dep, 0);

  return (
    <div style={S.chartBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...S.chartTitle, marginBottom: 0 }}>{view === 'barras' ? 'Receitas × Despesas' : 'Evolução do saldo'}</div>
        <div role="group" aria-label="Tipo de gráfico" style={{ display: 'flex', gap: 5 }}>
          {[['barras', 'Barras'], ['saldo', 'Saldo']].map(([v, l]) => <button key={v} type="button" className="fTab" aria-pressed={view === v} onClick={() => setView(v)} style={seg(view === v)}>{l}</button>)}
        </div>
      </div>
      {mode === 'mes' && (
        <div role="group" aria-label="Janela de meses" style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {[['6', '6 meses'], ['12', '12 meses'], ['ano', 'Ano ' + specMonth.slice(0, 4)]].map(([v, l]) => <button key={v} type="button" className="fTab" aria-pressed={win === v} onClick={() => setWin(v)} style={{ ...seg(win === v), flex: 1, justifyContent: 'center' }}>{l}</button>)}
        </div>
      )}

      <BarSVG data={data} type={view === 'barras' ? 'barras' : 'evolucao'} />
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 10 }}>
        <Leg color="var(--chart-2)" label="Receitas" /><Leg color="var(--chart-4)" label="Despesas" />
        {view === 'saldo' && <Leg color="var(--chart-1)" label="Saldo" dashed />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6, marginTop: 14 }}>
        {[{ l: 'Média receita', v: fmtShort(avg('rec')), c: 'var(--success)' }, { l: 'Média despesa', v: fmtShort(avg('dep')), c: 'var(--orange)' },
          { l: best ? `Melhor saldo · ${mShort(best.month)}` : 'Melhor saldo', v: best ? fmtShort(best.saldo) : '—', c: best && best.saldo < 0 ? 'var(--danger)' : 'var(--success)' }].map(({ l, v, c }) => (
          <div key={l} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginBottom: 3, lineHeight: 1.3 }}>{l}</div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginTop: 6 }}>
        Médias dos {withData.length} {withData.length === 1 ? 'mês' : 'meses'} com movimento.
        {hasFuture && ` Realizado: ${fmt(totRec - totDep)} · previsto nos meses seguintes: ${fmt(plRec - plDep)}.`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
        {rows.map((r, i) => (
          <div key={r.month} role="group" aria-label={`${mLabel(r.month)}${r.future ? ' (previsto)' : ''}: receitas ${fmt(r.rec)}, despesas ${fmt(r.dep)}, saldo ${fmt(r.saldo)}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '4px 8px', borderRadius: 7, opacity: r.future ? 0.65 : 1,
              background: r.month === nowMonth ? 'var(--surface-sunken)' : 'transparent', border: r.month === nowMonth ? '1px solid var(--border-subtle)' : '1px solid transparent' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: r.month === nowMonth ? 'var(--text-1)' : 'var(--text-3)', fontWeight: r.month === nowMonth ? 700 : 500, width: 44, flexShrink: 0 }}>{data[i].month}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', flex: 1, whiteSpace: 'nowrap' }}>↑ {r.rec > 0 ? fmtShort(r.rec) : '—'}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--orange)', flex: 1, whiteSpace: 'nowrap' }}>↓ {r.dep > 0 ? fmtShort(r.dep) : '—'}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: r.saldo >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: 64, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {r.rec === 0 && r.dep === 0 ? '—' : `${r.saldo >= 0 ? '+' : ''}${fmtShort(r.saldo)}`}{r.future ? ' prev.' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
