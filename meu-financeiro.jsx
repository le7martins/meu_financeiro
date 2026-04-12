
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
const defaultNotifSettings = { enabled:true, daysBefore:3, overdueAlert:true };
async function requestNotifPermission() {
  if(!("Notification" in window)) return "unsupported";
  if(Notification.permission==="granted") return "granted";
  if(Notification.permission==="denied")  return "denied";
  return await Notification.requestPermission();
}
function fireNotification(title,body,tag) {
  if(Notification.permission!=="granted") return;
  try { new Notification(title,{body,tag,icon:"https://fav.farm/💰"}); } catch{}
}
function checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,settings) {
  if(!settings.enabled||Notification.permission!=="granted") return 0;
  const NOW=getNow();
  const me=getMonthEntries(entries,dividas,NOW,cards,cardPurchases,cardFaturas);
  const pending=me.filter(e=>e.type==="despesa"&&e.statusForMonth==="a_pagar");
  const overdue=[],dueToday=[],dueSoon=[];
  for(const e of pending){
    const due=e.isDivida||e.recurrence==="none"?e.date:`${NOW}-${e.date.split("-")[2]}`;
    const days=daysUntil(due);
    if(days===null) continue;
    if(days<0&&settings.overdueAlert) overdue.push({...e,days});
    else if(days===0) dueToday.push(e);
    else if(days>0&&days<=settings.daysBefore) dueSoon.push({...e,days});
  }
  let fired=0;
  if(overdue.length>0){fireNotification(`⚠️ ${overdue.length} conta${overdue.length>1?"s":""} vencida${overdue.length>1?"s":""}`,overdue.map(e=>`${e.description} (${Math.abs(e.days)}d atraso)`).join(", "),"mf-overdue");fired++;}
  if(dueToday.length>0){fireNotification(`🔴 ${dueToday.length} conta${dueToday.length>1?"s":""} vence${dueToday.length>1?"m":""} hoje`,dueToday.map(e=>e.description).join(", "),"mf-today");fired++;}
  if(dueSoon.length>0){fireNotification(`⏰ ${dueSoon.length} conta${dueSoon.length>1?"s":""} vencendo em breve`,dueSoon.map(e=>`${e.description} (${e.days}d)`).join(", "),"mf-soon");fired++;}
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
  return {card,billingMonth,items,total:parseFloat(total.toFixed(2)),closeDate,dueDate,open,paid,paidAmount,key};
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
    else if(e.recurrence==="fixed"){ if(base<=monthKey){const st=e.statusByMonth?.[monthKey]||"a_pagar";item={...e,statusForMonth:st,isRecurring:true,recurLabel:"Fixo 🔄"};} }
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
const BLANK=(type="despesa")=>({description:"",amount:"",date:TODAY,type,status:"a_pagar",category:type==="receita"?"salario":"outro",recurrence:"none",installments:2,notes:""});
const PRESET_COLORS=["#6C8EEF","#EF8C6C","#6CEF9A","#EF6CA8","#C46CEF","#EFCE6C","#6CCEEF","#4ade80","#f87171","#facc15","#34d399","#a3e635"];
const CARD_COLORS=["#a78bfa","#60a5fa","#34d399","#f472b6","#fb923c","#facc15","#f87171","#38bdf8"];

// ─── Toast Hook ───────────────────────────────────────────────
function useToast() {
  const [toasts,setToasts]=useState([]);
  const toast=useCallback((msg,type="success")=>{
    const id=Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),2800);
  },[]);
  return {toasts,toast};
}

// ─── App ─────────────────────────────────────────────────────
function App(){
  const [entries,      setEntries]      = useState(()=>loadLS("mf2_entries",[]));
  const [dividas,      setDividas]      = useState(()=>loadLS("mf2_dividas",[]));
  const [cards,        setCards]        = useState(()=>loadLS("mf2_cards",[]));
  const [cardPurchases,setCardPurchases]= useState(()=>loadLS("mf2_cpurchases",[]));
  const [cardFaturas,  setCardFaturas]  = useState(()=>loadLS("mf2_cfaturas",{}));
  const [categories,   setCategories]   = useState(()=>loadLS("mf2_cats",DEFAULT_CATS));
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
  const [notifSettings,setNotifSettings]= useState(()=>loadLS(NOTIF_KEY,defaultNotifSettings));
  const {toasts,toast} = useToast();

  const saveEntries   =(e)=>{setEntries(e);   saveLS("mf2_entries",e);};
  const saveDividas   =(d)=>{setDividas(d);   saveLS("mf2_dividas",d);};
  const saveCards     =(c)=>{setCards(c);     saveLS("mf2_cards",c);};
  const saveCardPurchases=(p)=>{setCardPurchases(p);saveLS("mf2_cpurchases",p);};
  const saveCardFaturas  =(f)=>{setCardFaturas(f); saveLS("mf2_cfaturas",f);};
  const saveCategories=(c)=>{setCategories(c);saveLS("mf2_cats",c);};
  const saveNotifSettings=(s)=>{setNotifSettings(s);saveLS(NOTIF_KEY,s);};

  const NOW=getNow();

  useEffect(()=>{
    if(notifSettings.enabled&&Notification.permission==="granted"){
      const lastCheck=loadLS(NOTIF_LAST_KEY,null);
      if(lastCheck!==TODAY) setTimeout(()=>{checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings);saveLS(NOTIF_LAST_KEY,TODAY);},1500);
    }
  },[]);

  const monthEntries=useMemo(()=>getMonthEntries(entries,dividas,selMonth,cards,cardPurchases,cardFaturas),[entries,dividas,selMonth,cards,cardPurchases,cardFaturas]);

  // Recent transactions across all months (last 8)
  const recentTx=useMemo(()=>{
    const all=[];
    const months=[NOW,...[1,2].map(i=>addM(NOW,-i))];
    for(const m of months){
      const me=getMonthEntries(entries,dividas,m,cards,cardPurchases,cardFaturas);
      me.forEach(e=>all.push({...e,_month:m}));
    }
    return all.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  },[entries,dividas,cards,cardPurchases,cardFaturas,NOW]);

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

  const filtered=useMemo(()=>{
    let list=filter==="all"?monthEntries:filter==="despesa"?monthEntries.filter(e=>e.type==="despesa"):filter==="receita"?monthEntries.filter(e=>e.type==="receita"):filter==="a_pagar"?monthEntries.filter(e=>e.statusForMonth==="a_pagar"):monthEntries.filter(e=>e.statusForMonth==="pago");
    if(search.trim()){const q=search.toLowerCase();list=list.filter(e=>e.description.toLowerCase().includes(q)||(e.notes||"").toLowerCase().includes(q));}
    if(sortBy==="amount") list=[...list].sort((a,b)=>eVal(b)-eVal(a));
    else if(sortBy==="name") list=[...list].sort((a,b)=>a.description.localeCompare(b.description));
    else if(sortBy==="status") list=[...list].sort((a,b)=>a.statusForMonth==="a_pagar"?-1:1);
    else list=[...list].sort((a,b)=>a.date.localeCompare(b.date));
    return list;
  },[monthEntries,filter,search,sortBy]);

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
    const entry={id:Date.now().toString(),description:form.description.trim(),amount:parseFloat(form.amount),date:form.date,type:form.type,status:form.status,category:form.category,recurrence:form.recurrence,notes:form.notes,...(form.recurrence==="installment"?{installments:parseInt(form.installments)}:{}),statusByMonth:{},overrides:{}};
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
    saveCardFaturas({...cardFaturas,[entry.faturaKey]:{...cur,paid:true,paidAmount:amount,paidDate:TODAY,partial}});
    setFatPayTarget(null);
    toast(partial?"Pagamento parcial registrado":"✓ Fatura paga");
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
    const list=mk?getMonthEntries(entries,dividas,mk,cards,cardPurchases,cardFaturas):entries;
    const hdr=["Descrição","Tipo","Valor","Vencimento","Status","Categoria","Recorrência","Notas"];
    const rows=list.map(e=>[`"${e.description}"`,e.type,(eVal(e)).toFixed(2),fmtDate(e.date),e.statusForMonth||e.status,`"${catName(e.category)}"`,e.recurrence,`"${e.notes||""}"`]);
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
    const borderColor=entry.type==="receita"?"#4ade8055":entry.isDivida?"#f8717155":entry.isFatura?`${entry.cardColor}55`:"#111820";
    const amtColor=entry.type==="receita"?"#4ade80":entry.isDivida?"#f87171":entry.isFatura?entry.cardColor:"#dde";
    return(
      <div key={`${entry.id}-${selMonth}`} className="eCard" style={{...S.card,borderLeft:`3px solid ${borderColor}`}}>
        <div style={S.cardL}>
          <div style={{width:8,height:8,borderRadius:"50%",background:entry.isFatura?entry.cardColor:catColor(entry.category),flexShrink:0,marginTop:3}}/>
          <div style={{minWidth:0,flex:1}}>
            <div style={S.cardTitle}>{entry.description}</div>
            <div style={S.cardMeta}>
              {!entry.isFatura&&<span style={{...S.tag,color:catColor(entry.category),borderColor:catColor(entry.category)+"44",background:catColor(entry.category)+"18"}}>{catName(entry.category)}</span>}
              {entry.recurrence!=="none"&&<span style={{...S.tag,color:entry.isDivida?"#f87171":"#8ab4f8",borderColor:entry.isDivida?"#f8717144":"#1a3a6e",background:entry.isDivida?"rgba(248,113,113,.12)":"#0d1a2e"}}>{entry.recurLabel}</span>}
              <span style={{fontSize:10,color:"#334"}}>{fmtDate(entry.date)}</span>
            </div>
            {badge&&<div style={{display:"inline-block",marginTop:4,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:4,background:badge.bg,color:badge.color}}>{badge.text}</div>}
            {entry.notes&&<div style={{fontSize:10,color:"#556",marginTop:3,fontStyle:"italic"}}>💬 {entry.notes}</div>}
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

      {/* Toast container */}
      <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,display:"flex",flexDirection:"column",gap:6,alignItems:"center",pointerEvents:"none",width:"90%",maxWidth:360}}>
        {toasts.map(t=>(
          <div key={t.id} className="toast-in"
            style={{background:t.type==="error"?"#2a0d0d":t.type==="celebrate"?"#0d2a1a":"#0d1a2e",border:`1px solid ${t.type==="error"?"#f8717144":t.type==="celebrate"?"#4ade8044":"#1a3a6e44"}`,color:t.type==="error"?"#f87171":t.type==="celebrate"?"#4ade80":"#8ab4f8",padding:"9px 16px",borderRadius:10,fontSize:12,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,.5)",whiteSpace:"nowrap"}}>
            {t.msg}
          </div>
        ))}
      </div>

      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={{fontSize:22}}>💰</span>
          <div><div style={S.appName}>Minhas Finanças</div><div style={S.appSub}>Controle seus lançamentos</div></div>
        </div>
        {/* Health indicator in header */}
        {healthScore&&activeTab==="lancamentos"&&(
          <div style={{display:"flex",alignItems:"center",gap:5,background:"#0d1118",border:`1px solid ${healthScore.color}33`,borderRadius:8,padding:"5px 10px"}}>
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
            <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{MNAMES[+selMonth.split("-")[1]-1]}</div>
            <div style={{fontSize:13,color:"#556",fontWeight:500,marginTop:-1}}>{selMonth.split("-")[0]}</div>
            {selMonth===NOW&&<div style={{fontSize:9,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:1}}>Mês atual</div>}
          </div>
          <button className="arrowBtn" onClick={()=>setSelMonth(p=>addM(p,1))} style={S.arrowBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Hero saldo */}
        <div style={{padding:"10px 14px 6px"}}>
          <div style={S.heroCard}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:10,background:"rgba(74,222,128,.18)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <span style={{fontSize:14,color:"rgba(255,255,255,.6)",fontWeight:500}}>Saldo do mês</span>
            </div>
            <div style={{fontSize:36,fontWeight:800,color:"#fff",letterSpacing:"-1px",lineHeight:1}}>{fmt(saldo)}</div>
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
              {accumSaldo!==null&&<div><span style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>Saldo acumulado </span><span style={{fontSize:12,fontWeight:700,color:(saldo+accumSaldo)>=0?"#4ade80":"#f87171"}}>{fmt(saldo+accumSaldo)}</span></div>}
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
            <div style={{background:"#0d1118",border:`1px solid ${healthScore.color}22`,borderRadius:14,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:healthScore.color}}>💊 Saúde Financeira — {healthScore.level}</div>
                <div style={{fontSize:16,fontWeight:800,color:healthScore.color}}>{healthScore.score}<span style={{fontSize:10,fontWeight:400,color:"#445"}}>/100</span></div>
              </div>
              <div style={{height:5,background:"#080c12",borderRadius:3,marginBottom:10,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${healthScore.score}%`,background:`linear-gradient(90deg,${healthScore.color}88,${healthScore.color})`,borderRadius:3,transition:"width .6s"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div style={{background:"#080c12",borderRadius:8,padding:"7px 10px",border:"1px solid #0f1825"}}>
                  <div style={{fontSize:9,color:"#445",marginBottom:2}}>Gastos fixos / Renda</div>
                  <div style={{fontSize:13,fontWeight:700,color:healthScore.fixedPct>70?"#f87171":healthScore.fixedPct>50?"#facc15":"#4ade80"}}>{healthScore.fixedPct.toFixed(0)}%</div>
                </div>
                <div style={{background:"#080c12",borderRadius:8,padding:"7px 10px",border:"1px solid #0f1825"}}>
                  <div style={{fontSize:9,color:"#445",marginBottom:2}}>Taxa de economia</div>
                  <div style={{fontSize:13,fontWeight:700,color:healthScore.savingPct<10?"#f87171":healthScore.savingPct<20?"#facc15":"#4ade80"}}>{healthScore.savingPct.toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {recentTx.length>0&&(
          <div style={{padding:"0 14px 10px"}}>
            <div style={{fontSize:10,color:"#445",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Movimentações recentes</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {recentTx.map(e=>(
                <div key={`recent_${e.id}_${e._month}`} style={{display:"flex",alignItems:"center",gap:9,background:"#0d1118",border:"1px solid #111820",borderRadius:10,padding:"8px 12px"}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:e.isFatura?e.cardColor:catColor(e.category),flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#dde",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                    <div style={{fontSize:10,color:"#334"}}>{fmtDate(e.date)} · {mLabel(e._month)}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":e.isDivida?"#f87171":e.isFatura?e.cardColor:"#dde",flexShrink:0}}>
                    {e.type==="receita"?"+":"-"}{fmt(eVal(e))}
                  </div>
                  <div style={{...S.badge,background:e.statusForMonth==="pago"?"rgba(74,222,128,.12)":"rgba(251,146,60,.12)",color:e.statusForMonth==="pago"?"#4ade80":"#fb923c",padding:"2px 6px"}}>
                    {e.statusForMonth==="pago"?"pago":"pendente"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + controls — always visible */}
        <div style={{padding:"0 14px 8px",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{position:"relative"}}>
            <svg style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#445" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{...S.inp,paddingLeft:30,fontSize:12}} placeholder="Buscar por descrição ou observação..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#445",cursor:"pointer",fontSize:14}}>✕</button>}
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
        </div>

        {/* List */}
        <div style={S.list}>
          {filtered.length===0&&(
            <div style={S.empty}>
              <div style={{fontSize:36,opacity:0.3,marginBottom:8}}>💸</div>
              <div style={{color:"#334",fontSize:14,fontWeight:600}}>{search?"Nenhum resultado":"Nenhum lançamento"}</div>
              <div style={{color:"#223",fontSize:12,marginTop:3}}>{search?"Tente outro termo":"Use os cards + acima para adicionar"}</div>
            </div>
          )}
          {grouped
            ?grouped.map(([catId,{items,total}])=>(
              <div key={catId} style={{marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0 5px",borderBottom:"1px solid #0f1825",marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:catColor(catId)}}/>
                  <div style={{fontSize:11,fontWeight:700,color:catColor(catId),textTransform:"uppercase",letterSpacing:"0.06em",flex:1}}>{catName(catId)}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#8ab4f8"}}>{fmt(total)}</div>
                </div>
                {items.map(renderCard)}
              </div>
            ))
            :filtered.map(renderCard)
          }
        </div>
      </>)}

      {activeTab==="graficos"&&<ChartScreen entries={entries} dividas={dividas} categories={categories} nowMonth={NOW} cards={cards} cardPurchases={cardPurchases} cardFaturas={cardFaturas}/>}
      {activeTab==="cartoes"&&<CartaoScreen cards={cards} setCards={saveCards} cardPurchases={cardPurchases} setCardPurchases={saveCardPurchases} cardFaturas={cardFaturas} setCardFaturas={saveCardFaturas} categories={categories} nowMonth={NOW} toast={toast}/>}
      {activeTab==="dividas"&&<DividasScreen dividas={dividas} setDividas={saveDividas} categories={categories} setCategories={saveCategories} nowMonth={NOW} toast={toast}/>}
      {activeTab==="perfil"&&<ProfileScreen entries={entries} dividas={dividas} selMonth={selMonth} onExportMonth={()=>handleExportCSV(selMonth)} onExportAll={()=>handleExportCSV(null)} onReset={()=>{saveEntries([]);saveDividas([]);saveCards([]);saveCardPurchases([]);saveCardFaturas({});toast("Dados zerados","info");}} notifPerm={notifPerm} notifSettings={notifSettings} onNotifSettings={saveNotifSettings} onRequestPerm={async()=>{const r=await requestNotifPermission();setNotifPerm(r);}} onTestNotif={()=>checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,notifSettings)} onBackup={handleBackup} onRestore={handleRestore}/>}

      <nav style={S.bottomNav}>
        {[
          ["lancamentos","Contas",<svg key="l" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>],
          ["graficos","Análise",<svg key="g" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>],
          ["cartoes","Cartões",<svg key="c" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>],
          ["dividas","Dívidas",<svg key="d" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>],
          ["perfil","Perfil",<svg key="p" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
        ].map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>setActiveTab(tab)} className="navBtn" style={{...S.navBtn,...(activeTab===tab?S.navBtnActive:{})}}>
            <span style={{opacity:activeTab===tab?1:0.45,color:activeTab===tab?"#8ab4f8":"#556",transition:"all .2s"}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:activeTab===tab?700:500,color:activeTab===tab?"#8ab4f8":"#334",marginTop:2}}>{label}</span>
          </button>
        ))}
      </nav>

      {showForm&&<FormModal form={form} setForm={setForm} lockedType={formType} categories={categories} entries={entries} onUpdateCats={saveCategories} onAdd={handleAdd} onClose={()=>{setShowForm(false);setForm(BLANK());}}/>}
      {editTarget&&<EditModal entry={editTarget.entry} monthKey={editTarget.monthKey} categories={categories} entries={entries} onUpdateCats={saveCategories} onSave={handleSaveEdit} onClose={()=>setEditTarget(null)}/>}
      {delTarget&&<DeleteModal entry={delTarget} onDelete={handleDelete} onClose={()=>setDelTarget(null)}/>}
      {fatPayTarget&&<FaturaPayModal entry={fatPayTarget} onPay={handlePayFatura} onClose={()=>setFatPayTarget(null)}/>}
    </div>
  );
}

// ─── Fatura Pay Modal ─────────────────────────────────────────
function FaturaPayModal({entry,onPay,onClose}){
  const [payType,setPayType]=useState("total");
  const [partialAmt,setPartialAmt]=useState(String(entry.amount));
  const isPartial=payType==="partial";
  return(
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
        <div style={S.mHeader}><div><div style={S.mTitle}>Pagar Fatura</div><div style={{fontSize:11,color:entry.cardColor,marginTop:2}}>💳 {entry.cardName}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <div style={{background:"#080c12",border:"1px solid #111820",borderRadius:11,padding:"12px 14px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:11,color:"#445",marginBottom:4}}>Total da fatura</div>
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
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"#111820",border:"1px solid #1a2840",borderRadius:10,color:"#556",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
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
        <div style={{fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Período de análise</div>
        <div style={{display:"flex",gap:6,marginBottom:12,position:"relative"}}>
          <button onClick={()=>{setMode("mes");setShowPicker(p=>!p);}} className="fTab"
            style={{...S.fTab,flex:1,justifyContent:"center",gap:5,...(mode==="mes"?S.fTabActive:{})}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {mLabel(specMonth)}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button onClick={()=>{setMode("periodo");setShowPicker(false);}} className="fTab"
            style={{...S.fTab,flex:1,justifyContent:"center",...(mode==="periodo"?S.fTabActive:{})}}>Período</button>
          {showPicker&&mode==="mes"&&(
            <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,width:"calc(50% - 3px)",background:"#0d1118",border:"1px solid #1a3a6e",borderRadius:12,zIndex:20,overflow:"hidden",maxHeight:220,overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
              {Array.from({length:24},(_,i)=>addM(nowMonth,i-12)).map(m=>(
                <button key={m} onClick={()=>{setSpecMonth(m);setShowPicker(false);}}
                  style={{width:"100%",padding:"9px 14px",background:m===specMonth?"#1a3a6e44":"transparent",border:"none",color:m===specMonth?"#8ab4f8":"#ccd",fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderBottom:"1px solid #0f1825",fontWeight:m===specMonth?700:400}}>
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
        <div style={{background:"#0d1118",border:"1px solid #111820",borderRadius:11,padding:"10px 12px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>📉</span>
          <div><div style={{fontSize:10,color:"#445",marginBottom:2}}>Mês com maior gasto</div><div style={{fontSize:12,fontWeight:700,color:"#fb923c"}}>{mLabel(insights.maxDepM)} · {fmt(insights.maxDep)}</div></div>
        </div>
        {insights.topCat&&<div style={{background:"#0d1118",border:"1px solid #111820",borderRadius:11,padding:"10px 12px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>🏆</span>
          <div><div style={{fontSize:10,color:"#445",marginBottom:2}}>Maior {catView==="despesa"?"gasto":"receita"} por categoria</div><div style={{fontSize:12,fontWeight:700,color:insights.topCat.color}}>{insights.topCat.name} · {fmt(insights.topCat.value)}</div></div>
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
            ?<div style={{textAlign:"center",padding:"40px 0",color:"#334",fontSize:13}}>Sem dados no período</div>
            :(<>
              <DonutSVG data={catData} total={totals[catView==="despesa"?"dep":"rec"]}/>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                {catData.map((c,i)=>{
                  const tot=totals[catView==="despesa"?"dep":"rec"];
                  const pct=tot>0?((c.value/tot)*100).toFixed(1):0;
                  return(<div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                    <div style={{flex:1,fontSize:12,color:"#ccd",fontWeight:500}}>{c.name}</div>
                    <div style={{fontSize:11,color:"#556"}}>{pct}%</div>
                    <div style={{fontSize:12,color:c.color,fontWeight:700,minWidth:72,textAlign:"right"}}>{fmt(c.value)}</div>
                  </div>);
                })}
              </div>
            </>)
          }
        </div>)}

        {chartType==="projecao"&&(<div style={S.chartBox}>
          <div style={S.chartTitle}>Projeção — Próximos 6 meses</div>
          <div style={{fontSize:10,color:"#445",marginBottom:12}}>Inclui fixos, parcelados, dívidas e faturas de cartão</div>
          <BarSVG data={projData} type="barras" faded/>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:14}}>
            {projData.map((d,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#080c12",borderRadius:8,padding:"7px 10px",border:"1px solid #0f1825"}}>
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
function CartaoScreen({cards,setCards,cardPurchases,setCardPurchases,cardFaturas,setCardFaturas,categories,nowMonth,toast}){
  const [showCardForm,setShowCardForm]=useState(false);
  const [showPurchaseForm,setShowPurchaseForm]=useState(false);
  const [activeCardId,setActiveCardId]=useState(null);
  const [delCardId,setDelCardId]=useState(null);
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

  return(
    <div style={{paddingBottom:90}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid #0d1520"}}>
        <div><div style={{fontSize:14,fontWeight:700,color:"#dde"}}>Meus Cartões</div><div style={{fontSize:10,color:"#445",marginTop:1}}>{cards.length} cartão{cards.length!==1?"ões":""} cadastrado{cards.length!==1?"s":""}</div></div>
        <button onClick={()=>{setCardForm(BLANK_CARD);setShowCardForm(true);}} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:12}}>+ Novo Cartão</button>
      </div>

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:14}}>
        {cards.length===0&&<div style={S.empty}><div style={{fontSize:36,opacity:0.3,marginBottom:8}}>💳</div><div style={{color:"#334",fontSize:14,fontWeight:600}}>Nenhum cartão cadastrado</div><div style={{color:"#223",fontSize:12,marginTop:3}}>Adicione um cartão para controlar suas faturas</div></div>}

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
            <div key={card.id} style={{background:"#0d1118",borderRadius:18,overflow:"hidden",border:`1px solid ${card.color}22`}}>
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
                    <span style={{fontSize:9,color:"#445"}}>Usado: {fmt(usedLimit)}</span>
                    <span style={{fontSize:9,color:"#445"}}>Disponível: {fmt(Math.max(0,card.limit-usedLimit))}</span>
                  </div>
                </div>)}
              </div>

              <div style={{padding:"12px 14px",borderBottom:"1px solid #111820"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#dde"}}>Fatura em aberto — {mLabel(nowMonth)}</div>
                    <div style={{fontSize:10,color:"#445",marginTop:1}}>
                      {daysToClose!==null&&daysToClose>=0
                        ?<span style={{color:"#facc15"}}>⏱ Fecha em {daysToClose}d ({fmtDate(closeDateThisMonth)})</span>
                        :<span style={{color:"#f87171"}}>🔒 Fatura fechada</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:800,color:card.color}}>{fmt(openFat.total)}</div>
                    <div style={{fontSize:9,color:"#445"}}>{openFat.items.length} compra{openFat.items.length!==1?"s":""}</div>
                  </div>
                </div>
                {openFat.items.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {openFat.items.map(item=>(
                      <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,background:"#080c12",borderRadius:8,padding:"7px 10px",border:"1px solid #0f1825"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"#ccd",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.description}</div>
                          {item.total>1&&<div style={{fontSize:9,color:"#445"}}>{item.installmentNum}/{item.total}x</div>}
                        </div>
                        <div style={{fontSize:12,fontWeight:700,color:card.color}}>{fmt(item.amount)}</div>
                        <button className="iconBtn" onClick={()=>setCardPurchases(cardPurchases.filter(p=>p.id!==item.id))}
                          style={{...S.iconBtn,background:"rgba(239,68,68,.08)",color:"#f8717188",width:20,height:20,borderRadius:5,fontSize:10}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {openFat.items.length===0&&<div style={{textAlign:"center",padding:"10px 0",color:"#334",fontSize:11}}>Nenhuma compra nesta fatura</div>}
              </div>

              {pastFaturas.length>0&&(
                <div style={{padding:"10px 14px"}}>
                  <div style={{fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Faturas anteriores</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {pastFaturas.map(bm=>{
                      const fat=buildFatura(card,cardPurchases,cardFaturas,bm);
                      if(fat.total<=0) return null;
                      return(
                        <div key={bm} style={{display:"flex",alignItems:"center",gap:10,background:"#080c12",borderRadius:9,padding:"8px 12px",border:"1px solid #0f1825"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,color:"#ccd",fontWeight:600}}>{mLabel(bm)}</div>
                            <div style={{fontSize:10,color:"#445"}}>Venceu {fmtDate(fat.dueDate)}{fat.partial?` · Parcial: ${fmt(fat.paidAmount)}`:""}</div>
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:fat.paid?"#4ade80":card.color}}>{fmt(fat.total)}</div>
                          <div style={{...S.badge,background:fat.paid?"rgba(74,222,128,.15)":"rgba(251,146,60,.12)",color:fat.paid?"#4ade80":"#fb923c",padding:"4px 8px",fontSize:9}}>
                            {fat.paid?"✓ pago":"pendente"}
                          </div>
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
              <div style={{fontSize:13,fontWeight:700,color:"#dde",marginBottom:2}}>{cards.find(c=>c.id===delCardId)?.name}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove o cartão e todas as compras e faturas associadas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelCardId(null)} style={{flex:1,padding:"11px",background:"#111820",border:"1px solid #1a2840",borderRadius:10,color:"#556",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
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
              <div style={{marginBottom:13,background:"#080c12",border:`1px solid ${activeCard.color}33`,borderRadius:10,padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:"#556"}}>{purchForm.installments}x de</span>
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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid #0d1520"}}>
        <div><div style={{fontSize:14,fontWeight:700,color:"#dde"}}>Minhas Dívidas</div><div style={{fontSize:10,color:"#445",marginTop:1}}>{dividas.length} dívida{dividas.length!==1?"s":""} cadastrada{dividas.length!==1?"s":""}</div></div>
        <button onClick={()=>{setDform(BLANK_D);setEditId(null);setShowForm(true);}} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:12}}>+ Nova Dívida</button>
      </div>

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {dividas.length===0&&<div style={S.empty}><div style={{fontSize:36,opacity:0.3,marginBottom:8}}>💳</div><div style={{color:"#334",fontSize:14,fontWeight:600}}>Nenhuma dívida cadastrada</div></div>}

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
            <div key={d.id} style={{background:"#0d1118",border:`1px solid ${isCelebrating?"#4ade8055":"#111820"}`,borderRadius:14,overflow:"hidden",transition:"border-color .5s"}}>
              {isCelebrating&&(
                <div style={{background:"linear-gradient(90deg,#0a2a1a,#0d3520,#0a2a1a)",padding:"10px 14px",textAlign:"center",animation:"celebrate 1s ease"}}>
                  <div style={{fontSize:20}}>🎉 🎊 ✨</div>
                  <div style={{fontSize:12,color:"#4ade80",fontWeight:700,marginTop:2}}>Dívida quitada! Parabéns!</div>
                </div>
              )}
              <div style={{padding:"13px 14px 10px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#dde",marginBottom:3}}>{d.name}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{...S.tag,color:catColor(d.category),borderColor:catColor(d.category)+"44",background:catColor(d.category)+"18"}}>{catName(d.category)}</span>
                      <span style={{...S.tag,color:"#f87171",borderColor:"#f8717144",background:"rgba(248,113,113,.1)"}}>💳 {paid}/{d.installments} parcelas</span>
                      <span style={{fontSize:10,color:"#334"}}>até {mLabel(endMonth)}</span>
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
                    <span style={{fontSize:11,color:"#556"}}>Progresso de quitação</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>{pct}%</span>
                  </div>
                  <div style={{height:8,background:"#080c12",borderRadius:4,overflow:"hidden",border:"1px solid #111820"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#f87171,#fb923c)",borderRadius:4,transition:"width .6s"}}/>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div style={{background:"#080c12",borderRadius:8,padding:"7px 8px",border:"1px solid #0f1825"}}><div style={{fontSize:9,color:"#445",marginBottom:2}}>Total</div><div style={{fontSize:11,fontWeight:700,color:"#dde"}}>{fmt(d.totalAmount)}</div></div>
                  <div style={{background:"#080c12",borderRadius:8,padding:"7px 8px",border:"1px solid #0f1825"}}><div style={{fontSize:9,color:"#445",marginBottom:2}}>Parcela</div><div style={{fontSize:11,fontWeight:700,color:"#f87171"}}>{fmt(instVal)}</div></div>
                  <div style={{background:"#080c12",borderRadius:8,padding:"7px 8px",border:"1px solid #0f1825"}}><div style={{fontSize:9,color:"#445",marginBottom:2}}>Restante</div><div style={{fontSize:11,fontWeight:700,color:"#facc15"}}>{fmt(remaining)}</div></div>
                </div>

                {isCurrent&&(
                  <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",background:isPaidThisMonth?"rgba(74,222,128,.07)":"rgba(251,146,60,.07)",borderRadius:9,padding:"9px 12px",border:`1px solid ${isPaidThisMonth?"#4ade8022":"#fb923c22"}`}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:"#ccd"}}>Parcela de {mLabel(NOW)}</div>
                      <div style={{fontSize:10,color:"#556"}}>{currentDiff+1}/{d.installments} · {fmt(instVal)}</div>
                    </div>
                    <button onClick={()=>toggleMonth(d,NOW)} className="statusToggleBtn"
                      style={{...S.badge,background:isPaidThisMonth?"rgba(74,222,128,.15)":"rgba(251,146,60,.15)",color:isPaidThisMonth?"#4ade80":"#fb923c",border:`1px solid ${isPaidThisMonth?"#4ade8033":"#fb923c33"}`,cursor:"pointer",padding:"5px 10px",fontSize:10}}>
                      {isPaidThisMonth?"✓ pago":"⏳ a pagar"}
                    </button>
                  </div>
                )}
              </div>

              <div style={{background:"#080c12",borderTop:"1px solid #111820",padding:"8px 14px",display:"flex",gap:4,overflowX:"auto"}} className="hscroll">
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
            <div style={{fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,paddingLeft:2}}>✅ Quitadas</div>
            {quitadas.map(d=>(
              <div key={d.id} style={{background:"#0d1118",border:"1px solid #111820",borderRadius:12,padding:"12px 14px",opacity:0.6,display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#ccd"}}>{d.name}</div>
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
              <div style={{fontSize:13,fontWeight:700,color:"#dde",marginBottom:2}}>{dividas.find(d=>d.id===delId)?.name}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove a dívida e todas as parcelas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelId(null)} style={{flex:1,padding:"11px",background:"#111820",border:"1px solid #1a2840",borderRadius:10,color:"#556",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
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
              <div style={{marginBottom:13,background:"#080c12",border:"1px solid #f8717133",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"#556"}}>{dform.installments}x de</span>
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
function ProfileScreen({entries,dividas,selMonth,onExportMonth,onExportAll,onReset,notifPerm,notifSettings,onNotifSettings,onRequestPerm,onTestNotif,onBackup,onRestore}){
  const [confirmReset,setConfirmReset]=useState(false);
  const permColor=notifPerm==="granted"?"#4ade80":notifPerm==="denied"?"#f87171":"#facc15";
  const permLabel=notifPerm==="granted"?"Ativadas":notifPerm==="denied"?"Bloqueadas pelo browser":notifPerm==="unsupported"?"Não suportado":"Não permitidas";
  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 16px 20px",borderBottom:"1px solid #0f1825"}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"2px solid #1a3a6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:12}}>👤</div>
        <div style={{fontSize:15,fontWeight:700,color:"#dde",marginBottom:3}}>Usuário</div>
        <div style={{fontSize:11,color:"#445"}}>{entries.length} lançamentos · {(dividas||[]).length} dívidas</div>
      </div>
      <div style={{padding:"16px 14px",display:"flex",flexDirection:"column",gap:12}}>
        <ProfileSection title="Conta">
          <ProfileItem icon="👤" label="Criar conta" sub="Sincronize seus dados na nuvem" badge="Em breve" disabled/>
          <ProfileItem icon="🔑" label="Entrar" sub="Acesse sua conta existente" badge="Em breve" disabled last/>
        </ProfileSection>

        <ProfileSection title="Notificações">
          <div style={{padding:"13px 14px",borderBottom:"1px solid #0f1825"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#dde"}}>🔔 Alertas de vencimento</div><div style={{fontSize:11,color:permColor,marginTop:2}}>{permLabel}</div></div>
              {notifPerm==="granted"
                ?<Toggle checked={notifSettings.enabled} onChange={v=>onNotifSettings({...notifSettings,enabled:v})}/>
                :notifPerm!=="unsupported"&&<button onClick={onRequestPerm} style={{padding:"6px 12px",background:"#1a3a6e",border:"1px solid #2a4a8e",borderRadius:8,color:"#8ab4f8",fontSize:11,fontWeight:700,cursor:"pointer"}}>Permitir</button>}
            </div>
            {notifPerm==="granted"&&notifSettings.enabled&&(<>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:"#445",marginBottom:5}}>Avisar com quantos dias de antecedência</div>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3,5,7].map(d=>(
                    <button key={d} onClick={()=>onNotifSettings({...notifSettings,daysBefore:d})}
                      style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${notifSettings.daysBefore===d?"#8ab4f8":"#111820"}`,background:notifSettings.daysBefore===d?"#0d1a2e":"transparent",color:notifSettings.daysBefore===d?"#8ab4f8":"#445",fontSize:12,fontWeight:700,cursor:"pointer"}}>{d}d</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div><div style={{fontSize:12,color:"#dde",fontWeight:600}}>Alertar contas vencidas</div><div style={{fontSize:10,color:"#445"}}>Notificar sobre pagamentos atrasados</div></div>
                <Toggle checked={notifSettings.overdueAlert} onChange={v=>onNotifSettings({...notifSettings,overdueAlert:v})}/>
              </div>
              <button onClick={onTestNotif} style={{width:"100%",padding:"9px",background:"rgba(138,180,248,.1)",border:"1px solid #1a3a6e44",borderRadius:9,color:"#8ab4f8",fontSize:12,fontWeight:600,cursor:"pointer"}}>🔔 Verificar agora</button>
            </>)}
          </div>
          <ProfileItem icon="📅" label="Verificar ao abrir" sub="Checa vencimentos uma vez por dia" last/>
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
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#dde"}}>Restaurar backup</div><div style={{fontSize:11,color:"#445",marginTop:1}}>Importa dados de um arquivo JSON</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              <input type="file" accept=".json" onChange={onRestore} style={{display:"none"}}/>
            </label>
          </div>
        </ProfileSection>

        <ProfileSection title="Dados">
          <ProfileItem icon="🗑️" label="Zerar todos os dados" sub="Remove todos os lançamentos e dívidas" onClick={()=>setConfirmReset(true)} danger last/>
        </ProfileSection>

        <ProfileSection title="Sobre">
          <ProfileItem icon="📱" label="Meu Financeiro" sub="Versão 1.1.0"/>
          <ProfileItem icon="🔧" label="Desenvolvido com" sub="React · SVG Charts · Claude" last/>
        </ProfileSection>
      </div>

      {confirmReset&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setConfirmReset(false)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Zerar dados</div><button style={S.xBtn} onClick={()=>setConfirmReset(false)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"14px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>⚠️</div>
              <div style={{fontSize:13,fontWeight:700,color:"#dde",marginBottom:6}}>Tem certeza?</div>
              <div style={{fontSize:12,color:"#f87171",lineHeight:1.5}}>Isso removerá {entries.length} lançamento{entries.length!==1?"s":""} e {(dividas||[]).length} dívida{(dividas||[]).length!==1?"s":""} permanentemente.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmReset(false)} style={{flex:1,padding:"12px",background:"#111820",border:"1px solid #1a2840",borderRadius:10,color:"#556",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>{onReset();setConfirmReset(false);}} style={{flex:1,padding:"12px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Sim, zerar tudo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function ProfileSection({title,children}){return(<div><div style={{fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,paddingLeft:2}}>{title}</div><div style={{background:"#0d1118",border:"1px solid #111820",borderRadius:13,overflow:"hidden"}}>{children}</div></div>);}
function ProfileItem({icon,label,sub,badge,onClick,danger,disabled,last}){return(<button onClick={!disabled&&onClick?onClick:undefined} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"transparent",border:"none",borderBottom:last?"none":"1px solid #0f1825",cursor:disabled||!onClick?"default":"pointer",textAlign:"left",fontFamily:"inherit",opacity:disabled?0.45:1}}><span style={{fontSize:18,flexShrink:0}}>{icon}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:danger?"#f87171":"#dde"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"#445",marginTop:1}}>{sub}</div>}</div>{badge&&<span style={{fontSize:9,color:"#8ab4f8",background:"#0d1a2e",border:"1px solid #1a3a6e",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{badge}</span>}{!badge&&onClick&&!disabled&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>}</button>);}
function Toggle({checked,onChange,disabled}){return(<button onClick={()=>!disabled&&onChange(!checked)} style={{width:44,height:24,borderRadius:12,background:checked?"#1a3a6e":"#111820",border:`1.5px solid ${checked?"#8ab4f8":"#1a2840"}`,cursor:disabled?"default":"pointer",position:"relative",transition:"all .2s",flexShrink:0}}><div style={{width:18,height:18,borderRadius:"50%",background:checked?"#8ab4f8":"#334",position:"absolute",top:"50%",transform:`translateY(-50%) translateX(${checked?20:2}px)`,transition:"all .2s"}}/></button>);}

// ─── Form Modal ───────────────────────────────────────────────
function FormModal({form,setForm,lockedType,categories,entries,onUpdateCats,onAdd,onClose}){
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const [editCats,setEditCats]=useState(false);
  const [addingCat,setAddingCat]=useState(false);
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
        <Field label="Descrição">
          <input style={S.inp} placeholder={type==="receita"?"Ex: Salário, VA, VR...":"Ex: Conta de luz, Aluguel..."} value={form.description} onChange={e=>set("description",e.target.value)}/>
          {type==="receita"&&(<div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:7}}>{["Salário","VA","VR","Freelance","13º Salário","Férias","PLR","Bônus","Dividendos","Aluguel recebido"].map(s=>(<button key={s} onClick={()=>set("description",s)} style={{padding:"4px 9px",background:form.description===s?"#4ade8020":"rgba(255,255,255,0.04)",border:`1px solid ${form.description===s?"#4ade8055":"#111820"}`,borderRadius:6,color:form.description===s?"#4ade80":"#556",fontSize:11,cursor:"pointer",fontWeight:500}}>{s}</button>))}</div>)}
        </Field>
        <div style={{display:"flex",gap:10}}>
          <Field label="Valor (R$)" style={{flex:1}}><input style={S.inp} type="number" placeholder="0,00" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)}/></Field>
          <Field label="Vencimento" style={{flex:1}}><input style={S.inp} type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></Field>
        </div>
        <Field label="Recorrência">
          <div style={{display:"flex",gap:6}}>{[["none","Único"],["fixed","Fixo 🔄"],["installment","Parcelado 📋"]].map(([r,l])=>(<button key={r} onClick={()=>set("recurrence",r)} style={{...S.chipBtn,...(form.recurrence===r?S.chipActive:{})}}>{l}</button>))}</div>
          {form.recurrence==="installment"&&(<div style={{marginTop:10}}><label style={{...S.lbl,marginBottom:5}}>Nº de parcelas</label><input style={{...S.inp,width:90}} type="number" min={2} max={60} value={form.installments} onChange={e=>set("installments",e.target.value)}/>{form.amount&&form.installments>1&&(<div style={{marginTop:8,background:"#080c12",border:"1px solid #1a3a6e44",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:"#556"}}>Total</span><span style={{fontSize:12,fontWeight:700,color:"#8ab4f8"}}>{fmt(parseFloat(form.amount))}</span><span style={{fontSize:11,color:"#334"}}>→</span><span style={{fontSize:11,color:"#556"}}>{form.installments}x de</span><span style={{fontSize:14,fontWeight:700,color:"#4ade80"}}>{fmt(parseFloat(form.amount)/parseInt(form.installments))}</span></div>)}</div>)}
          {form.recurrence==="fixed"&&<div style={{marginTop:8,fontSize:11,color:"#556",background:"#080c12",borderRadius:8,padding:"8px 10px",border:"1px solid #111820"}}>💡 Aparece automaticamente em todos os meses seguintes</div>}
        </Field>
        <CatSelector cats={filteredCats} selected={form.category} onSelect={v=>set("category",v)} editCats={editCats} setEditCats={setEditCats} addingCat={addingCat} setAddingCat={setAddingCat} newName={newName} setNewName={setNewName} newColor={newColor} setNewColor={setNewColor} usedIds={usedIds} onAddCat={addCat} onRemoveCat={removeCat}/>
        <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:52,lineHeight:1.5}} placeholder="Alguma anotação..." value={form.notes} onChange={e=>set("notes",e.target.value)}/></Field>
        <Field label="Status"><div style={{display:"flex",gap:8}}>{(type==="receita"?[["a_pagar","⏳ A Receber","#fb923c"],["pago","✓ Recebido","#4ade80"]]:[["a_pagar","⏳ A Pagar","#fb923c"],["pago","✓ Pago","#4ade80"]]).map(([s,l,c])=>(<button key={s} onClick={()=>set("status",s)} style={{...S.typeBtn,...(form.status===s?{background:c+"20",border:`1px solid ${c}44`,color:c}:{})}}>{l}</button>))}</div></Field>
        <button onClick={onAdd} className="submitBtn"
          style={{...S.submitBtn,opacity:(!form.description||!form.amount)?0.35:1,cursor:(!form.description||!form.amount)?"not-allowed":"pointer",background:type==="receita"?"linear-gradient(135deg,#1a4a2e,#0d2a1a)":"linear-gradient(135deg,#1a3a6e,#0d2247)",borderColor:type==="receita"?"#4ade8033":"#2a4a8e44",color:typeColor}}
          disabled={!form.description||!form.amount}>Adicionar {type==="receita"?"Receita":"Despesa"}</button>
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
        <div style={S.mHeader}><div><div style={S.mTitle}>Editar Lançamento</div><div style={{fontSize:10,color:"#445",marginTop:2}}>{isDespesa?"🔴 Despesa":"🟢 Receita"} · {mLabel(monthKey)}{entry.isRecurring&&<span style={{color:"#8ab4f8",marginLeft:5}}>{entry.recurLabel}</span>}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <Field label="Descrição"><input style={S.inp} value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label={entry.recurrence==="installment"?"Valor da parcela":"Valor (R$)"}><input style={S.inp} type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>{entry.recurrence==="installment"&&<div style={{marginTop:5,fontSize:11,color:"#445"}}>Parcela {entry.installmentNum}/{entry.installments}</div>}</Field>
        <CatSelector cats={filteredCats} selected={category} onSelect={setCategory} editCats={editCats} setEditCats={setEditCats} addingCat={addingCat} setAddingCat={setAddingCat} newName={newName} setNewName={setNewName} newColor={newColor} setNewColor={setNewColor} usedIds={usedIds} onAddCat={addCat} onRemoveCat={removeCat}/>
        <Field label="Observação"><textarea style={{...S.inp,resize:"none",height:52}} placeholder="Alguma anotação..." value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        <Field label="Status"><div style={{display:"flex",gap:8}}>{(isDespesa?[["a_pagar","⏳ A Pagar","#fb923c"],["pago","✓ Pago","#4ade80"]]:[["a_pagar","⏳ A Receber","#fb923c"],["pago","✓ Recebido","#4ade80"]]).map(([s,l,c])=>(<button key={s} onClick={()=>setStatus(s)} style={{...S.typeBtn,...(status===s?{background:c+"20",border:`1px solid ${c}44`,color:c}:{})}}>{l}</button>))}</div></Field>
        {entry.isRecurring?(<div style={{marginTop:4}}><div style={{fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Aplicar em</div><div style={{display:"flex",gap:8}}><button onClick={()=>save("this")} style={{...S.scopeBtn,flex:1,borderColor:"#1a3a6e",color:"#8ab4f8",background:"#0d1a2e"}}><span style={{fontSize:16}}>📅</span><div><div style={{fontWeight:700,fontSize:12}}>Só este mês</div><div style={{fontSize:10,color:"#556",marginTop:1}}>{mLabel(monthKey)}</div></div></button><button onClick={()=>save("future")} style={{...S.scopeBtn,flex:1,borderColor:ac+"44",color:ac,background:ac+"12"}}><span style={{fontSize:16}}>📆</span><div><div style={{fontWeight:700,fontSize:12}}>Este e próximos</div><div style={{fontSize:10,color:"#556",marginTop:1}}>a partir de {mLabel(monthKey)}</div></div></button></div></div>):(<button onClick={()=>save("this")} className="submitBtn" style={{...S.submitBtn,marginTop:4}}>Salvar alterações</button>)}
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────
function DeleteModal({entry,onDelete,onClose}){
  const isRec=entry.isRecurring;
  return(<div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{...S.modal,maxHeight:"auto"}} className="modal-in"><div style={S.mHeader}><div style={S.mTitle}>Excluir lançamento</div><button style={S.xBtn} onClick={onClose}>✕</button></div><div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}><div style={{fontSize:13,fontWeight:700,color:"#dde",marginBottom:2}}>{entry.description}</div><div style={{fontSize:11,color:"#f87171"}}>{isRec?"Lançamento recorrente — escolha o escopo":"Esta ação não pode ser desfeita"}</div></div>{isRec?(<div style={{display:"flex",flexDirection:"column",gap:8}}><button onClick={()=>onDelete(entry.id,"this")} style={{...S.scopeBtn,borderColor:"#1a3a6e",color:"#8ab4f8",background:"#0d1a2e"}}><span style={{fontSize:18}}>📅</span><div><div style={{fontWeight:700,fontSize:12}}>Só este mês</div><div style={{fontSize:10,color:"#556",marginTop:1}}>Os outros meses permanecem</div></div></button><button onClick={()=>onDelete(entry.id,"future")} style={{...S.scopeBtn,borderColor:"#fb923c44",color:"#fb923c",background:"rgba(251,146,60,.08)"}}><span style={{fontSize:18}}>📆</span><div><div style={{fontWeight:700,fontSize:12}}>Este e os próximos</div><div style={{fontSize:10,color:"#556",marginTop:1}}>Meses anteriores permanecem</div></div></button><button onClick={()=>onDelete(entry.id,"all")} style={{...S.scopeBtn,borderColor:"#f8717144",color:"#f87171",background:"rgba(248,113,113,.08)"}}><span style={{fontSize:18}}>🗑️</span><div><div style={{fontWeight:700,fontSize:12}}>Todos os meses</div></div></button></div>):(<div style={{display:"flex",gap:8}}><button onClick={onClose} style={{flex:1,padding:"11px",background:"#111820",border:"1px solid #1a2840",borderRadius:10,color:"#556",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button><button onClick={()=>onDelete(entry.id,"all")} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button></div>)}</div></div>);
}

// ─── Category Selector ────────────────────────────────────────
function CatSelector({cats,selected,onSelect,editCats,setEditCats,addingCat,setAddingCat,newName,setNewName,newColor,setNewColor,usedIds,onAddCat,onRemoveCat}){
  return(<div style={{marginBottom:13}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><label style={S.lbl}>Categoria</label><button onClick={()=>{setEditCats(p=>!p);setAddingCat(false);}} style={{background:editCats?"#1a3a6e44":"transparent",border:`1px solid ${editCats?"#1a3a6e":"#111820"}`,borderRadius:6,padding:"3px 8px",color:editCats?"#8ab4f8":"#445",fontSize:10,cursor:"pointer",fontWeight:600}}>{editCats?"✓ Concluir":"✏ Editar"}</button></div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{cats.map(cat=>(<div key={cat.id} style={{position:"relative",display:"inline-flex"}}><button onClick={()=>!editCats&&onSelect(cat.id)} style={{padding:editCats?"4px 22px 4px 9px":"5px 9px",borderRadius:7,border:`1px solid ${selected===cat.id&&!editCats?cat.color:"transparent"}`,background:selected===cat.id&&!editCats?cat.color+"22":"rgba(255,255,255,.05)",color:selected===cat.id&&!editCats?cat.color:"#667",fontSize:11,cursor:editCats?"default":"pointer",fontWeight:500}}><span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}</button>{editCats&&(usedIds.has(cat.id)?<div style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"#1a2840",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#445" strokeWidth="2.5"><path d="M18 11v-3a6 6 0 00-12 0v3"/><rect x="3" y="11" width="18" height="11" rx="2"/></svg></div>:<button onClick={()=>onRemoveCat(cat.id)} style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>✕</button>)}</div>))}{editCats&&!addingCat&&<button onClick={()=>setAddingCat(true)} style={{padding:"5px 10px",borderRadius:7,border:"1px dashed #1a3a6e",background:"transparent",color:"#8ab4f8",fontSize:11,cursor:"pointer",fontWeight:600}}>+ Nova</button>}</div>{addingCat&&(<div style={{marginTop:10,background:"#080c12",border:"1px solid #1a3a6e44",borderRadius:11,padding:"12px"}}><div style={{fontSize:10,color:"#8ab4f8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Nova categoria</div><div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}><input style={{...S.inp,flex:1}} placeholder="Nome" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAddCat()} autoFocus/><label style={{position:"relative",cursor:"pointer",flexShrink:0}}><div style={{width:36,height:36,borderRadius:9,background:newColor,border:"2px solid #1a2840",boxShadow:`0 0 10px ${newColor}55`}}/><input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{position:"absolute",opacity:0,width:1,height:1}}/></label></div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{PRESET_COLORS.map(c=><button key={c} onClick={()=>setNewColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,border:`2px solid ${newColor===c?"#fff":"transparent"}`,cursor:"pointer",flexShrink:0}}/>)}</div><div style={{display:"flex",gap:6}}><button onClick={onAddCat} disabled={!newName.trim()} style={{...S.submitBtn,flex:1,padding:"9px",fontSize:12,marginTop:0,opacity:!newName.trim()?0.35:1}}>✓ Adicionar</button><button onClick={()=>{setAddingCat(false);setNewName("");}} style={{padding:"9px 14px",background:"#111820",border:"1px solid #1a2840",borderRadius:9,color:"#556",fontSize:12,cursor:"pointer"}}>Cancelar</button></div></div>)}</div>);
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
        {yTicks.map((v,i)=>(<g key={i}><line x1={PL} x2={W-PR} y1={toY(v)} y2={toY(v)} stroke="#111820" strokeDasharray="3 3"/><text x={PL-4} y={toY(v)+4} textAnchor="end" fill="#445" fontSize="9">{fmtShort(v)}</text></g>))}
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
        {data.map((d,i)=>(<text key={i} x={PL+(i+0.5)*(cW/data.length)} y={H-6} textAnchor="middle" fill="#445" fontSize="9">{d.month}</text>))}
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
  return(<div style={{background:bg,border:`1px solid ${color}22`,borderRadius:16,padding:"14px 14px",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle at top right, ${color}18, transparent 70%)`,pointerEvents:"none"}}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div style={{width:34,height:34,borderRadius:10,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div>
      {onAdd&&<button onClick={onAdd} className="sumAddBtn" style={{width:26,height:26,borderRadius:7,background:`${color}22`,border:`1px solid ${color}44`,color,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,lineHeight:1}}>+</button>}
    </div>
    <div style={{fontSize:11,color:`${color}99`,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{value}</div>
  </div>);
}
function SumCard({label,value,color,icon,wide,onAdd}){return(<div style={{background:"#0d1118",border:"1px solid #111820",borderRadius:13,padding:"11px 12px",gridColumn:wide?"span 2":"span 1",display:"flex",alignItems:"center",gap:10}}><div style={{width:30,height:30,borderRadius:9,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",color,fontSize:14,fontWeight:700,flexShrink:0}}>{icon}</div><div style={{flex:1}}><div style={{fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{label}</div><div style={{fontSize:15,fontWeight:700,color,letterSpacing:"-0.4px"}}>{value}</div></div>{onAdd&&<button onClick={onAdd} className="sumAddBtn" style={{width:28,height:28,borderRadius:8,background:color+"22",border:`1px solid ${color}44`,color,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0,lineHeight:1}}>+</button>}</div>);}
function Field({label,children,style}){return <div style={{marginBottom:13,...style}}><label style={S.lbl}>{label}</label>{children}</div>;}
function MonthPicker({value,onChange,now}){const opts=Array.from({length:24},(_,i)=>addM(now,i-12));return <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:"#080c12",border:"1px solid #111820",borderRadius:10,padding:"9px 11px",color:"#ccd",fontSize:13,outline:"none",fontFamily:"inherit",appearance:"none"}}>{opts.map(m=><option key={m} value={m}>{mLabel(m)}{m===now?" (atual)":""}</option>)}</select>;}
function Leg({color,label,dashed}){return <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:2,borderTop:dashed?`2px dashed ${color}`:`2px solid ${color}`}}/><span style={{fontSize:10,color:"#445"}}>{label}</span></div>;}

// ─── Styles ──────────────────────────────────────────────────
const S={
  root:       {minHeight:"100vh",background:"var(--bg, #080c12)",color:"var(--text1, #fff)",fontFamily:"'DM Sans',sans-serif",paddingBottom:72},
  header:     {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 8px",borderBottom:"1px solid #0d1520"},
  headerLeft: {display:"flex",alignItems:"center",gap:12},
  appName:    {fontSize:20,fontWeight:800,color:"var(--text1, #fff)",letterSpacing:"-0.5px"},
  appSub:     {fontSize:11,color:"#445",marginTop:1},
  heroCard:   {background:"var(--hero-bg, linear-gradient(135deg,#0a2a1a 0%,#0d1f12 50%,#0a1a10 100%))",border:"1px solid rgba(74,222,128,.2)",borderRadius:20,padding:"20px 20px",position:"relative",overflow:"hidden"},
  arrowBtn:   {width:42,height:42,borderRadius:13,background:"#0d1118",border:"1px solid #111820",display:"flex",alignItems:"center",justifyContent:"center",color:"#556",cursor:"pointer"},
  hbtn:       {display:"flex",alignItems:"center",gap:5,background:"#0d1118",border:"1px solid #111820",color:"#556",padding:"7px 11px",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer"},
  addBtn:     {background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",color:"#8ab4f8"},
  fTab:       {flexShrink:0,display:"flex",alignItems:"center",gap:5,padding:"6px 11px",background:"transparent",border:"1px solid #0f1825",borderRadius:8,color:"#334",fontSize:11,fontWeight:500,cursor:"pointer"},
  fTabActive: {background:"#0d1a2e",border:"1px solid #1a3a6e",color:"#8ab4f8"},
  fCount:     {background:"#0f1825",color:"#334",borderRadius:4,fontSize:10,padding:"1px 5px",fontWeight:700},
  fCountActive:{background:"#1a3a6e44",color:"#8ab4f8"},
  list:       {padding:"0 14px",display:"flex",flexDirection:"column",gap:7},
  card:       {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderRadius:13,padding:"11px 12px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8},
  cardL:      {display:"flex",alignItems:"flex-start",gap:9,flex:1,minWidth:0},
  cardTitle:  {fontSize:13,fontWeight:600,color:"#dde",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  cardMeta:   {display:"flex",gap:4,marginTop:3,alignItems:"center",flexWrap:"wrap"},
  tag:        {fontSize:9,borderRadius:4,padding:"1px 5px",border:"1px solid",fontWeight:600},
  cardR:      {display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0},
  iconBtn:    {width:24,height:24,borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"},
  badge:      {fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",padding:"2px 6px",borderRadius:4},
  empty:      {textAlign:"center",padding:"52px 20px"},
  chartBox:   {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderRadius:14,padding:"14px 12px",marginBottom:12},
  chartTitle: {fontSize:11,fontWeight:700,color:"#8ab4f8",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"},
  bottomNav:  {position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"var(--nav-bg, #080c12)",borderTop:"1px solid var(--border, #0f1825)",display:"flex",zIndex:50},
  navBtn:     {flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px 14px",background:"transparent",border:"none",cursor:"pointer",gap:3},
  navBtnActive:{background:"#0d1118"},
  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(7px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100},
  modal:      {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderTopLeftRadius:20,borderTopRightRadius:20,padding:"20px 18px 36px",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"},
  mHeader:    {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  mTitle:     {fontSize:15,fontWeight:700,color:"#dde"},
  xBtn:       {background:"#111820",border:"none",color:"#445",width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"},
  lbl:        {display:"block",fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6},
  inp:        {width:"100%",background:"var(--inp-bg, #080c12)",border:"1px solid var(--border, #111820)",borderRadius:10,padding:"9px 11px",color:"var(--text2, #ccd)",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
  typeBtn:    {flex:1,padding:"9px",background:"rgba(255,255,255,.04)",border:"1px solid #111820",borderRadius:9,color:"#556",fontSize:12,fontWeight:600,cursor:"pointer"},
  chipBtn:    {flex:1,padding:"7px 6px",background:"transparent",border:"1px solid #111820",borderRadius:8,color:"#445",fontSize:11,fontWeight:500,cursor:"pointer"},
  chipActive: {background:"#0d1a2e",border:"1px solid #1a3a6e",color:"#8ab4f8"},
  submitBtn:  {width:"100%",padding:"12px",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",color:"#8ab4f8",borderRadius:11,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4,fontFamily:"inherit"},
  scopeBtn:   {display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:"1px solid",borderRadius:11,cursor:"pointer",background:"transparent",fontFamily:"inherit",width:"100%",textAlign:"left"},
  selInput:   {background:"var(--card-bg, #0d1118)",border:"1px solid var(--border, #111820)",borderRadius:10,padding:"8px 26px 8px 11px",color:"#ccd",fontSize:12,outline:"none",fontFamily:"inherit",appearance:"none",cursor:"pointer",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23445' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 8px center"},
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
  }

  /* ── Light mode overrides ── */
  .light-mode { --bg:#f0f4f8; --card-bg:#ffffff; --card-bg2:#e8edf3;
    --border:#d0d8e4; --border2:#c8d2e0; --border3:#dde4ee;
    --text1:#1a2332; --text2:#2a3444; --text3:#667788; --text4:#889aaa;
    --inp-bg:#f8fafc; --nav-bg:#ffffff; }

  .light-mode { background: var(--bg); color: var(--text1); }
  .light-mode input, .light-mode select, .light-mode textarea {
    background: var(--inp-bg) !important; color: var(--text1) !important; border-color: var(--border) !important; }
  .light-mode input::placeholder, .light-mode textarea::placeholder { color: var(--text3) !important; }
  .light-mode .eCard { background: var(--card-bg) !important; border-color: var(--border) !important; }
  .light-mode .eCard:hover { border-color: #aabbcc !important; }
  .light-mode .fTab { border-color: var(--border) !important; color: var(--text2) !important; }
  .light-mode .fTab:hover { border-color: #aabbcc !important; color: var(--text1) !important; }
  .light-mode .fTabActive, .light-mode .fTab[style*="background:#0d1a2e"] { background: #e8f0fe !important; border-color: #6699cc !important; color: #1a3a6e !important; }
  .light-mode nav { background: var(--nav-bg) !important; border-top-color: var(--border) !important; box-shadow: 0 -2px 12px rgba(0,0,0,.08) !important; }
  .light-mode .hscroll { background: transparent; }
  .light-mode .modal-in { background: var(--card-bg) !important; }
  select option { background: var(--card-bg); }
`;

// ─── Recent Activity Component ────────────────────────────────
function RecentActivity({ entries, catColor, catName, selMonth }) {
  const recent = [...entries]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,5);
  if (!recent.length) return null;
  return(
    <div style={{padding:"0 14px 8px"}}>
      <div style={{fontSize:9,color:"#445",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Últimas movimentações</div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {recent.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#0d1118",borderRadius:10,padding:"8px 12px",border:"1px solid #111820"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:catColor(e.category),flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"#dde",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
              <div style={{fontSize:9,color:"#445",marginTop:1}}>{catName(e.category)} · {e.date.split("-").reverse().join("/")}</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:e.type==="receita"?"#4ade80":e.isDivida?"#f87171":"#dde",flexShrink:0}}>
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
        <div style={{background:"#080c12",border:`1px solid ${card.color}22`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,color:"#445",marginBottom:2}}>Total da fatura</div>
          <div style={{fontSize:22,fontWeight:800,color:card.color}}>{fmt(fat.total)}</div>
        </div>
        <Field label="Valor que será pago (R$)">
          <input style={S.inp} type="number" min="0" step="0.01" max={fat.total}
            value={amount} onChange={e=>setAmount(e.target.value)}/>
        </Field>
        {val>0&&val<fat.total&&(
          <div style={{marginBottom:14,background:"rgba(250,204,21,.08)",border:"1px solid #facc1533",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:"#facc15",fontWeight:600,marginBottom:3}}>⚠️ Pagamento parcial</div>
            <div style={{fontSize:12,color:"#ccd"}}>Restante <strong style={{color:"#f87171"}}>{fmt(remaining)}</strong> ficará como pendente</div>
          </div>
        )}
        {val>=fat.total&&(
          <div style={{marginBottom:14,background:"rgba(74,222,128,.08)",border:"1px solid #4ade8033",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:12,color:"#4ade80",fontWeight:600}}>✓ Pagamento integral</div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"#111820",border:"1px solid #1a2840",borderRadius:10,color:"#556",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
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
function SaudeScreen({ entries, dividas, cards, cardPurchases, cardFaturas, categories, nowMonth, goals, onSaveGoals }) {
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
      <div style={{padding:"14px 14px 10px",borderBottom:"1px solid #0d1520"}}>
        <div style={{fontSize:14,fontWeight:700,color:"#dde"}}>Saúde Financeira</div>
        <div style={{fontSize:10,color:"#445",marginTop:1}}>{mLabel(nowMonth)}</div>
      </div>

      <div style={{padding:"14px 14px 0",display:"flex",flexDirection:"column",gap:12}}>

        {/* Score */}
        <div style={{background:"linear-gradient(135deg,#0d1118,#111820)",border:`1px solid ${scoreColor}33`,borderRadius:16,padding:"18px 18px",textAlign:"center"}}>
          <div style={{fontSize:11,color:"#445",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Score do mês</div>
          <div style={{position:"relative",width:110,height:110,margin:"0 auto 12px"}}>
            <svg viewBox="0 0 110 110" style={{width:"100%",height:"100%"}}>
              <circle cx="55" cy="55" r="46" fill="none" stroke="#111820" strokeWidth="10"/>
              <circle cx="55" cy="55" r="46" fill="none" stroke={scoreColor} strokeWidth="10"
                strokeDasharray={`${(score/100)*289} 289`}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
                style={{transition:"stroke-dasharray .8s ease"}}/>
              <text x="55" y="52" textAnchor="middle" fill={scoreColor} fontSize="26" fontWeight="800">{score}</text>
              <text x="55" y="68" textAnchor="middle" fill="#445" fontSize="10">pontos</text>
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
        <div style={{background:"#0d1118",border:"1px solid #111820",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8ab4f8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Tendência — 3 meses</div>
          <div style={{display:"flex",gap:6}}>
            {trend.map((t,i)=>(
              <div key={i} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:"#445",marginBottom:6}}>{t.month}</div>
                <div style={{fontSize:11,color:"#4ade80"}}>↑ {fmtShort(t.rec)}</div>
                <div style={{fontSize:11,color:"#fb923c"}}>↓ {fmtShort(t.dep)}</div>
                <div style={{fontSize:12,fontWeight:700,color:t.saldo>=0?"#4ade80":"#f87171",marginTop:2}}>{fmtShort(t.saldo)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top categorias */}
        {catRank.length>0&&(
          <div style={{background:"#0d1118",border:"1px solid #111820",borderRadius:14,padding:"14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8ab4f8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Top Gastos por Categoria</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {catRank.map((c,i)=>(
                <div key={i}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:c.color}}/>
                      <span style={{fontSize:12,color:"#ccd"}}>{c.name}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#445"}}>{dep>0?((c.value/dep)*100).toFixed(0):0}%</span>
                      <span style={{fontSize:12,fontWeight:700,color:c.color}}>{fmt(c.value)}</span>
                    </div>
                  </div>
                  <div style={{height:4,background:"#080c12",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${dep>0?(c.value/dep)*100:0}%`,background:c.color,borderRadius:2,transition:"width .5s"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals CTA */}
        <div style={{background:"rgba(138,180,248,.06)",border:"1px solid #1a3a6e",borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8ab4f8",marginBottom:4}}>🎯 Definir metas</div>
          <div style={{fontSize:11,color:"#445",marginBottom:10}}>Configure suas metas na aba Perfil para um score mais personalizado.</div>
          <div style={{display:"flex",gap:8,fontSize:11}}>
            <div style={{flex:1,background:"#080c12",borderRadius:8,padding:"8px 10px",border:"1px solid #111820"}}>
              <div style={{color:"#445",marginBottom:2}}>Meta renda</div>
              <div style={{color:metaRenda>0?"#8ab4f8":"#334",fontWeight:700}}>{metaRenda>0?fmt(metaRenda):"Não definida"}</div>
            </div>
            <div style={{flex:1,background:"#080c12",borderRadius:8,padding:"8px 10px",border:"1px solid #111820"}}>
              <div style={{color:"#445",marginBottom:2}}>Meta economia</div>
              <div style={{color:goals.savingsPct>0?"#8ab4f8":"#334",fontWeight:700}}>{goals.savingsPct>0?`${goals.savingsPct}% da renda`:"Não definida"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthBar({ label, value, max, color, suffix, detail }) {
  const pct = Math.min(100, max>0?(value/max)*100:0);
  return(
    <div style={{background:"#0d1118",border:"1px solid #111820",borderRadius:11,padding:"11px 13px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:12,color:"#ccd",fontWeight:500}}>{label}</span>
        <span style={{fontSize:13,fontWeight:800,color}}>{value.toFixed(1)}{suffix}</span>
      </div>
      <div style={{height:5,background:"#080c12",borderRadius:3,overflow:"hidden",marginBottom:4}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .6s ease"}}/>
      </div>
      {detail&&<div style={{fontSize:10,color:"#445"}}>{detail}</div>}
    </div>
  );
}
