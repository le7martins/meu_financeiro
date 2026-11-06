// ─── Styles ──────────────────────────────────────────────────
// Só tokens (src/appCss.js) — nenhuma cor hex aqui. Guia: .omc/plans/ui-tokens.md
// Raio: xs=6 sm=8 md=10 lg=12 xl=16 2xl=20 · Fonte: 2xs=9 xs=10 sm=11 md=12 base=13 lg=14 xl=15 …

// Tinta translúcida de uma cor qualquer (token var(--x) OU hex vindo de dados).
// Substitui o padrão `${cor}33` (que quebra com var()). pct = opacidade em %.
// Equivalências hex→%: 11≈7 18≈9 20/22≈13 33=20 44≈27 55=33 66=40 88≈53 99=60
export const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const S={
  root:       {minHeight:"100vh",background:"var(--bg)",color:"var(--text-1)",fontFamily:"var(--font-sans)",paddingBottom:72},
  header:     {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 8px",borderBottom:"1px solid var(--border-subtle)"},
  headerLeft: {display:"flex",alignItems:"center",gap:12},
  appName:    {fontSize:"var(--fs-4xl)",fontWeight:800,color:"var(--text-1)",letterSpacing:"-0.5px"},
  appSub:     {fontSize:"var(--fs-sm)",color:"var(--text-3)",marginTop:1},
  heroCard:   {background:"var(--hero-bg)",border:"1px solid var(--hero-border)",borderRadius:"var(--radius-2xl)",padding:"16px 18px",position:"relative",overflow:"hidden"},
  arrowBtn:   {width:42,height:42,borderRadius:"var(--radius-lg)",background:"var(--surface)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-3)",cursor:"pointer"},
  hbtn:       {display:"flex",alignItems:"center",gap:5,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text-3)",padding:"7px 11px",borderRadius:"var(--radius-md)",fontSize:"var(--fs-md)",fontWeight:600,cursor:"pointer"},
  addBtn:     {background:"var(--primary-bg)",border:"1px solid var(--primary-border)",color:"var(--primary-text)"},
  fTab:       {flexShrink:0,display:"flex",alignItems:"center",gap:5,padding:"6px 11px",background:"transparent",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",color:"var(--text-4)",fontSize:"var(--fs-sm)",fontWeight:500,cursor:"pointer"},
  fTabActive: {background:"var(--tab-active-bg)",border:"1px solid var(--tab-active-border)",color:"var(--tab-active-color)"},
  fCount:     {background:"var(--surface-3)",color:"var(--text-4)",borderRadius:"var(--radius-xs)",fontSize:"var(--fs-xs)",padding:"1px 5px",fontWeight:700},
  fCountActive:{background:"var(--accent-soft)",color:"var(--accent)"},
  list:       {padding:"0 14px",display:"flex",flexDirection:"column",gap:7},
  card:       {background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"11px 12px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8},
  cardL:      {display:"flex",alignItems:"flex-start",gap:9,flex:1,minWidth:0},
  cardTitle:  {fontSize:"var(--fs-base)",fontWeight:600,color:"var(--text-1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  cardMeta:   {display:"flex",gap:4,marginTop:3,alignItems:"center",flexWrap:"wrap"},
  tag:        {fontSize:"var(--fs-2xs)",borderRadius:"var(--radius-xs)",padding:"1px 6px",border:"1px solid",fontWeight:600},
  cardR:      {display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0},
  iconBtn:    {width:40,height:40,borderRadius:"var(--radius-md)",border:"none",cursor:"pointer",fontSize:"var(--fs-md)",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"},
  badge:      {fontSize:"var(--fs-2xs)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",padding:"2px 7px",borderRadius:"var(--radius-xs)"},
  empty:      {textAlign:"center",padding:"52px 20px"},
  chartBox:   {background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"14px 12px",marginBottom:12},
  chartTitle: {fontSize:"var(--fs-sm)",fontWeight:700,color:"var(--accent)",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"},
  bottomNav:  {position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"var(--nav-bg)",borderTop:"1px solid var(--border)",display:"flex",zIndex:50},
  navBtn:     {flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px 14px",background:"transparent",border:"none",cursor:"pointer",gap:3},
  navBtnActive:{background:"var(--surface)"},
  overlay:    {position:"fixed",inset:0,background:"var(--backdrop)",backdropFilter:"blur(7px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100},
  modal:      {background:"var(--surface-raised)",border:"1px solid var(--border)",borderTopLeftRadius:"var(--radius-2xl)",borderTopRightRadius:"var(--radius-2xl)",padding:"8px 18px 36px",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"},
  modalHandle:{width:36,height:4,borderRadius:"var(--radius-full)",background:"var(--border)",margin:"0 auto 14px",opacity:0.5},
  mHeader:    {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  mTitle:     {fontSize:"var(--fs-xl)",fontWeight:700,color:"var(--text-1)"},
  xBtn:       {background:"var(--surface-2)",border:"1px solid var(--border)",color:"var(--text-3)",width:32,height:32,borderRadius:"var(--radius-sm)",cursor:"pointer",fontSize:"var(--fs-md)",display:"flex",alignItems:"center",justifyContent:"center"},
  lbl:        {display:"block",fontSize:"var(--fs-2xs)",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6},
  inp:        {width:"100%",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"9px 11px",color:"var(--text-2)",fontSize:"var(--fs-base)",outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
  typeBtn:    {flex:1,padding:"9px",background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-3)",fontSize:"var(--fs-md)",fontWeight:600,cursor:"pointer"},
  chipBtn:    {flex:1,padding:"7px 6px",background:"transparent",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",color:"var(--text-3)",fontSize:"var(--fs-sm)",fontWeight:500,cursor:"pointer"},
  chipActive: {background:"var(--tab-active-bg)",border:"1px solid var(--tab-active-border)",color:"var(--tab-active-color)"},
  submitBtn:  {width:"100%",padding:"12px",background:"var(--primary-bg)",border:"1px solid var(--primary-border)",color:"var(--primary-text)",borderRadius:"var(--radius-lg)",fontSize:"var(--fs-lg)",fontWeight:700,cursor:"pointer",marginTop:4,fontFamily:"inherit"},
  scopeBtn:   {display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:"1px solid",borderRadius:"var(--radius-lg)",cursor:"pointer",background:"transparent",fontFamily:"inherit",width:"100%",textAlign:"left"},
  selInput:   {backgroundColor:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"8px 26px 8px 11px",color:"var(--text-2)",fontSize:"var(--fs-md)",outline:"none",fontFamily:"inherit",appearance:"none",cursor:"pointer",backgroundImage:"var(--select-arrow)",backgroundRepeat:"no-repeat",backgroundPosition:"right 8px center"},
};

export default S;
