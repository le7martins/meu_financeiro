import { useState, useMemo } from 'react';
import DonutSVG from '../../components/DonutSVG.jsx';
import S from '../../styles.js';
import { fmt } from '../../utils.js';
import { categoryRanking } from './summary.js';

export default function CategoriesTab({ summary, range, catOf }) {
  const [view, setView] = useState('despesa');
  const data = useMemo(() => categoryRanking(summary, range, view, catOf), [summary, range, view, catOf]);
  const total = data.reduce((s, c) => s + c.value, 0);
  return (
    <div style={S.chartBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ ...S.chartTitle, marginBottom: 0 }}>Por categoria</div>
        <div role="group" aria-label="Tipo" style={{ display: 'flex', gap: 5 }}>
          {[['despesa', 'Despesas'], ['receita', 'Receitas']].map(([v, l]) => (
            <button key={v} type="button" className="fTab" aria-pressed={view === v} onClick={() => setView(v)}
              style={{ ...S.fTab, ...(view === v ? S.fTabActive : {}), padding: '4px 10px', minHeight: 40, fontSize: 'var(--fs-sm)' }}>{l}</button>
          ))}
        </div>
      </div>
      {data.length === 0
        ? <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 'var(--fs-base)' }}>Sem dados no período</div>
        : (<>
          <DonutSVG data={data} total={total} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
            {data.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
                <div aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-md)', color: 'var(--text-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>{total > 0 ? ((c.value / total) * 100).toFixed(1).replace('.', ',') : 0}%</div>
                <div style={{ fontSize: 'var(--fs-md)', color: c.color, fontWeight: 700, minWidth: 78, textAlign: 'right' }}>{fmt(c.value)}</div>
              </div>
            ))}
          </div>
        </>)}
    </div>
  );
}
