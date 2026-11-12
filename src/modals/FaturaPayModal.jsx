import { useState } from 'react';
import { fmt } from '../utils.js';
import S, { tint, textOn } from '../styles.js';
import { useDialog } from '../components/Field.jsx';

const btnSecondary={flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"};

export default function FaturaPayModal({entry,onPay,onRevert,onClose}){
  const alreadyPaid=entry.statusForMonth==="pago";
  const [payType,setPayType]=useState("total");
  const remaining=Math.round((entry.displayAmount??entry.amount)*100)/100; // o que ainda falta pagar
  const alreadyPaid2=Math.round((entry.amount-remaining)*100)/100;
  const [partialAmt,setPartialAmt]=useState(String(remaining));
  const isPartial=payType==="partial";
  const {dialogProps,titleId}=useDialog(onClose);
  const partialN=parseFloat(partialAmt);
  const partialOk=partialN>0&&partialN<=remaining+0.004;
  const confirmOk=!isPartial||partialOk;
  const head=(title)=>(
    <div style={S.mHeader}><div><div id={titleId} style={S.mTitle}>{title}</div><div style={{fontSize:"var(--fs-sm)",color:textOn(entry.cardColor),marginTop:2}}>💳 {entry.cardName}</div></div><button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button></div>
  );
  if(alreadyPaid) return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div {...dialogProps} style={{...S.modal,maxHeight:"auto",outline:"none"}} className="modal-in">
        <div style={S.modalHandle}/>
        {head("Fatura paga")}
        <div style={{background:"var(--success-soft)",border:"1px solid var(--success-border)",borderRadius:11,padding:"14px",marginBottom:16,textAlign:"center"}}>
          <div aria-hidden="true" style={{fontSize:"var(--fs-5xl)"}}>✅</div>
          <div style={{fontSize:"var(--fs-lg)",fontWeight:700,color:"var(--success)",marginTop:6}}>Fatura quitada</div>
          <div style={{fontSize:"var(--fs-md)",color:"var(--text-3)",marginTop:4}}>{fmt(entry.amount)}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button type="button" onClick={onClose} style={btnSecondary}>Fechar</button>
          <button type="button" onClick={()=>{onRevert(entry.faturaKey);onClose();}} style={{flex:1,padding:"11px",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",color:"var(--danger)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"}}>↩ Estornar</button>
        </div>
      </div>
    </div>
  );
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div {...dialogProps} style={{...S.modal,maxHeight:"auto",outline:"none"}} className="modal-in">
        <div style={S.modalHandle}/>
        {head("Pagar Fatura")}
        <div style={{background:"var(--surface-sunken)",border:"1px solid var(--border)",borderRadius:11,padding:"12px 14px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginBottom:4}}>{alreadyPaid2>0?"Falta pagar":"Total da fatura"}</div>
          <div style={{fontSize:"var(--fs-6xl)",fontWeight:800,color:textOn(entry.cardColor)}}>{fmt(remaining)}</div>
          {alreadyPaid2>0&&<div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginTop:4}}>Total {fmt(entry.amount)} · já pago {fmt(alreadyPaid2)}</div>}
        </div>
        <div role="group" aria-label="Tipo de pagamento" style={{display:"flex",gap:8,marginBottom:16}}>
          {[["total","✓ Pagar total"],["partial","Pagar parcial"]].map(([t,l])=>(
            <button type="button" key={t} aria-pressed={payType===t} onClick={()=>setPayType(t)}
              style={{flex:1,padding:"10px",background:payType===t?"var(--accent-surface)":"transparent",border:`1px solid ${payType===t?"var(--accent-border)":"var(--border-subtle)"}`,borderRadius:"var(--radius-md)",color:payType===t?"var(--accent)":"var(--text-3)",fontSize:"var(--fs-md)",fontWeight:600,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        {isPartial&&(
          <div style={{marginBottom:16}}>
            <label htmlFor="fatura-valor" style={S.lbl}>Valor pago</label>
            <input id="fatura-valor" style={S.inp} type="number" inputMode="decimal" min="0" max={remaining} step="0.01" value={partialAmt} onChange={e=>setPartialAmt(e.target.value)} aria-describedby={partialAmt&&partialN<remaining?"fatura-aviso":undefined}/>
            {partialAmt&&partialOk&&partialN<remaining&&(
              <div id="fatura-aviso" role="status" style={{marginTop:8,fontSize:"var(--fs-sm)",color:"var(--warning)",background:"var(--warning-soft)",border:"1px solid var(--warning-border)",borderRadius:"var(--radius-sm)",padding:"7px 10px"}}>
                ⚠️ Saldo restante de {fmt(remaining-partialN)} ficará em aberto
              </div>
            )}
          </div>
        )}
        {isPartial&&!partialOk&&<div role="alert" style={{marginTop:-6,marginBottom:12,fontSize:"var(--fs-sm)",color:"var(--danger)"}}>{partialN>remaining?`O valor passa do que falta pagar (${fmt(remaining)})`:"Informe um valor maior que zero"}</div>}
        <div style={{display:"flex",gap:8}}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="button" disabled={!confirmOk} onClick={()=>confirmOk&&onPay(entry,isPartial?partialN:remaining,isPartial&&partialN<remaining-0.004)}
            style={{flex:1,padding:"11px",background:tint(entry.cardColor,13),border:`1px solid ${tint(entry.cardColor,27)}`,borderRadius:"var(--radius-md)",color:textOn(entry.cardColor),fontSize:"var(--fs-base)",fontWeight:700,cursor:confirmOk?"pointer":"not-allowed",opacity:confirmOk?1:0.45}}>
            {isPartial?"Registrar pagamento":"✓ Marcar como paga"}
          </button>
        </div>
      </div>
    </div>
  );
}
