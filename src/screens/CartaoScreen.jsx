import { useState } from 'react';
import Field, { ModalShell } from "../components/Field.jsx";
import PartialFatModal from '../modals/PartialFatModal.jsx';
import { buildFatura, getCardBillingMonths, faturaDueOffset, cardUsedLimit } from '../logic.js';
import { payFatura } from '../entryActions.js';
import { fmt, fmtDate, mLabel, mShort, addM, todayISO, newId } from '../utils.js';
import { CARD_COLORS } from '../constants.js';
import S, { tint } from "../styles.js";
import ActionsSheet, { MoreButton, ICONS } from "../components/ActionsSheet.jsx";

const btnCancel={flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"};
const btnDanger={flex:1,padding:"11px",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",color:"var(--danger)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"};
const dangerNote={background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:11,padding:"12px 14px",marginBottom:18};
const tintBtn=(color)=>({background:`linear-gradient(135deg,${tint(color,20)},${tint(color,7)})`,borderColor:tint(color,27),color});

export default function CartaoScreen({cards,setCards,cardPurchases,setCardPurchases,cardFaturas,setCardFaturas,categories,nowMonth,toast,onRevertFatura}){
  const [showCardForm,setShowCardForm]=useState(false);
  const [showPurchaseForm,setShowPurchaseForm]=useState(false);
  const [partialFatTarget,setPartialFatTarget]=useState(null);
  const [activeCardId,setActiveCardId]=useState(null);
  const [editCardId,setEditCardId]=useState(null);
  const [delCardId,setDelCardId]=useState(null);
  const [cardMenuId,setCardMenuId]=useState(null);
  const [purchMenu,setPurchMenu]=useState(null);
  const [delPurchId,setDelPurchId]=useState(null);
  const [editPurch,setEditPurch]=useState(null);
  const [pendingCard,setPendingCard]=useState(null); // edição de fechamento/vencimento aguardando confirmação
  const [selectedBM,setSelectedBM]=useState({});
  const [cardForm,setCardForm]=useState({name:"",limit:"",closeDay:"20",dueDay:"5",color:CARD_COLORS[0]});
  const [purchForm,setPurchForm]=useState({description:"",amount:"",installments:1,purchaseDate:todayISO(),category:"outro",notes:""});
  const BLANK_CARD={name:"",limit:"",closeDay:"20",dueDay:"5",color:CARD_COLORS[0]};
  const BLANK_PURCH={description:"",amount:"",installments:1,purchaseDate:todayISO(),category:"outro",notes:""};
  const activeCard=cards.find(c=>c.id===activeCardId)||null;
  const openEditCard=(card)=>{setEditCardId(card.id);setCardForm({name:card.name,limit:String(card.limit||""),closeDay:String(card.closeDay),dueDay:String(card.dueDay),color:card.color});setShowCardForm(true);};
  const closeCardForm=()=>{setShowCardForm(false);setCardForm(BLANK_CARD);setEditCardId(null);};

  const clampDay=(v,def)=>Math.min(28,Math.max(1,parseInt(v)||def));
  const cardFormOk=!!cardForm.name.trim()&&parseFloat(cardForm.limit||0)>=0;
  const applyCard=(data)=>{
    if(editCardId){
      setCards(cards.map(c=>c.id!==editCardId?c:{...c,...data}));
      toast("✓ Cartão atualizado");
    } else {
      setCards([...cards,{id:newId(),...data}]);
      toast("💳 Cartão adicionado");
    }
    closeCardForm();
  };
  const handleSaveCard=()=>{
    if(!cardFormOk) return;
    const data={...cardForm,name:cardForm.name.trim(),limit:Math.max(0,parseFloat(cardForm.limit)||0),closeDay:clampDay(cardForm.closeDay,20),dueDay:clampDay(cardForm.dueDay,5)};
    const old=editCardId?cards.find(c=>c.id===editCardId):null;
    const daysChanged=old&&(old.closeDay!==data.closeDay||old.dueDay!==data.dueDay);
    const hasHistory=old&&(cardPurchases.some(p=>p.cardId===old.id)||Object.keys(cardFaturas).some(k=>k.startsWith(old.id+"_")));
    if(daysChanged&&hasHistory){setPendingCard(data);return;} // reagrupa compras entre faturas: pede confirmação
    applyCard(data);
  };
  const purchOk=(f)=>!!f.description?.trim()&&parseFloat(f.amount)>0&&Number.isInteger(Number(f.installments))&&Number(f.installments)>=1&&Number(f.installments)<=48&&!!f.purchaseDate;
  const handleSavePurchase=()=>{
    if(!purchOk(purchForm)||!activeCardId) return;
    const p={id:newId(),cardId:activeCardId,description:purchForm.description.trim(),amount:parseFloat(purchForm.amount),installments:parseInt(purchForm.installments),purchaseDate:purchForm.purchaseDate,category:purchForm.category,notes:purchForm.notes||""};
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
  // O modal abre com os dados da compra ORIGINAL (valor total e parcelas), nunca com os da parcela exibida.
  const openEditPurch=(id)=>{
    const p=cardPurchases.find(x=>x.id===id);
    if(p) setEditPurch({id:p.id,cardId:p.cardId,description:p.description,amount:String(p.amount),installments:String(p.installments||1),purchaseDate:p.purchaseDate,notes:p.notes||""});
  };
  const handleEditPurch=()=>{
    if(!editPurch||!purchOk(editPurch)) return;
    setCardPurchases(cardPurchases.map(p=>p.id!==editPurch.id?p:{...p,description:editPurch.description.trim(),amount:parseFloat(editPurch.amount),installments:parseInt(editPurch.installments),purchaseDate:editPurch.purchaseDate,notes:editPurch.notes||""}));
    setEditPurch(null);toast("✓ Compra atualizada");
  };
  const handlePayFat=(fat,amount)=>{
    const r=payFatura(cardFaturas,{faturaKey:fat.key,amount:fat.total},amount,true,todayISO());
    if(r.noop) return;
    setCardFaturas(r.cardFaturas);
    setPartialFatTarget(null);
    toast(r.fullyPaid?"✓ Fatura paga":"Pagamento parcial registrado");
  };

  return(
    <div style={{paddingBottom:90}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px",borderBottom:"1px solid var(--border-subtle)"}}>
        <div><div style={{fontSize:"var(--fs-lg)",fontWeight:700,color:"var(--text-1)"}}>Meus Cartões</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>{cards.length} cartão{cards.length!==1?"ões":""} cadastrado{cards.length!==1?"s":""}</div></div>
        <button type="button" onClick={()=>{setCardForm(BLANK_CARD);setShowCardForm(true);}} className="hbtn add-btn" style={{...S.hbtn,...S.addBtn,fontSize:"var(--fs-md)"}}>+ Novo Cartão</button>
      </div>

      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:14}}>
        {cards.length===0&&<div style={S.empty}><div aria-hidden="true" style={{fontSize:"var(--fs-7xl)",opacity:0.3,marginBottom:8}}>💳</div><div style={{color:"var(--text-4)",fontSize:"var(--fs-lg)",fontWeight:600}}>Nenhum cartão cadastrado</div><div style={{color:"var(--text-4)",fontSize:"var(--fs-md)",marginTop:3}}>Adicione um cartão para controlar suas faturas</div></div>}

        {cards.map(card=>{
          const allBillings=getCardBillingMonths(card,cardPurchases);
          const futureMths=Array.from({length:4},(_,i)=>addM(nowMonth,i));
          const stripMonths=[...new Set([...allBillings,...futureMths])].sort();
          const selBM=selectedBM[card.id]||nowMonth;
          const selFat=buildFatura(card,cardPurchases,cardFaturas,selBM);
          const usedLimit=cardUsedLimit(card,cardPurchases,cardFaturas);
          const limitPct=card.limit>0?Math.min(100,(usedLimit/card.limit)*100):0;
          const limitColor=limitPct>80?"var(--danger)":limitPct>60?"var(--warning)":card.color;

          return(
            <div key={card.id} style={{background:"var(--surface)",borderRadius:18,overflow:"hidden",border:`1px solid ${tint(card.color,13)}`}}>

              {/* Cabeçalho do cartão */}
              <div style={{background:`linear-gradient(135deg,${tint(card.color,20)},${tint(card.color,7)})`,padding:"16px 16px 14px",borderBottom:`1px solid ${tint(card.color,13)}`}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:"var(--fs-2xl)",fontWeight:800,color:"var(--text-1)"}}>{card.name}</div>
                    <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:2}}>Fecha dia {card.closeDay} · Vence dia {card.dueDay}{faturaDueOffset(card.closeDay,card.dueDay)?" do mês seguinte":""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:2,flexShrink:0}}>
                    <button type="button" className="iconBtn" aria-label={`Nova compra no cartão ${card.name}`} title="Nova compra" onClick={()=>{setActiveCardId(card.id);setPurchForm(BLANK_PURCH);setShowPurchaseForm(true);}}
                      style={{...S.iconBtn,width:44,height:44,borderRadius:"var(--radius-full)",background:tint(card.color,13),color:card.color}}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <MoreButton label={`Ações do cartão ${card.name}`} onClick={()=>setCardMenuId(card.id)}/>
                  </div>
                </div>
                {card.limit>0&&(<div style={{marginTop:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div role="progressbar" aria-label="Limite utilizado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(limitPct)} style={{flex:1,height:5,background:"var(--track)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${limitPct}%`,background:limitColor,borderRadius:3,transition:"width .5s"}}/>
                    </div>
                    <span style={{fontSize:"var(--fs-sm)",fontWeight:700,color:limitColor,flexShrink:0}}>{limitPct.toFixed(0)}% do limite</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",marginTop:5,fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>
                    <span>Usado {fmt(usedLimit)}</span>
                    <span>Disponível {fmt(Math.max(0,card.limit-usedLimit))}</span>
                  </div>
                </div>)}
              </div>

              {/* Seletor de mês — chips clicáveis */}
              <div style={{overflowX:"auto",padding:"10px 14px 8px",borderBottom:`1px solid ${tint(card.color,7)}`}}>
                <div role="group" aria-label={`Faturas de ${card.name}`} style={{display:"flex",gap:7,minWidth:"max-content"}}>
                  {stripMonths.map(bm=>{
                    const f=buildFatura(card,cardPurchases,cardFaturas,bm);
                    const isSel=bm===selBM;
                    const isNow=bm===nowMonth;
                    return(
                      <button type="button" key={bm} aria-pressed={isSel} onClick={()=>setSelectedBM(p=>({...p,[card.id]:bm}))}
                        style={{textAlign:"center",minWidth:62,background:isSel?tint(card.color,13):"var(--surface-sunken)",borderRadius:10,padding:"7px 5px",
                          border:`1.5px solid ${isSel?tint(card.color,60):"var(--border-subtle)"}`,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                        <div style={{fontSize:"var(--fs-sm)",color:isSel?card.color:isNow?"var(--text-2)":"var(--text-4)",fontWeight:isSel||isNow?700:400,marginBottom:3}}>
                          {mShort(bm)}{isNow?" ●":""}
                        </div>
                        <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:f.total>0?(isSel?card.color:"var(--text-2)"):"var(--text-4)"}}>
                          {f.total>0?fmt(f.total):"—"}
                        </div>
                        <div style={{fontSize:"var(--fs-xs)",marginTop:2,color:f.paid?"var(--success)":f.open?"var(--warning)":f.total>0?"var(--orange)":"transparent"}}>
                          {f.paid?"✓ pago":f.open?"aberto":f.total>0?"a pagar":""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detalhe da fatura selecionada */}
              <div style={{padding:"12px 14px 14px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)"}}>{mLabel(selBM)}{selBM>nowMonth&&<span style={{marginLeft:6,fontSize:"var(--fs-sm)",color:card.color,fontWeight:500}}>parcelas futuras</span>}</div>
                    <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginTop:1}}>
                      {selFat.open?`Fecha em ${fmtDate(selFat.closeDate)}`:selFat.total>0?`Vence ${fmtDate(selFat.dueDate)}`:"Sem compras"}
                    </div>
                  </div>
                  {selFat.total>0&&(
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:"var(--fs-2xl)",fontWeight:800,color:card.color}}>{fmt(selFat.total)}</div>
                      <div style={{fontSize:"var(--fs-sm)",marginTop:1,color:selFat.paid?"var(--success)":selFat.open?"var(--warning)":selFat.partial?"var(--warning)":"var(--orange)",fontWeight:600}}>
                        {selFat.paid?"✓ pago":selFat.open?"🔄 em aberto":selFat.partial?`✓ ${fmt(selFat.paidAmount||0)} pago`:"⏳ a pagar"}
                      </div>
                    </div>
                  )}
                </div>

                {selFat.items.length===0&&(
                  <div style={{textAlign:"center",padding:"12px 0",color:"var(--text-4)",fontSize:"var(--fs-sm)"}}>Nenhuma compra nesta fatura</div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {selFat.items.map(item=>(
                    <div key={item.id+item.installmentNum} style={{display:"flex",alignItems:"center",gap:8,background:"var(--surface-sunken)",borderRadius:9,padding:"8px 10px",border:"1px solid var(--border-subtle)"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"var(--fs-md)",color:"var(--text-2)",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.description}</div>
                        <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginTop:1,display:"flex",gap:8}}>
                          {item.total>1&&<span style={{color:card.color,fontWeight:600}}>{item.installmentNum}/{item.total}x</span>}
                          {item.total>1&&<span>Total {fmt(cardPurchases.find(x=>x.id===item.id)?.amount??item.amount*item.total)}</span>}
                        </div>
                      </div>
                      <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:card.color,flexShrink:0}}>{fmt(item.amount)}</div>
                      {!selFat.paid&&<MoreButton label={`Ações da compra ${item.description}`} onClick={()=>setPurchMenu(item)} style={{margin:"-4px -6px -4px 0"}}/>}
                    </div>
                  ))}
                </div>

                {!selFat.open&&selFat.total>0&&!selFat.paid&&(
                  <button type="button" onClick={()=>setPartialFatTarget({...selFat,card})}
                    style={{marginTop:10,width:"100%",padding:"10px",background:`linear-gradient(135deg,${tint(card.color,20)},${tint(card.color,7)})`,border:`1px solid ${tint(card.color,27)}`,borderRadius:"var(--radius-md)",color:card.color,fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"}}>
                    {selFat.partial?`Pagar restante — ${fmt(parseFloat((selFat.total-selFat.paidAmount).toFixed(2)))}`:`Pagar fatura — ${fmt(selFat.total)}`}
                  </button>
                )}
                {(selFat.paid||selFat.partial)&&(
                  <button type="button" onClick={()=>onRevertFatura(selFat.key)}
                    style={{marginTop:10,width:"100%",padding:"8px",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:9,color:"var(--danger)",fontSize:"var(--fs-sm)",fontWeight:600,cursor:"pointer"}}>
                    ↩ Estornar {selFat.partial?"pagamentos":"pagamento"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cardMenuId&&(()=>{
        const card=cards.find(c=>c.id===cardMenuId);
        if(!card) return null;
        return <ActionsSheet title={card.name} subtitle="Ações do cartão" onClose={()=>setCardMenuId(null)} actions={[
          {key:"edit",label:"Editar cartão",hint:"Nome, limite, fechamento e vencimento",token:"accent",bg:"accent-surface",icon:ICONS.edit,onSelect:()=>openEditCard(card)},
          {key:"delete",label:"Excluir cartão",hint:"Remove o cartão e suas compras",token:"danger",bg:"danger-soft",icon:ICONS.delete,onSelect:()=>setDelCardId(card.id)},
        ]}/>;
      })()}
      {purchMenu&&<ActionsSheet title={purchMenu.description} subtitle="Ações da compra" onClose={()=>setPurchMenu(null)} actions={[
        {key:"edit",label:"Editar compra",hint:"Valor, parcelas, data e categoria",token:"accent",bg:"accent-surface",icon:ICONS.edit,onSelect:()=>openEditPurch(purchMenu.id)},
        {key:"delete",label:"Excluir compra",hint:"Remove a compra desta fatura",token:"danger",bg:"danger-soft",icon:ICONS.delete,onSelect:()=>setDelPurchId(purchMenu.id)},
      ]}/>}

      {delCardId&&(
        <ModalShell title="Excluir cartão" onClose={()=>setDelCardId(null)} compact>
          <div style={dangerNote}>
            <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)",marginBottom:2}}>{cards.find(c=>c.id===delCardId)?.name}</div>
            <div style={{fontSize:"var(--fs-sm)",color:"var(--danger)"}}>{(()=>{const n=cardPurchases.filter(p=>p.cardId===delCardId).length;return `Remove o cartão, ${n} compra${n!==1?"s":""} e os pagamentos de fatura associados.`;})()}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setDelCardId(null)} style={btnCancel}>Cancelar</button>
            <button type="button" onClick={()=>handleDeleteCard(delCardId)} style={btnDanger}>Excluir</button>
          </div>
        </ModalShell>
      )}

      {pendingCard&&(
        <ModalShell title="Alterar fechamento/vencimento?" onClose={()=>setPendingCard(null)} compact>
          <div style={dangerNote}>
            <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)",marginBottom:4}}>As compras serão reagrupadas nas faturas</div>
            <div style={{fontSize:"var(--fs-sm)",color:"var(--danger)",lineHeight:1.5}}>Mudar o dia de fechamento ou de vencimento muda em qual fatura (e em qual mês) cada compra cai. Pagamentos já registrados podem deixar de bater com os novos valores.</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setPendingCard(null)} style={btnCancel}>Cancelar</button>
            <button type="button" onClick={()=>{const d=pendingCard;setPendingCard(null);applyCard(d);}} style={btnDanger}>Alterar mesmo assim</button>
          </div>
        </ModalShell>
      )}

      {showCardForm&&(
        <ModalShell title={editCardId?"Editar Cartão":"Novo Cartão"} onClose={closeCardForm}>
          <Field label="Nome do cartão" required><input style={S.inp} placeholder="Ex: Nubank, Inter..." value={cardForm.name} onChange={e=>setCardForm(p=>({...p,name:e.target.value}))}/></Field>
          <Field label="Limite"><input style={S.inp} type="number" inputMode="decimal" placeholder="0,00" min="0" step="0.01" value={cardForm.limit} onChange={e=>setCardForm(p=>({...p,limit:e.target.value}))}/></Field>
          <div style={{display:"flex",gap:10}}>
            <Field label="Dia fechamento" style={{flex:1}}><input style={S.inp} type="number" inputMode="numeric" min={1} max={28} value={cardForm.closeDay} onChange={e=>setCardForm(p=>({...p,closeDay:e.target.value}))}/></Field>
            <Field label="Dia vencimento" style={{flex:1}}><input style={S.inp} type="number" inputMode="numeric" min={1} max={28} value={cardForm.dueDay} onChange={e=>setCardForm(p=>({...p,dueDay:e.target.value}))}/></Field>
          </div>
          <Field label="Cor do cartão">
            <div role="group" aria-label="Cor do cartão" style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {CARD_COLORS.map(c=>(
                <button type="button" key={c} aria-label={`Cor ${c}`} aria-pressed={cardForm.color===c} onClick={()=>setCardForm(p=>({...p,color:c}))}
                  style={{width:32,height:32,borderRadius:9,background:c,border:`2.5px solid ${cardForm.color===c?"var(--text-1)":"transparent"}`,cursor:"pointer",transform:cardForm.color===c?"scale(1.15)":"scale(1)",transition:"transform .15s"}}/>
              ))}
            </div>
          </Field>
          <button type="button" onClick={handleSaveCard} className="submitBtn"
            style={{...S.submitBtn,...tintBtn(cardForm.color),opacity:!cardFormOk?0.35:1}}
            disabled={!cardFormOk}>{editCardId?"Salvar alterações":"Adicionar Cartão"}</button>
        </ModalShell>
      )}

      {showPurchaseForm&&activeCard&&(
        <ModalShell title="Nova Compra" subtitle={<div style={{fontSize:"var(--fs-sm)",color:activeCard.color,marginTop:2}}>💳 {activeCard.name}</div>} onClose={()=>setShowPurchaseForm(false)}>
          <Field label="Descrição" required><input style={S.inp} placeholder="Ex: Supermercado, Restaurante..." value={purchForm.description} onChange={e=>setPurchForm(p=>({...p,description:e.target.value}))}/></Field>
          <div style={{display:"flex",gap:10}}>
            <Field label="Valor total" required style={{flex:1}}><input style={S.inp} type="number" inputMode="decimal" placeholder="0,00" min="0" step="0.01" value={purchForm.amount} onChange={e=>setPurchForm(p=>({...p,amount:e.target.value}))}/></Field>
            <Field label="Parcelas" style={{flex:"0 0 90px"}}><input style={S.inp} type="number" inputMode="numeric" min={1} max={48} value={purchForm.installments} onChange={e=>setPurchForm(p=>({...p,installments:e.target.value}))}/></Field>
          </div>
          {purchForm.amount&&purchForm.installments>1&&(
            <div style={{marginBottom:13,background:"var(--surface-sunken)",border:`1px solid ${tint(activeCard.color,20)}`,borderRadius:"var(--radius-md)",padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>{purchForm.installments}x de</span>
              <span style={{fontSize:"var(--fs-3xl)",fontWeight:800,color:activeCard.color}}>{fmt(parseFloat(purchForm.amount)/parseInt(purchForm.installments))}</span>
            </div>
          )}
          <Field label="Data da compra"><input style={S.inp} type="date" value={purchForm.purchaseDate} onChange={e=>setPurchForm(p=>({...p,purchaseDate:e.target.value}))}/></Field>
          <div style={{marginBottom:13}} role="group" aria-labelledby="cartao-cat-lbl">
            <span id="cartao-cat-lbl" style={S.lbl}>Categoria</span>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {categories.filter(c=>c.type==="both"||c.type==="despesa").map(cat=>{
                const sel=purchForm.category===cat.id;
                return(
                  <button type="button" key={cat.id} aria-pressed={sel} onClick={()=>setPurchForm(p=>({...p,category:cat.id}))}
                    style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${sel?cat.color:"transparent"}`,background:sel?tint(cat.color,13):"var(--surface-hover)",color:sel?cat.color:"var(--text-3)",fontSize:"var(--fs-sm)",cursor:"pointer",fontWeight:500}}>
                    <span aria-hidden="true" style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>{cat.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Observação (opcional)"><textarea style={{...S.inp,resize:"none",height:48}} placeholder="Alguma anotação..." value={purchForm.notes} onChange={e=>setPurchForm(p=>({...p,notes:e.target.value}))}/></Field>
          <button type="button" onClick={handleSavePurchase} className="submitBtn"
            style={{...S.submitBtn,...tintBtn(activeCard.color),opacity:!purchOk(purchForm)?0.35:1}}
            disabled={!purchOk(purchForm)}>Adicionar Compra</button>
        </ModalShell>
      )}

      {delPurchId&&(
        <ModalShell title="Excluir compra" onClose={()=>setDelPurchId(null)} compact>
          <div style={dangerNote}>
            <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)",marginBottom:2}}>{cardPurchases.find(p=>p.id===delPurchId)?.description}</div>
            <div style={{fontSize:"var(--fs-sm)",color:"var(--danger)"}}>Remove a compra e todas as parcelas associadas.</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setDelPurchId(null)} style={btnCancel}>Cancelar</button>
            <button type="button" onClick={()=>handleDeletePurch(delPurchId)} style={btnDanger}>Excluir</button>
          </div>
        </ModalShell>
      )}

      {partialFatTarget&&(
        <PartialFatModal
          fat={partialFatTarget}
          card={partialFatTarget.card}
          onClose={()=>setPartialFatTarget(null)}
          onPay={handlePayFat}
        />
      )}

      {editPurch&&(()=>{const ec=cards.find(c=>c.id===editPurch.cardId);const ec2=ec?.color||"var(--accent)";return(
        <ModalShell title="Editar Compra" subtitle={ec&&<div style={{fontSize:"var(--fs-sm)",color:ec2,marginTop:2}}>💳 {ec.name}</div>} onClose={()=>setEditPurch(null)}>
          <Field label="Descrição"><input style={S.inp} value={editPurch.description} onChange={e=>setEditPurch(p=>({...p,description:e.target.value}))}/></Field>
          <div style={{display:"flex",gap:10}}>
            <Field label="Valor total" style={{flex:1}}><input style={S.inp} type="number" inputMode="decimal" min="0" step="0.01" value={editPurch.amount} onChange={e=>setEditPurch(p=>({...p,amount:e.target.value}))}/></Field>
            <Field label="Parcelas" style={{flex:"0 0 90px"}}><input style={S.inp} type="number" inputMode="numeric" min={1} max={48} value={editPurch.installments} onChange={e=>setEditPurch(p=>({...p,installments:e.target.value}))}/></Field>
          </div>
          <Field label="Data da compra"><input style={S.inp} type="date" value={editPurch.purchaseDate} onChange={e=>setEditPurch(p=>({...p,purchaseDate:e.target.value}))}/></Field>
          <Field label="Observação"><textarea style={{...S.inp,resize:"none",height:48}} value={editPurch.notes||""} onChange={e=>setEditPurch(p=>({...p,notes:e.target.value}))}/></Field>
          <button type="button" onClick={handleEditPurch} disabled={!purchOk(editPurch)} className="submitBtn" style={{...S.submitBtn,...tintBtn(ec2),opacity:purchOk(editPurch)?1:0.35}}>Salvar alterações</button>
        </ModalShell>
      );})()}
    </div>
  );
}
