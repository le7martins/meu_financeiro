import S from '../styles.js';
import { useDialog } from '../components/Field.jsx';
import { MonthIcon, FutureIcon, AllIcon } from '../components/ScopeIcons.jsx';

export default function DeleteModal({entry,onDelete,onClose}){
  const isRec=entry.isRecurring;
  const {dialogProps,titleId}=useDialog(onClose);
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div {...dialogProps} style={{...S.modal,maxHeight:"auto",outline:"none"}} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}><div id={titleId} style={S.mTitle}>Excluir lançamento</div><button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button></div>
        <div style={{background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
          <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)",marginBottom:2}}>{entry.description}</div>
          <div style={{fontSize:"var(--fs-sm)",color:"var(--danger)"}}>{isRec?"Lançamento recorrente — escolha o escopo":"Esta ação não pode ser desfeita"}</div>
        </div>
        {isRec?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button type="button" onClick={()=>onDelete(entry.id,"this")} style={{...S.scopeBtn,borderColor:"var(--accent-border)",color:"var(--accent)",background:"var(--accent-surface)"}}><MonthIcon/><div><div style={{fontWeight:700,fontSize:"var(--fs-md)"}}>Só este mês</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>Os outros meses permanecem</div></div></button>
            <button type="button" onClick={()=>onDelete(entry.id,"future")} style={{...S.scopeBtn,borderColor:"var(--orange-border)",color:"var(--orange)",background:"var(--orange-soft)"}}><FutureIcon/><div><div style={{fontWeight:700,fontSize:"var(--fs-md)"}}>Este e os próximos</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>Meses anteriores permanecem</div></div></button>
            <button type="button" onClick={()=>onDelete(entry.id,"all")} style={{...S.scopeBtn,borderColor:"var(--danger-border)",color:"var(--danger)",background:"var(--danger-soft)"}}><AllIcon/><div><div style={{fontWeight:700,fontSize:"var(--fs-md)"}}>Todos os meses</div></div></button>
          </div>
        ):(
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={onClose} style={{flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button type="button" onClick={()=>onDelete(entry.id,"all")} style={{flex:1,padding:"11px",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",color:"var(--danger)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"}}>Excluir</button>
          </div>
        )}
      </div>
    </div>
  );
}
