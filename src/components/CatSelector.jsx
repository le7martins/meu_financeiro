import S, { tint } from '../styles.js';
import { PRESET_COLORS } from '../constants.js';

export default function CatSelector({cats,selected,onSelect,editCats,setEditCats,addingCat,setAddingCat,newName,setNewName,newColor,setNewColor,usedIds,onAddCat,onRemoveCat}){
  return(
    <div style={{marginBottom:13}} role="group" aria-labelledby="catsel-lbl">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span id="catsel-lbl" style={{...S.lbl,marginBottom:0}}>Categoria</span>
        <button type="button" onClick={()=>{setEditCats(p=>!p);setAddingCat(false);}} aria-pressed={!!editCats}
          style={{background:editCats?"var(--accent-soft)":"transparent",border:`1px solid ${editCats?"var(--accent-border)":"var(--border-subtle)"}`,borderRadius:"var(--radius-xs)",padding:"3px 8px",color:editCats?"var(--accent)":"var(--text-3)",fontSize:"var(--fs-xs)",cursor:"pointer",fontWeight:600}}>
          {editCats?"✓ Concluir":"✏ Editar"}
        </button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {cats.map(cat=>{
          const sel=selected===cat.id&&!editCats;
          return(
            <div key={cat.id} style={{position:"relative",display:"inline-flex"}}>
              <button type="button" aria-pressed={sel} onClick={()=>!editCats&&onSelect(cat.id)}
                style={{padding:editCats?"4px 22px 4px 9px":"5px 9px",borderRadius:7,border:`1px solid ${sel?cat.color:"transparent"}`,background:sel?tint(cat.color,13):"var(--surface-hover)",color:sel?cat.color:"var(--text-3)",fontSize:"var(--fs-sm)",cursor:editCats?"default":"pointer",fontWeight:500}}>
                <span aria-hidden="true" style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}
              </button>
              {editCats&&(usedIds.has(cat.id)
                ?<div title="Categoria em uso" role="img" aria-label="Categoria em uso, não pode ser removida" style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"var(--border-strong)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg aria-hidden="true" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5"><path d="M18 11v-3a6 6 0 00-12 0v3"/><rect x="3" y="11" width="18" height="11" rx="2"/></svg></div>
                :<button type="button" aria-label={`Remover categoria ${cat.name}`} onClick={()=>onRemoveCat(cat.id)} style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"var(--danger-strong)",border:"none",color:"var(--danger-on)",fontSize:"var(--fs-2xs)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,padding:0}}>✕</button>)}
            </div>
          );
        })}
        {editCats&&!addingCat&&<button type="button" onClick={()=>setAddingCat(true)} style={{padding:"5px 10px",borderRadius:7,border:"1px dashed var(--accent-border)",background:"transparent",color:"var(--accent)",fontSize:"var(--fs-sm)",cursor:"pointer",fontWeight:600}}>+ Nova</button>}
      </div>
      {addingCat&&(
        <div style={{marginTop:10,background:"var(--surface-sunken)",border:"1px solid var(--accent-border)",borderRadius:11,padding:"12px"}}>
          <div style={{fontSize:"var(--fs-xs)",color:"var(--accent)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Nova categoria</div>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <input style={{...S.inp,flex:1}} aria-label="Nome da categoria" placeholder="Nome" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAddCat()} autoFocus/>
            <label style={{position:"relative",cursor:"pointer",flexShrink:0}} title="Escolher cor">
              <div style={{width:36,height:36,borderRadius:9,background:newColor,border:"2px solid var(--border-strong)",boxShadow:`0 0 10px ${tint(newColor,33)}`}}/>
              <input type="color" aria-label="Cor da categoria" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{position:"absolute",opacity:0,width:1,height:1}}/>
            </label>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
            {PRESET_COLORS.map(c=><button type="button" key={c} aria-label={`Cor ${c}`} aria-pressed={newColor===c} onClick={()=>setNewColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,border:`2px solid ${newColor===c?"var(--text-1)":"transparent"}`,cursor:"pointer",flexShrink:0,padding:0}}/>)}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button type="button" onClick={onAddCat} disabled={!newName.trim()} style={{...S.submitBtn,flex:1,padding:"9px",fontSize:"var(--fs-md)",marginTop:0,opacity:!newName.trim()?0.35:1}}>✓ Adicionar</button>
            <button type="button" onClick={()=>{setAddingCat(false);setNewName("");}} style={{padding:"9px 14px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:9,color:"var(--text-3)",fontSize:"var(--fs-md)",cursor:"pointer"}}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
