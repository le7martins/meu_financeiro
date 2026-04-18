import { useState, useMemo, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { loadUserData, saveData, hasCloudData, saveUserProfile, loadAllProfiles, ADMIN_EMAIL } from './db';
import { registerFCMToken, onForegroundMessage } from './fcm';
import LoginScreen from './LoginScreen';
// ─── Utils ────────────────────────────────────────────────────
const fmt      = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const fmtShort = (v) => Math.abs(v)>=1000?`R$${(v/1000).toFixed(1)}k`:`R$${v.toFixed(0)}`;
const fmtDate  = (d) => { const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
const TODAY    = new Date().toISOString().split("T")[0];
const MNAMES   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const mLabel   = (k) => { const [y,m]=k.split("-"); return `${MNAMES[+m-1]} ${y}`; };
const mShort   = (k) => MNAMES[+k.split("-")[1]-1];
const getNow   = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const mDiff    = (a,b) => { const [ay,am]=a.split("-").map(Number),[by,bm]=b.split("-").map(Number); return (by-ay)*12+(bm-am); };
const addM     = (k,n) => { const [y,m]=k.split("-").map(Number),d=new Date(y,m-1+n,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const daysUntil = (ds) => { if(!ds)return null; return Math.ceil((new Date(ds+"T12:00:00")-new Date(TODAY+"T12:00:00"))/86400000); };
const dueBadge  = (entry,mk) => {
  if(entry.statusForMonth!=="a_pagar") return null;
  const due = entry.recurrence!=="none"&&!entry.isDivida&&!entry.isFatura ? `${mk}-${entry.date.split("-")[2]}` : entry.date;
  const days = daysUntil(due);
  if(days===null) return null;
  if(days<0)   return {text:`Vencido há ${Math.abs(days)}d`,color:"#f87171",bg:"rgba(248,113,113,.13)"};
  if(days===0) return {text:"Vence hoje!",color:"#fb923c",bg:"rgba(251,146,60,.18)"};
  if(days<=3)  return {text:`Vence em ${days}d`,color:"#fb923c",bg:"rgba(251,146,60,.12)"};
  if(days<=7)  return {text:`Vence em ${days}d`,color:"#facc15",bg:"rgba(250,204,21,.1)"};
  return null;
};

// ─── Storage ─────────────────────────────────────────────────
const loadLS = (k,def) => { try{const d=localStorage.getItem(k);return d?JSON.parse(d):def;}catch{return def;} };
const saveLS = (k,v)   => localStorage.setItem(k,JSON.stringify(v));


// ─── Notifications ───────────────────────────────────────────
const NOTIF_KEY      = "mf2_notif_settings";
const NOTIF_LAST_KEY = "mf2_notif_last";
const defaultNotifSettings = { enabled:true, daysBefore:3, overdueAlert:true, incomeAlert:true };
async function requestNotifPermission() {
  if(!("Notification" in window)) return "unsupported";
  if(Notification.permission==="granted") return "granted";
  if(Notification.permission==="denied")  return "denied";
  return await Notification.requestPermission();
}
function fireNotification(title,body,tag) {
  if(Notification.permission!=="granted") return;
  // Usa service worker se disponível (funciona em PWA/Android)
  if(navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({type:'NOTIFY',title,body,tag});
  } else {
    try { new Notification(title,{body,tag,icon:'/meu_financeiro/icon-192.png'}); } catch{}
  }
}
function checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,settings) {
  if(!settings.enabled||Notification.permission!=="granted") return 0;
  const NOW=getNow();
  const NEXT=addM(NOW,1);
  const mkDate=(e,m)=>(e.isDivida||e.isFatura||e.recurrence==="none")?e.date:`${m}-${e.date.split("-")[2]}`;
  const meNow =getMonthEntries(entries,dividas,NOW, cards,cardPurchases,cardFaturas).map(e=>({...e,_mk:NOW}));
  const meNext=getMonthEntries(entries,dividas,NEXT,cards,cardPurchases,cardFaturas).map(e=>({...e,_mk:NEXT}));
  const me=[...meNow,...meNext];
  const pendingExp=me.filter(e=>e.type==="despesa"&&e.statusForMonth==="a_pagar");
  const pendingInc=settings.incomeAlert!==false?me.filter(e=>e.type==="receita"&&e.statusForMonth==="a_pagar"):[];
  const overdue=[],dueToday=[],dueSoon=[],incToday=[],incSoon=[];
  for(const e of pendingExp){
    const days=daysUntil(mkDate(e,e._mk));
    if(days===null) continue;
    if(days<0&&settings.overdueAlert) overdue.push({...e,days});
    else if(days===0) dueToday.push(e);
    else if(days>0&&days<=settings.daysBefore) dueSoon.push({...e,days});
  }
  for(const e of pendingInc){
    const days=daysUntil(mkDate(e,e._mk));
    if(days===null) continue;
    if(days===0) incToday.push(e);
    else if(days>0&&days<=settings.daysBefore) incSoon.push({...e,days});
  }
  let fired=0;
  if(overdue.length>0){fireNotification(`⚠️ ${overdue.length} conta${overdue.length>1?"s":""} vencida${overdue.length>1?"s":""}`,overdue.map(e=>`${e.description} (${Math.abs(e.days)}d atraso)`).join(", "),"mf-overdue");fired++;}
  if(dueToday.length>0){fireNotification(`🔴 ${dueToday.length} conta${dueToday.length>1?"s":""} vence${dueToday.length>1?"m":""} hoje`,dueToday.map(e=>e.description).join(", "),"mf-today");fired++;}
  if(dueSoon.length>0){fireNotification(`⏰ ${dueSoon.length} despesa${dueSoon.length>1?"s":""} vence${dueSoon.length>1?"m":""} em breve`,dueSoon.map(e=>`${e.description} (${e.days}d)`).join(", "),"mf-soon");fired++;}
  if(incToday.length>0){fireNotification(`💰 ${incToday.length} recebimento${incToday.length>1?"s":""} esperado${incToday.length>1?"s":""} hoje`,incToday.map(e=>e.description).join(", "),"mf-inc-today");fired++;}
  if(incSoon.length>0){fireNotification(`📥 ${incSoon.length} recebimento${incSoon.length>1?"s":""} em breve`,incSoon.map(e=>`${e.description} (${e.days}d)`).join(", "),"mf-inc-soon");fired++;}
  return fired;
}

// ─── Credit Card Utils ────────────────────────────────────────
function getBillingMonth(purchaseDate,closeDay) {
  const [y,m,d]=purchaseDate.split("-").map(Number);
  if(d<=closeDay) return `${y}-${String(m).padStart(2,"0")}`;
  const next=new Date(y,m,1);
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}`;
}
function getFaturaDueDate(billingMonth,dueDay){ const nm=addM(billingMonth,1); return `${nm}-${String(dueDay).padStart(2,"0")}`; }
function getFaturaCloseDate(billingMonth,closeDay){ return `${billingMonth}-${String(closeDay).padStart(2,"0")}`; }
function isFaturaOpen(billingMonth,closeDay){ return TODAY<=getFaturaCloseDate(billingMonth,closeDay); }
function getPurchaseInstallmentsForBilling(purchase,targetBillingMonth,closeDay) {
  const baseBilling=getBillingMonth(purchase.purchaseDate,closeDay);
  const diff=mDiff(baseBilling,targetBillingMonth);
  const total=purchase.installments||1;
  if(diff>=0&&diff<total) return {installmentNum:diff+1,total,amount:parseFloat((purchase.amount/total).toFixed(2))};
  return null;
}
function buildFatura(card,purchases,cardFaturas,billingMonth) {
  const items=[];
  for(const p of (purchases||[])){
    if(p.cardId!==card.id) continue;
    const inst=getPurchaseInstallmentsForBilling(p,billingMonth,card.closeDay);
    if(inst) items.push({...p,...inst});
  }
  const total=items.reduce((s,i)=>s+i.amount,0);
  const key=`${card.id}_${billingMonth}`;
  const payRecord=(cardFaturas||{})[key]||null;
  const closeDate=getFaturaCloseDate(billingMonth,card.closeDay);
  const dueDate=getFaturaDueDate(billingMonth,card.dueDay);
  const open=TODAY<=closeDate;
  const paid=payRecord?.paid||false;
  const paidAmount=payRecord?.paidAmount||0;
  const partial=payRecord?.partial||false;
  return {card,billingMonth,items,total:parseFloat(total.toFixed(2)),closeDate,dueDate,open,paid,paidAmount,partial,key};
}
function getCardBillingMonths(card,purchases) {
  const months=new Set();
  for(const p of (purchases||[])){
    if(p.cardId!==card.id) continue;
    const base=getBillingMonth(p.purchaseDate,card.closeDay);
    for(let i=0;i<(p.installments||1);i++) months.add(addM(base,i));
  }
  return [...months].sort();
}

// ─── Entry computation ───────────────────────────────────────
function getMonthEntries(entries,dividas,monthKey,cards,cardPurchases,cardFaturas) {
  const res=[];
  for(const e of entries){
    if(e.deletedFrom&&monthKey>=e.deletedFrom) continue;
    const base=e.date.substring(0,7);
    let item=null;
    if(e.recurrence==="none"){ if(base===monthKey) item={...e,statusForMonth:e.status,isRecurring:false}; }
    else if(e.recurrence==="fixed"){ if(base<=monthKey&&(!e.endMonth||monthKey<=e.endMonth)){const st=e.statusByMonth?.[monthKey]||"a_pagar";item={...e,statusForMonth:st,isRecurring:true,recurLabel:"Fixo 🔄"};} }
    else if(e.recurrence==="quarterly"){ const diff=mDiff(base,monthKey);if(diff>=0&&diff%3===0&&(!e.endMonth||monthKey<=e.endMonth)){const st=e.statusByMonth?.[monthKey]||"a_pagar";item={...e,statusForMonth:st,isRecurring:true,recurLabel:"Trimestral 📅"};} }
    else if(e.recurrence==="annual"){ const diff=mDiff(base,monthKey);if(diff>=0&&diff%12===0&&(!e.endMonth||monthKey<=e.endMonth)){const st=e.statusByMonth?.[monthKey]||"a_pagar";item={...e,statusForMonth:st,isRecurring:true,recurLabel:"Anual 📅"};} }
    else if(e.recurrence==="installment"){
      const diff=mDiff(base,monthKey);
      if(diff>=0&&diff<e.installments){
        const st=e.statusByMonth?.[monthKey]||"a_pagar";
        const displayAmount=parseFloat((e.amount/e.installments).toFixed(2));
        item={...e,statusForMonth:st,isRecurring:true,installmentNum:diff+1,recurLabel:`${diff+1}/${e.installments} 📋`,displayAmount};
      }
    }
    if(item&&!e.deletedMonths?.includes(monthKey)){
      const ov=e.overrides?.[monthKey];
      if(ov){const{amount:oa,status:os,...rest}=ov;item={...item,...rest,...(oa!==undefined?{displayAmount:oa}:{}),...(os!==undefined?{statusForMonth:os}:{})};}
      res.push(item);
    }
  }
  for(const d of (dividas||[])){
    const diff=mDiff(d.startMonth,monthKey);
    if(diff>=0&&diff<d.installments){
      const instVal=parseFloat((d.totalAmount/d.installments).toFixed(2));
      const isPaid=d.paidMonths?.includes(monthKey)||false;
      res.push({id:`divida_${d.id}_${monthKey}`,description:d.name,amount:instVal,displayAmount:instVal,
        date:`${monthKey}-${d.dueDay||"10"}`,type:"despesa",status:isPaid?"pago":"a_pagar",statusForMonth:isPaid?"pago":"a_pagar",
        category:d.category||"outro",recurrence:"installment",isRecurring:true,isDivida:true,dividaId:d.id,
        installmentNum:diff+1,installments:d.installments,recurLabel:`${diff+1}/${d.installments} 💳`,notes:d.notes||""});
    }
  }
  for(const card of (cards||[])){
    const allBillings=getCardBillingMonths(card,cardPurchases||[]);
    for(const bm of allBillings){
      const fat=buildFatura(card,cardPurchases||[],cardFaturas||{},bm);
      if(fat.total<=0) continue;
      if(fat.open) continue;
      const dueMk=fat.dueDate.substring(0,7);
      if(dueMk!==monthKey) continue;
      res.push({id:`fatura_${fat.key}`,description:`Fatura ${card.name} — ${mLabel(bm)}`,amount:fat.total,displayAmount:fat.total,
        date:fat.dueDate,type:"despesa",status:fat.paid?"pago":"a_pagar",statusForMonth:fat.paid?"pago":"a_pagar",
        category:"cartao",recurrence:"none",isRecurring:false,isFatura:true,faturaKey:fat.key,cardId:card.id,
        cardColor:card.color,cardName:card.name});
    }
  }
  return res;
}
const eVal=(e)=>e.displayAmount??e.amount;

// ─── Defaults ────────────────────────────────────────────────
const DEFAULT_CATS=[
  {id:"moradia",name:"Moradia",color:"#6C8EEF",type:"both"},
  {id:"alimentacao",name:"Alimentação",color:"#EF8C6C",type:"both"},
  {id:"transporte",name:"Transporte",color:"#6CEF9A",type:"both"},
  {id:"saude",name:"Saúde",color:"#EF6CA8",type:"both"},
  {id:"lazer",name:"Lazer",color:"#C46CEF",type:"both"},
  {id:"educacao",name:"Educação",color:"#EFCE6C",type:"both"},
  {id:"assinatura",name:"Assinatura",color:"#6CCEEF",type:"both"},
  {id:"salario",name:"Salário",color:"#4ade80",type:"receita"},
  {id:"freelance",name:"Freelance",color:"#a3e635",type:"receita"},
  {id:"investimento",name:"Investimento",color:"#34d399",type:"receita"},
  {id:"divida",name:"Dívida",color:"#f87171",type:"despesa"},
  {id:"cartao",name:"Cartão",color:"#a78bfa",type:"despesa"},
  {id:"outro",name:"Outro",color:"#9E9E9E",type:"both"},
];
const BLANK=(type="despesa")=>({description:"",amount:"",date:TODAY,type,status:"a_pagar",category:type==="receita"?"salario":"outro",recurrence:"none",installments:2,notes:"",endMonth:""});
const PRESET_COLORS=["#6C8EEF","#EF8C6C","#6CEF9A","#EF6CA8","#C46CEF","#EFCE6C","#6CCEEF","#4ade80","#f87171","#facc15","#34d399","#a3e635"];
const CARD_COLORS=["#a78bfa","#60a5fa","#34d399","#f472b6","#fb923c","#facc15","#f87171","#38bdf8"];

// ─── Toast Hook ───────────────────────────────────────────────
function useToast() {
  const [toasts,setToasts]=useState([]);
  const toast=useCallback((msg,type="success")=>{
    const id=Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3000);
  },[]);
  return {toasts,toast};
}

// ─── App (auth gate) ─────────────────────────────────────────
function App(){
  const [fbUser, setFbUser] = useState(undefined);
  useEffect(()=>onAuthStateChanged(auth, u=>{ setFbUser(u??null); if(u) saveUserProfile(u); }),[]);
  if(fbUser===undefined) return(
    <div style={{position:'fixed',inset:0,background:'#080c12',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{fontSize:40,animation:'lp 1.4s ease-in-out infinite'}}>💰</div>
    </div>
  );
  if(!fbUser) return <LoginScreen onLogin={u=>setFbUser(u)}/>;
  return <MainApp key={fbUser.uid} fbUser={fbUser} onLogout={()=>signOut(auth)}/>;
}

// ─── MainApp ─────────────────────────────────────────────────
function MainApp({ fbUser, onLogout }){
  const uid = fbUser.uid;
  const k = (key) => `mf2_${uid}_${key}`;

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
  const [filterCat,    setFilterCat]    = useState("all");
  const [dbReady,      setDbReady]      = useState(false);
  const [showMoreNav,  setShowMoreNav]  = useState(false);
  const [showFabMenu,  setShowFabMenu]  = useState(false);
  const {toasts,toast} = useToast();

  // ─── Firestore: carregar + migrar dados na nuvem ──────────────
  useEffect(()=>{
    async function syncFromCloud(){
      try {
        const cloud = await loadUserData(uid);
        const hasCloud = Object.keys(cloud).length > 0;

        if(hasCloud){
          // Nuvem tem dados → usa como fonte de verdade
          if(cloud.entries)   { setEntries(cloud.entries);   saveLS(k("entries"),   cloud.entries);   }
          if(cloud.dividas)   { setDividas(cloud.dividas);   saveLS(k("dividas"),   cloud.dividas);   }
          if(cloud.cards)     { setCards(cloud.cards);       saveLS(k("cards"),     cloud.cards);     }
          if(cloud.purchases) { setCardPurchases(cloud.purchases); saveLS(k("cpurchases"), cloud.purchases); }
          if(cloud.faturas)   { setCardFaturas(cloud.faturas);    saveLS(k("cfaturas"),   cloud.faturas);   }
          if(cloud.settings){
            const s = cloud.settings;
            if(s.categories)    { setCategories(s.categories);       saveLS(k("cats"),          s.categories);    }
            if(s.notifSettings) { setNotifSettings(s.notifSettings); saveLS(k("notif_settings"),s.notifSettings); }
            if(s.theme)         { setTheme(s.theme);                 saveLS(k("theme"),         s.theme);         }
            if(s.goals)         { setGoals(s.goals);                 saveLS(k("goals"),         s.goals);         }
            if(s.budgets)       { setBudgets(s.budgets);             saveLS(k("budgets"),        s.budgets);       }
          }
        } else {
          // Sem dados na nuvem → migra o que estiver no localStorage
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
      } catch(e){
        console.warn('[Firestore] Usando dados locais (offline?):', e.message);
      } finally {
        setDbReady(true);
        registerFCMToken(uid);
      }
    }
    syncFromCloud();
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
  const saveEntries   =(e)=>{ setEntries(e);        saveLS(k("entries"),e);    saveData(uid,'entries',e);   };
  const saveDividas   =(d)=>{ setDividas(d);        saveLS(k("dividas"),d);    saveData(uid,'dividas',d);   };
  const saveCards     =(c)=>{ setCards(c);          saveLS(k("cards"),c);      saveData(uid,'cards',c);     };
  const saveCardPurchases=(p)=>{ setCardPurchases(p); saveLS(k("cpurchases"),p); saveData(uid,'purchases',p); };
  const saveCardFaturas  =(f)=>{ setCardFaturas(f);   saveLS(k("cfaturas"),f);   saveData(uid,'faturas',f);   };

  const _saveSettings=(patch)=>{
    const cur = {
      categories: loadLS(k("cats"),DEFAULT_CATS),
      notifSettings: loadLS(k("notif_settings"),defaultNotifSettings),
      theme: loadLS(k("theme"),"dark"),
      goals: loadLS(k("goals"),{monthly:0,savingsPct:20}),
      budgets: loadLS(k("budgets"),{}),
      ...patch,
    };
    saveData(uid,'settings',cur);
  };
  const saveCategories   =(c)=>{ setCategories(c);    saveLS(k("cats"),c);           _saveSettings({categories:c});    };
  const saveNotifSettings=(s)=>{ setNotifSettings(s); saveLS(k("notif_settings"),s); _saveSettings({notifSettings:s}); };
  const saveTheme        =(t)=>{ setTheme(t);         saveLS(k("theme"),t);           _saveSettings({theme:t});         };
  const saveGoals        =(g)=>{ setGoals(g);         saveLS(k("goals"),g);           _saveSettings({goals:g});         };
  const saveBudgets      =(b)=>{ setBudgets(b);       saveLS(k("budgets"),b);         _saveSettings({budgets:b});       };

  const NOW=getNow();

  useEffect(()=>{
    if(!dbReady) return;
    if(notifSettings.enabled&&Notification.permission==="granted"){
      const lastCheck=loadLS(k("notif_last"),null);
      if(lastCheck!==TODAY) setTimeout(()=>{checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings);saveLS(k("notif_last"),TODAY);},1500);
    }
  },[dbReady]);

  const monthEntries=useMemo(()=>getMonthEntries(entries,dividas,selMonth,cards,cardPurchases,cardFaturas),[entries,dividas,selMonth,cards,cardPurchases,cardFaturas]);

  const accumSaldo=useMemo(()=>{
    const allDates=[...entries.map(e=>e.date.substring(0,7)),...dividas.map(d=>d.startMonth)];
    if(!allDates.length) return null;
    const earliest=allDates.reduce((mn,m)=>m<mn?m:mn,selMonth);
    if(earliest>=selMonth) return null;
    let total=0,cur=earliest;
    while(cur<selMonth){
      const me=getMonthEntries(entries,dividas,cur,cards,cardPurchases,cardFaturas);
      total+=me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0)-me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
      cur=addM(cur,1);
    }
    return total;
  },[entries,dividas,cards,cardPurchases,cardFaturas,selMonth]);

  const totRec =monthEntries.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
  const totDesp=monthEntries.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
  const saldo  =totRec-totDesp;
  const totPend=monthEntries.filter(e=>e.statusForMonth==="a_pagar"&&e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
  const totPago=monthEntries.filter(e=>e.statusForMonth==="pago"&&e.type==="despesa").reduce((s,e)=>s+eVal(e),0);

  // Health score
  const healthScore=useMemo(()=>{
    if(totRec===0) return null;
    const fixedDesp=entries.filter(e=>e.recurrence!=="none"&&e.type==="despesa").reduce((s,e)=>s+(e.recurrence==="installment"?e.amount/e.installments:e.amount),0);
    const dividaDesp=dividas.reduce((s,d)=>s+d.totalAmount/d.installments,0);
    const fixedTotal=fixedDesp+dividaDesp;
    const fixedPct=totRec>0?Math.min(100,(fixedTotal/totRec)*100):0;
    const savingPct=totRec>0?Math.max(0,((totRec-totDesp)/totRec)*100):0;
    let score=100;
    if(fixedPct>70) score-=30; else if(fixedPct>50) score-=15; else if(fixedPct>30) score-=5;
    if(savingPct<10) score-=20; else if(savingPct<20) score-=10;
    if(totPend>totRec*0.3) score-=10;
    score=Math.max(0,Math.min(100,score));
    const level=score>=80?"Saudável":score>=60?"Atenção":"Crítico";
    const color=score>=80?"#4ade80":score>=60?"#facc15":"#f87171";
    return {score,level,color,fixedPct,savingPct};
  },[entries,dividas,totRec,totDesp,totPend]);

  const normStr=(s)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const filtered=useMemo(()=>{
    let list=filter==="all"?monthEntries:filter==="despesa"?monthEntries.filter(e=>e.type==="despesa"):filter==="receita"?monthEntries.filter(e=>e.type==="receita"):filter==="a_pagar"?monthEntries.filter(e=>e.statusForMonth==="a_pagar"):monthEntries.filter(e=>e.statusForMonth==="pago");
    if(filterCat!=="all") list=list.filter(e=>e.category===filterCat);
    if(search.trim()){const q=normStr(search);list=list.filter(e=>normStr(e.description).includes(q)||normStr(e.notes||"").includes(q));}
    if(sortBy==="amount") list=[...list].sort((a,b)=>eVal(b)-eVal(a));
    else if(sortBy==="name") list=[...list].sort((a,b)=>a.description.localeCompare(b.description));
    else if(sortBy==="status") list=[...list].sort((a,b)=>a.statusForMonth==="a_pagar"?-1:1);
    else list=[...list].sort((a,b)=>a.date.localeCompare(b.date));
    return list;
  },[monthEntries,filter,filterCat,search,sortBy]);

  const upcomingDue=useMemo(()=>{
    const items=[];
    for(let i=0;i<=2;i++){
      const m=addM(NOW,i);
      const me=getMonthEntries(entries,dividas,m,cards,cardPurchases,cardFaturas);
      me.filter(e=>e.statusForMonth==="a_pagar").forEach(e=>{
        const due=(e.isDivida||e.isFatura||e.recurrence==="none")?e.date:`${m}-${e.date.split("-")[2]}`;
        const days=daysUntil(due);
        if(days!==null&&days<=14) items.push({...e,_mk:m,_due:due,_days:days});
      });
    }
    return items.sort((a,b)=>a._days-b._days).slice(0,10);
  },[entries,dividas,cards,cardPurchases,cardFaturas,NOW]);

  const grouped=useMemo(()=>{
    if(!groupBy) return null;
    const map={};
    filtered.forEach(e=>{if(!map[e.category])map[e.category]={items:[],total:0};map[e.category].items.push(e);map[e.category].total+=eVal(e);});
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  },[filtered,groupBy]);

  const getCat  =(id)=>categories.find(c=>c.id===id)||{color:"#9E9E9E",name:id};
  const catColor=(id)=>getCat(id).color;
  const catName =(id)=>getCat(id).name;

  const handleToggle=(entry)=>{
    if(entry.isFatura){
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
      return {...e,statusByMonth:{...e.statusByMonth,[selMonth]:newSt},paidDateByMonth:{...e.paidDateByMonth,[selMonth]:paidDt}};
    }));
    toast(newSt==="pago"?"✓ Marcado como pago":"↩ Marcado como pendente");
  };

  const handleAdd=()=>{
    if(!form.description.trim()||!form.amount||!form.date) return;
    const dup=entries.find(e=>e.description.toLowerCase()===form.description.trim().toLowerCase()&&Math.abs(parseFloat(e.amount)-parseFloat(form.amount))<0.01&&e.date===form.date&&e.type===form.type);
    if(dup&&!window.confirm(`Lançamento similar já existe:\n"${dup.description}" em ${fmtDate(dup.date)} (${fmt(parseFloat(dup.amount))})\nDeseja adicionar mesmo assim?`)) return;
    const entry={id:Date.now().toString(),description:form.description.trim(),amount:parseFloat(form.amount),date:form.date,type:form.type,status:form.status,category:form.category,recurrence:form.recurrence,notes:form.notes,...(form.recurrence==="installment"?{installments:parseInt(form.installments)}:{}),...(form.endMonth?{endMonth:form.endMonth}:{}),statusByMonth:{},overrides:{}};
    saveEntries([entry,...entries]);setForm(BLANK());setShowForm(false);
    toast(`✓ ${form.type==="receita"?"Receita":"Despesa"} adicionada`);
  };

  const handleSaveEdit=(entryId,changes,scope)=>{
    saveEntries(entries.map(e=>{
      if(e.id!==entryId) return e;
      if(e.recurrence==="none"||scope==="future"){const baseAmt=(e.recurrence==="installment"&&changes.amount!==undefined)?parseFloat((changes.amount*e.installments).toFixed(2)):(changes.amount??e.amount);return {...e,...changes,amount:baseAmt};}
      return {...e,overrides:{...e.overrides,[selMonth]:changes}};
    }));
    setEditTarget(null);toast("✓ Lançamento atualizado");
  };

  const handleDelete=(entryId,scope)=>{
    if(scope==="all")        saveEntries(entries.filter(e=>e.id!==entryId));
    else if(scope==="this")  saveEntries(entries.map(e=>e.id!==entryId?e:{...e,deletedMonths:[...(e.deletedMonths||[]),selMonth]}));
    else                     saveEntries(entries.map(e=>e.id!==entryId?e:{...e,deletedFrom:selMonth}));
    setDelTarget(null);toast("Lançamento removido","info");
  };

  const handlePayFatura=(entry,amount,partial)=>{
    const cur=cardFaturas[entry.faturaKey]||{};
    const isFullyPaid=!partial||amount>=entry.amount;
    saveCardFaturas({...cardFaturas,[entry.faturaKey]:{...cur,paid:isFullyPaid,paidAmount:amount,paidDate:TODAY,partial:partial&&!isFullyPaid}});
    setFatPayTarget(null);
    toast(isFullyPaid?"✓ Fatura paga":"Pagamento parcial registrado");
  };
  const handleRevertFatura=(faturaKey)=>{
    const nf={...cardFaturas};delete nf[faturaKey];
    saveCardFaturas(nf);toast("↩ Pagamento estornado","info");
  };

  const handleBackup=()=>{
    const data={version:1,exportedAt:new Date().toISOString(),entries,dividas,cards,cardPurchases,cardFaturas,categories};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    Object.assign(document.createElement("a"),{href:url,download:`meu-financeiro-backup-${TODAY}.json`}).click();
    URL.revokeObjectURL(url);toast("💾 Backup salvo");
  };

  const handleRestore=(e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.version||!data.entries){toast("Arquivo inválido","error");return;}
        if(!window.confirm(`Restaurar backup?\nIsso substituirá todos os dados atuais.`)) return;
        if(data.entries)       saveEntries(data.entries);
        if(data.dividas)       saveDividas(data.dividas);
        if(data.cards)         saveCards(data.cards);
        if(data.cardPurchases) saveCardPurchases(data.cardPurchases);
        if(data.cardFaturas)   saveCardFaturas(data.cardFaturas);
        if(data.categories)    saveCategories(data.categories);
        toast("✅ Backup restaurado!");
      } catch{ toast("Erro ao ler o arquivo","error"); }
    };
    reader.readAsText(file);e.target.value="";
  };

  const handleExportCSV=(mk)=>{
    const hdr=["Descrição","Tipo","Valor","Vencimento","Status","Categoria","Recorrência","Notas"];
    let rows=[];
    if(mk){
      const list=getMonthEntries(entries,dividas,mk,cards,cardPurchases,cardFaturas);
      rows=list.map(e=>[`"${e.description}"`,e.type,(eVal(e)).toFixed(2),fmtDate(e.date),e.statusForMonth||e.status,`"${catName(e.category)}"`,e.recurrence||"none",`"${e.notes||""}"`]);
    } else {
      // Entries
      rows=entries.map(e=>[`"${e.description}"`,e.type,e.amount.toFixed(2),fmtDate(e.date),e.status,`"${catName(e.category)}"`,e.recurrence||"none",`"${e.notes||""}"`]);
      // Dívidas
      dividas.forEach(d=>{
        const instVal=parseFloat((d.totalAmount/d.installments).toFixed(2));
        rows.push([`"${d.name} (dívida)"`,`"despesa"`,instVal.toFixed(2),`"${d.startMonth}"`,`"parcelado"`,`"${catName(d.category||"divida")}"`,`"${d.installments}x"`,`"${d.notes||""}"`]);
      });
      // Faturas
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
    Object.assign(document.createElement("a"),{href:url,download:`financeiro_${mk||"completo"}.csv`}).click();
    URL.revokeObjectURL(url);toast("📊 CSV exportado");
  };

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
    return(
      <div key={`${entry.id}-${selMonth}`} className="eCard" style={{...S.card,borderLeft:`3px solid ${borderColor}`}}>
        <div style={S.cardL}>
          <div style={{width:8,height:8,borderRadius:"50%",background:entry.isFatura?entry.cardColor:catColor(entry.category),flexShrink:0,marginTop:3}}/>
          <div style={{minWidth:0,flex:1}}>
            <div style={S.cardTitle}>{entry.description}</div>
            <div style={S.cardMeta}>
              {!entry.isFatura&&<span style={{...S.tag,color:catColor(entry.category),borderColor:catColor(entry.category)+"44",background:catColor(entry.category)+"18"}}>{catName(entry.category)}</span>}
              {entry.recurrence!=="none"&&<span style={{...S.tag,color:entry.isDivida?"#f87171":"#8ab4f8",borderColor:entry.isDivida?"#f8717144":"#1a3a6e",background:entry.isDivida?"rgba(248,113,113,.12)":"#0d1a2e"}}>{entry.recurLabel}</span>}
              <span style={{fontSize:10,color:"var(--text4)"}}>{fmtDate(entry.isRecurring&&entry.recurrence!=="none"&&!entry.isDivida&&!entry.isFatura?`${selMonth}-${entry.date.split("-")[2]}`:entry.date)}</span>
            </div>
            {badge&&<div style={{display:"inline-block",marginTop:4,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:4,background:badge.bg,color:badge.color}}>{badge.text}</div>}
            {entry.notes&&<div style={{fontSize:10,color:"var(--text3)",marginTop:3,fontStyle:"italic"}}>💬 {entry.notes}</div>}
            {paidDt&&!entry.isDivida&&!entry.isFatura&&<div style={{fontSize:10,color:"#4ade8066",marginTop:2}}>✓ Pago em {fmtDate(paidDt)}</div>}
          </div>
        </div>
        <div style={S.cardR}>
          <div style={{fontSize:14,fontWeight:700,color:amtColor,letterSpacing:"-0.3px"}}>
            {entry.type==="receita"?"+":""}{fmt(eVal(entry))}
          </div>
          <div style={{display:"flex",gap:4}}>
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
          <button onClick={()=>handleToggle(entry)} className="statusToggleBtn"
            style={{...S.badge,background:entry.statusForMonth==="pago"?"rgba(74,222,128,.15)":"rgba(251,146,60,.15)",color:entry.statusForMonth==="pago"?"#4ade80":"#fb923c",border:`1px solid ${entry.statusForMonth==="pago"?"#4ade8033":"#fb923c33"}`,cursor:"pointer",padding:"4px 8px"}}>
            {entry.statusForMonth==="pago"?(entry.type==="receita"?"✓ recebido":"✓ pago"):(entry.type==="receita"?"⏳ a receber":"⏳ a pagar")}
          </button>
        </div>
      </div>
    );
  };

  return(
    <div style={S.root} className={theme === "light" ? "light-mode" : ""} data-theme={theme}>
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
              style={{background:bg,border:`1.5px solid ${border}`,color,padding:"11px 14px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.6)",display:"flex",alignItems:"center",gap:8,width:"100%"}}>
              <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
              <span style={{flex:1}}>{t.msg}</span>
            </div>
          );
        })}
      </div>

      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={{fontSize:22}}>💰</span>
          <div><div style={S.appName}>Minhas Finanças</div><div style={S.appSub}>Controle seus lançamentos</div></div>
        </div>
        {/* Health indicator in header */}
        {healthScore&&activeTab==="lancamentos"&&(
          <div style={{display:"flex",alignItems:"center",gap:5,background:"var(--card-bg)",border:`1px solid ${healthScore.color}33`,borderRadius:8,padding:"5px 10px"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:healthScore.color,boxShadow:`0 0 6px ${healthScore.color}`}}/>
            <span style={{fontSize:10,color:healthScore.color,fontWeight:700}}>{healthScore.level}</span>
          </div>
        )}
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
            <div style={{fontSize:36,fontWeight:800,letterSpacing:"-1px",lineHeight:1,background:saldo>=0?"linear-gradient(135deg,#4ade80,#34d399)":"linear-gradient(135deg,#f87171,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{fmt(saldo)}</div>
            <div className="heroCardFooter" style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
              {accumSaldo!==null&&<div><span className="heroMuted" style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>Saldo acumulado </span><span style={{fontSize:12,fontWeight:700,color:(saldo+accumSaldo)>=0?"#4ade80":"#f87171"}}>{fmt(saldo+accumSaldo)}</span></div>}
              {healthScore&&<div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:healthScore.color}}/>
                <span style={{fontSize:10,color:healthScore.color,fontWeight:600}}>{healthScore.level} · {healthScore.score}pts</span>
              </div>}
            </div>
          </div>
        </div>

        {/* 4 grad cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 14px 10px"}}>
          <GradCard label="Receitas" value={fmt(totRec)} color="#4ade80" bg="rgba(74,222,128,.08)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
            onAdd={()=>{setFormType("receita");setForm(BLANK("receita"));setShowForm(true);}}/>
          <GradCard label="Despesas" value={fmt(totDesp)} color="#fb923c" bg="rgba(251,146,60,.08)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>}
            onAdd={()=>{setFormType("despesa");setForm(BLANK("despesa"));setShowForm(true);}}/>
          <GradCard label="Pago" value={fmt(totPago)} color="#8ab4f8" bg="rgba(138,180,248,.08)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 9"/></svg>}/>
          <GradCard label="A pagar" value={fmt(totPend)} color="#facc15" bg="rgba(250,204,21,.08)"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}/>
        </div>

        {/* Health detail panel */}
        {healthScore&&selMonth===NOW&&(
          <div style={{padding:"0 14px 10px"}}>
            <div style={{background:"var(--card-bg)",border:`1px solid ${healthScore.color}22`,borderRadius:14,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:healthScore.color}}>💊 Saúde Financeira — {healthScore.level}</div>
                <div style={{fontSize:16,fontWeight:800,color:healthScore.color}}>{healthScore.score}<span style={{fontSize:10,fontWeight:400,color:"var(--text3)"}}>/100</span></div>
              </div>
              <div style={{height:5,background:"var(--bg)",borderRadius:3,marginBottom:10,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${healthScore.score}%`,background:`linear-gradient(90deg,${healthScore.color}88,${healthScore.color})`,borderRadius:3,transition:"width .6s"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 10px",border:"1px solid var(--border2)"}}>
                  <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Gastos fixos / Renda</div>
                  <div style={{fontSize:13,fontWeight:700,color:healthScore.fixedPct>70?"#f87171":healthScore.fixedPct>50?"#facc15":"#4ade80"}}>{healthScore.fixedPct.toFixed(0)}%</div>
                </div>
                <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 10px",border:"1px solid var(--border2)"}}>
                  <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Taxa de economia</div>
                  <div style={{fontSize:13,fontWeight:700,color:healthScore.savingPct<10?"#f87171":healthScore.savingPct<20?"#facc15":"#4ade80"}}>{healthScore.savingPct.toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Próximos vencimentos */}
        {upcomingDue.length>0&&(
          <div style={{padding:"0 14px 10px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:10,color:"#facc15",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>⏰ Próximos Vencimentos</div>
              <span style={{fontSize:9,background:"#facc15",color:"#0d1118",padding:"2px 7px",borderRadius:4,fontWeight:800}}>{upcomingDue.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {upcomingDue.map((e,i)=>{
                const dayColor=e._days<0?"#f87171":e._days===0?"#fb923c":e._days<=3?"#facc15":"#8ab4f8";
                const dayLabel=e._days<0?`${Math.abs(e._days)}d atraso`:e._days===0?"Hoje":`${e._days}d`;
                return(
                  <button key={i} onClick={()=>e.isFatura?setFatPayTarget(e):setEditTarget({entry:e,monthKey:e._mk})}
                    style={{display:"flex",alignItems:"center",gap:8,background:e._days<0?"rgba(248,113,113,.07)":e._days===0?"rgba(251,146,60,.07)":"var(--card-bg)",border:`1.5px solid ${dayColor}33`,borderRadius:10,padding:"9px 11px",cursor:"pointer",textAlign:"left",width:"100%",transition:"border-color .15s"}}
                    onMouseEnter={ev=>ev.currentTarget.style.borderColor=dayColor+"88"}
                    onMouseLeave={ev=>ev.currentTarget.style.borderColor=dayColor+"33"}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:"var(--text1)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                      <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{fmtDate(e._due)}</div>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":"#fb923c",flexShrink:0}}>{e.type==="receita"?"+":""}{fmt(eVal(e))}</div>
                    <div style={{fontSize:9,fontWeight:700,color:dayColor,background:dayColor+"18",border:`1px solid ${dayColor}33`,borderRadius:4,padding:"2px 7px",flexShrink:0}}>{dayLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search + controls — always visible */}
        <div style={{padding:"0 14px 8px",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{position:"relative"}}>
            <svg style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#445" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{...S.inp,paddingLeft:30,fontSize:12}} placeholder="Buscar por descrição ou observação..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14}}>✕</button>}
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
                style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${filterCat===c.id?(c.color||"#8ab4f8"):"#111820"}`,background:filterCat===c.id?(c.color||"#8ab4f8")+"22":"transparent",color:filterCat===c.id?(c.color||"#8ab4f8"):"#445",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                {c.id!=="all"&&<span style={{width:5,height:5,borderRadius:"50%",background:c.color,display:"inline-block",marginRight:4,verticalAlign:"middle"}}/>}{c.name}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={S.list}>
          {filtered.length===0&&(
            <div style={S.empty}>
              <div style={{fontSize:36,opacity:0.3,marginBottom:8}}>💸</div>
              <div style={{color:"var(--text4)",fontSize:14,fontWeight:600}}>{search?"Nenhum resultado":filterCat!=="all"?"Nenhum lançamento nesta categoria":"Nenhum lançamento"}</div>
              <div style={{color:"#223",fontSize:12,marginTop:3}}>{search?"Tente outro termo":filterCat!=="all"?"Mude o filtro de categoria":"Use os cards + acima para adicionar"}</div>
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
                  <div style={{fontSize:12,fontWeight:700,color:"#8ab4f8"}}>{fmt(total)}{budget>0&&<span style={{fontSize:9,color:budgetPct>100?"#f87171":"#445",marginLeft:4}}>/ {fmt(budget)}</span>}</div>
                </div>
                {budget>0&&<div style={{height:3,background:"var(--bg)",borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${budgetPct}%`,background:budgetPct>100?"#f87171":budgetPct>80?"#facc15":catColor(catId),borderRadius:2,transition:"width .5s"}}/></div>}
                {items.map(renderCard)}
              </div>
            )})
            :filtered.map(renderCard)
          }
        </div>
      </>)}

      {activeTab==="graficos"&&<ChartScreen entries={entries} dividas={dividas} categories={categories} nowMonth={NOW} cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas}/>}
      {activeTab==="cartoes"&&<CartaoScreen cards={cards} setCards={saveCards} cardPurchases={cardPurchases} setCardPurchases={saveCardPurchases} cardFaturas={cardFaturas} setCardFaturas={saveCardFaturas} categories={categories} nowMonth={NOW} toast={toast} onRevertFatura={handleRevertFatura}/>}
      {activeTab==="dividas"&&<DividasScreen dividas={dividas} setDividas={saveDividas} categories={categories} setCategories={saveCategories} nowMonth={NOW} toast={toast}/>}
      {activeTab==="saude"&&<SaudeScreen entries={entries} dividas={dividas} cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas} categories={categories} nowMonth={NOW} goals={goals} onSaveGoals={saveGoals} budgets={budgets} onSaveBudgets={saveBudgets}/>}
      {activeTab==="perfil"&&<ProfileScreen entries={entries} dividas={dividas} selMonth={selMonth} onExportMonth={()=>handleExportCSV(selMonth)} onExportAll={()=>handleExportCSV(null)} onReset={()=>{saveEntries([]);saveDividas([]);saveCards([]);saveCardPurchases([]);saveCardFaturas({});toast("Dados zerados","info");}} notifPerm={notifPerm} notifSettings={notifSettings} onNotifSettings={saveNotifSettings} onRequestPerm={async()=>{const r=await requestNotifPermission();setNotifPerm(r);}} onTestNotif={()=>checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings)} onBackup={handleBackup} onRestore={handleRestore} theme={theme} onTheme={saveTheme} fbUser={fbUser} onLogout={onLogout}/>}
      {activeTab==="admin"&&<AdminScreen fbUser={fbUser}/>}

      {/* Bottom nav — 4 abas principais + "Mais" */}
      <nav style={S.bottomNav}>
        {[
          ["lancamentos","Contas",<svg key="l" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>],
          ["graficos","Análise",<svg key="g" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>],
          ["cartoes","Cartões",<svg key="c" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>],
          ["dividas","Dívidas",<svg key="d" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>],
        ].map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);}} className="navBtn"
            style={{...S.navBtn,borderTop:activeTab===tab?"2px solid #8ab4f8":"2px solid transparent",...(activeTab===tab?S.navBtnActive:{})}}>
            <span style={{opacity:activeTab===tab?1:0.45,color:activeTab===tab?"#8ab4f8":"#556",transition:"all .2s"}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:activeTab===tab?700:500,color:activeTab===tab?"#8ab4f8":"var(--text4)",marginTop:2}}>{label}</span>
          </button>
        ))}
        {/* Botão "Mais" */}
        <button className="navBtn" onClick={()=>setShowMoreNav(p=>!p)}
          style={{...S.navBtn,borderTop:["saude","perfil","admin"].includes(activeTab)?"2px solid #8ab4f8":"2px solid transparent",...(["saude","perfil","admin"].includes(activeTab)?S.navBtnActive:{})}}>
          <span style={{opacity:showMoreNav||["saude","perfil","admin"].includes(activeTab)?1:0.45,color:showMoreNav||["saude","perfil","admin"].includes(activeTab)?"#8ab4f8":"#556",fontSize:20,lineHeight:1}}>⋯</span>
          <span style={{fontSize:9,fontWeight:["saude","perfil","admin"].includes(activeTab)?700:500,color:["saude","perfil","admin"].includes(activeTab)?"#8ab4f8":"var(--text4)",marginTop:2}}>Mais</span>
        </button>
      </nav>

      {/* Menu "Mais" expandido */}
      {showMoreNav&&(
        <div style={{position:"fixed",bottom:68,right:8,background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:6,zIndex:51,boxShadow:"0 8px 32px rgba(0,0,0,.7)",minWidth:150}}>
          {[
            ["saude","💊 Saúde"],
            ["perfil","👤 Perfil"],
            ...(fbUser.email===ADMIN_EMAIL?[["admin","🛡 Admin"]]:[] ),
          ].map(([tab,label])=>(
            <button key={tab} onClick={()=>{setActiveTab(tab);setShowMoreNav(false);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"11px 14px",background:activeTab===tab?"#111820":"transparent",border:"none",borderRadius:9,color:activeTab===tab?"#8ab4f8":"#ccd",fontSize:13,fontWeight:activeTab===tab?700:500,cursor:"pointer",textAlign:"left"}}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* FAB — novo lançamento (visível na aba Contas) */}
      {activeTab==="lancamentos"&&!showForm&&!editTarget&&!delTarget&&(
        <>
          {/* Backdrop para fechar o menu */}
          {showFabMenu&&<div style={{position:"fixed",inset:0,zIndex:48}} onClick={()=>setShowFabMenu(false)}/>}

          {/* Mini-menu: Receita / Despesa */}
          {showFabMenu&&(
            <div style={{position:"fixed",bottom:144,right:16,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end",zIndex:49}}>
              <button onClick={()=>{setFormType("receita");setForm(BLANK("receita"));setShowForm(true);setShowFabMenu(false);}}
                style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",background:"#0d2a1a",border:"1.5px solid #4ade8066",borderRadius:12,color:"#4ade80",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 20px rgba(0,0,0,.8)",whiteSpace:"nowrap"}}>
                <span style={{fontSize:16}}>📈</span> Receita
              </button>
              <button onClick={()=>{setFormType("despesa");setForm(BLANK("despesa"));setShowForm(true);setShowFabMenu(false);}}
                style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",background:"#1a1208",border:"1.5px solid #fb923c66",borderRadius:12,color:"#fb923c",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 20px rgba(0,0,0,.8)",whiteSpace:"nowrap"}}>
                <span style={{fontSize:16}}>📉</span> Despesa
              </button>
            </div>
          )}

          {/* Botão FAB principal */}
          <button onClick={()=>setShowFabMenu(p=>!p)}
            style={{position:"fixed",bottom:82,right:16,width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e55",color:"#8ab4f8",fontSize:26,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 20px rgba(0,0,0,.6)",zIndex:49,display:"flex",alignItems:"center",justifyContent:"center",transition:"transform .15s,box-shadow .15s",transform:showFabMenu?"rotate(45deg)":"rotate(0deg)"}}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 10px 28px rgba(0,0,0,.7)";}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,.6)";}}>
            +
          </button>
        </>
      )}

      {showForm&&<FormModal form={form} setForm={setForm} lockedType={formType} categories={categories} entries={entries} onUpdateCats={saveCategories} onAdd={handleAdd} onClose={()=>{setShowForm(false);setForm(BLANK());}}/>}
      {editTarget&&<EditModal entry={editTarget.entry} monthKey={editTarget.monthKey} categories={categories} entries={entries} onUpdateCats={saveCategories} onSave={handleSaveEdit} onClose={()=>setEditTarget(null)}/>}
      {delTarget&&<DeleteModal entry={delTarget} onDelete={handleDelete} onClose={()=>setDelTarget(null)}/>}
      {fatPayTarget&&<FaturaPayModal entry={fatPayTarget} onPay={handlePayFatura} onRevert={handleRevertFatura} onClose={()=>setFatPayTarget(null)}/>}
    </div>
  );
}

// ─── Fatura Pay Modal ─────────────────────────────────────────
function FaturaPayModal({entry,onPay,onRevert,onClose}){
  const alreadyPaid=entry.statusForMonth==="pago";
  const [payType,setPayType]=useState("total");
  const [partialAmt,setPartialAmt]=useState(String(entry.amount));
  const isPartial=payType==="partial";
  if(alreadyPaid) return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
        <div style={S.mHeader}><div><div style={S.mTitle}>Fatura paga</div><div style={{fontSize:11,color:entry.cardColor,marginTop:2}}>💳 {entry.cardName}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <div style={{background:"rgba(74,222,128,.06)",border:"1px solid #4ade8033",borderRadius:11,padding:"14px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:22}}>✅</div>
          <div style={{fontSize:14,fontWeight:700,color:"#4ade80",marginTop:6}}>Fatura quitada</div>
          <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>{fmt(entry.amount)}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Fechar</button>
          <button onClick={()=>{onRevert(entry.faturaKey);onClose();}} style={{flex:1,padding:"11px",background:"rgba(248,113,113,.12)",border:"1px solid #f8717133",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>↩ Estornar</button>
        </div>
      </div>
    </div>
  );
  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
        <div style={S.mHeader}><div><div style={S.mTitle}>Pagar Fatura</div><div style={{fontSize:11,color:entry.cardColor,marginTop:2}}>💳 {entry.cardName}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <div style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:11,padding:"12px 14px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:11,color:"var(--text3)",marginBottom:4}}>Total da fatura</div>
          <div style={{fontSize:28,fontWeight:800,color:entry.cardColor}}>{fmt(entry.amount)}</div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["total","✓ Pagar total"],["partial","Pagar parcial"]].map(([t,l])=>(
            <button key={t} onClick={()=>setPayType(t)}
              style={{flex:1,padding:"10px",background:payType===t?"#0d1a2e":"transparent",border:`1px solid ${payType===t?"#1a3a6e":"#111820"}`,borderRadius:10,color:payType===t?"#8ab4f8":"#445",fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        {isPartial&&(
          <div style={{marginBottom:16}}>
            <label style={S.lbl}>Valor pago (R$)</label>
            <input style={S.inp} type="number" min="0" max={entry.amount} step="0.01" value={partialAmt} onChange={e=>setPartialAmt(e.target.value)}/>
            {partialAmt&&parseFloat(partialAmt)<entry.amount&&(
              <div style={{marginTop:8,fontSize:11,color:"#facc15",background:"rgba(250,204,21,.08)",border:"1px solid rgba(250,204,21,.2)",borderRadius:8,padding:"7px 10px"}}>
                ⚠️ Saldo restante de {fmt(entry.amount-parseFloat(partialAmt))} ficará em aberto
              </div>
            )}
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>onPay(entry,isPartial?parseFloat(partialAmt)||entry.amount:entry.amount,isPartial&&parseFloat(partialAmt)<entry.amount)}
            style={{flex:1,padding:"11px",background:`${entry.cardColor}22`,border:`1px solid ${entry.cardColor}44`,borderRadius:10,color:entry.cardColor,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            {isPartial?"Registrar pagamento":"✓ Marcar como paga"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Chart Screen ─────────────────────────────────────────────
function ChartScreen({entries,dividas,categories,nowMonth,cards,cardPurchases,cardFaturas}){
  const [mode,setMode]=useState("mes");
  const [specMonth,setSpecMonth]=useState(nowMonth);
  const [fromMonth,setFromMonth]=useState(addM(nowMonth,-5));
  const [toMonth,setToMonth]=useState(nowMonth);
  const [showPicker,setShowPicker]=useState(false);
  const [chartType,setChartType]=useState("barras");
  const [catView,setCatView]=useState("despesa"); // despesa | receita

  const getCat  =(id)=>(categories.find(c=>c.id===id)||{color:"#9E9E9E",name:id});
  const catColor=(id)=>getCat(id).color;
  const catName =(id)=>getCat(id).name;

  const range=useMemo(()=>{
    if(mode==="mes") return [specMonth];
    const months=[],end=fromMonth<=toMonth?toMonth:fromMonth;
    let cur=fromMonth<=toMonth?fromMonth:toMonth;
    while(cur<=end){months.push(cur);cur=addM(cur,1);}
    return months.slice(0,24);
  },[mode,specMonth,fromMonth,toMonth]);

  const mData=(m)=>getMonthEntries(entries,dividas,m,cards,cardPurchases,cardFaturas);

  const monthlyData=useMemo(()=>range.map(m=>{
    const me=mData(m);
    const rec=me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const dep=me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return{month:range.length===1?mLabel(m):mShort(m),receitas:+rec.toFixed(2),despesas:+dep.toFixed(2),saldo:+(rec-dep).toFixed(2)};
  }),[entries,dividas,cards,cardPurchases,cardFaturas,range]);

  const catData=useMemo(()=>{
    const map={};
    range.forEach(m=>mData(m).filter(e=>e.type===catView).forEach(e=>{map[e.category]=(map[e.category]||0)+eVal(e);}));
    return Object.entries(map).map(([id,value])=>({id,name:catName(id),value:+value.toFixed(2),color:catColor(id)})).sort((a,b)=>b.value-a.value);
  },[entries,dividas,cards,cardPurchases,cardFaturas,range,catView]);

  const totals=useMemo(()=>{
    const all=range.flatMap(m=>mData(m));
    const rec=all.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const dep=all.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return{rec,dep,saldo:rec-dep};
  },[entries,dividas,cards,cardPurchases,cardFaturas,range]);

  // Projection includes card faturas
  const projData=useMemo(()=>Array.from({length:6},(_,i)=>{
    const m=addM(nowMonth,i+1);
    const me=mData(m);
    const rec=me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const dep=me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return{month:mShort(m),receitas:+rec.toFixed(2),despesas:+dep.toFixed(2),saldo:+(rec-dep).toFixed(2)};
  }),[entries,dividas,cards,cardPurchases,cardFaturas,nowMonth]);

  const insights=useMemo(()=>{
    if(range.length<2) return null;
    let maxDepM=null,maxDep=0;
    range.forEach(m=>{const dep=mData(m).filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);if(dep>maxDep){maxDep=dep;maxDepM=m;}});
    return{maxDepM,maxDep,topCat:catData[0]||null};
  },[entries,dividas,cards,cardPurchases,cardFaturas,range,catData]);

  return(
    <div style={{paddingBottom:80,paddingTop:4}}>
      <div style={{padding:"12px 14px 0"}}>
        <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Período de análise</div>
        <div style={{display:"flex",gap:6,marginBottom:12,position:"relative"}}>
          <button onClick={()=>{setMode("mes");setShowPicker(p=>!p);}} className="fTab"
            style={{...S.fTab,flex:1,justifyContent:"center",gap:5,...(mode==="mes"?S.fTabActive:{})}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {mLabel(specMonth)}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button onClick={()=>{setMode("periodo");setShowPicker(false);}} className="fTab"
            style={{...S.fTab,flex:1,justifyContent:"center",...(mode==="periodo"?S.fTabActive:{})}}>Período</button>
          {showPicker&&mode==="mes"&&(
            <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,width:"calc(50% - 3px)",background:"var(--card-bg)",border:"1px solid #1a3a6e",borderRadius:12,zIndex:20,overflow:"hidden",maxHeight:220,overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
              {Array.from({length:24},(_,i)=>addM(nowMonth,i-12)).map(m=>(
                <button key={m} onClick={()=>{setSpecMonth(m);setShowPicker(false);}}
                  style={{width:"100%",padding:"9px 14px",background:m===specMonth?"#1a3a6e44":"transparent",border:"none",color:m===specMonth?"#8ab4f8":"var(--text2)",fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderBottom:"1px solid var(--border2)",fontWeight:m===specMonth?700:400}}>
                  {mLabel(m)}{m===nowMonth?" ·":""}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode==="periodo"&&(
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <div style={{flex:1}}><label style={{...S.lbl,marginBottom:5}}>De</label><MonthPicker value={fromMonth} onChange={setFromMonth} now={nowMonth}/></div>
            <div style={{flex:1}}><label style={{...S.lbl,marginBottom:5}}>Até</label><MonthPicker value={toMonth} onChange={setToMonth} now={nowMonth}/></div>
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 14px 10px"}}>
        <SumCard label="Receitas" value={fmt(totals.rec)} color="#4ade80" icon="↑"/>
        <SumCard label="Despesas" value={fmt(totals.dep)} color="#fb923c" icon="↓"/>
        <SumCard label="Saldo" value={fmt(totals.saldo)} color={totals.saldo>=0?"#4ade80":"#f87171"} icon={totals.saldo>=0?"◈":"▽"} wide/>
      </div>

      {insights&&(<div style={{padding:"0 14px 12px",display:"flex",flexDirection:"column",gap:6}}>
        <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:11,padding:"10px 12px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>📉</span>
          <div><div style={{fontSize:10,color:"var(--text3)",marginBottom:2}}>Mês com maior gasto</div><div style={{fontSize:12,fontWeight:700,color:"#fb923c"}}>{mLabel(insights.maxDepM)} · {fmt(insights.maxDep)}</div></div>
        </div>
        {insights.topCat&&<div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:11,padding:"10px 12px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>🏆</span>
          <div><div style={{fontSize:10,color:"var(--text3)",marginBottom:2}}>Maior {catView==="despesa"?"gasto":"receita"} por categoria</div><div style={{fontSize:12,fontWeight:700,color:insights.topCat.color}}>{insights.topCat.name} · {fmt(insights.topCat.value)}</div></div>
        </div>}
      </div>)}

      <div style={{display:"flex",gap:6,padding:"0 14px 12px"}}>
        {[["barras","Barras"],["evolucao","Evolução"],["pizza","Categorias"],["projecao","Projeção"]].map(([t,l])=>(
          <button key={t} onClick={()=>setChartType(t)} className="fTab" style={{...S.fTab,flex:1,justifyContent:"center",...(chartType===t?S.fTabActive:{})}}>{l}</button>
        ))}
      </div>

      <div style={{padding:"0 14px"}}>
        {(chartType==="barras"||chartType==="evolucao")&&(<div style={S.chartBox}>
          <div style={S.chartTitle}>{chartType==="barras"?"Receitas vs Despesas":"Evolução do Saldo"}</div>
          <BarSVG data={monthlyData} type={chartType}/>
          <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:10}}>
            {chartType==="barras"?(<><Leg color="#4ade80" label="Receitas"/><Leg color="#fb923c" label="Despesas"/></>)
              :(<><Leg color="#4ade80" label="Receitas"/><Leg color="#fb923c" label="Despesas"/><Leg color="#8ab4f8" label="Saldo" dashed/></>)}
          </div>
        </div>)}

        {chartType==="pizza"&&(<div style={S.chartBox}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={S.chartTitle}>Por Categoria</div>
            <div style={{display:"flex",gap:5}}>
              {[["despesa","Despesas"],["receita","Receitas"]].map(([v,l])=>(
                <button key={v} onClick={()=>setCatView(v)} className="fTab"
                  style={{...S.fTab,...(catView===v?S.fTabActive:{}),padding:"4px 9px",fontSize:10}}>{l}</button>
              ))}
            </div>
          </div>
          {catData.length===0
            ?<div style={{textAlign:"center",padding:"40px 0",color:"var(--text4)",fontSize:13}}>Sem dados no período</div>
            :(<>
              <DonutSVG data={catData} total={totals[catView==="despesa"?"dep":"rec"]}/>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                {catData.map((c,i)=>{
                  const tot=totals[catView==="despesa"?"dep":"rec"];
                  const pct=tot>0?((c.value/tot)*100).toFixed(1):0;
                  return(<div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                    <div style={{flex:1,fontSize:12,color:"var(--text2)",fontWeight:500}}>{c.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>{pct}%</div>
                    <div style={{fontSize:12,color:c.color,fontWeight:700,minWidth:72,textAlign:"right"}}>{fmt(c.value)}</div>
                  </div>);
                })}
              </div>
            </>)
          }
        </div>)}

        {chartType==="projecao"&&(<div style={S.chartBox}>
          <div style={S.chartTitle}>Projeção — Próximos 6 meses</div>
          <div style={{fontSize:10,color:"var(--text3)",marginBottom:12}}>Inclui fixos, parcelados, dívidas e faturas de cartão</div>
          <BarSVG data={projData} type="barras" faded/>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:14}}>
            {projData.map((d,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"var(--bg)",borderRadius:8,padding:"7px 10px",border:"1px solid var(--border2)"}}>
                <div style={{fontSize:12,fontWeight:600,color:"#8ab4f8",width:32}}>{d.month}</div>
                <div style={{fontSize:11,color:"#4ade80",flex:1}}>↑ {fmt(d.receitas)}</div>
                <div style={{fontSize:11,color:"#fb923c",flex:1}}>↓ {fmt(d.despesas)}</div>
                <div style={{fontSize:12,fontWeight:700,color:d.saldo>=0?"#4ade80":"#f87171"}}>{fmt(d.saldo)}</div>
              </div>
            ))}
          </div>
        </div>)}
      </div>
    </div>
  );
}

// ─── Cartão Screen ────────────────────────────────────────────
function CartaoScreen({cards,setCards,cardPurchases,setCardPurchases,cardFaturas,setCardFaturas,categories,nowMonth,toast,onRevertFatura}){
  const [showCardForm,setShowCardForm]=useState(false);
  const [showPurchaseForm,setShowPurchaseForm]=useState(false);
  const [activeCardId,setActiveCardId]=useState(null);
  const [delCardId,setDelCardId]=useState(null);
  const [delPurchId,setDelPurchId]=useState(null);
  const [editPurch,setEditPurch]=useState(null);
  const [cardForm,setCardForm]=useState({name:"",limit:"",closeDay:"20",dueDay:"5",color:CARD_COLORS[0]});
  const [purchForm,setPurchForm]=useState({description:"",amount:"",installments:1,purchaseDate:TODAY,category:"outro",notes:""});
  const BLANK_CARD={name:"",limit:"",closeDay:"20",dueDay:"5",color:CARD_COLORS[0]};
  const BLANK_PURCH={description:"",amount:"",installments:1,purchaseDate:TODAY,category:"outro",notes:""};
  const despCats=categories.filter(c=>c.type==="both"||c.type==="despesa");
  const activeCard=cards.find(c=>c.id===activeCardId)||null;

  const handleSaveCard=()=>{
    if(!cardForm.name.trim()) return;
    const nc={id:Date.now().toString(),...cardForm,limit:parseFloat(cardForm.limit)||0,closeDay:parseInt(cardForm.closeDay)||20,dueDay:parseInt(cardForm.dueDay)||5};
    setCards([...cards,nc]);setCardForm(BLANK_CARD);setShowCardForm(false);
    toast("💳 Cartão adicionado");
  };
  const handleSavePurchase=()=>{
    if(!purchForm.description.trim()||!purchForm.amount||!activeCardId) return;
    const p={id:Date.now().toString(),cardId:activeCardId,...purchForm,amount:parseFloat(purchForm.amount),installments:parseInt(purchForm.installments)||1};
    setCardPurchases([p,...cardPurchases]);setPurchForm(BLANK_PURCH);setShowPurchaseForm(false);
    toast("✓ Compra lançada");
  };
  const handleDeleteCard=(id)=>{
    setCards(cards.filter(c=>c.id!==id));
    setCardPurchases(cardPurchases.filter(p=>p.cardId!==id));
    const nf={...cardFaturas};Object.keys(nf).forEach(k=>{if(k.startsWith(id+"_"))delete nf[k];});
    setCardFaturas(nf);setDelCardId(null);toast("Cartão removido","info");
  };
  const handleDeletePurch=(id)=>{setCardPurchases(cardPurchases.filter(p=>p.id!==id));setDelPurchId(null);toast("Compra removida","info");};
  const handleEditPurch=()=>{
    if(!editPurch||!editPurch.description.trim()||!editPurch.amount) return;
    setCardPurchases(cardPurchases.map(p=>p.id!==editPurch.id?p:{...p,...editPurch,amount:parseFloat(editPurch.amount),installments:parseInt(editPurch.installments)||1}));
    setEditPurch(null);toast("✓ Compra atualizada");
  };

  return(
    <div style={{paddingBottom:90}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid var(--border2)"}}>
        <div><div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>Meus Cartões</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{cards.length} cartão{cards.length!==1?"ões":""} cadastrado{cards.length!==1?"s":""}</div></div>
        <button onClick={()=>{setCardForm(BLANK_CARD);setShowCardForm(true);}} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:12}}>+ Novo Cartão</button>
      </div>

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:14}}>
        {cards.length===0&&<div style={S.empty}><div style={{fontSize:36,opacity:0.3,marginBottom:8}}>💳</div><div style={{color:"var(--text4)",fontSize:14,fontWeight:600}}>Nenhum cartão cadastrado</div><div style={{color:"#223",fontSize:12,marginTop:3}}>Adicione um cartão para controlar suas faturas</div></div>}

        {cards.map(card=>{
          const allBillings=getCardBillingMonths(card,cardPurchases);
          const openFat=buildFatura(card,cardPurchases,cardFaturas,nowMonth);
          const usedLimit=cardPurchases.filter(p=>p.cardId===card.id).reduce((s,p)=>{
            const base=getBillingMonth(p.purchaseDate,card.closeDay);
            const inst=parseInt(p.installments)||1;
            for(let i=0;i<inst;i++){const bm=addM(base,i);if(bm>=nowMonth){const fat=cardFaturas[`${card.id}_${bm}`];if(!fat?.paid)s+=parseFloat((p.amount/inst).toFixed(2));}}
            return s;
          },0);
          const limitPct=card.limit>0?Math.min(100,(usedLimit/card.limit)*100):0;
          const closeDateThisMonth=getFaturaCloseDate(nowMonth,card.closeDay);
          const daysToClose=daysUntil(closeDateThisMonth);
          const pastFaturas=allBillings.filter(bm=>!isFaturaOpen(bm,card.closeDay)&&bm!==nowMonth).slice(-3).reverse();

          return(
            <div key={card.id} style={{background:"var(--card-bg)",borderRadius:18,overflow:"hidden",border:`1px solid ${card.color}22`}}>
              <div style={{background:`linear-gradient(135deg,${card.color}33,${card.color}11)`,padding:"16px 16px 14px",borderBottom:`1px solid ${card.color}22`}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{card.name}</div>
                    <div style={{fontSize:10,color:`${card.color}bb`,marginTop:2}}>Fecha dia {card.closeDay} · Vence dia {card.dueDay} do mês seguinte</div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <button className="iconBtn" onClick={()=>{setActiveCardId(card.id);setPurchForm(BLANK_PURCH);setShowPurchaseForm(true);}}
                      style={{...S.iconBtn,background:`${card.color}22`,color:card.color,width:30,height:30,borderRadius:9}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button className="iconBtn" onClick={()=>setDelCardId(card.id)} style={{...S.iconBtn,background:"rgba(239,68,68,.1)",color:"#f87171",width:30,height:30,borderRadius:9}}>✕</button>
                  </div>
                </div>
                {card.limit>0&&(<div style={{marginTop:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:10,color:`${card.color}99`}}>Limite utilizado</span>
                    <span style={{fontSize:11,fontWeight:700,color:limitPct>80?"#f87171":limitPct>60?"#facc15":card.color}}>{limitPct.toFixed(0)}%</span>
                  </div>
                  <div style={{height:5,background:"rgba(255,255,255,.08)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${limitPct}%`,background:limitPct>80?"#f87171":limitPct>60?"#facc15":card.color,borderRadius:3,transition:"width .5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <span style={{fontSize:9,color:"var(--text3)"}}>Usado: {fmt(usedLimit)}</span>
                    <span style={{fontSize:9,color:"var(--text3)"}}>Disponível: {fmt(Math.max(0,card.limit-usedLimit))}</span>
                  </div>
                </div>)}
              </div>

              <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--text1)"}}>Fatura em aberto — {mLabel(nowMonth)}</div>
                    <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>
                      {daysToClose!==null&&daysToClose>=0
                        ?<span style={{color:"#facc15"}}>⏱ Fecha em {daysToClose}d ({fmtDate(closeDateThisMonth)})</span>
                        :<span style={{color:"#f87171"}}>🔒 Fatura fechada</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:800,color:card.color}}>{fmt(openFat.total)}</div>
                    <div style={{fontSize:9,color:"var(--text3)"}}>{openFat.items.length} compra{openFat.items.length!==1?"s":""}</div>
                  </div>
                </div>
                {openFat.items.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {openFat.items.map(item=>(
                      <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,background:"var(--bg)",borderRadius:8,padding:"7px 10px",border:"1px solid var(--border2)"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"var(--text2)",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.description}</div>
                          {item.total>1&&<div style={{fontSize:9,color:"var(--text3)"}}>{item.installmentNum}/{item.total}x</div>}
                        </div>
                        <div style={{fontSize:12,fontWeight:700,color:card.color}}>{fmt(item.amount)}</div>
                        <button className="iconBtn" onClick={()=>setEditPurch({...item,amount:String(item.amount),installments:String(item.installments||1)})}
                          style={{...S.iconBtn,background:"rgba(138,180,248,.1)",color:"#8ab4f8",width:20,height:20,borderRadius:5,fontSize:10}}>✏</button>
                        <button className="iconBtn" onClick={()=>setDelPurchId(item.id)}
                          style={{...S.iconBtn,background:"rgba(239,68,68,.08)",color:"#f8717188",width:20,height:20,borderRadius:5,fontSize:10}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {openFat.items.length===0&&<div style={{textAlign:"center",padding:"10px 0",color:"var(--text4)",fontSize:11}}>Nenhuma compra nesta fatura</div>}
              </div>

              {pastFaturas.length>0&&(
                <div style={{padding:"10px 14px"}}>
                  <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Faturas anteriores</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {pastFaturas.map(bm=>{
                      const fat=buildFatura(card,cardPurchases,cardFaturas,bm);
                      if(fat.total<=0) return null;
                      return(
                        <div key={bm} style={{display:"flex",alignItems:"center",gap:10,background:"var(--bg)",borderRadius:9,padding:"8px 12px",border:"1px solid var(--border2)"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,color:"var(--text2)",fontWeight:600}}>{mLabel(bm)}</div>
                            <div style={{fontSize:10,color:"var(--text3)"}}>Venceu {fmtDate(fat.dueDate)}{fat.partial?` · Parcial: ${fmt(fat.paidAmount)}`:""}</div>
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:fat.paid?"#4ade80":fat.partial?"#facc15":card.color}}>{fmt(fat.total)}</div>
                          <div style={{...S.badge,background:fat.paid?"rgba(74,222,128,.15)":fat.partial?"rgba(250,204,21,.12)":"rgba(251,146,60,.12)",color:fat.paid?"#4ade80":fat.partial?"#facc15":"#fb923c",padding:"4px 8px",fontSize:9}}>
                            {fat.paid?"✓ pago":fat.partial?"parcial":"pendente"}
                          </div>
                          {fat.paid&&<button onClick={()=>onRevertFatura(fat.key)} style={{...S.iconBtn,background:"rgba(248,113,113,.1)",color:"#f87171",fontSize:9,padding:"2px 6px",height:"auto",borderRadius:5}}>↩</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {delCardId&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDelCardId(null)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Excluir cartão</div><button style={S.xBtn} onClick={()=>setDelCardId(null)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:2}}>{cards.find(c=>c.id===delCardId)?.name}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove o cartão e todas as compras e faturas associadas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelCardId(null)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>handleDeleteCard(delCardId)} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showCardForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowCardForm(false)}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Novo Cartão</div><button style={S.xBtn} onClick={()=>setShowCardForm(false)}>✕</button></div>
            <Field label="Nome do cartão"><input style={S.inp} placeholder="Ex: Nubank, Inter..." value={cardForm.name} onChange={e=>setCardForm(p=>({...p,name:e.target.value}))}/></Field>
            <Field label="Limite (R$)"><input style={S.inp} type="number" placeholder="0,00" min="0" step="0.01" value={cardForm.limit} onChange={e=>setCardForm(p=>({...p,limit:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Dia fechamento" style={{flex:1}}><input style={S.inp} type="number" min={1} max={28} value={cardForm.closeDay} onChange={e=>setCardForm(p=>({...p,closeDay:e.target.value}))}/></Field>
              <Field label="Dia vencimento" style={{flex:1}}><input style={S.inp} type="number" min={1} max={28} value={cardForm.dueDay} onChange={e=>setCardForm(p=>({...p,dueDay:e.target.value}))}/></Field>
            </div>
            <Field label="Cor do cartão">
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {CARD_COLORS.map(c=>(
                  <button key={c} onClick={()=>setCardForm(p=>({...p,color:c}))}
                    style={{width:32,height:32,borderRadius:9,background:c,border:`2.5px solid ${cardForm.color===c?"#fff":"transparent"}`,cursor:"pointer",transform:cardForm.color===c?"scale(1.15)":"scale(1)",transition:"transform .15s"}}/>
                ))}
              </div>
            </Field>
            <button onClick={handleSaveCard} className="submitBtn"
              style={{...S.submitBtn,background:`linear-gradient(135deg,${cardForm.color}33,${cardForm.color}11)`,borderColor:`${cardForm.color}44`,color:cardForm.color,opacity:!cardForm.name?0.35:1}}
              disabled={!cardForm.name}>Adicionar Cartão</button>
          </div>
        </div>
      )}

      {showPurchaseForm&&activeCard&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowPurchaseForm(false)}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}>
              <div><div style={S.mTitle}>Nova Compra</div><div style={{fontSize:11,color:activeCard.color,marginTop:2}}>💳 {activeCard.name}</div></div>
              <button style={S.xBtn} onClick={()=>setShowPurchaseForm(false)}>✕</button>
            </div>
            <Field label="Descrição"><input style={S.inp} placeholder="Ex: Supermercado, Restaurante..." value={purchForm.description} onChange={e=>setPurchForm(p=>({...p,description:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Valor total (R$)" style={{flex:1}}><input style={S.inp} type="number" placeholder="0,00" min="0" step="0.01" value={purchForm.amount} onChange={e=>setPurchForm(p=>({...p,amount:e.target.value}))}/></Field>
              <Field label="Parcelas" style={{flex:"0 0 90px"}}><input style={S.inp} type="number" min={1} max={48} value={purchForm.installments} onChange={e=>setPurchForm(p=>({...p,installments:e.target.value}))}/></Field>
            </div>
            {purchForm.amount&&purchForm.installments>1&&(
              <div style={{marginBottom:13,background:"var(--bg)",border:`1px solid ${activeCard.color}33`,borderRadius:10,padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:"var(--text3)"}}>{purchForm.installments}x de</span>
                <span style={{fontSize:18,fontWeight:800,color:activeCard.color}}>{fmt(parseFloat(purchForm.amount)/parseInt(purchForm.installments))}</span>
              </div>
            )}
            <Field label="Data da compra"><input style={S.inp} type="date" value={purchForm.purchaseDate} onChange={e=>setPurchForm(p=>({...p,purchaseDate:e.target.value}))}/></Field>
            <div style={{marginBottom:13}}>
              <label style={S.lbl}>Categoria</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {categories.filter(c=>c.type==="both"||c.type==="despesa").map(cat=>(
                  <button key={cat.id} onClick={()=>setPurchForm(p=>({...p,category:cat.id}))}
                    style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${purchForm.category===cat.id?cat.color:"transparent"}`,background:purchForm.category===cat.id?cat.color+"22":"rgba(255,255,255,.05)",color:purchForm.category===cat.id?cat.color:"#667",fontSize:11,cursor:"pointer",fontWeight:500}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:48}} placeholder="Alguma anotação..." value={purchForm.notes} onChange={e=>setPurchForm(p=>({...p,notes:e.target.value}))}/></Field>
            <button onClick={handleSavePurchase} className="submitBtn"
              style={{...S.submitBtn,background:`linear-gradient(135deg,${activeCard.color}33,${activeCard.color}11)`,borderColor:`${activeCard.color}44`,color:activeCard.color,opacity:(!purchForm.description||!purchForm.amount)?0.35:1}}
              disabled={!purchForm.description||!purchForm.amount}>Adicionar Compra</button>
          </div>
        </div>
      )}

      {/* Delete purchase confirmation */}
      {delPurchId&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDelPurchId(null)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Excluir compra</div><button style={S.xBtn} onClick={()=>setDelPurchId(null)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:2}}>{cardPurchases.find(p=>p.id===delPurchId)?.description}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove a compra e todas as parcelas associadas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelPurchId(null)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>handleDeletePurch(delPurchId)} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit purchase modal */}
      {editPurch&&(()=>{const ec=cards.find(c=>c.id===editPurch.cardId);const ec2=ec?.color||"#8ab4f8";return(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setEditPurch(null)}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}><div><div style={S.mTitle}>Editar Compra</div>{ec&&<div style={{fontSize:11,color:ec2,marginTop:2}}>💳 {ec.name}</div>}</div><button style={S.xBtn} onClick={()=>setEditPurch(null)}>✕</button></div>
            <Field label="Descrição"><input style={S.inp} value={editPurch.description} onChange={e=>setEditPurch(p=>({...p,description:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Valor total (R$)" style={{flex:1}}><input style={S.inp} type="number" min="0" step="0.01" value={editPurch.amount} onChange={e=>setEditPurch(p=>({...p,amount:e.target.value}))}/></Field>
              <Field label="Parcelas" style={{flex:"0 0 90px"}}><input style={S.inp} type="number" min={1} max={48} value={editPurch.installments} onChange={e=>setEditPurch(p=>({...p,installments:e.target.value}))}/></Field>
            </div>
            <Field label="Data da compra"><input style={S.inp} type="date" value={editPurch.purchaseDate} onChange={e=>setEditPurch(p=>({...p,purchaseDate:e.target.value}))}/></Field>
            <Field label="Observação"><textarea style={{...S.inp,resize:"none",height:48}} value={editPurch.notes||""} onChange={e=>setEditPurch(p=>({...p,notes:e.target.value}))}/></Field>
            <button onClick={handleEditPurch} className="submitBtn" style={{...S.submitBtn,background:`linear-gradient(135deg,${ec2}33,${ec2}11)`,borderColor:`${ec2}44`,color:ec2}}>Salvar alterações</button>
          </div>
        </div>
      );})()}
    </div>
  );
}

// ─── Dívidas Screen ───────────────────────────────────────────
function DividasScreen({dividas,setDividas,categories,setCategories,nowMonth,toast}){
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [celebrate,setCelebrate]=useState(null);
  const [dform,setDform]=useState({name:"",totalAmount:"",installments:12,startMonth:nowMonth,dueDay:"10",category:"divida",notes:""});
  const BLANK_D={name:"",totalAmount:"",installments:12,startMonth:nowMonth,dueDay:"10",category:"divida",notes:""};
  const despCats=categories.filter(c=>c.type==="both"||c.type==="despesa");
  const catColor=(id)=>(categories.find(c=>c.id===id)||{color:"#f87171"}).color;
  const catName =(id)=>(categories.find(c=>c.id===id)||{name:id}).name;
  const NOW=getNow();

  const handleSave=()=>{
    if(!dform.name.trim()||!dform.totalAmount) return;
    if(editId) setDividas(dividas.map(d=>d.id!==editId?d:{...d,...dform,totalAmount:parseFloat(dform.totalAmount),installments:parseInt(dform.installments)}));
    else setDividas([...dividas,{...dform,id:Date.now().toString(),totalAmount:parseFloat(dform.totalAmount),installments:parseInt(dform.installments),paidMonths:[]}]);
    setDform(BLANK_D);setShowForm(false);setEditId(null);
    toast(editId?"✓ Dívida atualizada":"✓ Dívida cadastrada");
  };

  const toggleMonth=(d,m)=>{
    const pm=d.paidMonths||[];
    const wasPaid=pm.includes(m);
    const newPm=wasPaid?pm.filter(x=>x!==m):[...pm,m];
    const justQuited=!wasPaid&&newPm.length>=d.installments;
    setDividas(dividas.map(dv=>dv.id!==d.id?dv:{...dv,paidMonths:newPm}));
    if(justQuited){
      setCelebrate(d.id);
      setTimeout(()=>setCelebrate(null),3000);
      toast("🎉 Dívida quitada! Parabéns!","celebrate");
    } else {
      toast(wasPaid?"Parcela marcada como pendente":"✓ Parcela marcada como paga");
    }
  };

  const active  =dividas.filter(d=>(d.paidMonths?.length||0)<d.installments);
  const quitadas=dividas.filter(d=>(d.paidMonths?.length||0)>=d.installments);

  return(
    <div style={{paddingBottom:90}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid var(--border2)"}}>
        <div><div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>Minhas Dívidas</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{dividas.length} dívida{dividas.length!==1?"s":""} cadastrada{dividas.length!==1?"s":""}</div></div>
        <button onClick={()=>{setDform(BLANK_D);setEditId(null);setShowForm(true);}} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:12}}>+ Nova Dívida</button>
      </div>

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {dividas.length===0&&<div style={S.empty}><div style={{fontSize:36,opacity:0.3,marginBottom:8}}>💳</div><div style={{color:"var(--text4)",fontSize:14,fontWeight:600}}>Nenhuma dívida cadastrada</div></div>}

        {active.map(d=>{
          const instVal=parseFloat((d.totalAmount/d.installments).toFixed(2));
          const paid=d.paidMonths?.length||0;
          const pct=Math.round((paid/d.installments)*100);
          const remaining=d.totalAmount-(paid*instVal);
          const endMonth=addM(d.startMonth,d.installments-1);
          const currentDiff=mDiff(d.startMonth,NOW);
          const isCurrent=currentDiff>=0&&currentDiff<d.installments;
          const isPaidThisMonth=d.paidMonths?.includes(NOW);
          const isCelebrating=celebrate===d.id;

          return(
            <div key={d.id} style={{background:"var(--card-bg)",border:`1px solid ${isCelebrating?"#4ade8055":"#111820"}`,borderRadius:14,overflow:"hidden",transition:"border-color .5s"}}>
              {isCelebrating&&(
                <div style={{background:"linear-gradient(90deg,#0a2a1a,#0d3520,#0a2a1a)",padding:"10px 14px",textAlign:"center",animation:"celebrate 1s ease"}}>
                  <div style={{fontSize:20}}>🎉 🎊 ✨</div>
                  <div style={{fontSize:12,color:"#4ade80",fontWeight:700,marginTop:2}}>Dívida quitada! Parabéns!</div>
                </div>
              )}
              <div style={{padding:"13px 14px 10px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text1)",marginBottom:3}}>{d.name}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{...S.tag,color:catColor(d.category),borderColor:catColor(d.category)+"44",background:catColor(d.category)+"18"}}>{catName(d.category)}</span>
                      <span style={{...S.tag,color:"#f87171",borderColor:"#f8717144",background:"rgba(248,113,113,.1)"}}>💳 {paid}/{d.installments} parcelas</span>
                      <span style={{fontSize:10,color:"var(--text4)"}}>até {mLabel(endMonth)}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button className="iconBtn" onClick={()=>{setDform({name:d.name,totalAmount:String(d.totalAmount),installments:d.installments,startMonth:d.startMonth,dueDay:d.dueDay||"10",category:d.category||"divida",notes:d.notes||""});setEditId(d.id);setShowForm(true);}}
                      style={{...S.iconBtn,background:"rgba(138,180,248,.1)",color:"#8ab4f8"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="iconBtn" onClick={()=>setDelId(d.id)} style={{...S.iconBtn,background:"rgba(239,68,68,.1)",color:"#f87171"}}>✕</button>
                  </div>
                </div>

                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:11,color:"var(--text3)"}}>Progresso de quitação</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>{pct}%</span>
                  </div>
                  <div style={{height:8,background:"var(--bg)",borderRadius:4,overflow:"hidden",border:"1px solid var(--border)"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#f87171,#fb923c)",borderRadius:4,transition:"width .6s"}}/>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 8px",border:"1px solid var(--border2)"}}><div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Total</div><div style={{fontSize:11,fontWeight:700,color:"var(--text1)"}}>{fmt(d.totalAmount)}</div></div>
                  <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 8px",border:"1px solid var(--border2)"}}><div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Parcela</div><div style={{fontSize:11,fontWeight:700,color:"#f87171"}}>{fmt(instVal)}</div></div>
                  <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 8px",border:"1px solid var(--border2)"}}><div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Restante</div><div style={{fontSize:11,fontWeight:700,color:"#facc15"}}>{fmt(remaining)}</div></div>
                </div>

                {isCurrent&&(
                  <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",background:isPaidThisMonth?"rgba(74,222,128,.07)":"rgba(251,146,60,.07)",borderRadius:9,padding:"9px 12px",border:`1px solid ${isPaidThisMonth?"#4ade8022":"#fb923c22"}`}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--text2)"}}>Parcela de {mLabel(NOW)}</div>
                      <div style={{fontSize:10,color:"var(--text3)"}}>{currentDiff+1}/{d.installments} · {fmt(instVal)}</div>
                    </div>
                    <button onClick={()=>toggleMonth(d,NOW)} className="statusToggleBtn"
                      style={{...S.badge,background:isPaidThisMonth?"rgba(74,222,128,.15)":"rgba(251,146,60,.15)",color:isPaidThisMonth?"#4ade80":"#fb923c",border:`1px solid ${isPaidThisMonth?"#4ade8033":"#fb923c33"}`,cursor:"pointer",padding:"5px 10px",fontSize:10}}>
                      {isPaidThisMonth?"✓ pago":"⏳ a pagar"}
                    </button>
                  </div>
                )}
              </div>

              <div style={{background:"var(--bg)",borderTop:"1px solid #111820",padding:"8px 14px",display:"flex",gap:4,overflowX:"auto"}} className="hscroll">
                {Array.from({length:d.installments},(_,i)=>{
                  const m=addM(d.startMonth,i);
                  const isPaid=d.paidMonths?.includes(m);
                  const isNow=m===NOW;
                  return(
                    <button key={m} onClick={()=>toggleMonth(d,m)} title={`${mLabel(m)} — ${isPaid?"Pago":"Pendente"}`}
                      style={{flexShrink:0,width:28,height:28,borderRadius:7,border:`1px solid ${isNow?"#8ab4f8":(isPaid?"#4ade8033":"#111820")}`,background:isPaid?"rgba(74,222,128,.2)":isNow?"rgba(138,180,248,.12)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:1}}>
                      <span style={{fontSize:7,color:isPaid?"#4ade80":isNow?"#8ab4f8":"#334",fontWeight:700,lineHeight:1}}>{mShort(m)}</span>
                      <span style={{fontSize:8,color:isPaid?"#4ade80":isNow?"#8ab4f8":"#334",lineHeight:1}}>{isPaid?"✓":i+1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {quitadas.length>0&&(
          <div>
            <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,paddingLeft:2}}>✅ Quitadas</div>
            {quitadas.map(d=>(
              <div key={d.id} style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 14px",opacity:0.6,display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>{d.name}</div>
                  <div style={{fontSize:10,color:"#4ade80",marginTop:2}}>✓ Quitada · {d.installments}x de {fmt(parseFloat((d.totalAmount/d.installments).toFixed(2)))} · Total {fmt(d.totalAmount)}</div>
                </div>
                <button className="iconBtn" onClick={()=>setDelId(d.id)} style={{...S.iconBtn,background:"rgba(239,68,68,.1)",color:"#f87171"}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {delId&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDelId(null)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Excluir dívida</div><button style={S.xBtn} onClick={()=>setDelId(null)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:2}}>{dividas.find(d=>d.id===delId)?.name}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove a dívida e todas as parcelas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelId(null)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>{setDividas(dividas.filter(d=>d.id!==delId));setDelId(null);toast("Dívida removida","info");}} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&(setShowForm(false),setEditId(null))}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>{editId?"Editar Dívida":"Nova Dívida"}</div><button style={S.xBtn} onClick={()=>{setShowForm(false);setEditId(null);}}>✕</button></div>
            <Field label="Nome da dívida"><input style={S.inp} placeholder="Ex: Cartão Nubank, Empréstimo..." value={dform.name} onChange={e=>setDform(p=>({...p,name:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Valor total (R$)" style={{flex:1}}><input style={S.inp} type="number" placeholder="0,00" min="0" step="0.01" value={dform.totalAmount} onChange={e=>setDform(p=>({...p,totalAmount:e.target.value}))}/></Field>
              <Field label="Nº de parcelas" style={{flex:1}}><input style={S.inp} type="number" min={1} max={360} value={dform.installments} onChange={e=>setDform(p=>({...p,installments:e.target.value}))}/></Field>
            </div>
            {dform.totalAmount&&dform.installments>0&&(
              <div style={{marginBottom:13,background:"var(--bg)",border:"1px solid #f8717133",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"var(--text3)"}}>{dform.installments}x de</span>
                <span style={{fontSize:20,fontWeight:700,color:"#f87171"}}>{fmt(parseFloat(dform.totalAmount)/parseInt(dform.installments))}</span>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <Field label="Início" style={{flex:1}}><MonthPicker value={dform.startMonth} onChange={v=>setDform(p=>({...p,startMonth:v}))} now={nowMonth}/></Field>
              <Field label="Dia venc." style={{flex:"0 0 90px"}}><input style={S.inp} type="number" min={1} max={28} value={dform.dueDay} onChange={e=>setDform(p=>({...p,dueDay:e.target.value}))}/></Field>
            </div>
            <div style={{marginBottom:13}}>
              <label style={S.lbl}>Categoria</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {despCats.map(cat=>(
                  <button key={cat.id} onClick={()=>setDform(p=>({...p,category:cat.id}))}
                    style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${dform.category===cat.id?cat.color:"transparent"}`,background:dform.category===cat.id?cat.color+"22":"rgba(255,255,255,.05)",color:dform.category===cat.id?cat.color:"#667",fontSize:11,cursor:"pointer",fontWeight:500}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:52}} placeholder="Banco, contrato, anotação..." value={dform.notes} onChange={e=>setDform(p=>({...p,notes:e.target.value}))}/></Field>
            <button onClick={handleSave} className="submitBtn"
              style={{...S.submitBtn,opacity:(!dform.name||!dform.totalAmount)?0.35:1,cursor:(!dform.name||!dform.totalAmount)?"not-allowed":"pointer",background:"linear-gradient(135deg,#4a1a1a,#2a0d0d)",borderColor:"#f8717133",color:"#f87171"}}
              disabled={!dform.name||!dform.totalAmount}>{editId?"Salvar alterações":"Cadastrar Dívida"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────
function ProfileScreen({entries,dividas,selMonth,onExportMonth,onExportAll,onReset,notifPerm,notifSettings,onNotifSettings,onRequestPerm,onBackup,onRestore,theme,onTheme,fbUser,onLogout}){
  const [confirmReset,setConfirmReset]=useState(false);
  const [confirmLogout,setConfirmLogout]=useState(false);
  const [editName,setEditName]=useState(false);
  const [newName,setNewName]=useState('');
  const [nameLoading,setNameLoading]=useState(false);
  const [editPass,setEditPass]=useState(false);
  const [curPass,setCurPass]=useState('');
  const [newPass,setNewPass]=useState('');
  const [passLoading,setPassLoading]=useState(false);
  const [passErr,setPassErr]=useState('');
  const permColor=notifPerm==="granted"?"#4ade80":notifPerm==="denied"?"#f87171":"#facc15";
  const permLabel=notifPerm==="granted"?"Ativadas":notifPerm==="denied"?"Bloqueadas pelo browser":notifPerm==="unsupported"?"Não suportado":"Não permitidas";
  const displayName=fbUser?.displayName||fbUser?.email?.split("@")[0]||"Usuário";
  const photoURL=fbUser?.photoURL;
  const isEmailProvider=fbUser?.providerData?.some(p=>p.providerId==="password");

  const handleSaveName=async()=>{
    if(!newName.trim())return;
    setNameLoading(true);
    try{
      await updateProfile(fbUser,{displayName:newName.trim()});
      setEditName(false);
    }catch(e){console.warn(e);}
    setNameLoading(false);
  };
  const handleSavePass=async()=>{
    if(newPass.length<6){setPassErr("Mínimo 6 caracteres");return;}
    setPassLoading(true);setPassErr('');
    try{
      const cred=EmailAuthProvider.credential(fbUser.email,curPass);
      await reauthenticateWithCredential(fbUser,cred);
      await updatePassword(fbUser,newPass);
      setEditPass(false);setCurPass('');setNewPass('');
    }catch(e){
      setPassErr(e.code==='auth/wrong-password'?'Senha atual incorreta':'Erro ao alterar senha');
    }
    setPassLoading(false);
  };

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 16px 20px",borderBottom:"1px solid var(--border2)"}}>
        {photoURL
          ? <img src={photoURL} alt="" style={{width:72,height:72,borderRadius:"50%",border:"2px solid #1a3a6e",marginBottom:12,objectFit:"cover"}}/>
          : <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"2px solid #1a3a6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:12}}>👤</div>
        }
        <div style={{fontSize:15,fontWeight:700,color:"var(--text1)",marginBottom:3}}>{displayName}</div>
        <div style={{fontSize:11,color:"var(--text3)",marginBottom:2}}>{fbUser?.email}</div>
        <div style={{fontSize:11,color:"var(--text3)"}}>{entries.length} lançamentos · {(dividas||[]).length} dívidas</div>
      </div>
      <div style={{padding:"16px 14px",display:"flex",flexDirection:"column",gap:12}}>

        <ProfileSection title="Conta">
          <ProfileItem icon="✏️" label="Alterar nome" sub={displayName} onClick={()=>{setNewName(displayName);setEditName(true);}}/>
          {isEmailProvider&&<ProfileItem icon="🔑" label="Alterar senha" sub="Trocar senha da conta" onClick={()=>{setEditPass(true);setCurPass('');setNewPass('');setPassErr('');}}/>}
          {!confirmLogout
            ? <ProfileItem icon="🚪" label="Sair da conta" sub={`Conectado como ${displayName}`} last onClick={()=>setConfirmLogout(true)} danger/>
            : <div style={{padding:"13px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{fontSize:13,color:"var(--text1)"}}>Confirmar saída?</span>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setConfirmLogout(false)} style={{padding:"6px 12px",background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:8,color:"#667",fontSize:12,cursor:"pointer"}}>Cancelar</button>
                  <button onClick={onLogout} style={{padding:"6px 12px",background:"#2a1a1a",border:"1px solid #f87171",borderRadius:8,color:"#f87171",fontSize:12,fontWeight:700,cursor:"pointer"}}>Sair</button>
                </div>
              </div>
          }
        </ProfileSection>

        <ProfileSection title="Notificações">
          <div style={{padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"var(--text1)"}}>🔔 Alertas de vencimento e recebimento</div><div style={{fontSize:11,color:permColor,marginTop:2}}>{permLabel}</div></div>
              {notifPerm==="granted"
                ?<Toggle checked={notifSettings.enabled} onChange={v=>onNotifSettings({...notifSettings,enabled:v})}/>
                :notifPerm!=="unsupported"&&<button onClick={onRequestPerm} style={{padding:"6px 12px",background:"#1a3a6e",border:"1px solid #2a4a8e",borderRadius:8,color:"#8ab4f8",fontSize:11,fontWeight:700,cursor:"pointer"}}>Permitir</button>}
            </div>
            {notifPerm==="granted"&&notifSettings.enabled&&(<>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Avisar com quantos dias de antecedência</div>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3,5,7].map(d=>(
                    <button key={d} onClick={()=>onNotifSettings({...notifSettings,daysBefore:d})}
                      style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${notifSettings.daysBefore===d?"#8ab4f8":"#111820"}`,background:notifSettings.daysBefore===d?"#0d1a2e":"transparent",color:notifSettings.daysBefore===d?"#8ab4f8":"#445",fontSize:12,fontWeight:700,cursor:"pointer"}}>{d}d</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div><div style={{fontSize:12,color:"var(--text1)",fontWeight:600}}>Alertar contas vencidas</div><div style={{fontSize:10,color:"var(--text3)"}}>Notificar sobre pagamentos atrasados</div></div>
                <Toggle checked={notifSettings.overdueAlert} onChange={v=>onNotifSettings({...notifSettings,overdueAlert:v})}/>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div><div style={{fontSize:12,color:"var(--text1)",fontWeight:600}}>Alertar recebimentos</div><div style={{fontSize:10,color:"var(--text3)"}}>Notificar sobre receitas esperadas</div></div>
                <Toggle checked={notifSettings.incomeAlert!==false} onChange={v=>onNotifSettings({...notifSettings,incomeAlert:v})}/>
              </div>
            </>)}
          </div>
        </ProfileSection>

        <ProfileSection title="Exportar dados">
          <ProfileItem icon="📅" label="Exportar mês atual" sub={`Lançamentos de ${mLabel(selMonth)}`} onClick={onExportMonth}/>
          <ProfileItem icon="📦" label="Exportar tudo" sub="Todos os lançamentos em CSV" onClick={onExportAll} last/>
        </ProfileSection>

        <ProfileSection title="Backup e Restauração">
          <ProfileItem icon="💾" label="Fazer backup" sub="Salva todos os dados em arquivo JSON" onClick={onBackup}/>
          <div style={{padding:"0 14px"}}>
            <label style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderTop:"1px solid #0f1825",cursor:"pointer"}}>
              <span style={{fontSize:18,flexShrink:0}}>📂</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--text1)"}}>Restaurar backup</div><div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>Importa dados de um arquivo JSON</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              <input type="file" accept=".json" onChange={onRestore} style={{display:"none"}}/>
            </label>
          </div>
        </ProfileSection>

        <ProfileSection title="Dados">
          <ProfileItem icon="🗑️" label="Zerar todos os dados" sub="Remove todos os lançamentos e dívidas" onClick={()=>setConfirmReset(true)} danger last/>
        </ProfileSection>

        <ProfileSection title="Aparência">
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><div style={{fontSize:13,fontWeight:600,color:"var(--text1)"}}>{theme==="dark"?"🌙 Modo escuro":"☀️ Modo claro"}</div><div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Alterna entre escuro e claro</div></div>
            <Toggle checked={theme==="light"} onChange={v=>onTheme(v?"light":"dark")}/>
          </div>
        </ProfileSection>

        <ProfileSection title="Sobre">
          <ProfileItem icon="📱" label="Meu Financeiro" sub="Versão 1.2.0" last/>
        </ProfileSection>
      </div>

      {/* Modal: alterar nome */}
      {editName&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setEditName(false)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Alterar nome</div><button style={S.xBtn} onClick={()=>setEditName(false)}>✕</button></div>
            <input style={{...S.inp,marginBottom:16}} placeholder="Seu nome" value={newName} onChange={e=>setNewName(e.target.value)} autoFocus/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditName(false)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleSaveName} disabled={nameLoading||!newName.trim()} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",borderRadius:10,color:"#8ab4f8",fontSize:13,fontWeight:700,cursor:"pointer",opacity:nameLoading||!newName.trim()?0.5:1}}>
                {nameLoading?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: alterar senha */}
      {editPass&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setEditPass(false)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Alterar senha</div><button style={S.xBtn} onClick={()=>setEditPass(false)}>✕</button></div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              <div><label style={S.lbl}>Senha atual</label><input style={S.inp} type="password" placeholder="••••••••" value={curPass} onChange={e=>setCurPass(e.target.value)}/></div>
              <div><label style={S.lbl}>Nova senha</label><input style={S.inp} type="password" placeholder="Mínimo 6 caracteres" value={newPass} onChange={e=>setNewPass(e.target.value)}/></div>
              {passErr&&<div style={{fontSize:12,color:"#f87171"}}>⚠️ {passErr}</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditPass(false)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleSavePass} disabled={passLoading||!curPass||!newPass} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",borderRadius:10,color:"#8ab4f8",fontSize:13,fontWeight:700,cursor:"pointer",opacity:passLoading||!curPass||!newPass?0.5:1}}>
                {passLoading?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar reset */}
      {confirmReset&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setConfirmReset(false)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Zerar dados</div><button style={S.xBtn} onClick={()=>setConfirmReset(false)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"14px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>⚠️</div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:6}}>Tem certeza?</div>
              <div style={{fontSize:12,color:"#f87171",lineHeight:1.5}}>Isso removerá {entries.length} lançamento{entries.length!==1?"s":""} e {(dividas||[]).length} dívida{(dividas||[]).length!==1?"s":""} permanentemente.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmReset(false)} style={{flex:1,padding:"12px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>{onReset();setConfirmReset(false);}} style={{flex:1,padding:"12px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Sim, zerar tudo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function ProfileSection({title,children}){return(<div><div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,paddingLeft:2}}>{title}</div><div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:13,overflow:"hidden"}}>{children}</div></div>);}
function ProfileItem({icon,label,sub,badge,onClick,danger,disabled,last}){return(<button onClick={!disabled&&onClick?onClick:undefined} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"transparent",border:"none",borderBottom:last?"none":"1px solid #0f1825",cursor:disabled||!onClick?"default":"pointer",textAlign:"left",fontFamily:"inherit",opacity:disabled?0.45:1}}><span style={{fontSize:18,flexShrink:0}}>{icon}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:danger?"#f87171":"var(--text1)"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{sub}</div>}</div>{badge&&<span style={{fontSize:9,color:"#8ab4f8",background:"#0d1a2e",border:"1px solid #1a3a6e",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{badge}</span>}{!badge&&onClick&&!disabled&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>}</button>);}
function Toggle({checked,onChange,disabled}){return(<button onClick={()=>!disabled&&onChange(!checked)} style={{width:44,height:24,borderRadius:12,background:checked?"#1a3a6e":"#111820",border:`1.5px solid ${checked?"#8ab4f8":"#1a2840"}`,cursor:disabled?"default":"pointer",position:"relative",transition:"all .2s",flexShrink:0}}><div style={{width:18,height:18,borderRadius:"50%",background:checked?"#8ab4f8":"#334",position:"absolute",top:"50%",transform:`translateY(-50%) translateX(${checked?20:2}px)`,transition:"all .2s"}}/></button>);}

// ─── Form Modal ───────────────────────────────────────────────
function FormModal({form,setForm,lockedType,categories,entries,onUpdateCats,onAdd,onClose}){
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const [editCats,setEditCats]=useState(false);
  const [addingCat,setAddingCat]=useState(false);
  const [touched,setTouched]=useState({});
  const [displayAmt,setDisplayAmt]=useState(form.amount?parseFloat(form.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'');
  const handleAmtChange=(e)=>{
    const digits=e.target.value.replace(/\D/g,'');
    if(!digits){setDisplayAmt('');set('amount','');return;}
    const num=parseInt(digits,10)/100;
    setDisplayAmt(num.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
    set('amount',String(num));
  };
  const descErr=touched.description&&!form.description?.trim()?"Descrição obrigatória":null;
  const amtErr=touched.amount&&(!form.amount||parseFloat(form.amount)<=0)?"Informe um valor válido":null;
  const isValid=form.description?.trim()&&form.amount&&parseFloat(form.amount)>0;
  const [newName,setNewName]=useState("");
  const [newColor,setNewColor]=useState("#6C8EEF");
  const type=lockedType||form.type;
  const filteredCats=categories.filter(c=>c.type==="both"||c.type===type);
  const usedIds=new Set(entries.map(e=>e.category));
  const addCat=()=>{if(!newName.trim())return;const id=newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_")+"_"+Date.now();onUpdateCats([...categories,{id,name:newName.trim(),color:newColor,type}]);set("category",id);setNewName("");setAddingCat(false);};
  const removeCat=(catId)=>{if(usedIds.has(catId))return;onUpdateCats(categories.filter(c=>c.id!==catId));if(form.category===catId){const r=filteredCats.filter(c=>c.id!==catId);if(r.length>0)set("category",r[0].id);}};
  const typeColor=type==="receita"?"#4ade80":"#fb923c";
  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal} className="modal-in">
        <div style={S.mHeader}><div><div style={S.mTitle}>Novo Lançamento</div><div style={{fontSize:11,color:typeColor,fontWeight:600,marginTop:3}}>{type==="receita"?"🟢 Receita":"🔴 Despesa"}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <Field label={<>Descrição <span style={{color:"#f87171"}}>*</span></>}>
          <input style={{...S.inp,borderColor:descErr?"#f87171":"var(--border,#111820)"}} placeholder={type==="receita"?"Ex: Salário, freelance...":"Ex: Conta de luz, aluguel..."} value={form.description} onChange={e=>set("description",e.target.value)} onBlur={()=>setTouched(p=>({...p,description:true}))}/>
          {descErr&&<div style={{marginTop:4,fontSize:11,color:"#f87171"}}>⚠️ {descErr}</div>}
        </Field>
        <div style={{display:"flex",gap:10}}>
          <Field label={<>Valor (R$) <span style={{color:"#f87171"}}>*</span></>} style={{flex:1}}>
            <input style={{...S.inp,borderColor:amtErr?"#f87171":"var(--border,#111820)"}} type="text" inputMode="numeric" placeholder="0,00" value={displayAmt} onChange={handleAmtChange} onBlur={()=>setTouched(p=>({...p,amount:true}))}/>
            {amtErr&&<div style={{marginTop:4,fontSize:11,color:"#f87171"}}>⚠️ {amtErr}</div>}
          </Field>
          <Field label="Vencimento" style={{flex:1}}><input style={S.inp} type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></Field>
        </div>
        <Field label="Recorrência">
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[["none","Único"],["fixed","Fixo 🔄"],["quarterly","Trimestral"],["annual","Anual"],["installment","Parcelado 📋"]].map(([r,l])=>(<button key={r} onClick={()=>set("recurrence",r)} style={{...S.chipBtn,...(form.recurrence===r?S.chipActive:{})}}>{l}</button>))}</div>
          {form.recurrence==="installment"&&(<div style={{marginTop:10}}><label style={{...S.lbl,marginBottom:5}}>Nº de parcelas</label><input style={{...S.inp,width:90}} type="number" min={2} max={60} value={form.installments} onChange={e=>set("installments",e.target.value)}/>{form.amount&&form.installments>1&&(<div style={{marginTop:8,background:"var(--bg)",border:"1px solid #1a3a6e44",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--text3)"}}>Total</span><span style={{fontSize:12,fontWeight:700,color:"#8ab4f8"}}>{fmt(parseFloat(form.amount))}</span><span style={{fontSize:11,color:"var(--text4)"}}>→</span><span style={{fontSize:11,color:"var(--text3)"}}>{form.installments}x de</span><span style={{fontSize:14,fontWeight:700,color:"#4ade80"}}>{fmt(parseFloat(form.amount)/parseInt(form.installments))}</span></div>)}</div>)}
          {(form.recurrence==="fixed"||form.recurrence==="quarterly"||form.recurrence==="annual")&&(<div style={{marginTop:10}}>
            <div style={{fontSize:11,color:"var(--text3)",background:"var(--bg)",borderRadius:8,padding:"8px 10px",border:"1px solid var(--border)",marginBottom:8}}>
              {form.recurrence==="fixed"&&"💡 Aparece todo mês a partir da data"}
              {form.recurrence==="quarterly"&&"💡 Aparece a cada 3 meses"}
              {form.recurrence==="annual"&&"💡 Aparece uma vez por ano"}
            </div>
            <label style={{...S.lbl,marginBottom:5}}>Encerrar em (opcional)</label>
            <MonthPicker value={form.endMonth||""} onChange={v=>set("endMonth",v)} now={new Date().toISOString().substring(0,7)} nullable/>
          </div>)}
        </Field>
        <CatSelector cats={filteredCats} selected={form.category} onSelect={v=>set("category",v)} editCats={editCats} setEditCats={setEditCats} addingCat={addingCat} setAddingCat={setAddingCat} newName={newName} setNewName={setNewName} newColor={newColor} setNewColor={setNewColor} usedIds={usedIds} onAddCat={addCat} onRemoveCat={removeCat}/>
        <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:52,lineHeight:1.5}} placeholder="Alguma anotação..." value={form.notes} onChange={e=>set("notes",e.target.value)}/></Field>
        <Field label="Status"><div style={{display:"flex",gap:8}}>{(type==="receita"?[["a_pagar","⏳ A Receber","#fb923c"],["pago","✓ Recebido","#4ade80"]]:[["a_pagar","⏳ A Pagar","#fb923c"],["pago","✓ Pago","#4ade80"]]).map(([s,l,c])=>(<button key={s} onClick={()=>set("status",s)} style={{...S.typeBtn,...(form.status===s?{background:c+"20",border:`1px solid ${c}44`,color:c}:{})}}>{l}</button>))}</div></Field>
        <button onClick={()=>{setTouched({description:true,amount:true});if(isValid)onAdd();}} className="submitBtn"
          style={{...S.submitBtn,opacity:isValid?1:0.45,cursor:isValid?"pointer":"not-allowed",background:type==="receita"?"linear-gradient(135deg,#1a4a2e,#0d2a1a)":"linear-gradient(135deg,#1a3a6e,#0d2247)",borderColor:type==="receita"?"#4ade8033":"#2a4a8e44",color:typeColor}}>
          Adicionar {type==="receita"?"Receita":"Despesa"}
        </button>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────
function EditModal({entry,monthKey,categories,entries,onUpdateCats,onSave,onClose}){
  const [desc,setDesc]=useState(entry.description);
  const [amount,setAmount]=useState(String(eVal(entry)));
  const [category,setCategory]=useState(entry.category);
  const [status,setStatus]=useState(entry.statusForMonth);
  const [notes,setNotes]=useState(entry.notes||"");
  const [editCats,setEditCats]=useState(false);
  const [addingCat,setAddingCat]=useState(false);
  const [newName,setNewName]=useState("");
  const [newColor,setNewColor]=useState("#6C8EEF");
  const filteredCats=categories.filter(c=>c.type==="both"||c.type===entry.type);
  const usedIds=new Set(entries.map(e=>e.category));
  const isDespesa=entry.type==="despesa";
  const ac=isDespesa?"#fb923c":"#4ade80";
  const addCat=()=>{if(!newName.trim())return;const id=newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_")+"_"+Date.now();onUpdateCats([...categories,{id,name:newName.trim(),color:newColor,type:entry.type}]);setCategory(id);setNewName("");setAddingCat(false);};
  const removeCat=(catId)=>{if(usedIds.has(catId))return;onUpdateCats(categories.filter(c=>c.id!==catId));if(category===catId){const r=filteredCats.filter(c=>c.id!==catId);if(r.length>0)setCategory(r[0].id);}};
  const save=(scope)=>onSave(entry.id,{description:desc,amount:parseFloat(amount)||eVal(entry),category,status,notes},scope);
  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal} className="modal-in">
        <div style={S.mHeader}><div><div style={S.mTitle}>Editar Lançamento</div><div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>{isDespesa?"🔴 Despesa":"🟢 Receita"} · {mLabel(monthKey)}{entry.isRecurring&&<span style={{color:"#8ab4f8",marginLeft:5}}>{entry.recurLabel}</span>}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <Field label="Descrição"><input style={S.inp} value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label={entry.recurrence==="installment"?"Valor da parcela":"Valor (R$)"}><input style={S.inp} type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>{entry.recurrence==="installment"&&<div style={{marginTop:5,fontSize:11,color:"var(--text3)"}}>Parcela {entry.installmentNum}/{entry.installments}</div>}</Field>
        <CatSelector cats={filteredCats} selected={category} onSelect={setCategory} editCats={editCats} setEditCats={setEditCats} addingCat={addingCat} setAddingCat={setAddingCat} newName={newName} setNewName={setNewName} newColor={newColor} setNewColor={setNewColor} usedIds={usedIds} onAddCat={addCat} onRemoveCat={removeCat}/>
        <Field label="Observação"><textarea style={{...S.inp,resize:"none",height:52}} placeholder="Alguma anotação..." value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        <Field label="Status"><div style={{display:"flex",gap:8}}>{(isDespesa?[["a_pagar","⏳ A Pagar","#fb923c"],["pago","✓ Pago","#4ade80"]]:[["a_pagar","⏳ A Receber","#fb923c"],["pago","✓ Recebido","#4ade80"]]).map(([s,l,c])=>(<button key={s} onClick={()=>setStatus(s)} style={{...S.typeBtn,...(status===s?{background:c+"20",border:`1px solid ${c}44`,color:c}:{})}}>{l}</button>))}</div></Field>
        {entry.isRecurring?(<div style={{marginTop:4}}><div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Aplicar em</div><div style={{display:"flex",gap:8}}><button onClick={()=>save("this")} style={{...S.scopeBtn,flex:1,borderColor:"#1a3a6e",color:"#8ab4f8",background:"#0d1a2e"}}><span style={{fontSize:16}}>📅</span><div><div style={{fontWeight:700,fontSize:12}}>Só este mês</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{mLabel(monthKey)}</div></div></button><button onClick={()=>save("future")} style={{...S.scopeBtn,flex:1,borderColor:ac+"44",color:ac,background:ac+"12"}}><span style={{fontSize:16}}>📆</span><div><div style={{fontWeight:700,fontSize:12}}>Este e próximos</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>a partir de {mLabel(monthKey)}</div></div></button></div></div>):(<button onClick={()=>save("this")} className="submitBtn" style={{...S.submitBtn,marginTop:4}}>Salvar alterações</button>)}
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────
function DeleteModal({entry,onDelete,onClose}){
  const isRec=entry.isRecurring;
  return(<div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{...S.modal,maxHeight:"auto"}} className="modal-in"><div style={S.mHeader}><div style={S.mTitle}>Excluir lançamento</div><button style={S.xBtn} onClick={onClose}>✕</button></div><div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}><div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:2}}>{entry.description}</div><div style={{fontSize:11,color:"#f87171"}}>{isRec?"Lançamento recorrente — escolha o escopo":"Esta ação não pode ser desfeita"}</div></div>{isRec?(<div style={{display:"flex",flexDirection:"column",gap:8}}><button onClick={()=>onDelete(entry.id,"this")} style={{...S.scopeBtn,borderColor:"#1a3a6e",color:"#8ab4f8",background:"#0d1a2e"}}><span style={{fontSize:18}}>📅</span><div><div style={{fontWeight:700,fontSize:12}}>Só este mês</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>Os outros meses permanecem</div></div></button><button onClick={()=>onDelete(entry.id,"future")} style={{...S.scopeBtn,borderColor:"#fb923c44",color:"#fb923c",background:"rgba(251,146,60,.08)"}}><span style={{fontSize:18}}>📆</span><div><div style={{fontWeight:700,fontSize:12}}>Este e os próximos</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>Meses anteriores permanecem</div></div></button><button onClick={()=>onDelete(entry.id,"all")} style={{...S.scopeBtn,borderColor:"#f8717144",color:"#f87171",background:"rgba(248,113,113,.08)"}}><span style={{fontSize:18}}>🗑️</span><div><div style={{fontWeight:700,fontSize:12}}>Todos os meses</div></div></button></div>):(<div style={{display:"flex",gap:8}}><button onClick={onClose} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button><button onClick={()=>onDelete(entry.id,"all")} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button></div>)}</div></div>);
}

// ─── Category Selector ────────────────────────────────────────
function CatSelector({cats,selected,onSelect,editCats,setEditCats,addingCat,setAddingCat,newName,setNewName,newColor,setNewColor,usedIds,onAddCat,onRemoveCat}){
  return(<div style={{marginBottom:13}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><label style={S.lbl}>Categoria</label><button onClick={()=>{setEditCats(p=>!p);setAddingCat(false);}} style={{background:editCats?"#1a3a6e44":"transparent",border:`1px solid ${editCats?"#1a3a6e":"#111820"}`,borderRadius:6,padding:"3px 8px",color:editCats?"#8ab4f8":"#445",fontSize:10,cursor:"pointer",fontWeight:600}}>{editCats?"✓ Concluir":"✏ Editar"}</button></div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{cats.map(cat=>(<div key={cat.id} style={{position:"relative",display:"inline-flex"}}><button onClick={()=>!editCats&&onSelect(cat.id)} style={{padding:editCats?"4px 22px 4px 9px":"5px 9px",borderRadius:7,border:`1px solid ${selected===cat.id&&!editCats?cat.color:"transparent"}`,background:selected===cat.id&&!editCats?cat.color+"22":"rgba(255,255,255,.05)",color:selected===cat.id&&!editCats?cat.color:"#667",fontSize:11,cursor:editCats?"default":"pointer",fontWeight:500}}><span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}</button>{editCats&&(usedIds.has(cat.id)?<div style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"#1a2840",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#445" strokeWidth="2.5"><path d="M18 11v-3a6 6 0 00-12 0v3"/><rect x="3" y="11" width="18" height="11" rx="2"/></svg></div>:<button onClick={()=>onRemoveCat(cat.id)} style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>✕</button>)}</div>))}{editCats&&!addingCat&&<button onClick={()=>setAddingCat(true)} style={{padding:"5px 10px",borderRadius:7,border:"1px dashed #1a3a6e",background:"transparent",color:"#8ab4f8",fontSize:11,cursor:"pointer",fontWeight:600}}>+ Nova</button>}</div>{addingCat&&(<div style={{marginTop:10,background:"var(--bg)",border:"1px solid #1a3a6e44",borderRadius:11,padding:"12px"}}><div style={{fontSize:10,color:"#8ab4f8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Nova categoria</div><div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}><input style={{...S.inp,flex:1}} placeholder="Nome" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAddCat()} autoFocus/><label style={{position:"relative",cursor:"pointer",flexShrink:0}}><div style={{width:36,height:36,borderRadius:9,background:newColor,border:"2px solid #1a2840",boxShadow:`0 0 10px ${newColor}55`}}/><input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{position:"absolute",opacity:0,width:1,height:1}}/></label></div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{PRESET_COLORS.map(c=><button key={c} onClick={()=>setNewColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,border:`2px solid ${newColor===c?"#fff":"transparent"}`,cursor:"pointer",flexShrink:0}}/>)}</div><div style={{display:"flex",gap:6}}><button onClick={onAddCat} disabled={!newName.trim()} style={{...S.submitBtn,flex:1,padding:"9px",fontSize:12,marginTop:0,opacity:!newName.trim()?0.35:1}}>✓ Adicionar</button><button onClick={()=>{setAddingCat(false);setNewName("");}} style={{padding:"9px 14px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:9,color:"var(--text3)",fontSize:12,cursor:"pointer"}}>Cancelar</button></div></div>)}</div>);
}

// ─── SVG Charts ───────────────────────────────────────────────
function BarSVG({data,type,faded}){
  const [tip,setTip]=useState(null);
  const W=320,H=180,PL=44,PB=24,PT=10,PR=8,cW=W-PL-PR,cH=H-PB-PT;
  if(!data||data.length===0) return null;
  const series=type==="evolucao"
    ?[{key:"receitas",color:"#4ade80"},{key:"despesas",color:"#fb923c"},{key:"saldo",color:"#8ab4f8",line:true}]
    :[{key:"receitas",color:faded?"#4ade8066":"#4ade80"},{key:"despesas",color:faded?"#fb923c66":"#fb923c"}];
  const allVals=data.flatMap(d=>series.map(s=>d[s.key]||0));
  const maxVal=Math.max(...allVals,1),minVal=type==="evolucao"?Math.min(...allVals,0):0,range2=maxVal-minVal||1;
  const toY=(v)=>PT+cH-((v-minVal)/range2)*cH;
  const toX=(i)=>PL+(i/(data.length-1||1))*cW;
  const barCount=series.filter(s=>!s.line).length;
  const totalW=cW/data.length,barW=Math.min(20,(totalW*0.7)/barCount);
  const groupOff=(i)=>-((barCount-1)/2)*barW+i*barW;
  const yTicks=Array.from({length:5},(_,i)=>minVal+(range2/4)*i);
  const pathFor=(key)=>data.map((d,i)=>i===0?`M${toX(i)},${toY(d[key]||0)}`:`L${toX(i)},${toY(d[key]||0)}`).join(" ");
  const areaFor=(key)=>{const pts=data.map((d,i)=>({x:toX(i),y:toY(d[key]||0)}));const base=toY(0);return `${pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ")} L${pts[pts.length-1].x},${base} L${pts[0].x},${base} Z`;};
  return(
    <div style={{position:"relative",width:"100%"}} onMouseLeave={()=>setTip(null)} onTouchEnd={()=>setTimeout(()=>setTip(null),2000)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        <defs>{series.filter(s=>s.line).map(s=>(<linearGradient key={s.key} id={`g_${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.2"/><stop offset="100%" stopColor={s.color} stopOpacity="0"/></linearGradient>))}</defs>
        {yTicks.map((v,i)=>(<g key={i}><line x1={PL} x2={W-PR} y1={toY(v)} y2={toY(v)} stroke="var(--border)" strokeDasharray="3 3"/><text x={PL-4} y={toY(v)+4} textAnchor="end" fill="var(--text3)" fontSize="9">{fmtShort(v)}</text></g>))}
        {minVal<0&&<line x1={PL} x2={W-PR} y1={toY(0)} y2={toY(0)} stroke="#334" strokeWidth="1"/>}
        {type==="evolucao"&&series.filter(s=>!s.line).map(s=>(<path key={s.key+"_a"} d={areaFor(s.key)} fill={s.color} opacity="0.12"/>))}
        {type==="evolucao"&&series.filter(s=>s.line).map(s=>(<path key={s.key+"_a"} d={areaFor(s.key)} fill={`url(#g_${s.key})`}/>))}
        {type==="evolucao"&&series.map(s=>(<path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth={s.line?"1.5":"2"} strokeDasharray={s.line?"4 2":"none"}/>))}
        {type!=="evolucao"&&data.map((d,di)=>{
          const cx=PL+(di+0.5)*(cW/data.length);
          return series.filter(s=>!s.line).map((s,si)=>{
            const x=cx+groupOff(si)-barW/2,y0=toY(0),y1=toY(d[s.key]||0),bH=Math.abs(y1-y0);
            return(<rect key={s.key} x={x} y={Math.min(y0,y1)} width={barW} height={Math.max(bH,2)} fill={s.color} rx="3" opacity={faded?0.7:1} onMouseEnter={()=>setTip({di,d,x:cx})} onTouchStart={()=>setTip({di,d,x:cx})}/>);
          });
        })}
        {type==="evolucao"&&series.filter(s=>s.line).map(s=>data.map((d,i)=>(<circle key={i} cx={toX(i)} cy={toY(d[s.key]||0)} r="3" fill={s.color} onMouseEnter={()=>setTip({di:i,d,x:toX(i)})} onTouchStart={()=>setTip({di:i,d,x:toX(i)})}/>)))}
        {data.map((d,i)=>(<text key={i} x={PL+(i+0.5)*(cW/data.length)} y={H-6} textAnchor="middle" fill="var(--text3)" fontSize="9">{d.month}</text>))}
        {tip&&(()=>{const tx=Math.min(Math.max(tip.x-44,PL),W-92),ty=PT+8,d=tip.d;return(<g><rect x={tx} y={ty} width={90} height={type==="evolucao"?56:42} rx="6" fill="#0d1118" stroke="#1a2840" strokeWidth="1"/><text x={tx+45} y={ty+14} textAnchor="middle" fill="#8ab4f8" fontSize="9" fontWeight="bold">{d.month}</text><text x={tx+4} y={ty+27} fill="#4ade80" fontSize="9">↑ {fmtShort(d.receitas)}</text><text x={tx+4} y={ty+40} fill="#fb923c" fontSize="9">↓ {fmtShort(d.despesas)}</text>{type==="evolucao"&&<text x={tx+4} y={ty+53} fill="#8ab4f8" fontSize="9">≈ {fmtShort(d.saldo)}</text>}</g>);})()}
      </svg>
    </div>
  );
}
function DonutSVG({data,total}){
  const [hover,setHover]=useState(null);
  const CX=110,CY=90,R=70,r=44,W=280,H=180;
  let angle=-Math.PI/2;
  const slices=data.map(d=>{
    const pct=total>0?d.value/total:0;
    const a0=angle,a1=angle+pct*2*Math.PI-0.02;angle=a1+0.02;
    const x0=CX+R*Math.cos(a0),y0=CY+R*Math.sin(a0),x1=CX+R*Math.cos(a1),y1=CY+R*Math.sin(a1);
    const xi0=CX+r*Math.cos(a0),yi0=CY+r*Math.sin(a0),xi1=CX+r*Math.cos(a1),yi1=CY+r*Math.sin(a1);
    const large=pct>0.5?1:0;
    return{...d,pct,path:`M${xi0},${yi0} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${large} 0 ${xi0},${yi0} Z`};
  });
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
      {slices.map((s,i)=>(<path key={i} d={s.path} fill={s.color} opacity={hover===null||hover===i?1:0.4} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onTouchStart={()=>setHover(i)} style={{cursor:"pointer",transition:"opacity .2s"}}/>))}
      {hover!==null&&slices[hover]?(<><text x={CX} y={CY-8} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">{(slices[hover].pct*100).toFixed(1)}%</text><text x={CX} y={CY+10} textAnchor="middle" fill={slices[hover].color} fontSize="9">{slices[hover].name}</text></>):(<text x={CX} y={CY+5} textAnchor="middle" fill="#556" fontSize="10">Total</text>)}
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function GradCard({label,value,color,bg,icon,onAdd}){
  return(<div className="gradCard" style={{background:bg,border:`1px solid ${color}22`,borderRadius:16,padding:"14px 14px",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle at top right, ${color}18, transparent 70%)`,pointerEvents:"none"}}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div className="gradCardIcon" style={{width:34,height:34,borderRadius:10,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div>
      {onAdd&&<button onClick={onAdd} className="sumAddBtn" style={{width:26,height:26,borderRadius:7,background:`${color}22`,border:`1px solid ${color}44`,color,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,lineHeight:1}}>+</button>}
    </div>
    <div className="gradCardLabel" style={{fontSize:11,color:`${color}99`,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    <div className="gradCardValue" style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{value}</div>
  </div>);
}
function SumCard({label,value,color,icon,wide,onAdd}){return(<div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:13,padding:"11px 12px",gridColumn:wide?"span 2":"span 1",display:"flex",alignItems:"center",gap:10}}><div style={{width:30,height:30,borderRadius:9,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",color,fontSize:14,fontWeight:700,flexShrink:0}}>{icon}</div><div style={{flex:1}}><div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{label}</div><div style={{fontSize:15,fontWeight:700,color,letterSpacing:"-0.4px"}}>{value}</div></div>{onAdd&&<button onClick={onAdd} className="sumAddBtn" style={{width:28,height:28,borderRadius:8,background:color+"22",border:`1px solid ${color}44`,color,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0,lineHeight:1}}>+</button>}</div>);}
function Field({label,children,style}){return <div style={{marginBottom:13,...style}}><label style={S.lbl}>{label}</label>{children}</div>;}
function MonthPicker({value,onChange,now,nullable}){const opts=Array.from({length:24},(_,i)=>addM(now,i-12));return <select value={value||""} onChange={e=>onChange(e.target.value||"")} style={{width:"100%",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"9px 11px",color:"var(--text2)",fontSize:13,outline:"none",fontFamily:"inherit",appearance:"none"}}>{nullable&&<option value="">Sem encerramento</option>}{opts.map(m=><option key={m} value={m}>{mLabel(m)}{m===now?" (atual)":""}</option>)}</select>;}
function Leg({color,label,dashed}){return <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:2,borderTop:dashed?`2px dashed ${color}`:`2px solid ${color}`}}/><span style={{fontSize:10,color:"var(--text3)"}}>{label}</span></div>;}

// ─── Styles ──────────────────────────────────────────────────
const S={
  root:       {minHeight:"100vh",background:"var(--bg, #080c12)",color:"var(--text1, #fff)",fontFamily:"'DM Sans',sans-serif",paddingBottom:72},
  header:     {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 8px",borderBottom:"1px solid var(--border2)"},
  headerLeft: {display:"flex",alignItems:"center",gap:12},
  appName:    {fontSize:20,fontWeight:800,color:"var(--text1, #fff)",letterSpacing:"-0.5px"},
  appSub:     {fontSize:11,color:"var(--text3, #445)",marginTop:1},
  heroCard:   {background:"var(--hero-bg, linear-gradient(135deg,#0a2a1a 0%,#0d1f12 50%,#0a1a10 100%))",border:"1px solid rgba(74,222,128,.2)",borderRadius:20,padding:"20px 20px",position:"relative",overflow:"hidden"},
  arrowBtn:   {width:42,height:42,borderRadius:13,background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3, #556)",cursor:"pointer"},
  hbtn:       {display:"flex",alignItems:"center",gap:5,background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",color:"var(--text3, #556)",padding:"7px 11px",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer"},
  addBtn:     {background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",color:"#8ab4f8"},
  fTab:       {flexShrink:0,display:"flex",alignItems:"center",gap:5,padding:"6px 11px",background:"transparent",border:"1px solid var(--border3, #0f1825)",borderRadius:8,color:"var(--text4, #334)",fontSize:11,fontWeight:500,cursor:"pointer"},
  fTabActive: {background:"var(--tab-active-bg, #0d1a2e)",border:"1px solid var(--tab-active-border, #1a3a6e)",color:"var(--tab-active-color, #8ab4f8)"},
  fCount:     {background:"#0f1825",color:"var(--text4)",borderRadius:4,fontSize:10,padding:"1px 5px",fontWeight:700},
  fCountActive:{background:"#1a3a6e44",color:"#8ab4f8"},
  list:       {padding:"0 14px",display:"flex",flexDirection:"column",gap:7},
  card:       {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderRadius:13,padding:"11px 12px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8},
  cardL:      {display:"flex",alignItems:"flex-start",gap:9,flex:1,minWidth:0},
  cardTitle:  {fontSize:13,fontWeight:600,color:"var(--text1, #dde)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  cardMeta:   {display:"flex",gap:4,marginTop:3,alignItems:"center",flexWrap:"wrap"},
  tag:        {fontSize:9,borderRadius:4,padding:"1px 5px",border:"1px solid",fontWeight:600},
  cardR:      {display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0},
  iconBtn:    {width:24,height:24,borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"},
  badge:      {fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",padding:"2px 6px",borderRadius:4},
  empty:      {textAlign:"center",padding:"52px 20px"},
  chartBox:   {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderRadius:14,padding:"14px 12px",marginBottom:12},
  chartTitle: {fontSize:11,fontWeight:700,color:"var(--accent, #8ab4f8)",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"},
  bottomNav:  {position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"var(--nav-bg, #080c12)",borderTop:"1px solid var(--border, #0f1825)",display:"flex",zIndex:50},
  navBtn:     {flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px 14px",background:"transparent",border:"none",cursor:"pointer",gap:3},
  navBtnActive:{background:"var(--card-bg, #0d1118)"},
  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(7px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100},
  modal:      {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderTopLeftRadius:20,borderTopRightRadius:20,padding:"20px 18px 36px",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"},
  mHeader:    {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  mTitle:     {fontSize:15,fontWeight:700,color:"var(--text1, #dde)"},
  xBtn:       {background:"var(--card-bg2, #111820)",border:"1px solid var(--border, transparent)",color:"var(--text3, #445)",width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"},
  lbl:        {display:"block",fontSize:9,color:"var(--text3, #445)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6},
  inp:        {width:"100%",background:"var(--inp-bg, #080c12)",border:"1px solid var(--border, #111820)",borderRadius:10,padding:"9px 11px",color:"var(--text2, #ccd)",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
  typeBtn:    {flex:1,padding:"9px",background:"var(--card-bg2, rgba(255,255,255,.04))",border:"1px solid var(--border, #111820)",borderRadius:9,color:"var(--text3, #556)",fontSize:12,fontWeight:600,cursor:"pointer"},
  chipBtn:    {flex:1,padding:"7px 6px",background:"transparent",border:"1px solid var(--border, #111820)",borderRadius:8,color:"var(--text3, #445)",fontSize:11,fontWeight:500,cursor:"pointer"},
  chipActive: {background:"var(--tab-active-bg, #0d1a2e)",border:"1px solid var(--tab-active-border, #1a3a6e)",color:"var(--tab-active-color, #8ab4f8)"},
  submitBtn:  {width:"100%",padding:"12px",background:"var(--submit-bg, linear-gradient(135deg,#1a3a6e,#0d2247))",border:"1px solid var(--submit-border, #2a4a8e44)",color:"var(--submit-color, #8ab4f8)",borderRadius:11,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4,fontFamily:"inherit"},
  scopeBtn:   {display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:"1px solid",borderRadius:11,cursor:"pointer",background:"transparent",fontFamily:"inherit",width:"100%",textAlign:"left"},
  selInput:   {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderRadius:10,padding:"8px 26px 8px 11px",color:"var(--text2, #ccd)",fontSize:12,outline:"none",fontFamily:"inherit",appearance:"none",cursor:"pointer",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23445' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 8px center"},
};

const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .hscroll::-webkit-scrollbar { display: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #1a2a40; border-radius: 2px; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.35); }
  select option { background: #0d1118; }
  ::placeholder { color: #334; }
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
  @keyframes celebrate { 0%{background-position:0%} 100%{background-position:100%} }
  -webkit-tap-highlight-color: transparent;

  /* ── CSS Variables: dark (default) ── */
  :root {
    --bg:#080c12; --card-bg:#0d1118; --card-bg2:#111820;
    --border:#111820; --border2:#0d1520; --border3:#0f1825;
    --text1:#dde; --text2:#ccd; --text3:#445; --text4:#334;
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
    --bg:#f8f9fa; --card-bg:#ffffff; --card-bg2:#f1f3f5;
    --border:#e5e7eb; --border2:#d1d5db; --border3:#f3f4f6;
    --text1:#111827; --text2:#374151; --text3:#6b7280; --text4:#9ca3af;
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
  .light-mode .gradCardLabel { opacity: 0.8; }

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

  /* FAB button */
  .light-mode .fabBtn { background: linear-gradient(135deg,#16a34a,#15803d) !important; border-color: #22c55e44 !important; color: #ffffff !important; box-shadow: 0 4px 14px rgba(22,163,74,.35) !important; }
  .light-mode .fabMenu button { background: #ffffff !important; box-shadow: 0 4px 14px rgba(0,0,0,.12) !important; }

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
  [data-theme="light"] [fill="var(--text3)"] { fill: #6b7280 !important; }
  [data-theme="light"] [fill="#8ab4f8"] { fill: #2563eb !important; }
  [data-theme="light"] [stroke="var(--border)"] { stroke: #e5e7eb !important; }

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
  .light-mode [stroke="var(--border)"] { stroke: #e5e7eb !important; }
  .light-mode [fill="#111820"] { fill: #f3f4f6 !important; }
  .light-mode [fill="var(--text3)"] { fill: #6b7280 !important; }

  /* ── Scrollbar ── */
  .light-mode ::-webkit-scrollbar-thumb { background: #d1d5db !important; }
  .light-mode ::-webkit-scrollbar { background: #f9fafb; }
`;

// ─── Recent Activity Component ────────────────────────────────
function RecentActivity({ entries, catColor, catName, selMonth }) {
  const recent = [...entries]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,5);
  if (!recent.length) return null;
  return(
    <div style={{padding:"0 14px 8px"}}>
      <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Últimas movimentações</div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {recent.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"var(--card-bg)",borderRadius:10,padding:"8px 12px",border:"1px solid var(--border)"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:catColor(e.category),flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
              <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{catName(e.category)} · {e.date.split("-").reverse().join("/")}</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":e.isDivida?"#f87171":"var(--text1)",flexShrink:0}}>
              {e.type==="receita"?"+":"-"}{fmt(eVal(e))}
            </div>
            <div style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:e.statusForMonth==="pago"?"rgba(74,222,128,.12)":"rgba(251,146,60,.12)",color:e.statusForMonth==="pago"?"#4ade80":"#fb923c",fontWeight:700}}>
              {e.statusForMonth==="pago"?"✓":"⏳"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Partial Fatura Pay Modal ─────────────────────────────────
function PartialFatModal({ fat, card, onClose, onPay }) {
  const [amount, setAmount] = useState(String(fat.total));
  const val = parseFloat(amount)||0;
  const remaining = parseFloat((fat.total - val).toFixed(2));
  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
        <div style={S.mHeader}>
          <div><div style={S.mTitle}>Pagar Fatura</div>
            <div style={{fontSize:11,color:card.color,marginTop:2,fontWeight:600}}>💳 {card.name}</div>
          </div>
          <button style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{background:"var(--bg)",border:`1px solid ${card.color}22`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--text3)",marginBottom:2}}>Total da fatura</div>
          <div style={{fontSize:22,fontWeight:800,color:card.color}}>{fmt(fat.total)}</div>
        </div>
        <Field label="Valor que será pago (R$)">
          <input style={S.inp} type="number" min="0" step="0.01" max={fat.total}
            value={amount} onChange={e=>setAmount(e.target.value)}/>
        </Field>
        {val>0&&val<fat.total&&(
          <div style={{marginBottom:14,background:"rgba(250,204,21,.08)",border:"1px solid #facc1533",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:"#facc15",fontWeight:600,marginBottom:3}}>⚠️ Pagamento parcial</div>
            <div style={{fontSize:12,color:"var(--text2)"}}>Restante <strong style={{color:"#f87171"}}>{fmt(remaining)}</strong> ficará como pendente</div>
          </div>
        )}
        {val>=fat.total&&(
          <div style={{marginBottom:14,background:"rgba(74,222,128,.08)",border:"1px solid #4ade8033",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:12,color:"#4ade80",fontWeight:600}}>✓ Pagamento integral</div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>val>0&&onPay(fat,val)}
            disabled={!val||val<=0}
            style={{flex:2,padding:"11px",background:`linear-gradient(135deg,${card.color}33,${card.color}11)`,border:`1px solid ${card.color}44`,borderRadius:10,color:card.color,fontSize:13,fontWeight:700,cursor:"pointer",opacity:(!val||val<=0)?0.4:1}}>
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Saúde Financeira Screen ──────────────────────────────────
function SaudeScreen({ entries, dividas, cards, cardPurchases, cardFaturas, categories, nowMonth, goals, onSaveGoals, budgets, onSaveBudgets }) {
  const me = getMonthEntries(entries, dividas, nowMonth, cards, cardPurchases, cardFaturas);
  const rec = me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
  const dep = me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
  const saldo = rec - dep;
  const pago = me.filter(e=>e.type==="despesa"&&e.statusForMonth==="pago").reduce((s,e)=>s+eVal(e),0);
  const pendente = me.filter(e=>e.type==="despesa"&&e.statusForMonth==="a_pagar").reduce((s,e)=>s+eVal(e),0);

  // Fixed costs = recurring despesas
  const fixos = me.filter(e=>e.type==="despesa"&&e.isRecurring).reduce((s,e)=>s+eVal(e),0);
  const fixosPct = rec>0?((fixos/rec)*100):0;

  // Savings
  const economizado = saldo>0?saldo:0;
  const economiaPct = rec>0?((economizado/rec)*100):0;
  const metaEcon = goals.savingsPct>0?((goals.savingsPct/100)*rec):0;
  const metaRenda = goals.monthly||0;

  // Last 3 months trend
  const trend = Array.from({length:3},(_,i)=>{
    const m = addM(nowMonth,-(2-i));
    const me2 = getMonthEntries(entries,dividas,m,cards,cardPurchases,cardFaturas);
    const r2 = me2.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const d2 = me2.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return { month: mShort(m), saldo: r2-d2, rec:r2, dep:d2 };
  });

  // Health score
  let score = 100;
  if (fixosPct > 70) score -= 30;
  else if (fixosPct > 50) score -= 15;
  if (economiaPct < 10) score -= 20;
  if (pendente > 0 && rec > 0 && (pendente/rec) > 0.3) score -= 20;
  if (saldo < 0) score -= 30;
  score = Math.max(0, Math.min(100, score));
  const scoreColor = score>=70?"#4ade80":score>=40?"#facc15":"#f87171";
  const scoreLabel = score>=70?"Ótimo 🌟":score>=40?"Atenção ⚠️":"Crítico 🚨";

  // Category breakdown
  const catMap = {};
  me.filter(e=>e.type==="despesa").forEach(e=>{
    catMap[e.category]=(catMap[e.category]||0)+eVal(e);
  });
  const catRank = Object.entries(catMap)
    .map(([id,v])=>({id,name:(categories.find(c=>c.id===id)||{name:id}).name,color:(categories.find(c=>c.id===id)||{color:"#9E9E9E"}).color,value:v}))
    .sort((a,b)=>b.value-a.value).slice(0,5);

  const pct = (v,max) => max>0?Math.min(100,(v/max)*100):0;

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{padding:"14px 14px 10px",borderBottom:"1px solid var(--border2)"}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>Saúde Financeira</div>
        <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{mLabel(nowMonth)}</div>
      </div>

      <div style={{padding:"14px 14px 0",display:"flex",flexDirection:"column",gap:12}}>

        {/* Score */}
        <div style={{background:"linear-gradient(135deg,var(--card-bg),var(--card-bg2))",border:`1px solid ${scoreColor}33`,borderRadius:16,padding:"18px 18px",textAlign:"center"}}>
          <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Score do mês</div>
          <div style={{position:"relative",width:110,height:110,margin:"0 auto 12px"}}>
            <svg viewBox="0 0 110 110" style={{width:"100%",height:"100%"}}>
              <circle cx="55" cy="55" r="46" fill="none" stroke="var(--border)" strokeWidth="10"/>
              <circle cx="55" cy="55" r="46" fill="none" stroke={scoreColor} strokeWidth="10"
                strokeDasharray={`${(score/100)*289} 289`}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
                style={{transition:"stroke-dasharray .8s ease"}}/>
              <text x="55" y="52" textAnchor="middle" fill={scoreColor} fontSize="26" fontWeight="800">{score}</text>
              <text x="55" y="68" textAnchor="middle" fill="var(--text3)" fontSize="10">pontos</text>
            </svg>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:scoreColor}}>{scoreLabel}</div>
        </div>

        {/* Indicators */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <HealthBar label="Gastos fixos / Renda" value={fixosPct} max={100} color={fixosPct>70?"#f87171":fixosPct>50?"#facc15":"#4ade80"} suffix="%" detail={`${fmt(fixos)} de ${fmt(rec)}`}/>
          <HealthBar label="Economia do mês" value={economiaPct} max={100} color={economiaPct>=20?"#4ade80":economiaPct>=10?"#facc15":"#f87171"} suffix="%" detail={`${fmt(economizado)} poupado`}/>
          {metaRenda>0&&<HealthBar label="Meta de renda" value={pct(rec,metaRenda)} max={100} color="#8ab4f8" suffix="%" detail={`${fmt(rec)} de ${fmt(metaRenda)}`}/>}
          {metaEcon>0&&<HealthBar label="Meta de economia" value={pct(economizado,metaEcon)} max={100} color="#a78bfa" suffix="%" detail={`${fmt(economizado)} de ${fmt(metaEcon)}`}/>}
        </div>

        {/* Trend */}
        <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8ab4f8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Tendência — 3 meses</div>
          <div style={{display:"flex",gap:6}}>
            {trend.map((t,i)=>(
              <div key={i} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:"var(--text3)",marginBottom:6}}>{t.month}</div>
                <div style={{fontSize:11,color:"#4ade80"}}>↑ {fmtShort(t.rec)}</div>
                <div style={{fontSize:11,color:"#fb923c"}}>↓ {fmtShort(t.dep)}</div>
                <div style={{fontSize:12,fontWeight:700,color:t.saldo>=0?"#4ade80":"#f87171",marginTop:2}}>{fmtShort(t.saldo)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top categorias */}
        {catRank.length>0&&(
          <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:"14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8ab4f8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Top Gastos por Categoria</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {catRank.map((c,i)=>(
                <div key={i}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:c.color}}/>
                      <span style={{fontSize:12,color:"var(--text2)"}}>{c.name}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"var(--text3)"}}>{dep>0?((c.value/dep)*100).toFixed(0):0}%</span>
                      <span style={{fontSize:12,fontWeight:700,color:c.color}}>{fmt(c.value)}</span>
                    </div>
                  </div>
                  <div style={{height:4,background:"var(--bg)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${dep>0?(c.value/dep)*100:0}%`,background:c.color,borderRadius:2,transition:"width .5s"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals editor */}
        <div style={{background:"rgba(138,180,248,.06)",border:"1px solid #1a3a6e",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8ab4f8",marginBottom:12}}>🎯 Metas financeiras</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Meta de renda mensal (R$)</div><input style={{width:"100%",boxSizing:"border-box",background:"var(--bg)",border:"1px solid #1a3a6e44",borderRadius:9,padding:"8px 12px",color:"var(--text1)",fontSize:13,fontWeight:600,outline:"none",fontFamily:"inherit"}} type="number" min="0" step="100" placeholder="Ex: 5000" value={goals.monthly||""} onChange={e=>onSaveGoals({...goals,monthly:parseFloat(e.target.value)||0})}/></div>
            <div><div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Meta de economia (% da renda)</div>
              <div style={{display:"flex",gap:6}}>
                {[0,10,15,20,30].map(p=>(
                  <button key={p} onClick={()=>onSaveGoals({...goals,savingsPct:p})}
                    style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${goals.savingsPct===p?"#8ab4f8":"#111820"}`,background:goals.savingsPct===p?"#0d1a2e":"transparent",color:goals.savingsPct===p?"#8ab4f8":"#445",fontSize:11,fontWeight:700,cursor:"pointer"}}>{p===0?"Nenhum":`${p}%`}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Budget per category */}
        {catRank.length>0&&(
          <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:14,padding:"14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8ab4f8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>💰 Orçamento por Categoria</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {catRank.map((c,i)=>{
                const budget=budgets[c.id]||0;
                const pctUsed=budget>0?Math.min(100,(c.value/budget)*100):0;
                return(
                  <div key={i}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:"var(--text2)",flex:1}}>{c.name}</span>
                      <span style={{fontSize:11,fontWeight:700,color:c.color}}>{fmt(c.value)}</span>
                      {budget>0&&<span style={{fontSize:10,color:pctUsed>100?"#f87171":"#445"}}>/ {fmt(budget)}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input style={{flex:1,background:"var(--bg)",border:"1px solid #1a3a6e33",borderRadius:7,padding:"5px 9px",color:"#8ab4f8",fontSize:11,outline:"none",fontFamily:"inherit"}} type="number" min="0" step="50" placeholder="Orçamento R$" value={budget||""} onChange={e=>onSaveBudgets({...budgets,[c.id]:parseFloat(e.target.value)||0})}/>
                      {budget>0&&<div style={{flex:2,height:5,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pctUsed}%`,background:pctUsed>100?"#f87171":pctUsed>80?"#facc15":c.color,borderRadius:3,transition:"width .5s"}}/></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Screen ─────────────────────────────────────────────
function AdminScreen({ fbUser }) {
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(()=>{
    loadAllProfiles()
      .then(p=>{ setProfiles(p.sort((a,b)=>new Date(b.lastLogin)-new Date(a.lastLogin))); setLoading(false); })
      .catch(e=>{ setError('Sem permissão ou erro: '+e.message); setLoading(false); });
  },[]);

  const fmtDt = (iso) => { try{ const d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }catch{ return iso; } };
  const providerIcon = (p) => p==='google.com'?'🔵':p==='password'?'📧':'🔗';

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#445'}}>Carregando...</div>;
  if(error)   return <div style={{padding:24,color:'#f87171',fontSize:13}}>{error}</div>;

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{padding:'20px 16px 12px',borderBottom:'1px solid #0f1825'}}>
        <div style={{fontSize:16,fontWeight:800,color:'var(--text1)'}}>🛡️ Painel Admin</div>
        <div style={{fontSize:11,color:'#445',marginTop:2}}>{profiles.length} conta{profiles.length!==1?'s':''} cadastrada{profiles.length!==1?'s':''}</div>
      </div>
      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
        {profiles.map(p=>(
          <div key={p.uid} style={{background:'#0d1118',border:'1px solid #111820',borderRadius:12,padding:'13px 14px',display:'flex',gap:12,alignItems:'flex-start'}}>
            {p.photoURL
              ? <img src={p.photoURL} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              : <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#1a3a6e,#0d2247)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>👤</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text1)',marginBottom:2}}>
                {p.displayName||'Sem nome'} {p.email===ADMIN_EMAIL&&<span style={{fontSize:9,color:'#facc15',background:'rgba(250,204,21,.1)',border:'1px solid rgba(250,204,21,.2)',borderRadius:4,padding:'1px 6px',marginLeft:4}}>ADMIN</span>}
              </div>
              <div style={{fontSize:11,color:'#8ab4f8',marginBottom:4}}>{p.email}</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:10,color:'#445'}}>{providerIcon(p.provider)} {p.provider==='google.com'?'Google':'E-mail'}</span>
                <span style={{fontSize:10,color:'#334'}}>Cadastro: {fmtDt(p.createdAt)}</span>
              </div>
              <div style={{fontSize:10,color:'#334',marginTop:2}}>Último acesso: {fmtDt(p.lastLogin)}</div>
              <div style={{fontSize:9,color:'#222',marginTop:3,fontFamily:'monospace'}}>{p.uid}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthBar({ label, value, max, color, suffix, detail }) {
  const pct = Math.min(100, max>0?(value/max)*100:0);
  return(
    <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:11,padding:"11px 13px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{label}</span>
        <span style={{fontSize:13,fontWeight:800,color}}>{value.toFixed(1)}{suffix}</span>
      </div>
      <div style={{height:5,background:"var(--bg)",borderRadius:3,overflow:"hidden",marginBottom:4}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .6s ease"}}/>
      </div>
      {detail&&<div style={{fontSize:10,color:"var(--text3)"}}>{detail}</div>}
    </div>
  );
}

export default App;
