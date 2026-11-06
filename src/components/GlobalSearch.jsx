import { fmt, mLabel } from '../utils.js';

// Busca em todos os meses (lançamentos e dívidas). Ao escolher, vai para o mês.
export default function GlobalSearch({ open, query, setQuery, onClose, onPick, entries, dividas, categories }) {
  return (<>
      {open&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:200,display:"flex",flexDirection:"column",padding:"60px 14px 14px"}}
          onClick={e=>e.target===e.currentTarget&&onClose()}>
          <div style={{background:"var(--card-bg)",borderRadius:16,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus value={query} onChange={e=>setQuery(e.target.value)}
                placeholder="Buscar em todos os lançamentos..."
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:"var(--text1)",fontSize:14,fontFamily:"inherit"}}/>
              {query&&<button onClick={()=>setQuery('')} style={{background:"none",border:"none",color:"var(--text4)",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 4px"}}>✕</button>}
              <button onClick={()=>onClose()} style={{background:"none",border:"none",color:"var(--text4)",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 4px"}}>✕</button>
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {(()=>{
                const q=query.trim().toLowerCase();
                if(!q) return <div style={{padding:"24px",textAlign:"center",color:"var(--text4)",fontSize:12}}>Digite para buscar em todos os meses e abas</div>;
                const allEntries=entries.filter(e=>e.description.toLowerCase().includes(q)||(e.notes||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q));
                const allDividas=dividas.filter(d=>d.name.toLowerCase().includes(q));
                const results=[
                  ...allEntries.map(e=>({...e,_type:'entry'})),
                  ...allDividas.map(d=>({...d,_type:'divida'}))
                ].slice(0,30);
                if(!results.length) return <div style={{padding:"24px",textAlign:"center",color:"var(--text4)",fontSize:12}}>Nenhum resultado para "{query}"</div>;
                return results.map((r,i)=>{
                  const mk=r.date?r.date.substring(0,7):r.startMonth;
                  const cat=categories.find(c=>c.id===(r.category||r._type));
                  const color=cat?.color||(r._type==='divida'?"#f87171":"#8ab4f8");
                  return(
                    <div key={i} onClick={()=>{if(mk){onPick(mk);}onClose();}}
                      style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderBottom:"1px solid var(--border2)",cursor:"pointer",transition:"background .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(138,180,248,.05)"}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.description||r.name}</div>
                        <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{mLabel(mk)}{cat?` · ${cat.name}`:''}</div>
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:r.type==="receita"?"#4ade80":r._type==="divida"?"#f87171":"var(--text2)",flexShrink:0}}>
                        {r.type==="receita"?"+":"-"}{fmt(r.amount||r.totalAmount||0)}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
  </>);
}
