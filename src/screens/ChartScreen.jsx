import { useState, useMemo } from 'react';
import SumCard from '../components/SumCard.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import OverviewTab from './chart/OverviewTab.jsx';
import CategoriesTab from './chart/CategoriesTab.jsx';
import ProjectionTab from './chart/ProjectionTab.jsx';
import CompareTab from './chart/CompareTab.jsx';
import CardsTab from './chart/CardsTab.jsx';
import ReportCard from './chart/ReportCard.jsx';
import { useChartSummary, sumMonths, categoryRanking } from './chart/summary.js';
import { fmt, mLabel, addM } from '../utils.js';
import S from '../styles.js';

const TABS = [['geral', 'Visão geral'], ['categorias', 'Categorias'], ['projecao', 'Projeção'], ['comparar', 'Comparar'], ['cartoes', 'Cartões']];
const PERIOD_TABS = ['geral', 'categorias', 'cartoes']; // abas que usam o período escolhido

// Análise: gráficos e relatórios. Todos os números vêm de getMonthEntries (mesma regra da tela de Contas).
export default function ChartScreen({ entries, dividas, categories, nowMonth, cards, cardPurchases, cardFaturas, accumSaldo, today, toast }) {
  const [tab, setTab] = useState('geral');
  const [mode, setMode] = useState('mes');
  const [specMonth, setSpecMonth] = useState(nowMonth);
  const [fromMonth, setFromMonth] = useState(addM(nowMonth, -5));
  const [toMonth, setToMonth] = useState(nowMonth);

  const catOf = useMemo(() => (id) => categories.find(c => c.id === id) || { color: 'var(--text-3)', name: id }, [categories]);
  const summary = useChartSummary({ entries, dividas, cards, cardPurchases, cardFaturas, today });

  const { range, truncated } = useMemo(() => {
    if (mode === 'mes') return { range: [specMonth], truncated: false };
    const lo = fromMonth <= toMonth ? fromMonth : toMonth, hi = fromMonth <= toMonth ? toMonth : fromMonth;
    const months = []; for (let m = lo; m <= hi; m = addM(m, 1)) months.push(m);
    return { range: months.slice(0, 24), truncated: months.length > 24 };
  }, [mode, specMonth, fromMonth, toMonth]);

  const usesPeriod = PERIOD_TABS.includes(tab);
  const totals = useMemo(() => sumMonths(summary, range), [summary, range]);
  const insights = useMemo(() => {
    if (range.length < 2) return null;
    const maxM = range.reduce((best, m) => summary(m).dep > summary(best).dep ? m : best, range[0]);
    return { maxM, maxDep: summary(maxM).dep, topCat: categoryRanking(summary, range, 'despesa', catOf)[0] || null };
  }, [summary, range, catOf]);

  const modeBtn = (m, label) => (
    <button type="button" className="fTab" aria-pressed={mode === m} onClick={() => setMode(m)}
      style={{ ...S.fTab, minHeight: 44, flex: 1, justifyContent: 'center', ...(mode === m ? S.fTabActive : {}) }}>{label}</button>
  );

  return (
    <div style={{ paddingBottom: 'calc(152px + env(safe-area-inset-bottom, 0px))', paddingTop: 4 }}>
      <div role="tablist" aria-label="Tipo de análise" className="hscroll" style={{ display: 'flex', gap: 6, padding: '12px 14px', overflowX: 'auto' }}>
        {TABS.map(([t, l]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="fTab" onClick={() => setTab(t)}
            style={{ ...S.fTab, minHeight: 44, flexShrink: 0, padding: '0 16px', justifyContent: 'center', ...(tab === t ? S.fTabActive : {}) }}>{l}</button>
        ))}
      </div>

      {usesPeriod && (<>
        <div style={{ padding: '0 14px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>{modeBtn('mes', 'Mês')}{modeBtn('periodo', 'Período')}</div>
          {mode === 'mes'
            ? <div style={{ marginBottom: 12 }}><MonthPicker value={specMonth} onChange={setSpecMonth} now={nowMonth} /></div>
            : (<div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}><label style={{ ...S.lbl, marginBottom: 5 }}>De</label><MonthPicker value={fromMonth} onChange={setFromMonth} now={nowMonth} /></div>
              <div style={{ flex: 1 }}><label style={{ ...S.lbl, marginBottom: 5 }}>Até</label><MonthPicker value={toMonth} onChange={setToMonth} now={nowMonth} /></div>
            </div>)}
          {truncated && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warning)', marginBottom: 10 }}>Período limitado a 24 meses (de {mLabel(range[0])} a {mLabel(range[range.length - 1])}).</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 14px 10px' }}>
          <SumCard label="Receitas" value={fmt(totals.rec)} color="var(--success)" icon="↑" />
          <SumCard label="Despesas" value={fmt(totals.dep)} color="var(--orange)" icon="↓" />
          <SumCard label="Saldo" value={fmt(totals.saldo)} color={totals.saldo >= 0 ? 'var(--success)' : 'var(--danger)'} icon={totals.saldo >= 0 ? '◈' : '▽'} wide />
        </div>
        {insights && tab !== 'cartoes' && (
          <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['Mês com maior gasto', `${mLabel(insights.maxM)} · ${fmt(insights.maxDep)}`, 'var(--orange)'],
              insights.topCat && ['Maior gasto por categoria', `${insights.topCat.name} · ${fmt(insights.topCat.value)}`, insights.topCat.color]].filter(Boolean).map(([l, v, c]) => (
              <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px' }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </>)}

      <div style={{ padding: '0 14px' }}>
        {tab === 'geral' && <OverviewTab summary={summary} nowMonth={nowMonth} specMonth={specMonth} range={range} mode={mode} />}
        {tab === 'categorias' && <CategoriesTab summary={summary} range={range} catOf={catOf} />}
        {tab === 'projecao' && <ProjectionTab summary={summary} nowMonth={nowMonth} accumNow={accumSaldo} />}
        {tab === 'comparar' && <CompareTab summary={summary} nowMonth={nowMonth} catOf={catOf} />}
        {tab === 'cartoes' && <CardsTab cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas} today={today} range={range} catOf={catOf} />}
        <ReportCard summary={summary} nowMonth={nowMonth} catOf={catOf} toast={toast} />
      </div>
    </div>
  );
}
