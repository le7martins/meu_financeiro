import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { saveUserProfile, ADMIN_EMAIL, wipeLocalData, isEmailAllowed } from './db';
import VerifyEmailScreen from './VerifyEmailScreen.jsx';
import PendingAccessScreen from './PendingAccessScreen.jsx';
import { onForegroundMessage } from './fcm';
import LoginScreen from './LoginScreen';
import { fmt, fmtDate, mLabel, addM, eVal, loadLS, saveLS, daysInMonth } from './utils.js';
import { BLANK } from './constants.js';
import { getMonthEntries, accumulatedBalance, accountBalances } from './logic.js';
import { requestNotifPermission, fireNotification, checkAndNotify } from './notifications.js';
import {
  toggleEntryStatus, toggleDividaMonth, applyEntryEdit, deleteEntry, payFatura, revertFatura,
  isFormValid, findDuplicate, entryFromForm, cardPurchaseFromForm, buildCsv, csvFileName, buildBackup, validateBackup,
} from './entryActions.js';
import { useUserData } from './hooks/useUserData.js';
import { useMonthStats } from './hooks/useMonthStats.js';
import { useToast } from './hooks/useToast.js';
import { migrateCategories } from './categoryMigration.js';
import { useToday } from './hooks/useToday.js';
import S from './styles.js';
import { CSS } from './appCss.js';
import { applyTheme } from './theme.js';
import { generateMonthPDF } from './pdfReport.js';
import HomeScreen, { useHomeUi } from './screens/HomeScreen.jsx';
import AppHeader from './components/AppHeader.jsx';
import BottomNav from './components/BottomNav.jsx';
import FabMenu from './components/FabMenu.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import ToastStack from './components/ToastStack.jsx';
import Confetti from './components/Confetti.jsx';
import HealthModal from './modals/HealthModal.jsx';
import FaturaPayModal from './modals/FaturaPayModal.jsx';
import FormModal from './modals/FormModal.jsx';
import EditModal from './modals/EditModal.jsx';
import DeleteModal from './modals/DeleteModal.jsx';
import ConfirmModal from './modals/ConfirmModal.jsx';
const ChartScreen      = lazy(() => import('./screens/ChartScreen.jsx'));
const CartaoScreen     = lazy(() => import('./screens/CartaoScreen.jsx'));
const DividasScreen    = lazy(() => import('./screens/DividasScreen.jsx'));
const ProfileScreen    = lazy(() => import('./screens/ProfileScreen.jsx'));
const SaudeScreen      = lazy(() => import('./screens/SaudeScreen.jsx'));
const AdminScreen      = lazy(() => import('./screens/AdminScreen.jsx'));
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen.jsx'));

const notifAllowed = (settings) => settings.enabled && "Notification" in window && Notification.permission === "granted";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// Confirmação de e-mail só é exigida de contas criadas a partir desta data.
const VERIFY_REQUIRED_FROM = Date.parse('2026-11-12T00:00:00Z');

// ─── App (auth gate) ─────────────────────────────────────────
function App(){
  const [fbUser, setFbUser] = useState(undefined);
  const [, setVerTick] = useState(0); // força re-render após user.reload()
  const [access, setAccess] = useState('checking'); // 'checking' | 'ok' | 'denied'
  const [accessTick, setAccessTick] = useState(0);
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u=>{
      setFbUser(prev=>{
        if(prev?._isDemo) return prev; // keep demo user — don't let Firebase override it
        if(u) saveUserProfile(u);
        return u??null;
      });
    });
    return unsub;
  },[]);
  // Só e-mails da lista de convidados usam o app (as regras do Firestore também exigem isso;
  // aqui é só a mensagem amigável). Em erro de rede, deixa passar: quem decide são as regras.
  useEffect(()=>{
    if(!fbUser||fbUser._isDemo||!fbUser.email||fbUser.email===ADMIN_EMAIL){ setAccess('ok'); return; }
    let off=false;
    setAccess('checking');
    isEmailAllowed(fbUser.email).then(ok=>{ if(!off) setAccess(ok?'ok':'denied'); }).catch(()=>{ if(!off) setAccess('ok'); });
    return ()=>{ off=true; };
  },[fbUser,accessTick]);
  if(fbUser===undefined) return(
    <div style={{position:'fixed',inset:0,background:'#080c12',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <img src="/meu_financeiro/icon-192.png" alt="CashUp" style={{width:64,height:64,borderRadius:16,animation:'lp 1.4s ease-in-out infinite',objectFit:"cover"}}/>
    </div>
  );
  if(!fbUser) return <LoginScreen onLogin={u=>setFbUser(u)}/>;
  const handleLogout = () => {
    applyTheme("dark"); // tela de login é só no tema escuro
    if(fbUser._isDemo){
      // Demo mode: just clear state and demo localStorage data
      Object.keys(localStorage).filter(k=>k.startsWith(`mf2_${fbUser.uid}`)).forEach(k=>localStorage.removeItem(k));
      setFbUser(null);
      return;
    }
    // Limpa o cache local do usuário e o cache offline do Firestore (IndexedDB), para que
    // o próximo usuário deste aparelho não tenha acesso aos dados do anterior.
    (async()=>{
      try{ await signOut(auth); }catch(e){ console.warn('[logout]',e); }
      await wipeLocalData();
      location.reload();
    })();
  };
  // Conta e-mail/senha precisa confirmar o e-mail (Google já vem verificado).
  const isNewAccount = Date.parse(fbUser.metadata?.creationTime) >= VERIFY_REQUIRED_FROM; // contas antigas ficam isentas
  const needsVerify = !fbUser._isDemo && isNewAccount && fbUser.providerData?.some(p=>p.providerId==='password') && !fbUser.emailVerified;
  if(needsVerify) return <VerifyEmailScreen user={fbUser} onChecked={()=>setVerTick(t=>t+1)} onLogout={handleLogout}/>;
  if(access==='checking') return <div style={{position:'fixed',inset:0,background:'#080c12'}}/>;
  if(access==='denied') return <PendingAccessScreen email={fbUser.email} onRetry={()=>setAccessTick(t=>t+1)} onLogout={handleLogout}/>;
  return <MainApp key={fbUser.uid} fbUser={fbUser} onLogout={handleLogout}/>;
}

// ─── MainApp ─────────────────────────────────────────────────
function MainApp({ fbUser, onLogout }){
  const userData = useUserData(fbUser.uid, { cloud: !fbUser._isDemo });
  const { entries, dividas, cards, cardPurchases, cardFaturas, categories, notifSettings, theme, goals, budgets, accounts,
    save, dbReady, syncStatus, k } = userData;
  const today = useToday();
  const NOW = today.substring(0, 7);

  const [selMonth,     setSelMonth]     = useState(NOW);
  const [activeTab,    setActiveTab]    = useState("lancamentos");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [formType,     setFormType]     = useState("despesa");
  const [form,         setForm]         = useState(BLANK());
  const [editTarget,   setEditTarget]   = useState(null);
  const [delTarget,    setDelTarget]    = useState(null);
  const [fatPayTarget, setFatPayTarget] = useState(null);
  const [notifPerm,    setNotifPerm]    = useState(()=>"Notification" in window?Notification.permission:"unsupported");
  const [showOnboarding, setShowOnboarding] = useState(()=>!loadLS(k('onboarding_done'), false));
  const [showMoreNav,  setShowMoreNav]  = useState(false);
  const [showFabMenu,  setShowFabMenu]  = useState(false);
  const [showHealth,   setShowHealth]   = useState(false);
  const [confirmQueue, setConfirmQueue] = useState(null); // {title,message,detail,danger,confirmLabel,onConfirm}
  const [showCelebrate, setShowCelebrate] = useState(false);
  const homeUi = useHomeUi();
  const {toasts,toast,dismiss} = useToast();
  const showConfirm = useCallback((opts)=> new Promise(resolve=>{
    setConfirmQueue({...opts, onConfirm:()=>{setConfirmQueue(null);resolve(true);}, onClose:()=>{setConfirmQueue(null);resolve(false);}});
  }),[]);

  const openForm = useCallback((type)=>{ setFormType(type); setForm(BLANK(type)); setShowForm(true); },[]);

  // ─── FCM: mensagens em primeiro plano ────────────────────────
  useEffect(()=>onForegroundMessage(payload=>{
    const { title, body } = payload.notification || {};
    if(title) toast(`🔔 ${title}${body?`: ${body}`:""}`, "info");
  }),[toast]);

  // Notificações locais de vencimento: uma vez por dia, após a carga inicial
  useEffect(()=>{
    if(!dbReady||!notifAllowed(notifSettings)) return;
    if(loadLS(k("notif_last"),null)===today) return;
    const t=setTimeout(()=>{checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings);saveLS(k("notif_last"),today);},1500);
    return ()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dbReady,today]);

  const stats = useMonthStats({ entries, dividas, cards, cardPurchases, cardFaturas, budgets, selMonth, today });
  const { monthEntries, totRec, totDesp, totPend, saldo, healthScore, budgetOverCount, overdueDue } = stats;

  // Meta de economia atingida
  const prevGoalAlertRef = useRef(false);
  useEffect(()=>{
    if(!dbReady||selMonth!==NOW||!goals.savingsPct||goals.savingsPct<=0||totRec<=0) return;
    const economiaPct = (Math.max(0,saldo)/totRec)*100;
    const metaAtingida = economiaPct >= goals.savingsPct;
    if(metaAtingida && !prevGoalAlertRef.current){
      prevGoalAlertRef.current = true;
      toast(`🎯 Meta de economia de ${goals.savingsPct}% atingida! Parabéns!`,"celebrate");
      setShowCelebrate(true);
      setTimeout(()=>setShowCelebrate(false),4000);
      if(notifAllowed(notifSettings)) fireNotification("🎯 Meta de economia atingida!",`Você economizou ${economiaPct.toFixed(0)}% da sua renda este mês. Continue assim!`,"mf-goal");
    } else if(!metaAtingida){
      prevGoalAlertRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dbReady, goals.savingsPct, totRec, saldo, selMonth]);

  // Meta de renda atingida
  const prevIncomeAlertRef = useRef(false);
  useEffect(()=>{
    if(!dbReady||selMonth!==NOW||!goals.monthly||goals.monthly<=0||totRec<=0) return;
    const metaAtingida = totRec >= goals.monthly;
    if(metaAtingida && !prevIncomeAlertRef.current){
      prevIncomeAlertRef.current = true;
      toast(`🏆 Meta de renda de ${fmt(goals.monthly)} atingida!`,"celebrate");
      if(notifAllowed(notifSettings)) fireNotification("🏆 Meta de renda atingida!",`Você recebeu ${fmt(totRec)} este mês — meta de ${fmt(goals.monthly)} alcançada!`,"mf-income-goal");
    } else if(!metaAtingida){ prevIncomeAlertRef.current=false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dbReady,goals.monthly,totRec,selMonth]);

  // Acumulado até o mês ATUAL (a Análise projeta a partir de hoje, independentemente do mês aberto em Contas)
  const accumNow=useMemo(()=>accumulatedBalance({entries,dividas,cards,cardPurchases,cardFaturas},NOW,today)?.value??0,[entries,dividas,cards,cardPurchases,cardFaturas,NOW,today]);

  // Saldo por conta (inclui lançamentos recorrentes pagos e saldo inicial negativo)
  const accountBalancesMap = useMemo(()=>accounts.length?accountBalances(accounts,{entries},today):{},[accounts,entries,today]);

  // "Quanto posso gastar hoje" — (recebido - pago - a pagar) / dias restantes no mês
  const todayWidget = useMemo(()=>{
    if(selMonth !== NOW) return null;
    const daysLeft = daysInMonth(NOW) - Number(today.substring(8)) + 1; // inclui hoje
    const available = totRec - totDesp - totPend;
    return { available, perDay: available / daysLeft, daysLeft };
  },[selMonth, NOW, today, totRec, totDesp, totPend]);

  // ─── Keyboard shortcuts ───────────────────────────────────────
  useEffect(()=>{
    const onKey=(e)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==='g'){e.preventDefault();setShowGlobalSearch(p=>!p);return;}
      if(e.key==='Escape'){setShowGlobalSearch(false);}
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(showForm||editTarget||delTarget||fatPayTarget) return;
      if(activeTab==='lancamentos'){
        if(e.key==='ArrowLeft'){setSelMonth(p=>addM(p,-1));}
        else if(e.key==='ArrowRight'){setSelMonth(p=>addM(p,1));}
        else if(e.key==='n'||e.key==='N'){e.preventDefault();openForm('despesa');}
        else if(e.key==='/'){e.preventDefault();setShowGlobalSearch(true);}
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[activeTab,showForm,editTarget,delTarget,fatPayTarget,openForm]);

  // ─── Alerta de orçamento estourado (uma vez por mês/categoria, só no mês atual) ─
  const alertedBudgets=useRef(new Set());
  useEffect(()=>{
    if(!dbReady||selMonth!==NOW||!Object.keys(budgets).length) return;
    const fresh=[];
    Object.entries(budgets).forEach(([catId,limit])=>{
      if(!limit||limit<=0) return;
      const key=`${selMonth}_${catId}`;
      if(alertedBudgets.current.has(key)) return;
      const total=monthEntries.filter(e=>e.type==='despesa'&&e.category===catId).reduce((s,e)=>s+eVal(e),0);
      if(total<=limit) return;
      const cat=categories.find(c=>c.id===catId);
      alertedBudgets.current.add(key);
      if(cat) fresh.push({cat,total,limit});
    });
    if(!fresh.length) return;
    // Vários estouros de uma vez viram um único aviso
    if(fresh.length===1){
      const {cat,total,limit}=fresh[0];
      toast(`⚠️ Orçamento de "${cat.name}" estourado (${fmt(total)} / ${fmt(limit)})`,'error');
      if(notifAllowed(notifSettings)) fireNotification(`⚠️ Orçamento estourado: ${cat.name}`,`Você gastou ${fmt(total)} de um limite de ${fmt(limit)} este mês.`,`budget-${cat.id}`);
    } else {
      const names=fresh.map(f=>f.cat.name).join(", ");
      toast(`⚠️ ${fresh.length} orçamentos estourados: ${names}`,'error');
      if(notifAllowed(notifSettings)) fireNotification(`⚠️ ${fresh.length} orçamentos estourados`,names,'budget-multi');
    }
  },[dbReady,selMonth,NOW,monthEntries,budgets,categories,toast,notifSettings]);

  // ─── Ações ────────────────────────────────────────────────────
  const handleToggle=useCallback((entry)=>{
    if(entry.isFatura){ if(!entry.isOpenFatura) setFatPayTarget(entry); return; }
    if(entry.isDivida){
      const r=toggleDividaMonth(dividas,entry.dividaId,selMonth);
      save.dividas(r.dividas);
      if(r.quitada) toast("🎉 Dívida quitada! Parabéns!","celebrate");
      toast(entry.statusForMonth==="pago"?"Parcela marcada como pendente":"Parcela marcada como paga");
      return;
    }
    const r=toggleEntryStatus(entries,entry,selMonth,today);
    save.entries(r.entries);
    toast(r.status==="pago"?"✓ Marcado como pago":"↩ Marcado como pendente");
  },[dividas,entries,selMonth,today,save,toast]);

  const handleAdd=useCallback(async()=>{
    if(!isFormValid(form)) return;
    if(form.type==="despesa"&&form.payWith&&form.payWith!=="saldo"){
      const card=cards.find(c=>c.id===form.payWith);
      if(card){
        save.cardPurchases([cardPurchaseFromForm(form,card.id),...cardPurchases]);setForm(BLANK());setShowForm(false);
        toast(`✓ Lançado na fatura de ${card.name}`);
        return;
      }
    }
    const dup=findDuplicate(entries,form);
    if(dup){
      const ok=await showConfirm({title:"Lançamento duplicado?",message:`"${dup.description}" já existe em ${fmtDate(dup.date)} (${fmt(parseFloat(dup.amount))}).`,detail:"Deseja adicionar mesmo assim?",confirmLabel:"Adicionar mesmo assim",danger:false});
      if(!ok) return;
    }
    save.entries([entryFromForm(form),...entries]);setForm(BLANK());setShowForm(false);
    toast(`✓ ${form.type==="receita"?"Receita":"Despesa"} adicionada`);
  },[form,cards,entries,cardPurchases,save,toast,showConfirm]);

  const handleSaveEdit=useCallback((entryId,changes,scope)=>{
    save.entries(applyEntryEdit(entries,entryId,changes,scope,selMonth));
    setEditTarget(null);toast("✓ Lançamento atualizado");
  },[entries,selMonth,save,toast]);

  const handleClone=useCallback((entry)=>{
    setFormType(entry.type);
    setForm({...BLANK(entry.type),description:entry.description,amount:String(eVal(entry)),category:entry.category,notes:entry.notes||"",tags:entry.tags||[]});
    setShowForm(true);
  },[]);

  // Para o "Desfazer" ler a lista ATUAL (e não a de quando o toast foi criado)
  const entriesRef=useRef(entries);
  entriesRef.current=entries;
  const handleDelete=useCallback((entryId,scope)=>{
    const before=entries.find(e=>e.id===entryId);
    save.entries(deleteEntry(entries,entryId,scope,selMonth));
    setDelTarget(null);
    toast("Lançamento removido","info","Desfazer",()=>{
      if(!before) return;
      const cur=entriesRef.current;
      // restaura só este lançamento; edições feitas nos outros ficam como estão
      save.entries(cur.some(e=>e.id===before.id)?cur.map(e=>e.id===before.id?before:e):[before,...cur]);
    });
  },[entries,selMonth,save,toast]);

  const handlePayFatura=useCallback((entry,amount,partial)=>{
    const r=payFatura(cardFaturas,entry,amount,partial,today);
    if(r.noop){setFatPayTarget(null);return;}
    save.cardFaturas(r.cardFaturas);
    setFatPayTarget(null);
    toast(r.fullyPaid?"✓ Fatura paga":"Pagamento parcial registrado");
  },[cardFaturas,today,save,toast]);

  const handleRevertFatura=useCallback((faturaKey)=>{
    save.cardFaturas(revertFatura(cardFaturas,faturaKey));toast("↩ Pagamento estornado","info");
  },[cardFaturas,save,toast]);

  const handleBackup=useCallback(()=>{
    const data=buildBackup({entries,dividas,cards,cardPurchases,cardFaturas,categories,accounts,goals,budgets,notifSettings});
    download(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),`meu-financeiro-backup-${today}.json`);
    toast("💾 Backup salvo");
  },[entries,dividas,cards,cardPurchases,cardFaturas,categories,accounts,goals,budgets,notifSettings,today,toast]);

  const handleRestore=useCallback((e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      let data;
      try{ data=JSON.parse(ev.target.result); }
      catch{ toast("Arquivo JSON inválido ou corrompido","error"); return; }
      // Valida tudo ANTES de tocar nos dados atuais
      const v=validateBackup(data);
      if(!v.ok){ toast(v.error,"error"); return; }
      const c=v.counts;
      const parts=[`${c.entries} lançamento${c.entries!==1?"s":""}`,c.dividas!=null&&`${c.dividas} dívida${c.dividas!==1?"s":""}`,c.cards!=null&&`${c.cards} cartõ${c.cards!==1?"es":"o"}`,c.accounts!=null&&`${c.accounts} conta${c.accounts!==1?"s":""}`].filter(Boolean).join(" · ");
      const ok=await showConfirm({title:"Restaurar backup?",message:"Todos os dados atuais serão substituídos pelos dados do backup.",detail:`Backup de ${data.exportedAt?new Date(data.exportedAt).toLocaleDateString("pt-BR"):"data desconhecida"} · ${parts}`,confirmLabel:"Restaurar",danger:true});
      if(!ok) return;
      try{
        // Backups antigos podem ter categorias "both": ajusta antes de salvar
        const mig=migrateCategories({categories:data.categories||categories,entries:data.entries,budgets:data.budgets||budgets});
        save.entries(mig.entries);
        if(data.categories||mig.changedCats) save.categories(mig.categories);
        if(data.budgets||mig.changedBudgets)  save.budgets(mig.budgets);
        if(data.dividas)       save.dividas(data.dividas);
        if(data.cards)         save.cards(data.cards);
        if(data.cardPurchases) save.cardPurchases(data.cardPurchases);
        if(data.cardFaturas)   save.cardFaturas(data.cardFaturas);
        if(data.accounts)      save.accounts(data.accounts);
        if(data.goals)         save.goals(data.goals);
        if(data.notifSettings) save.notifSettings(data.notifSettings);
        toast("✅ Backup restaurado!");
      } catch(err){
        toast("Erro ao restaurar backup","error");
        console.error("[Restore]",err);
      }
    };
    reader.readAsText(file);e.target.value="";
  },[save,toast,showConfirm,categories,budgets]);

  const handleExportCSV=useCallback((mk,toMk)=>{
    const csv=buildCsv({entries,dividas,cards,cardPurchases,cardFaturas,categories},mk,toMk);
    download(new Blob([String.fromCharCode(0xFEFF)+csv],{type:"text/csv;charset=utf-8"}),csvFileName(mk,toMk));
    toast("📊 CSV exportado");
  },[entries,dividas,cards,cardPurchases,cardFaturas,categories,toast]);

  const handleExportPDF=useCallback((mk)=>{
    generateMonthPDF({
      entries,monthKey:mk||selMonth,categories,
      mLabel,fmt,fmtDate,eVal,getMonthEntries,
      dividas,cards,cardPurchases,cardFaturas,
    });
    toast("📄 Relatório aberto — use Ctrl+P / Cmd+P para salvar como PDF","info");
  },[entries,dividas,cards,cardPurchases,cardFaturas,categories,selMonth,toast]);

  const handleReset=()=>{save.entries([]);save.dividas([]);save.cards([]);save.cardPurchases([]);save.cardFaturas({});toast("Dados zerados","info");};
  const handleImport=(newEntries,skipped=0)=>{
    save.entries([...newEntries,...entries]);
    const n=newEntries.length, pl=(c,s,p)=>c!==1?p:s;
    const sk=skipped>0?` (${skipped} ${pl(skipped,"duplicado ignorado","duplicados ignorados")})`:"";
    toast(`✓ ${n} ${pl(n,"lançamento importado","lançamentos importados")}${sk}`);
  };

  // ── Onboarding: mostrado na primeira vez que o usuário acessa ──
  if(showOnboarding){
    return(
      <Suspense fallback={null}>
        <div data-theme={theme} className={theme==="light"?"light-mode":""} style={{background:"var(--bg)",color:"var(--text-1)",fontFamily:"var(--font-sans)"}}>
          {/* Fora de .appRoot: monta o CSS do app (tokens + tema) também neste ramo */}
          <style>{CSS}</style>
          <OnboardingScreen onDone={()=>{ saveLS(k('onboarding_done'),true); setShowOnboarding(false); }}/>
        </div>
      </Suspense>
    );
  }

  return(
    <div style={S.root} className={`appRoot ${theme === "light" ? "light-mode" : ""}`} data-theme={theme}>
      <style>{CSS}</style>

      <ToastStack toasts={toasts} dismiss={dismiss}/>
      <Confetti show={showCelebrate}/>

      <AppHeader fbUser={fbUser} syncStatus={syncStatus} healthScore={healthScore} activeTab={activeTab}
        onShowHealth={()=>setShowHealth(true)} searchOpen={showGlobalSearch} onToggleSearch={()=>setShowGlobalSearch(p=>!p)}
        theme={theme} onToggleTheme={()=>save.theme(theme==="dark"?"light":"dark")}/>

      <GlobalSearch open={showGlobalSearch} query={globalSearch} setQuery={setGlobalSearch}
        onClose={()=>setShowGlobalSearch(false)} onPick={(mk)=>{setSelMonth(mk);setActiveTab('lancamentos');}}
        entries={entries} dividas={dividas} categories={categories}/>

      {activeTab==="lancamentos"&&(
        <HomeScreen
          data={{entries,dividas,cards,cardPurchases,cardFaturas,categories,budgets,accounts}}
          stats={stats} today={today} selMonth={selMonth} setSelMonth={setSelMonth}
          ui={homeUi} accountBalances={accountBalancesMap} onOpenForm={openForm}
          onToggle={handleToggle} onClone={handleClone}
          onEdit={(entry)=>setEditTarget({entry,monthKey:selMonth})} onDelete={setDelTarget}/>
      )}

      <Suspense fallback={<div style={{flex:1}}/>}>
        {activeTab==="graficos"&&<ChartScreen entries={entries} dividas={dividas} categories={categories} nowMonth={NOW} cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas} accumSaldo={accumNow} today={today} toast={toast}/>}
        {activeTab==="cartoes"&&<CartaoScreen cards={cards} setCards={save.cards} cardPurchases={cardPurchases} setCardPurchases={save.cardPurchases} cardFaturas={cardFaturas} setCardFaturas={save.cardFaturas} categories={categories} nowMonth={NOW} toast={toast} onRevertFatura={handleRevertFatura}/>}
        {activeTab==="dividas"&&<DividasScreen dividas={dividas} setDividas={save.dividas} nowMonth={NOW} toast={toast}/>}
        {activeTab==="saude"&&<SaudeScreen entries={entries} dividas={dividas} cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas} categories={categories} nowMonth={NOW} goals={goals} onSaveGoals={save.goals} budgets={budgets} onSaveBudgets={save.budgets} todayWidget={todayWidget} accounts={accounts} accountBalances={accountBalancesMap}/>}
        {activeTab==="perfil"&&<ProfileScreen entries={entries} dividas={dividas} selMonth={selMonth}
          onExportMonth={()=>handleExportCSV(selMonth)} onExportAll={()=>handleExportCSV(null)} onExportRange={(from,to)=>handleExportCSV(from,to)} onExportPDF={()=>handleExportPDF(selMonth)}
          onReset={handleReset} notifPerm={notifPerm} notifSettings={notifSettings} onNotifSettings={save.notifSettings}
          onRequestPerm={async()=>setNotifPerm(await requestNotifPermission())}
          onTestNotif={()=>checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings)}
          onBackup={handleBackup} onRestore={handleRestore} theme={theme} onTheme={save.theme} fbUser={fbUser} onLogout={onLogout}
          categories={categories} onImportEntries={handleImport} accounts={accounts} onSaveAccounts={save.accounts}/>}
        {activeTab==="admin"&&<AdminScreen/>}
      </Suspense>

      <HealthModal open={showHealth&&!!healthScore} healthScore={healthScore} selMonth={selMonth} onClose={()=>setShowHealth(false)}/>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} showMoreNav={showMoreNav} setShowMoreNav={setShowMoreNav}
        setShowFabMenu={setShowFabMenu} overdueCount={overdueDue.length} budgetOverCount={budgetOverCount}
        isAdmin={fbUser.email===ADMIN_EMAIL} onOpenForm={openForm}/>

      {/* FAB — novo lançamento (visível na aba Contas, apenas mobile) */}
      {activeTab==="lancamentos"&&!showForm&&!editTarget&&!delTarget&&(
        <FabMenu open={showFabMenu} setOpen={setShowFabMenu} onOpenForm={openForm}/>
      )}

      {confirmQueue&&<ConfirmModal {...confirmQueue}/>}
      {showForm&&<FormModal form={form} setForm={setForm} lockedType={formType} categories={categories} entries={entries} onUpdateCats={save.categories} onAdd={handleAdd} onClose={()=>{setShowForm(false);setForm(BLANK());}} cards={cards} accounts={accounts}/>}
      {editTarget&&<EditModal entry={editTarget.entry} monthKey={editTarget.monthKey} categories={categories} entries={entries} onUpdateCats={save.categories} onSave={handleSaveEdit} onClose={()=>setEditTarget(null)}/>}
      {delTarget&&<DeleteModal entry={delTarget} onDelete={handleDelete} onClose={()=>setDelTarget(null)}/>}
      {fatPayTarget&&<FaturaPayModal entry={fatPayTarget} onPay={handlePayFatura} onRevert={handleRevertFatura} onClose={()=>setFatPayTarget(null)}/>}
    </div>
  );
}
export default App;
