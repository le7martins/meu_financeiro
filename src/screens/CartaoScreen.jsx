import { useState } from 'react';
import Field from '../components/Field.jsx';
import { getBillingMonth, buildFatura, getCardBillingMonths } from '../logic.js';
import { fmt, fmtDate, mLabel, mShort, addM, TODAY } from '../utils.js';
import { CARD_COLORS } from '../constants.js';
import S from '../styles.js';

export default function CartaoScreen({cards,setCards,cardPurchases,setCardPurchases,cardFaturas,setCardFaturas,categories,nowMonth,toast,onRevertFatura}){
  const [showCardForm,setShowCardForm]=useState(false);
  const [showPurchaseForm,setShowPurchaseForm]=useState(false);
  const [activeCardId,setActiveCardId]=useState(null);
  const [editCardId,setEditCardId]=useState(null);
  const [delCardId,setDelCardId]=useState(null);
  const [delPurchId,setDelPurchId]=useState(null);
  const [editPurch,setEditPurch]=useState(null);
  const [expandedM,setExpandedM]=useState({});
  const [cardForm,setCardForm]=useState({name:"",limit:"",closeDay:"20",dueDay:"5",color:CARD_COLORS[0]});
  const [purchForm,setPurchForm]=useState({description:"",amount:"",installments:1,purchaseDate:TODAY,category:"outro",notes:""});
  const BLANK_CARD={name:"",limit:"",closeDay:"20",dueDay:"5",color:CARD_COLORS[0]};
  const BLANK_PURCH={description:"",amount:"",installments:1,purchaseDate:TODAY,category:"outro",notes:""};
  const activeCard=cards.find(c=>c.id===activeCardId)||null;
  const toggleM=(key)=>setExpandedM(p=>({...p,[key]:!p[key]}));
  const openEditCard=(card)=>{setEditCardId(card.id);setCardForm({name:card.name,limit:String(card.limit||""),closeDay:String(card.closeDay),dueDay:String(card.dueDay),color:card.color});setShowCardForm(true);};
  const closeCardForm=()=>{setShowCardForm(false);setCardForm(BLANK_CARD);setEditCardId(null);};

  const handleSaveCard=()=>{
    if(!cardForm.name.trim()) return;
    const data={...cardForm,limit:parseFloat(cardForm.limit)||0,closeDay:parseInt(cardForm.closeDay)||20,dueDay:parseInt(cardForm.dueDay)||5};
    if(editCardId){
      setCards(cards.map(c=>c.id!==editCardId?c:{...c,...data}));
      toast("✓ Cartão atualizado");
    } else {
      setCards([...cards,{id:Date.now().toString(),...data}]);
      toast("💳 Cartão adicionado");
    }
    closeCardForm();
  };
  const handleSavePurchase=()=>{
    if(!purchForm.description.trim()||!purchForm.amount||!activeCardId) return;
    const p={id:Date.now().toString(),cardId:activeCardId,...purchForm,amount:parseFloat(purchForm.amount),installments:parseInt(purchForm.installments)||1};
    setCardPurchases([p,...cardPurchases]);setPurchForm(BLANK_PURCH);setShowPurchaseForm(false);
    toast("✓ Compra lançada");
  };
  const handleDeleteCard=(id)=>{
    setCards(cards.filter(c=>c.id!==id));
    setCardPurchases(cardPurchases.filter(p=>p.cardId!==id));
    const nf={...cardFaturas};Object.keys(nf).forEach(k=>{if(k.startsWith(id+"_"))delete nf[k];});
    setCardFaturas(nf);setDelCardId(null);toast("Cartão removido","info");
  };
  const handleDeletePurch=(id)=>{setCardPurchases(cardPurchases.filter(p=>p.id!==id));setDelPurchId(null);toast("Compra removida","info");};
  const handleEditPurch=()=>{
    if(!editPurch||!editPurch.description.trim()||!editPurch.amount) return;
    setCardPurchases(cardPurchases.map(p=>p.id!==editPurch.id?p:{...p,...editPurch,amount:parseFloat(editPurch.amount),installments:parseInt(editPurch.installments)||1}));
    setEditPurch(null);toast("✓ Compra atualizada");
  };

  return(
    <div style={{paddingBottom:90}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid var(--border2)"}}>
        <div><div style={{fontSize:14,fontWeight:700,color:"var(--text1)"}}>Meus Cartões</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{cards.length} cartão{cards.length!==1?"ões":""} cadastrado{cards.length!==1?"s":""}</div></div>
        <button onClick={()=>{setCardForm(BLANK_CARD);setShowCardForm(true);}} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:12}}>+ Novo Cartão</button>
      </div>

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:14}}>
        {cards.length===0&&<div style={S.empty}><div style={{fontSize:36,opacity:0.3,marginBottom:8}}>💳</div><div style={{color:"var(--text4)",fontSize:14,fontWeight:600}}>Nenhum cartão cadastrado</div><div style={{color:"var(--text4)",fontSize:12,marginTop:3}}>Adicione um cartão para controlar suas faturas</div></div>}

        {cards.map(card=>{
          const allBillings=getCardBillingMonths(card,cardPurchases);
          const futureMths=Array.from({length:6},(_,i)=>addM(nowMonth,i));
          const allMonths=[...new Set([...allBillings,...futureMths])].sort().reverse();
          const displayMonths=allMonths.filter(bm=>{
            if(bm===nowMonth) return true;
            const f=buildFatura(card,cardPurchases,cardFaturas,bm);
            return f.total>0;
          });
          const usedLimit=cardPurchases.filter(p=>p.cardId===card.id).reduce((s,p)=>{
            const base=getBillingMonth(p.purchaseDate,card.closeDay);
            const inst=parseInt(p.installments)||1;
            for(let i=0;i<inst;i++){const bm=addM(base,i);if(bm>=nowMonth){const fat=cardFaturas[`${card.id}_${bm}`];if(!fat?.paid)s+=parseFloat((p.amount/inst).toFixed(2));}}
            return s;
          },0);
          const limitPct=card.limit>0?Math.min(100,(usedLimit/card.limit)*100):0;

          return(
            <div key={card.id} style={{background:"var(--card-bg)",borderRadius:18,overflow:"hidden",border:`1px solid ${card.color}22`}}>
              <div style={{background:`linear-gradient(135deg,${card.color}33,${card.color}11)`,padding:"16px 16px 14px",borderBottom:`1px solid ${card.color}22`}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{card.name}</div>
                    <div style={{fontSize:10,color:`${card.color}bb`,marginTop:2}}>Fecha dia {card.closeDay} · Vence dia {card.dueDay} do mês seguinte</div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <button className="iconBtn" onClick={()=>{setActiveCardId(card.id);setPurchForm(BLANK_PURCH);setShowPurchaseForm(true);}}
                      style={{...S.iconBtn,background:`${card.color}22`,color:card.color,width:30,height:30,borderRadius:9}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button className="iconBtn" title="Editar cartão" onClick={()=>openEditCard(card)}
                      style={{...S.iconBtn,background:`${card.color}22`,color:card.color,width:30,height:30,borderRadius:9,fontSize:13}}>✏</button>
                    <button className="iconBtn" onClick={()=>setDelCardId(card.id)} style={{...S.iconBtn,background:"rgba(239,68,68,.1)",color:"#f87171",width:30,height:30,borderRadius:9}}>✕</button>
                  </div>
                </div>
                {card.limit>0&&(<div style={{marginTop:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:10,color:`${card.color}99`}}>Limite utilizado</span>
                    <span style={{fontSize:11,fontWeight:700,color:limitPct>80?"#f87171":limitPct>60?"#facc15":card.color}}>{limitPct.toFixed(0)}%</span>
                  </div>
                  <div style={{height:5,background:"rgba(255,255,255,.08)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${limitPct}%`,background:limitPct>80?"#f87171":limitPct>60?"#facc15":card.color,borderRadius:3,transition:"width .5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <span style={{fontSize:9,color:"var(--text3)"}}>Usado: {fmt(usedLimit)}</span>
                    <span style={{fontSize:9,color:"var(--text3)"}}>Disponível: {fmt(Math.max(0,card.limit-usedLimit))}</span>
                  </div>
                </div>)}
              </div>

              <div style={{overflowX:"auto",padding:"10px 14px 6px",borderBottom:`1px solid ${card.color}11`}}>
                <div style={{display:"flex",gap:8,minWidth:"max-content"}}>
                  {futureMths.map(bm=>{
                    const f=buildFatura(card,cardPurchases,cardFaturas,bm);
                    const isNow=bm===nowMonth;
                    return(
                      <div key={bm} style={{textAlign:"center",minWidth:58,background:isNow?`${card.color}18`:"var(--bg)",borderRadius:9,padding:"6px 4px",border:`1px solid ${isNow?card.color+"44":"var(--border2)"}`}}>
                        <div style={{fontSize:9,color:isNow?card.color:"var(--text4)",fontWeight:isNow?700:400,marginBottom:3}}>{mShort(bm)}{isNow?" ●":""}</div>
                        <div style={{fontSize:12,fontWeight:700,color:f.total>0?card.color:"var(--text4)"}}>{f.total>0?fmt(f.total):"—"}</div>
                        <div style={{fontSize:8,marginTop:2,color:f.paid?"#4ade80":f.open?"#facc15":f.total>0?"#fb923c":"transparent"}}>
                          {f.paid?"✓ pago":f.open?"em aberto":f.total>0?"a pagar":""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column"}}>
                {displayMonths.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:"var(--text4)",fontSize:11}}>Nenhuma compra neste cartão</div>}
                {displayMonths.map((bm,idx)=>{
                  const fat=buildFatura(card,cardPurchases,cardFaturas,bm);
                  const key=`${card.id}_${bm}`;
                  const isExp=expandedM[key]!=null?expandedM[key]:bm===nowMonth;
                  const isFuture=bm>nowMonth;
                  const statusColor=fat.paid?"#4ade80":fat.open?"#facc15":fat.total>0?"#fb923c":"var(--text4)";
                  const statusLabel=fat.paid?"✓ pago":fat.open?"🔄 aberta":fat.total>0?"⏳ a pagar":"—";
                  return(
                    <div key={bm} style={{borderBottom:idx<displayMonths.length-1?"1px solid var(--border2)":"none"}}>
                      <button onClick={()=>toggleM(key)}
                        style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:700,color:"var(--text1)"}}>{mLabel(bm)}{isFuture&&<span style={{marginLeft:6,fontSize:9,color:card.color,fontWeight:500}}>parcelas futuras</span>}</div>
                          <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>
                            {fat.open?`Fecha em ${fmtDate(fat.closeDate)}`:fat.total>0?`Vence ${fmtDate(fat.dueDate)}`:"Sem compras"}
                          </div>
                        </div>
                        <div style={{textAlign:"right",marginRight:6}}>
                          <div style={{fontSize:13,fontWeight:800,color:fat.total>0?card.color:"var(--text4)"}}>{fat.total>0?fmt(fat.total):"—"}</div>
                          <div style={{fontSize:9,color:statusColor,marginTop:1}}>{statusLabel}</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text4)" strokeWidth="2.5" strokeLinecap="round" style={{transform:isExp?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      {isExp&&(
                        <div style={{padding:"0 14px 12px",display:"flex",flexDirection:"column",gap:4}}>
                          {fat.items.length===0&&<div style={{textAlign:"center",padding:"8px 0",color:"var(--text4)",fontSize:11}}>Nenhuma compra nesta fatura</div>}
                          {fat.items.map(item=>(
                            <div key={item.id+item.installmentNum} style={{display:"flex",alignItems:"center",gap:8,background:"var(--bg)",borderRadius:8,padding:"7px 10px",border:"1px solid var(--border2)"}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,color:"var(--text2)",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.description}</div>
                                <div style={{fontSize:9,color:"var(--text3)",marginTop:1,display:"flex",gap:6}}>
                                  {item.total>1&&<span style={{color:card.color,fontWeight:600}}>📋 {item.installmentNum}/{item.total}x</span>}
                                  {item.total>1&&<span>Total: {fmt(item.originalAmount||item.amount*item.total)}</span>}
                                </div>
                              </div>
                              <div style={{fontSize:12,fontWeight:700,color:card.color}}>{fmt(item.amount)}</div>
                              {!fat.paid&&(<>
                                <button className="iconBtn" onClick={()=>setEditPurch({...item,amount:String(parseFloat((item.amount*(item.total||1)).toFixed(2))),installments:String(item.total||1)})}
                                  style={{...S.iconBtn,background:"rgba(138,180,248,.1)",color:"#8ab4f8",width:20,height:20,borderRadius:5,fontSize:10}}>✏</button>
                                <button className="iconBtn" onClick={()=>setDelPurchId(item.id)}
                                  style={{...S.iconBtn,background:"rgba(239,68,68,.08)",color:"#f8717188",width:20,height:20,borderRadius:5,fontSize:10}}>✕</button>
                              </>)}
                            </div>
                          ))}
                          {!fat.open&&fat.total>0&&!fat.paid&&(
                            <button onClick={()=>{}} style={{marginTop:4,padding:"8px",background:`${card.color}18`,border:`1px solid ${card.color}44`,borderRadius:8,color:card.color,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                              Pagar fatura — {fmt(fat.total)}
                            </button>
                          )}
                          {fat.paid&&<button onClick={()=>onRevertFatura(fat.key)} style={{marginTop:4,padding:"7px",background:"rgba(248,113,113,.08)",border:"1px solid #f8717133",borderRadius:8,color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer"}}>↩ Estornar pagamento</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {delCardId&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDelCardId(null)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Excluir cartão</div><button style={S.xBtn} onClick={()=>setDelCardId(null)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:2}}>{cards.find(c=>c.id===delCardId)?.name}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove o cartão e todas as compras e faturas associadas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelCardId(null)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>handleDeleteCard(delCardId)} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showCardForm&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&closeCardForm()}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>{editCardId?"Editar Cartão":"Novo Cartão"}</div><button style={S.xBtn} onClick={closeCardForm}>✕</button></div>
            <Field label="Nome do cartão"><input style={S.inp} placeholder="Ex: Nubank, Inter..." value={cardForm.name} onChange={e=>setCardForm(p=>({...p,name:e.target.value}))}/></Field>
            <Field label="Limite (R$)"><input style={S.inp} type="number" placeholder="0,00" min="0" step="0.01" value={cardForm.limit} onChange={e=>setCardForm(p=>({...p,limit:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Dia fechamento" style={{flex:1}}><input style={S.inp} type="number" min={1} max={28} value={cardForm.closeDay} onChange={e=>setCardForm(p=>({...p,closeDay:e.target.value}))}/></Field>
              <Field label="Dia vencimento" style={{flex:1}}><input style={S.inp} type="number" min={1} max={28} value={cardForm.dueDay} onChange={e=>setCardForm(p=>({...p,dueDay:e.target.value}))}/></Field>
            </div>
            <Field label="Cor do cartão">
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {CARD_COLORS.map(c=>(
                  <button key={c} onClick={()=>setCardForm(p=>({...p,color:c}))}
                    style={{width:32,height:32,borderRadius:9,background:c,border:`2.5px solid ${cardForm.color===c?"#fff":"transparent"}`,cursor:"pointer",transform:cardForm.color===c?"scale(1.15)":"scale(1)",transition:"transform .15s"}}/>
                ))}
              </div>
            </Field>
            <button onClick={handleSaveCard} className="submitBtn"
              style={{...S.submitBtn,background:`linear-gradient(135deg,${cardForm.color}33,${cardForm.color}11)`,borderColor:`${cardForm.color}44`,color:cardForm.color,opacity:!cardForm.name?0.35:1}}
              disabled={!cardForm.name}>{editCardId?"Salvar alterações":"Adicionar Cartão"}</button>
          </div>
        </div>
      )}

      {showPurchaseForm&&activeCard&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowPurchaseForm(false)}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}>
              <div><div style={S.mTitle}>Nova Compra</div><div style={{fontSize:11,color:activeCard.color,marginTop:2}}>💳 {activeCard.name}</div></div>
              <button style={S.xBtn} onClick={()=>setShowPurchaseForm(false)}>✕</button>
            </div>
            <Field label="Descrição"><input style={S.inp} placeholder="Ex: Supermercado, Restaurante..." value={purchForm.description} onChange={e=>setPurchForm(p=>({...p,description:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Valor total (R$)" style={{flex:1}}><input style={S.inp} type="number" placeholder="0,00" min="0" step="0.01" value={purchForm.amount} onChange={e=>setPurchForm(p=>({...p,amount:e.target.value}))}/></Field>
              <Field label="Parcelas" style={{flex:"0 0 90px"}}><input style={S.inp} type="number" min={1} max={48} value={purchForm.installments} onChange={e=>setPurchForm(p=>({...p,installments:e.target.value}))}/></Field>
            </div>
            {purchForm.amount&&purchForm.installments>1&&(
              <div style={{marginBottom:13,background:"var(--bg)",border:`1px solid ${activeCard.color}33`,borderRadius:10,padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:"var(--text3)"}}>{purchForm.installments}x de</span>
                <span style={{fontSize:18,fontWeight:800,color:activeCard.color}}>{fmt(parseFloat(purchForm.amount)/parseInt(purchForm.installments))}</span>
              </div>
            )}
            <Field label="Data da compra"><input style={S.inp} type="date" value={purchForm.purchaseDate} onChange={e=>setPurchForm(p=>({...p,purchaseDate:e.target.value}))}/></Field>
            <div style={{marginBottom:13}}>
              <label style={S.lbl}>Categoria</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {categories.filter(c=>c.type==="both"||c.type==="despesa").map(cat=>(
                  <button key={cat.id} onClick={()=>setPurchForm(p=>({...p,category:cat.id}))}
                    style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${purchForm.category===cat.id?cat.color:"transparent"}`,background:purchForm.category===cat.id?cat.color+"22":"rgba(255,255,255,.05)",color:purchForm.category===cat.id?cat.color:"var(--text3)",fontSize:11,cursor:"pointer",fontWeight:500}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:48}} placeholder="Alguma anotação..." value={purchForm.notes} onChange={e=>setPurchForm(p=>({...p,notes:e.target.value}))}/></Field>
            <button onClick={handleSavePurchase} className="submitBtn"
              style={{...S.submitBtn,background:`linear-gradient(135deg,${activeCard.color}33,${activeCard.color}11)`,borderColor:`${activeCard.color}44`,color:activeCard.color,opacity:(!purchForm.description||!purchForm.amount)?0.35:1}}
              disabled={!purchForm.description||!purchForm.amount}>Adicionar Compra</button>
          </div>
        </div>
      )}

      {delPurchId&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDelPurchId(null)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Excluir compra</div><button style={S.xBtn} onClick={()=>setDelPurchId(null)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:2}}>{cardPurchases.find(p=>p.id===delPurchId)?.description}</div>
              <div style={{fontSize:11,color:"#f87171"}}>Remove a compra e todas as parcelas associadas.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelPurchId(null)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>handleDeletePurch(delPurchId)} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {editPurch&&(()=>{const ec=cards.find(c=>c.id===editPurch.cardId);const ec2=ec?.color||"#8ab4f8";return(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setEditPurch(null)}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}><div><div style={S.mTitle}>Editar Compra</div>{ec&&<div style={{fontSize:11,color:ec2,marginTop:2}}>💳 {ec.name}</div>}</div><button style={S.xBtn} onClick={()=>setEditPurch(null)}>✕</button></div>
            <Field label="Descrição"><input style={S.inp} value={editPurch.description} onChange={e=>setEditPurch(p=>({...p,description:e.target.value}))}/></Field>
            <div style={{display:"flex",gap:10}}>
              <Field label="Valor total (R$)" style={{flex:1}}><input style={S.inp} type="number" min="0" step="0.01" value={editPurch.amount} onChange={e=>setEditPurch(p=>({...p,amount:e.target.value}))}/></Field>
              <Field label="Parcelas" style={{flex:"0 0 90px"}}><input style={S.inp} type="number" min={1} max={48} value={editPurch.installments} onChange={e=>setEditPurch(p=>({...p,installments:e.target.value}))}/></Field>
            </div>
            <Field label="Data da compra"><input style={S.inp} type="date" value={editPurch.purchaseDate} onChange={e=>setEditPurch(p=>({...p,purchaseDate:e.target.value}))}/></Field>
            <Field label="Observação"><textarea style={{...S.inp,resize:"none",height:48}} value={editPurch.notes||""} onChange={e=>setEditPurch(p=>({...p,notes:e.target.value}))}/></Field>
            <button onClick={handleEditPurch} className="submitBtn" style={{...S.submitBtn,background:`linear-gradient(135deg,${ec2}33,${ec2}11)`,borderColor:`${ec2}44`,color:ec2}}>Salvar alterações</button>
          </div>
        </div>
      );})()}
    </div>
  );
}
