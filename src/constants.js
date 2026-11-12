import { todayISO } from './utils.js';

// ─── Defaults ────────────────────────────────────────────────
export const DEFAULT_CATS=[
  {id:"moradia",name:"Moradia",color:"#7b93e8",type:"both"},
  {id:"alimentacao",name:"Alimentação",color:"#e8825a",type:"both"},
  {id:"transporte",name:"Transporte",color:"#4dc98a",type:"both"},
  {id:"saude",name:"Saúde",color:"#e06fa0",type:"both"},
  {id:"lazer",name:"Lazer",color:"#b06ee8",type:"both"},
  {id:"educacao",name:"Educação",color:"#e0b84e",type:"both"},
  {id:"assinatura",name:"Assinatura",color:"#5ab8e0",type:"both"},
  {id:"salario",name:"Salário",color:"#4ade80",type:"receita"},
  {id:"freelance",name:"Freelance",color:"#86d840",type:"receita"},
  {id:"investimento",name:"Investimento",color:"#34d399",type:"receita"},
  {id:"divida",name:"Dívida",color:"#f87171",type:"despesa"},
  {id:"cartao",name:"Cartão",color:"#a78bfa",type:"despesa"},
  {id:"outro",name:"Outro",color:"#8a9ab0",type:"both"},
];
export const BLANK=(type="despesa")=>({description:"",amount:"",date:todayISO(),type,status:"a_pagar",category:type==="receita"?"salario":"outro",recurrence:"none",installments:2,notes:"",endMonth:"",tags:[],accountId:null});
export const PRESET_COLORS=["#6C8EEF","#EF8C6C","#6CEF9A","#EF6CA8","#C46CEF","#EFCE6C","#6CCEEF","#4ade80","#f87171","#facc15","#34d399","#a3e635"];
export const CARD_COLORS=["#a78bfa","#60a5fa","#34d399","#f472b6","#fb923c","#facc15","#f87171","#38bdf8"];

// ─── Notifications ───────────────────────────────────────────
export const defaultNotifSettings = { enabled:true, daysBefore:3, overdueAlert:true, incomeAlert:true };
