import { useState, useCallback } from 'react';
import Field, { ModalShell } from "../components/Field.jsx";
import MonthPicker from '../components/MonthPicker.jsx';
import { getNow, mLabel, mShort, addM, fmt, newId } from '../utils.js';
import S, { tint } from "../styles.js";

// ─── Masked currency input ────────────────────────────────────
function CurrencyInput({ id, value, onChange, placeholder = "0,00", style = {} }) {
  const toDisplay = (v) => v > 0 ? parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const [display, setDisplay] = useState(() => toDisplay(parseFloat(value) || 0));
  const handle = useCallback((e) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setDisplay(''); onChange(''); return; }
    const num = parseInt(digits, 10) / 100;
    setDisplay(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    onChange(String(num));
  }, [onChange]);
  return (
    <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder={placeholder} value={display} onChange={handle} style={style}/>
  );
}

export default function DividasScreen({dividas,setDividas,categories,setCategories,nowMonth,toast}){
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [celebrate,setCelebrate]=useState(null);
  const [showQuitadas,setShowQuitadas]=useState(false);
  const BLANK_D={name:"",totalAmount:"",installments:12,startMonth:nowMonth,dueDay:"10",category:"divida",notes:""};
  const [dform,setDform]=useState(BLANK_D);
  const despCats=categories.filter(c=>c.type==="both"||c.type==="despesa");
  const catColor=(id)=>(categories.find(c=>c.id===id)||{color:"var(--danger)"}).color;
  const catName =(id)=>(categories.find(c=>c.id===id)||{name:id}).name;
  const NOW=getNow();

  const handleSave=()=>{
    if(!dform.name.trim()||!dform.totalAmount) return;
    if(editId) setDividas(dividas.map(d=>d.id!==editId?d:{...d,...dform,totalAmount:parseFloat(dform.totalAmount),installments:parseInt(dform.installments)}));
    else setDividas([...dividas,{...dform,id:newId(),totalAmount:parseFloat(dform.totalAmount),installments:parseInt(dform.installments),paidMonths:[]}]);
    setDform(BLANK_D);setShowForm(false);setEditId(null);
    toast(editId?"✓ Dívida atualizada":"✓ Dívida cadastrada");
  };

  const toggleMonth=(d,m)=>{
    const pm=d.paidMonths||[];
    const wasPaid=pm.includes(m);
    const newPm=wasPaid?pm.filter(x=>x!==m):[...pm,m];
    const justQuited=!wasPaid&&newPm.length>=d.installments;
    setDividas(dividas.map(dv=>dv.id!==d.id?dv:{...dv,paidMonths:newPm}));
    if(justQuited){
      setCelebrate(d.id);
      setTimeout(()=>setCelebrate(null),3000);
      toast("🎉 Dívida quitada! Parabéns!","celebrate");
    } else {
      toast(wasPaid?"Parcela marcada como pendente":"✓ Parcela marcada como paga");
    }
  };

  const active  =dividas.filter(d=>(d.paidMonths?.length||0)<d.installments);
  const quitadas=dividas.filter(d=>(d.paidMonths?.length||0)>=d.installments);

  // totais
  const totalEmAberto = active.reduce((s,d)=>s+d.totalAmount-(d.paidMonths?.length||0)*(d.totalAmount/d.installments),0);
  const totalMensal   = active.reduce((s,d)=>s+(d.totalAmount/d.installments),0);

  const openNew=()=>{setDform(BLANK_D);setEditId(null);setShowForm(true);};
  const closeForm=()=>{setShowForm(false);setEditId(null);};
  const canSave=!!dform.name&&!!dform.totalAmount;

  return(
    <div style={{paddingBottom:90}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid var(--border-subtle)"}}>
        <div>
          <div style={{fontSize:"var(--fs-lg)",fontWeight:700,color:"var(--text-1)"}}>Minhas Dívidas</div>
          <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>{dividas.length} dívida{dividas.length!==1?"s":""} cadastrada{dividas.length!==1?"s":""}</div>
        </div>
        <button type="button" onClick={openNew} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:"var(--fs-md)"}}>+ Nova Dívida</button>
      </div>

      {/* Summary cards — só mostra se há dívidas ativas */}
      {active.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"12px 14px 4px"}}>
          <div style={{background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-lg)",padding:"11px 13px"}}>
            <div style={{fontSize:"var(--fs-2xs)",color:"var(--danger)",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700,marginBottom:4}}>Em aberto</div>
            <div style={{fontSize:"var(--fs-2xl)",fontWeight:800,color:"var(--danger)",letterSpacing:"-0.5px"}}>{fmt(Math.max(0,totalEmAberto))}</div>
          </div>
          <div style={{background:"var(--warning-soft)",border:"1px solid var(--warning-border)",borderRadius:"var(--radius-lg)",padding:"11px 13px"}}>
            <div style={{fontSize:"var(--fs-2xs)",color:"var(--warning)",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700,marginBottom:4}}>Total/mês</div>
            <div style={{fontSize:"var(--fs-2xl)",fontWeight:800,color:"var(--warning)",letterSpacing:"-0.5px"}}>{fmt(totalMensal)}</div>
          </div>
        </div>
      )}

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Empty state */}
        {dividas.length===0&&(
          <div style={{...S.empty,flexDirection:"column",padding:"40px 16px",gap:10}}>
            <div aria-hidden="true" style={{width:72,height:72,borderRadius:"var(--radius-2xl)",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>💳</div>
            <div style={{color:"var(--text-2)",fontSize:"var(--fs-xl)",fontWeight:700}}>Nenhuma dívida</div>
            <div style={{color:"var(--text-3)",fontSize:"var(--fs-md)",textAlign:"center",lineHeight:1.5,maxWidth:220}}>Cadastre empréstimos, financiamentos ou qualquer parcelamento de longo prazo.</div>
            <button type="button" onClick={openNew}
              style={{marginTop:4,padding:"10px 20px",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",color:"var(--danger)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"}}>
              + Cadastrar dívida
            </button>
          </div>
        )}

        {/* Active debts */}
        {active.map(d=>{
          const instVal=parseFloat((d.totalAmount/d.installments).toFixed(2));
          const paid=d.paidMonths?.length||0;
          const pct=Math.round((paid/d.installments)*100);
          const remaining=Math.max(0,d.totalAmount-(paid*instVal));
          const endMonth=addM(d.startMonth,d.installments-1);
          const currentDiff=(()=>{const [ay,am]=d.startMonth.split("-").map(Number),[by,bm]=NOW.split("-").map(Number);return(by-ay)*12+(bm-am);})();
          const isCurrent=currentDiff>=0&&currentDiff<d.installments;
          const isPaidThisMonth=d.paidMonths?.includes(NOW);
          const isCelebrating=celebrate===d.id;
          const cc=catColor(d.category);

          return(
            <div key={d.id} style={{background:"var(--surface)",border:`1px solid ${isCelebrating?"var(--success-border)":"var(--border-subtle)"}`,borderRadius:14,overflow:"hidden",transition:"border-color .5s"}}>
              {isCelebrating&&(
                <div role="status" style={{background:"var(--celebrate-bg)",padding:"10px 14px",textAlign:"center",animation:"celebrate 1s ease"}}>
                  <div aria-hidden="true" style={{fontSize:"var(--fs-4xl)"}}>🎉 🎊 ✨</div>
                  <div style={{fontSize:"var(--fs-md)",color:"var(--success)",fontWeight:700,marginTop:2}}>Dívida quitada! Parabéns!</div>
                </div>
              )}
              <div style={{padding:"13px 14px 10px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"var(--fs-lg)",fontWeight:700,color:"var(--text-1)",marginBottom:3}}>{d.name}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{...S.tag,color:cc,borderColor:tint(cc,27),background:tint(cc,9)}}>{catName(d.category)}</span>
                      <span style={{...S.tag,color:"var(--danger)",borderColor:"var(--danger-border)",background:"var(--danger-soft)"}}>💳 {paid}/{d.installments} parcelas</span>
                      <span style={{fontSize:"var(--fs-xs)",color:"var(--text-4)"}}>até {mLabel(endMonth)}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button type="button" className="iconBtn" title="Editar dívida" aria-label={`Editar dívida ${d.name}`} onClick={()=>{setDform({name:d.name,totalAmount:String(d.totalAmount),installments:d.installments,startMonth:d.startMonth,dueDay:d.dueDay||"10",category:d.category||"divida",notes:d.notes||""});setEditId(d.id);setShowForm(true);}}
                      style={{...S.iconBtn,background:"var(--accent-soft)",color:"var(--accent)"}}>
                      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" className="iconBtn" title="Excluir dívida" aria-label={`Excluir dívida ${d.name}`} onClick={()=>setDelId(d.id)} style={{...S.iconBtn,background:"var(--danger-soft)",color:"var(--danger)"}}>✕</button>
                  </div>
                </div>

                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>Progresso de quitação</span>
                    <span style={{fontSize:"var(--fs-md)",fontWeight:700,color:pct>=80?"var(--success)":pct>=50?"var(--warning)":"var(--danger)"}}>{pct}%</span>
                  </div>
                  <div role="progressbar" aria-label={`Progresso de quitação de ${d.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{height:8,background:"var(--track)",borderRadius:4,overflow:"hidden",border:"1px solid var(--border)"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:pct>=80?"var(--progress-success)":"linear-gradient(90deg,var(--danger),var(--orange))",borderRadius:4,transition:"width .6s"}}/>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-sm)",padding:"7px 8px",border:"1px solid var(--border-subtle)"}}><div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:2}}>Total</div><div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--text-1)"}}>{fmt(d.totalAmount)}</div></div>
                  <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-sm)",padding:"7px 8px",border:"1px solid var(--border-subtle)"}}><div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:2}}>Parcela</div><div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--danger)"}}>{fmt(instVal)}</div></div>
                  <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-sm)",padding:"7px 8px",border:"1px solid var(--border-subtle)"}}><div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",marginBottom:2}}>Restante</div><div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:remaining<d.totalAmount*0.3?"var(--success)":"var(--warning)"}}>{fmt(remaining)}</div></div>
                </div>

                {isCurrent&&(
                  <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",background:isPaidThisMonth?"var(--success-soft)":"var(--orange-soft)",borderRadius:9,padding:"9px 12px",border:`1px solid ${isPaidThisMonth?"var(--success-border)":"var(--orange-border)"}`}}>
                    <div>
                      <div style={{fontSize:"var(--fs-sm)",fontWeight:600,color:"var(--text-2)"}}>Parcela de {mLabel(NOW)}</div>
                      <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>{currentDiff+1}/{d.installments} · {fmt(instVal)}</div>
                    </div>
                    <button type="button" onClick={()=>toggleMonth(d,NOW)} className="statusToggleBtn" aria-pressed={!!isPaidThisMonth}
                      style={{...S.badge,background:isPaidThisMonth?"var(--success-soft)":"var(--orange-soft)",color:isPaidThisMonth?"var(--success)":"var(--orange)",border:`1px solid ${isPaidThisMonth?"var(--success-border)":"var(--orange-border)"}`,cursor:"pointer",padding:"5px 10px",fontSize:"var(--fs-xs)"}}>
                      {isPaidThisMonth?"✓ pago":"⏳ a pagar"}
                    </button>
                  </div>
                )}

                {d.notes&&<div style={{marginTop:8,fontSize:"var(--fs-xs)",color:"var(--text-3)",fontStyle:"italic",paddingTop:6,borderTop:"1px solid var(--border-subtle)"}}>💬 {d.notes}</div>}
              </div>

              {/* Installment chips */}
              <div role="group" aria-label={`Parcelas de ${d.name}`} style={{background:"var(--surface-sunken)",borderTop:"1px solid var(--border-subtle)",padding:"8px 14px",display:"flex",gap:4,overflowX:"auto"}} className="hscroll">
                {Array.from({length:d.installments},(_,i)=>{
                  const m=addM(d.startMonth,i);
                  const isPaid=d.paidMonths?.includes(m);
                  const isNow=m===NOW;
                  return(
                    <button type="button" key={m} onClick={()=>toggleMonth(d,m)} aria-pressed={!!isPaid} aria-label={`${mLabel(m)} — ${isPaid?"Pago":"Pendente"}`} title={`${mLabel(m)} — ${isPaid?"Pago":"Pendente"}`}
                      style={{flexShrink:0,width:40,height:40,borderRadius:9,border:`1.5px solid ${isNow?"var(--accent)":(isPaid?"var(--success-border)":"var(--border)")}`,background:isPaid?"var(--success-soft)":isNow?"var(--accent-soft)":"var(--surface-sunken)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:2,transition:"all .15s"}}>
                      <span style={{fontSize:8,color:isPaid?"var(--success)":isNow?"var(--accent)":"var(--text-4)",fontWeight:700,lineHeight:1}}>{mShort(m)}</span>
                      <span style={{fontSize:"var(--fs-sm)",color:isPaid?"var(--success)":isNow?"var(--accent)":"var(--text-4)",lineHeight:1,fontWeight:600}}>{isPaid?"✓":i+1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Paid-off debts */}
        {quitadas.length>0&&(
          <div>
            <button type="button" aria-expanded={showQuitadas} onClick={()=>setShowQuitadas(p=>!p)}
              style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0 8px",fontFamily:"inherit"}}>
              <span style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>✅ Quitadas ({quitadas.length})</span>
              <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showQuitadas?"rotate(180deg)":"none",transition:"transform .2s",marginLeft:"auto"}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showQuitadas&&quitadas.map(d=>(
              <div key={d.id} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"12px 14px",opacity:0.6,display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"var(--fs-base)",fontWeight:600,color:"var(--text-2)"}}>{d.name}</div>
                  <div style={{fontSize:"var(--fs-xs)",color:"var(--success)",marginTop:2}}>✓ Quitada · {d.installments}x de {fmt(parseFloat((d.totalAmount/d.installments).toFixed(2)))} · Total {fmt(d.totalAmount)}</div>
                </div>
                <button type="button" className="iconBtn" title="Excluir dívida" aria-label={`Excluir dívida ${d.name}`} onClick={()=>setDelId(d.id)} style={{...S.iconBtn,background:"var(--danger-soft)",color:"var(--danger)"}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {delId&&(
        <ModalShell title="Excluir dívida" onClose={()=>setDelId(null)} compact handle>
          <div style={{background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
            <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)",marginBottom:2}}>{dividas.find(d=>d.id===delId)?.name}</div>
            <div style={{fontSize:"var(--fs-sm)",color:"var(--danger)"}}>Remove a dívida e todas as parcelas.</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setDelId(null)} style={{flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button type="button" onClick={()=>{setDividas(dividas.filter(d=>d.id!==delId));setDelId(null);toast("Dívida removida","info");}} style={{flex:1,padding:"11px",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",color:"var(--danger)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"}}>Excluir</button>
          </div>
        </ModalShell>
      )}

      {/* Form modal */}
      {showForm&&(
        <ModalShell title={editId?"Editar Dívida":"Nova Dívida"} onClose={closeForm} handle>
          <Field label="Nome da dívida" required><input style={S.inp} placeholder="Ex: Cartão Nubank, Empréstimo..." value={dform.name} onChange={e=>setDform(p=>({...p,name:e.target.value}))}/></Field>
          <div style={{display:"flex",gap:10}}>
            <Field label="Valor total (R$)" required htmlFor="d-valor" style={{flex:1}}>
              <CurrencyInput
                id="d-valor"
                value={parseFloat(dform.totalAmount)||0}
                onChange={v=>setDform(p=>({...p,totalAmount:v}))}
                placeholder="0,00"
                style={S.inp}
              />
            </Field>
            <Field label="Nº de parcelas" style={{flex:1}}><input style={S.inp} type="number" inputMode="numeric" min={1} max={360} value={dform.installments} onChange={e=>setDform(p=>({...p,installments:e.target.value}))}/></Field>
          </div>
          {dform.totalAmount&&parseInt(dform.installments)>0&&(
            <div style={{marginBottom:13,background:"var(--surface-sunken)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>{dform.installments}x de</span>
              <span style={{fontSize:"var(--fs-4xl)",fontWeight:700,color:"var(--danger)"}}>{fmt(parseFloat(dform.totalAmount)/parseInt(dform.installments))}</span>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <Field label="Início" style={{flex:1}}><MonthPicker value={dform.startMonth} onChange={v=>setDform(p=>({...p,startMonth:v}))} now={nowMonth}/></Field>
            <Field label="Dia venc." style={{flex:"0 0 90px"}}><input style={S.inp} type="number" inputMode="numeric" min={1} max={28} value={dform.dueDay} onChange={e=>setDform(p=>({...p,dueDay:e.target.value}))}/></Field>
          </div>
          <div style={{marginBottom:13}} role="group" aria-labelledby="divida-cat-lbl">
            <span id="divida-cat-lbl" style={S.lbl}>Categoria</span>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {despCats.map(cat=>{
                const sel=dform.category===cat.id;
                return(
                  <button type="button" key={cat.id} aria-pressed={sel} onClick={()=>setDform(p=>({...p,category:cat.id}))}
                    style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${sel?cat.color:"transparent"}`,background:sel?tint(cat.color,13):"var(--surface-hover)",color:sel?cat.color:"var(--text-3)",fontSize:"var(--fs-sm)",cursor:"pointer",fontWeight:500}}>
                    <span aria-hidden="true" style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:52}} placeholder="Banco, contrato, anotação..." value={dform.notes} onChange={e=>setDform(p=>({...p,notes:e.target.value}))}/></Field>
          <button type="button" onClick={handleSave} className="submitBtn"
            style={{...S.submitBtn,opacity:canSave?1:0.35,cursor:canSave?"pointer":"not-allowed",background:"var(--btn-danger-bg)",borderColor:"var(--btn-danger-border)",color:"var(--btn-danger-text)"}}
            disabled={!canSave}>{editId?"Salvar alterações":"Cadastrar Dívida"}</button>
        </ModalShell>
      )}
    </div>
  );
}
