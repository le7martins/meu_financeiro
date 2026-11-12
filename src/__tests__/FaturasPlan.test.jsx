// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FaturasPlan from '../components/FaturasPlan.jsx';

const card = { id: 'c1', name: 'Nubank', color: '#8b5cf6', closeDay: 3, dueDay: 10, limit: 5000 };
// R$ 300 em 3x no dia 01/11 (antes do fechamento dia 3): parcelas de 100 em nov, dez e jan.
const purchases = [{ id: 'p1', cardId: 'c1', description: 'Notebook', amount: 300, installments: 3, purchaseDate: '2026-11-01', category: 'outro' }];
// A fatura de nov (fecha 03/11) vence em dezembro: é a "fatura do mês" de dezembro.
const base = { cards: [card], cardPurchases: purchases, cardFaturas: {}, nowMonth: '2026-12' };

describe('FaturasPlan', () => {
  test('mostra a fatura do mês por cartão e a projeção dos próximos meses', () => {
    render(<FaturasPlan {...base}/>);
    expect(screen.getByText('Faturas que vencem no mês')).toBeTruthy();
    expect(screen.getByText('Nubank')).toBeTruthy();
    expect(screen.getAllByText('100,00').length).toBeGreaterThanOrEqual(3); // total, linha do cartão, uma das projeções
    expect(screen.getByText('100,00 a pagar')).toBeTruthy();
    for (const m of ['Jan', 'Fev', 'Mar']) expect(screen.getByText(m)).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // março sem parcela
  });

  test('pagamento parcial abate do que falta pagar', () => {
    render(<FaturasPlan {...base} cardFaturas={{ 'c1_2026-11': { paid: false, partial: true, paidAmount: 40 } }}/>);
    expect(screen.getByText('60,00 a pagar')).toBeTruthy();
  });

  test('fatura paga mostra "tudo pago"', () => {
    render(<FaturasPlan {...base} cardFaturas={{ 'c1_2026-11': { paid: true, paidAmount: 100 } }}/>);
    expect(screen.getByText('tudo pago')).toBeTruthy();
    expect(screen.getByText('Paga')).toBeTruthy();
  });

  test('envelope do cartão: uso do orçamento', () => {
    render(<FaturasPlan {...base} budget={400}/>);
    expect(screen.getByText('Envelope Cartão')).toBeTruthy();
    expect(screen.getByText('100,00 de 400,00')).toBeTruthy();
  });

  test('sem compras em nenhum mês não renderiza nada', () => {
    const { container } = render(<FaturasPlan {...base} cardPurchases={[]}/>);
    expect(container.firstChild).toBeNull();
  });
});
