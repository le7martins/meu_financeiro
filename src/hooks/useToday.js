import { useState, useEffect } from 'react';
import { todayISO } from '../utils.js';

// Data de hoje (YYYY-MM-DD) que se atualiza quando vira o dia — ao voltar o app
// para o primeiro plano ou por checagem periódica. Use nas dependências dos
// useMemo que calculam vencimentos/faturas abertas.
export function useToday() {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const refresh = () => setToday(prev => { const t = todayISO(); return t === prev ? prev : t; });
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}
