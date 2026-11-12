import { todayISO } from './utils.js';

// ─── Defaults ────────────────────────────────────────────────
export const DEFAULT_CATS=[
  // Despesa
  {id:"moradia",name:"Moradia",color:"#7b93e8",type:"despesa"},
  {id:"alimentacao",name:"Alimentação",color:"#e8825a",type:"despesa"},
  {id:"transporte",name:"Transporte",color:"#4dc98a",type:"despesa"},
  {id:"saude",name:"Saúde",color:"#e06fa0",type:"despesa"},
  {id:"lazer",name:"Lazer",color:"#b06ee8",type:"despesa"},
  {id:"educacao",name:"Educação",color:"#e0b84e",type:"despesa"},
  {id:"assinatura",name:"Assinatura",color:"#5ab8e0",type:"despesa"},
  {id:"divida",name:"Dívida",color:"#f87171",type:"despesa"},
  {id:"cartao",name:"Cartão",color:"#a78bfa",type:"despesa"},
  {id:"outro",name:"Outro",color:"#8a9ab0",type:"despesa"},
  // Receita
  {id:"salario",name:"Salário",color:"#4ade80",type:"receita"},
  {id:"freelance",name:"Freelance",color:"#86d840",type:"receita"},
  {id:"investimento",name:"Investimento",color:"#34d399",type:"receita"},
  {id:"bonus",name:"Bônus",color:"#facc15",type:"receita"},
  {id:"reembolso",name:"Reembolso",color:"#2dd4bf",type:"receita"},
  {id:"presente",name:"Presente",color:"#f472b6",type:"receita"},
  {id:"outra_receita",name:"Outra receita",color:"#94a3b8",type:"receita"},
];
// Categorias usadas automaticamente (dívidas e faturas): não aparecem nos seletores de lançamento.
export const RESERVED_CAT_IDS=["divida","cartao"];
export const BLANK=(type="despesa")=>({description:"",amount:"",date:todayISO(),type,status:"a_pagar",category:type==="receita"?"salario":"outro",recurrence:"none",installments:2,notes:"",endMonth:"",tags:[],accountId:null});
export const PRESET_COLORS=["#6C8EEF","#EF8C6C","#6CEF9A","#EF6CA8","#C46CEF","#EFCE6C","#6CCEEF","#4ade80","#f87171","#facc15","#34d399","#a3e635"];
export const CARD_COLORS=["#a78bfa","#60a5fa","#34d399","#f472b6","#fb923c","#facc15","#f87171","#38bdf8"];

// ─── Notifications ───────────────────────────────────────────
export const defaultNotifSettings = { enabled:true, daysBefore:3, overdueAlert:true, incomeAlert:true };
