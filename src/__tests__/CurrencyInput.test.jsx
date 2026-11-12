// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CurrencyInput from '../components/CurrencyInput.jsx';

const type = (el, text) => fireEvent.change(el, { target: { value: text } });

afterEach(cleanup);

describe('CurrencyInput', () => {
  test('máscara 1.234,56 e devolve número', () => {
    const onChange = vi.fn();
    render(<CurrencyInput aria-label="v" value={0} onChange={onChange} />);
    const el = screen.getByLabelText('v');
    type(el, '123456');
    expect(el.value).toBe('1.234,56');
    expect(onChange).toHaveBeenLastCalledWith(1234.56);
  });
  test('vazio vira 0', () => {
    const onChange = vi.fn();
    render(<CurrencyInput aria-label="v" value={5} onChange={onChange} />);
    const el = screen.getByLabelText('v');
    expect(el.value).toBe('5,00');
    type(el, '');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
  test('saldo negativo quando permitido', () => {
    const onChange = vi.fn();
    render(<CurrencyInput aria-label="v" allowNegative value={-250.5} onChange={onChange} />);
    const el = screen.getByLabelText('v');
    expect(el.value).toBe('-250,50');
    type(el, '-12345');
    expect(onChange).toHaveBeenLastCalledWith(-123.45);
  });
  test('sem allowNegative o sinal é ignorado', () => {
    const onChange = vi.fn();
    render(<CurrencyInput aria-label="v" value={0} onChange={onChange} />);
    type(screen.getByLabelText('v'), '-500');
    expect(onChange).toHaveBeenLastCalledWith(5);
  });
});
