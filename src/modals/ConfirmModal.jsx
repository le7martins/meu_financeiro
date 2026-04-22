import S from '../styles.js';

/**
 * Modal de confirmação customizado — substitui window.confirm()
 *
 * Props:
 *   title    — título do modal
 *   message  — mensagem/corpo
 *   detail   — texto extra (opcional, menor)
 *   confirmLabel — texto do botão de confirmação (default: "Confirmar")
 *   cancelLabel  — texto do botão cancelar (default: "Cancelar")
 *   danger   — true → botão confirmar fica vermelho
 *   onConfirm — callback ao confirmar
 *   onClose   — callback ao cancelar/fechar
 */
export default function ConfirmModal({
  title = "Confirmar ação",
  message,
  detail,
  confirmLabel = "Confirmar",
  cancelLabel  = "Cancelar",
  danger = false,
  onConfirm,
  onClose,
}) {
  const confirmColor = danger ? "#f87171" : "#8ab4f8";
  const confirmBg    = danger ? "rgba(248,113,113,.12)" : "rgba(138,180,248,.12)";
  const confirmBorder= danger ? "#f8717144" : "#8ab4f844";

  return (
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal} className="modal-in">
        <div style={S.modalHandle}/>

        {/* Ícone */}
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{width:52,height:52,borderRadius:16,background:danger?"rgba(248,113,113,.1)":"rgba(138,180,248,.1)",border:`1px solid ${confirmBorder}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
            {danger
              ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={confirmColor} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={confirmColor} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 9"/></svg>
            }
          </div>
          <div style={{fontSize:15,fontWeight:700,color:"var(--text1)",marginBottom:6}}>{title}</div>
          {message&&<div style={{fontSize:13,color:"var(--text2)",lineHeight:1.5}}>{message}</div>}
          {detail&&<div style={{fontSize:11,color:"var(--text3)",marginTop:6,lineHeight:1.5}}>{detail}</div>}
        </div>

        {/* Botões */}
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <button onClick={onClose}
            style={{flex:1,padding:"12px",background:"var(--card-bg2)",border:"1px solid var(--border)",borderRadius:12,color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            style={{flex:1,padding:"12px",background:confirmBg,border:`1px solid ${confirmBorder}`,borderRadius:12,color:confirmColor,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
