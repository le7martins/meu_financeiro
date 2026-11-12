import { useState, useMemo, useRef } from 'react';
import CategoryPicker from '../components/CategoryPicker.jsx';
import Field, { useDialog } from "../components/Field.jsx";
import MonthPicker from '../components/MonthPicker.jsx';
import { fmt, fmtDate, todayISO } from '../utils.js';
import { formErrors } from '../entryActions.js';
import S, { tint } from "../styles.js";
import { pickableCategories } from '../categoryMigration.js';

export default function FormModal({form,setForm,lockedType,categories,entries,onUpdateCats,onAdd,onClose,cards=[],accounts=[]}){
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const [editCats,setEditCats]=useState(false);
  const [addingCat,setAddingCat]=useState(false);
  const [touched,setTouched]=useState({});
  const [displayAmt,setDisplayAmt]=useState(form.amount?parseFloat(form.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'');
  const [showSuggestions,setShowSuggestions]=useState(false);
  const descRef=useRef(null);

  const handleAmtChange=(e)=>{
    const digits=e.target.value.replace(/\D/g,'');
    if(!digits){setDisplayAmt('');set('amount','');return;}
    const num=parseInt(digits,10)/100;
    setDisplayAmt(num.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
    set('amount',String(num));
  };

  const type=lockedType||form.type;

  // Build suggestions from past entries of the same type
  const suggestions=useMemo(()=>{
    if(!form.description||form.description.length<2) return [];
    const q=form.description.toLowerCase();
    const seen=new Set();
    return entries
      .filter(e=>e.type===type&&e.description.toLowerCase().includes(q)&&e.description!==form.description)
      .map(e=>({desc:e.description,cat:e.category,amount:e.amount}))
      .filter(e=>{if(seen.has(e.desc))return false;seen.add(e.desc);return true;})
      .slice(0,5);
  },[entries,form.description,type]);

  const applySuggestion=(s)=>{
    set('description',s.desc);
    if(s.cat) set('category',s.cat);
    // Don't auto-fill amount to avoid confusion
    setShowSuggestions(false);
  };

  const descErr=touched.description&&!form.description?.trim()?"Descrição obrigatória":null;
  const errs=formErrors({...form,description:form.description||""});
  const amtErr=touched.amount&&errs.amount?errs.amount:null;
  const isValid=Object.keys(errs).length===0;
  const firstErr=touched.submit?Object.values(errs)[0]:null;
  const cardMode=type==="despesa"&&!!form.payWith&&form.payWith!=="saldo"; // compra no cartão: só único ou parcelado
  const [tagInput,setTagInput]=useState("");
  const [showMore,setShowMore]=useState(()=>!!(form.notes||(form.tags||[]).length||form.accountId||(form.recurrence&&form.recurrence!=="none"))); // abre sozinho ao clonar com esses dados
  const lateErr=touched.submit&&(errs.installments||errs.endMonth); // erro dentro dos detalhes: abre o bloco
  const addTag=(raw)=>{const t=raw.trim().toLowerCase().replace(/\s+/g,"_");if(!t||(form.tags||[]).includes(t))return;set("tags",[...(form.tags||[]),t]);setTagInput("");};
  const [newName,setNewName]=useState("");
  const [newColor,setNewColor]=useState("#6C8EEF");
  const filteredCats=pickableCategories(categories,type);
  const usedIds=new Set(entries.map(e=>e.category));
  const addCat=()=>{if(!newName.trim())return;const id=newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_")+"_"+Date.now();onUpdateCats([...categories,{id,name:newName.trim(),color:newColor,type}]);set("category",id);setNewName("");setAddingCat(false);};
  const removeCat=(catId)=>{if(usedIds.has(catId))return;onUpdateCats(categories.filter(c=>c.id!==catId));if(form.category===catId){const r=filteredCats.filter(c=>c.id!==catId);if(r.length>0)set("category",r[0].id);}};
  const typeColor=type==="receita"?"var(--success)":"var(--orange)";
  const {dialogProps,titleId}=useDialog(onClose);
  const statusOpts=type==="receita"
    ?[["a_pagar","⏳ A Receber","orange"],["pago","✓ Recebido","success"]]
    :[["a_pagar","⏳ A Pagar","orange"],["pago","✓ Pago","success"]];

  const today=todayISO();
  const repeatTypes=[["fixed","Fixo"],["weekly","Semanal"],["biweekly","Quinzenal"],["quarterly","Trimestral"],["annual","Anual"]];
  const group=form.recurrence==="none"?"none":form.recurrence==="installment"?"installment":"repeat";
  const lastRepeat=useRef("fixed");
  if(group==="repeat") lastRepeat.current=form.recurrence;
  const pickGroup=(g)=>set("recurrence",g==="none"?"none":g==="installment"?"installment":lastRepeat.current);
  const recLabel=group==="none"?"Único":group==="installment"?`${form.installments||"?"}x`:(repeatTypes.find(([r])=>r===form.recurrence)?.[1]||"Fixo");
  const statusLabel=cardMode?null:(form.status==="pago"?(type==="receita"?"Recebido":"Pago"):(type==="receita"?"A receber":"A pagar"));
  const summary=[form.date===today?"Hoje":fmtDate(form.date),recLabel,statusLabel,form.accountId&&accounts.find(a=>a.id===form.accountId)?.name].filter(Boolean).join(" · ");
  const seg=(on)=>({...S.typeBtn,flex:1,minHeight:44,...(on?{background:"var(--accent-soft)",border:"1px solid var(--accent-border)",color:"var(--accent)"}:{})});
  const open=showMore||!!lateErr;

  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div {...dialogProps} style={{...S.modal,outline:"none"}} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}>
          <div id={titleId} style={{...S.mTitle,color:typeColor}}>{type==="receita"?"Nova receita":"Nova despesa"}</div>
          <button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button>
        </div>

        {/* Valor primeiro: é o que se digita sempre */}
        <Field label="Valor" required error={amtErr?`⚠️ ${amtErr}`:null}>
          <input style={{...S.inp,fontSize:"var(--fs-6xl)",fontWeight:800,color:typeColor,padding:"10px 12px",borderColor:amtErr?"var(--danger)":"var(--border)"}} type="text" inputMode="numeric" autoComplete="off" placeholder="0,00" value={displayAmt} onChange={handleAmtChange} onBlur={()=>setTouched(p=>({...p,amount:true}))}/>
        </Field>

        {/* Description with autocomplete */}
        <Field label="Descrição" required htmlFor="f-desc" error={descErr?`⚠️ ${descErr}`:null} errorId="f-desc-err">
          <div style={{position:"relative"}}>
            <input
              id="f-desc"
              maxLength={200}
              ref={descRef}
              style={{...S.inp,borderColor:descErr?"var(--danger)":"var(--border)"}}
              placeholder={type==="receita"?"Ex: Salário, freelance...":"Ex: Conta de luz, aluguel..."}
              value={form.description}
              aria-required="true"
              aria-invalid={descErr?true:undefined}
              aria-describedby={descErr?"f-desc-err":undefined}
              aria-autocomplete="list"
              autoComplete="off"
              onChange={e=>{set("description",e.target.value);setShowSuggestions(true);}}
              onFocus={()=>setShowSuggestions(true)}
              onBlur={()=>setTimeout(()=>setShowSuggestions(false),150)}
            />
            {showSuggestions&&suggestions.length>0&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"var(--surface-raised)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",zIndex:100,overflow:"hidden",boxShadow:"var(--shadow-md)"}}>
                {suggestions.map((s,i)=>{
                  const cat=categories.find(c=>c.id===s.cat);
                  return(
                    <button type="button" key={i}
                      onMouseDown={()=>applySuggestion(s)}
                      style={{width:"100%",padding:"9px 12px",background:"transparent",border:"none",textAlign:"left",cursor:"pointer",fontFamily:"inherit",borderBottom:i<suggestions.length-1?"1px solid var(--border-subtle)":"none",display:"flex",alignItems:"center",gap:8}}
                      onMouseEnter={ev=>ev.currentTarget.style.background="var(--surface-hover)"}
                      onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}>
                      {cat&&<div style={{width:6,height:6,borderRadius:"50%",background:cat.color,flexShrink:0}}/>}
                      <span style={{fontSize:"var(--fs-base)",color:"var(--text-1)",flex:1}}>{s.desc}</span>
                      {cat&&<span style={{fontSize:"var(--fs-xs)",color:cat.color,fontWeight:600}}>{cat.name}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Field>


        <CategoryPicker cats={filteredCats} selected={form.category} onSelect={v=>set("category",v)} entries={entries} type={type} selectorProps={{editCats,setEditCats,addingCat,setAddingCat,newName,setNewName,newColor,setNewColor,usedIds,onAddCat:addCat,onRemoveCat:removeCat}}/>

        {type==="despesa"&&cards.length>0&&<Field label="Pagar com"><div role="group" aria-label="Pagar com" style={{display:"flex",gap:6,flexWrap:"wrap"}}><button type="button" aria-pressed={form.payWith==="saldo"} onClick={()=>set("payWith","saldo")} style={{...S.chipBtn,...(form.payWith==="saldo"?S.chipActive:{})}}>Saldo</button>{cards.map(c=>(<button type="button" key={c.id} aria-pressed={form.payWith===c.id} onClick={()=>{set("payWith",c.id);if(!["none","installment"].includes(form.recurrence))set("recurrence","none");}} style={{...S.chipBtn,...(form.payWith===c.id?{background:tint(c.color,20),border:`1px solid ${tint(c.color,53)}`,color:c.color}:{})}}>{c.name}</button>))}</div>{form.payWith&&form.payWith!=="saldo"&&<div style={{marginTop:6,fontSize:"var(--fs-sm)",color:"var(--text-3)",background:"var(--surface-sunken)",borderRadius:7,padding:"6px 10px",border:"1px solid var(--border)"}}>💳 Lançado diretamente na fatura do cartão{form.recurrence==="installment"?` em ${form.installments||"?"} parcelas`:""}</div>}</Field>}


        {/* Detalhes recolhidos: data, recorrência, status, conta, observação e tags */}
        <button type="button" aria-expanded={open} aria-controls="f-more" onClick={()=>setShowMore(m=>!m)}
          style={{width:"100%",minHeight:48,marginBottom:open?10:14,padding:"0 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:"var(--surface-sunken)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-1)",fontSize:"var(--fs-md)",fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span>{summary}</span>
          <span style={{display:"flex",alignItems:"center",gap:6,color:"var(--text-3)",fontSize:"var(--fs-sm)",fontWeight:500,flexShrink:0}}>Detalhes
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </button>
        {open&&(<div id="f-more">
        <Field label={cardMode?"Data da compra":"Vencimento"}><input style={S.inp} type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></Field>

        <Field label="Recorrência">
          <div role="group" aria-label="Recorrência" style={{display:"flex",gap:6}}>
            {[["none","Único"],...(cardMode?[]:[["repeat","Repete"]]),["installment","Parcelado"]].map(([g,l])=>(
              <button type="button" key={g} aria-pressed={group===g} onClick={()=>pickGroup(g)} style={seg(group===g)}>{l}</button>
            ))}
          </div>
          {group==="repeat"&&(
            <div role="group" aria-label="Frequência" style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
              {repeatTypes.map(([r,l])=><button type="button" key={r} aria-pressed={form.recurrence===r} onClick={()=>set("recurrence",r)} style={{...S.chipBtn,minHeight:40,...(form.recurrence===r?S.chipActive:{})}}>{l}</button>)}
            </div>
          )}
          {form.recurrence==="installment"&&(
            <div style={{marginTop:10}}>
              <label htmlFor="f-parcelas" style={{...S.lbl,marginBottom:5}}>Nº de parcelas</label>
              <input id="f-parcelas" style={{...S.inp,width:90}} type="number" inputMode="numeric" min={2} max={60} value={form.installments} onChange={e=>set("installments",e.target.value)}/>
              {form.amount&&form.installments>1&&(
                <div style={{marginTop:8,background:"var(--surface-sunken)",border:"1px solid var(--accent-border)",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>Total</span>
                  <span style={{fontSize:"var(--fs-md)",fontWeight:700,color:"var(--accent)"}}>{fmt(parseFloat(form.amount))}</span>
                  <span aria-hidden="true" style={{fontSize:"var(--fs-sm)",color:"var(--text-4)"}}>→</span>
                  <span style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>{form.installments}x de</span>
                  <span style={{fontSize:"var(--fs-lg)",fontWeight:700,color:"var(--success)"}}>{fmt(parseFloat(form.amount)/parseInt(form.installments))}</span>
                </div>
              )}
            </div>
          )}
          {(["fixed","weekly","biweekly","quarterly","annual"].includes(form.recurrence))&&(<div style={{marginTop:10}}>
            <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",background:"var(--surface-sunken)",borderRadius:"var(--radius-sm)",padding:"8px 10px",border:"1px solid var(--border)",marginBottom:8}}>
              {form.recurrence==="fixed"&&"💡 Aparece todo mês a partir da data"}
              {form.recurrence==="weekly"&&"💡 Aparece toda semana (4-5x por mês)"}
              {form.recurrence==="biweekly"&&"💡 Aparece a cada 15 dias (2x por mês)"}
              {form.recurrence==="quarterly"&&"💡 Aparece a cada 3 meses"}
              {form.recurrence==="annual"&&"💡 Aparece uma vez por ano"}
            </div>
            <div style={{...S.lbl,marginBottom:5}}>Encerrar em (opcional)</div>
            <MonthPicker value={form.endMonth||""} onChange={v=>set("endMonth",v)} now={new Date().toISOString().substring(0,7)} nullable/>
          </div>)}
        </Field>

        {(type!=="despesa"||!cards.length||form.payWith==="saldo")&&<Field label="Status"><div role="group" aria-label="Status" style={{display:"flex",gap:8}}>{statusOpts.map(([s,l,c])=>(<button type="button" key={s} aria-pressed={form.status===s} onClick={()=>set("status",s)} style={{...S.typeBtn,...(form.status===s?{background:`var(--${c}-soft)`,border:`1px solid var(--${c}-border)`,color:`var(--${c})`}:{})}}>{l}</button>))}</div></Field>}

        {accounts.length>0&&<Field label="Conta (opcional)">
          <div role="group" aria-label="Conta" style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button type="button" aria-pressed={!form.accountId} onClick={()=>set("accountId",null)} style={{...S.chipBtn,...(!form.accountId?S.chipActive:{})}}>Sem conta</button>
            {accounts.map(acc=>(
              <button type="button" key={acc.id} aria-pressed={form.accountId===acc.id} onClick={()=>set("accountId",acc.id)}
                style={{...S.chipBtn,...(form.accountId===acc.id?{background:tint(acc.color,13),border:`1px solid ${tint(acc.color,40)}`,color:acc.color}:{})}}>
                {acc.name}
              </button>
            ))}
          </div>
        </Field>}

        <Field label="Observação (opcional)"><textarea maxLength={500} style={{...S.inp,resize:"none",height:52,lineHeight:1.5}} placeholder="Alguma anotação..." value={form.notes} onChange={e=>set("notes",e.target.value)}/></Field>

        <Field label="Tags (opcional)">
          {(form.tags||[]).length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>{(form.tags||[]).map(t=><button type="button" key={t} aria-label={`Remover tag ${t}`} onClick={()=>set("tags",(form.tags||[]).filter(x=>x!==t))} style={{fontSize:"var(--fs-xs)",padding:"2px 7px",borderRadius:5,background:"var(--accent-soft)",border:"1px solid var(--accent-border)",color:"var(--accent)",cursor:"pointer",fontFamily:"inherit"}}>#{t} ✕</button>)}</div>}
          <input style={S.inp} placeholder="Ex: viagem, fixo, mercado... (Enter para adicionar)" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag(tagInput);}else if(e.key===","||e.key===" "){e.preventDefault();addTag(tagInput);}}}/>
        </Field>

        </div>)}

        {/* Rodapé fixo: o botão de adicionar nunca sai da tela */}
        <div style={{position:"sticky",bottom:-36,margin:"6px -18px -36px",padding:"12px 18px 36px",background:"var(--surface-raised)",borderTop:"1px solid var(--border-subtle)"}}>
          {firstErr&&<div role="alert" style={{marginBottom:10,fontSize:"var(--fs-md)",color:"var(--danger)",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-sm)",padding:"8px 10px"}}>⚠️ {firstErr}</div>}
          <button type="button" aria-disabled={!isValid} onClick={()=>{setTouched({description:true,amount:true,submit:true});if(isValid)onAdd();}} className="submitBtn"
            style={{...S.submitBtn,marginTop:0,opacity:isValid?1:0.45,cursor:isValid?"pointer":"not-allowed",background:type==="receita"?"var(--btn-success-bg)":"var(--primary-bg)",borderColor:type==="receita"?"var(--btn-success-border)":"var(--primary-border)",color:type==="receita"?"var(--btn-success-text)":"var(--orange)"}}>
            Adicionar {type==="receita"?"receita":"despesa"}
          </button>
        </div>
      </div>
    </div>
  );
}
