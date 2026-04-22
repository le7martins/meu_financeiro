import { useState } from 'react';
import CatSelector from '../components/CatSelector.jsx';
import Field from '../components/Field.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import { fmt } from '../utils.js';
import S from '../styles.js';

export default function FormModal({form,setForm,lockedType,categories,entries,onUpdateCats,onAdd,onClose,cards=[]}){
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
  const [tagInput,setTagInput]=useState("");
  const addTag=(raw)=>{const t=raw.trim().toLowerCase().replace(/\s+/g,"_");if(!t||(form.tags||[]).includes(t))return;set("tags",[...(form.tags||[]),t]);setTagInput("");};
  const [newName,setNewName]=useState("");
  const [newColor,setNewColor]=useState("#6C8EEF");
  const type=lockedType||form.type;
  const filteredCats=categories.filter(c=>c.type==="both"||c.type===type);
  const usedIds=new Set(entries.map(e=>e.category));
  const addCat=()=>{if(!newName.trim())return;const id=newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_")+"_"+Date.now();onUpdateCats([...categories,{id,name:newName.trim(),color:newColor,type}]);set("category",id);setNewName("");setAddingCat(false);};
  const removeCat=(catId)=>{if(usedIds.has(catId))return;onUpdateCats(categories.filter(c=>c.id!==catId));if(form.category===catId){const r=filteredCats.filter(c=>c.id!==catId);if(r.length>0)set("category",r[0].id);}};
  const typeColor=type==="receita"?"#4ade80":"#fb923c";
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal} className="modal-in">
        <div style={S.modalHandle}/>
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
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[["none","Único"],["fixed","Fixo 🔄"],["weekly","Semanal"],["biweekly","Quinzenal"],["quarterly","Trimestral"],["annual","Anual"],["installment","Parcelado 📋"]].map(([r,l])=>(<button key={r} onClick={()=>set("recurrence",r)} style={{...S.chipBtn,...(form.recurrence===r?S.chipActive:{})}}>{l}</button>))}</div>
          {form.recurrence==="installment"&&(<div style={{marginTop:10}}><label style={{...S.lbl,marginBottom:5}}>Nº de parcelas</label><input style={{...S.inp,width:90}} type="number" min={2} max={60} value={form.installments} onChange={e=>set("installments",e.target.value)}/>{form.amount&&form.installments>1&&(<div style={{marginTop:8,background:"var(--bg)",border:"1px solid #1a3a6e44",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--text3)"}}>Total</span><span style={{fontSize:12,fontWeight:700,color:"#8ab4f8"}}>{fmt(parseFloat(form.amount))}</span><span style={{fontSize:11,color:"var(--text4)"}}>→</span><span style={{fontSize:11,color:"var(--text3)"}}>{form.installments}x de</span><span style={{fontSize:14,fontWeight:700,color:"#4ade80"}}>{fmt(parseFloat(form.amount)/parseInt(form.installments))}</span></div>)}</div>)}
          {(["fixed","weekly","biweekly","quarterly","annual"].includes(form.recurrence))&&(<div style={{marginTop:10}}>
            <div style={{fontSize:11,color:"var(--text3)",background:"var(--bg)",borderRadius:8,padding:"8px 10px",border:"1px solid var(--border)",marginBottom:8}}>
              {form.recurrence==="fixed"&&"💡 Aparece todo mês a partir da data"}
              {form.recurrence==="weekly"&&"💡 Aparece toda semana (4-5x por mês)"}
              {form.recurrence==="biweekly"&&"💡 Aparece a cada 15 dias (2x por mês)"}
              {form.recurrence==="quarterly"&&"💡 Aparece a cada 3 meses"}
              {form.recurrence==="annual"&&"💡 Aparece uma vez por ano"}
            </div>
            <label style={{...S.lbl,marginBottom:5}}>Encerrar em (opcional)</label>
            <MonthPicker value={form.endMonth||""} onChange={v=>set("endMonth",v)} now={new Date().toISOString().substring(0,7)} nullable/>
          </div>)}
        </Field>
        <CatSelector cats={filteredCats} selected={form.category} onSelect={v=>set("category",v)} editCats={editCats} setEditCats={setEditCats} addingCat={addingCat} setAddingCat={setAddingCat} newName={newName} setNewName={setNewName} newColor={newColor} setNewColor={setNewColor} usedIds={usedIds} onAddCat={addCat} onRemoveCat={removeCat}/>
        <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:52,lineHeight:1.5}} placeholder="Alguma anotação..." value={form.notes} onChange={e=>set("notes",e.target.value)}/></Field>
        <Field label="Tags (opcional)">
          {(form.tags||[]).length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>{(form.tags||[]).map(t=><button key={t} onClick={()=>set("tags",(form.tags||[]).filter(x=>x!==t))} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"rgba(138,180,248,.15)",border:"1px solid #8ab4f833",color:"#8ab4f8",cursor:"pointer",fontFamily:"inherit"}}>#{t} ✕</button>)}</div>}
          <input style={S.inp} placeholder="Ex: viagem, fixo, mercado... (Enter para adicionar)" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag(tagInput);}else if(e.key===","||e.key===" "){e.preventDefault();addTag(tagInput);}}}/>
        </Field>
        {type==="despesa"&&cards.length>0&&<Field label="Pagar com"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button onClick={()=>set("payWith","saldo")} style={{...S.chipBtn,...(form.payWith==="saldo"?S.chipActive:{})}}>💰 Saldo</button>{cards.map(c=>(<button key={c.id} onClick={()=>set("payWith",c.id)} style={{...S.chipBtn,...(form.payWith===c.id?{background:c.color+"33",border:`1px solid ${c.color}88`,color:c.color}:{})}}>{c.name}</button>))}</div>{form.payWith&&form.payWith!=="saldo"&&<div style={{marginTop:6,fontSize:11,color:"var(--text3)",background:"var(--bg)",borderRadius:7,padding:"6px 10px",border:"1px solid var(--border)"}}>💳 Lançado diretamente na fatura do cartão</div>}</Field>}
        {(type!=="despesa"||!cards.length||form.payWith==="saldo")&&<Field label="Status"><div style={{display:"flex",gap:8}}>{(type==="receita"?[["a_pagar","⏳ A Receber","#fb923c"],["pago","✓ Recebido","#4ade80"]]:[["a_pagar","⏳ A Pagar","#fb923c"],["pago","✓ Pago","#4ade80"]]).map(([s,l,c])=>(<button key={s} onClick={()=>set("status",s)} style={{...S.typeBtn,...(form.status===s?{background:c+"20",border:`1px solid ${c}44`,color:c}:{})}}>{l}</button>))}</div></Field>}
        <button onClick={()=>{setTouched({description:true,amount:true});if(isValid)onAdd();}} className="submitBtn"
          style={{...S.submitBtn,opacity:isValid?1:0.45,cursor:isValid?"pointer":"not-allowed",background:type==="receita"?"linear-gradient(135deg,#1a4a2e,#0d2a1a)":"linear-gradient(135deg,#1a3a6e,#0d2247)",borderColor:type==="receita"?"#4ade8033":"#2a4a8e44",color:typeColor}}>
          Adicionar {type==="receita"?"Receita":"Despesa"}
        </button>
      </div>
    </div>
  );
}
