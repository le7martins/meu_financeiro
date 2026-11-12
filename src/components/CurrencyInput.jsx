import { useState, useCallback } from 'react';

const BR = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const show = (n) => (n || n === 0) && n !== '' && Number(n) !== 0 ? Number(n).toLocaleString('pt-BR', BR) : '';

// Campo de valor com máscara 1.234,56 (digita só números; os dois últimos são centavos).
// value: número (ou texto numérico). onChange recebe SEMPRE número (0 quando vazio).
// allowNegative: um "-" em qualquer lugar do texto deixa o valor negativo (saldo no cheque especial).
export default function CurrencyInput({ value, onChange, allowNegative = false, placeholder = '0,00', style, ...rest }) {
  const [display, setDisplay] = useState(() => show(parseFloat(value) || 0));
  const [negative, setNegative] = useState(() => allowNegative && parseFloat(value) < 0);
  const handle = useCallback((e) => {
    const raw = e.target.value;
    const neg = allowNegative && (raw.includes('-') || (negative && !/\d/.test(raw) && raw === '-'));
    const digits = raw.replace(/\D/g, '');
    if (!digits) { setDisplay(neg ? '-' : ''); setNegative(neg); onChange(0); return; }
    const num = parseInt(digits, 10) / 100;
    setNegative(neg);
    setDisplay((neg ? '-' : '') + num.toLocaleString('pt-BR', BR));
    onChange(neg ? -num : num);
  }, [onChange, allowNegative, negative]);
  return <input type="text" inputMode={allowNegative ? 'text' : 'numeric'} autoComplete="off" placeholder={placeholder}
    value={display.startsWith('-') ? display : (negative ? '-' + display : display)} onChange={handle} style={style} {...rest} />;
}
