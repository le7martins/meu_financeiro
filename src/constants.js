import { TODAY } from './utils.js';

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
export const BLANK=(type="despesa")=>({description:"",amount:"",date:TODAY,type,status:"a_pagar",category:type==="receita"?"salario":"outro",recurrence:"none",installments:2,notes:"",endMonth:"",tags:[]});
export const PRESET_COLORS=["#6C8EEF","#EF8C6C","#6CEF9A","#EF6CA8","#C46CEF","#EFCE6C","#6CCEEF","#4ade80","#f87171","#facc15","#34d399","#a3e635"];
export const CARD_COLORS=["#a78bfa","#60a5fa","#34d399","#f472b6","#fb923c","#facc15","#f87171","#38bdf8"];

// ─── Notifications ───────────────────────────────────────────
export const NOTIF_KEY      = "mf2_notif_settings";
export const NOTIF_LAST_KEY = "mf2_notif_last";
export const defaultNotifSettings = { enabled:true, daysBefore:3, overdueAlert:true, incomeAlert:true };

// ─── CSS ─────────────────────────────────────────────────────
export const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .hscroll::-webkit-scrollbar { display: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #1a2a40; border-radius: 2px; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.35); }
  select option { background: #0d1118; }
  ::placeholder { color: #637080; }
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
    --border:#1a2235; --border2:#0d1520; --border3:#131c2c;
    --text1:#e2e8f0; --text2:#c8d3de; --text3:#8896a8; --text4:#637080;
    --inp-bg:#0b1018; --nav-bg:#080c12;
  }

  /* ── Light mode overrides ── */
  .light-mode { --bg:#f0f4f8; --card-bg:#ffffff; --card-bg2:#e8edf3;
    --border:#d0d8e4; --border2:#c8d2e0; --border3:#dde4ee;
    --text1:#0f172a; --text2:#1e293b; --text3:#475569; --text4:#64748b;
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
