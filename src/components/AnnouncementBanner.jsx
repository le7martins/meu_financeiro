import { useState, useEffect } from 'react';
import { subscribeAnnouncement } from '../db';
import { loadLS, saveLS } from '../utils.js';

const KEY = 'mf2_announce_dismissed';

// Faixa com o aviso do administrador. Cada aviso novo (updatedAt diferente) reaparece até ser dispensado.
export default function AnnouncementBanner() {
  const [a, setA] = useState(null);
  const [dismissed, setDismissed] = useState(() => loadLS(KEY, ''));
  useEffect(() => subscribeAnnouncement(setA), []);
  if (!a?.text || a.updatedAt === dismissed) return null;
  const close = () => { setDismissed(a.updatedAt); try { saveLS(KEY, a.updatedAt); } catch { /* sem storage */ } };
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '8px 14px 0', padding: '10px 12px', background: 'var(--info-soft)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-1)', fontSize: 'var(--fs-md)', lineHeight: 1.4 }}>
      <span aria-hidden="true">📢</span>
      <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{a.text}</span>
      <button type="button" aria-label="Dispensar aviso" onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', minWidth: 32, minHeight: 32, fontSize: 'var(--fs-lg)', fontFamily: 'inherit' }}>✕</button>
    </div>
  );
}
