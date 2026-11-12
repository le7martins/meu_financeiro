import { useState, useId } from 'react';

// Seção recolhível (fechada por padrão): usada para o que é configuração, não consulta diária.
export default function Collapsible({ title, hint, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}
        style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-1)', textAlign: 'left' }}>
        <span>
          <span style={{ display: 'block', fontSize: 'var(--fs-base)', fontWeight: 700 }}>{title}</span>
          {hint && <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginTop: 1, fontWeight: 400 }}>{hint}</span>}
        </span>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, color: 'var(--text-3)' }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>{children}</div>}
    </div>
  );
}
