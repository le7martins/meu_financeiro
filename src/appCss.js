// CSS global do app (inclui overrides de tema claro e layout responsivo).
export const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .hscroll::-webkit-scrollbar { display: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #1a2a40; border-radius: 2px; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.35); }
  select option { background: #0d1118; }
  ::placeholder { color: #667; }
  .statusToggleBtn:hover { filter: brightness(1.2); transform: scale(1.03); transition: all .15s; }
  .sumAddBtn:hover { filter: brightness(1.3); transform: scale(1.1); transition: all .15s; }
  .arrowBtn:hover { border-color: #1a3a6e !important; color: #8ab4f8 !important; }
  .hbtn:hover { opacity: 0.82; }
  .add-btn:hover { filter: brightness(1.15); }
  .iconBtn:hover { opacity: 0.6 !important; transform: scale(0.88); transition: all .15s; }
  .eCard:hover { border-color: #1a2840 !important; }
  .fTab:hover { border-color: #1a2840 !important; color: #8ab4f8 !important; }
  .navBtn:hover { background: #0d1118 !important; }
  .submitBtn:hover:not(:disabled) { filter: brightness(1.18); }
  .toast-in { animation: toastIn .3s cubic-bezier(0.34,1.56,0.64,1); }
  .modal-in { animation: slideUp .28s cubic-bezier(0.32,0.72,0,1); }
  @keyframes toastIn { from { opacity:0; transform: translateY(-12px) scale(0.9); } to { opacity:1; transform: translateY(0) scale(1); } }
  @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* ── Responsive: tablet (≥720px) ── */
  @media (min-width: 720px) {
    .appRoot { max-width: 720px; margin: 0 auto; border-left: 1px solid var(--border); border-right: 1px solid var(--border); min-height: 100vh; }
    .appBottomNav { max-width: 720px !important; }
    .sumGrid { grid-template-columns: repeat(4, 1fr) !important; }
  }

  /* ── Responsive: desktop (≥1024px) ── sidebar layout ── */
  @media (min-width: 1024px) {
    body { background: var(--bg) !important; }
    .appRoot {
      max-width: 1200px;
      margin: 0 auto;
      padding-left: 210px !important;
      padding-bottom: 0 !important;
      min-height: 100vh;
      position: relative;
      box-shadow: 0 0 40px rgba(0,0,0,.3);
    }
    /* Bottom nav → Left sidebar */
    .appBottomNav {
      position: fixed !important;
      top: 0 !important;
      bottom: 0 !important;
      left: max(0px, calc(50% - 600px)) !important;
      width: 210px !important;
      max-width: 210px !important;
      height: 100vh !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      align-items: stretch !important;
      padding: 24px 10px !important;
      gap: 4px !important;
      transform: none !important;
      border-top: none !important;
      border-right: 1px solid var(--border) !important;
      background: var(--bg) !important;
      overflow-y: auto;
      z-index: 40 !important;
    }
    .appBottomNav .navBtn {
      flex: 0 0 auto !important;
      width: 100% !important;
      flex-direction: row !important;
      justify-content: flex-start !important;
      align-items: center !important;
      padding: 12px 16px !important;
      gap: 12px !important;
      border-top: none !important;
      border-left: 3px solid transparent !important;
      border-radius: 10px !important;
      margin-bottom: 2px;
    }
    .appBottomNav .navBtn[style*="#8ab4f8"] {
      border-left-color: #8ab4f8 !important;
      background: var(--card-bg) !important;
    }
    .appBottomNav .navBtn span:last-child {
      font-size: 13px !important;
      font-weight: 600 !important;
      margin-top: 0 !important;
    }
    .appBottomNav .navAddReceita, .appBottomNav .navAddDespesa {
      width: 100% !important;
    }
    .appBottomNav .navAddReceita:hover { filter: brightness(1.15); }
    .appBottomNav .navAddDespesa:hover { filter: brightness(1.15); }
    /* Desktop-only items visíveis, mobile-only escondidos */
    .appBottomNav .navDesktopOnly { display: flex !important; }
    .navMobileOnly { display: none !important; }
    .appMoreMenu { display: none !important; }
    .appFabWrap { display: none !important; }
    /* Modals: centered card instead of bottom sheet */
    .appOverlay { align-items: center !important; padding: 20px; }
    .modal-in {
      max-width: 560px !important;
      border-radius: 16px !important;
      max-height: 88vh !important;
      animation: fadeIn .22s ease-out !important;
    }
    /* Toast moves to top-right */
    .appRoot > div[style*="position: fixed"][style*="bottom: 82"] {
      bottom: auto !important;
      top: 24px !important;
      right: 24px !important;
      left: auto !important;
      transform: none !important;
    }
    /* Wider grids & more spacing */
    .sumGrid { grid-template-columns: repeat(4, 1fr) !important; gap: 14px !important; }
    .heroCard { padding: 28px 28px !important; }
  }

  /* ── Responsive: large desktop (≥1280px) ── */
  @media (min-width: 1280px) {
    .appRoot { padding-left: 230px !important; }
    .appBottomNav { width: 230px !important; max-width: 230px !important; }
  }
  @keyframes celebrate { 0%{background-position:0%} 100%{background-position:100%} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
  @keyframes heroGlow { 0%,100%{box-shadow:0 0 0 rgba(74,222,128,0)} 50%{box-shadow:0 0 24px rgba(74,222,128,.15)} }
  .celebrate-glow { animation: heroGlow 2s ease-in-out 3; }
  -webkit-tap-highlight-color: transparent;

  /* ── CSS Variables: dark (default) ── */
  :root {
    --bg:#080c12; --card-bg:#0d1118; --card-bg2:#111820;
    --border:#1e293b; --border2:#0f172a; --border3:#1e293b;
    --text1:#e2e8f0; --text2:#cbd5e1; --text3:#94a3b8; --text4:#64748b;
    --inp-bg:#080c12; --nav-bg:#080c12;
    --hero-bg: linear-gradient(135deg,#0a2a1a 0%,#0d1f12 50%,#0a1a10 100%);
    --panel-bg:#0d1118; --panel-bg2:#080c12;
    --section-border:#0d1520;
    --accent:#8ab4f8;
    --tab-active-bg:#0d1a2e; --tab-active-border:#1a3a6e; --tab-active-color:#8ab4f8;
    --submit-bg:linear-gradient(135deg,#1a3a6e,#0d2247); --submit-border:#2a4a8e44; --submit-color:#8ab4f8;
  }

  /* ── Light mode CSS variables ── */
  .light-mode {
    --bg:#f8fafc; --card-bg:#ffffff; --card-bg2:#f1f5f9;
    --border:#e2e8f0; --border2:#e2e8f0; --border3:#f1f5f9;
    --text1:#0f172a; --text2:#1e293b; --text3:#64748b; --text4:#94a3b8;
    --inp-bg:#ffffff; --nav-bg:#ffffff;
    --hero-bg: linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#f0fdf4 100%);
    --panel-bg:#ffffff; --panel-bg2:#f9fafb;
    --section-border:#e5e7eb;
    --accent:#2563eb;
    --tab-active-bg:#eff6ff; --tab-active-border:#2563eb; --tab-active-color:#1d4ed8;
    --submit-bg:linear-gradient(135deg,#1e40af,#1d4ed8); --submit-border:#3b82f6; --submit-color:#ffffff;
  }

  /* ── Light mode base ── */
  .light-mode { background: var(--bg); color: var(--text1); }

  /* ── Global color resets in light mode ──
     All the hardcoded dark colors (#0d1118, #080c12, #111820, #0f1825) must become
     light equivalents. We use attribute selector for broad coverage. */

  /* Inputs, selects, textareas */
  .light-mode input, .light-mode select, .light-mode textarea {
    background: var(--inp-bg) !important; color: var(--text1) !important;
    border-color: var(--border) !important; }
  .light-mode input::placeholder, .light-mode textarea::placeholder { color: var(--text3) !important; }
  .light-mode input[type=date]::-webkit-calendar-picker-indicator { filter: none !important; }
  .light-mode select option { background: #ffffff; color: #111827; }
  /* Override select dropdown arrow to use dark color in light mode */
  .light-mode select[style*="background-image"], .light-mode [style*="backgroundImage"][style*="889"] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") !important; }

  /* ── Text color overrides ── */
  /* Primary text (#dde / #ccd → dark) */
  .light-mode [style*="color:#dde"], .light-mode [style*="color: #dde"] { color: #111827 !important; }
  .light-mode [style*="color:#ccd"], .light-mode [style*="color: #ccd"] { color: #374151 !important; }
  /* Secondary/muted text (#445 / #334 / #556 → gray) */
  .light-mode [style*="color:#445"], .light-mode [style*="color: #445"] { color: #6b7280 !important; }
  .light-mode [style*="color:#334"], .light-mode [style*="color: #334"] { color: #9ca3af !important; }
  .light-mode [style*="color:#556"], .light-mode [style*="color: #556"] { color: #6b7280 !important; }
  /* White text → dark */
  .light-mode [style*="color:#fff"], .light-mode [style*="color: #fff"],
  .light-mode [style*="color:white"] { color: #111827 !important; }
  .light-mode [style*='color:"#fff"'] { color: #111827 !important; }
  /* rgba(255,255,255,...) text → dark */
  .light-mode [style*="color:rgba(255,255,255,.6)"] { color: #6b7280 !important; }
  .light-mode [style*="color:rgba(255,255,255,.35)"] { color: #9ca3af !important; }

  /* ── Background overrides for dark panels ── */
  .light-mode [style*="background:#0d1118"], .light-mode [style*="background: #0d1118"] { background: #ffffff !important; }
  .light-mode [style*="background:#080c12"], .light-mode [style*="background: #080c12"] { background: #f9fafb !important; }
  .light-mode [style*="background:#111820"], .light-mode [style*="background: #111820"] { background: #f3f4f6 !important; }
  .light-mode [style*="background:#0f1825"], .light-mode [style*="background: #0f1825"] { background: #f3f4f6 !important; }
  .light-mode [style*="background:#0d1520"], .light-mode [style*="background: #0d1520"] { background: #f9fafb !important; }
  .light-mode [style*="background:#1a1208"], .light-mode [style*="background: #1a1208"] { background: #fff7ed !important; }
  .light-mode [style*="background:#0d2a1a"], .light-mode [style*="background: #0d2a1a"] { background: #f0fdf4 !important; }
  .light-mode [style*="background:#0a2a1a"], .light-mode [style*="background: #0a2a1a"] { background: #f0fdf4 !important; }
  .light-mode [style*="background:#0d1a2e"], .light-mode [style*="background: #0d1a2e"] { background: #eff6ff !important; }
  .light-mode [style*="background:#1a3a6e"], .light-mode [style*="background: #1a3a6e"] { background: #dbeafe !important; }
  .light-mode [style*="background:#0a2010"], .light-mode [style*="background: #0a2010"] { background: #f0fdf4 !important; }
  .light-mode [style*="background:#0d3520"], .light-mode [style*="background: #0d3520"] { background: #dcfce7 !important; }
  .light-mode [style*="background:#2a0d0d"], .light-mode [style*="background: #2a0d0d"] { background: #fef2f2 !important; }
  .light-mode [style*="background:#0d2247"], .light-mode [style*="background: #0d2247"] { background: #eff6ff !important; }
  .light-mode [style*="background:linear-gradient(135deg,#0d1118,#111820)"] { background: #f9fafb !important; }
  .light-mode [style*="background:linear-gradient(135deg,#1a3a6e,#0d2247)"] { background: linear-gradient(135deg,#2563eb,#1d4ed8) !important; }
  .light-mode [style*="background:linear-gradient(90deg,#0a2a1a,#0d3520,#0a2a1a)"] { background: linear-gradient(90deg,#f0fdf4,#dcfce7,#f0fdf4) !important; }

  /* ── Border overrides ── */
  .light-mode [style*="borderBottom:"1px solid #0d1520""], .light-mode [style*="borderBottom:"1px solid #0f1825""],
  .light-mode [style*="borderBottom:"1px solid #111820""] { border-bottom-color: #e5e7eb !important; }
  .light-mode [style*="border-bottom: 1px solid #0f1825"] { border-bottom-color: #e5e7eb !important; }

  /* Cards (entry rows) */
  .light-mode .eCard { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 1px 3px rgba(0,0,0,.06) !important; }
  .light-mode .eCard:hover { border-color: #d1d5db !important; box-shadow: 0 2px 8px rgba(0,0,0,.09) !important; }

  /* ── GradCard (Receitas / Despesas / Pago / A Pagar) ──
     Replace tinted/washed backgrounds with white + colored left border */
  .light-mode .gradCard {
    background: #ffffff !important;
    border-width: 1px !important;
    border-style: solid !important;
    box-shadow: 0 1px 4px rgba(0,0,0,.07) !important;
  }
  .light-mode .gradCardValue { color: #111827 !important; }
  .light-mode .gradCardLabel { opacity: 1 !important; font-weight: 700 !important; }
  .light-mode .gradCardLabel[style*="#4ade80"] { color: #15803d !important; }
  .light-mode .gradCardLabel[style*="#fb923c"] { color: #c2410c !important; }
  .light-mode .gradCardLabel[style*="#8ab4f8"] { color: #1d4ed8 !important; }
  .light-mode .gradCardLabel[style*="#facc15"] { color: #a16207 !important; }

  /* Sidebar add buttons in light mode */
  .light-mode .navAddReceita { background: #f0fdf4 !important; border-color: #22c55e !important; color: #15803d !important; }
  .light-mode .navAddReceita:hover { background: #dcfce7 !important; }
  .light-mode .navAddDespesa { background: #fff7ed !important; border-color: #fb923c !important; color: #c2410c !important; }
  .light-mode .navAddDespesa:hover { background: #ffedd5 !important; }

  /* Navigation tabs */
  .light-mode .fTab { border-color: #e5e7eb !important; color: #374151 !important; background: #ffffff !important; }
  .light-mode .fTab:hover { border-color: #9ca3af !important; color: #111827 !important; background: #f9fafb !important; }
  .light-mode .fTabActive { background: #eff6ff !important; border-color: #2563eb !important; color: #1d4ed8 !important; }

  /* Bottom nav */
  .light-mode nav { background: #ffffff !important; border-top: 1px solid #e5e7eb !important; box-shadow: 0 -2px 12px rgba(0,0,0,.06) !important; }
  .light-mode .navBtn { color: #6b7280 !important; }
  .light-mode .navBtn:hover { background: #f9fafb !important; }
  .light-mode .navBtnActive { background: #f3f4f6 !important; }

  /* Modals */
  .light-mode .modal-in { background: #ffffff !important; border-color: #e5e7eb !important; }

  /* Scroll */
  .light-mode .hscroll { background: transparent; }
  .light-mode ::-webkit-scrollbar-thumb { background: #d1d5db !important; }

  /* Buttons */
  .light-mode .submitBtn { background: linear-gradient(135deg,#1e40af,#1d4ed8) !important; border-color: #3b82f6 !important; color: #ffffff !important; }
  .light-mode .submitBtn:hover:not(:disabled) { background: linear-gradient(135deg,#1d4ed8,#2563eb) !important; }
  .light-mode .hbtn { background: #f9fafb !important; border-color: #e5e7eb !important; color: #374151 !important; }
  .light-mode .add-btn { background: linear-gradient(135deg,#1e40af,#1d4ed8) !important; border-color: #3b82f6 !important; color: #ffffff !important; }
  .light-mode .arrowBtn { background: #ffffff !important; border-color: #e5e7eb !important; color: #374151 !important; }
  .light-mode .arrowBtn:hover { border-color: #2563eb !important; color: #2563eb !important; }
  .light-mode .iconBtn:hover { opacity: 0.75 !important; }

  /* Header */
  .light-mode header { background: #ffffff; border-bottom-color: #e5e7eb !important; box-shadow: 0 1px 4px rgba(0,0,0,.06); }

  /* ── Hero / Saldo card ── */
  .light-mode .heroCard {
    background: linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#f0fdf4 100%) !important;
    border-color: #bbf7d0 !important;
    box-shadow: 0 2px 12px rgba(22,163,74,.1) !important;
  }
  /* Text inside hero card */
  .light-mode .heroCard [style*="color:rgba(255,255,255,.6)"] { color: #374151 !important; }
  .light-mode .heroCard [style*="color:rgba(255,255,255,.35)"] { color: #6b7280 !important; }
  .light-mode .heroCard [style*="color:rgba(255,255,255,.08)"] { border-top-color: rgba(0,0,0,.08) !important; }
  .light-mode .heroCard [style*="background:rgba(74,222,128,.18)"] { background: rgba(22,163,74,.15) !important; }

  /* Month navigator in light mode */
  .light-mode [style*="color:#fff"][style*="fontWeight:800"][style*="letterSpacing"] { color: #111827 !important; }

  /* Chart boxes */
  .light-mode .chartBox { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 1px 4px rgba(0,0,0,.06) !important; }
  .light-mode .chartBox [style*="color:#8ab4f8"] { color: #2563eb !important; }
  .light-mode .chartBox [style*="fill:#8ab4f8"] { fill: #2563eb !important; }
  .light-mode .chartBox [style*="stroke:#111820"] { stroke: #e5e7eb !important; }
  .light-mode .chartBox [style*="fill:#0d1118"] { fill: #ffffff !important; }
  .light-mode .chartBox [style*="fill:#1a2840"] { fill: #e5e7eb !important; }
  .light-mode .chartBox [style*="background:#080c12"] { background: #f9fafb !important; }
  .light-mode .chartBox [style*="background:#0d1118"] { background: #f9fafb !important; }

  /* Toast notifications in light mode */
  .light-mode .toast-in { box-shadow: 0 4px 16px rgba(0,0,0,.15) !important; }

  /* FAB button & sheet */
  .fabSheetRow:hover { background: rgba(255,255,255,.04) !important; }
  .fabSheetRow:active { background: rgba(255,255,255,.08) !important; }
  .light-mode .fabBtn { background: linear-gradient(135deg,#16a34a,#15803d) !important; border-color: #22c55e55 !important; color: #ffffff !important; box-shadow: 0 4px 16px rgba(22,163,74,.35) !important; }
  .light-mode .fabSheet > div { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 -4px 32px rgba(0,0,0,.14) !important; }
  .light-mode .fabSheetRow:hover { background: #f9fafb !important; }
  .light-mode .fabSheetRow:active { background: #f3f4f6 !important; }

  /* More-nav popup */
  .light-mode .moreNav { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 8px 24px rgba(0,0,0,.12) !important; }
  .light-mode .moreNav button { color: #374151 !important; }
  .light-mode .moreNav button:hover { background: #f9fafb !important; }

  /* Status toggle badges */
  .light-mode .statusToggleBtn { border-color: rgba(0,0,0,.08) !important; }

  /* Profile sections */
  .light-mode .profileSection { background: #ffffff !important; border-color: #e5e7eb !important; }
  .light-mode .profileItem { border-bottom-color: #f3f4f6 !important; }
  .light-mode .profileItem:hover { background: #f9fafb !important; }

  /* Toggle switch in light mode */
  .light-mode .toggleSwitch { background: #e5e7eb !important; border-color: #d1d5db !important; }
  .light-mode .toggleSwitch[data-on="true"] { background: #dcfce7 !important; border-color: #16a34a !important; }
  .light-mode .toggleSwitch .toggleThumb { background: #6b7280 !important; }
  .light-mode .toggleSwitch[data-on="true"] .toggleThumb { background: #16a34a !important; }

  /* Upcoming due section */
  .light-mode .upcomingBtn { background: #ffffff !important; }
  .light-mode .upcomingBtn:hover { background: #f9fafb !important; }

  /* Category filter chips */
  .light-mode .catChip { border-color: #e5e7eb !important; color: #374151 !important; }

  /* Health panel */
  .light-mode .healthPanel { background: #ffffff !important; border-color: #e5e7eb !important; }

  /* Group dividers */
  .light-mode .groupDivider { border-bottom-color: #e5e7eb !important; }

  /* Search input */
  .light-mode .searchWrap svg { stroke: #9ca3af !important; }

  /* Empty state */
  .light-mode .emptyState .emptyTitle { color: #374151 !important; }
  .light-mode .emptyState .emptySub { color: #6b7280 !important; }

  /* SVG text/lines in charts (fill/stroke attrs don't support CSS vars, override via CSS) */
  .light-mode .chartBox text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .chartBox text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .chartBox line[stroke="#111820"] { stroke: #e5e7eb !important; }
  .light-mode .chartBox line[stroke="#64748b"] { stroke: #d1d5db !important; }
  .light-mode .scoreCard circle[stroke="#111820"] { stroke: #e5e7eb !important; }
  .light-mode .scoreCard text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .scoreCard text[fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode .donutSvg text[fill="#94a3b8"] { fill: #6b7280 !important; }

  /* ── Specific element fixes in light mode ── */

  /* Month label (large white text) */
  [data-theme="light"] .monthLabel { color: #111827 !important; }

  /* Section header titles (#dde text) */
  [data-theme="light"] [style*="color:#dde"] { color: #111827 !important; }
  [data-theme="light"] [style*="color:#ccd"] { color: #374151 !important; }
  [data-theme="light"] [style*="color:#445"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:#334"] { color: #9ca3af !important; }
  [data-theme="light"] [style*="color:#556"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:#667"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:#222"] { color: #6b7280 !important; }

  /* Dark panel backgrounds */
  [data-theme="light"] [style*="background:#0d1118"] { background: #ffffff !important; border-color: #e5e7eb !important; }
  [data-theme="light"] [style*="background:#080c12"] { background: #f9fafb !important; }
  [data-theme="light"] [style*="background:#111820"] { background: #f3f4f6 !important; }
  [data-theme="light"] [style*="background:#0f1825"] { background: #f3f4f6 !important; }
  [data-theme="light"] [style*="background:#0d1520"] { background: #f9fafb !important; }
  [data-theme="light"] [style*="background:#1a1208"] { background: #fff7ed !important; }
  [data-theme="light"] [style*="background:#0d2a1a"] { background: #f0fdf4 !important; }
  [data-theme="light"] [style*="background:#0a2a1a"] { background: #f0fdf4 !important; }
  [data-theme="light"] [style*="background:#0d1a2e"] { background: #eff6ff !important; }
  [data-theme="light"] [style*="background:#1a3a6e"] { background: #dbeafe !important; }
  [data-theme="light"] [style*="background:#0a2010"] { background: #f0fdf4 !important; }
  [data-theme="light"] [style*="background:#0d3520"] { background: #dcfce7 !important; }
  [data-theme="light"] [style*="background:#2a0d0d"] { background: #fef2f2 !important; }
  [data-theme="light"] [style*="background:#0d2247"] { background: #eff6ff !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#0d1118"] { background: #f9fafb !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1a3a6e"] { background: linear-gradient(135deg,#2563eb,#1d4ed8) !important; color: #fff !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1a4a2e"] { background: linear-gradient(135deg,#16a34a,#15803d) !important; color: #fff !important; }
  [data-theme="light"] [style*="background:linear-gradient(90deg,#0a2a1a"] { background: linear-gradient(90deg,#f0fdf4,#dcfce7,#f0fdf4) !important; }

  /* Border-top dividers */
  [data-theme="light"] [style*="borderTop:"1px solid rgba(255,255,255,.08)""] { border-top-color: rgba(0,0,0,.08) !important; }

  /* White text on now-light backgrounds */
  [data-theme="light"] [style*="color:#fff"] { color: #111827 !important; }
  [data-theme="light"] [style*="color: #fff"] { color: #111827 !important; }
  [data-theme="light"] [style*="color:rgba(255,255,255,.6)"] { color: #6b7280 !important; }
  [data-theme="light"] [style*="color:rgba(255,255,255,.35)"] { color: #9ca3af !important; }

  /* Exception: white text stays white on colored/gradient buttons */
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1a3a6e"] [style*="color:#8ab4f8"] { color: #ffffff !important; }
  [data-theme="light"] [style*="background:linear-gradient(135deg,#1e40af"] { color: #ffffff !important; }

  /* Keep colored accent text (green, red, orange, yellow, blue) — don't override */
  [data-theme="light"] [style*="color:#4ade80"] { color: #16a34a !important; }
  [data-theme="light"] [style*="color:#34d399"] { color: #059669 !important; }
  [data-theme="light"] [style*="color:#f87171"] { color: #dc2626 !important; }
  [data-theme="light"] [style*="color:#fb923c"] { color: #ea580c !important; }
  [data-theme="light"] [style*="color:#facc15"] { color: #d97706 !important; }
  [data-theme="light"] [style*="color:#8ab4f8"] { color: #2563eb !important; }
  [data-theme="light"] [style*="color:#a78bfa"] { color: #7c3aed !important; }

  /* Card screen dark backgrounds */
  [data-theme="light"] [style*="background:#0d1118"][style*="borderRadius:18"] { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 2px 8px rgba(0,0,0,.08) !important; }

  /* Health indicator in header */
  [data-theme="light"] [style*="background:#0d1118"][style*="border"][style*="borderRadius:8"] { background: #f9fafb !important; }

  /* Upcoming due buttons */
  [data-theme="light"] [style*="background:#0d1118"][style*="border"][style*="borderRadius:10"] { background: #ffffff !important; }

  /* Section separators (borderBottom dark) */
  [data-theme="light"] [style*="borderBottom:"1px solid #0d1520""] { border-bottom-color: #e5e7eb !important; }
  [data-theme="light"] [style*="borderBottom:"1px solid #0f1825""] { border-bottom-color: #e5e7eb !important; }
  [data-theme="light"] [style*="borderBottom:"1px solid #111820""] { border-bottom-color: #e5e7eb !important; }

  /* SumCard */
  [data-theme="light"] [style*="background:#0d1118"][style*="border:"1px solid #111820""] { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 1px 3px rgba(0,0,0,.06) !important; }

  /* Progress bar track */
  [data-theme="light"] [style*="height:5px"][style*="background:#080c12"],
  [data-theme="light"] [style*="height:5"][style*="background:#080c12"] { background: #e5e7eb !important; }
  [data-theme="light"] [style*="height:3"][style*="background:#080c12"] { background: #e5e7eb !important; }
  [data-theme="light"] [style*="height:4"][style*="background:#080c12"] { background: #e5e7eb !important; }

  /* Modal cancel/close buttons */
  [data-theme="light"] [style*="background:#111820"][style*="border:"1px solid #1a2840""] { background: #f3f4f6 !important; border-color: #e5e7eb !important; color: #374151 !important; }
  [data-theme="light"] .xBtn { background: #f3f4f6 !important; color: #374151 !important; }

  /* Installment preview box */
  [data-theme="light"] [style*="background:#080c12"][style*="border:"1px solid #1a3a6e44""] { background: #eff6ff !important; border-color: #bfdbfe !important; }

  /* Nav active background */
  [data-theme="light"] .navBtnActive { background: #f3f4f6 !important; }

  /* Month in SVG chart tooltip */
  [data-theme="light"] [fill="#0d1118"] { fill: #ffffff !important; }
  [data-theme="light"] [fill="#1a2840"] { fill: #e5e7eb !important; }
  [data-theme="light"] [fill="#94a3b8"] { fill: #6b7280 !important; }
  [data-theme="light"] [fill="#94a3b8"] { fill: #6b7280 !important; }
  [data-theme="light"] [fill="#8ab4f8"] { fill: #2563eb !important; }
  [data-theme="light"] [stroke="#111820"] { stroke: #e5e7eb !important; }
  [data-theme="light"] [stroke="#64748b"] { stroke: #d1d5db !important; }

  /* SVG chart legend text */
  [data-theme="light"] .chartBox [style*="color:#445"] { color: #6b7280 !important; }
  [data-theme="light"] .chartBox [style*="color:#ccd"] { color: #374151 !important; }

  /* ── Hero card class-based overrides ── */
  .light-mode .heroSubtext { color: #374151 !important; }
  .light-mode .heroMuted { color: #6b7280 !important; }
  .light-mode .heroCardFooter { border-top-color: rgba(0,0,0,.08) !important; }
  .light-mode .monthLabel { color: #111827 !important; }

  /* ── Accent colors mapped to light equivalents ── */
  .light-mode [style*="color:#4ade80"]:not([style*="background"]) { color: #16a34a !important; }
  .light-mode [style*="color:#34d399"]:not([style*="background"]) { color: #059669 !important; }
  .light-mode [style*="color:#f87171"]:not([style*="background"]) { color: #dc2626 !important; }
  .light-mode [style*="color:#fb923c"]:not([style*="background"]) { color: #ea580c !important; }
  .light-mode [style*="color:#facc15"]:not([style*="background"]) { color: #d97706 !important; }
  .light-mode [style*="color:#8ab4f8"]:not([style*="background"]) { color: #2563eb !important; }
  .light-mode [style*="color:#a78bfa"]:not([style*="background"]) { color: #7c3aed !important; }

  /* ── Card title and meta text ── */
  .light-mode .eCard [style*="color:#dde"] { color: #111827 !important; }
  .light-mode .eCard [style*="color:#ccd"] { color: #374151 !important; }
  .light-mode .eCard [style*="color:#445"] { color: #6b7280 !important; }
  .light-mode .eCard [style*="color:#334"] { color: #9ca3af !important; }
  .light-mode .eCard [style*="color:#556"] { color: #6b7280 !important; }

  /* ── Section headers ── */
  .light-mode [style*="borderBottom"][style*="#0d1520"] { border-bottom-color: #e5e7eb !important; }
  .light-mode [style*="borderBottom"][style*="#0f1825"] { border-bottom-color: #e5e7eb !important; }
  .light-mode [style*="borderBottom"][style*="#111820"] { border-bottom-color: #e5e7eb !important; }

  /* ── Cartão screen (credit cards) ── */
  .light-mode [style*="background:#0d1118"][style*="borderRadius:18"] { background: #ffffff !important; }
  .light-mode [style*="background:#0d1118"][style*="borderRadius:14"] { background: #ffffff !important; border-color: #e5e7eb !important; }

  /* ── Saúde screen ── */
  .light-mode [style*="background:linear-gradient(135deg,#0d1118,#111820)"] { background: #f9fafb !important; }
  .light-mode [style*="background:rgba(138,180,248,.06)"] { background: #eff6ff !important; border-color: #bfdbfe !important; }
  .light-mode [style*="border:"1px solid #1a3a6e""] { border-color: #bfdbfe !important; }

  /* ── Profile screen ── */
  .light-mode [style*="background:#0d1118"][style*="borderRadius:13"] { background: #ffffff !important; border-color: #e5e7eb !important; }
  .light-mode [style*="borderBottom:"none""] { border-bottom: none; }
  .light-mode [style*="borderBottom"][style*="#0f1825"] { border-bottom-color: #e5e7eb !important; }

  /* ── Modal backgrounds ── */
  .light-mode [style*="background:#080c12"][style*="borderRadius:11"],
  .light-mode [style*="background:#080c12"][style*="borderRadius:12"] { background: #f9fafb !important; }
  .light-mode [style*="background:#080c12"][style*="borderRadius:8"] { background: #f9fafb !important; }
  .light-mode [style*="background:#080c12"][style*="borderRadius:9"] { background: #f9fafb !important; }
  .light-mode [style*="background:#080c12"][style*="borderRadius:10"] { background: #f9fafb !important; }
  .light-mode [style*="background:"#111820""] { background: #f3f4f6 !important; }

  /* ── Upcoming due buttons ── */
  .light-mode [style*="background:#0d1118"][style*="border"][style*="borderRadius:10"] { background: #ffffff !important; }
  .light-mode [style*="background:rgba(248,113,113,.07)"] { background: #fef2f2 !important; }
  .light-mode [style*="background:rgba(251,146,60,.07)"] { background: #fff7ed !important; }

  /* ── Health score circle track ── */
  .light-mode [stroke="#111820"] { stroke: #e5e7eb !important; }
  .light-mode [fill="#111820"] { fill: #f3f4f6 !important; }
  .light-mode [fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode [fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode [stroke="#64748b"] { stroke: #d1d5db !important; }

  /* ── Scrollbar ── */
  .light-mode ::-webkit-scrollbar-thumb { background: #d1d5db !important; }
  .light-mode ::-webkit-scrollbar { background: #f9fafb; }
`;
