// ─── Utils: formatação, datas e localStorage ─────────────────
export const fmt      = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
export const fmtShort = (v) => Math.abs(v)>=1000?`R$${(v/1000).toFixed(1)}k`:`R$${v.toFixed(0)}`;
export const fmtDate  = (d) => { const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
export const TODAY    = new Date().toISOString().split("T")[0];
export const MNAMES   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const mLabel   = (k) => { const [y,m]=k.split("-"); return `${MNAMES[+m-1]} ${y}`; };
export const mShort   = (k) => MNAMES[+k.split("-")[1]-1];
export const getNow   = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
export const mDiff    = (a,b) => { const [ay,am]=a.split("-").map(Number),[by,bm]=b.split("-").map(Number); return (by-ay)*12+(bm-am); };
export const addM     = (k,n) => { const [y,m]=k.split("-").map(Number),d=new Date(y,m-1+n,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
export const daysUntil = (ds) => { if(!ds)return null; return Math.ceil((new Date(ds+"T12:00:00")-new Date(TODAY+"T12:00:00"))/86400000); };
export const dueBadge  = (entry,mk) => {
  if(entry.statusForMonth!=="a_pagar") return null;
  if(entry.isOpenFatura) return null;
  const due = entry.recurrence!=="none"&&!entry.isDivida&&!entry.isFatura ? `${mk}-${entry.date.split("-")[2]}` : entry.date;
  const days = daysUntil(due);
  if(days===null) return null;
  if(days<0)   return {text:`Vencido há ${Math.abs(days)}d`,color:"#f87171",bg:"rgba(248,113,113,.13)"};
  if(days===0) return {text:"Vence hoje!",color:"#fb923c",bg:"rgba(251,146,60,.18)"};
  if(days<=3)  return {text:`Vence em ${days}d`,color:"#fb923c",bg:"rgba(251,146,60,.12)"};
  if(days<=7)  return {text:`Vence em ${days}d`,color:"#facc15",bg:"rgba(250,204,21,.1)"};
  return null;
};
export const eVal = (e) => e.displayAmount??e.amount;

// ─── Storage ─────────────────────────────────────────────────
export const loadLS = (k,def) => { try{const d=localStorage.getItem(k);return d?JSON.parse(d):def;}catch{return def;} };
export const saveLS = (k,v)   => localStorage.setItem(k,JSON.stringify(v));
