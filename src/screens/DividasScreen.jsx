import { useState, useCallback } from 'react';
import Field from '../components/Field.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import { getNow, mLabel, mShort, addM, fmt } from '../utils.js';
import S from '../styles.js';

// ─── Masked currency input ────────────────────────────────────
function CurrencyInput({ value, onChange, placeholder = "0,00", style = {} }) {
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
    <input type="text" inputMode="numeric" placeholder={placeholder} value={display} onChange={handle} style={style}/>
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
  const catColor=(id)=>(categories.find(c=>c.id===id)||{color:"#f87171"}).color;
  const catName =(id)=>(categories.find(c=>c.id===id)||{name:id}).name;
  const NOW=getNow();

  const handleSave=()=>{
    if(!dform.name.trim()||!dform.totalAmount) return;
    if(editId) setDividas(dividas.map(d=>d.id!==editId?d:{...d,...dform,totalAmount:parseFloat(dform.totalAmount),installments:parseInt(dform.installments)}));
    else setDividas([...dividas,{...dform,id:Date.now().toString(),totalAmount:parseFloat(dform.totalAmount),installments:parseInt(dform.installments),paidMonths:[]}]);
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

  return(
    <div style={{paddingBottom:90}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid var(--border2)"}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>Minhas Dívidas</div>
          <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{dividas.length} dívida{dividas.length!==1?"s":""} cadastrada{dividas.length!==1?"s":""}</div>
        </div>
        <button onClick={()=>{setDform(BLANK_D);setEditId(null);setShowForm(true);}} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:12}}>+ Nova Dívida</button>
      </div>

      {/* Summary cards — só mostra se há dívidas ativas */}
      {active.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"12px 14px 4px"}}>
          <div style={{background:"rgba(248,113,113,.07)",border:"1px solid #f8717133",borderRadius:12,padding:"11px 13px"}}>
            <div style={{fontSize:9,color:"#f87171",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700,marginBottom:4}}>Em aberto</div>
            <div style={{fontSize:16,fontWeight:800,color:"#f87171",letterSpacing:"-0.5px"}}>{fmt(Math.max(0,totalEmAberto))}</div>
          </div>
          <div style={{background:"rgba(250,204,21,.07)",border:"1px solid #facc1533",borderRadius:12,padding:"11px 13px"}}>
            <div style={{fontSize:9,color:"#facc15",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700,marginBottom:4}}>Total/mês</div>
            <div style={{fontSize:16,fontWeight:800,color:"#facc15",letterSpacing:"-0.5px"}}>{fmt(totalMensal)}</div>
          </div>
        </div>
      )}

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Empty state */}
        {dividas.length===0&&(
          <div style={{...S.empty,flexDirection:"column",padding:"40px 16px",gap:10}}>
            <div style={{width:72,height:72,borderRadius:20,background:"rgba(248,113,113,.08)",border:"1px solid #f8717133",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>💳</div>
            <div style={{color:"var(--text2)",fontSize:15,fontWeight:700}}>Nenhuma dívida</div>
            <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",lineHeight:1.5,maxWidth:220}}>Cadastre empréstimos, financiamentos ou qualquer parcelamento de longo prazo.</div>
            <button onClick={()=>{setDform(BLANK_D);setEditId(null);setShowForm(true);}}
              style={{marginTop:4,padding:"10px 20px",background:"rgba(248,113,113,.1)",border:"1px solid #f8717133",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>
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

          return(
            <div key={d.id} style={{background:"var(--card-bg)",border:`1px solid ${isCelebrating?"#4ade8055":"#111820"}`,borderRadius:14,overflow:"hidden",transition:"border-color .5s"}}>
              {isCelebrating&&(
                <div style={{background:"linear-gradient(90deg,#0a2a1a,#0d3520,#0a2a1a)",padding:"10px 14px",textAlign:"center",animation:"celebrate 1s ease"}}>
                  <div style={{fontSize:20}}>🎉 🎊 ✨</div>
                  <div style={{fontSize:12,color:"#4ade80",fontWeight:700,marginTop:2}}>Dívida quitada! Parabéns!</div>
                </div>
              )}
              <div style={{padding:"13px 14px 10px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text1)",marginBottom:3}}>{d.name}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{...S.tag,color:catColor(d.category),borderColor:catColor(d.category)+"44",background:catColor(d.category)+"18"}}>{catName(d.category)}</span>
                      <span style={{...S.tag,color:"#f87171",borderColor:"#f8717144",background:"rgba(248,113,113,.1)"}}>💳 {paid}/{d.installments} parcelas</span>
                      <span style={{fontSize:10,color:"var(--text4)"}}>até {mLabel(endMonth)}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button className="iconBtn" onClick={()=>{setDform({name:d.name,totalAmount:String(d.totalAmount),installments:d.installments,startMonth:d.startMonth,dueDay:d.dueDay||"10",category:d.category||"divida",notes:d.notes||""});setEditId(d.id);setShowForm(true);}}
                      style={{...S.iconBtn,background:"rgba(138,180,248,.1)",color:"#8ab4f8"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="iconBtn" onClick={()=>setDelId(d.id)} style={{...S.iconBtn,background:"rgba(239,68,68,.1)",color:"#f87171"}}>✕</button>
                  </div>
                </div>

                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:11,color:"var(--text3)"}}>Progresso de quitação</span>
                    <span style={{fontSize:12,fontWeight:700,color:pct>=80?"#4ade80":pct>=50?"#facc15":"#f87171"}}>{pct}%</span>
                  </div>
                  <div style={{height:8,background:"var(--bg)",borderRadius:4,overflow:"hidden",border:"1px solid var(--border)"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:pct>=80?"linear-gradient(90deg,#4ade80,#34d399)":"linear-gradient(90deg,#f87171,#fb923c)",borderRadius:4,transition:"width .6s"}}/>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 8px",border:"1px solid var(--border2)"}}><div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Total</div><div style={{fontSize:11,fontWeight:700,color:"var(--text1)"}}>{fmt(d.totalAmount)}</div></div>
                  <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 8px",border:"1px solid var(--border2)"}}><div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Parcela</div><div style={{fontSize:11,fontWeight:700,color:"#f87171"}}>{fmt(instVal)}</div></div>
                  <div style={{background:"var(--bg)",borderRadius:8,padding:"7px 8px",border:"1px solid var(--border2)"}}><div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Restante</div><div style={{fontSize:11,fontWeight:700,color:remaining<d.totalAmount*0.3?"#4ade80":"#facc15"}}>{fmt(remaining)}</div></div>
                </div>

                {isCurrent&&(
                  <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",background:isPaidThisMonth?"rgba(74,222,128,.07)":"rgba(251,146,60,.07)",borderRadius:9,padding:"9px 12px",border:`1px solid ${isPaidThisMonth?"#4ade8022":"#fb923c22"}`}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--text2)"}}>Parcela de {mLabel(NOW)}</div>
                      <div style={{fontSize:10,color:"var(--text3)"}}>{currentDiff+1}/{d.installments} · {fmt(instVal)}</div>
                    </div>
                    <button onClick={()=>toggleMonth(d,NOW)} className="statusToggleBtn"
                      style={{...S.badge,background:isPaidThisMonth?"rgba(74,222,128,.15)":"rgba(251,146,60,.15)",color:isPaidThisMonth?"#4ade80":"#fb923c",border:`1px solid ${isPaidThisMonth?"#4ade8033":"#fb923c33"}`,cursor:"pointer",padding:"5px 10px",fontSize:10}}>
                      {isPaidThisMonth?"✓ pago":"⏳ a pagar"}
                    </button>
                  </div>
                )}

                {d.notes&&<div style={{marginTop:8,fontSize:10,color:"var(--text3)",fontStyle:"italic",paddingTop:6,borderTop:"1px solid var(--border2)"}}>💬 {d.notes}</div>}
              </div>

              {/* Installment chips */}
              <div style={{background:"var(--bg)",borderTop:"1px solid #111820",padding:"8px 14px",display:"flex",gap:4,overflowX:"auto"}} className="hscroll">
                {Array.from({length:d.installments},(_,i)=>{
                  const m=addM(d.startMonth,i);
                  const isPaid=d.paidMonths?.includes(m);
                  const isNow=m===NOW;
                  return(
                    <button key={m} onClick={()=>toggleMonth(d,m)} title={`${mLabel(m)} — ${isPaid?"Pago":"Pendente"}`}
                      style={{flexShrink:0,width:40,height:40,borderRadius:9,border:`1.5px solid ${isNow?"#8ab4f8":(isPaid?"#4ade8055":"var(--border)")}`,background:isPaid?"rgba(74,222,128,.18)":isNow?"rgba(138,180,248,.12)":"var(--bg)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:2,transition:"all .15s"}}>
                      <span style={{fontSize:8,color:isPaid?"#4ade80":isNow?"#8ab4f8":"var(--text4)",fontWeight:700,lineHeight:1}}>{mShort(m)}</span>
                      <span style={{fontSize:11,color:isPaid?"#4ade80":isNow?"#8ab4f8":"var(--text4)",lineHeight:1,fontWeight:600}}>{isPaid?"✓":i+1}</span>
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
            <button onClick={()=>setShowQuitadas(p=>!p)}
              style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0 8px",fontFamily:"inherit"}}>
              <span style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>✅ Quitadas ({quitadas.length})</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text4)" strokeWidth="2.5" strokeLinecap="round"
                style={{transform:showQuitadas?"rotate(180deg)":"none",transition:"transform .2s",marginLeft:"auto"}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showQuitadas&&quitadas.map(d=>(
              <div key={d.id} style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 14px",opacity:0.6,display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>{d.name}</div>
                  <div style={{fontSize:10,color:"#4ade80",marginTop:2}}>✓ Quitada · {d.installments}x de {fmt(parseFloat((d.totalAmount/d.installments).toFixed(2)))} · Total {fmt(d.totalAmount)}</div>
                </div>
                <button className="iconBtn" onClick={()=>setDelId(d.id)} style={{...S.iconBtn,background:"rgba(239,68,68,.1)",color:"#f87171"}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {delId&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDelId(null)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.modalHandle}/>
            <div style={S.mHeader}><div style={S.mTitle}>Excluir dívida</div><button style={S.xBtn} onClick={()=>setDelId(null)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:2}}>{dividas.find(d=>d.id===delId)?.name}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove a dívida e todas as parcelas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelId(null)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>{setDividas(dividas.filter(d=>d.id!==delId));setDelId(null);toast("Dívida removida","info");}} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&(setShowForm(false),setEditId(null))}>
          <div style={S.modal} className="modal-in">
            <div style={S.modalHandle}/>
            <div style={S.mHeader}><div style={S.mTitle}>{editId?"Editar Dívida":"Nova Dívida"}</div><button style={S.xBtn} onClick={()=>{setShowForm(false);setEditId(null);}}>✕</button></div>
            <Field label="Nome da dívida"><input style={S.inp} placeholder="Ex: Cartão Nubank, Empréstimo..." value={dform.name} onChange={e=>setDform(p=>({...p,name:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Valor total (R$)" style={{flex:1}}>
                <CurrencyInput
                  value={parseFloat(dform.totalAmount)||0}
                  onChange={v=>setDform(p=>({...p,totalAmount:v}))}
                  placeholder="0,00"
                  style={S.inp}
                />
              </Field>
              <Field label="Nº de parcelas" style={{flex:1}}><input style={S.inp} type="number" min={1} max={360} value={dform.installments} onChange={e=>setDform(p=>({...p,installments:e.target.value}))}/></Field>
            </div>
            {dform.totalAmount&&parseInt(dform.installments)>0&&(
              <div style={{marginBottom:13,background:"var(--bg)",border:"1px solid #f8717133",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"var(--text3)"}}>{dform.installments}x de</span>
                <span style={{fontSize:20,fontWeight:700,color:"#f87171"}}>{fmt(parseFloat(dform.totalAmount)/parseInt(dform.installments))}</span>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <Field label="Início" style={{flex:1}}><MonthPicker value={dform.startMonth} onChange={v=>setDform(p=>({...p,startMonth:v}))} now={nowMonth}/></Field>
              <Field label="Dia venc." style={{flex:"0 0 90px"}}><input style={S.inp} type="number" min={1} max={28} value={dform.dueDay} onChange={e=>setDform(p=>({...p,dueDay:e.target.value}))}/></Field>
            </div>
            <div style={{marginBottom:13}}>
              <label style={S.lbl}>Categoria</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {despCats.map(cat=>(
                  <button key={cat.id} onClick={()=>setDform(p=>({...p,category:cat.id}))}
                    style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${dform.category===cat.id?cat.color:"transparent"}`,background:dform.category===cat.id?cat.color+"22":"rgba(255,255,255,.05)",color:dform.category===cat.id?cat.color:"var(--text3)",fontSize:11,cursor:"pointer",fontWeight:500}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:52}} placeholder="Banco, contrato, anotação..." value={dform.notes} onChange={e=>setDform(p=>({...p,notes:e.target.value}))}/></Field>
            <button onClick={handleSave} className="submitBtn"
              style={{...S.submitBtn,opacity:(!dform.name||!dform.totalAmount)?0.35:1,cursor:(!dform.name||!dform.totalAmount)?"not-allowed":"pointer",background:"linear-gradient(135deg,#4a1a1a,#2a0d0d)",borderColor:"#f8717133",color:"#f87171"}}
              disabled={!dform.name||!dform.totalAmount}>{editId?"Salvar alterações":"Cadastrar Dívida"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
