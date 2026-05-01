import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useMonthStats } from './hooks/useMonthStats.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { loadUserData, saveData, subscribeData, hasCloudData, saveUserProfile, ADMIN_EMAIL } from './db';
import { registerFCMToken, onForegroundMessage } from './fcm';
import LoginScreen from './LoginScreen';
import { fmt, fmtShort, fmtDate, TODAY, MNAMES, mLabel, mShort, getNow, mDiff, addM, daysUntil, dueBadge, eVal, loadLS, saveLS } from './utils.js';
import { DEFAULT_CATS, BLANK, PRESET_COLORS, CARD_COLORS, NOTIF_KEY, NOTIF_LAST_KEY, defaultNotifSettings } from './constants.js';
import { getBillingMonth, getFaturaDueDate, getFaturaCloseDate, isFaturaOpen, getPurchaseInstallmentsForBilling, buildFatura, getCardBillingMonths, getMonthEntries, requestNotifPermission, fireNotification, checkAndNotify } from './logic.js';
import S from './styles.js';
import { generateMonthPDF } from './pdfReport.js';
const ChartScreen      = lazy(() => import('./screens/ChartScreen.jsx'));
const CartaoScreen     = lazy(() => import('./screens/CartaoScreen.jsx'));
const DividasScreen    = lazy(() => import('./screens/DividasScreen.jsx'));
const ProfileScreen    = lazy(() => import('./screens/ProfileScreen.jsx'));
const SaudeScreen      = lazy(() => import('./screens/SaudeScreen.jsx'));
const AdminScreen      = lazy(() => import('./screens/AdminScreen.jsx'));
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen.jsx'));
import FaturaPayModal from './modals/FaturaPayModal.jsx';
import FormModal from './modals/FormModal.jsx';
import EditModal from './modals/EditModal.jsx';
import DeleteModal from './modals/DeleteModal.jsx';
import PartialFatModal from './modals/PartialFatModal.jsx';
import ConfirmModal from './modals/ConfirmModal.jsx';
import GradCard from './components/GradCard.jsx';
import SumCard from './components/SumCard.jsx';
import Field from './components/Field.jsx';
import Toggle from './components/Toggle.jsx';
import MonthPicker from './components/MonthPicker.jsx';
import Leg from './components/Leg.jsx';
import BarSVG from './components/BarSVG.jsx';
import DonutSVG from './components/DonutSVG.jsx';
import CatSelector from './components/CatSelector.jsx';
import RecentActivity from './components/RecentActivity.jsx';
import HealthBar from './components/HealthBar.jsx';

// ─── Toast Hook ───────────────────────────────────────────────
function useToast() {
  const [toasts,setToasts]=useState([]);
  const dismiss=useCallback((id)=>setToasts(p=>p.filter(t=>t.id!==id)),[]);
  const toast=useCallback((msg,type="success",actionLabel=null,onAction=null)=>{
    const id=Date.now();
    setToasts(p=>[...p,{id,msg,type,actionLabel,onAction}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),actionLabel?5000:3000);
  },[]);
  return {toasts,toast,dismiss};
}

// ─── App (auth gate) ─────────────────────────────────────────
function App(){
  const [fbUser, setFbUser] = useState(undefined);
  useEffect(()=>onAuthStateChanged(auth, u=>{ setFbUser(u??null); if(u) saveUserProfile(u); }),[]);
  if(fbUser===undefined) return(
    <div style={{position:'fixed',inset:0,background:'#080c12',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <img src="/meu_financeiro/icon-192.png" alt="CashUp" style={{width:64,height:64,borderRadius:16,animation:'lp 1.4s ease-in-out infinite',objectFit:"cover"}}/>
    </div>
  );
  if(!fbUser) return <LoginScreen onLogin={u=>setFbUser(u)}/>;
  const handleLogout = () => {
    signOut(auth);
    // Clear per-user localStorage cache so next user starts fresh
    Object.keys(localStorage).filter(k=>k.startsWith("mf2_")).forEach(k=>localStorage.removeItem(k));
  };
  return <MainApp key={fbUser.uid} fbUser={fbUser} onLogout={handleLogout}/>;
}

// ─── MainApp ─────────────────────────────────────────────────
function MainApp({ fbUser, onLogout }){
  const uid = fbUser.uid;
  // Memoiza `k` para evitar re-criação a cada render e dependências incorretas
  const k = useCallback((key) => `mf2_${uid}_${key}`, [uid]);

  // Carrega do localStorage como estado inicial (cache offline)
  const [entries,      setEntries]      = useState(()=>loadLS(k("entries"),[]));
  const [dividas,      setDividas]      = useState(()=>loadLS(k("dividas"),[]));
  const [cards,        setCards]        = useState(()=>loadLS(k("cards"),[]));
  const [cardPurchases,setCardPurchases]= useState(()=>loadLS(k("cpurchases"),[]));
  const [cardFaturas,  setCardFaturas]  = useState(()=>loadLS(k("cfaturas"),{}));
  const [categories,   setCategories]   = useState(()=>loadLS(k("cats"),DEFAULT_CATS));
  const [selMonth,     setSelMonth]     = useState(getNow());
  const [activeTab,    setActiveTab]    = useState("lancamentos");
  const [showForm,     setShowForm]     = useState(false);
  const [formType,     setFormType]     = useState("despesa");
  const [form,         setForm]         = useState(BLANK());
  const [editTarget,   setEditTarget]   = useState(null);
  const [delTarget,    setDelTarget]    = useState(null);
  const [fatPayTarget, setFatPayTarget] = useState(null);
  const [filter,       setFilter]       = useState("all");
  const [sortBy,       setSortBy]       = useState("date");
  const [search,       setSearch]       = useState("");
  const [groupBy,      setGroupBy]      = useState(false);
  const [notifPerm,    setNotifPerm]    = useState(()=>"Notification" in window?Notification.permission:"unsupported");
  const [notifSettings,setNotifSettings]= useState(()=>loadLS(k("notif_settings"),defaultNotifSettings));
  const [theme,        setTheme]        = useState(()=>loadLS(k("theme"),"dark"));
  const [goals,        setGoals]        = useState(()=>loadLS(k("goals"),{monthly:0,savingsPct:20}));
  const [budgets,      setBudgets]      = useState(()=>loadLS(k("budgets"),{}));
  const [accounts,     setAccounts]     = useState(()=>loadLS(k("accounts"),[]));
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterTag,    setFilterTag]    = useState("all");
  const [dbReady,      setDbReady]      = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(()=>!loadLS(k('onboarding_done'), false));
  const [syncStatus,   setSyncStatus]   = useState("idle"); // "idle"|"saving"|"saved"|"offline"
  const syncTimerRef = useRef(null);
  const [showMoreNav,  setShowMoreNav]  = useState(false);
  const [showFabMenu,  setShowFabMenu]  = useState(false);
  const [showHealth,   setShowHealth]   = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showOverdue,  setShowOverdue]  = useState(false); // vencidos ocultos por padrão
  const [confirmQueue, setConfirmQueue] = useState(null); // {title,message,detail,danger,confirmLabel,onConfirm}
  const [showCelebrate, setShowCelebrate] = useState(false);
  const {toasts,toast,dismiss} = useToast();
  const showConfirm = useCallback((opts)=> new Promise(resolve=>{
    setConfirmQueue({...opts, onConfirm:()=>{setConfirmQueue(null);resolve(true);}, onClose:()=>{setConfirmQueue(null);resolve(false);}});
  }),[]);

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

  // ─── FCM: mensagens em primeiro plano ────────────────────────
  useEffect(()=>{
    const unsub = onForegroundMessage(payload=>{
      const { title, body } = payload.notification || {};
      if(title) toast(`🔔 ${title}${body?`: ${body}`:""}`, "info");
    });
    return unsub;
  },[]);

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

  const NOW=getNow();

  // Apply theme on mount and whenever theme changes
  useEffect(()=>{ applyTheme(theme); },[theme]);

  useEffect(()=>{
    if(!dbReady) return;
    if(notifSettings.enabled&&Notification.permission==="granted"){
      const lastCheck=loadLS(k("notif_last"),null);
      if(lastCheck!==TODAY) setTimeout(()=>{checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings);saveLS(k("notif_last"),TODAY);},1500);
    }
  },[dbReady]);

  const {
    monthEntries, totRec, totDesp, totPend, totPago, saldo,
    accumSaldo, accumSaldoCapped,
    healthScore, budgetOverCount,
    overdueDue, upcomingDue,
  } = useMonthStats({ entries, dividas, cards, cardPurchases, cardFaturas, budgets, selMonth, NOW });

  // Notificação de meta de economia atingida (após totRec/saldo definidos)
  const prevGoalAlertRef = useRef(false);
  useEffect(()=>{
    if(!dbReady||!goals.savingsPct||goals.savingsPct<=0||totRec<=0) return;
    const economiaPct = totRec>0?((Math.max(0,saldo)/totRec)*100):0;
    const metaAtingida = economiaPct >= goals.savingsPct;
    if(metaAtingida && !prevGoalAlertRef.current){
      prevGoalAlertRef.current = true;
      toast(`🎯 Meta de economia de ${goals.savingsPct}% atingida! Parabéns!`,"celebrate");
      setShowCelebrate(true);
      setTimeout(()=>setShowCelebrate(false),4000);
      if(notifSettings.enabled && Notification.permission==="granted"){
        fireNotification("🎯 Meta de economia atingida!",`Você economizou ${economiaPct.toFixed(0)}% da sua renda este mês. Continue assim!`,"mf-goal");
      }
    } else if(!metaAtingida){
      prevGoalAlertRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dbReady, goals.savingsPct, totRec, saldo, selMonth]);

  // Notificação de meta de renda atingida
  const prevIncomeAlertRef = useRef(false);
  useEffect(()=>{
    if(!dbReady||!goals.monthly||goals.monthly<=0||totRec<=0) return;
    const metaAtingida = totRec >= goals.monthly;
    if(metaAtingida && !prevIncomeAlertRef.current){
      prevIncomeAlertRef.current = true;
      toast(`🏆 Meta de renda de ${fmt(goals.monthly)} atingida!`,"celebrate");
      if(notifSettings.enabled&&Notification.permission==="granted"){
        fireNotification("🏆 Meta de renda atingida!",`Você recebeu ${fmt(totRec)} este mês — meta de ${fmt(goals.monthly)} alcançada!`,"mf-income-goal");
      }
    } else if(!metaAtingida){ prevIncomeAlertRef.current=false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dbReady,goals.monthly,totRec,selMonth]);

  // Comparação com mês anterior
  const prevMonthEntries = useMemo(()=>getMonthEntries(entries,dividas,addM(selMonth,-1),cards,cardPurchases,cardFaturas),[entries,dividas,selMonth,cards,cardPurchases,cardFaturas]);
  const prevSaldo = useMemo(()=>{
    const r=prevMonthEntries.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const d=prevMonthEntries.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return r-d;
  },[prevMonthEntries]);
  const saldoDiff = saldo - prevSaldo;

  // Saldo por conta: saldo_inicial + receitas pagas - despesas pagas (entradas não-recorrentes)
  const accountBalances = useMemo(()=>{
    if(!accounts.length) return {};
    return Object.fromEntries(accounts.map(acc=>{
      const linked=entries.filter(e=>e.accountId===acc.id&&e.recurrence==="none"&&e.status==="pago");
      const bal=(acc.initialBalance||0)
        +linked.filter(e=>e.type==="receita").reduce((s,e)=>s+e.amount,0)
        -linked.filter(e=>e.type==="despesa").reduce((s,e)=>s+e.amount,0);
      return [acc.id, bal];
    }));
  },[accounts,entries]);

  // Mini-sparkline: saldo dos últimos 6 meses para o hero card
  const heroSparkData = useMemo(()=>Array.from({length:6},(_,i)=>{
    const m=addM(selMonth,-(5-i));
    const me=getMonthEntries(entries,dividas,m,cards,cardPurchases,cardFaturas);
    const r=me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const d=me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return r-d;
  }),[entries,dividas,selMonth,cards,cardPurchases,cardFaturas]);

  // "Quanto posso gastar hoje" — (saldo_esperado - pendentes_fixos) / dias_restantes
  const todayWidget = useMemo(()=>{
    if(selMonth !== NOW) return null; // só faz sentido no mês atual
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
    const daysLeft = lastDay - today.getDate() + 1; // inclui hoje
    if(daysLeft <= 0) return null;
    const available = totRec - totDesp - totPend; // já recebido - já pago - ainda a pagar
    const perDay = available / daysLeft;
    return { available, perDay, daysLeft };
  },[selMonth, NOW, totRec, totDesp, totPend]);

  const normStr=(s)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const filtered=useMemo(()=>{
    let list=filter==="all"?monthEntries:filter==="despesa"?monthEntries.filter(e=>e.type==="despesa"):filter==="receita"?monthEntries.filter(e=>e.type==="receita"):filter==="a_pagar"?monthEntries.filter(e=>e.statusForMonth==="a_pagar"):monthEntries.filter(e=>e.statusForMonth==="pago");
    if(filterCat!=="all") list=list.filter(e=>e.category===filterCat);
    if(filterTag!=="all") list=list.filter(e=>(e.tags||[]).includes(filterTag));
    if(search.trim()){const q=normStr(search);list=list.filter(e=>normStr(e.description).includes(q)||normStr(e.notes||"").includes(q)||(e.tags||[]).some(t=>normStr(t).includes(q)));}
    if(sortBy==="amount") list=[...list].sort((a,b)=>eVal(b)-eVal(a));
    else if(sortBy==="name") list=[...list].sort((a,b)=>a.description.localeCompare(b.description));
    else if(sortBy==="status") list=[...list].sort((a,b)=>a.statusForMonth==="a_pagar"?-1:1);
    else list=[...list].sort((a,b)=>a.date.localeCompare(b.date));
    return list;
  },[monthEntries,filter,filterCat,search,sortBy]);

  const grouped=useMemo(()=>{
    if(!groupBy) return null;
    const map={};
    filtered.forEach(e=>{if(!map[e.category])map[e.category]={items:[],total:0};map[e.category].items.push(e);map[e.category].total+=eVal(e);});
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  },[filtered,groupBy]);

  // Todas as tags únicas dos lançamentos do mês
  const allTags = useMemo(()=>{
    const set = new Set();
    monthEntries.forEach(e=>(e.tags||[]).forEach(t=>set.add(t)));
    return [...set].sort();
  },[monthEntries]);

  const getCat  =(id)=>categories.find(c=>c.id===id)||{color:"#9E9E9E",name:id};
  const catColor=(id)=>getCat(id).color;
  const catName =(id)=>getCat(id).name;

  // ─── Keyboard shortcuts ───────────────────────────────────────
  useEffect(()=>{
    const focusSearch=()=>{ const el=document.querySelector('input[placeholder*="Buscar"]'); if(el){el.focus();el.select();} };
    const onKey=(e)=>{
      // Ctrl+F / Cmd+F → foca busca (intercepta o padrão do browser)
      if((e.ctrlKey||e.metaKey)&&e.key==='f'&&activeTab==='lancamentos'){e.preventDefault();focusSearch();return;}
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(showForm||editTarget||delTarget||fatPayTarget) return;
      if(activeTab==='lancamentos'){
        if(e.key==='ArrowLeft'){setSelMonth(p=>addM(p,-1));}
        else if(e.key==='ArrowRight'){setSelMonth(p=>addM(p,1));}
        else if(e.key==='n'||e.key==='N'){e.preventDefault();setFormType('despesa');setForm(BLANK('despesa'));setShowForm(true);}
        else if(e.key==='/'){e.preventDefault();focusSearch();}
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[activeTab,showForm,editTarget,delTarget,fatPayTarget]);

  // ─── Budget over-limit alerts ─────────────────────────────────
  const alertedBudgets=useRef(new Set());
  useEffect(()=>{alertedBudgets.current=new Set();},[selMonth]);
  useEffect(()=>{
    if(!dbReady||!Object.keys(budgets).length) return;
    Object.entries(budgets).forEach(([catId,limit])=>{
      if(!limit||limit<=0) return;
      const key=`${selMonth}_${catId}`;
      if(alertedBudgets.current.has(key)) return;
      const total=monthEntries.filter(e=>e.type==='despesa'&&e.category===catId).reduce((s,e)=>s+eVal(e),0);
      if(total>limit){
        alertedBudgets.current.add(key);
        const cat=categories.find(c=>c.id===catId);
        if(cat){
          toast(`⚠️ Orçamento de "${cat.name}" estourado (${fmt(total)} / ${fmt(limit)})`,'error');
          if(notifSettings.enabled&&Notification.permission==="granted"){
            fireNotification(`⚠️ Orçamento estourado: ${cat.name}`,`Você gastou ${fmt(total)} de um limite de ${fmt(limit)} este mês.`,`budget-${catId}`);
          }
        }
      }
    });
  },[dbReady,selMonth,monthEntries,budgets,categories,toast,notifSettings]);

  const handleToggle=useCallback((entry)=>{
    if(entry.isFatura){
      if(entry.isOpenFatura) return;
      setFatPayTarget(entry); return;
    }
    if(entry.isDivida){
      saveDividas(dividas.map(d=>{
        if(d.id!==entry.dividaId) return d;
        const pm=d.paidMonths||[];
        const isPaid=pm.includes(selMonth);
        const newPm=isPaid?pm.filter(m=>m!==selMonth):[...pm,selMonth];
        const nowQuited=newPm.length>=d.installments;
        if(nowQuited&&!isPaid) toast("🎉 Dívida quitada! Parabéns!","celebrate");
        return {...d,paidMonths:newPm};
      }));
      toast(entry.statusForMonth==="pago"?"Parcela marcada como pendente":"Parcela marcada como paga");
      return;
    }
    const newSt=entry.statusForMonth==="pago"?"a_pagar":"pago";
    const paidDt=newSt==="pago"?TODAY:null;
    saveEntries(entries.map(e=>{
      if(e.id!==entry.id) return e;
      if(!entry.isRecurring) return {...e,status:newSt,paidDate:paidDt};
      // Sempre atualiza o status dentro do override se ele existir —
      // caso contrário o override (salvo pela edição "só este mês") sobrescreve
      // o statusByMonth no getMonthEntries e o botão não reflete a mudança.
      const existingOv=e.overrides?.[selMonth];
      const newOverrides=existingOv
        ?{...e.overrides,[selMonth]:{...existingOv,status:newSt}}
        :{...e.overrides,[selMonth]:{status:newSt}};
      return {...e,statusByMonth:{...e.statusByMonth,[selMonth]:newSt},paidDateByMonth:{...e.paidDateByMonth,[selMonth]:paidDt},overrides:newOverrides};
    }));
    toast(newSt==="pago"?"✓ Marcado como pago":"↩ Marcado como pendente");
  },[saveDividas,dividas,selMonth,saveEntries,entries,toast]);

  const handleAdd=useCallback(async()=>{
    if(!form.description.trim()||!form.amount||!form.date) return;
    if(form.type==="despesa"&&form.payWith&&form.payWith!=="saldo"){
      const card=cards.find(c=>c.id===form.payWith);
      if(card){
        const purchase={id:Date.now().toString(),cardId:card.id,description:form.description.trim(),amount:parseFloat(form.amount)||0,purchaseDate:form.date,category:form.category,installments:1,notes:form.notes||""};
        saveCardPurchases([purchase,...cardPurchases]);setForm(BLANK());setShowForm(false);
        toast(`✓ Lançado na fatura de ${card.name}`);
        return;
      }
    }
    const dup=entries.find(e=>e.description.toLowerCase()===form.description.trim().toLowerCase()&&Math.abs(parseFloat(e.amount)-parseFloat(form.amount))<0.01&&e.date===form.date&&e.type===form.type);
    if(dup){
      const ok=await showConfirm({title:"Lançamento duplicado?",message:`"${dup.description}" já existe em ${fmtDate(dup.date)} (${fmt(parseFloat(dup.amount))}).`,detail:"Deseja adicionar mesmo assim?",confirmLabel:"Adicionar mesmo assim",danger:false});
      if(!ok) return;
    }
    const entry={id:Date.now().toString(),description:form.description.trim(),amount:parseFloat(form.amount),date:form.date,type:form.type,status:form.status,category:form.category,recurrence:form.recurrence,notes:form.notes,...(form.recurrence==="installment"?{installments:parseInt(form.installments)}:{}),...(form.endMonth?{endMonth:form.endMonth}:{}),statusByMonth:{},overrides:{}};
    saveEntries([entry,...entries]);setForm(BLANK());setShowForm(false);
    toast(`✓ ${form.type==="receita"?"Receita":"Despesa"} adicionada`);
  },[form,cards,entries,cardPurchases,saveCardPurchases,saveEntries,toast]);

  const handleSaveEdit=useCallback((entryId,changes,scope)=>{
    saveEntries(entries.map(e=>{
      if(e.id!==entryId) return e;
      // Restore original amount: remove amount key from this month's override
      if(changes._resetAmount){
        const ov=e.overrides?.[selMonth];
        if(!ov) return e;
        const {amount:_,...rest}=ov;
        const newOv={...e.overrides};
        if(Object.keys(rest).length>0) newOv[selMonth]=rest; else delete newOv[selMonth];
        return {...e,overrides:newOv};
      }
      if(e.recurrence==="none"||scope==="future"){const baseAmt=(e.recurrence==="installment"&&changes.amount!==undefined)?parseFloat((changes.amount*e.installments).toFixed(2)):(changes.amount??e.amount);return {...e,...changes,amount:baseAmt};}
      return {...e,overrides:{...e.overrides,[selMonth]:changes}};
    }));
    setEditTarget(null);toast("✓ Lançamento atualizado");
  },[saveEntries,entries,selMonth,toast]);

  const handleClone=useCallback((entry)=>{
    setFormType(entry.type);
    setForm({description:entry.description,amount:String(eVal(entry)),date:TODAY,type:entry.type,status:"a_pagar",category:entry.category,recurrence:"none",installments:2,notes:entry.notes||"",endMonth:"",tags:entry.tags||[]});
    setShowForm(true);
  },[]);

  const handleDelete=useCallback((entryId,scope)=>{
    const snap=entries.slice();
    if(scope==="all")        saveEntries(entries.filter(e=>e.id!==entryId));
    else if(scope==="this")  saveEntries(entries.map(e=>e.id!==entryId?e:{...e,deletedMonths:[...(e.deletedMonths||[]),selMonth]}));
    else                     saveEntries(entries.map(e=>e.id!==entryId?e:{...e,deletedFrom:selMonth}));
    setDelTarget(null);toast("Lançamento removido","info","Desfazer",()=>saveEntries(snap));
  },[saveEntries,entries,selMonth,toast]);

  const handlePayFatura=useCallback((entry,amount,partial)=>{
    const cur=cardFaturas[entry.faturaKey]||{};
    const isFullyPaid=!partial||amount>=entry.amount;
    saveCardFaturas({...cardFaturas,[entry.faturaKey]:{...cur,paid:isFullyPaid,paidAmount:amount,paidDate:TODAY,partial:partial&&!isFullyPaid}});
    setFatPayTarget(null);
    toast(isFullyPaid?"✓ Fatura paga":"Pagamento parcial registrado");
  },[cardFaturas,saveCardFaturas,toast]);

  const handleRevertFatura=useCallback((faturaKey)=>{
    const nf={...cardFaturas};delete nf[faturaKey];
    saveCardFaturas(nf);toast("↩ Pagamento estornado","info");
  },[cardFaturas,saveCardFaturas,toast]);

  const handleBackup=useCallback(()=>{
    const data={version:1,exportedAt:new Date().toISOString(),entries,dividas,cards,cardPurchases,cardFaturas,categories};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    Object.assign(document.createElement("a"),{href:url,download:`meu-financeiro-backup-${TODAY}.json`}).click();
    URL.revokeObjectURL(url);toast("💾 Backup salvo");
  },[entries,dividas,cards,cardPurchases,cardFaturas,categories,toast]);

  const handleRestore=useCallback((e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.version||!Array.isArray(data.entries)){toast("Arquivo inválido ou corrompido","error");return;}
        const ok=await showConfirm({title:"Restaurar backup?",message:"Todos os dados atuais serão substituídos pelos dados do backup.",detail:`Backup de ${data.exportedAt?new Date(data.exportedAt).toLocaleDateString("pt-BR"):"data desconhecida"} · ${data.entries?.length||0} lançamentos`,confirmLabel:"Restaurar",danger:true});
        if(!ok) return;
        if(data.entries)       saveEntries(data.entries);
        if(data.dividas)       saveDividas(data.dividas);
        if(data.cards)         saveCards(data.cards);
        if(data.cardPurchases) saveCardPurchases(data.cardPurchases);
        if(data.cardFaturas)   saveCardFaturas(data.cardFaturas);
        if(data.categories)    saveCategories(data.categories);
        toast("✅ Backup restaurado!");
      } catch(err){
        if(err instanceof SyntaxError) toast("Arquivo JSON inválido ou corrompido","error");
        else toast("Erro ao restaurar backup","error");
        console.error("[Restore]",err);
      }
    };
    reader.readAsText(file);e.target.value="";
  },[saveEntries,saveDividas,saveCards,saveCardPurchases,saveCardFaturas,saveCategories,toast]);

  const handleExportCSV=useCallback((mk,toMk)=>{
    const hdr=["Descrição","Tipo","Valor","Vencimento","Status","Categoria","Recorrência","Notas"];
    const getCatN=(id)=>(categories.find(c=>c.id===id)||{name:id}).name;
    let rows=[];
    if(mk&&toMk){
      let cur=mk;
      while(cur<=toMk){
        const list=getMonthEntries(entries,dividas,cur,cards,cardPurchases,cardFaturas);
        list.forEach(e=>rows.push([`"${e.description}"`,e.type,(eVal(e)).toFixed(2),fmtDate(e.date),e.statusForMonth||e.status,`"${getCatN(e.category)}"`,e.recurrence||"none",`"${e.notes||""}"`]));
        cur=addM(cur,1);
      }
    } else if(mk){
      const list=getMonthEntries(entries,dividas,mk,cards,cardPurchases,cardFaturas);
      rows=list.map(e=>[`"${e.description}"`,e.type,(eVal(e)).toFixed(2),fmtDate(e.date),e.statusForMonth||e.status,`"${getCatN(e.category)}"`,e.recurrence||"none",`"${e.notes||""}"`]);
    } else {
      rows=entries.map(e=>[`"${e.description}"`,e.type,e.amount.toFixed(2),fmtDate(e.date),e.status,`"${getCatN(e.category)}"`,e.recurrence||"none",`"${e.notes||""}"`]);
      dividas.forEach(d=>{
        const instVal=parseFloat((d.totalAmount/d.installments).toFixed(2));
        rows.push([`"${d.name} (dívida)"`,`"despesa"`,instVal.toFixed(2),`"${d.startMonth}"`,`"parcelado"`,`"${getCatN(d.category||"divida")}"`,`"${d.installments}x"`,`"${d.notes||""}"`]);
      });
      cards.forEach(card=>{
        const bms=getCardBillingMonths(card,cardPurchases);
        bms.forEach(bm=>{
          const fat=buildFatura(card,cardPurchases,cardFaturas,bm);
          if(fat.total>0) rows.push([`"Fatura ${card.name} ${mLabel(bm)}"`,`"despesa"`,fat.total.toFixed(2),fmtDate(fat.dueDate),fat.paid?"pago":"a_pagar",`"cartao"`,`"none"`,`""`]);
        });
      });
    }
    const csv=[hdr.join(","),...rows.map(r=>r.join(","))].join("\n");
    const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
    const fname=mk&&toMk?`financeiro_${mk}_a_${toMk}.csv`:mk?`financeiro_${mk}.csv`:"financeiro_completo.csv";
    Object.assign(document.createElement("a"),{href:url,download:fname}).click();
    URL.revokeObjectURL(url);toast("📊 CSV exportado");
  },[entries,dividas,cards,cardPurchases,cardFaturas,categories,toast]);

  const handleExportPDF=useCallback((mk)=>{
    generateMonthPDF({
      entries,monthKey:mk||selMonth,categories,
      mLabel,fmt,fmtDate,eVal,getMonthEntries,
      dividas,cards,cardPurchases,cardFaturas,
    });
    toast("📄 Relatório aberto — use Ctrl+P / Cmd+P para salvar como PDF","info");
  },[entries,dividas,cards,cardPurchases,cardFaturas,categories,selMonth,toast]);

  const FILTERS=[
    ["all","Todos",monthEntries.length],
    ["despesa","Despesas",monthEntries.filter(e=>e.type==="despesa").length],
    ["receita","Receitas",monthEntries.filter(e=>e.type==="receita").length],
    ["a_pagar","Pendente Pagamento",monthEntries.filter(e=>e.statusForMonth==="a_pagar").length],
    ["pago","Pagos",monthEntries.filter(e=>e.statusForMonth==="pago").length],
  ];

  const renderCard=(entry)=>{
    const badge=dueBadge(entry,selMonth);
    const paidDt=entry.isRecurring?entry.paidDateByMonth?.[selMonth]:entry.paidDate;
    const borderColor=entry.type==="receita"?"#4ade8055":entry.isDivida?"#f8717155":entry.isFatura?`${entry.cardColor}55`:"var(--border)";
    const amtColor=entry.type==="receita"?"#4ade80":entry.isDivida?"#f87171":entry.isFatura?entry.cardColor:"var(--text1)";
    const openStyle=entry.isOpenFatura?{opacity:0.75,borderStyle:"dashed"}:{};
    const origAmt=entry.recurrence==="installment"?entry.amount/entry.installments:entry.amount;
    const hasAmtOverride=entry.isRecurring&&!entry.isDivida&&!entry.isFatura&&entry.displayAmount!==undefined&&Math.abs(entry.displayAmount-origAmt)>0.01;
    const canSwipe=!entry.isOpenFatura;
    const onTouchStart=(ev)=>{ ev.currentTarget._tx=ev.touches[0].clientX; ev.currentTarget._ty=ev.touches[0].clientY; };
    const onTouchMove=(ev)=>{
      if(!canSwipe) return;
      const dx=ev.touches[0].clientX-(ev.currentTarget._tx||0);
      const dy=ev.touches[0].clientY-(ev.currentTarget._ty||0);
      if(Math.abs(dx)<Math.abs(dy)) return;
      ev.currentTarget.style.transform=`translateX(${dx*0.35}px)`;
      ev.currentTarget.style.transition='none';
      const pct=Math.min(Math.abs(dx)/80,1);
      ev.currentTarget.style.opacity=String(1-pct*0.25);
    };
    const onTouchEnd=(ev)=>{
      ev.currentTarget.style.transform='';
      ev.currentTarget.style.transition='transform .2s,opacity .2s';
      ev.currentTarget.style.opacity='';
      setTimeout(()=>{ if(ev.currentTarget) ev.currentTarget.style.transition=''; },220);
      if(!canSwipe) return;
      const dx=ev.changedTouches[0].clientX-(ev.currentTarget._tx||0);
      const dy=ev.changedTouches[0].clientY-(ev.currentTarget._ty||0);
      if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5) handleToggle(entry);
    };
    return(
      <div key={`${entry.id}-${selMonth}`} className="eCard"
        style={{...S.card,borderLeft:`3px solid ${borderColor}`,...openStyle}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div style={S.cardL}>
          <div style={{width:8,height:8,borderRadius:"50%",background:entry.isFatura?entry.cardColor:catColor(entry.category),flexShrink:0,marginTop:3}}/>
          <div style={{minWidth:0,flex:1}}>
            <div style={S.cardTitle}>{entry.description}</div>
            <div style={S.cardMeta}>
              {!entry.isFatura&&<span style={{...S.tag,color:catColor(entry.category),borderColor:catColor(entry.category)+"44",background:catColor(entry.category)+"18"}}>{catName(entry.category)}</span>}
              {entry.recurrence!=="none"&&<span style={{...S.tag,color:entry.isDivida?"#f87171":"#8ab4f8",borderColor:entry.isDivida?"#f8717144":"#1a3a6e",background:entry.isDivida?"rgba(248,113,113,.12)":"#0d1a2e"}}>{entry.recurLabel}</span>}
              <span style={{fontSize:10,color:"var(--text4)"}}>{fmtDate(entry.isRecurring&&entry.recurrence!=="none"&&!entry.isDivida&&!entry.isFatura?`${selMonth}-${entry.date.split("-")[2]}`:entry.date)}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:700,color:amtColor,letterSpacing:"-0.3px"}}>
                {entry.type==="receita"?"+":""}{fmt(eVal(entry))}
              </span>
              {hasAmtOverride&&(
                <span title={`Valor original: ${fmt(origAmt)}`} style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4,background:"rgba(250,204,21,.12)",border:"1px solid rgba(250,204,21,.3)",color:"#facc15",letterSpacing:"0.03em",cursor:"default"}}>
                  ⚙ ajustado
                </span>
              )}
            </div>
            {entry.recurrence==="installment"&&entry.installments>1&&(()=>{
              const cur=Math.min(entry.installments,Math.max(1,mDiff(entry.date.substring(0,7),selMonth)+1));
              const pct=cur/entry.installments;
              return(
                <div style={{marginTop:5,display:"flex",alignItems:"center",gap:6}}>
                  <div style={{flex:1,height:3,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct*100}%`,background:pct>=1?"#4ade80":"#8ab4f8",borderRadius:2,transition:"width .4s"}}/>
                  </div>
                  <span style={{fontSize:9,color:"var(--text4)",flexShrink:0}}>{cur}/{entry.installments}</span>
                </div>
              );
            })()}
            {badge&&<div style={{display:"inline-block",marginTop:4,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:4,background:badge.bg,color:badge.color}}>{badge.text}</div>}
            {entry.notes&&<div style={{fontSize:10,color:"var(--text3)",marginTop:3,fontStyle:"italic",display:"flex",alignItems:"flex-start",gap:4}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:3,flexShrink:0}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span>{entry.notes}</span></div>}
            {(entry.tags||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{(entry.tags||[]).map(t=><span key={t} style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:"rgba(138,180,248,.12)",border:"1px solid #8ab4f822",color:"#8ab4f8",fontWeight:600}}>#{t}</span>)}</div>}
            {entry.isOpenFatura&&<div style={{fontSize:10,color:entry.cardColor,marginTop:3,opacity:0.8,display:"flex",alignItems:"center",gap:4}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{marginRight:3,flexShrink:0}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg><span>Fecha em {fmtDate(entry.closeDate)}</span></div>}
            {paidDt&&!entry.isDivida&&!entry.isFatura&&<div style={{fontSize:10,color:"#4ade8066",marginTop:2}}>✓ Pago em {fmtDate(paidDt)}</div>}
          </div>
        </div>
        <div style={S.cardR}>
          <div style={{display:"flex",gap:4}}>
            {!entry.isDivida&&!entry.isFatura&&(
              <button className="iconBtn" title="Clonar" onClick={()=>handleClone(entry)}
                style={{...S.iconBtn,background:"rgba(74,222,128,.08)",color:"#4ade80"}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            )}
            {!entry.isDivida&&!entry.isFatura&&(
              <button className="iconBtn" onClick={()=>setEditTarget({entry,monthKey:selMonth})}
                style={{...S.iconBtn,background:"rgba(138,180,248,.1)",color:"#8ab4f8"}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            {!entry.isDivida&&!entry.isFatura&&(
              <button className="iconBtn" onClick={()=>setDelTarget(entry)} style={{...S.iconBtn,background:"rgba(239,68,68,.1)",color:"#f87171"}}>✕</button>
            )}
          </div>
          {entry.isOpenFatura?(
            <span style={{...S.badge,background:"rgba(138,180,248,.1)",color:"#8ab4f8",border:"1px solid #8ab4f833",padding:"4px 8px",fontSize:10,display:"flex",alignItems:"center",gap:4}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{marginRight:3,flexShrink:0}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> em aberto</span>
          ):(
            <button onClick={()=>handleToggle(entry)} className="statusToggleBtn"
              title={entry.statusForMonth==="pago"?(entry.type==="receita"?"Clique para marcar como a receber":"Clique para marcar como a pagar"):(entry.type==="receita"?"Clique para marcar como recebido":"Clique para marcar como pago")}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 9px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:700,
                background:entry.statusForMonth==="pago"?"rgba(74,222,128,.18)":"rgba(251,146,60,.15)",
                color:entry.statusForMonth==="pago"?"#4ade80":"#fb923c",
                transition:"all .15s"}}>
              {entry.statusForMonth==="pago"?(
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>{entry.type==="receita"?"Recebido":"Pago"}</>
              ):(
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{entry.type==="receita"?"A receber":"A pagar"}</>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Onboarding: mostrado na primeira vez que o usuário acessa ──
  if(showOnboarding){
    return(
      <Suspense fallback={null}>
        <div data-theme={theme} className={theme==="light"?"light-mode":""} style={{background:"var(--bg,#080c12)"}}>
          <style>{`:root{--bg:#080c12;--text1:#fff;--text3:#778;--text4:#334;} .light-mode{--bg:#f8fafc;--text1:#111827;--text3:#6b7280;--text4:#9ca3af;}`}</style>
          <OnboardingScreen onDone={()=>{ saveLS(k('onboarding_done'),true); setShowOnboarding(false); }}/>
        </div>
      </Suspense>
    );
  }

  return(
    <div style={S.root} className={`appRoot ${theme === "light" ? "light-mode" : ""}`} data-theme={theme}>
      <style>{CSS}</style>

      {/* Toast container — posicionado acima da bottom nav */}
      <div style={{position:"fixed",bottom:82,left:"50%",transform:"translateX(-50%)",zIndex:999,display:"flex",flexDirection:"column",gap:6,alignItems:"center",pointerEvents:"none",width:"92%",maxWidth:380}}>
        {toasts.map(t=>{
          const icon=t.type==="error"?"❌":t.type==="celebrate"?"🎉":t.type==="info"?"ℹ️":"✅";
          const bg=t.type==="error"?"#2a0d0d":t.type==="celebrate"?"#0d2a1a":t.type==="info"?"#0d1a2e":"#0a2010";
          const border=t.type==="error"?"#f8717155":t.type==="celebrate"?"#4ade8055":t.type==="info"?"#8ab4f855":"#4ade8055";
          const color=t.type==="error"?"#fca5a5":t.type==="celebrate"?"#6ee7b7":t.type==="info"?"#93c5fd":"#4ade80";
          return(
            <div key={t.id} className="toast-in"
              style={{background:bg,border:`1.5px solid ${border}`,color,padding:"11px 14px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.6)",display:"flex",alignItems:"center",gap:8,width:"100%",pointerEvents:t.actionLabel?"auto":"none"}}>
              <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
              <span style={{flex:1}}>{t.msg}</span>
              {t.actionLabel&&t.onAction&&(
                <button onClick={()=>{t.onAction();dismiss(t.id);}}
                  style={{background:"transparent",border:`1px solid ${color}`,borderRadius:6,padding:"3px 9px",color,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  {t.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Confetti celebration overlay */}
      {showCelebrate&&(
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1000,overflow:"hidden"}}>
          {Array.from({length:30},(_,i)=>{
            const colors=["#4ade80","#facc15","#8ab4f8","#f87171","#a78bfa","#fb923c"];
            const c=colors[i%colors.length];
            const left=Math.random()*100;
            const delay=Math.random()*1.5;
            const dur=2+Math.random()*2;
            const size=6+Math.random()*8;
            const rot=Math.random()*360;
            return(
              <div key={i} style={{
                position:"absolute",top:-20,left:`${left}%`,
                width:size,height:size,borderRadius:Math.random()>0.5?"50%":2,
                background:c,opacity:0.9,
                animation:`confettiFall ${dur}s ${delay}s ease-in forwards`,
                transform:`rotate(${rot}deg)`,
              }}/>
            );
          })}
        </div>
      )}

      <header style={S.header}>
        <div style={S.headerLeft}>
          <img src="/meu_financeiro/icon-192.png" alt="CashUp" style={{width:32,height:32,borderRadius:8,objectFit:"cover"}}/>
          <div><div style={S.appName}>CashUp</div><div style={S.appSub}>Controle seus lançamentos</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Sync status indicator */}
          {syncStatus!=="idle"&&(
            <div title={syncStatus==="saving"?"Salvando...":syncStatus==="saved"?"Salvo na nuvem":"Offline — dados locais"} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,background:syncStatus==="offline"?"rgba(248,113,113,.1)":syncStatus==="saved"?"rgba(74,222,128,.1)":"rgba(138,180,248,.1)",border:`1px solid ${syncStatus==="offline"?"#f8717133":syncStatus==="saved"?"#4ade8033":"#8ab4f833"}`,transition:"all .3s"}}>
              {syncStatus==="saving"&&<div style={{width:7,height:7,borderRadius:"50%",background:"#8ab4f8",animation:"pulse 1s ease-in-out infinite"}}/>}
              {syncStatus==="saved"&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              {syncStatus==="offline"&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>}
              <span style={{fontSize:9,fontWeight:700,color:syncStatus==="offline"?"#f87171":syncStatus==="saved"?"#4ade80":"#8ab4f8"}}>
                {syncStatus==="saving"?"Salvando":syncStatus==="saved"?"Salvo":"Offline"}
              </span>
            </div>
          )}
          {/* Health indicator in header — clicável */}
          {healthScore&&activeTab==="lancamentos"&&(
            <button onClick={()=>setShowHealth(true)} style={{display:"flex",alignItems:"center",gap:5,background:"var(--card-bg)",border:`1px solid ${healthScore.color}44`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:"inherit"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:healthScore.color,boxShadow:`0 0 6px ${healthScore.color}`}}/>
              <span style={{fontSize:10,color:healthScore.color,fontWeight:700}}>{healthScore.level}</span>
            </button>
          )}
          {/* Theme toggle */}
          <button onClick={()=>saveTheme(theme==="dark"?"light":"dark")}
            title={theme==="dark"?"Mudar para tema claro":"Mudar para tema escuro"}
            style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:9,cursor:"pointer",fontFamily:"inherit",color:"var(--text2)"}}>
            {theme==="dark"?(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ):(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            )}
          </button>
        </div>
      </header>

      {activeTab==="lancamentos"&&(<>
        {/* Month navigator */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px 4px"}}>
          <button className="arrowBtn" onClick={()=>setSelMonth(p=>addM(p,-1))} style={S.arrowBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{textAlign:"center"}}>
            <div className="monthLabel" style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{MNAMES[+selMonth.split("-")[1]-1]}</div>
            <div style={{fontSize:13,color:"var(--text3)",fontWeight:500,marginTop:-1}}>{selMonth.split("-")[0]}</div>
            {selMonth===NOW&&<div style={{fontSize:9,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:1}}>Mês atual</div>}
          </div>
          <button className="arrowBtn" onClick={()=>setSelMonth(p=>addM(p,1))} style={S.arrowBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Hero saldo */}
        <div style={{padding:"10px 14px 6px"}}>
          <div style={S.heroCard} className="heroCard">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:10,background:"rgba(74,222,128,.18)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <span className="heroSubtext" style={{fontSize:14,color:"rgba(255,255,255,.6)",fontWeight:500}}>Saldo do mês</span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10}}>
              <div style={{fontSize:28,fontWeight:800,letterSpacing:"-0.5px",lineHeight:1,background:saldo>=0?"linear-gradient(135deg,#4ade80,#34d399)":"linear-gradient(135deg,#f87171,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{fmt(saldo)}</div>
              {/* Mini-sparkline 6 meses */}
              {(()=>{
                const data=heroSparkData;
                const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
                const W=72,H=28,pts=data.map((v,i)=>{const x=(i/(data.length-1))*W;const y=H-((v-min)/range)*(H-6)-3;return`${x},${y}`;});
                const sparkColor=saldo>=0?"#4ade80":"#f87171";
                return(
                  <svg width={W} height={H} style={{opacity:0.7,flexShrink:0}}>
                    <polyline points={pts.join(' ')} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="2.5" fill={sparkColor}/>
                  </svg>
                );
              })()}
            </div>
            {/* Comparação mês anterior */}
            {prevSaldo !== 0 && (()=>{
              const pctChange = prevSaldo!==0?((saldoDiff/Math.abs(prevSaldo))*100):0;
              const isUp = saldoDiff>=0;
              return(
                <div className="heroCardFooter" style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span className="heroMuted" style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>vs mês anterior</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,padding:"2px 6px",borderRadius:5,fontWeight:700,
                      background:isUp?"rgba(74,222,128,.15)":"rgba(248,113,113,.15)",
                      color:isUp?"#4ade80":"#f87171",
                      border:`1px solid ${isUp?"#4ade8033":"#f8717133"}`}}>
                      {isUp?"▲":"▼"} {Math.abs(pctChange).toFixed(0)}%
                    </span>
                    <span style={{fontSize:11,fontWeight:600,color:isUp?"#4ade8088":"#f8717188"}}>
                      {isUp?"+":"-"} {fmt(Math.abs(saldoDiff))}
                    </span>
                  </div>
                </div>
              );
            })()}
            {accumSaldo!==null&&<div className="heroCardFooter" style={{marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span className="heroMuted" style={{fontSize:10,color:"rgba(255,255,255,.35)",display:"flex",alignItems:"center",gap:4}}>
                  Saldo acumulado
                  {accumSaldoCapped&&<span title="Calculado apenas nos últimos 36 meses (limite do histórico)" style={{cursor:"help",opacity:.6,color:"#facc15",fontSize:9}}>⚠️ 36m</span>}
                </span>
                <span style={{fontSize:12,fontWeight:700,color:(saldo+accumSaldo)>=0?"#4ade80":"#f87171"}}>{fmt(saldo+accumSaldo)}</span>
              </div>
              {accumSaldoCapped&&<div style={{fontSize:9,color:"rgba(255,255,255,.25)",marginTop:3}}>Histórico limitado a 36 meses</div>}
            </div>}
          </div>
        </div>

        {/* Account balance pills */}
        {accounts.length>0&&(
          <div className="hscroll" style={{display:"flex",gap:8,padding:"0 14px 4px",overflowX:"auto"}}>
            {accounts.map(acc=>{
              const bal=accountBalances[acc.id]??acc.initialBalance??0;
              return(
                <div key={acc.id} style={{flexShrink:0,background:"var(--card-bg)",border:`1px solid ${acc.color}44`,borderRadius:10,padding:"8px 12px",minWidth:110}}>
                  <div style={{fontSize:9,color:"var(--text4)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:100}}>{acc.name}</div>
                  <div style={{fontSize:13,fontWeight:800,color:bal>=0?acc.color:"#f87171",letterSpacing:"-0.3px"}}>{fmt(bal)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4 grad cards */}
        <div className="sumGrid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 14px 10px"}}>
          <GradCard label="Receitas" value={fmt(totRec)} color="#4ade80" bg="rgba(74,222,128,.08)" empty={totRec===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
            onAdd={()=>{setFormType("receita");setForm(BLANK("receita"));setShowForm(true);}}/>
          <GradCard label="Despesas" value={fmt(totDesp)} color="#fb923c" bg="rgba(251,146,60,.08)" empty={totDesp===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>}
            onAdd={()=>{setFormType("despesa");setForm(BLANK("despesa"));setShowForm(true);}}/>
          <GradCard label="Pago" value={fmt(totPago)} color="#8ab4f8" bg="rgba(138,180,248,.08)" empty={totPago===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 9"/></svg>}/>
          <GradCard label="A pagar" value={fmt(totPend)} color="#facc15" bg="rgba(250,204,21,.08)" empty={totPend===0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}/>
        </div>
        {/* Payment progress bar */}
        {totDesp>0&&(
          <div style={{padding:"0 14px 8px"}}>
            <div style={{background:"var(--card-bg)",border:"1px solid var(--border2)",borderRadius:10,padding:"9px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:9,color:"var(--text4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Progresso pagamentos</span>
                <span style={{fontSize:10,fontWeight:700,color:totPago>=totDesp?"#4ade80":totPend>0?"#facc15":"#8ab4f8"}}>
                  {totDesp>0?((totPago/totDesp)*100).toFixed(0):0}% pago
                </span>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden",display:"flex"}}>
                <div style={{height:"100%",width:`${totDesp>0?(totPago/totDesp)*100:0}%`,background:"linear-gradient(90deg,#8ab4f888,#8ab4f8)",borderRadius:"3px 0 0 3px",transition:"width .5s"}}/>
                <div style={{height:"100%",width:`${totDesp>0?(totPend/totDesp)*100:0}%`,background:"linear-gradient(90deg,#facc1566,#facc1533)",transition:"width .5s"}}/>
              </div>
            </div>
          </div>
        )}


        {/* ── Vencidos ─────────────────────────────────────────── */}
        {overdueDue.length>0&&(
          <div style={{padding:"0 14px 6px"}}>
            <button onClick={()=>setShowOverdue(p=>!p)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"0 0 8px",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:10,color:"#f87171",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}><svg style={{flexShrink:0}} width="10" height="10" viewBox="0 0 24 24" fill="#f87171"><circle cx="12" cy="12" r="10"/></svg> Contas Vencidas</span>
                <span style={{fontSize:9,background:"#f87171",color:"#fff",padding:"2px 7px",borderRadius:4,fontWeight:800}}>{overdueDue.length}</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showOverdue?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showOverdue&&(
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {overdueDue.map((e,i)=>{
                  const delay=Math.abs(e._days);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(248,113,113,.06)",border:"1.5px solid #f8717133",borderRadius:10,padding:"9px 11px"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"var(--text1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                        <div style={{fontSize:9,color:"#f8717188",marginTop:1}}>{fmtDate(e._due)}</div>
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:"#fb923c",flexShrink:0}}>{fmt(eVal(e))}</div>
                      <div style={{fontSize:9,fontWeight:800,color:"#f87171",background:"rgba(248,113,113,.15)",border:"1px solid #f8717133",borderRadius:4,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>{delay}d atraso</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Próximos vencimentos ─────────────────────────────── */}
        {upcomingDue.length>0&&(
          <div style={{padding:"0 14px 10px"}}>
            <button onClick={()=>setShowUpcoming(p=>!p)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"0 0 8px",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:10,color:"#facc15",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}><svg style={{flexShrink:0}} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Próximos Vencimentos</span>
                <span style={{fontSize:9,background:"#facc15",color:"#0d1118",padding:"2px 7px",borderRadius:4,fontWeight:800}}>{upcomingDue.length}</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showUpcoming?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showUpcoming&&(
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {upcomingDue.map((e,i)=>{
                  const dayColor=e._days===0?"#fb923c":e._days<=3?"#facc15":"#8ab4f8";
                  const dayLabel=e._days===0?"Hoje":`${e._days}d`;
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:e._days===0?"rgba(251,146,60,.07)":"var(--card-bg)",border:`1.5px solid ${dayColor}33`,borderRadius:10,padding:"9px 11px"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"var(--text1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                        <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{fmtDate(e._due)}</div>
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":"#fb923c",flexShrink:0}}>{e.type==="receita"?"+":""}{fmt(eVal(e))}</div>
                      <div style={{fontSize:9,fontWeight:700,color:dayColor,background:dayColor+"18",border:`1px solid ${dayColor}33`,borderRadius:4,padding:"2px 7px",flexShrink:0}}>{dayLabel}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Search + controls — always visible */}
        <div style={{padding:"0 14px 8px",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{position:"relative"}}>
            <svg style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{...S.inp,paddingLeft:30,paddingRight:search?80:12,fontSize:12}} placeholder="Buscar por descrição ou observação..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&(
              <div style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:10,color:"var(--text3)",background:"var(--card-bg2)",borderRadius:4,padding:"1px 5px",fontWeight:600}}>{filtered.length}</span>
                <button onClick={()=>setSearch("")} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...S.selInput,flex:2}}>
              {FILTERS.map(([val,label,count])=>(
                <option key={val} value={val}>{label} ({count})</option>
              ))}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...S.selInput,flex:1}}>
              <option value="date">Data</option>
              <option value="amount">Valor</option>
              <option value="status">Status</option>
              <option value="name">Nome</option>
            </select>
            <button onClick={()=>setGroupBy(p=>!p)} className="fTab" style={{...S.fTab,...(groupBy?S.fTabActive:{}),padding:"5px 10px",fontSize:11,flexShrink:0}}>⊞</button>
          </div>
          {/* Category filter chips */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[{id:"all",name:"Todas"},...categories.filter(c=>{const used=monthEntries.some(e=>e.category===c.id);return used;})].map(c=>(
              <button key={c.id} onClick={()=>setFilterCat(c.id)}
                style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${filterCat===c.id?(c.color||"#8ab4f8"):"#111820"}`,background:filterCat===c.id?(c.color||"#8ab4f8")+"22":"transparent",color:filterCat===c.id?(c.color||"#8ab4f8"):"var(--text3)",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                {c.id!=="all"&&<span style={{width:5,height:5,borderRadius:"50%",background:c.color,display:"inline-block",marginRight:4,verticalAlign:"middle"}}/>}{c.name}
              </button>
            ))}
          </div>
          {/* Tag filter chips — só aparece se houver tags no mês */}
          {allTags.length>0&&(
            <div style={{display:"flex",gap:5,flexWrap:"wrap",paddingTop:2,borderTop:"1px solid var(--border2)"}}>
              <span style={{fontSize:9,color:"var(--text4)",alignSelf:"center",marginRight:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Tags:</span>
              {allTags.map(t=>(
                <button key={t} onClick={()=>setFilterTag(filterTag===t?"all":t)}
                  style={{padding:"2px 8px",borderRadius:5,border:`1px solid ${filterTag===t?"#8ab4f8":"#1a2840"}`,background:filterTag===t?"rgba(138,180,248,.18)":"transparent",color:filterTag===t?"#8ab4f8":"var(--text3)",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                  #{t}
                </button>
              ))}
              {filterTag!=="all"&&<button onClick={()=>setFilterTag("all")} style={{padding:"2px 6px",borderRadius:5,border:"none",background:"none",color:"#f87171",fontSize:10,cursor:"pointer"}}>✕ limpar</button>}
            </div>
          )}
        </div>

        {/* Banner — mês passado */}
        {selMonth<NOW&&(
          <div style={{margin:"4px 0 8px",padding:"8px 12px",background:"rgba(250,204,21,.07)",border:"1px solid rgba(250,204,21,.18)",borderRadius:10,display:"flex",alignItems:"center",gap:8,fontSize:11,color:"#facc15"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Visualizando mês passado — itens "a pagar" estão vencidos</span>
          </div>
        )}

        {/* List */}
        <div style={S.list}>
          {filtered.length===0&&(
            <div style={S.empty}>
              {search||filterCat!=="all"||filter!=="all"?(
                <>
                  <div style={{fontSize:36,opacity:0.3,marginBottom:8}}>🔍</div>
                  <div style={{color:"var(--text4)",fontSize:14,fontWeight:600}}>{search?"Nenhum resultado para busca":filterCat!=="all"?"Sem lançamentos nesta categoria":"Nenhum lançamento neste filtro"}</div>
                  <div style={{color:"var(--text4)",fontSize:12,marginTop:3}}>{search?"Tente outro termo":filterCat!=="all"?"Mude o filtro de categoria":"Remova o filtro para ver todos"}</div>
                </>
              ):(
                /* Estado de tela vazia — primeiro uso / mês sem dados */
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"8px 0"}}>
                  <div style={{width:72,height:72,borderRadius:20,background:"rgba(138,180,248,.08)",border:"1px solid #1a3a6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:4}}>💸</div>
                  <div style={{color:"var(--text1)",fontSize:15,fontWeight:700}}>Nenhum lançamento</div>
                  <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",lineHeight:1.5,maxWidth:220}}>Adicione receitas e despesas para visualizar seu saldo e relatórios.</div>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <button onClick={()=>{setFormType("receita");setForm(BLANK("receita"));setShowForm(true);}}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"10px 14px",background:"rgba(74,222,128,.1)",border:"1px solid #4ade8033",borderRadius:10,color:"#4ade80",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      <span>📈</span> Receita
                    </button>
                    <button onClick={()=>{setFormType("despesa");setForm(BLANK("despesa"));setShowForm(true);}}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"10px 14px",background:"rgba(251,146,60,.1)",border:"1px solid #fb923c33",borderRadius:10,color:"#fb923c",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      <span>📉</span> Despesa
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {grouped
            ?grouped.map(([catId,{items,total}])=>{
              const budget=budgets[catId];
              const budgetPct=budget>0?Math.min(100,(total/budget)*100):null;
              return(
              <div key={catId} style={{marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0 5px",borderBottom:"1px solid var(--border2)",marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:catColor(catId)}}/>
                  <div style={{fontSize:11,fontWeight:700,color:catColor(catId),textTransform:"uppercase",letterSpacing:"0.06em",flex:1}}>{catName(catId)}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#8ab4f8"}}>{fmt(total)}{budget>0&&<span style={{fontSize:9,color:budgetPct>100?"#f87171":"var(--text3)",marginLeft:4}}>/ {fmt(budget)}</span>}</div>
                </div>
                {budget>0&&<div style={{height:3,background:"var(--bg)",borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${budgetPct}%`,background:budgetPct>100?"#f87171":budgetPct>80?"#facc15":catColor(catId),borderRadius:2,transition:"width .5s"}}/></div>}
                {items.map(renderCard)}
              </div>
            )})
            :filtered.map(renderCard)
          }
        </div>
      </>)}

      <Suspense fallback={<div style={{flex:1}}/>}>
        {activeTab==="graficos"&&<ChartScreen entries={entries} dividas={dividas} categories={categories} nowMonth={NOW} cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas} accumSaldo={accumSaldo}/>}
        {activeTab==="cartoes"&&<CartaoScreen cards={cards} setCards={saveCards} cardPurchases={cardPurchases} setCardPurchases={saveCardPurchases} cardFaturas={cardFaturas} setCardFaturas={saveCardFaturas} categories={categories} nowMonth={NOW} toast={toast} onRevertFatura={handleRevertFatura}/>}
        {activeTab==="dividas"&&<DividasScreen dividas={dividas} setDividas={saveDividas} categories={categories} setCategories={saveCategories} nowMonth={NOW} toast={toast}/>}
        {activeTab==="saude"&&<SaudeScreen entries={entries} dividas={dividas} cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas} categories={categories} nowMonth={NOW} goals={goals} onSaveGoals={saveGoals} budgets={budgets} onSaveBudgets={saveBudgets} todayWidget={todayWidget} accounts={accounts} accountBalances={accountBalances}/>}
        {activeTab==="perfil"&&<ProfileScreen entries={entries} dividas={dividas} selMonth={selMonth} onExportMonth={()=>handleExportCSV(selMonth)} onExportAll={()=>handleExportCSV(null)} onExportRange={(from,to)=>handleExportCSV(from,to)} onExportPDF={()=>handleExportPDF(selMonth)} onReset={()=>{saveEntries([]);saveDividas([]);saveCards([]);saveCardPurchases([]);saveCardFaturas({});toast("Dados zerados","info");}} notifPerm={notifPerm} notifSettings={notifSettings} onNotifSettings={saveNotifSettings} onRequestPerm={async()=>{const r=await requestNotifPermission();setNotifPerm(r);}} onTestNotif={()=>checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings)} onBackup={handleBackup} onRestore={handleRestore} theme={theme} onTheme={saveTheme} fbUser={fbUser} onLogout={onLogout} categories={categories} onImportEntries={(newEntries,skipped=0)=>{saveEntries([...newEntries,...entries]);const sk=skipped>0?` (${skipped} duplicado${skipped!==1?"s":""} ignorado${skipped!==1?"s":""})`:"";toast(`✓ ${newEntries.length} lançamento${newEntries.length!==1?"s":""} importado${newEntries.length!==1?"s":""}${sk}`);}} accounts={accounts} onSaveAccounts={saveAccounts}/>}
        {activeTab==="admin"&&<AdminScreen fbUser={fbUser}/>}
      </Suspense>

      {/* Modal — Saúde Financeira */}
      {showHealth&&healthScore&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowHealth(false)}>
          <div className="modal-in" onClick={e=>e.stopPropagation()}
            style={{background:"var(--card-bg)",borderTopLeftRadius:22,borderTopRightRadius:22,width:"100%",maxWidth:480,maxHeight:"88vh",overflowY:"auto",padding:"20px 18px 40px",border:"1px solid var(--border)"}}>
            {/* Handle */}
            <div style={{width:36,height:4,borderRadius:2,background:"var(--border)",margin:"0 auto 18px"}}/>
            {/* Score circle */}
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Saúde Financeira — {mLabel(selMonth)}</div>
              <div style={{position:"relative",width:100,height:100,margin:"0 auto 10px"}}>
                <svg viewBox="0 0 110 110" style={{width:"100%",height:"100%"}}>
                  <circle cx="55" cy="55" r="46" fill="none" stroke="var(--card-bg2)" strokeWidth="10"/>
                  <circle cx="55" cy="55" r="46" fill="none" stroke={healthScore.color} strokeWidth="10"
                    strokeDasharray={`${(healthScore.score/100)*289} 289`} strokeLinecap="round"
                    transform="rotate(-90 55 55)" style={{transition:"stroke-dasharray .8s ease"}}/>
                  <text x="55" y="52" textAnchor="middle" fill={healthScore.color} fontSize="26" fontWeight="800">{healthScore.score}</text>
                  <text x="55" y="68" textAnchor="middle" fill="#94a3b8" fontSize="10">pontos</text>
                </svg>
              </div>
              <div style={{fontSize:17,fontWeight:700,color:healthScore.color}}>{healthScore.level==="Saudável"?"Saudável 💚":healthScore.level==="Atenção"?"Atenção ⚠️":"Crítico 🚨"}</div>
            </div>
            {/* Barra progresso */}
            <div style={{height:6,background:"var(--bg)",borderRadius:3,marginBottom:16,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${healthScore.score}%`,background:`linear-gradient(90deg,${healthScore.color}88,${healthScore.color})`,borderRadius:3,transition:"width .8s"}}/>
            </div>
            {/* Indicadores */}
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {[
                {label:"Gastos fixos / Renda",value:`${healthScore.fixedPct.toFixed(0)}%`,color:healthScore.fixedPct>70?"#f87171":healthScore.fixedPct>50?"#facc15":"#4ade80",detail:healthScore.fixedPct>70?"Acima do ideal (máx 70%)":healthScore.fixedPct>50?"Atenção (ideal < 50%)":"Ótimo"},
                {label:"Taxa de economia",value:`${healthScore.savingPct.toFixed(0)}%`,color:healthScore.savingPct<10?"#f87171":healthScore.savingPct<20?"#facc15":"#4ade80",detail:healthScore.savingPct<10?"Abaixo do mínimo (10%)":healthScore.savingPct<20?"Pode melhorar (ideal 20%+)":"Excelente"},
              ].map(({label,value,color,detail})=>(
                <div key={label} style={{background:"var(--bg)",borderRadius:11,padding:"11px 13px",border:"1px solid var(--border)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{label}</span>
                    <span style={{fontSize:14,fontWeight:800,color}}>{value}</span>
                  </div>
                  <div style={{height:4,background:"var(--card-bg2)",borderRadius:2,overflow:"hidden",marginBottom:5}}>
                    <div style={{height:"100%",width:value,background:color,borderRadius:2,transition:"width .6s"}}/>
                  </div>
                  <div style={{fontSize:10,color:"var(--text3)"}}>{detail}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowHealth(false)}
              style={{width:"100%",padding:"12px",background:"var(--card-bg2)",border:"1px solid var(--border)",borderRadius:12,color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav — 4 abas principais + "Mais" */}
      <nav className="appBottomNav" style={S.bottomNav}>
        {/* Desktop-only: botões "+ Receita" e "+ Despesa" no topo */}
        <button className="navDesktopOnly navAddReceita"
          onClick={()=>{setFormType("receita");setForm(BLANK("receita"));setShowForm(true);}}
          style={{display:"none",alignItems:"center",gap:10,padding:"10px 14px",background:"#0d2a1a",border:"1.5px solid #4ade8066",borderRadius:10,color:"#4ade80",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:2}}>
          <span style={{fontSize:15}}>📈</span><span>+ Receita</span>
        </button>
        <button className="navDesktopOnly navAddDespesa"
          onClick={()=>{setFormType("despesa");setForm(BLANK("despesa"));setShowForm(true);}}
          style={{display:"none",alignItems:"center",gap:10,padding:"10px 14px",background:"#1a1208",border:"1.5px solid #fb923c66",borderRadius:10,color:"#fb923c",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
          <span style={{fontSize:15}}>📉</span><span>+ Despesa</span>
        </button>

        {[
          ["lancamentos","Contas",<span key="l" style={{position:"relative",display:"inline-flex"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>{overdueDue.length>0&&<span style={{position:"absolute",top:-4,right:-5,minWidth:14,height:14,borderRadius:7,background:"#f87171",border:"1.5px solid var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#fff",padding:"0 2px"}}>{overdueDue.length}</span>}</span>],
          ["graficos","Análise",<svg key="g" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>],
          ["cartoes","Cartões",<svg key="c" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>],
          ["dividas","Dívidas",<svg key="d" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>],
        ].map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);setShowFabMenu(false);}} className="navBtn"
            style={{...S.navBtn,borderTop:activeTab===tab?"2px solid #8ab4f8":"2px solid transparent",...(activeTab===tab?S.navBtnActive:{})}}>
            <span style={{color:activeTab===tab?"#8ab4f8":"var(--text3)",transition:"all .2s",opacity:activeTab===tab?1:0.75,display:"inline-flex"}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:activeTab===tab?700:500,color:activeTab===tab?"#8ab4f8":"var(--text3)",marginTop:2}}>{label}</span>
          </button>
        ))}

        {/* Desktop-only: Saúde, Perfil, Admin direto no sidebar */}
        {[
          ["saude","Saúde",<svg key="s" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>],
          ["perfil","Perfil",<svg key="p" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
          ...(fbUser.email===ADMIN_EMAIL?[["admin","Admin",<svg key="a" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>]]:[]),
        ].map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>{setActiveTab(tab);setShowFabMenu(false);}} className="navDesktopOnly navBtn"
            style={{...S.navBtn,display:"none",borderTop:activeTab===tab?"2px solid #8ab4f8":"2px solid transparent",...(activeTab===tab?S.navBtnActive:{})}}>
            <div style={{position:"relative",display:"inline-flex"}}>
              <span style={{color:activeTab===tab?"#8ab4f8":"var(--text3)",transition:"all .2s",opacity:activeTab===tab?1:0.75}}>{icon}</span>
              {tab==="saude"&&budgetOverCount>0&&<div style={{position:"absolute",top:-4,right:-4,width:8,height:8,borderRadius:"50%",background:"#f87171",border:"1.5px solid var(--bg)"}}/>}
            </div>
            <span style={{fontSize:9,fontWeight:activeTab===tab?700:500,color:activeTab===tab?"#8ab4f8":"var(--text3)",marginTop:2}}>{label}</span>
          </button>
        ))}

        {/* Mobile-only: Botão "Mais" */}
        <button className="navMobileOnly navBtn" onClick={()=>setShowMoreNav(p=>!p)}
          style={{...S.navBtn,borderTop:["saude","perfil","admin"].includes(activeTab)?"2px solid #8ab4f8":"2px solid transparent",...(["saude","perfil","admin"].includes(activeTab)?S.navBtnActive:{})}}>
          <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:showMoreNav||["saude","perfil","admin"].includes(activeTab)?"#8ab4f8":"var(--text3)",fontSize:20,lineHeight:1,opacity:showMoreNav||["saude","perfil","admin"].includes(activeTab)?1:0.75}}>⋯</span>
            {budgetOverCount>0&&!["saude","perfil","admin"].includes(activeTab)&&(
              <div style={{position:"absolute",top:-5,right:-5,width:8,height:8,borderRadius:"50%",background:"#f87171",border:"1.5px solid var(--bg)"}}/>
            )}
          </div>
          <span style={{fontSize:9,fontWeight:["saude","perfil","admin"].includes(activeTab)?700:500,color:["saude","perfil","admin"].includes(activeTab)?"#8ab4f8":"var(--text3)",marginTop:2}}>Mais</span>
        </button>
      </nav>

      {/* Menu "Mais" expandido */}
      {showMoreNav&&(
        <div className="appMoreMenu" style={{position:"fixed",bottom:68,right:8,background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:6,zIndex:51,boxShadow:"0 8px 32px rgba(0,0,0,.7)",minWidth:150}}>
          {[
            ["saude","💊 Saúde"],
            ["perfil","👤 Perfil"],
            ...(fbUser.email===ADMIN_EMAIL?[["admin","🛡 Admin"]]:[] ),
          ].map(([tab,label])=>(
            <button key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"11px 14px",background:activeTab===tab?"#111820":"transparent",border:"none",borderRadius:9,color:activeTab===tab?"#8ab4f8":"#ccd",fontSize:13,fontWeight:activeTab===tab?700:500,cursor:"pointer",textAlign:"left"}}>
              {label}
              {tab==="saude"&&budgetOverCount>0&&(
                <span style={{marginLeft:"auto",fontSize:9,background:"#f87171",color:"#fff",padding:"1px 6px",borderRadius:4,fontWeight:800}}>{budgetOverCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* FAB — novo lançamento (visível na aba Contas, apenas mobile) */}
      {activeTab==="lancamentos"&&!showForm&&!editTarget&&!delTarget&&(
        <div className="appFabWrap">
          {/* Backdrop escurecido com blur */}
          {showFabMenu&&(
            <div
              onClick={()=>setShowFabMenu(false)}
              style={{position:"fixed",inset:0,zIndex:48,background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",animation:"fadeIn .18s ease"}}
            />
          )}

          {/* Bottom-sheet de escolha */}
          {showFabMenu&&(
            <div className="fabSheet" style={{position:"fixed",bottom:72,left:0,right:0,zIndex:49,maxWidth:480,margin:"0 auto",padding:"0 12px 12px"}}>
              <div style={{background:"var(--card-bg,#0d1118)",border:"1px solid var(--border,#111820)",borderRadius:20,overflow:"hidden",boxShadow:"0 -2px 40px rgba(0,0,0,.7)",animation:"slideUp .22s cubic-bezier(.22,1,.36,1)"}}>
                {/* Handle */}
                <div style={{display:"flex",justifyContent:"center",paddingTop:10,paddingBottom:6}}>
                  <div style={{width:36,height:4,borderRadius:2,background:"var(--border,#1e293b)",opacity:.5}}/>
                </div>
                {/* Label */}
                <div style={{fontSize:11,fontWeight:700,color:"var(--text4,#334)",textTransform:"uppercase",letterSpacing:"0.09em",textAlign:"center",paddingBottom:12}}>Novo lançamento</div>

                {/* Receita row */}
                <button
                  onClick={()=>{setFormType("receita");setForm(BLANK("receita"));setShowForm(true);setShowFabMenu(false);}}
                  className="fabSheetRow"
                  style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderTop:"1px solid var(--border2,#0f1825)"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"rgba(74,222,128,.12)",border:"1px solid rgba(74,222,128,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:700,color:"#4ade80",marginBottom:2}}>Receita</div>
                    <div style={{fontSize:11,color:"var(--text4,#556)"}}>Salário, freelance, transferência…</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text4,#556)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {/* Despesa row */}
                <button
                  onClick={()=>{setFormType("despesa");setForm(BLANK("despesa"));setShowForm(true);setShowFabMenu(false);}}
                  className="fabSheetRow"
                  style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderTop:"1px solid var(--border2,#0f1825)",borderBottom:"1px solid var(--border2,#0f1825)"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"rgba(251,146,60,.12)",border:"1px solid rgba(251,146,60,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:700,color:"#fb923c",marginBottom:2}}>Despesa</div>
                    <div style={{fontSize:11,color:"var(--text4,#556)"}}>Conta, compra, assinatura…</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text4,#556)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {/* Cancel */}
                <button
                  onClick={()=>setShowFabMenu(false)}
                  style={{width:"100%",padding:"13px",background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:"var(--text4,#556)",fontFamily:"inherit"}}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botão FAB principal */}
          <button
            className="fabBtn"
            onClick={()=>setShowFabMenu(p=>!p)}
            style={{position:"fixed",bottom:82,right:16,width:54,height:54,borderRadius:"50%",background:"linear-gradient(135deg,#1a6e3a,#0d4727)",border:"1.5px solid rgba(74,222,128,.3)",color:"#4ade80",cursor:"pointer",boxShadow:"0 4px 20px rgba(74,222,128,.25)",zIndex:49,display:"flex",alignItems:"center",justifyContent:"center",transition:"transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s",transform:showFabMenu?"rotate(45deg) scale(1.05)":"rotate(0deg) scale(1)"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      )}

      {confirmQueue&&<ConfirmModal {...confirmQueue}/>}
      {showForm&&<FormModal form={form} setForm={setForm} lockedType={formType} categories={categories} entries={entries} onUpdateCats={saveCategories} onAdd={handleAdd} onClose={()=>{setShowForm(false);setForm(BLANK());}} cards={cards} accounts={accounts}/>}
      {editTarget&&<EditModal entry={editTarget.entry} monthKey={editTarget.monthKey} categories={categories} entries={entries} onUpdateCats={saveCategories} onSave={handleSaveEdit} onClose={()=>setEditTarget(null)}/>}
      {delTarget&&<DeleteModal entry={delTarget} onDelete={handleDelete} onClose={()=>setDelTarget(null)}/>}
      {fatPayTarget&&<FaturaPayModal entry={fatPayTarget} onPay={handlePayFatura} onRevert={handleRevertFatura} onClose={()=>setFatPayTarget(null)}/>}
    </div>
  );
}

const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .hscroll::-webkit-scrollbar { display: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #1a2a40; border-radius: 2px; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.35); }
  select option { background: #0d1118; }
  ::placeholder { color: #667; }
  .statusToggleBtn:hover { filter: brightness(1.2); transform: scale(1.03); transition: all .15s; }
  .sumAddBtn:hover { filter: brightness(1.3); transform: scale(1.1); transition: all .15s; }
  .arrowBtn:hover { border-color: #1a3a6e !important; color: #8ab4f8 !important; }
  .hbtn:hover { opacity: 0.82; }
  .add-btn:hover { filter: brightness(1.15); }
  .iconBtn:hover { opacity: 0.6 !important; transform: scale(0.88); transition: all .15s; }
  .eCard:hover { border-color: #1a2840 !important; }
  .fTab:hover { border-color: #1a2840 !important; color: #8ab4f8 !important; }
  .navBtn:hover { background: #0d1118 !important; }
  .submitBtn:hover:not(:disabled) { filter: brightness(1.18); }
  .toast-in { animation: toastIn .3s cubic-bezier(0.34,1.56,0.64,1); }
  .modal-in { animation: slideUp .28s cubic-bezier(0.32,0.72,0,1); }
  @keyframes toastIn { from { opacity:0; transform: translateY(-12px) scale(0.9); } to { opacity:1; transform: translateY(0) scale(1); } }
  @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* ── Responsive: tablet (≥720px) ── */
  @media (min-width: 720px) {
    .appRoot { max-width: 720px; margin: 0 auto; border-left: 1px solid var(--border); border-right: 1px solid var(--border); min-height: 100vh; }
    .appBottomNav { max-width: 720px !important; }
    .sumGrid { grid-template-columns: repeat(4, 1fr) !important; }
  }

  /* ── Responsive: desktop (≥1024px) ── sidebar layout ── */
  @media (min-width: 1024px) {
    body { background: var(--bg) !important; }
    .appRoot {
      max-width: 1200px;
      margin: 0 auto;
      padding-left: 210px !important;
      padding-bottom: 0 !important;
      min-height: 100vh;
      position: relative;
      box-shadow: 0 0 40px rgba(0,0,0,.3);
    }
    /* Bottom nav → Left sidebar */
    .appBottomNav {
      position: fixed !important;
      top: 0 !important;
      bottom: 0 !important;
      left: max(0px, calc(50% - 600px)) !important;
      width: 210px !important;
      max-width: 210px !important;
      height: 100vh !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      align-items: stretch !important;
      padding: 24px 10px !important;
      gap: 4px !important;
      transform: none !important;
      border-top: none !important;
      border-right: 1px solid var(--border) !important;
      background: var(--bg) !important;
      overflow-y: auto;
      z-index: 40 !important;
    }
    .appBottomNav .navBtn {
      flex: 0 0 auto !important;
      width: 100% !important;
      flex-direction: row !important;
      justify-content: flex-start !important;
      align-items: center !important;
      padding: 12px 16px !important;
      gap: 12px !important;
      border-top: none !important;
      border-left: 3px solid transparent !important;
      border-radius: 10px !important;
      margin-bottom: 2px;
    }
    .appBottomNav .navBtn[style*="#8ab4f8"] {
      border-left-color: #8ab4f8 !important;
      background: var(--card-bg) !important;
    }
    .appBottomNav .navBtn span:last-child {
      font-size: 13px !important;
      font-weight: 600 !important;
      margin-top: 0 !important;
    }
    .appBottomNav .navAddReceita, .appBottomNav .navAddDespesa {
      width: 100% !important;
    }
    .appBottomNav .navAddReceita:hover { filter: brightness(1.15); }
    .appBottomNav .navAddDespesa:hover { filter: brightness(1.15); }
    /* Desktop-only items visíveis, mobile-only escondidos */
    .appBottomNav .navDesktopOnly { display: flex !important; }
    .navMobileOnly { display: none !important; }
    .appMoreMenu { display: none !important; }
    .appFabWrap { display: none !important; }
    /* Modals: centered card instead of bottom sheet */
    .appOverlay { align-items: center !important; padding: 20px; }
    .modal-in {
      max-width: 560px !important;
      border-radius: 16px !important;
      max-height: 88vh !important;
      animation: fadeIn .22s ease-out !important;
    }
    /* Toast moves to top-right */
    .appRoot > div[style*="position: fixed"][style*="bottom: 82"] {
      bottom: auto !important;
      top: 24px !important;
      right: 24px !important;
      left: auto !important;
      transform: none !important;
    }
    /* Wider grids & more spacing */
    .sumGrid { grid-template-columns: repeat(4, 1fr) !important; gap: 14px !important; }
    .heroCard { padding: 28px 28px !important; }
  }

  /* ── Responsive: large desktop (≥1280px) ── */
  @media (min-width: 1280px) {
    .appRoot { padding-left: 230px !important; }
    .appBottomNav { width: 230px !important; max-width: 230px !important; }
  }
  @keyframes celebrate { 0%{background-position:0%} 100%{background-position:100%} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
  @keyframes heroGlow { 0%,100%{box-shadow:0 0 0 rgba(74,222,128,0)} 50%{box-shadow:0 0 24px rgba(74,222,128,.15)} }
  .celebrate-glow { animation: heroGlow 2s ease-in-out 3; }
  -webkit-tap-highlight-color: transparent;

  /* ── CSS Variables: dark (default) ── */
  :root {
    --bg:#080c12; --card-bg:#0d1118; --card-bg2:#111820;
    --border:#1e293b; --border2:#0f172a; --border3:#1e293b;
    --text1:#e2e8f0; --text2:#cbd5e1; --text3:#94a3b8; --text4:#64748b;
    --inp-bg:#080c12; --nav-bg:#080c12;
    --hero-bg: linear-gradient(135deg,#0a2a1a 0%,#0d1f12 50%,#0a1a10 100%);
    --panel-bg:#0d1118; --panel-bg2:#080c12;
    --section-border:#0d1520;
    --accent:#8ab4f8;
    --tab-active-bg:#0d1a2e; --tab-active-border:#1a3a6e; --tab-active-color:#8ab4f8;
    --submit-bg:linear-gradient(135deg,#1a3a6e,#0d2247); --submit-border:#2a4a8e44; --submit-color:#8ab4f8;
  }

  /* ── Light mode CSS variables ── */
  .light-mode {
    --bg:#f8fafc; --card-bg:#ffffff; --card-bg2:#f1f5f9;
    --border:#e2e8f0; --border2:#e2e8f0; --border3:#f1f5f9;
    --text1:#0f172a; --text2:#1e293b; --text3:#64748b; --text4:#94a3b8;
    --inp-bg:#ffffff; --nav-bg:#ffffff;
    --hero-bg: linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#f0fdf4 100%);
    --panel-bg:#ffffff; --panel-bg2:#f9fafb;
    --section-border:#e5e7eb;
    --accent:#2563eb;
    --tab-active-bg:#eff6ff; --tab-active-border:#2563eb; --tab-active-color:#1d4ed8;
    --submit-bg:linear-gradient(135deg,#1e40af,#1d4ed8); --submit-border:#3b82f6; --submit-color:#ffffff;
  }

  /* ── Light mode base ── */
  .light-mode { background: var(--bg); color: var(--text1); }

  /* ── Global color resets in light mode ──
     All the hardcoded dark colors (#0d1118, #080c12, #111820, #0f1825) must become
     light equivalents. We use attribute selector for broad coverage. */

  /* Inputs, selects, textareas */
  .light-mode input, .light-mode select, .light-mode textarea {
    background: var(--inp-bg) !important; color: var(--text1) !important;
    border-color: var(--border) !important; }
  .light-mode input::placeholder, .light-mode textarea::placeholder { color: var(--text3) !important; }
  .light-mode input[type=date]::-webkit-calendar-picker-indicator { filter: none !important; }
  .light-mode select option { background: #ffffff; color: #111827; }
  /* Override select dropdown arrow to use dark color in light mode */
  .light-mode select[style*="background-image"], .light-mode [style*="backgroundImage"][style*="889"] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") !important; }

  /* ── Text color overrides ── */
  /* Primary text (#dde / #ccd → dark) */
  .light-mode [style*="color:#dde"], .light-mode [style*="color: #dde"] { color: #111827 !important; }
  .light-mode [style*="color:#ccd"], .light-mode [style*="color: #ccd"] { color: #374151 !important; }
  /* Secondary/muted text (#445 / #334 / #556 → gray) */
  .light-mode [style*="color:#445"], .light-mode [style*="color: #445"] { color: #6b7280 !important; }
  .light-mode [style*="color:#334"], .light-mode [style*="color: #334"] { color: #9ca3af !important; }
  .light-mode [style*="color:#556"], .light-mode [style*="color: #556"] { color: #6b7280 !important; }
  /* White text → dark */
  .light-mode [style*="color:#fff"], .light-mode [style*="color: #fff"],
  .light-mode [style*="color:white"] { color: #111827 !important; }
  .light-mode [style*='color:"#fff"'] { color: #111827 !important; }
  /* rgba(255,255,255,...) text → dark */
  .light-mode [style*="color:rgba(255,255,255,.6)"] { color: #6b7280 !important; }
  .light-mode [style*="color:rgba(255,255,255,.35)"] { color: #9ca3af !important; }

  /* ── Background overrides for dark panels ── */
  .light-mode [style*="background:#0d1118"], .light-mode [style*="background: #0d1118"] { background: #ffffff !important; }
  .light-mode [style*="background:#080c12"], .light-mode [style*="background: #080c12"] { background: #f9fafb !important; }
  .light-mode [style*="background:#111820"], .light-mode [style*="background: #111820"] { background: #f3f4f6 !important; }
  .light-mode [style*="background:#0f1825"], .light-mode [style*="background: #0f1825"] { background: #f3f4f6 !important; }
  .light-mode [style*="background:#0d1520"], .light-mode [style*="background: #0d1520"] { background: #f9fafb !important; }
  .light-mode [style*="background:#1a1208"], .light-mode [style*="background: #1a1208"] { background: #fff7ed !important; }
  .light-mode [style*="background:#0d2a1a"], .light-mode [style*="background: #0d2a1a"] { background: #f0fdf4 !important; }
  .light-mode [style*="background:#0a2a1a"], .light-mode [style*="background: #0a2a1a"] { background: #f0fdf4 !important; }
  .light-mode [style*="background:#0d1a2e"], .light-mode [style*="background: #0d1a2e"] { background: #eff6ff !important; }
  .light-mode [style*="background:#1a3a6e"], .light-mode [style*="background: #1a3a6e"] { background: #dbeafe !important; }
  .light-mode [style*="background:#0a2010"], .light-mode [style*="background: #0a2010"] { background: #f0fdf4 !important; }
  .light-mode [style*="background:#0d3520"], .light-mode [style*="background: #0d3520"] { background: #dcfce7 !important; }
  .light-mode [style*="background:#2a0d0d"], .light-mode [style*="background: #2a0d0d"] { background: #fef2f2 !important; }
  .light-mode [style*="background:#0d2247"], .light-mode [style*="background: #0d2247"] { background: #eff6ff !important; }
  .light-mode [style*="background:linear-gradient(135deg,#0d1118,#111820)"] { background: #f9fafb !important; }
  .light-mode [style*="background:linear-gradient(135deg,#1a3a6e,#0d2247)"] { background: linear-gradient(135deg,#2563eb,#1d4ed8) !important; }
  .light-mode [style*="background:linear-gradient(90deg,#0a2a1a,#0d3520,#0a2a1a)"] { background: linear-gradient(90deg,#f0fdf4,#dcfce7,#f0fdf4) !important; }

  /* ── Border overrides ── */
  .light-mode [style*="borderBottom:\"1px solid #0d1520\""], .light-mode [style*="borderBottom:\"1px solid #0f1825\""],
  .light-mode [style*="borderBottom:\"1px solid #111820\""] { border-bottom-color: #e5e7eb !important; }
  .light-mode [style*="border-bottom: 1px solid #0f1825"] { border-bottom-color: #e5e7eb !important; }

  /* Cards (entry rows) */
  .light-mode .eCard { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 1px 3px rgba(0,0,0,.06) !important; }
  .light-mode .eCard:hover { border-color: #d1d5db !important; box-shadow: 0 2px 8px rgba(0,0,0,.09) !important; }

  /* ── GradCard (Receitas / Despesas / Pago / A Pagar) ──
     Replace tinted/washed backgrounds with white + colored left border */
  .light-mode .gradCard {
    background: #ffffff !important;
    border-width: 1px !important;
    border-style: solid !important;
    box-shadow: 0 1px 4px rgba(0,0,0,.07) !important;
  }
  .light-mode .gradCardValue { color: #111827 !important; }
  .light-mode .gradCardLabel { opacity: 1 !important; font-weight: 700 !important; }
  .light-mode .gradCardLabel[style*="#4ade80"] { color: #15803d !important; }
  .light-mode .gradCardLabel[style*="#fb923c"] { color: #c2410c !important; }
  .light-mode .gradCardLabel[style*="#8ab4f8"] { color: #1d4ed8 !important; }
  .light-mode .gradCardLabel[style*="#facc15"] { color: #a16207 !important; }

  /* Sidebar add buttons in light mode */
  .light-mode .navAddReceita { background: #f0fdf4 !important; border-color: #22c55e !important; color: #15803d !important; }
  .light-mode .navAddReceita:hover { background: #dcfce7 !important; }
  .light-mode .navAddDespesa { background: #fff7ed !important; border-color: #fb923c !important; color: #c2410c !important; }
  .light-mode .navAddDespesa:hover { background: #ffedd5 !important; }

  /* Navigation tabs */
  .light-mode .fTab { border-color: #e5e7eb !important; color: #374151 !important; background: #ffffff !important; }
  .light-mode .fTab:hover { border-color: #9ca3af !important; color: #111827 !important; background: #f9fafb !important; }
  .light-mode .fTabActive { background: #eff6ff !important; border-color: #2563eb !important; color: #1d4ed8 !important; }

  /* Bottom nav */
  .light-mode nav { background: #ffffff !important; border-top: 1px solid #e5e7eb !important; box-shadow: 0 -2px 12px rgba(0,0,0,.06) !important; }
  .light-mode .navBtn { color: #6b7280 !important; }
  .light-mode .navBtn:hover { background: #f9fafb !important; }
  .light-mode .navBtnActive { background: #f3f4f6 !important; }

  /* Modals */
  .light-mode .modal-in { background: #ffffff !important; border-color: #e5e7eb !important; }

  /* Scroll */
  .light-mode .hscroll { background: transparent; }
  .light-mode ::-webkit-scrollbar-thumb { background: #d1d5db !important; }

  /* Buttons */
  .light-mode .submitBtn { background: linear-gradient(135deg,#1e40af,#1d4ed8) !important; border-color: #3b82f6 !important; color: #ffffff !important; }
  .light-mode .submitBtn:hover:not(:disabled) { background: linear-gradient(135deg,#1d4ed8,#2563eb) !important; }
  .light-mode .hbtn { background: #f9fafb !important; border-color: #e5e7eb !important; color: #374151 !important; }
  .light-mode .add-btn { background: linear-gradient(135deg,#1e40af,#1d4ed8) !important; border-color: #3b82f6 !important; color: #ffffff !important; }
  .light-mode .arrowBtn { background: #ffffff !important; border-color: #e5e7eb !important; color: #374151 !important; }
  .light-mode .arrowBtn:hover { border-color: #2563eb !important; color: #2563eb !important; }
  .light-mode .iconBtn:hover { opacity: 0.75 !important; }

  /* Header */
  .light-mode header { background: #ffffff; border-bottom-color: #e5e7eb !important; box-shadow: 0 1px 4px rgba(0,0,0,.06); }

  /* ── Hero / Saldo card ── */
  .light-mode .heroCard {
    background: linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#f0fdf4 100%) !important;
    border-color: #bbf7d0 !important;
    box-shadow: 0 2px 12px rgba(22,163,74,.1) !important;
  }
  /* Text inside hero card */
  .light-mode .heroCard [style*="color:rgba(255,255,255,.6)"] { color: #374151 !important; }
  .light-mode .heroCard [style*="color:rgba(255,255,255,.35)"] { color: #6b7280 !important; }
  .light-mode .heroCard [style*="color:rgba(255,255,255,.08)"] { border-top-color: rgba(0,0,0,.08) !important; }
  .light-mode .heroCard [style*="background:rgba(74,222,128,.18)"] { background: rgba(22,163,74,.15) !important; }

  /* Month navigator in light mode */
  .light-mode [style*="color:#fff"][style*="fontWeight:800"][style*="letterSpacing"] { color: #111827 !important; }

  /* Chart boxes */
  .light-mode .chartBox { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 1px 4px rgba(0,0,0,.06) !important; }
  .light-mode .chartBox [style*="color:#8ab4f8"] { color: #2563eb !important; }
  .light-mode .chartBox [style*="fill:#8ab4f8"] { fill: #2563eb !important; }
  .light-mode .chartBox [style*="stroke:#111820"] { stroke: #e5e7eb !important; }
  .light-mode .chartBox [style*="fill:#0d1118"] { fill: #ffffff !important; }
  .light-mode .chartBox [style*="fill:#1a2840"] { fill: #e5e7eb !important; }
  .light-mode .chartBox [style*="background:#080c12"] { background: #f9fafb !important; }
  .light-mode .chartBox [style*="background:#0d1118"] { background: #f9fafb !important; }

  /* Toast notifications in light mode */
  .light-mode .toast-in { box-shadow: 0 4px 16px rgba(0,0,0,.15) !important; }

  /* FAB button & sheet */
  .fabSheetRow:hover { background: rgba(255,255,255,.04) !important; }
  .fabSheetRow:active { background: rgba(255,255,255,.08) !important; }
  .light-mode .fabBtn { background: linear-gradient(135deg,#16a34a,#15803d) !important; border-color: #22c55e55 !important; color: #ffffff !important; box-shadow: 0 4px 16px rgba(22,163,74,.35) !important; }
  .light-mode .fabSheet > div { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 -4px 32px rgba(0,0,0,.14) !important; }
  .light-mode .fabSheetRow:hover { background: #f9fafb !important; }
  .light-mode .fabSheetRow:active { background: #f3f4f6 !important; }

  /* More-nav popup */
  .light-mode .moreNav { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 8px 24px rgba(0,0,0,.12) !important; }
  .light-mode .moreNav button { color: #374151 !important; }
  .light-mode .moreNav button:hover { background: #f9fafb !important; }

  /* Status toggle badges */
  .light-mode .statusToggleBtn { border-color: rgba(0,0,0,.08) !important; }

  /* Profile sections */
  .light-mode .profileSection { background: #ffffff !important; border-color: #e5e7eb !important; }
  .light-mode .profileItem { border-bottom-color: #f3f4f6 !important; }
  .light-mode .profileItem:hover { background: #f9fafb !important; }

  /* Toggle switch in light mode */
  .light-mode .toggleSwitch { background: #e5e7eb !important; border-color: #d1d5db !important; }
  .light-mode .toggleSwitch[data-on="true"] { background: #dcfce7 !important; border-color: #16a34a !important; }
  .light-mode .toggleSwitch .toggleThumb { background: #6b7280 !important; }
  .light-mode .toggleSwitch[data-on="true"] .toggleThumb { background: #16a34a !important; }

  /* Upcoming due section */
  .light-mode .upcomingBtn { background: #ffffff !important; }
  .light-mode .upcomingBtn:hover { background: #f9fafb !important; }

  /* Category filter chips */
  .light-mode .catChip { border-color: #e5e7eb !important; color: #374151 !important; }

  /* Health panel */
  .light-mode .healthPanel { background: #ffffff !important; border-color: #e5e7eb !important; }

  /* Group dividers */
  .light-mode .groupDivider { border-bottom-color: #e5e7eb !important; }

  /* Search input */
  .light-mode .searchWrap svg { stroke: #9ca3af !important; }

  /* Empty state */
  .light-mode .emptyState .emptyTitle { color: #374151 !important; }
  .light-mode .emptyState .emptySub { color: #6b7280 !important; }

  /* SVG text/lines in charts (fill/stroke attrs don't support CSS vars, override via CSS) */
  .light-mode .chartBox text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .chartBox text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .chartBox line[stroke="#111820"] { stroke: #e5e7eb !important; }
  .light-mode .chartBox line[stroke="#64748b"] { stroke: #d1d5db !important; }
  .light-mode .scoreCard circle[stroke="#111820"] { stroke: #e5e7eb !important; }
  .light-mode .scoreCard text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .scoreCard text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .donutSvg text[fill="#94a3b8"] { fill: #6b7280 !important; }

  /* ── Specific element fixes in light mode ── */

  /* Month label (large white text) */
  [data-theme="light"] .monthLabel { color: #111827 !important; }

  /* Section header titles (#dde text) */
  [data-theme="light"] [style*="color:#dde"] { color: #111827 !important; }
  [data-theme="light"] [style*="color:#ccd"] { color: #374151 !important; }
  [data-theme="light"] [style*="color:#445"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:#334"] { color: #9ca3af !important; }
  [data-theme="light"] [style*="color:#556"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:#667"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:#222"] { color: #6b7280 !important; }

  /* Dark panel backgrounds */
  [data-theme="light"] [style*="background:#0d1118"] { background: #ffffff !important; border-color: #e5e7eb !important; }
  [data-theme="light"] [style*="background:#080c12"] { background: #f9fafb !important; }
  [data-theme="light"] [style*="background:#111820"] { background: #f3f4f6 !important; }
  [data-theme="light"] [style*="background:#0f1825"] { background: #f3f4f6 !important; }
  [data-theme="light"] [style*="background:#0d1520"] { background: #f9fafb !important; }
  [data-theme="light"] [style*="background:#1a1208"] { background: #fff7ed !important; }
  [data-theme="light"] [style*="background:#0d2a1a"] { background: #f0fdf4 !important; }
  [data-theme="light"] [style*="background:#0a2a1a"] { background: #f0fdf4 !important; }
  [data-theme="light"] [style*="background:#0d1a2e"] { background: #eff6ff !important; }
  [data-theme="light"] [style*="background:#1a3a6e"] { background: #dbeafe !important; }
  [data-theme="light"] [style*="background:#0a2010"] { background: #f0fdf4 !important; }
  [data-theme="light"] [style*="background:#0d3520"] { background: #dcfce7 !important; }
  [data-theme="light"] [style*="background:#2a0d0d"] { background: #fef2f2 !important; }
  [data-theme="light"] [style*="background:#0d2247"] { background: #eff6ff !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#0d1118"] { background: #f9fafb !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1a3a6e"] { background: linear-gradient(135deg,#2563eb,#1d4ed8) !important; color: #fff !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1a4a2e"] { background: linear-gradient(135deg,#16a34a,#15803d) !important; color: #fff !important; }
  [data-theme="light"] [style*="background:linear-gradient(90deg,#0a2a1a"] { background: linear-gradient(90deg,#f0fdf4,#dcfce7,#f0fdf4) !important; }

  /* Border-top dividers */
  [data-theme="light"] [style*="borderTop:\"1px solid rgba(255,255,255,.08)\""] { border-top-color: rgba(0,0,0,.08) !important; }

  /* White text on now-light backgrounds */
  [data-theme="light"] [style*="color:#fff"] { color: #111827 !important; }
  [data-theme="light"] [style*="color: #fff"] { color: #111827 !important; }
  [data-theme="light"] [style*="color:rgba(255,255,255,.6)"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:rgba(255,255,255,.35)"] { color: #9ca3af !important; }

  /* Exception: white text stays white on colored/gradient buttons */
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1a3a6e"] [style*="color:#8ab4f8"] { color: #ffffff !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1e40af"] { color: #ffffff !important; }

  /* Keep colored accent text (green, red, orange, yellow, blue) — don't override */
  [data-theme="light"] [style*="color:#4ade80"] { color: #16a34a !important; }
  [data-theme="light"] [style*="color:#34d399"] { color: #059669 !important; }
  [data-theme="light"] [style*="color:#f87171"] { color: #dc2626 !important; }
  [data-theme="light"] [style*="color:#fb923c"] { color: #ea580c !important; }
  [data-theme="light"] [style*="color:#facc15"] { color: #d97706 !important; }
  [data-theme="light"] [style*="color:#8ab4f8"] { color: #2563eb !important; }
  [data-theme="light"] [style*="color:#a78bfa"] { color: #7c3aed !important; }

  /* Card screen dark backgrounds */
  [data-theme="light"] [style*="background:#0d1118"][style*="borderRadius:18"] { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 2px 8px rgba(0,0,0,.08) !important; }

  /* Health indicator in header */
  [data-theme="light"] [style*="background:#0d1118"][style*="border"][style*="borderRadius:8"] { background: #f9fafb !important; }

  /* Upcoming due buttons */
  [data-theme="light"] [style*="background:#0d1118"][style*="border"][style*="borderRadius:10"] { background: #ffffff !important; }

  /* Section separators (borderBottom dark) */
  [data-theme="light"] [style*="borderBottom:\"1px solid #0d1520\""] { border-bottom-color: #e5e7eb !important; }
  [data-theme="light"] [style*="borderBottom:\"1px solid #0f1825\""] { border-bottom-color: #e5e7eb !important; }
  [data-theme="light"] [style*="borderBottom:\"1px solid #111820\""] { border-bottom-color: #e5e7eb !important; }

  /* SumCard */
  [data-theme="light"] [style*="background:#0d1118"][style*="border:\"1px solid #111820\""] { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 1px 3px rgba(0,0,0,.06) !important; }

  /* Progress bar track */
  [data-theme="light"] [style*="height:5px"][style*="background:#080c12"],
  [data-theme="light"] [style*="height:5"][style*="background:#080c12"] { background: #e5e7eb !important; }
  [data-theme="light"] [style*="height:3"][style*="background:#080c12"] { background: #e5e7eb !important; }
  [data-theme="light"] [style*="height:4"][style*="background:#080c12"] { background: #e5e7eb !important; }

  /* Modal cancel/close buttons */
  [data-theme="light"] [style*="background:#111820"][style*="border:\"1px solid #1a2840\""] { background: #f3f4f6 !important; border-color: #e5e7eb !important; color: #374151 !important; }
  [data-theme="light"] .xBtn { background: #f3f4f6 !important; color: #374151 !important; }

  /* Installment preview box */
  [data-theme="light"] [style*="background:#080c12"][style*="border:\"1px solid #1a3a6e44\""] { background: #eff6ff !important; border-color: #bfdbfe !important; }

  /* Nav active background */
  [data-theme="light"] .navBtnActive { background: #f3f4f6 !important; }

  /* Month in SVG chart tooltip */
  [data-theme="light"] [fill="#0d1118"] { fill: #ffffff !important; }
  [data-theme="light"] [fill="#1a2840"] { fill: #e5e7eb !important; }
  [data-theme="light"] [fill="#94a3b8"] { fill: #6b7280 !important; }
  [data-theme="light"] [fill="#94a3b8"] { fill: #6b7280 !important; }
  [data-theme="light"] [fill="#8ab4f8"] { fill: #2563eb !important; }
  [data-theme="light"] [stroke="#111820"] { stroke: #e5e7eb !important; }
  [data-theme="light"] [stroke="#64748b"] { stroke: #d1d5db !important; }

  /* SVG chart legend text */
  [data-theme="light"] .chartBox [style*="color:#445"] { color: #6b7280 !important; }
  [data-theme="light"] .chartBox [style*="color:#ccd"] { color: #374151 !important; }

  /* ── Hero card class-based overrides ── */
  .light-mode .heroSubtext { color: #374151 !important; }
  .light-mode .heroMuted { color: #6b7280 !important; }
  .light-mode .heroCardFooter { border-top-color: rgba(0,0,0,.08) !important; }
  .light-mode .monthLabel { color: #111827 !important; }

  /* ── Accent colors mapped to light equivalents ── */
  .light-mode [style*="color:#4ade80"]:not([style*="background"]) { color: #16a34a !important; }
  .light-mode [style*="color:#34d399"]:not([style*="background"]) { color: #059669 !important; }
  .light-mode [style*="color:#f87171"]:not([style*="background"]) { color: #dc2626 !important; }
  .light-mode [style*="color:#fb923c"]:not([style*="background"]) { color: #ea580c !important; }
  .light-mode [style*="color:#facc15"]:not([style*="background"]) { color: #d97706 !important; }
  .light-mode [style*="color:#8ab4f8"]:not([style*="background"]) { color: #2563eb !important; }
  .light-mode [style*="color:#a78bfa"]:not([style*="background"]) { color: #7c3aed !important; }

  /* ── Card title and meta text ── */
  .light-mode .eCard [style*="color:#dde"] { color: #111827 !important; }
  .light-mode .eCard [style*="color:#ccd"] { color: #374151 !important; }
  .light-mode .eCard [style*="color:#445"] { color: #6b7280 !important; }
  .light-mode .eCard [style*="color:#334"] { color: #9ca3af !important; }
  .light-mode .eCard [style*="color:#556"] { color: #6b7280 !important; }

  /* ── Section headers ── */
  .light-mode [style*="borderBottom"][style*="#0d1520"] { border-bottom-color: #e5e7eb !important; }
  .light-mode [style*="borderBottom"][style*="#0f1825"] { border-bottom-color: #e5e7eb !important; }
  .light-mode [style*="borderBottom"][style*="#111820"] { border-bottom-color: #e5e7eb !important; }

  /* ── Cartão screen (credit cards) ── */
  .light-mode [style*="background:#0d1118"][style*="borderRadius:18"] { background: #ffffff !important; }
  .light-mode [style*="background:#0d1118"][style*="borderRadius:14"] { background: #ffffff !important; border-color: #e5e7eb !important; }

  /* ── Saúde screen ── */
  .light-mode [style*="background:linear-gradient(135deg,#0d1118,#111820)"] { background: #f9fafb !important; }
  .light-mode [style*="background:rgba(138,180,248,.06)"] { background: #eff6ff !important; border-color: #bfdbfe !important; }
  .light-mode [style*="border:\"1px solid #1a3a6e\""] { border-color: #bfdbfe !important; }

  /* ── Profile screen ── */
  .light-mode [style*="background:#0d1118"][style*="borderRadius:13"] { background: #ffffff !important; border-color: #e5e7eb !important; }
  .light-mode [style*="borderBottom:\"none\""] { border-bottom: none; }
  .light-mode [style*="borderBottom"][style*="#0f1825"] { border-bottom-color: #e5e7eb !important; }

  /* ── Modal backgrounds ── */
  .light-mode [style*="background:#080c12"][style*="borderRadius:11"],
  .light-mode [style*="background:#080c12"][style*="borderRadius:12"] { background: #f9fafb !important; }
  .light-mode [style*="background:#080c12"][style*="borderRadius:8"] { background: #f9fafb !important; }
  .light-mode [style*="background:#080c12"][style*="borderRadius:9"] { background: #f9fafb !important; }
  .light-mode [style*="background:#080c12"][style*="borderRadius:10"] { background: #f9fafb !important; }
  .light-mode [style*="background:\"#111820\""] { background: #f3f4f6 !important; }

  /* ── Upcoming due buttons ── */
  .light-mode [style*="background:#0d1118"][style*="border"][style*="borderRadius:10"] { background: #ffffff !important; }
  .light-mode [style*="background:rgba(248,113,113,.07)"] { background: #fef2f2 !important; }
  .light-mode [style*="background:rgba(251,146,60,.07)"] { background: #fff7ed !important; }

  /* ── Health score circle track ── */
  .light-mode [stroke="#111820"] { stroke: #e5e7eb !important; }
  .light-mode [fill="#111820"] { fill: #f3f4f6 !important; }
  .light-mode [fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode [fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode [stroke="#64748b"] { stroke: #d1d5db !important; }

  /* ── Scrollbar ── */
  .light-mode ::-webkit-scrollbar-thumb { background: #d1d5db !important; }
  .light-mode ::-webkit-scrollbar { background: #f9fafb; }
`;

export default App;
