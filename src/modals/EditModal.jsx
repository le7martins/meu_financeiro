import { useState } from 'react';
import CatSelector from '../components/CatSelector.jsx';
import Field from '../components/Field.jsx';
import { eVal, mLabel } from '../utils.js';
import S from '../styles.js';

export default function EditModal({entry,monthKey,categories,entries,onUpdateCats,onSave,onClose}){
  const [desc,setDesc]=useState(entry.description);
  const initAmt=eVal(entry);
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
  const ac=isDespesa?"#fb923c":"#4ade80";
  const addCat=()=>{if(!newName.trim())return;const id=newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_")+"_"+Date.now();onUpdateCats([...categories,{id,name:newName.trim(),color:newColor,type:entry.type}]);setCategory(id);setNewName("");setAddingCat(false);};
  const removeCat=(catId)=>{if(usedIds.has(catId))return;onUpdateCats(categories.filter(c=>c.id!==catId));if(category===catId){const r=filteredCats.filter(c=>c.id!==catId);if(r.length>0)setCategory(r[0].id);}};
  const resolvedStatus=status??entry.statusForMonth??entry.status??"a_pagar";
  const save=(scope)=>onSave(entry.id,{description:desc,amount:parseFloat(amount)||eVal(entry),category,status:resolvedStatus,notes,tags},scope);
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}><div><div style={S.mTitle}>Editar Lançamento</div><div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>{isDespesa?"🔴 Despesa":"🟢 Receita"} · {mLabel(monthKey)}{entry.isRecurring&&<span style={{color:"#8ab4f8",marginLeft:5}}>{entry.recurLabel}</span>}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <Field label="Descrição"><input style={S.inp} value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label={entry.recurrence==="installment"?"Valor da parcela":"Valor (R$)"}><input style={S.inp} type="text" inputMode="numeric" placeholder="0,00" value={displayAmt} onChange={handleAmtChange}/>{entry.recurrence==="installment"&&<div style={{marginTop:5,fontSize:11,color:"var(--text3)"}}>Parcela {entry.installmentNum}/{entry.installments}</div>}</Field>
        <CatSelector cats={filteredCats} selected={category} onSelect={setCategory} editCats={editCats} setEditCats={setEditCats} addingCat={addingCat} setAddingCat={setAddingCat} newName={newName} setNewName={setNewName} newColor={newColor} setNewColor={setNewColor} usedIds={usedIds} onAddCat={addCat} onRemoveCat={removeCat}/>
        <Field label="Observação"><textarea style={{...S.inp,resize:"none",height:52}} placeholder="Alguma anotação..." value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        <Field label="Tags (opcional)">
          {tags.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>{tags.map(t=><button key={t} onClick={()=>setTags(p=>p.filter(x=>x!==t))} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"rgba(138,180,248,.15)",border:"1px solid #8ab4f833",color:"#8ab4f8",cursor:"pointer",fontFamily:"inherit"}}>#{t} ✕</button>)}</div>}
          <input style={S.inp} placeholder="Adicionar tag (Enter ou vírgula)" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag(tagInput);}else if(e.key===","||e.key===" "){e.preventDefault();addTag(tagInput);}}}/>
        </Field>
        <Field label="Status"><div style={{display:"flex",gap:8}}>{(isDespesa?[["a_pagar","⏳ A Pagar","#fb923c"],["pago","✓ Pago","#4ade80"]]:[["a_pagar","⏳ A Receber","#fb923c"],["pago","✓ Recebido","#4ade80"]]).map(([s,l,c])=>(<button key={s} onClick={()=>setStatus(s)} style={{...S.typeBtn,...(resolvedStatus===s?{background:c+"20",border:`1px solid ${c}44`,color:c}:{})}}>{l}</button>))}</div></Field>
        {entry.isRecurring?(<div style={{marginTop:4}}><div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Aplicar em</div><div style={{display:"flex",gap:8}}><button onClick={()=>save("this")} style={{...S.scopeBtn,flex:1,borderColor:"#1a3a6e",color:"#8ab4f8",background:"#0d1a2e"}}><span style={{fontSize:16}}>📅</span><div><div style={{fontWeight:700,fontSize:12}}>Só este mês</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{mLabel(monthKey)}</div></div></button><button onClick={()=>save("future")} style={{...S.scopeBtn,flex:1,borderColor:ac+"44",color:ac,background:ac+"12"}}><span style={{fontSize:16}}>📆</span><div><div style={{fontWeight:700,fontSize:12}}>Este e próximos</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>a partir de {mLabel(monthKey)}</div></div></button></div></div>):(<button onClick={()=>save("this")} className="submitBtn" style={{...S.submitBtn,marginTop:4}}>Salvar alterações</button>)}
      </div>
    </div>
  );
}
