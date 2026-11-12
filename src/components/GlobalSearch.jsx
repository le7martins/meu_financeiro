import { fmt, mLabel } from '../utils.js';

const closeBtn = {background:"none",border:"none",color:"var(--text-4)",cursor:"pointer",lineHeight:1,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"};

// Busca em todos os meses (lançamentos e dívidas). Ao escolher, vai para o mês.
export default function GlobalSearch({ open, query, setQuery, onClose, onPick, entries, dividas, categories }) {
  return (<>
      {open&&(
        <div role="dialog" aria-modal="true" aria-label="Busca global"
          style={{position:"fixed",inset:0,background:"var(--backdrop-soft)",zIndex:200,display:"flex",flexDirection:"column",padding:"60px 14px 14px"}}
          onClick={e=>e.target===e.currentTarget&&onClose()}>
          <div style={{background:"var(--surface-raised)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",overflow:"hidden",boxShadow:"var(--shadow-lg)",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{color:"var(--accent)",flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus value={query} onChange={e=>setQuery(e.target.value)}
                aria-label="Buscar em todos os lançamentos"
                placeholder="Buscar em todos os lançamentos..."
                style={{flex:1,minWidth:0,background:"transparent",border:"none",outline:"none",color:"var(--text-1)",fontSize:"var(--fs-lg)",fontFamily:"inherit"}}/>
              {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Limpar busca" style={{...closeBtn,fontSize:"var(--fs-2xl)"}}><span aria-hidden="true">✕</span></button>}
              <button type="button" onClick={()=>onClose()} aria-label="Fechar busca" style={{...closeBtn,fontSize:"var(--fs-3xl)"}}><span aria-hidden="true">✕</span></button>
            </div>
            <div aria-live="polite" style={{overflowY:"auto",flex:1}}>
              {(()=>{
                const q=query.trim().toLowerCase();
                if(!q) return <div style={{padding:"24px",textAlign:"center",color:"var(--text-3)",fontSize:"var(--fs-md)"}}>Digite para buscar em todos os meses e abas</div>;
                const catName=(id)=>(categories.find(c=>c.id===id)?.name||id||'').toLowerCase();
                const allEntries=entries.filter(e=>e.description.toLowerCase().includes(q)||(e.notes||'').toLowerCase().includes(q)||catName(e.category).includes(q)||(e.tags||[]).some(t=>t.toLowerCase().includes(q)));
                const allDividas=dividas.filter(d=>d.name.toLowerCase().includes(q));
                const all=[
                  ...allEntries.map(e=>({...e,_type:'entry'})),
                  ...allDividas.map(d=>({...d,_type:'divida'}))
                ];
                const results=all.slice(0,30);
                const extra=all.length-results.length;
                if(!results.length) return <div style={{padding:"24px",textAlign:"center",color:"var(--text-3)",fontSize:"var(--fs-md)"}}>Nenhum resultado para "{query}"</div>;
                const rows=results.map((r,i)=>{
                  const mk=r.date?r.date.substring(0,7):r.startMonth;
                  const cat=categories.find(c=>c.id===(r.category||r._type));
                  const color=cat?.color||(r._type==='divida'?"var(--danger)":"var(--accent)");
                  const pick=()=>{if(mk){onPick(mk);}onClose();};
                  return(
                    <div key={i} role="button" tabIndex={0} onClick={pick}
                      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}}}
                      style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",minHeight:44,borderBottom:"1px solid var(--border-subtle)",cursor:"pointer",transition:"background .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--surface-hover)"}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <div aria-hidden="true" style={{width:8,height:8,borderRadius:"var(--radius-full)",background:color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"var(--fs-md)",fontWeight:600,color:"var(--text-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.description||r.name}</div>
                        <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>{mLabel(mk)}{cat?` · ${cat.name}`:''}</div>
                      </div>
                      <div style={{fontSize:"var(--fs-md)",fontWeight:700,color:r.type==="receita"?"var(--success)":r._type==="divida"?"var(--danger)":"var(--text-2)",flexShrink:0}}>
                        {r.type==="receita"?"+":""}{fmt(r.amount||r.totalAmount||0)}
                      </div>
                    </div>
                  );
                });
                return(<>{rows}{extra>0&&<div style={{padding:"12px 14px",fontSize:"var(--fs-sm)",color:"var(--text-3)",textAlign:"center"}}>+{extra} resultado{extra>1?"s":""} — refine a busca</div>}</>);
              })()}
            </div>
          </div>
        </div>
      )}
  </>);
}
