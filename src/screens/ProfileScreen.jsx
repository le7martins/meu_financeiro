import { useState } from 'react';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import Toggle from '../components/Toggle.jsx';
import { fmt, mLabel, newId } from '../utils.js';
import CurrencyInput from '../components/CurrencyInput.jsx';
import S, { tint } from "../styles.js";
import { ModalShell } from "../components/Field.jsx";
function ProfileSection({title,children}){return(<div role="group" aria-label={title}><div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,paddingLeft:2}}>{title}</div><div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:13,overflow:"hidden"}}>{children}</div></div>);}
function ProfileItem({icon,label,sub,badge,onClick,danger,disabled,last}){
  const interactive=!!onClick&&!disabled;
  const Tag=interactive?"button":"div";
  return(
    <Tag {...(interactive?{type:"button",onClick}:{"aria-disabled":disabled?true:undefined})} style={{width:"100%",boxSizing:"border-box",display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"transparent",border:"none",borderBottom:last?"none":"1px solid var(--border-subtle)",cursor:interactive?"pointer":"default",textAlign:"left",fontFamily:"inherit",opacity:disabled?0.45:1}}>
      <span aria-hidden="true" style={{fontSize:"var(--fs-3xl)",flexShrink:0}}>{icon}</span>
      <div style={{flex:1,minWidth:0}}><div style={{fontSize:"var(--fs-base)",fontWeight:600,color:danger?"var(--danger)":"var(--text-1)"}}>{label}</div>{sub&&<div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginTop:1}}>{sub}</div>}</div>
      {badge&&<span style={{fontSize:"var(--fs-2xs)",color:"var(--accent)",background:"var(--accent-surface)",border:"1px solid var(--accent-border)",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{badge}</span>}
      {!badge&&interactive&&<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>}
    </Tag>
  );
}

const ACC_TYPES=[
  {id:"corrente",label:"Conta Corrente",icon:"🏦"},
  {id:"poupanca",label:"Poupança",icon:"💰"},
  {id:"dinheiro",label:"Carteira/Dinheiro",icon:"💵"},
  {id:"investimento",label:"Investimento",icon:"📈"},
  {id:"outro",label:"Outro",icon:"🔵"},
];
const ACC_COLORS=["#60a5fa","#4ade80","#f472b6","#fb923c","#a78bfa","#34d399","#facc15","#38bdf8"];

export default function ProfileScreen({entries,dividas,selMonth,onExportMonth,onExportAll,onExportPDF,onExportRange,onReset,notifPerm,notifSettings,onNotifSettings,onRequestPerm,onBackup,onRestore,theme,onTheme,fbUser,onLogout,onImportEntries,categories=[],accounts=[],onSaveAccounts}){
  const [confirmReset,setConfirmReset]=useState(false);
  const [rangeFrom,setRangeFrom]=useState(selMonth);
  const [rangeTo,setRangeTo]=useState(selMonth);
  const [showAccForm,setShowAccForm]=useState(false);
  const blankAcc=()=>({name:'',type:'corrente',color:ACC_COLORS[0],initialBalance:0});
  const [accDraft,setAccDraft]=useState(blankAcc);
  const [editAccId,setEditAccId]=useState(null);
  const openNewAcc=()=>{const d=blankAcc();setAccDraft(d);setEditAccId(null);setShowAccForm(true);};
  const openEditAcc=(acc)=>{setAccDraft({...acc});setEditAccId(acc.id);setShowAccForm(true);};
  const saveAcc=()=>{
    if(!accDraft.name.trim()) return;
    if(editAccId) onSaveAccounts(accounts.map(a=>a.id===editAccId?{...a,...accDraft}:a));
    else onSaveAccounts([...accounts,{id:newId(),...accDraft}]);
    setShowAccForm(false);setEditAccId(null);
  };
  const [delAccId,setDelAccId]=useState(null);
  const deleteAcc=(id)=>{onSaveAccounts(accounts.filter(a=>a.id!==id));setDelAccId(null);};
  const [confirmLogout,setConfirmLogout]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [importHeaders,setImportHeaders]=useState([]);
  const [importRows,setImportRows]=useState([]);
  const [importMap,setImportMap]=useState({date:'',desc:'',amount:'',type:'',category:''});
  const [importRef]=useState(()=>({current:null}));
  const [editName,setEditName]=useState(false);
  const [newName,setNewName]=useState('');
  const [nameLoading,setNameLoading]=useState(false);
  const [editPass,setEditPass]=useState(false);
  const [curPass,setCurPass]=useState('');
  const [newPass,setNewPass]=useState('');
  const [passLoading,setPassLoading]=useState(false);
  const [passErr,setPassErr]=useState('');
  const permColor=notifPerm==="granted"?"var(--success)":notifPerm==="denied"?"var(--danger)":"var(--warning)";
  const permLabel=notifPerm==="granted"?"Ativadas":notifPerm==="denied"?"Bloqueadas pelo browser":notifPerm==="unsupported"?"Não suportado":"Não permitidas";
  const displayName=fbUser?.displayName||fbUser?.email?.split("@")[0]||"Usuário";
  const photoURL=fbUser?.photoURL;
  const isEmailProvider=fbUser?.providerData?.some(p=>p.providerId==="password");

  const parseBRDate=(s)=>{if(!s)return null;s=s.trim();if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){const[d,m,y]=s.split('/');return`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;}if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;return null;};
  const parseBRNum=(s)=>{if(!s)return null;s=String(s).replace(/[R$\s%]/g,'').trim();if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=parseFloat(s);return isNaN(n)?null:n;};
  const handleCSVFile=(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const text=ev.target.result;
      const firstLine=text.split('\n')[0]||'';
      const sep=firstLine.split(';').length>firstLine.split(',').length?';':',';
      const splitLine=(line)=>{const res=[];let cur='',inQ=false;for(const ch of line){if(ch==='"'){inQ=!inQ;}else if(ch===sep&&!inQ){res.push(cur.trim().replace(/^"|"$/g,''));cur='';}else cur+=ch;}res.push(cur.trim().replace(/^"|"$/g,''));return res;};
      const lines=text.trim().split('\n').filter(l=>l.trim());
      if(lines.length<2){return;}
      const headers=splitLine(lines[0]);
      const rows=lines.slice(1).slice(0,200).map(l=>{const vals=splitLine(l);return Object.fromEntries(headers.map((h,i)=>[h,vals[i]||'']));});
      setImportHeaders(headers);setImportRows(rows);
      const dCol=headers.find(h=>/data|date|dt\b/i.test(h))||'';
      const descCol=headers.find(h=>/descri|memo|hist|lancamento|complemento/i.test(h))||'';
      const amtCol=headers.find(h=>/valor|amount|value|vl\b|debito|credito/i.test(h))||'';
      const catCol=headers.find(h=>/categ|classif|grupo/i.test(h))||'';
      setImportMap({date:dCol,desc:descCol,amount:amtCol,type:'',category:catCol});
      setShowImport(true);
    };
    reader.readAsText(file,'UTF-8');
    e.target.value='';
  };
  const handleConfirmImport=()=>{
    const {date:dCol,desc:descCol,amount:amtCol,category:catCol}=importMap;
    if(!dCol||!descCol||!amtCol)return;
    const now=Date.now();
    const guessCategory=(rawCat,type)=>{
      const fallback=type==='receita'?'outra_receita':'outro';
      if(!rawCat||!catCol) return fallback;
      const norm=(s)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const r=norm(rawCat);
      const found=categories.filter(c=>c.type===type).find(c=>norm(c.name).includes(r)||r.includes(norm(c.name)));
      return found?found.id:fallback;
    };
    const isDuplicate=(ne)=>entries.some(e=>{
      if(Math.abs(parseFloat(e.amount)-ne.amount)>0.01) return false;
      if(e.type!==ne.type) return false;
      if(Math.abs(new Date(e.date)-new Date(ne.date))/86400000>3) return false;
      return e.description.toLowerCase().trim().slice(0,15)===ne.description.toLowerCase().trim().slice(0,15);
    });
    const candidates=importRows.map((row,i)=>{
      const parsedDate=parseBRDate(row[dCol]);
      const parsedAmt=parseBRNum(row[amtCol]);
      if(!parsedDate||parsedAmt===null||parsedAmt===0)return null;
      const type=importMap.type||(parsedAmt<0?'despesa':'receita');
      return{id:`${now}_${i}`,description:row[descCol]||'Importado',amount:Math.abs(parsedAmt),date:parsedDate,type,status:'pago',category:guessCategory(row[catCol],type),recurrence:'none',notes:'',statusByMonth:{},overrides:{},tags:[]};
    }).filter(Boolean);
    if(candidates.length===0)return;
    const unique=candidates.filter(ne=>!isDuplicate(ne));
    const skipped=candidates.length-unique.length;
    if(unique.length===0){alert(`Todos os ${skipped} lançamento${skipped!==1?'s':''} já existem — nenhum importado.`);return;}
    onImportEntries(unique,skipped);
    setShowImport(false);setImportRows([]);setImportHeaders([]);
  };

  const handleSaveName=async()=>{
    if(!newName.trim())return;
    setNameLoading(true);
    try{
      await updateProfile(fbUser,{displayName:newName.trim()});
      setEditName(false);
    }catch(e){/* ignore */}
    setNameLoading(false);
  };
  const handleSavePass=async()=>{
    if(newPass.length<6){setPassErr("Mínimo 6 caracteres");return;}
    setPassLoading(true);setPassErr('');
    try{
      const cred=EmailAuthProvider.credential(fbUser.email,curPass);
      await reauthenticateWithCredential(fbUser,cred);
      await updatePassword(fbUser,newPass);
      setEditPass(false);setCurPass('');setNewPass('');
    }catch(e){
      setPassErr(e.code==='auth/wrong-password'?'Senha atual incorreta':'Erro ao alterar senha');
    }
    setPassLoading(false);
  };

  return(
    <div style={{paddingBottom:90,paddingTop:4}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 16px 20px",borderBottom:"1px solid var(--border-subtle)"}}>
        {photoURL
          ? <img src={photoURL} alt="" style={{width:72,height:72,borderRadius:"50%",border:"2px solid var(--accent-border)",marginBottom:12,objectFit:"cover"}}/>
          : <div style={{width:72,height:72,borderRadius:"50%",background:"var(--primary-bg)",border:"2px solid var(--accent-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"var(--fs-6xl)",marginBottom:12}}>👤</div>
        }
        <div style={{fontSize:"var(--fs-xl)",fontWeight:700,color:"var(--text-1)",marginBottom:3}}>{displayName}</div>
        <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginBottom:2}}>{fbUser?.email}</div>
        <div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)"}}>{entries.length} lançamentos · {(dividas||[]).length} dívidas</div>
      </div>
      <div style={{padding:"16px 14px",display:"flex",flexDirection:"column",gap:12}}>

        <ProfileSection title="Conta">
          <ProfileItem icon="✏️" label="Alterar nome" sub={displayName} onClick={()=>{setNewName(displayName);setEditName(true);}}/>
          {isEmailProvider&&<ProfileItem icon="🔑" label="Alterar senha" sub="Trocar senha da conta" onClick={()=>{setEditPass(true);setCurPass('');setNewPass('');setPassErr('');}}/>}
          {!confirmLogout
            ? <ProfileItem icon="🚪" label="Sair da conta" sub={`Conectado como ${displayName}`} last onClick={()=>setConfirmLogout(true)} danger/>
            : <div style={{padding:"13px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{fontSize:"var(--fs-base)",color:"var(--text-1)"}}>Confirmar saída?</span>
                <div style={{display:"flex",gap:8}}>
                  <button type="button" onClick={()=>setConfirmLogout(false)} style={{padding:"6px 12px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",color:"var(--text-3)",fontSize:"var(--fs-md)",cursor:"pointer"}}>Cancelar</button>
                  <button type="button" onClick={onLogout} style={{padding:"6px 12px",background:"var(--danger-surface)",border:"1px solid var(--danger)",borderRadius:"var(--radius-sm)",color:"var(--danger)",fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer"}}>Sair</button>
                </div>
              </div>
          }
        </ProfileSection>

        <ProfileSection title="Notificações">
          <div style={{padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div><div style={{fontSize:"var(--fs-base)",fontWeight:600,color:"var(--text-1)"}}>🔔 Alertas de vencimento e recebimento</div><div style={{fontSize:"var(--fs-sm)",color:permColor,marginTop:2}}>{permLabel}</div></div>
              {notifPerm==="granted"
                ?<Toggle label="Alertas de vencimento e recebimento" checked={notifSettings.enabled} onChange={v=>onNotifSettings({...notifSettings,enabled:v})}/>
                :notifPerm!=="unsupported"&&<button type="button" onClick={onRequestPerm} style={{minHeight:44,padding:"0 14px",background:"var(--primary-bg)",border:"1px solid var(--primary-border)",borderRadius:"var(--radius-sm)",color:"var(--primary-text)",fontSize:"var(--fs-sm)",fontWeight:700,cursor:"pointer"}}>Permitir</button>}
            </div>
            {notifPerm==="granted"&&notifSettings.enabled&&(<>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:5}}>Avisar com quantos dias de antecedência</div>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3,5,7].map(d=>(
                    <button key={d} onClick={()=>onNotifSettings({...notifSettings,daysBefore:d})}
                      style={{flex:1,minHeight:44,padding:"0",borderRadius:"var(--radius-sm)",border:`1px solid ${notifSettings.daysBefore===d?"var(--accent)":"var(--border-subtle)"}`,background:notifSettings.daysBefore===d?"var(--accent-surface)":"transparent",color:notifSettings.daysBefore===d?"var(--accent)":"var(--text-3)",fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer"}}>{d}d</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div><div style={{fontSize:"var(--fs-md)",color:"var(--text-1)",fontWeight:600}}>Alertar contas vencidas</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>Notificar sobre pagamentos atrasados</div></div>
                <Toggle label="Alertar contas vencidas" checked={notifSettings.overdueAlert} onChange={v=>onNotifSettings({...notifSettings,overdueAlert:v})}/>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div><div style={{fontSize:"var(--fs-md)",color:"var(--text-1)",fontWeight:600}}>Alertar recebimentos</div><div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>Notificar sobre receitas esperadas</div></div>
                <Toggle label="Alertar recebimentos" checked={notifSettings.incomeAlert!==false} onChange={v=>onNotifSettings({...notifSettings,incomeAlert:v})}/>
              </div>
            </>)}
          </div>
        </ProfileSection>

        <ProfileSection title="Contas e carteiras">
          {accounts.map((acc,i)=>(
            <div key={acc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderBottom:i<accounts.length-1?"1px solid var(--border-subtle)":"none"}}>
              <div style={{width:34,height:34,borderRadius:9,background:tint(acc.color,13),border:`1px solid ${tint(acc.color,33)}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                {ACC_TYPES.find(t=>t.id===acc.type)?.icon||"🔵"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"var(--fs-base)",fontWeight:600,color:"var(--text-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acc.name}</div>
                <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>{ACC_TYPES.find(t=>t.id===acc.type)?.label||acc.type} · saldo inicial {fmt(acc.initialBalance||0)}</div>
              </div>
              <button type="button" aria-label={`Editar conta ${acc.name}`} title="Editar conta" onClick={()=>openEditAcc(acc)} style={{background:"transparent",border:"none",color:"var(--text-3)",cursor:"pointer",minWidth:44,minHeight:44,fontSize:"var(--fs-lg)"}}>✏️</button>
              <button type="button" aria-label={`Excluir conta ${acc.name}`} title="Excluir conta" onClick={()=>setDelAccId(acc.id)} style={{background:"transparent",border:"none",color:"var(--danger)",cursor:"pointer",minWidth:44,minHeight:44,fontSize:"var(--fs-lg)"}}>✕</button>
            </div>
          ))}
          {showAccForm?(
            <div style={{padding:"14px",borderTop:accounts.length?"1px solid var(--border-subtle)":"none"}}>
              <div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>{editAccId?"Editar conta":"Nova conta"}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input style={{width:"100%",boxSizing:"border-box",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"9px 11px",color:"var(--text-1)",fontSize:"var(--fs-base)",outline:"none",fontFamily:"inherit"}}
                  aria-label="Nome da conta" autoComplete="off" placeholder="Nome da conta (ex: Nubank, Bradesco...)" value={accDraft.name} onChange={e=>setAccDraft(p=>({...p,name:e.target.value}))}/>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {ACC_TYPES.map(t=>(
                    <button type="button" key={t.id} aria-pressed={accDraft.type===t.id} onClick={()=>setAccDraft(p=>({...p,type:t.id}))}
                      style={{padding:"6px 10px",borderRadius:"var(--radius-sm)",border:`1px solid ${accDraft.type===t.id?"var(--accent)":"var(--border)"}`,background:accDraft.type===t.id?"var(--accent-surface)":"transparent",color:accDraft.type===t.id?"var(--accent)":"var(--text-3)",fontSize:"var(--fs-sm)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:5}}>Cor</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {ACC_COLORS.map(c=>(
                      <button type="button" key={c} aria-label={`Cor ${c}`} aria-pressed={accDraft.color===c} onClick={()=>setAccDraft(p=>({...p,color:c}))}
                        style={{width:26,height:26,borderRadius:"50%",background:c,border:accDraft.color===c?"3px solid var(--text-1)":"2px solid transparent",cursor:"pointer",padding:0,outline:"none"}}/>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="acc-saldo" style={{display:"block",fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:5}}>Saldo inicial</label>
                  <CurrencyInput id="acc-saldo" allowNegative value={accDraft.initialBalance||0} onChange={v=>setAccDraft(p=>({...p,initialBalance:v}))} style={{width:"100%",boxSizing:"border-box",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"9px 11px",color:"var(--text-1)",fontSize:"var(--fs-base)",outline:"none",fontFamily:"inherit"}}/>
                </div>
                <div style={{display:"flex",gap:8,marginTop:2}}>
                  <button type="button" onClick={()=>{setShowAccForm(false);setEditAccId(null);}}
                    style={{flex:1,padding:"9px",background:"transparent",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-md)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                  <button type="button" onClick={saveAcc} disabled={!accDraft.name.trim()}
                    style={{flex:2,padding:"9px",background:"var(--primary-bg)",border:"1px solid var(--primary-border)",color:"var(--primary-text)",borderRadius:"var(--radius-md)",fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:accDraft.name.trim()?1:0.45}}>
                    {editAccId?"Salvar alterações":"Adicionar conta"}
                  </button>
                </div>
              </div>
            </div>
          ):(
            <button type="button" onClick={openNewAcc}
              style={{width:"100%",padding:"12px 14px",background:"transparent",border:"none",borderTop:accounts.length?"1px solid var(--border-subtle)":"none",color:"var(--accent)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>＋</span> Adicionar conta
            </button>
          )}
        </ProfileSection>

        <ProfileSection title="Exportar dados">
          <ProfileItem icon="📄" label="Relatório PDF do mês" sub={`Resumo visual de ${mLabel(selMonth)}`} onClick={onExportPDF}/>
          <ProfileItem icon="📅" label="Exportar mês atual" sub={`CSV com lançamentos de ${mLabel(selMonth)}`} onClick={onExportMonth}/>
          <div style={{padding:"12px 14px",borderTop:"1px solid var(--border-subtle)"}}>
            <div style={{fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9}}>Exportar período</div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
              <div style={{flex:1}}>
                <label htmlFor="rng-from" style={{display:"block",fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:3}}>De</label>
                <input id="rng-from" type="month" value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)} style={{width:"100%",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:9,padding:"7px 10px",color:"var(--text-1)",fontSize:"var(--fs-md)",outline:"none",fontFamily:"inherit"}}/>
              </div>
              <div style={{flex:1}}>
                <label htmlFor="rng-to" style={{display:"block",fontSize:"var(--fs-xs)",color:"var(--text-3)",marginBottom:3}}>Até</label>
                <input id="rng-to" type="month" value={rangeTo} onChange={e=>setRangeTo(e.target.value)} style={{width:"100%",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:9,padding:"7px 10px",color:"var(--text-1)",fontSize:"var(--fs-md)",outline:"none",fontFamily:"inherit"}}/>
              </div>
            </div>
            <button disabled={!rangeFrom||!rangeTo||rangeFrom>rangeTo} onClick={()=>onExportRange&&onExportRange(rangeFrom,rangeTo)}
              style={{width:"100%",padding:"9px",background:"var(--primary-bg)",border:"1px solid var(--primary-border)",color:"var(--primary-text)",borderRadius:"var(--radius-md)",fontSize:"var(--fs-md)",fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:rangeFrom&&rangeTo&&rangeFrom<=rangeTo?1:0.45}}>
              Exportar período selecionado
            </button>
          </div>
          <ProfileItem icon="📦" label="Exportar tudo" sub="Todos os lançamentos em CSV" onClick={onExportAll} last/>
        </ProfileSection>

        <ProfileSection title="Importar dados">
          <input ref={el=>{importRef.current=el;}} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={handleCSVFile}/>
          <ProfileItem icon="📥" label="Importar extrato CSV" sub="Importa lançamentos de extrato bancário em CSV" onClick={()=>importRef.current?.click()} last/>
        </ProfileSection>

        <ProfileSection title="Backup e Restauração">
          <ProfileItem icon="💾" label="Fazer backup" sub="Salva todos os dados em arquivo JSON" onClick={onBackup}/>
          <div style={{padding:"0 14px"}}>
            <label style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderTop:"1px solid var(--border-subtle)",cursor:"pointer"}}>
              <span style={{fontSize:"var(--fs-3xl)",flexShrink:0}}>📂</span>
              <div style={{flex:1}}><div style={{fontSize:"var(--fs-base)",fontWeight:600,color:"var(--text-1)"}}>Restaurar backup</div><div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginTop:1}}>Importa dados de um arquivo JSON</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              <input type="file" accept=".json" onChange={onRestore} style={{display:"none"}}/>
            </label>
          </div>
        </ProfileSection>

        <ProfileSection title="Dados">
          <ProfileItem icon="🗑️" label="Zerar todos os dados" sub="Remove lançamentos, dívidas, cartões e faturas" onClick={()=>setConfirmReset(true)} danger last/>
        </ProfileSection>

        <ProfileSection title="Aparência">
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><div style={{fontSize:"var(--fs-base)",fontWeight:600,color:"var(--text-1)"}}>{theme==="dark"?"🌙 Modo escuro":"☀️ Modo claro"}</div><div style={{fontSize:"var(--fs-sm)",color:"var(--text-3)",marginTop:2}}>Alterna entre escuro e claro</div></div>
            <Toggle label="Modo claro" checked={theme==="light"} onChange={v=>onTheme(v?"light":"dark")}/>
          </div>
        </ProfileSection>

        <ProfileSection title="Sobre">
          <ProfileItem icon="📱" label="CashUp" sub="Versão 1.3.0" last/>
        </ProfileSection>
      </div>

      {editName&&(
        <ModalShell title="Alterar nome" onClose={()=>setEditName(false)} compact>
          <input style={{...S.inp,marginBottom:16}} aria-label="Seu nome" autoComplete="name" placeholder="Seu nome" value={newName} onChange={e=>setNewName(e.target.value)}/>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setEditName(false)} style={{flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",cursor:"pointer"}}>Cancelar</button>
            <button type="button" onClick={handleSaveName} disabled={nameLoading||!newName.trim()} style={{flex:1,padding:"11px",background:"var(--primary-bg)",border:"1px solid var(--primary-border)",borderRadius:"var(--radius-md)",color:"var(--primary-text)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer",opacity:nameLoading||!newName.trim()?0.5:1}}>
              {nameLoading?"Salvando...":"Salvar"}
            </button>
          </div>
        </ModalShell>
      )}

      {editPass&&(
        <ModalShell title="Alterar senha" onClose={()=>setEditPass(false)} compact>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            <div><label htmlFor="pw-atual" style={S.lbl}>Senha atual</label><input id="pw-atual" style={S.inp} type="password" autoComplete="current-password" placeholder="••••••••" value={curPass} onChange={e=>setCurPass(e.target.value)}/></div>
            <div><label htmlFor="pw-nova" style={S.lbl}>Nova senha</label><input id="pw-nova" style={{...S.inp,borderColor:passErr?"var(--danger)":"var(--border)"}} type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={newPass} onChange={e=>setNewPass(e.target.value)} aria-invalid={passErr?true:undefined} aria-describedby={passErr?"pw-err":undefined}/></div>
            {passErr&&<div id="pw-err" role="alert" style={{fontSize:"var(--fs-md)",color:"var(--danger)"}}>⚠️ {passErr}</div>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setEditPass(false)} style={{flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",cursor:"pointer"}}>Cancelar</button>
            <button type="button" onClick={handleSavePass} disabled={passLoading||!curPass||!newPass} style={{flex:1,padding:"11px",background:"var(--primary-bg)",border:"1px solid var(--primary-border)",borderRadius:"var(--radius-md)",color:"var(--primary-text)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer",opacity:passLoading||!curPass||!newPass?0.5:1}}>
              {passLoading?"Salvando...":"Salvar"}
            </button>
          </div>
        </ModalShell>
      )}

      {delAccId&&(()=>{
        const acc=accounts.find(a=>a.id===delAccId);
        if(!acc) return null;
        const n=entries.filter(e=>e.accountId===acc.id).length;
        return(
          <ModalShell title="Excluir conta" onClose={()=>setDelAccId(null)} compact>
            <div style={{background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:11,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)",marginBottom:2}}>{acc.name}</div>
              <div style={{fontSize:"var(--fs-sm)",color:"var(--danger)"}}>{n>0?`${n} lançamento${n!==1?"s":""} vinculado${n!==1?"s":""} ficará${n!==1?"ão":""} sem conta.`:"Esta conta não tem lançamentos vinculados."}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>setDelAccId(null)} style={{flex:1,minHeight:44,background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button type="button" onClick={()=>deleteAcc(acc.id)} style={{flex:1,minHeight:44,background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",color:"var(--danger)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"}}>Excluir</button>
            </div>
          </ModalShell>
        );
      })()}

      {confirmReset&&(
        <ModalShell title="Zerar dados" onClose={()=>setConfirmReset(false)} compact>
          <div style={{background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:11,padding:"14px",marginBottom:20,textAlign:"center"}}>
            <div aria-hidden="true" style={{fontSize:"var(--fs-6xl)",marginBottom:8}}>⚠️</div>
            <div style={{fontSize:"var(--fs-base)",fontWeight:700,color:"var(--text-1)",marginBottom:6}}>Tem certeza?</div>
            <div style={{fontSize:"var(--fs-md)",color:"var(--danger)",lineHeight:1.5}}>Isso removerá {entries.length} lançamento{entries.length!==1?"s":""}, {(dividas||[]).length} dívida{(dividas||[]).length!==1?"s":""}, todos os cartões, compras e faturas, permanentemente. Categorias, contas, metas e orçamentos são mantidos.</div>
          </div>
          <button type="button" onClick={onBackup} style={{width:"100%",minHeight:44,marginBottom:12,background:"var(--accent-surface)",border:"1px solid var(--accent-border)",borderRadius:"var(--radius-md)",color:"var(--accent)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>💾 Baixar backup antes</button>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setConfirmReset(false)} style={{flex:1,padding:"12px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button type="button" onClick={()=>{onReset();setConfirmReset(false);}} style={{flex:1,padding:"12px",background:"var(--danger-soft)",border:"1px solid var(--danger-border)",borderRadius:"var(--radius-md)",color:"var(--danger)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer"}}>Sim, zerar tudo</button>
          </div>
        </ModalShell>
      )}

      {showImport&&(
        <ModalShell title="Importar CSV" subtitle={<div style={{fontSize:"var(--fs-xs)",color:"var(--text-3)",marginTop:1}}>{importRows.length} linhas detectadas</div>} onClose={()=>setShowImport(false)}>
          <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Mapear colunas</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            {[['date','📅 Data'],['desc','📝 Descrição'],['amount','💰 Valor'],['category','🏷️ Categoria (opcional)']].map(([key,label])=>(
              <div key={key} style={{display:"flex",alignItems:"center",gap:8}}>
                <label htmlFor={`imp-${key}`} style={{fontSize:"var(--fs-sm)",color:"var(--text-2)",width:90,flexShrink:0}}>{label}</label>
                <select id={`imp-${key}`} value={importMap[key]} onChange={e=>setImportMap(p=>({...p,[key]:e.target.value}))}
                  style={{...S.inp,flex:1,marginBottom:0,padding:"6px 10px",fontSize:"var(--fs-sm)"}}>
                  <option value="">— selecionar —</option>
                  {importHeaders.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            {/* Tipo forçado */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span id="imp-tipo-lbl" style={{fontSize:"var(--fs-sm)",color:"var(--text-2)",width:90,flexShrink:0}}>🔀 Tipo</span>
              <div role="group" aria-labelledby="imp-tipo-lbl" style={{display:"flex",gap:6,flex:1}}>
                {[['','Auto (por sinal)'],['despesa','Forçar Despesa'],['receita','Forçar Receita']].map(([v,l])=>(
                  <button type="button" key={v} aria-pressed={importMap.type===v} onClick={()=>setImportMap(p=>({...p,type:v}))}
                    style={{flex:1,padding:"5px 0",fontSize:"var(--fs-xs)",borderRadius:"var(--radius-xs)",border:`1px solid ${importMap.type===v?"var(--accent)":"var(--border-strong)"}`,background:importMap.type===v?"var(--accent-surface)":"transparent",color:importMap.type===v?"var(--accent)":"var(--text-3)",cursor:"pointer"}}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Prévia (5 primeiras linhas)</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14,maxHeight:160,overflowY:"auto"}}>
            {importRows.slice(0,5).map((row,i)=>{
              const dt=importMap.date?parseBRDate(row[importMap.date]):null;
              const amt=importMap.amount?parseBRNum(row[importMap.amount]):null;
              const desc=importMap.desc?row[importMap.desc]:'';
              const catRaw=importMap.category?row[importMap.category]:'';
              const ok=dt&&amt!==null&&amt!==0;
              return(
                <div key={i} style={{display:"flex",gap:6,background:ok?"var(--surface-sunken)":"var(--danger-soft)",borderRadius:7,padding:"6px 8px",border:`1px solid ${ok?"var(--border-subtle)":"var(--danger-border)"}`,fontSize:"var(--fs-xs)"}}>
                  <span style={{color:"var(--text-3)",width:62,flexShrink:0}}>{dt||'— data ?'}</span>
                  <span style={{flex:1,color:"var(--text-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{desc||'—'}</span>
                  {catRaw&&<span style={{color:"var(--accent)",flexShrink:0,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis"}}>{catRaw}</span>}
                  <span style={{fontWeight:700,color:amt===null?'var(--danger)':amt<0?'var(--orange)':'var(--success)',flexShrink:0}}>{amt!==null?`${amt<0?'-':'+'} ${fmt(Math.abs(amt))}`:'—'}</span>
                </div>
              );
            })}
          </div>
          <div style={{marginBottom:14,background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:"var(--radius-sm)",padding:"8px 12px",fontSize:"var(--fs-xs)",color:"var(--text-3)"}}>
            💡 Valores negativos → Despesa · Positivos → Receita · Categoria: mapeada automaticamente por nome
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setShowImport(false)} style={{flex:1,padding:"11px",background:"var(--surface-2)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-base)",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button type="button" onClick={handleConfirmImport} disabled={!importMap.date||!importMap.desc||!importMap.amount}
              style={{flex:2,padding:"11px",background:"var(--primary-bg)",border:"1px solid var(--primary-border)",borderRadius:"var(--radius-md)",color:"var(--primary-text)",fontSize:"var(--fs-base)",fontWeight:700,cursor:"pointer",opacity:(!importMap.date||!importMap.desc||!importMap.amount)?0.4:1}}>
              Importar {importRows.filter(row=>{const dt=parseBRDate(row[importMap.date]);const amt=parseBRNum(row[importMap.amount]);return dt&&amt!==null&&amt!==0;}).length} lançamentos
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
