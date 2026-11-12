// Dados do usuário: cache local (localStorage) + Firestore com sincronização
// em tempo real. Cada coleção é gravada inteira (modelo atual: um doc por tipo).
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadUserData, saveData, subscribeData } from '../db';
import { registerFCMToken } from '../fcm';
import { loadLS, saveLS } from '../utils.js';
import { DEFAULT_CATS, defaultNotifSettings } from '../constants.js';
import { applyTheme } from '../theme.js';
import { migrateCategories } from '../categoryMigration.js';

const DEFAULT_GOALS = { monthly: 0, savingsPct: 20 };

// Campos do doc "settings": chave no Firestore → chave no localStorage + padrão.
const SETTINGS = {
  categories:    { ls: 'cats',           def: DEFAULT_CATS },
  notifSettings: { ls: 'notif_settings', def: defaultNotifSettings },
  theme:         { ls: 'theme',          def: 'dark' },
  goals:         { ls: 'goals',          def: DEFAULT_GOALS },
  budgets:       { ls: 'budgets',        def: {} },
  accounts:      { ls: 'accounts',       def: [] },
};

// Coleções gravadas cada uma em seu doc: chave no estado → doc no Firestore + chave no localStorage.
const COLLECTIONS = {
  entries:       { fs: 'entries',   ls: 'entries',    def: [] },
  dividas:       { fs: 'dividas',   ls: 'dividas',    def: [] },
  cards:         { fs: 'cards',     ls: 'cards',      def: [] },
  cardPurchases: { fs: 'purchases', ls: 'cpurchases', def: [] },
  cardFaturas:   { fs: 'faturas',   ls: 'cfaturas',   def: {} },
};

// cloud=false (modo demo): só cache local, nada vai ao Firestore.
export function useUserData(uid, { cloud = true } = {}) {
  const k = useCallback((key) => `mf2_${uid}_${key}`, [uid]);

  // Estado inicial vem do cache local (funciona offline)
  const [data, setData] = useState(() => {
    const d = {};
    for (const [name, c] of Object.entries(COLLECTIONS)) d[name] = loadLS(k(c.ls), c.def);
    for (const [name, s] of Object.entries(SETTINGS)) d[name] = loadLS(k(s.ls), s.def);
    return d;
  });
  const [dbReady, setDbReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // "idle"|"saving"|"saved"|"offline"
  const syncTimerRef = useRef(null);
  const pendingRef = useRef(0);          // gravações enviadas e ainda sem confirmação do servidor
  const failedRef = useRef(new Set());   // docs cuja última gravação falhou

  const setField = useCallback((name, value, lsKey) => {
    setData(d => ({ ...d, [name]: value }));
    saveLS(k(lsKey), value);
  }, [k]);

  const readSettingsFromCache = useCallback(() => Object.fromEntries(
    Object.entries(SETTINGS).map(([name, s]) => [name, loadLS(k(s.ls), s.def)])
  ), [k]);

  // ─── Carga inicial + listeners em tempo real ─────────────────
  useEffect(() => {
    let unsubs = [];
    let initialized = false;
    let cancelled = false;

    const applySettings = (s) => {
      for (const [name, cfg] of Object.entries(SETTINGS)) if (s[name]) setField(name, s[name], cfg.ls);
    };

    async function bootstrap() {
      if (!cloud) { setDbReady(true); return; }
      try {
        const cloud = await loadUserData(uid);
        if (cancelled) return; // logout durante a carga: não regrava o cache
        if (Object.keys(cloud).length > 0) {
          for (const [name, c] of Object.entries(COLLECTIONS)) if (cloud[c.fs]) setField(name, cloud[c.fs], c.ls);
          if (cloud.settings) applySettings(cloud.settings);
        } else {
          // Sem dados na nuvem → migra o cache local
          const local = Object.fromEntries(Object.entries(COLLECTIONS).map(([name, c]) => [name, loadLS(k(c.ls), c.def)]));
          if (local.entries.length || local.dividas.length || local.cards.length) {
            await Promise.all([
              ...Object.entries(COLLECTIONS).map(([name, c]) => saveData(uid, c.fs, local[name])),
              saveData(uid, 'settings', readSettingsFromCache()),
            ]);
          }
        }
      } catch {
        setSyncStatus('offline');
      }
      if (cancelled) return;
      initialized = true;
      setDbReady(true);
      registerFCMToken(uid);

      const accept = () => initialized;
      const offline = () => setSyncStatus('offline');
      unsubs = [
        ...Object.entries(COLLECTIONS).map(([name, c]) =>
          subscribeData(uid, c.fs, (val) => { if (accept()) setField(name, val, c.ls); }, offline)),
        subscribeData(uid, 'settings', (s) => { if (accept()) applySettings(s); }, offline),
      ];
    }

    bootstrap();
    return () => { cancelled = true; unsubs.forEach(u => u && u()); };
  }, [uid, cloud, k, setField, readSettingsFromCache]);

  // ─── Gravação: estado + cache local + Firestore ──────────────
  const pushToCloud = useCallback((fsType, value) => {
    if (!cloud) return;
    pendingRef.current += 1;
    setSyncStatus(navigator.onLine ? 'saving' : 'offline');
    saveData(uid, fsType, value).then(() => {
      failedRef.current.delete(fsType);
    }).catch((e) => {
      failedRef.current.add(fsType);
      console.warn('[Firestore] Falha ao salvar', fsType, e);
    }).finally(() => {
      pendingRef.current -= 1;
      if (pendingRef.current > 0) return;
      if (failedRef.current.size > 0) { setSyncStatus('error'); return; }
      setSyncStatus('saved');
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => setSyncStatus('idle'), 2500);
    });
  }, [uid, cloud]);

  // Sem rede o Firestore enfileira a gravação (e a promise só resolve ao reconectar): mostra "Offline".
  useEffect(() => {
    if (!cloud) return undefined;
    const goOffline = () => { if (pendingRef.current > 0) setSyncStatus('offline'); };
    const goOnline  = () => { if (pendingRef.current > 0) setSyncStatus('saving'); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, [cloud]);

  const saveCollection = useCallback((name, value) => {
    const c = COLLECTIONS[name];
    setField(name, value, c.ls);
    pushToCloud(c.fs, value);
  }, [setField, pushToCloud]);

  // Grava um campo de settings. O doc é sempre gravado completo (todos os campos),
  // lido do cache local — antes "accounts" ficava de fora e era apagado da nuvem.
  const saveSetting = useCallback((name, value) => {
    setField(name, value, SETTINGS[name].ls);
    pushToCloud('settings', { ...readSettingsFromCache(), [name]: value });
  }, [setField, pushToCloud, readSettingsFromCache]);

  // Cada categoria tem um tipo só (receita ou despesa): ajusta o que foi salvo antes dessa regra.
  // Idempotente (a segunda passada não muda nada) e guarda uma cópia local para poder reverter.
  useEffect(() => {
    if (!dbReady) return;
    const m = migrateCategories({ categories: data.categories, entries: data.entries, budgets: data.budgets });
    if (!m.changed) return;
    for (const [name, value] of [['categories', data.categories], ['entries', data.entries], ['budgets', data.budgets]]) {
      if (loadLS(k(`${name}_v1_backup`), null) === null) saveLS(k(`${name}_v1_backup`), value);
    }
    if (m.changedCats) saveSetting('categories', m.categories);
    if (m.changedBudgets) saveSetting('budgets', m.budgets);
    if (m.changedEntries) saveCollection('entries', m.entries);
  }, [dbReady, data.categories, data.entries, data.budgets, k, saveSetting, saveCollection]);

  // Aplica o tema sempre que muda (inclusive quando vem da nuvem)
  useEffect(() => { applyTheme(data.theme); }, [data.theme]);

  // save.<campo>(valor) — objeto estável entre renders (pode ir em deps de hooks)
  const save = useMemo(() => ({
    ...Object.fromEntries(Object.keys(COLLECTIONS).map(name => [name, v => saveCollection(name, v)])),
    ...Object.fromEntries(Object.keys(SETTINGS).map(name => [name, v => saveSetting(name, v)])),
  }), [saveCollection, saveSetting]);

  return { ...data, save, dbReady, syncStatus, k };
}
