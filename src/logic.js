// Regras de negócio puras (sem DOM/React/Firebase). Usadas pelo app e pelo
// cron de notificações (scripts/notify.mjs). "Hoje" é sempre injetável.
import { todayISO, addM, mDiff, mLabel, daysUntil, daysInMonth, dateInMonth, dueDateFor, parseISODate, installmentAmount } from './utils.js';

// ─── Cartão de crédito ───────────────────────────────────────
export function getBillingMonth(purchaseDate,closeDay) {
  const [y,m,d]=purchaseDate.split("-").map(Number);
  if(d<=closeDay) return `${y}-${String(m).padStart(2,"0")}`;
  const next=new Date(y,m,1);
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}`;
}
// Vencimento depois do fechamento no calendário (ex.: fecha 3, vence 10) cai no mesmo mês; senão (fecha 20, vence 5), no mês seguinte.
export const faturaDueOffset=(closeDay,dueDay)=>Number(dueDay)>Number(closeDay)?0:1;
export function getFaturaDueDate(billingMonth,dueDay,closeDay){ return dateInMonth(addM(billingMonth,faturaDueOffset(closeDay,dueDay)),dueDay); }
export function getFaturaCloseDate(billingMonth,closeDay){ return dateInMonth(billingMonth,closeDay); }
export function isFaturaOpen(billingMonth,closeDay,today=todayISO()){ return today<getFaturaCloseDate(billingMonth,closeDay); }
export function getPurchaseInstallmentsForBilling(purchase,targetBillingMonth,closeDay) {
  const baseBilling=getBillingMonth(purchase.purchaseDate,closeDay);
  const diff=mDiff(baseBilling,targetBillingMonth);
  const total=purchase.installments||1;
  if(diff>=0&&diff<total) return {installmentNum:diff+1,total,amount:installmentAmount(purchase.amount,total,diff+1)};
  return null;
}
export function buildFatura(card,purchases,cardFaturas,billingMonth,today=todayISO()) {
  const items=[];
  for(const p of (purchases||[])){
    if(p.cardId!==card.id) continue;
    const inst=getPurchaseInstallmentsForBilling(p,billingMonth,card.closeDay);
    if(inst) items.push({...p,...inst});
  }
  const total=Math.round(items.reduce((s,i)=>s+i.amount,0)*100)/100;
  const key=`${card.id}_${billingMonth}`;
  const payRecord=(cardFaturas||{})[key]||null;
  const closeDate=getFaturaCloseDate(billingMonth,card.closeDay);
  const dueDate=getFaturaDueDate(billingMonth,card.dueDay,card.closeDay);
  const open=today<closeDate;
  const paid=payRecord?.paid||false;
  const paidAmount=payRecord?.paidAmount||0;
  const partial=payRecord?.partial||false;
  return {card,billingMonth,items,total,closeDate,dueDate,open,paid,paidAmount,partial,key};
}
// Score de saúde financeira (0–100) — única regra, usada no cabeçalho, no modal e na tela Saúde.
// fixos = despesas recorrentes do mês (fixas, parcelas, dívidas, semanais...) já expandidas por getMonthEntries.
export function computeHealth({rec,dep,fixos,pend}){
  if(!(rec>0)) return null;
  const fixedPct=Math.min(100,(fixos/rec)*100);
  const savingPct=Math.max(0,((rec-dep)/rec)*100);
  let score=100;
  if(fixedPct>70) score-=30; else if(fixedPct>50) score-=15; else if(fixedPct>30) score-=5;
  if(savingPct<10) score-=20; else if(savingPct<20) score-=10;
  if(pend>rec*0.3) score-=10;
  score=Math.max(0,Math.min(100,score));
  const level=score>=80?"Saudável":score>=60?"Atenção":"Crítico";
  const color=score>=80?"#4ade80":score>=60?"#facc15":"#f87171";
  return {score,level,color,fixedPct,savingPct};
}
// Saldo de cada conta: saldo inicial + tudo que foi pago/recebido e está vinculado à conta
// (avulsos, fixos, parcelas...), mês a mês até hoje. Faturas de cartão não são vinculadas a contas.
export function accountBalances(accounts,{entries},today=todayISO()){
  const bal=Object.fromEntries(accounts.map(a=>[a.id,Number(a.initialBalance)||0]));
  const ids=new Set(accounts.map(a=>a.id));
  const linked=entries.filter(e=>e.accountId&&ids.has(e.accountId));
  if(!linked.length) return bal;
  const now=today.substring(0,7);
  const first=linked.reduce((m,e)=>e.date.substring(0,7)<m?e.date.substring(0,7):m,now);
  const last=linked.reduce((m,e)=>e.date.substring(0,7)>m?e.date.substring(0,7):m,now);
  const start=first<addM(now,-120)?addM(now,-120):first;
  for(let cur=start;cur<=last;cur=addM(cur,1)){
    for(const e of getMonthEntries(linked,[],cur,[],[],{},today)){
      if(e.statusForMonth!=="pago") continue;
      const v=e.displayAmount??e.amount;
      bal[e.accountId]+=e.type==="receita"?v:-v;
    }
  }
  for(const id of Object.keys(bal)) bal[id]=Math.round(bal[id]*100)/100;
  return bal;
}
// Saldo acumulado dos meses ANTERIORES a `month` (até 36 meses). null = não há lançamentos anteriores.
export function accumulatedBalance({entries,dividas,cards,cardPurchases,cardFaturas},month,today=todayISO()){
  const allDates=[...entries.map(e=>e.date.substring(0,7)),...dividas.map(d=>d.startMonth)];
  if(!allDates.length) return null;
  const earliest=allDates.reduce((mn,m)=>m<mn?m:mn,month);
  if(earliest>=month) return null;
  const cap=addM(month,-36);
  const capped=earliest<cap;
  let total=0,cur=capped?cap:earliest;
  while(cur<month){
    for(const e of getMonthEntries(entries,dividas,cur,cards,cardPurchases,cardFaturas,today)){
      const v=e.displayAmount??e.amount;
      total+=e.type==="receita"?v:e.type==="despesa"?-v:0;
    }
    cur=addM(cur,1);
  }
  return {value:total,capped};
}
// Dívida: parcelas pagas DENTRO do período (meses órfãos não contam), restante em R$ e parcela regular.
export function debtStats(d){
  const n=Math.max(1,parseInt(d.installments)||1);
  const paidSet=new Set((d.paidMonths||[]).filter(m=>{const k=mDiff(d.startMonth,m);return k>=0&&k<n;}));
  let paidValue=0;
  for(let i=0;i<n;i++) if(paidSet.has(addM(d.startMonth,i))) paidValue+=installmentAmount(d.totalAmount,n,i+1);
  const paid=paidSet.size;
  return {n,paid,pct:Math.round(paid/n*100),quitada:paid>=n,
    remaining:Math.max(0,Math.round((d.totalAmount-paidValue)*100)/100),
    regular:installmentAmount(d.totalAmount,n,n>1?2:1)};
}
// Limite comprometido de um cartão: tudo que ainda falta pagar nas faturas (vencidas, atuais e futuras).
export function cardUsedLimit(card,purchases,cardFaturas,today=todayISO()){
  let used=0;
  for(const bm of getCardBillingMonths(card,purchases)){
    const f=buildFatura(card,purchases,cardFaturas,bm,today);
    if(!f.paid) used+=Math.max(0,f.total-(f.paidAmount||0));
  }
  return Math.round(used*100)/100;
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

// ─── Recorrência ─────────────────────────────────────────────
// Quantas vezes um lançamento a cada `stepDays` dias, iniciado em `startDate`,
// ocorre no mês `monthKey`.
export function countOccurrencesInMonth(startDate,monthKey,stepDays) {
  const start=parseISODate(startDate);
  const [y,m]=monthKey.split("-").map(Number);
  let n=0;
  for(let d=1;d<=daysInMonth(monthKey);d++){
    const diff=Math.round((new Date(y,m-1,d)-start)/86400000);
    if(diff>=0&&diff%stepDays===0) n++;
  }
  return n;
}

// ─── Lançamentos do mês ──────────────────────────────────────
export function getMonthEntries(entries,dividas,monthKey,cards,cardPurchases,cardFaturas,today=todayISO()) {
  const res=[];
  for(const e of (entries||[])){
    if(e.deletedFrom&&monthKey>=e.deletedFrom) continue;
    const base=e.date.substring(0,7);
    const inRange=base<=monthKey&&(!e.endMonth||monthKey<=e.endMonth);
    const st=()=>e.statusByMonth?.[monthKey]||"a_pagar";
    let item=null;
    if(e.recurrence==="none"){ if(base===monthKey) item={...e,statusForMonth:e.status,isRecurring:false}; }
    else if(e.recurrence==="fixed"){ if(inRange) item={...e,statusForMonth:st(),isRecurring:true,recurLabel:"Fixo"}; }
    else if(e.recurrence==="weekly"||e.recurrence==="biweekly"){
      if(inRange){
        const weekly=e.recurrence==="weekly";
        const n=countOccurrencesInMonth(e.date,monthKey,weekly?7:14);
        if(n>0) item={...e,displayAmount:Math.round(e.amount*n*100)/100,occurrences:n,statusForMonth:st(),isRecurring:true,recurLabel:`${weekly?"Semanal":"Quinzenal"} 📆 (${n}x)`};
      }
    }
    else if(e.recurrence==="quarterly"){ const diff=mDiff(base,monthKey);if(diff>=0&&diff%3===0&&inRange) item={...e,statusForMonth:st(),isRecurring:true,recurLabel:"Trim."}; }
    else if(e.recurrence==="annual"){ const diff=mDiff(base,monthKey);if(diff>=0&&diff%12===0&&inRange) item={...e,statusForMonth:st(),isRecurring:true,recurLabel:"Anual"}; }
    else if(e.recurrence==="installment"){
      const diff=mDiff(base,monthKey);
      if(diff>=0&&diff<e.installments){
        item={...e,statusForMonth:st(),isRecurring:true,installmentNum:diff+1,recurLabel:`${diff+1}/${e.installments}×`,displayAmount:installmentAmount(e.amount,e.installments,diff+1)};
      }
    }
    if(item&&!e.deletedMonths?.includes(monthKey)){
      const ov=e.overrides?.[monthKey];
      if(ov){const{amount:oa,status:os,...rest}=ov;
        // statusByMonth tem prioridade sobre o status salvo no override
        const finalStatus=e.statusByMonth?.[monthKey]??os;
        item={...item,...rest,...(oa!==undefined?{displayAmount:oa}:{}),...(finalStatus!==undefined?{statusForMonth:finalStatus}:{})};}
      res.push(item);
    }
  }
  for(const d of (dividas||[])){
    const diff=mDiff(d.startMonth,monthKey);
    if(diff>=0&&diff<d.installments){
      const instVal=installmentAmount(d.totalAmount,d.installments,diff+1);
      const isPaid=d.paidMonths?.includes(monthKey)||false;
      res.push({id:`divida_${d.id}_${monthKey}`,description:d.name,amount:instVal,displayAmount:instVal,
        date:dateInMonth(monthKey,d.dueDay||10),type:"despesa",status:isPaid?"pago":"a_pagar",statusForMonth:isPaid?"pago":"a_pagar",
        category:d.category||"outro",recurrence:"installment",isRecurring:true,isDivida:true,dividaId:d.id,
        installmentNum:diff+1,installments:d.installments,recurLabel:`${diff+1}/${d.installments}×`,notes:d.notes||""});
    }
  }
  for(const card of (cards||[])){
    // A fatura conta no mês do VENCIMENTO (quando o dinheiro sai); o mês de faturamento é o do vencimento menos o deslocamento do cartão.
    const bm=addM(monthKey,-faturaDueOffset(card.closeDay,card.dueDay));
    if(!getCardBillingMonths(card,cardPurchases||[]).includes(bm)) continue;
    const fat=buildFatura(card,cardPurchases||[],cardFaturas||{},bm,today);
    if(fat.total<=0) continue;
    const common={id:`fatura_${fat.key}`,description:`Fatura ${card.name} — ${mLabel(bm)}`,amount:fat.total,
      type:"despesa",category:"cartao",recurrence:"none",isRecurring:false,isFatura:true,
      faturaKey:fat.key,cardId:card.id,closeDate:fat.closeDate,dueDate:fat.dueDate,cardColor:card.color,cardName:card.name,date:fat.dueDate};
    if(fat.open){
      // Aberta: ainda recebe compras; entra no mês do vencimento com o total acumulado até agora
      res.push({...common,displayAmount:fat.total,status:"a_pagar",statusForMonth:"a_pagar",isOpenFatura:true});
    } else {
      const remainingAmount=fat.partial?Math.round((fat.total-fat.paidAmount)*100)/100:fat.total;
      const status=fat.paid?"pago":"a_pagar";
      res.push({...common,displayAmount:remainingAmount,status,statusForMonth:status,isOpenFatura:false,
        paidAmount:fat.paidAmount,partial:fat.partial});
    }
  }
  return res;
}

// ─── Alertas de vencimento (puro) ────────────────────────────
// Classifica pendências do mês anterior, atual e seguinte em grupos de alerta.
// Usado pelas notificações locais e pelo cron de push.
export function collectDueAlerts(data,settings,today=todayISO()) {
  const {entries,dividas,cards,cardPurchases,cardFaturas}=data;
  const daysBefore=settings.daysBefore??3;
  const NOW=today.substring(0,7);
  const me=[addM(NOW,-1),NOW,addM(NOW,1)].flatMap(mk=>
    getMonthEntries(entries,dividas,mk,cards,cardPurchases,cardFaturas,today)
      .filter(e=>e.statusForMonth==="a_pagar"&&!e.isOpenFatura)
      .map(e=>({...e,days:daysUntil(dueDateFor(e,mk),today)})));
  const exp=me.filter(e=>e.type==="despesa"&&e.days!==null);
  const inc=settings.incomeAlert!==false?me.filter(e=>e.type==="receita"&&e.days!==null):[];
  return {
    overdue: settings.overdueAlert!==false?exp.filter(e=>e.days<0):[],
    dueToday: exp.filter(e=>e.days===0),
    dueSoon:  exp.filter(e=>e.days>0&&e.days<=daysBefore),
    incToday: inc.filter(e=>e.days===0),
    incSoon:  inc.filter(e=>e.days>0&&e.days<=daysBefore),
  };
}

const plural=(n,s,p)=>n>1?p:s;
// Converte os grupos de collectDueAlerts em mensagens {title,body,tag}.
export function formatDueAlerts(a) {
  const out=[];
  const n=(l)=>l.length;
  if(n(a.overdue))  out.push({tag:"mf-overdue",  title:`⚠️ ${n(a.overdue)} ${plural(n(a.overdue),"conta vencida","contas vencidas")}`, body:a.overdue.map(e=>`${e.description} (${Math.abs(e.days)}d atraso)`).join(", ")});
  if(n(a.dueToday)) out.push({tag:"mf-today",    title:`🔴 ${n(a.dueToday)} ${plural(n(a.dueToday),"conta vence","contas vencem")} hoje`, body:a.dueToday.map(e=>e.description).join(", ")});
  if(n(a.dueSoon))  out.push({tag:"mf-soon",     title:`⏰ ${n(a.dueSoon)} ${plural(n(a.dueSoon),"despesa vence","despesas vencem")} em breve`, body:a.dueSoon.map(e=>`${e.description} (${e.days}d)`).join(", ")});
  if(n(a.incToday)) out.push({tag:"mf-inc-today",title:`💰 ${n(a.incToday)} ${plural(n(a.incToday),"recebimento esperado","recebimentos esperados")} hoje`, body:a.incToday.map(e=>e.description).join(", ")});
  if(n(a.incSoon))  out.push({tag:"mf-inc-soon", title:`📥 ${n(a.incSoon)} ${plural(n(a.incSoon),"recebimento","recebimentos")} em breve`, body:a.incSoon.map(e=>`${e.description} (${e.days}d)`).join(", ")});
  return out;
}
