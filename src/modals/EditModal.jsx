import { useState } from 'react';
import CatSelector from '../components/CatSelector.jsx';
import Field, { useDialog } from "../components/Field.jsx";
import { fmt, eVal, mLabel, originalMonthAmount } from '../utils.js';
import S from "../styles.js";
import { MonthIcon, FutureIcon } from '../components/ScopeIcons.jsx';

export default function EditModal({entry,monthKey,categories,entries,onUpdateCats,onSave,onClose}){
  const [desc,setDesc]=useState(entry.description);
  const initAmt=eVal(entry);
  const origAmt=originalMonthAmount(entry);
  const hasAmtOverride=entry.isRecurring&&!entry.isDivida&&!entry.isFatura&&entry.displayAmount!==undefined&&Math.abs(entry.displayAmount-origAmt)>0.01;
  const [amount,setAmount]=useState(String(initAmt));
  const [displayAmt,setDisplayAmt]=useState(initAmt?initAmt.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'');
  const handleAmtChange=(e)=>{
    const digits=e.target.value.replace(/\D/g,'');
    if(!digits){setDisplayAmt('');setAmount('');return;}
    const num=parseInt(digits,10)/100;
    setDisplayAmt(num.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
    setAmount(String(num));
  };
  const [category,setCategory]=useState(entry.category);
  const [status,setStatus]=useState(entry.statusForMonth??entry.status??"a_pagar");
  const [notes,setNotes]=useState(entry.notes||"");
  const [tags,setTags]=useState(entry.tags||[]);
  const [tagInput,setTagInput]=useState("");
  const addTag=(raw)=>{const t=raw.trim().toLowerCase().replace(/\s+/g,"_");if(!t||tags.includes(t))return;setTags(p=>[...p,t]);setTagInput("");};
  const [editCats,setEditCats]=useState(false);
  const [addingCat,setAddingCat]=useState(false);
  const [newName,setNewName]=useState("");
  const [newColor,setNewColor]=useState("#6C8EEF");
  const filteredCats=categories.filter(c=>c.type==="both"||c.type===entry.type);
  const usedIds=new Set(entries.map(e=>e.category));
  const isDespesa=entry.type==="despesa";
  const addCat=()=>{if(!newName.trim())return;const id=newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_")+"_"+Date.now();onUpdateCats([...categories,{id,name:newName.trim(),color:newColor,type:entry.type}]);setCategory(id);setNewName("");setAddingCat(false);};
  const removeCat=(catId)=>{if(usedIds.has(catId))return;onUpdateCats(categories.filter(c=>c.id!==catId));if(category===catId){const r=filteredCats.filter(c=>c.id!==catId);if(r.length>0)setCategory(r[0].id);}};
  const resolvedStatus=status??entry.statusForMonth??entry.status??"a_pagar";
  const valid=!!desc.trim()&&parseFloat(amount)>0;
  const save=(scope)=>{if(!valid)return;onSave(entry.id,{description:desc.trim(),amount:parseFloat(amount),category,status:resolvedStatus,notes,tags},scope);};
  const ac=isDespesa?"orange":"success";
  const {dialogProps,titleId}=useDialog(onClose);
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div {...dialogProps} style={{...S.modal,outline:"none"}} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}><div><div id={titleId} style={S.mTitle}>Editar Lançamento</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:2}}>{isDespesa?"🔴 Despesa":"🟢 Receita"} · {mLabel(monthKey)}{entry.isRecurring&&<span style={{color:"var(--accent)",marginLeft:5}}>{entry.recurLabel}</span>}</div></div><button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button></div>
        <Field label="Descrição" required error={!desc.trim()?"⚠️ Informe a descrição":null}><input style={{...S.inp,borderColor:!desc.trim()?"var(--danger)":"var(--border)"}} value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label={entry.recurrence==="installment"?"Valor da parcela":"Valor"} htmlFor="e-valor">
          <input id="e-valor" style={S.inp} type="text" inputMode="numeric" autoComplete="off" placeholder="0,00" value={displayAmt} onChange={handleAmtChange}/>
          {entry.isRecurring&&!entry.isDivida&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
              <span style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>
                {entry.recurrence==="installment"?`Parcela ${entry.installmentNum}/${entry.installments} · `:"Recorrente · "}
                valor padrão: <span style={{color:"var(--accent)",fontWeight:600}}>{fmt(origAmt)}</span>
              </span>
              {hasAmtOverride&&(
                <button type="button" onClick={()=>{onSave(entry.id,{_resetAmount:true},"this");}} style={{background:"transparent",border:"1px solid var(--warning-border)",borderRadius:"var(--radius-xs)",padding:"2px 8px",color:"var(--warning)",fontSize:"var(--fs-xs)",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  Restaurar
                </button>
              )}
            </div>
          )}
        </Field>
        <CatSelector cats={filteredCats} selected={category} onSelect={setCategory} editCats={editCats} setEditCats={setEditCats} addingCat={addingCat} setAddingCat={setAddingCat} newName={newName} setNewName={setNewName} newColor={newColor} setNewColor={setNewColor} usedIds={usedIds} onAddCat={addCat} onRemoveCat={removeCat}/>
        <Field label="Observação"><textarea style={{...S.inp,resize:"none",height:52}} placeholder="Alguma anotação..." value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        <Field label="Tags (opcional)">
          {tags.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>{tags.map(t=><button type="button" key={t} aria-label={`Remover tag ${t}`} onClick={()=>setTags(p=>p.filter(x=>x!==t))} style={{fontSize:"var(--fs-xs)",padding:"2px 7px",borderRadius:5,background:"var(--accent-soft)",border:"1px solid var(--accent-border)",color:"var(--accent)",cursor:"pointer",fontFamily:"inherit"}}>#{t} ✕</button>)}</div>}
          <input style={S.inp} placeholder="Adicionar tag (Enter ou vírgula)" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag(tagInput);}else if(e.key===","||e.key===" "){e.preventDefault();addTag(tagInput);}}}/>
        </Field>
        <Field label="Status"><div role="group" aria-label="Status" style={{display:"flex",gap:8}}>{(isDespesa?[["a_pagar","⏳ A Pagar","orange"],["pago","✓ Pago","success"]]:[["a_pagar","⏳ A Receber","orange"],["pago","✓ Recebido","success"]]).map(([s,l,c])=>(<button type="button" key={s} aria-pressed={resolvedStatus===s} onClick={()=>setStatus(s)} style={{...S.typeBtn,...(resolvedStatus===s?{background:`var(--${c}-soft)`,border:`1px solid var(--${c}-border)`,color:`var(--${c})`}:{})}}>{l}</button>))}</div></Field>
        {entry.isRecurring?(
          <div role="group" aria-labelledby="e-aplicar" style={{marginTop:4}}>
            <div id="e-aplicar" style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Aplicar em</div>
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>save("this")} disabled={!valid} style={{...S.scopeBtn,opacity:valid?1:0.45,flex:1,borderColor:"var(--accent-border)",color:"var(--accent)",background:"var(--accent-surface)"}}><MonthIcon/><div><div style={{fontWeight:700,fontSize:"var(--fs-md)"}}>Só este mês</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>{mLabel(monthKey)}</div></div></button>
              <button type="button" onClick={()=>save("future")} disabled={!valid} style={{...S.scopeBtn,opacity:valid?1:0.45,flex:1,borderColor:`var(--${ac}-border)`,color:`var(--${ac})`,background:`var(--${ac}-soft)`}}><FutureIcon/><div><div style={{fontWeight:700,fontSize:"var(--fs-md)"}}>Este e próximos</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>a partir de {mLabel(monthKey)}</div></div></button>
            </div>
          </div>
        ):(
          <button type="button" onClick={()=>save("this")} disabled={!valid} className="submitBtn" style={{...S.submitBtn,marginTop:4,opacity:valid?1:0.45}}>Salvar alterações</button>
        )}
      </div>
    </div>
  );
}
