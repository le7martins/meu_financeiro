import { useState, useEffect, useRef, useCallback } from 'react';
import { loadUserData, saveData, subscribeData } from '../db.js';
import { registerFCMToken } from '../fcm.js';
import { loadLS, saveLS, TODAY } from '../utils.js';
import { DEFAULT_CATS, defaultNotifSettings } from '../constants.js';

// ─── useCloudData ──────────────────────────────────────────────
// Camada de dados persistidos (entries/dividas/cards/cartões/settings):
// cache local (localStorage) + sincronização em tempo real com o Firestore.
// Isolada do resto do App para que o estado de UI (filtros, modais, abas…)
// não fique acoplado à lógica de sincronização.
export function useCloudData(uid) {
  const k = useCallback((key) => `mf2_${uid}_${key}`, [uid]);

  const [entries,      setEntries]      = useState(()=>loadLS(k("entries"),[]));
  const [dividas,      setDividas]      = useState(()=>loadLS(k("dividas"),[]));
  const [cards,        setCards]        = useState(()=>loadLS(k("cards"),[]));
  const [cardPurchases,setCardPurchases]= useState(()=>loadLS(k("cpurchases"),[]));
  const [cardFaturas,  setCardFaturas]  = useState(()=>loadLS(k("cfaturas"),{}));
  const [categories,   setCategories]   = useState(()=>loadLS(k("cats"),DEFAULT_CATS));
  const [notifSettings,setNotifSettings]= useState(()=>loadLS(k("notif_settings"),defaultNotifSettings));
  const [theme,        setTheme]        = useState(()=>loadLS(k("theme"),"dark"));
  const [goals,        setGoals]        = useState(()=>loadLS(k("goals"),{monthly:0,savingsPct:20}));
  const [budgets,      setBudgets]      = useState(()=>loadLS(k("budgets"),{}));
  const [accounts,     setAccounts]     = useState(()=>loadLS(k("accounts"),[]));
  const [dbReady,      setDbReady]      = useState(false);
  const [syncStatus,   setSyncStatus]   = useState("idle"); // "idle"|"saving"|"saved"|"offline"
  const syncTimerRef = useRef(null);

  // ─── Firestore: carga inicial + listeners em tempo real ───────
  const _remoteWriteRef = useRef(false); // evita loop: write próprio → onSnapshot → setState
  useEffect(()=>{
    let unsubs = [];
    let initialized = false;

    async function bootstrap(){
      try {
        const cloud = await loadUserData(uid);
        const hasCloud = Object.keys(cloud).length > 0;

        if(hasCloud){
          if(cloud.entries)   { setEntries(cloud.entries);        saveLS(k("entries"),   cloud.entries);   }
          if(cloud.dividas)   { setDividas(cloud.dividas);        saveLS(k("dividas"),   cloud.dividas);   }
          if(cloud.cards)     { setCards(cloud.cards);            saveLS(k("cards"),     cloud.cards);     }
          if(cloud.purchases) { setCardPurchases(cloud.purchases);saveLS(k("cpurchases"),cloud.purchases); }
          if(cloud.faturas)   { setCardFaturas(cloud.faturas);    saveLS(k("cfaturas"),  cloud.faturas);   }
          if(cloud.settings){
            const s = cloud.settings;
            if(s.categories)    { setCategories(s.categories);       saveLS(k("cats"),          s.categories);    }
            if(s.notifSettings) { setNotifSettings(s.notifSettings); saveLS(k("notif_settings"),s.notifSettings); }
            if(s.theme)         { setTheme(s.theme);                 saveLS(k("theme"),         s.theme);         }
            if(s.goals)         { setGoals(s.goals);                 saveLS(k("goals"),         s.goals);         }
            if(s.budgets)       { setBudgets(s.budgets);             saveLS(k("budgets"),        s.budgets);       }
            if(s.accounts)      { setAccounts(s.accounts);           saveLS(k("accounts"),       s.accounts);      }
          }
        } else {
          // Sem dados na nuvem → migra localStorage
          const lsEntries   = loadLS(k("entries"),[]);
          const lsDividas   = loadLS(k("dividas"),[]);
          const lsCards     = loadLS(k("cards"),[]);
          const lsPurchases = loadLS(k("cpurchases"),[]);
          const lsFaturas   = loadLS(k("cfaturas"),{});
          const lsCats      = loadLS(k("cats"),DEFAULT_CATS);
          if(lsEntries.length||lsDividas.length||lsCards.length){
            await Promise.all([
              saveData(uid,'entries',  lsEntries),
              saveData(uid,'dividas',  lsDividas),
              saveData(uid,'cards',    lsCards),
              saveData(uid,'purchases',lsPurchases),
              saveData(uid,'faturas',  lsFaturas),
              saveData(uid,'settings', {
                categories: lsCats,
                notifSettings: loadLS(k("notif_settings"),defaultNotifSettings),
                theme: loadLS(k("theme"),"dark"),
                goals: loadLS(k("goals"),{monthly:0,savingsPct:20}),
                budgets: loadLS(k("budgets"),{}),
              }),
            ]);
          }
        }
      } catch(e){ setSyncStatus("offline"); }
      finally {
        initialized = true;
        setDbReady(true);
        registerFCMToken(uid);
      }

      // ── Listeners em tempo real após carga inicial ───────────
      const applyRemote = (setter, lsKey) => (val) => {
        if(_remoteWriteRef.current) return; // ignora echo do próprio write
        if(!initialized) return;
        setter(val);
        saveLS(lsKey, val);
      };

      unsubs = [
        subscribeData(uid,'entries',  applyRemote(setEntries,       k("entries")),   ()=>setSyncStatus("offline")),
        subscribeData(uid,'dividas',  applyRemote(setDividas,       k("dividas")),   ()=>setSyncStatus("offline")),
        subscribeData(uid,'cards',    applyRemote(setCards,         k("cards")),     ()=>setSyncStatus("offline")),
        subscribeData(uid,'purchases',applyRemote(setCardPurchases, k("cpurchases")),()=>setSyncStatus("offline")),
        subscribeData(uid,'faturas',  applyRemote(setCardFaturas,   k("cfaturas")), ()=>setSyncStatus("offline")),
        subscribeData(uid,'settings', (s)=>{
          if(_remoteWriteRef.current||!initialized) return;
          if(s.categories)    { setCategories(s.categories);       saveLS(k("cats"),          s.categories);    }
          if(s.notifSettings) { setNotifSettings(s.notifSettings); saveLS(k("notif_settings"),s.notifSettings); }
          if(s.theme)         { setTheme(s.theme);                 saveLS(k("theme"),         s.theme);         }
          if(s.goals)         { setGoals(s.goals);                 saveLS(k("goals"),         s.goals);         }
          if(s.budgets)       { setBudgets(s.budgets);             saveLS(k("budgets"),        s.budgets);       }
          if(s.accounts)      { setAccounts(s.accounts);           saveLS(k("accounts"),       s.accounts);      }
        }, ()=>setSyncStatus("offline")),
      ];
    }

    bootstrap();
    return () => unsubs.forEach(u => u && u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  // ─── Funções de salvamento: localStorage + Firestore ─────────
  const _persist = useCallback((setter, lsKey, fsType, val) => {
    setter(val);
    saveLS(lsKey, val);
    setSyncStatus("saving");
    _remoteWriteRef.current = true;
    saveData(uid, fsType, val).then(() => {
      setSyncStatus("saved");
      if(syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => setSyncStatus("idle"), 2500);
    }).catch(() => setSyncStatus("offline"))
      .finally(() => { setTimeout(() => { _remoteWriteRef.current = false; }, 500); });
  }, [uid]);

  const saveEntries      = useCallback((e)=>_persist(setEntries,      k("entries"),   'entries',  e), [_persist]);
  const saveDividas      = useCallback((d)=>_persist(setDividas,      k("dividas"),   'dividas',  d), [_persist]);
  const saveCards        = useCallback((c)=>_persist(setCards,        k("cards"),     'cards',    c), [_persist]);
  const saveCardPurchases= useCallback((p)=>_persist(setCardPurchases,k("cpurchases"),'purchases',p), [_persist]);
  const saveCardFaturas  = useCallback((f)=>_persist(setCardFaturas,  k("cfaturas"),  'faturas',  f), [_persist]);

  const _saveSettings = useCallback((patch)=>{
    const cur = {
      categories:    loadLS(k("cats"),DEFAULT_CATS),
      notifSettings: loadLS(k("notif_settings"),defaultNotifSettings),
      theme:         loadLS(k("theme"),"dark"),
      goals:         loadLS(k("goals"),{monthly:0,savingsPct:20}),
      budgets:       loadLS(k("budgets"),{}),
      ...patch,
    };
    setSyncStatus("saving");
    _remoteWriteRef.current = true;
    saveData(uid,'settings',cur).then(()=>{
      setSyncStatus("saved");
      if(syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(()=>setSyncStatus("idle"),2500);
    }).catch(()=>setSyncStatus("offline"))
      .finally(()=>{ setTimeout(()=>{ _remoteWriteRef.current=false; },500); });
  },[uid]);

  // Apply CSS vars directly on <html> — guarantees cascade regardless of <style> tag position
  const applyTheme = useCallback((t)=>{
    const root=document.documentElement;
    const dark=t!=='light';
    const vars=dark?{
      '--text1':'#e2e8f0','--text2':'#cbd5e1','--text3':'#94a3b8','--text4':'#64748b',
      '--bg':'#080c12','--card-bg':'#0d1118','--card-bg2':'#111820',
      '--border':'#1e293b','--border2':'#0f172a','--border3':'#1e293b',
      '--inp-bg':'#080c12','--nav-bg':'#080c12',
    }:{
      '--text1':'#0f172a','--text2':'#1e293b','--text3':'#64748b','--text4':'#94a3b8',
      '--bg':'#f8fafc','--card-bg':'#ffffff','--card-bg2':'#f1f5f9',
      '--border':'#e2e8f0','--border2':'#e2e8f0','--border3':'#f1f5f9',
      '--inp-bg':'#ffffff','--nav-bg':'#ffffff',
    };
    Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
    root.classList.toggle('light-mode',!dark);
  },[]);

  const saveCategories   = useCallback((c)=>{ setCategories(c);    saveLS(k("cats"),c);            _saveSettings({categories:c});    },[k,_saveSettings]);
  const saveNotifSettings= useCallback((s)=>{ setNotifSettings(s); saveLS(k("notif_settings"),s);  _saveSettings({notifSettings:s}); },[k,_saveSettings]);
  const saveTheme        = useCallback((t)=>{ setTheme(t);         saveLS(k("theme"),t);            _saveSettings({theme:t});         applyTheme(t); },[k,_saveSettings,applyTheme]);
  const saveGoals        = useCallback((g)=>{ setGoals(g);         saveLS(k("goals"),g);            _saveSettings({goals:g});         },[k,_saveSettings]);
  const saveBudgets      = useCallback((b)=>{ setBudgets(b);       saveLS(k("budgets"),b);          _saveSettings({budgets:b});       },[k,_saveSettings]);
  const saveAccounts     = useCallback((a)=>{ setAccounts(a);      saveLS(k("accounts"),a);         _saveSettings({accounts:a});      },[k,_saveSettings]);

  // Apply theme on mount and whenever theme changes
  useEffect(()=>{ applyTheme(theme); },[theme]);

  return {
    k,
    entries, dividas, cards, cardPurchases, cardFaturas, categories,
    notifSettings, theme, goals, budgets, accounts,
    dbReady, syncStatus,
    saveEntries, saveDividas, saveCards, saveCardPurchases, saveCardFaturas,
    saveCategories, saveNotifSettings, saveTheme, saveGoals, saveBudgets, saveAccounts,
  };
}
