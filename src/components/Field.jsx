import { useId, useRef, useEffect, Children, cloneElement, isValidElement } from 'react';
import S from '../styles.js';

// Rótulo + controle. Associa label→input automaticamente (id gerado) quando o filho é um único
// elemento de formulário; `error` liga aria-invalid + aria-describedby; `required` marca o rótulo.
export default function Field({label,children,style,error,required,hint,htmlFor,errorId}){
  const uid=useId();
  const only=Children.count(children)===1&&isValidElement(children)?children:null;
  const isCtl=only&&typeof only.type==="string"&&["input","select","textarea"].includes(only.type);
  const id=htmlFor||(isCtl?(only.props.id||`f${uid}`):undefined);
  const msgId=(error||hint)?(errorId||`${uid}-${error?"err":"hint"}`):undefined;
  const ctl=isCtl?cloneElement(only,{id,"aria-invalid":error?true:undefined,"aria-describedby":msgId,"aria-required":required?true:undefined}):children;
  return(
    <div style={{marginBottom:13,...style}}>
      <label htmlFor={id} style={S.lbl}>{label}{required&&<span aria-hidden="true" style={{color:"var(--danger)",marginLeft:3}}>*</span>}</label>
      {ctl}
      {error&&<div id={msgId} role="alert" style={{fontSize:"var(--fs-sm)",color:"var(--danger)",marginTop:4}}>{error}</div>}
      {!error&&hint&&<div id={msgId} style={{fontSize:"var(--fs-sm)",color:"var(--text-4)",marginTop:4}}>{hint}</div>}
    </div>
  );
}

// Acessibilidade de modal: role=dialog, aria-modal, aria-labelledby (use `id={titleId}` no título),
// Escape fecha, Tab fica preso dentro do diálogo, foco devolvido ao elemento anterior ao fechar.
// Foco automático no 1º campo só com mouse/teclado (em toque abriria o teclado virtual sozinho).
const FOCUSABLE="a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
const finePointer=()=>typeof window!=="undefined"&&window.matchMedia?.("(pointer:fine)")?.matches;
export function useDialog(onClose){
  const ref=useRef(null);
  const titleId=`dlg${useId()}`;
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    const prev=document.activeElement;
    const el=ref.current;
    if(el){
      const first=finePointer()&&el.querySelector("input:not([type=hidden]):not([type=color]):not([disabled]),textarea:not([disabled]),select:not([disabled])");
      (first||el).focus({preventScroll:true});
    }
    return()=>{if(prev&&prev.isConnected&&typeof prev.focus==="function")prev.focus({preventScroll:true});};
  },[]);
  const onKeyDown=e=>{
    if(e.key==="Escape"){e.stopPropagation();closeRef.current&&closeRef.current();return;}
    if(e.key!=="Tab"||!ref.current) return;
    const items=[...ref.current.querySelectorAll(FOCUSABLE)].filter(n=>n.offsetParent!==null||n===document.activeElement);
    if(!items.length){e.preventDefault();return;}
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  const dialogProps={ref,role:"dialog","aria-modal":"true","aria-labelledby":titleId,tabIndex:-1,onKeyDown};
  return{dialogProps,titleId};
}

// Casca de modal acessível (role=dialog, Escape, foco inicial, título associado) + botão fechar.
export function ModalShell({title,subtitle,onClose,compact,handle,children}){
  const {dialogProps,titleId}=useDialog(onClose);
  return(
    <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div {...dialogProps} style={{...S.modal,...(compact?{maxHeight:"none"}:null),outline:"none"}} className="modal-in">
        {handle&&<div style={S.modalHandle}/>}
        <div style={S.mHeader}>
          <div><div id={titleId} style={S.mTitle}>{title}</div>{subtitle}</div>
          <button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
