import { useState, useMemo } from 'react';
import S from '../../styles.js';
import { fmt, mShort, addM } from '../../utils.js';

const MonthStepper = ({ label, color, month, setMonth }) => (
  <div style={{ flex: 1, textAlign: 'center' }}>
    <div style={{ fontSize: 'var(--fs-sm)', color, fontWeight: 700, marginBottom: 5 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
      <button type="button" onClick={() => setMonth(p => addM(p, -1))} aria-label={`${label} anterior`} style={{ minWidth: 44, minHeight: 44, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', color: 'var(--text-2)', cursor: 'pointer' }}>‹</button>
      <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color, minWidth: 66, textAlign: 'center' }}>{mShort(month)} {month.slice(2, 4)}</span>
      <button type="button" onClick={() => setMonth(p => addM(p, 1))} aria-label={`${label} seguinte`} style={{ minWidth: 44, minHeight: 44, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', color: 'var(--text-2)', cursor: 'pointer' }}>›</button>
    </div>
  </div>
);

// Compara dois meses. Para despesa, gastar MAIS é ruim (vermelho); para receita e saldo, mais é bom (verde).
export default function CompareTab({ summary, nowMonth, catOf }) {
  const [a, setA] = useState(nowMonth);
  const [b, setB] = useState(addM(nowMonth, -1));
  const sa = summary(a), sb = summary(b);

  const cats = useMemo(() => {
    const ids = new Set([...Object.keys(sa.byCat.despesa), ...Object.keys(sb.byCat.despesa)]);
    return [...ids].map(id => ({ id, ...catOf(id), va: sa.byCat.despesa[id] || 0, vb: sb.byCat.despesa[id] || 0 }))
      .sort((x, y) => Math.max(y.va, y.vb) - Math.max(x.va, x.vb)).slice(0, 6);
  }, [sa, sb, catOf]);

  const tone = (diff, higherIsBad) => diff === 0 ? 'var(--text-3)' : (diff > 0) === higherIsBad ? 'var(--danger)' : 'var(--success)';
  const signed = (d) => `${d > 0 ? '+' : ''}${fmt(d)}`;
  const Row = ({ label, va, vb, higherIsBad }) => {
    const max = Math.max(Math.abs(va), Math.abs(vb), 1), diff = Math.round((va - vb) * 100) / 100;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-2)', fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 'var(--fs-sm)', color: tone(diff, higherIsBad), fontWeight: 700 }}>{signed(diff)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', width: 72, textAlign: 'right' }}>{fmt(va)}</span>
          <div style={{ flex: 1, height: 8, background: 'var(--surface-sunken)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', right: '50%', height: '100%', width: `${(Math.abs(va) / max) * 50}%`, background: 'var(--accent)', borderRadius: '4px 0 0 4px', opacity: 0.85 }} />
            <div style={{ position: 'absolute', left: '50%', height: '100%', width: `${(Math.abs(vb) / max) * 50}%`, background: 'var(--orange)', borderRadius: '0 4px 4px 0', opacity: 0.85 }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--border)' }} />
          </div>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--orange)', width: 72 }}>{fmt(vb)}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={S.chartBox}>
      <div style={S.chartTitle}>Comparar meses</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <MonthStepper label="Mês A" color="var(--accent)" month={a} setMonth={setA} />
        <MonthStepper label="Mês B" color="var(--orange)" month={b} setMonth={setB} />
      </div>
      <Row label="Receitas" va={sa.rec} vb={sb.rec} higherIsBad={false} />
      <Row label="Despesas" va={sa.dep} vb={sb.dep} higherIsBad />
      <Row label="Saldo" va={sa.saldo} vb={sb.saldo} higherIsBad={false} />
      {cats.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Despesas por categoria (A · diferença · B)</div>
          {cats.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
              <div aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-md)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', width: 66, textAlign: 'right' }}>{fmt(c.va)}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: tone(c.va - c.vb, true), width: 70, textAlign: 'right', fontWeight: 700 }}>{signed(Math.round((c.va - c.vb) * 100) / 100)}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--orange)', width: 66 }}>{fmt(c.vb)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
