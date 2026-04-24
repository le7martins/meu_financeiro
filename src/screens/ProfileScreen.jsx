import { useState } from 'react';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import Toggle from '../components/Toggle.jsx';
import { mLabel } from '../utils.js';
import S from '../styles.js';

function ProfileSection({title,children}){return(<div><div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,paddingLeft:2}}>{title}</div><div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:13,overflow:"hidden"}}>{children}</div></div>);}
function ProfileItem({icon,label,sub,badge,onClick,danger,disabled,last}){return(<button onClick={!disabled&&onClick?onClick:undefined} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"transparent",border:"none",borderBottom:last?"none":"1px solid #0f1825",cursor:disabled||!onClick?"default":"pointer",textAlign:"left",fontFamily:"inherit",opacity:disabled?0.45:1}}><span style={{fontSize:18,flexShrink:0}}>{icon}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:danger?"#f87171":"var(--text1)"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{sub}</div>}</div>{badge&&<span style={{fontSize:9,color:"#8ab4f8",background:"#0d1a2e",border:"1px solid #1a3a6e",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{badge}</span>}{!badge&&onClick&&!disabled&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>}</button>);}

export default function ProfileScreen({entries,dividas,selMonth,onExportMonth,onExportAll,onExportPDF,onReset,notifPerm,notifSettings,onNotifSettings,onRequestPerm,onBackup,onRestore,theme,onTheme,fbUser,onLogout,onImportEntries,categories=[]}){
  const [confirmReset,setConfirmReset]=useState(false);
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
  const permColor=notifPerm==="granted"?"#4ade80":notifPerm==="denied"?"#f87171":"#facc15";
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
    const guessCategory=(rawCat)=>{
      if(!rawCat||!catCol) return 'outro';
      const norm=(s)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const r=norm(rawCat);
      const found=categories.find(c=>norm(c.name).includes(r)||r.includes(norm(c.name)));
      return found?found.id:'outro';
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
      return{id:`${now}_${i}`,description:row[descCol]||'Importado',amount:Math.abs(parsedAmt),date:parsedDate,type,status:'pago',category:guessCategory(row[catCol]),recurrence:'none',notes:'',statusByMonth:{},overrides:{},tags:[]};
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
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 16px 20px",borderBottom:"1px solid var(--border2)"}}>
        {photoURL
          ? <img src={photoURL} alt="" style={{width:72,height:72,borderRadius:"50%",border:"2px solid #1a3a6e",marginBottom:12,objectFit:"cover"}}/>
          : <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"2px solid #1a3a6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:12}}>👤</div>
        }
        <div style={{fontSize:15,fontWeight:700,color:"var(--text1)",marginBottom:3}}>{displayName}</div>
        <div style={{fontSize:11,color:"var(--text3)",marginBottom:2}}>{fbUser?.email}</div>
        <div style={{fontSize:11,color:"var(--text3)"}}>{entries.length} lançamentos · {(dividas||[]).length} dívidas</div>
      </div>
      <div style={{padding:"16px 14px",display:"flex",flexDirection:"column",gap:12}}>

        <ProfileSection title="Conta">
          <ProfileItem icon="✏️" label="Alterar nome" sub={displayName} onClick={()=>{setNewName(displayName);setEditName(true);}}/>
          {isEmailProvider&&<ProfileItem icon="🔑" label="Alterar senha" sub="Trocar senha da conta" onClick={()=>{setEditPass(true);setCurPass('');setNewPass('');setPassErr('');}}/>}
          {!confirmLogout
            ? <ProfileItem icon="🚪" label="Sair da conta" sub={`Conectado como ${displayName}`} last onClick={()=>setConfirmLogout(true)} danger/>
            : <div style={{padding:"13px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{fontSize:13,color:"var(--text1)"}}>Confirmar saída?</span>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setConfirmLogout(false)} style={{padding:"6px 12px",background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text3)",fontSize:12,cursor:"pointer"}}>Cancelar</button>
                  <button onClick={onLogout} style={{padding:"6px 12px",background:"#2a1a1a",border:"1px solid #f87171",borderRadius:8,color:"#f87171",fontSize:12,fontWeight:700,cursor:"pointer"}}>Sair</button>
                </div>
              </div>
          }
        </ProfileSection>

        <ProfileSection title="Notificações">
          <div style={{padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"var(--text1)"}}>🔔 Alertas de vencimento e recebimento</div><div style={{fontSize:11,color:permColor,marginTop:2}}>{permLabel}</div></div>
              {notifPerm==="granted"
                ?<Toggle checked={notifSettings.enabled} onChange={v=>onNotifSettings({...notifSettings,enabled:v})}/>
                :notifPerm!=="unsupported"&&<button onClick={onRequestPerm} style={{padding:"6px 12px",background:"#1a3a6e",border:"1px solid #2a4a8e",borderRadius:8,color:"#8ab4f8",fontSize:11,fontWeight:700,cursor:"pointer"}}>Permitir</button>}
            </div>
            {notifPerm==="granted"&&notifSettings.enabled&&(<>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:"var(--text3)",marginBottom:5}}>Avisar com quantos dias de antecedência</div>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3,5,7].map(d=>(
                    <button key={d} onClick={()=>onNotifSettings({...notifSettings,daysBefore:d})}
                      style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${notifSettings.daysBefore===d?"#8ab4f8":"#111820"}`,background:notifSettings.daysBefore===d?"#0d1a2e":"transparent",color:notifSettings.daysBefore===d?"#8ab4f8":"var(--text3)",fontSize:12,fontWeight:700,cursor:"pointer"}}>{d}d</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div><div style={{fontSize:12,color:"var(--text1)",fontWeight:600}}>Alertar contas vencidas</div><div style={{fontSize:10,color:"var(--text3)"}}>Notificar sobre pagamentos atrasados</div></div>
                <Toggle checked={notifSettings.overdueAlert} onChange={v=>onNotifSettings({...notifSettings,overdueAlert:v})}/>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div><div style={{fontSize:12,color:"var(--text1)",fontWeight:600}}>Alertar recebimentos</div><div style={{fontSize:10,color:"var(--text3)"}}>Notificar sobre receitas esperadas</div></div>
                <Toggle checked={notifSettings.incomeAlert!==false} onChange={v=>onNotifSettings({...notifSettings,incomeAlert:v})}/>
              </div>
            </>)}
          </div>
        </ProfileSection>

        <ProfileSection title="Exportar dados">
          <ProfileItem icon="📄" label="Relatório PDF do mês" sub={`Resumo visual de ${mLabel(selMonth)}`} onClick={onExportPDF}/>
          <ProfileItem icon="📅" label="Exportar mês atual" sub={`CSV com lançamentos de ${mLabel(selMonth)}`} onClick={onExportMonth}/>
          <ProfileItem icon="📦" label="Exportar tudo" sub="Todos os lançamentos em CSV" onClick={onExportAll} last/>
        </ProfileSection>

        <ProfileSection title="Importar dados">
          <input ref={el=>{importRef.current=el;}} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={handleCSVFile}/>
          <ProfileItem icon="📥" label="Importar extrato CSV" sub="Importa lançamentos de extrato bancário em CSV" onClick={()=>importRef.current?.click()} last/>
        </ProfileSection>

        <ProfileSection title="Backup e Restauração">
          <ProfileItem icon="💾" label="Fazer backup" sub="Salva todos os dados em arquivo JSON" onClick={onBackup}/>
          <div style={{padding:"0 14px"}}>
            <label style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderTop:"1px solid #0f1825",cursor:"pointer"}}>
              <span style={{fontSize:18,flexShrink:0}}>📂</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--text1)"}}>Restaurar backup</div><div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>Importa dados de um arquivo JSON</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              <input type="file" accept=".json" onChange={onRestore} style={{display:"none"}}/>
            </label>
          </div>
        </ProfileSection>

        <ProfileSection title="Dados">
          <ProfileItem icon="🗑️" label="Zerar todos os dados" sub="Remove todos os lançamentos e dívidas" onClick={()=>setConfirmReset(true)} danger last/>
        </ProfileSection>

        <ProfileSection title="Aparência">
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><div style={{fontSize:13,fontWeight:600,color:"var(--text1)"}}>{theme==="dark"?"🌙 Modo escuro":"☀️ Modo claro"}</div><div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Alterna entre escuro e claro</div></div>
            <Toggle checked={theme==="light"} onChange={v=>onTheme(v?"light":"dark")}/>
          </div>
        </ProfileSection>

        <ProfileSection title="Sobre">
          <ProfileItem icon="📱" label="CashUp" sub="Versão 1.3.0" last/>
        </ProfileSection>
      </div>

      {editName&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setEditName(false)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Alterar nome</div><button style={S.xBtn} onClick={()=>setEditName(false)}>✕</button></div>
            <input style={{...S.inp,marginBottom:16}} placeholder="Seu nome" value={newName} onChange={e=>setNewName(e.target.value)} autoFocus/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditName(false)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleSaveName} disabled={nameLoading||!newName.trim()} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",borderRadius:10,color:"#8ab4f8",fontSize:13,fontWeight:700,cursor:"pointer",opacity:nameLoading||!newName.trim()?0.5:1}}>
                {nameLoading?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editPass&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setEditPass(false)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Alterar senha</div><button style={S.xBtn} onClick={()=>setEditPass(false)}>✕</button></div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              <div><label style={S.lbl}>Senha atual</label><input style={S.inp} type="password" placeholder="••••••••" value={curPass} onChange={e=>setCurPass(e.target.value)}/></div>
              <div><label style={S.lbl}>Nova senha</label><input style={S.inp} type="password" placeholder="Mínimo 6 caracteres" value={newPass} onChange={e=>setNewPass(e.target.value)}/></div>
              {passErr&&<div style={{fontSize:12,color:"#f87171"}}>⚠️ {passErr}</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditPass(false)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleSavePass} disabled={passLoading||!curPass||!newPass} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",borderRadius:10,color:"#8ab4f8",fontSize:13,fontWeight:700,cursor:"pointer",opacity:passLoading||!curPass||!newPass?0.5:1}}>
                {passLoading?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReset&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setConfirmReset(false)}>
          <div style={{...S.modal,maxHeight:"auto"}} className="modal-in">
            <div style={S.mHeader}><div style={S.mTitle}>Zerar dados</div><button style={S.xBtn} onClick={()=>setConfirmReset(false)}>✕</button></div>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:11,padding:"14px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>⚠️</div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text1)",marginBottom:6}}>Tem certeza?</div>
              <div style={{fontSize:12,color:"#f87171",lineHeight:1.5}}>Isso removerá {entries.length} lançamento{entries.length!==1?"s":""} e {(dividas||[]).length} dívida{(dividas||[]).length!==1?"s":""} permanentemente.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmReset(false)} style={{flex:1,padding:"12px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>{onReset();setConfirmReset(false);}} style={{flex:1,padding:"12px",background:"rgba(239,68,68,.15)",border:"1px solid #f8717144",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>Sim, zerar tudo</button>
            </div>
          </div>
        </div>
      )}

      {showImport&&(
        <div className="appOverlay" style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowImport(false)}>
          <div style={S.modal} className="modal-in">
            <div style={S.mHeader}><div><div style={S.mTitle}>Importar CSV</div><div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{importRows.length} linhas detectadas</div></div><button style={S.xBtn} onClick={()=>setShowImport(false)}>✕</button></div>
            <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Mapear colunas</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {[['date','📅 Data'],['desc','📝 Descrição'],['amount','💰 Valor'],['category','🏷️ Categoria (opcional)']].map(([key,label])=>(
                <div key={key} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:"var(--text2)",width:90,flexShrink:0}}>{label}</span>
                  <select value={importMap[key]} onChange={e=>setImportMap(p=>({...p,[key]:e.target.value}))}
                    style={{...S.inp,flex:1,marginBottom:0,padding:"6px 10px",fontSize:11}}>
                    <option value="">— selecionar —</option>
                    {importHeaders.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              {/* Tipo forçado */}
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"var(--text2)",width:90,flexShrink:0}}>🔀 Tipo</span>
                <div style={{display:"flex",gap:6,flex:1}}>
                  {[['','Auto (por sinal)'],['despesa','Forçar Despesa'],['receita','Forçar Receita']].map(([v,l])=>(
                    <button key={v} onClick={()=>setImportMap(p=>({...p,type:v}))}
                      style={{flex:1,padding:"5px 0",fontSize:10,borderRadius:6,border:`1px solid ${importMap.type===v?"#8ab4f8":"#1a2840"}`,background:importMap.type===v?"#0d1a2e":"transparent",color:importMap.type===v?"#8ab4f8":"var(--text3)",cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Prévia (5 primeiras linhas)</div>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14,maxHeight:160,overflowY:"auto"}}>
              {importRows.slice(0,5).map((row,i)=>{
                const dt=importMap.date?parseBRDate(row[importMap.date]):null;
                const amt=importMap.amount?parseBRNum(row[importMap.amount]):null;
                const desc=importMap.desc?row[importMap.desc]:'';
                const catRaw=importMap.category?row[importMap.category]:'';
                const ok=dt&&amt!==null&&amt!==0;
                return(
                  <div key={i} style={{display:"flex",gap:6,background:ok?"var(--bg)":"rgba(248,113,113,.07)",borderRadius:7,padding:"6px 8px",border:`1px solid ${ok?"var(--border2)":"#f8717133"}`,fontSize:10}}>
                    <span style={{color:"var(--text3)",width:62,flexShrink:0}}>{dt||'— data ?'}</span>
                    <span style={{flex:1,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{desc||'—'}</span>
                    {catRaw&&<span style={{color:"#8ab4f8",flexShrink:0,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis"}}>{catRaw}</span>}
                    <span style={{fontWeight:700,color:amt===null?'#f87171':amt<0?'#fb923c':'#4ade80',flexShrink:0}}>{amt!==null?`${amt<0?'-':'+'} R$${Math.abs(amt).toFixed(2)}`:'—'}</span>
                  </div>
                );
              })}
            </div>
            <div style={{marginBottom:14,background:"rgba(138,180,248,.06)",border:"1px solid #1a3a6e44",borderRadius:8,padding:"8px 12px",fontSize:10,color:"var(--text3)"}}>
              💡 Valores negativos → Despesa · Positivos → Receita · Categoria: mapeada automaticamente por nome
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowImport(false)} style={{flex:1,padding:"11px",background:"var(--card-bg2)",border:"1px solid #1a2840",borderRadius:10,color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleConfirmImport} disabled={!importMap.date||!importMap.desc||!importMap.amount}
                style={{flex:2,padding:"11px",background:"linear-gradient(135deg,#1a3a6e,#0d2247)",border:"1px solid #2a4a8e44",borderRadius:10,color:"#8ab4f8",fontSize:13,fontWeight:700,cursor:"pointer",opacity:(!importMap.date||!importMap.desc||!importMap.amount)?0.4:1}}>
                Importar {importRows.filter(row=>{const dt=parseBRDate(row[importMap.date]);const amt=parseBRNum(row[importMap.amount]);return dt&&amt!==null&&amt!==0;}).length} lançamentos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
