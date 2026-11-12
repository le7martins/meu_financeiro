import { useMemo } from 'react';
import DonutSVG from '../../components/DonutSVG.jsx';
import S, { tint } from '../../styles.js';
import { fmt, mShort, mLabel } from '../../utils.js';
import { cardStats } from './summary.js';

// Cartões: tudo pela mesma regra de Contas — a fatura conta no mês em que VENCE, dentro do período escolhido.
export default function CardsTab({ cards, cardPurchases, cardFaturas, today, range, catOf }) {
  const st = useMemo(() => cardStats({ cards, cardPurchases, cardFaturas, today }, range, catOf), [cards, cardPurchases, cardFaturas, today, range, catOf]);
  if (cards.length === 0) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 'var(--fs-base)' }}>Nenhum cartão cadastrado</div>;
  if (cardPurchases.length === 0) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 'var(--fs-base)' }}>Nenhuma compra lançada nos cartões</div>;
  const rows = st.monthly.filter(d => d.total > 0);
  return (<>
    <div style={S.chartBox}>
      <div style={S.chartTitle}>Faturas que vencem no período</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginBottom: 10 }}>Total: <strong style={{ color: 'var(--orange)' }}>{fmt(st.total)}</strong></div>
      {rows.length === 0 && <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-3)', fontSize: 'var(--fs-md)' }}>Sem faturas no período</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map(d => (
          <div key={d.month} style={{ background: 'var(--surface-sunken)', borderRadius: 9, padding: '8px 12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-1)' }}>{range.length === 1 ? mLabel(d.month) : `${mShort(d.month)} ${d.month.slice(2, 4)}`}</span>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--orange)' }}>{fmt(d.total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {cards.filter(c => d.byCard[c.id] > 0).map(c => (
                <span key={c.id} style={{ fontSize: 'var(--fs-sm)', padding: '2px 7px', borderRadius: 5, background: tint(c.color, 13), color: c.color, border: `1px solid ${tint(c.color, 27)}` }}>{c.name}: {fmt(d.byCard[c.id])}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    {st.cats.length > 0 && (
      <div style={S.chartBox}>
        <div style={S.chartTitle}>Gastos por categoria</div>
        <DonutSVG data={st.cats} total={st.total} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {st.cats.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
              <div aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-md)', color: 'var(--text-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>{st.total > 0 ? ((c.value / st.total) * 100).toFixed(1).replace('.', ',') : 0}%</div>
              <div style={{ fontSize: 'var(--fs-md)', color: c.color, fontWeight: 700, minWidth: 78, textAlign: 'right' }}>{fmt(c.value)}</div>
            </div>
          ))}
        </div>
      </div>
    )}
    {st.perCard.length > 0 && (
      <div style={S.chartBox}>
        <div style={S.chartTitle}>Total por cartão</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {st.perCard.map(({ card, total }) => {
            const pct = st.total > 0 ? Math.round((total / st.total) * 100) : 0;
            return (
              <div key={card.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-1)', fontWeight: 600 }}>{card.name}</span>
                  <span style={{ fontSize: 'var(--fs-md)', color: card.color, fontWeight: 700 }}>{fmt(total)} · {pct}%</span>
                </div>
                <div role="progressbar" aria-label={`${card.name}: ${pct}% do total`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ height: 5, background: 'var(--track)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: card.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </>);
}
