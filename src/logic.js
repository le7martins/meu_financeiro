import { TODAY, getNow, addM, mDiff, mLabel, daysUntil, eVal } from './utils.js';

// ─── Credit Card Utils ────────────────────────────────────────
export function getBillingMonth(purchaseDate,closeDay) {
  const [y,m,d]=purchaseDate.split("-").map(Number);
  if(d<=closeDay) return `${y}-${String(m).padStart(2,"0")}`;
  const next=new Date(y,m,1);
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}`;
}
export function getFaturaDueDate(billingMonth,dueDay){ const nm=addM(billingMonth,1); return `${nm}-${String(dueDay).padStart(2,"0")}`; }
export function getFaturaCloseDate(billingMonth,closeDay){ return `${billingMonth}-${String(closeDay).padStart(2,"0")}`; }
export function isFaturaOpen(billingMonth,closeDay){ return TODAY<getFaturaCloseDate(billingMonth,closeDay); }
export function getPurchaseInstallmentsForBilling(purchase,targetBillingMonth,closeDay) {
  const baseBilling=getBillingMonth(purchase.purchaseDate,closeDay);
  const diff=mDiff(baseBilling,targetBillingMonth);
  const total=purchase.installments||1;
  if(diff>=0&&diff<total) return {installmentNum:diff+1,total,amount:parseFloat((purchase.amount/total).toFixed(2))};
  return null;
}
export function buildFatura(card,purchases,cardFaturas,billingMonth) {
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
  const open=TODAY<closeDate;
  const paid=payRecord?.paid||false;
  const paidAmount=payRecord?.paidAmount||0;
  const partial=payRecord?.partial||false;
  return {card,billingMonth,items,total:parseFloat(total.toFixed(2)),closeDate,dueDate,open,paid,paidAmount,partial,key};
}
export function getCardBillingMonths(card,purchases) {
  const months=new Set();
  for(const p of (purchases||[])){
    if(p.cardId!==card.id) continue;
    const base=getBillingMonth(p.purchaseDate,card.closeDay);
    for(let i=0;i<(p.installments||1);i++) months.add(addM(base,i));
  }
  return [...months].sort();
}

// ─── Entry computation ───────────────────────────────────────
export function getMonthEntries(entries,dividas,monthKey,cards,cardPurchases,cardFaturas) {
  const res=[];
  for(const e of entries){
    if(e.deletedFrom&&monthKey>=e.deletedFrom) continue;
    const base=e.date.substring(0,7);
    let item=null;
    if(e.recurrence==="none"){ if(base===monthKey) item={...e,statusForMonth:e.status,isRecurring:false}; }
    else if(e.recurrence==="fixed"){ if(base<=monthKey&&(!e.endMonth||monthKey<=e.endMonth)){const st=e.statusByMonth?.[monthKey]||"a_pagar";item={...e,statusForMonth:st,isRecurring:true,recurLabel:"Fixo"};} }
    else if(e.recurrence==="weekly"){
      if(base<=monthKey&&(!e.endMonth||monthKey<=e.endMonth)){
        const st=e.statusByMonth?.[monthKey]||"a_pagar";
        // Conta ocorrências semanais no mês (aprox: semanas do mês que caem no dia da semana)
        const [y,m]=monthKey.split("-").map(Number);
        const daysInMonth=new Date(y,m,0).getDate();
        const occurrences=Math.floor(daysInMonth/7)+(new Date(y,m,0).getDay()>=(new Date(e.date).getDay())?1:0);
        item={...e,amount:e.amount*Math.max(occurrences,4),statusForMonth:st,isRecurring:true,recurLabel:`Semanal 📆 (${Math.max(occurrences,4)}x)`};
      }
    }
    else if(e.recurrence==="biweekly"){
      if(base<=monthKey&&(!e.endMonth||monthKey<=e.endMonth)){
        const st=e.statusByMonth?.[monthKey]||"a_pagar";
        item={...e,amount:e.amount*2,statusForMonth:st,isRecurring:true,recurLabel:"Quinzenal 📆 (2x)"};
      }
    }
    else if(e.recurrence==="quarterly"){ const diff=mDiff(base,monthKey);if(diff>=0&&diff%3===0&&(!e.endMonth||monthKey<=e.endMonth)){const st=e.statusByMonth?.[monthKey]||"a_pagar";item={...e,statusForMonth:st,isRecurring:true,recurLabel:"Trim."};} }
    else if(e.recurrence==="annual"){ const diff=mDiff(base,monthKey);if(diff>=0&&diff%12===0&&(!e.endMonth||monthKey<=e.endMonth)){const st=e.statusByMonth?.[monthKey]||"a_pagar";item={...e,statusForMonth:st,isRecurring:true,recurLabel:"Anual"};} }
    else if(e.recurrence==="installment"){
      const diff=mDiff(base,monthKey);
      if(diff>=0&&diff<e.installments){
        const st=e.statusByMonth?.[monthKey]||"a_pagar";
        const displayAmount=parseFloat((e.amount/e.installments).toFixed(2));
        item={...e,statusForMonth:st,isRecurring:true,installmentNum:diff+1,recurLabel:`${diff+1}/${e.installments}×`,displayAmount};
      }
    }
    if(item&&!e.deletedMonths?.includes(monthKey)){
      const ov=e.overrides?.[monthKey];
      if(ov){const{amount:oa,status:os,...rest}=ov;
        // statusByMonth tem prioridade sobre o status salvo no override
        // (o toggle atualiza ambos, mas garante que statusByMonth sempre vence)
        const finalStatus=e.statusByMonth?.[monthKey]??os;
        item={...item,...rest,...(oa!==undefined?{displayAmount:oa}:{}),...(finalStatus!==undefined?{statusForMonth:finalStatus}:{})};}
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
        installmentNum:diff+1,installments:d.installments,recurLabel:`${diff+1}/${d.installments}×`,notes:d.notes||""});
    }
  }
  for(const card of (cards||[])){
    const allBillings=getCardBillingMonths(card,cardPurchases||[]);
    for(const bm of allBillings){
      const fat=buildFatura(card,cardPurchases||[],cardFaturas||{},bm);
      if(fat.total<=0) continue;
      if(fat.open){
        // Fatura ainda aberta → mostra no mês de fechamento (billing month)
        if(bm!==monthKey) continue;
        res.push({id:`fatura_${fat.key}`,description:`Fatura ${card.name} — ${mLabel(bm)}`,amount:fat.total,displayAmount:fat.total,
          date:fat.closeDate,type:"despesa",status:"a_pagar",statusForMonth:"a_pagar",
          category:"cartao",recurrence:"none",isRecurring:false,isFatura:true,isOpenFatura:true,
          faturaKey:fat.key,cardId:card.id,closeDate:fat.closeDate,dueDate:fat.dueDate,
          cardColor:card.color,cardName:card.name});
      } else {
        // Fatura fechada → mostra no mês de vencimento
        const dueMk=fat.dueDate.substring(0,7);
        if(dueMk!==monthKey) continue;
        res.push({id:`fatura_${fat.key}`,description:`Fatura ${card.name} — ${mLabel(bm)}`,amount:fat.total,displayAmount:fat.total,
          date:fat.dueDate,type:"despesa",status:fat.paid?"pago":"a_pagar",statusForMonth:fat.paid?"pago":"a_pagar",
          category:"cartao",recurrence:"none",isRecurring:false,isFatura:true,isOpenFatura:false,
          faturaKey:fat.key,cardId:card.id,closeDate:fat.closeDate,dueDate:fat.dueDate,
          cardColor:card.color,cardName:card.name});
      }
    }
  }
  return res;
}

// ─── Notifications ───────────────────────────────────────────
export async function requestNotifPermission() {
  if(!("Notification" in window)) return "unsupported";
  if(Notification.permission==="granted") return "granted";
  if(Notification.permission==="denied")  return "denied";
  return await Notification.requestPermission();
}
export function fireNotification(title,body,tag) {
  if(Notification.permission!=="granted") return;
  // Usa service worker se disponível (funciona em PWA/Android)
  if(navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({type:'NOTIFY',title,body,tag});
  } else {
    try { new Notification(title,{body,tag,icon:'/meu_financeiro/icon-192.png'}); } catch{}
  }
}
export function checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,settings) {
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
