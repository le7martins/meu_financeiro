import { useState } from 'react';
import { fmt } from '../utils.js';
import S from '../styles.js';

export default function FaturaPayModal({entry,onPay,onRevert,onClose}){
  const alreadyPaid=entry.statusForMonth==="pago";
  const [payType,setPayType]=useState("total");
  const [partialAmt,setPartialAmt]=useState(String(entry.amount));
  const isPartial=payType==="partial";
  if(alreadyPaid) return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}><div><div style={S.mTitle}>Fatura paga</div><div style={{fontSize:11,color:entry.cardColor,marginTop:2}}>💳 {entry.cardName}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <div style={{background:"rgba(74,222,128,.06)",border:"1px solid #4ade8033",borderRadius:11,padding:"14px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:22}}>✅</div>
          <div style={{fontSize:14,fontWeight:700,color:"#4ade80",marginTop:6}}>Fatura quitada</div>
          <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>{fmt(entry.amount)}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Fechar</button>
          <button onClick={()=>{onRevert(entry.faturaKey);onClose();}} style={{flex:1,padding:"11px",background:"rgba(248,113,113,.12)",border:"1px solid #f8717133",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>↩ Estornar</button>
        </div>
      </div>
    </div>
  );
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}><div><div style={S.mTitle}>Pagar Fatura</div><div style={{fontSize:11,color:entry.cardColor,marginTop:2}}>💳 {entry.cardName}</div></div><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <div style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:11,padding:"12px 14px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:11,color:"var(--text3)",marginBottom:4}}>Total da fatura</div>
          <div style={{fontSize:28,fontWeight:800,color:entry.cardColor}}>{fmt(entry.amount)}</div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["total","✓ Pagar total"],["partial","Pagar parcial"]].map(([t,l])=>(
            <button key={t} onClick={()=>setPayType(t)}
              style={{flex:1,padding:"10px",background:payType===t?"#0d1a2e":"transparent",border:`1px solid ${payType===t?"#1a3a6e":"#111820"}`,borderRadius:10,color:payType===t?"#8ab4f8":"var(--text3)",fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        {isPartial&&(
          <div style={{marginBottom:16}}>
            <label style={S.lbl}>Valor pago (R$)</label>
            <input style={S.inp} type="number" min="0" max={entry.amount} step="0.01" value={partialAmt} onChange={e=>setPartialAmt(e.target.value)}/>
            {partialAmt&&parseFloat(partialAmt)<entry.amount&&(
              <div style={{marginTop:8,fontSize:11,color:"#facc15",background:"rgba(250,204,21,.08)",border:"1px solid rgba(250,204,21,.2)",borderRadius:8,padding:"7px 10px"}}>
                ⚠️ Saldo restante de {fmt(entry.amount-parseFloat(partialAmt))} ficará em aberto
              </div>
            )}
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>onPay(entry,isPartial?parseFloat(partialAmt)||entry.amount:entry.amount,isPartial&&parseFloat(partialAmt)<entry.amount)}
            style={{flex:1,padding:"11px",background:`${entry.cardColor}22`,border:`1px solid ${entry.cardColor}44`,borderRadius:10,color:entry.cardColor,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            {isPartial?"Registrar pagamento":"✓ Marcar como paga"}
          </button>
        </div>
      </div>
    </div>
  );
}
