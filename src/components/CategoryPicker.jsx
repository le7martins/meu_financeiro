import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import CatSelector from './CatSelector.jsx';
import S, { tint } from '../styles.js';
import { useDialog } from './Field.jsx';

const chip = (sel, color) => ({
  minHeight: 44, padding: '0 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${sel ? color : 'var(--border-subtle)'}`,
  background: sel ? tint(color, 13) : 'var(--surface-hover)', color: sel ? color : 'var(--text-2)',
  fontSize: 'var(--fs-md)', fontWeight: sel ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
});
const MAX_CHIPS = 5;

// Categoria do lançamento: as mais usadas em chips e o resto (mais gerenciar/criar) numa folha "Mais".
// cats já vêm filtradas pelo tipo do lançamento.
export default function CategoryPicker({ cats, selected, onSelect, entries, type, selectorProps }) {
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => {
    const counts = {};
    for (const e of entries) if (e.type === type) counts[e.category] = (counts[e.category] || 0) + 1;
    const ranked = [...cats].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    if (cats.length <= MAX_CHIPS) return cats;
    let top = ranked.slice(0, MAX_CHIPS);
    const sel = cats.find(c => c.id === selected);
    if (sel && !top.some(c => c.id === sel.id)) top = [...top.slice(0, MAX_CHIPS - 1), sel]; // a escolhida sempre aparece
    return top;
  }, [cats, entries, type, selected]);
  const hasMore = cats.length > MAX_CHIPS;
  const { dialogProps, titleId } = useDialog(() => setOpen(false));

  return (
    <div style={{ marginBottom: 14 }} role="group" aria-label="Categoria">
      <div style={{ ...S.lbl, marginBottom: 8 }}>Categoria</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {shown.map(c => <button key={c.id} type="button" aria-pressed={selected === c.id} onClick={() => onSelect(c.id)} style={chip(selected === c.id, c.color)}>{c.name}</button>)}
        <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} style={{ ...chip(false, 'var(--accent)'), borderStyle: 'dashed', color: 'var(--accent)' }}>{hasMore ? 'Mais' : 'Editar'} ›</button>
      </div>
      {open && createPortal(
        <div className="appOverlay" style={{ ...S.overlay, fontFamily: 'var(--font-sans)', color: 'var(--text-1)', zIndex: 120 }} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div {...dialogProps} style={{ ...S.modal, outline: 'none' }} className="modal-in">
            <div style={S.modalHandle} />
            <div style={S.mHeader}>
              <div id={titleId} style={S.mTitle}>Categorias de {type === 'receita' ? 'receita' : 'despesa'}</div>
              <button type="button" aria-label="Fechar" style={S.xBtn} onClick={() => setOpen(false)}>✕</button>
            </div>
            <CatSelector {...selectorProps} cats={cats} selected={selected} onSelect={id => { onSelect(id); setOpen(false); }} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
