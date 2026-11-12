import { createPortal } from 'react-dom';
import S from '../styles.js';
import { useDialog } from './Field.jsx';

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const ACTIONS = [
  { key: 'edit', label: 'Editar', hint: 'Alterar valor, categoria, status…', token: 'accent', bg: 'accent-surface',
    svg: <svg {...icon}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
  { key: 'clone', label: 'Clonar', hint: 'Criar uma cópia deste lançamento', token: 'success', bg: 'success-soft',
    svg: <svg {...icon}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> },
  { key: 'delete', label: 'Excluir', hint: 'Remover este lançamento', token: 'danger', bg: 'danger-soft',
    svg: <svg {...icon}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> },
];

// Menu de ações de um lançamento (painel que sobe da base). Renderizado no body para não
// herdar o transform do card nem receber o gesto de deslizar dele.
export default function EntryActionsSheet({ entry, flags = [], extra = null, onEdit, onClone, onDelete, onClose }) {
  const { dialogProps, titleId } = useDialog(onClose);
  const handlers = { edit: onEdit, clone: onClone, delete: onDelete };
  const stop = (e) => e.stopPropagation();
  const tags = entry.tags || [];
  const hasDetails = extra || entry.notes || tags.length > 0 || flags.length > 0;
  return createPortal(
    <div className="appOverlay" style={{ ...S.overlay, fontFamily: 'var(--font-sans)', color: 'var(--text-1)' }} onClick={e => e.target === e.currentTarget && onClose()}
      onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop}>
      <div {...dialogProps} style={{ ...S.modal, maxHeight: 'auto', outline: 'none' }} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}>
          <div style={{ minWidth: 0 }}>
            <div id={titleId} style={{ ...S.mTitle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>Ações do lançamento</div>
          </div>
          <button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        {hasDetails && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-md)', color: 'var(--text-2)' }}>
            {extra && <div style={{ color: 'var(--text-3)' }}>{extra}</div>}
            {flags.map(f => <div key={f.key} style={{ color: `var(--${f.token})`, fontWeight: 600 }}><span aria-hidden="true">{f.glyph} </span>{f.text}</div>)}
            {entry.notes && <div style={{ overflowWrap: 'anywhere' }}>{entry.notes}</div>}
            {tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{tags.map(t => <span key={t} style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 'var(--radius-xs)', padding: '2px 7px' }}>#{t}</span>)}</div>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ACTIONS.map(a => (
            <button key={a.key} type="button" onClick={() => { onClose(); handlers[a.key](entry); }}
              style={{ ...S.scopeBtn, fontFamily: 'inherit', textAlign: 'left', borderColor: `var(--${a.token}-border, var(--border))`, color: `var(--${a.token})`, background: `var(--${a.bg})` }}>
              {a.svg}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>{a.label}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 1 }}>{a.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
