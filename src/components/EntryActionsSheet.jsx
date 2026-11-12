import ActionsSheet, { ICONS } from './ActionsSheet.jsx';

// Menu de ações de um lançamento: editar, clonar, excluir + detalhes que não cabem no card.
export default function EntryActionsSheet({ entry, flags = [], extra = null, onEdit, onClone, onDelete, onClose }) {
  const tags = entry.tags || [];
  const hasDetails = extra || entry.notes || tags.length > 0 || flags.length > 0;
  const details = hasDetails ? (<>
    {extra && <div style={{ color: 'var(--text-3)' }}>{extra}</div>}
    {flags.map(f => <div key={f.key} style={{ color: `var(--${f.token})`, fontWeight: 600 }}><span aria-hidden="true">{f.glyph} </span>{f.text}</div>)}
    {entry.notes && <div style={{ overflowWrap: 'anywhere' }}>{entry.notes}</div>}
    {tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{tags.map(t => <span key={t} style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 'var(--radius-xs)', padding: '2px 7px' }}>#{t}</span>)}</div>}
  </>) : null;
  return (
    <ActionsSheet title={entry.description} subtitle="Ações do lançamento" details={details} onClose={onClose} actions={[
      { key: 'edit', label: 'Editar', hint: 'Alterar valor, categoria, status…', token: 'accent', bg: 'accent-surface', icon: ICONS.edit, onSelect: () => onEdit(entry) },
      { key: 'clone', label: 'Clonar', hint: 'Criar uma cópia deste lançamento', token: 'success', bg: 'success-soft', icon: ICONS.clone, onSelect: () => onClone(entry) },
      { key: 'delete', label: 'Excluir', hint: 'Remover este lançamento', token: 'danger', bg: 'danger-soft', icon: ICONS.delete, onSelect: () => onDelete(entry) },
    ]}/>
  );
}
