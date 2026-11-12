import { useState, useCallback, useRef } from 'react';

// Fila de toasts. type: "success" | "error" | "info" | "celebrate".
// Com actionLabel/onAction (ex.: "Desfazer") o toast fica 5s em vez de 3s.
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);
  const toast = useCallback((msg, type = "success", actionLabel = null, onAction = null) => {
    const id = ++seq.current;
    setToasts(p => [...p, { id, msg, type, actionLabel, onAction }].slice(-3)); // no máximo 3 na tela
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), actionLabel ? 5000 : 3000);
  }, []);
  return { toasts, toast, dismiss };
}
