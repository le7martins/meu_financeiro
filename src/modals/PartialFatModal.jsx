import { useState } from 'react';
import Field from '../components/Field.jsx';
import { fmt } from '../utils.js';
import S from '../styles.js';

export default function PartialFatModal({ fat, card, onClose, onPay }) {
  const [amount, setAmount] = useState(String(fat.total));
  const val = parseFloat(amount)||0;
  const remaining = parseFloat((fat.total - val).toFixed(2));
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}>
          <div><div style={S.mTitle}>Pagar Fatura</div>
            <div style={{fontSize:11,color:card.color,marginTop:2,fontWeight:600}}>💳 {card.name}</div>
          </div>
          <button style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{background:"var(--bg)",border:`1px solid ${card.color}22`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--text3)",marginBottom:2}}>Total da fatura</div>
          <div style={{fontSize:22,fontWeight:800,color:card.color}}>{fmt(fat.total)}</div>
        </div>
        <Field label="Valor que será pago (R$)">
          <input style={S.inp} type="number" min="0" step="0.01" max={fat.total}
            value={amount} onChange={e=>setAmount(e.target.value)}/>
        </Field>
        {val>0&&val<fat.total&&(
          <div style={{marginBottom:14,background:"rgba(250,204,21,.08)",border:"1px solid #facc1533",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:"#facc15",fontWeight:600,marginBottom:3}}>⚠️ Pagamento parcial</div>
            <div style={{fontSize:12,color:"var(--text2)"}}>Restante <strong style={{color:"#f87171"}}>{fmt(remaining)}</strong> ficará como pendente</div>
          </div>
        )}
        {val>=fat.total&&(
          <div style={{marginBottom:14,background:"rgba(74,222,128,.08)",border:"1px solid #4ade8033",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:12,color:"#4ade80",fontWeight:600}}>✓ Pagamento integral</div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>val>0&&onPay(fat,val)}
            disabled={!val||val<=0}
            style={{flex:2,padding:"11px",background:`linear-gradient(135deg,${card.color}33,${card.color}11)`,border:`1px solid ${card.color}44`,borderRadius:10,color:card.color,fontSize:13,fontWeight:700,cursor:"pointer",opacity:(!val||val<=0)?0.4:1}}>
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
