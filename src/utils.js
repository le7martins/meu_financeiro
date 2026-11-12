// ─── Utils: formatação, datas e localStorage ─────────────────
const NUM = new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
// Valores monetários sempre como 1.234,56 (sem símbolo de moeda).
export const fmt      = (v) => NUM.format(Math.abs(v)<0.005?0:v);
export const fmtShort = (v) => Math.abs(v)>=1000?`${(v/1000).toFixed(1).replace('.',',')}k`:v.toFixed(0);
export const fmtDate  = (d) => { const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
export const MNAMES   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const mLabel   = (k) => { const [y,m]=k.split("-"); return `${MNAMES[+m-1]} ${y}`; };
export const mShort   = (k) => MNAMES[+k.split("-")[1]-1];

// ─── Datas ───────────────────────────────────────────────────
// Sempre no fuso local do aparelho. "Hoje" é função (não constante): um PWA
// aberto atravessa a meia-noite, e toISOString() usaria UTC — após 21h no
// horário de Brasília já seria o dia seguinte.
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const getNow   = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
export const mDiff    = (a,b) => { const [ay,am]=a.split("-").map(Number),[by,bm]=b.split("-").map(Number); return (by-ay)*12+(bm-am); };
export const addM     = (k,n) => { const [y,m]=k.split("-").map(Number),d=new Date(y,m-1+n,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
export const daysInMonth = (mk) => { const [y,m]=mk.split("-").map(Number); return new Date(y,m,0).getDate(); };
// Data YYYY-MM-DD do dia `day` no mês `mk`, limitada ao último dia (31 → 28/02).
export const dateInMonth = (mk, day) => `${mk}-${String(Math.min(Number(day)||1, daysInMonth(mk))).padStart(2,"0")}`;
// Converte "YYYY-MM-DD" em Date local (new Date("YYYY-MM-DD") interpreta como UTC).
export const parseISODate = (ds) => { const [y,m,d]=ds.split("-").map(Number); return new Date(y,m-1,d); };
export const daysUntil = (ds, today = todayISO()) => { if(!ds)return null; return Math.round((parseISODate(ds)-parseISODate(today))/86400000); };
// Vencimento de um item de getMonthEntries no mês `mk`.
export const dueDateFor = (entry, mk) =>
  entry.recurrence!=="none"&&!entry.isDivida&&!entry.isFatura ? dateInMonth(mk, entry.date.split("-")[2]) : entry.date;
// Linha única de vencimento do card: texto com data e contagem + token de cor (null = neutro).
// Dois níveis de alerta: vermelho = atrasado, laranja = vence em até 7 dias.
const plural = (n,w) => `${n} ${w}${n===1?"":"s"}`;
const shortDate = (ds,today) => { const [y,m,d]=ds.split("-"); return `${d}/${m}${y===today.slice(0,4)?"":"/"+y.slice(2)}`; };
export const dueLine = (entry,mk,today = todayISO()) => {
  const ds = dueDateFor(entry,mk);
  const days = daysUntil(ds,today);
  if(days===null) return null;
  const date = shortDate(ds,today);
  const income = entry.type==="receita";
  if(entry.isOpenFatura) return {text:`Fecha ${shortDate(entry.closeDate||ds,today)} · vence ${date}`,token:null};
  if(income){
    if(entry.statusForMonth==="pago") return {text:`Receber em ${date}`,token:null};
    const when = days<0?`há ${plural(-days,"dia")}`:days===0?"hoje":days===1?"amanhã":`em ${plural(days,"dia")}`;
    return {text:`Receber em ${date} · ${when}`,token:days<0?"danger":days<=7?"orange":null};
  }
  if(entry.statusForMonth==="pago") return {text:`Vencimento ${date}`,token:null};
  if(days<0) return {text:`Venceu em ${date} · há ${plural(-days,"dia")}`,token:"danger"};
  const when = days===0?"hoje":days===1?"amanhã":`em ${plural(days,"dia")}`;
  return {text:`Vence ${when} · ${date}`,token:days<=7?"orange":null};
};
// Valor do mês sem override: parcela, soma das ocorrências (semanal/quinzenal) ou o próprio valor.
export const originalMonthAmount = (e) =>
  e.recurrence==="installment" ? e.amount/e.installments
  : (e.recurrence==="weekly"||e.recurrence==="biweekly") ? Math.round(e.amount*(e.occurrences||1)*100)/100
  : e.amount;
export const eVal =(e) => e.displayAmount??e.amount;

// ─── Dinheiro ────────────────────────────────────────────────
// Valor da parcela i (1-based) de n, em centavos exatos: a soma das parcelas
// é sempre igual ao total. A sobra do arredondamento vai na 1ª parcela.
export const installmentAmount = (total, n, i) => {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  return (i === 1 ? cents - base * (n - 1) : base) / 100;
};

// ─── IDs ─────────────────────────────────────────────────────
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2,10)}`;

// ─── Storage ─────────────────────────────────────────────────
export const loadLS = (k,def) => { try{const d=localStorage.getItem(k);return d?JSON.parse(d):def;}catch{return def;} };
export const saveLS = (k,v)   => localStorage.setItem(k,JSON.stringify(v));
