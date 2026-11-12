// @vitest-environment jsdom
// Teste de fumaça do app inteiro: Firebase mockado, dados vindos da "nuvem".
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { todayISO, getNow } from '../utils.js';

const USER = { uid: 'u1', email: 'teste@exemplo.com', displayName: 'Teste' };
const NOW = getNow();
const cloud = {};
const saveData = vi.fn(() => Promise.resolve());

vi.mock('../firebase', () => ({ auth: {}, db: {}, messaging: null, googleProvider: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_a, cb) => { cb(USER); return () => {}; }, signOut: vi.fn() }));
vi.mock('../LoginScreen', () => ({ default: () => <div>login</div> }));
vi.mock('../fcm', () => ({ registerFCMToken: vi.fn(), onForegroundMessage: () => () => {} }));
vi.mock('../db', () => ({
  ADMIN_EMAIL: 'admin@exemplo.com',
  loadUserData: () => Promise.resolve(cloud),
  saveData: (...a) => saveData(...a),
  subscribeData: () => () => {},
  saveUserProfile: vi.fn(),
}));

const { default: App } = await import('../App.jsx');

const findCard = async (text) => { await waitFor(() => expect(cardWith(text)).toBeTruthy()); return cardWith(text); };
const cardWith = (text) => [...document.querySelectorAll('.eCard')].find(c => c.textContent.includes(text)) || null;
const lastSave = (type) => saveData.mock.calls.filter(c => c[1] === type).at(-1)?.[2];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('mf2_u1_onboarding_done', 'true');
  saveData.mockClear();
  Object.assign(cloud, {
    entries: [
      { id: 'e1', description: 'Conta de Luz', amount: 150, date: todayISO(), type: 'despesa', status: 'a_pagar', category: 'outro', recurrence: 'none', statusByMonth: {}, overrides: {} },
      { id: 'e2', description: 'Salário', amount: 5000, date: `${NOW}-01`, type: 'receita', status: 'pago', category: 'salario', recurrence: 'fixed', statusByMonth: { [NOW]: 'pago' }, overrides: {} },
    ],
    dividas: [], cards: [], purchases: [], faturas: {},
    settings: { accounts: [{ id: 'a1', name: 'Nubank', initialBalance: 100, color: '#820ad1' }], theme: 'dark' },
  });
});
afterEach(cleanup);

describe('App (fumaça)', () => {
  test('carrega dados da nuvem e mostra a aba Contas', async () => {
    render(<App />);
    expect(await findCard('Conta de Luz')).toBeTruthy();
    expect(cardWith('Salário')).toBeTruthy();
    expect(screen.getByText('CashUp')).toBeTruthy();
    expect(screen.getByText('Mês atual')).toBeTruthy();
  });

  test('marcar como pago grava na nuvem', async () => {
    render(<App />);
    const card = await findCard('Conta de Luz');
    fireEvent.click(within(card).getByLabelText(/^A pagar:/));
    await waitFor(() => expect(lastSave('entries')?.find(e => e.id === 'e1').status).toBe('pago'));
    expect(within(card).getByLabelText(/^Pago:/)).toBeTruthy();
  });

  test('trocar o tema preserva as contas no doc de settings (regressão)', async () => {
    render(<App />);
    await findCard('Conta de Luz');
    fireEvent.click(screen.getByTitle('Mudar para tema claro'));
    await waitFor(() => expect(lastSave('settings')).toBeTruthy());
    expect(lastSave('settings')).toMatchObject({ theme: 'light', accounts: [{ id: 'a1' }] });
  });

  test('painel de filtros: filtra por tipo e limpa', async () => {
    render(<App />);
    await findCard('Conta de Luz');
    fireEvent.click(screen.getByLabelText('Filtros'));
    fireEvent.click(screen.getByRole('button', { name: /^Receitas/ }));
    expect(cardWith('Conta de Luz')).toBeNull();
    expect(cardWith('Salário')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(cardWith('Conta de Luz')).toBeTruthy();
  });

  test('novo lançamento pelo formulário', async () => {
    render(<App />);
    await findCard('Conta de Luz');
    fireEvent.keyDown(window, { key: 'n' }); // atalho: nova despesa
    fireEvent.change(await screen.findByPlaceholderText('Ex: Conta de luz, aluguel...'), { target: { value: 'Internet' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '9990' } }); // máscara: dígitos = centavos
    fireEvent.click(document.querySelector('.submitBtn'));
    await waitFor(() => expect(lastSave('entries')?.length).toBe(3));
    expect(lastSave('entries')[0]).toMatchObject({ description: 'Internet', amount: 99.9, type: 'despesa', date: todayISO() });
    expect(await findCard('Internet')).toBeTruthy();
  });

  test('todas as abas abrem sem erro', async () => {
    render(<App />);
    await findCard('Conta de Luz');
    for (const label of ['Análise', 'Cartões', 'Dívidas', 'Contas']) {
      const navBtn = [...document.querySelectorAll('.navBtn')].find(b => b.textContent.includes(label));
      fireEvent.click(navBtn);
      await waitFor(() => expect(navBtn.style.borderTop).toContain('solid'));
    }
    expect(await findCard('Conta de Luz')).toBeTruthy();
  });
});
