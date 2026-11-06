import { useState } from 'react';
import Field, { useDialog } from '../components/Field.jsx';
import { fmt } from '../utils.js';
import S, { tint } from '../styles.js';

export default function PartialFatModal({ fat, card, onClose, onPay }) {
  const alreadyPaid = fat.paidAmount||0;
  const maxToPay = parseFloat((fat.total - alreadyPaid).toFixed(2));
  const [amount, setAmount] = useState(String(maxToPay));
  const val = parseFloat(amount)||0;
  const remaining = parseFloat((maxToPay - val).toFixed(2));
  const {dialogProps,titleId}=useDialog(onClose);
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div {...dialogProps} style={{...S.modal,maxHeight:"auto",outline:"none"}} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}>
          <div><div id={titleId} style={S.mTitle}>Pagar Fatura</div>
            <div style={{fontSize:"var(--fs-sm)",color:card.color,marginTop:2,fontWeight:600}}>💳 {card.name}</div>
          </div>
          <button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{background:"var(--surface-sunken)",border:`1px solid ${tint(card.color,13)}`,borderRadius:"var(--radius-lg)",padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginBottom:2}}>Total da fatura</div>
          <div style={{fontSize:"var(--fs-5xl)",fontWeight:800,color:card.color}}>{fmt(fat.total)}</div>
        </div>
        <Field label="Valor que será pago (R$)">
          <input style={S.inp} type="number" inputMode="decimal" min="0" step="0.01" max={maxToPay}
            value={amount} onChange={e=>setAmount(e.target.value)}/>
        </Field>
        {val>0&&val<maxToPay&&(
          <div role="status" style={{marginBottom:14,background:"var(--warning-soft)",border:"1px solid var(--warning-border)",borderRadius:"var(--radius-md)",padding:"10px 14px"}}>
            <div style={{fontSize:"var(--fs-sm)",color:"var(--warning)",fontWeight:600,marginBottom:3}}>⚠️ Pagamento parcial</div>
            <div style={{fontSize:"var(--fs-md)",color:"var(--text-2)"}}>Restante <strong style={{color:"var(--danger)"}}>{fmt(remaining)}</strong> ficará como pendente</div>
          </div>
        )}
        {val>=maxToPay&&(
          <div role="status" style={{marginBottom:14,background:"var(--success-soft)",border:"1px solid var(--success-border)",borderRadius:"var(--radius-md)",padding:"10px 14px"}}>
            <div style={{fontSize:"var(--fs-md)",color:"var(--success)",fontWeight:600}}>✓ Pagamento integral</div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button type="button" onClick={onClose} style={{flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button type="button" onClick={()=>val>0&&onPay(fat,val)}
            disabled={!val||val<=0}
            style={{flex:2,padding:"11px",background:`linear-gradient(135deg,${tint(card.color,20)},${tint(card.color,7)})`,border:`1px solid ${tint(card.color,27)}`,borderRadius:"var(--radius-md)",color:card.color,fontSize:"var(--fs-base)",fontWeight:700,cursor:(!val||val<=0)?"not-allowed":"pointer",opacity:(!val||val<=0)?0.4:1}}>
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
