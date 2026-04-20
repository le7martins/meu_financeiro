import { useState, useMemo } from 'react';
import BarSVG from '../components/BarSVG.jsx';
import DonutSVG from '../components/DonutSVG.jsx';
import Leg from '../components/Leg.jsx';
import SumCard from '../components/SumCard.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import { getMonthEntries, buildFatura, getCardBillingMonths } from '../logic.js';
import { fmt, fmtShort, mLabel, mShort, addM, eVal } from '../utils.js';
import S from '../styles.js';

export default function ChartScreen({entries,dividas,categories,nowMonth,cards,cardPurchases,cardFaturas,accumSaldo}){
  const [mode,setMode]=useState("mes");
  const [specMonth,setSpecMonth]=useState(nowMonth);
  const [fromMonth,setFromMonth]=useState(addM(nowMonth,-5));
  const [toMonth,setToMonth]=useState(nowMonth);
  const [showPicker,setShowPicker]=useState(false);
  const [chartType,setChartType]=useState("barras");
  const [catView,setCatView]=useState("despesa");
  const [cmpA,setCmpA]=useState(nowMonth);
  const [cmpB,setCmpB]=useState(addM(nowMonth,-1));

  const getCat  =(id)=>(categories.find(c=>c.id===id)||{color:"#9E9E9E",name:id});
  const catColor=(id)=>getCat(id).color;
  const catName =(id)=>getCat(id).name;

  const range=useMemo(()=>{
    if(mode==="mes") return [specMonth];
    const months=[],end=fromMonth<=toMonth?toMonth:fromMonth;
    let cur=fromMonth<=toMonth?fromMonth:toMonth;
    while(cur<=end){months.push(cur);cur=addM(cur,1);}
    return months.slice(0,24);
  },[mode,specMonth,fromMonth,toMonth]);

  const mData=(m)=>getMonthEntries(entries,dividas,m,cards,cardPurchases,cardFaturas);

  const monthlyData=useMemo(()=>range.map(m=>{
    const me=mData(m);
    const rec=me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const dep=me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return{month:range.length===1?mLabel(m):mShort(m),receitas:+rec.toFixed(2),despesas:+dep.toFixed(2),saldo:+(rec-dep).toFixed(2)};
  }),[entries,dividas,cards,cardPurchases,cardFaturas,range]);

  const catData=useMemo(()=>{
    const map={};
    range.forEach(m=>mData(m).filter(e=>e.type===catView).forEach(e=>{map[e.category]=(map[e.category]||0)+eVal(e);}));
    return Object.entries(map).map(([id,value])=>({id,name:catName(id),value:+value.toFixed(2),color:catColor(id)})).sort((a,b)=>b.value-a.value);
  },[entries,dividas,cards,cardPurchases,cardFaturas,range,catView]);

  const totals=useMemo(()=>{
    const all=range.flatMap(m=>mData(m));
    const rec=all.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const dep=all.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return{rec,dep,saldo:rec-dep};
  },[entries,dividas,cards,cardPurchases,cardFaturas,range]);

  const projData=useMemo(()=>Array.from({length:6},(_,i)=>{
    const m=addM(nowMonth,i+1);
    const me=mData(m);
    const rec=me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
    const dep=me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    return{month:mShort(m),receitas:+rec.toFixed(2),despesas:+dep.toFixed(2),saldo:+(rec-dep).toFixed(2)};
  }),[entries,dividas,cards,cardPurchases,cardFaturas,nowMonth]);

  const projCumData=useMemo(()=>{
    const nowMe=mData(nowMonth);
    const nowSaldo=nowMe.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0)-nowMe.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
    let running=+((accumSaldo||0)+nowSaldo).toFixed(2);
    return projData.map(d=>{
      running=+(running+d.saldo).toFixed(2);
      return{...d,cumulative:running};
    });
  },[projData,accumSaldo,nowMonth,entries,dividas,cards,cardPurchases,cardFaturas]);

  const insights=useMemo(()=>{
    if(range.length<2) return null;
    let maxDepM=null,maxDep=0;
    range.forEach(m=>{const dep=mData(m).filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);if(dep>maxDep){maxDep=dep;maxDepM=m;}});
    return{maxDepM,maxDep,topCat:catData[0]||null};
  },[entries,dividas,cards,cardPurchases,cardFaturas,range,catData]);

  const cardCatData=useMemo(()=>{
    const map={};
    cardPurchases.forEach(p=>{const id=p.category||"outro";map[id]=(map[id]||0)+parseFloat(p.amount);});
    const total=Object.values(map).reduce((s,v)=>s+v,0);
    return{cats:Object.entries(map).map(([id,value])=>({id,name:catName(id),value:+value.toFixed(2),color:catColor(id)})).sort((a,b)=>b.value-a.value),total:+total.toFixed(2)};
  },[cardPurchases,categories]);

  const cmpData=useMemo(()=>{
    const calc=(m)=>{
      const me=mData(m);
      const rec=me.filter(e=>e.type==="receita").reduce((s,e)=>s+eVal(e),0);
      const dep=me.filter(e=>e.type==="despesa").reduce((s,e)=>s+eVal(e),0);
      const catMap={};
      me.filter(e=>e.type==="despesa").forEach(e=>{catMap[e.category]=(catMap[e.category]||0)+eVal(e);});
      const cats=Object.entries(catMap).map(([id,v])=>({id,name:catName(id),color:catColor(id),value:+v.toFixed(2)})).sort((a,b)=>b.value-a.value).slice(0,5);
      return{rec:+rec.toFixed(2),dep:+dep.toFixed(2),saldo:+(rec-dep).toFixed(2),cats};
    };
    return{a:calc(cmpA),b:calc(cmpB)};
  },[entries,dividas,cards,cardPurchases,cardFaturas,cmpA,cmpB]);

  const cardMonthlyData=useMemo(()=>range.map(m=>{
    const entry={month:range.length===1?mLabel(m):mShort(m)};
    let tot=0;
    cards.forEach(card=>{
      const allBm=getCardBillingMonths(card,cardPurchases);
      allBm.forEach(bm=>{
        const fat=buildFatura(card,cardPurchases,cardFaturas,bm);
        if(fat.dueDate.substring(0,7)===m&&fat.total>0){entry[card.id]=(entry[card.id]||0)+fat.total;tot+=fat.total;}
      });
    });
    entry.total=+tot.toFixed(2);
    return entry;
  }),[cards,cardPurchases,cardFaturas,range]);

  return(
    <div style={{paddingBottom:80,paddingTop:4}}>
      <div style={{padding:"12px 14px 0"}}>
        <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Período de análise</div>
        <div style={{display:"flex",gap:6,marginBottom:12,position:"relative"}}>
          <button onClick={()=>{setMode("mes");setShowPicker(p=>!p);}} className="fTab"
            style={{...S.fTab,flex:1,justifyContent:"center",gap:5,...(mode==="mes"?S.fTabActive:{})}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {mLabel(specMonth)}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button onClick={()=>{setMode("periodo");setShowPicker(false);}} className="fTab"
            style={{...S.fTab,flex:1,justifyContent:"center",...(mode==="periodo"?S.fTabActive:{})}}>Período</button>
          {showPicker&&mode==="mes"&&(
            <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,width:"calc(50% - 3px)",background:"var(--card-bg)",border:"1px solid #1a3a6e",borderRadius:12,zIndex:20,overflow:"hidden",maxHeight:220,overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
              {Array.from({length:24},(_,i)=>addM(nowMonth,i-12)).map(m=>(
                <button key={m} onClick={()=>{setSpecMonth(m);setShowPicker(false);}}
                  style={{width:"100%",padding:"9px 14px",background:m===specMonth?"#1a3a6e44":"transparent",border:"none",color:m===specMonth?"#8ab4f8":"var(--text2)",fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit",borderBottom:"1px solid var(--border2)",fontWeight:m===specMonth?700:400}}>
                  {mLabel(m)}{m===nowMonth?" ·":""}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode==="periodo"&&(
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <div style={{flex:1}}><label style={{...S.lbl,marginBottom:5}}>De</label><MonthPicker value={fromMonth} onChange={setFromMonth} now={nowMonth}/></div>
            <div style={{flex:1}}><label style={{...S.lbl,marginBottom:5}}>Até</label><MonthPicker value={toMonth} onChange={setToMonth} now={nowMonth}/></div>
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 14px 10px"}}>
        <SumCard label="Receitas" value={fmt(totals.rec)} color="#4ade80" icon="↑"/>
        <SumCard label="Despesas" value={fmt(totals.dep)} color="#fb923c" icon="↓"/>
        <SumCard label="Saldo" value={fmt(totals.saldo)} color={totals.saldo>=0?"#4ade80":"#f87171"} icon={totals.saldo>=0?"◈":"▽"} wide/>
      </div>

      {insights&&(<div style={{padding:"0 14px 12px",display:"flex",flexDirection:"column",gap:6}}>
        <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:11,padding:"10px 12px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>📉</span>
          <div><div style={{fontSize:10,color:"var(--text3)",marginBottom:2}}>Mês com maior gasto</div><div style={{fontSize:12,fontWeight:700,color:"#fb923c"}}>{mLabel(insights.maxDepM)} · {fmt(insights.maxDep)}</div></div>
        </div>
        {insights.topCat&&<div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:11,padding:"10px 12px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>🏆</span>
          <div><div style={{fontSize:10,color:"var(--text3)",marginBottom:2}}>Maior {catView==="despesa"?"gasto":"receita"} por categoria</div><div style={{fontSize:12,fontWeight:700,color:insights.topCat.color}}>{insights.topCat.name} · {fmt(insights.topCat.value)}</div></div>
        </div>}
      </div>)}

      <div style={{display:"flex",gap:6,padding:"0 14px 12px",flexWrap:"wrap"}}>
        {[["barras","Barras"],["evolucao","Evolução"],["pizza","Categorias"],["projecao","Projeção"],["comparar","⚖️ Comparar"],["cartoes","💳 Cartões"]].map(([t,l])=>(
          <button key={t} onClick={()=>setChartType(t)} className="fTab" style={{...S.fTab,flex:1,justifyContent:"center",minWidth:60,...(chartType===t?S.fTabActive:{})}}>{l}</button>
        ))}
      </div>

      <div style={{padding:"0 14px"}}>
        {(chartType==="barras"||chartType==="evolucao")&&(<div style={S.chartBox}>
          <div style={S.chartTitle}>{chartType==="barras"?"Receitas vs Despesas":"Evolução do Saldo"}</div>
          <BarSVG data={monthlyData} type={chartType}/>
          <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:10}}>
            {chartType==="barras"?(<><Leg color="#4ade80" label="Receitas"/><Leg color="#fb923c" label="Despesas"/></>)
              :(<><Leg color="#4ade80" label="Receitas"/><Leg color="#fb923c" label="Despesas"/><Leg color="#8ab4f8" label="Saldo" dashed/></>)}
          </div>
        </div>)}

        {chartType==="pizza"&&(<div style={S.chartBox}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={S.chartTitle}>Por Categoria</div>
            <div style={{display:"flex",gap:5}}>
              {[["despesa","Despesas"],["receita","Receitas"]].map(([v,l])=>(
                <button key={v} onClick={()=>setCatView(v)} className="fTab"
                  style={{...S.fTab,...(catView===v?S.fTabActive:{}),padding:"4px 9px",fontSize:10}}>{l}</button>
              ))}
            </div>
          </div>
          {catData.length===0
            ?<div style={{textAlign:"center",padding:"40px 0",color:"var(--text4)",fontSize:13}}>Sem dados no período</div>
            :(<>
              <DonutSVG data={catData} total={totals[catView==="despesa"?"dep":"rec"]}/>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                {catData.map((c,i)=>{
                  const tot=totals[catView==="despesa"?"dep":"rec"];
                  const pct=tot>0?((c.value/tot)*100).toFixed(1):0;
                  return(<div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                    <div style={{flex:1,fontSize:12,color:"var(--text2)",fontWeight:500}}>{c.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>{pct}%</div>
                    <div style={{fontSize:12,color:c.color,fontWeight:700,minWidth:72,textAlign:"right"}}>{fmt(c.value)}</div>
                  </div>);
                })}
              </div>
            </>)
          }
        </div>)}

        {chartType==="comparar"&&(<div style={S.chartBox}>
          <div style={S.chartTitle}>Comparar meses</div>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[[cmpA,setCmpA,"#8ab4f8"],[cmpB,setCmpB,"#fb923c"]].map(([m,setM,color],idx)=>(
              <div key={idx} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:color,fontWeight:700,marginBottom:5}}>{idx===0?"Mês A":"Mês B"}</div>
                <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
                  <button onClick={()=>setM(p=>addM(p,-1))} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,color:"var(--text3)",cursor:"pointer",padding:"2px 6px",fontSize:12}}>‹</button>
                  <span style={{fontSize:12,fontWeight:700,color,minWidth:70,textAlign:"center"}}>{mShort(m)}</span>
                  <button onClick={()=>setM(p=>addM(p,1))} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,color:"var(--text3)",cursor:"pointer",padding:"2px 6px",fontSize:12}}>›</button>
                </div>
              </div>
            ))}
          </div>
          {[["Receitas","rec","#4ade80"],["Despesas","dep","#fb923c"],["Saldo","saldo","#8ab4f8"]].map(([label,key,color])=>{
            const va=cmpData.a[key],vb=cmpData.b[key];
            const max=Math.max(Math.abs(va),Math.abs(vb),1);
            const diff=va-vb;
            return(
              <div key={key} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:"var(--text3)",fontWeight:600}}>{label}</span>
                  <span style={{fontSize:10,color:diff>0?"#4ade80":diff<0?"#f87171":"var(--text3)",fontWeight:600}}>{diff>0?"+":""}{fmt(diff)}</span>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#8ab4f8",width:52,textAlign:"right"}}>{fmt(va)}</span>
                  <div style={{flex:1,height:8,background:"var(--bg)",borderRadius:4,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",right:"50%",height:"100%",width:`${(Math.abs(va)/max)*50}%`,background:"#8ab4f8",borderRadius:"4px 0 0 4px",opacity:0.8}}/>
                    <div style={{position:"absolute",left:"50%",height:"100%",width:`${(Math.abs(vb)/max)*50}%`,background:"#fb923c",borderRadius:"0 4px 4px 0",opacity:0.8}}/>
                    <div style={{position:"absolute",left:"50%",top:0,width:1,height:"100%",background:"var(--border2)"}}/>
                  </div>
                  <span style={{fontSize:10,color:"#fb923c",width:52}}>{fmt(vb)}</span>
                </div>
              </div>
            );
          })}
          {cmpData.a.cats.length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:"var(--text3)",fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Top despesas</div>
              {cmpData.a.cats.map(ca=>{
                const cb=cmpData.b.cats.find(x=>x.id===ca.id);
                const diff=(ca.value-(cb?.value||0));
                return(
                  <div key={ca.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:ca.color,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:11,color:"var(--text2)"}}>{ca.name}</span>
                    <span style={{fontSize:10,color:"#8ab4f8",width:52,textAlign:"right"}}>{fmt(ca.value)}</span>
                    <span style={{fontSize:10,color:diff>0?"#f87171":diff<0?"#4ade80":"var(--text4)",width:52,textAlign:"right",fontWeight:600}}>{diff>0?"+":""}{fmt(diff)}</span>
                    <span style={{fontSize:10,color:"#fb923c",width:52}}>{fmt(cb?.value||0)}</span>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"flex-end",gap:14,marginTop:6}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:"#8ab4f8"}}/><span style={{fontSize:9,color:"var(--text3)"}}>{mShort(cmpA)}</span></div>
                <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:"#fb923c"}}/><span style={{fontSize:9,color:"var(--text3)"}}>{mShort(cmpB)}</span></div>
              </div>
            </div>
          )}
        </div>)}

        {chartType==="projecao"&&(<div style={S.chartBox}>
          <div style={S.chartTitle}>Projeção — Próximos 6 meses</div>
          <div style={{fontSize:10,color:"var(--text3)",marginBottom:12}}>Baseado em lançamentos fixos, parcelados, dívidas e faturas</div>
          <BarSVG data={projData} type="barras"/>
          {projCumData.length>0&&(
            <div style={{margin:"14px 0 10px",background:projCumData[projCumData.length-1].cumulative>=0?"rgba(74,222,128,.08)":"rgba(248,113,113,.08)",border:`1px solid ${projCumData[projCumData.length-1].cumulative>=0?"#4ade8033":"#f8717133"}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontSize:10,color:"var(--text3)"}}>Saldo acumulado em {projCumData[projCumData.length-1].month}</div><div style={{fontSize:9,color:"var(--text4)",marginTop:2}}>baseado nos últimos dados disponíveis</div></div>
              <div style={{fontSize:18,fontWeight:800,color:projCumData[projCumData.length-1].cumulative>=0?"#4ade80":"#f87171"}}>{fmt(projCumData[projCumData.length-1].cumulative)}</div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {projCumData.map((d,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"var(--bg)",borderRadius:8,padding:"7px 10px",border:"1px solid var(--border2)"}}>
                <div style={{fontSize:12,fontWeight:600,color:"#8ab4f8",width:28,flexShrink:0}}>{d.month}</div>
                <div style={{fontSize:10,color:"#4ade80",flex:1}}>↑{fmt(d.receitas)}</div>
                <div style={{fontSize:10,color:"#fb923c",flex:1}}>↓{fmt(d.despesas)}</div>
                <div style={{fontSize:11,fontWeight:600,color:d.saldo>=0?"#4ade80":"#f87171",width:60,textAlign:"right"}}>{d.saldo>=0?"+":""}{fmt(d.saldo)}</div>
                <div style={{width:1,height:14,background:"var(--border2)",flexShrink:0}}/>
                <div style={{fontSize:11,fontWeight:700,color:d.cumulative>=0?"#4ade80":"#f87171",width:64,textAlign:"right"}}>{fmt(d.cumulative)}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:7,height:7,borderRadius:2,background:"#8ab4f8"}}/><span style={{fontSize:9,color:"var(--text3)"}}>Saldo mensal</span></div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:7,height:7,borderRadius:2,background:"#4ade80"}}/><span style={{fontSize:9,color:"var(--text3)"}}>Acumulado</span></div>
          </div>
        </div>)}

        {chartType==="cartoes"&&(<div>
          {cards.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--text4)",fontSize:13}}>Nenhum cartão cadastrado</div>}
          {cards.length>0&&cardPurchases.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--text4)",fontSize:13}}>Nenhuma compra lançada nos cartões</div>}
          {cards.length>0&&cardPurchases.length>0&&(<>
            <div style={{...S.chartBox,marginBottom:10}}>
              <div style={S.chartTitle}>Faturas por mês</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
                {cardMonthlyData.filter(d=>d.total>0).length===0&&<div style={{textAlign:"center",padding:"16px 0",color:"var(--text4)",fontSize:12}}>Sem faturas no período</div>}
                {cardMonthlyData.map((d,i)=>{
                  if(d.total===0) return null;
                  return(
                    <div key={i} style={{background:"var(--bg)",borderRadius:9,padding:"8px 12px",border:"1px solid var(--border2)"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:600,color:"var(--text1)"}}>{d.month}</span>
                        <span style={{fontSize:13,fontWeight:800,color:"#fb923c"}}>{fmt(d.total)}</span>
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {cards.map(card=>d[card.id]>0&&(
                          <span key={card.id} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:card.color+"22",color:card.color,border:`1px solid ${card.color}44`}}>
                            {card.name}: {fmt(d[card.id])}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={S.chartBox}>
              <div style={S.chartTitle}>Gastos por categoria</div>
              <div style={{fontSize:10,color:"var(--text3)",marginBottom:10}}>Total gasto nos cartões: <strong style={{color:"#fb923c"}}>{fmt(cardCatData.total)}</strong></div>
              {cardCatData.cats.length===0
                ?<div style={{textAlign:"center",padding:"24px 0",color:"var(--text4)",fontSize:12}}>Sem dados</div>
                :(<>
                  <DonutSVG data={cardCatData.cats} total={cardCatData.total}/>
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                    {cardCatData.cats.map((c,i)=>{
                      const pct=cardCatData.total>0?((c.value/cardCatData.total)*100).toFixed(1):0;
                      return(<div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                        <div style={{flex:1,fontSize:12,color:"var(--text2)",fontWeight:500}}>{c.name}</div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>{pct}%</div>
                        <div style={{fontSize:12,color:c.color,fontWeight:700,minWidth:72,textAlign:"right"}}>{fmt(c.value)}</div>
                      </div>);
                    })}
                  </div>
                </>)
              }
            </div>

            <div style={{...S.chartBox,marginTop:10}}>
              <div style={S.chartTitle}>Total por cartão</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                {cards.map(card=>{
                  const total=cardPurchases.filter(p=>p.cardId===card.id).reduce((s,p)=>s+parseFloat(p.amount),0);
                  if(total===0) return null;
                  const pct=cardCatData.total>0?((total/cardCatData.total)*100).toFixed(0):0;
                  return(
                    <div key={card.id} style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:card.color,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:12,color:"var(--text1)",fontWeight:600}}>{card.name}</span>
                          <span style={{fontSize:12,color:card.color,fontWeight:700}}>{fmt(total)}</span>
                        </div>
                        <div style={{height:4,background:"rgba(255,255,255,.07)",borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:card.color,borderRadius:2}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>)}
        </div>)}
      </div>
    </div>
  );
}
