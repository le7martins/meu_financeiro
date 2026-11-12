// CSS global do app (inclui overrides de tema claro e layout responsivo).
export const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  .hscroll::-webkit-scrollbar { display: none; }
  ::-webkit-scrollbar { width: 3px; }
  body { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.35); }
  select option { background: var(--surface); }
  ::placeholder { color: var(--text-placeholder); }
  .statusToggleBtn:hover { filter: brightness(1.2); transform: scale(1.03); transition: all .15s; }
  .sumAddBtn:hover { filter: brightness(1.3); transform: scale(1.1); transition: all .15s; }
  .arrowBtn:hover { border-color: var(--accent-border) !important; color: var(--accent) !important; }
  .hbtn:hover { opacity: 0.82; }
  .add-btn:hover { filter: brightness(1.15); }
  .iconBtn:hover { opacity: 0.6 !important; transform: scale(0.88); transition: all .15s; }
  .eCard:hover { border-color: var(--border-strong) !important; }
  .fTab:hover { border-color: var(--border-strong) !important; color: var(--accent) !important; }
  .navBtn:hover { background: var(--surface) !important; }
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
      box-shadow: var(--shadow-app);
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
    .appBottomNav .navBtn[aria-current="page"] {
      border-left-color: var(--accent) !important;
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
    .appRoot > .toastStack {
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

  /* ══════════════════════════════════════════════════════════════
     DESIGN TOKENS — fonte única de cor/escala do app.
     Guia de mapeamento: .omc/plans/ui-tokens.md
     1) :root            → tema escuro (padrão) + escalas (independentes de tema)
     2) .light-mode      → tema claro (mesmos nomes, valores com contraste AA)
     3) aliases/derivados → recalculados em cada raiz de tema (ver nota abaixo)
     ══════════════════════════════════════════════════════════════ */

  /* ── 1. Escalas + tema escuro (padrão) ── */
  :root {
    color-scheme: dark;

    /* Tipografia */
    --font-sans: 'DM Sans', sans-serif;
    --fs-2xs: 9px;  --fs-xs: 10px; --fs-sm: 11px; --fs-md: 12px; --fs-base: 13px;
    --fs-lg: 14px;  --fs-xl: 15px; --fs-2xl: 16px; --fs-3xl: 18px; --fs-4xl: 20px;
    --fs-5xl: 22px; --fs-6xl: 28px; --fs-7xl: 36px;

    /* Raio */
    --radius-xs: 6px; --radius-sm: 8px; --radius-md: 10px; --radius-lg: 12px;
    --radius-xl: 16px; --radius-2xl: 20px; --radius-full: 9999px;

    /* Espaçamento */
    --space-2xs: 2px; --space-xs: 4px; --space-sm: 8px; --space-md: 12px;
    --space-lg: 16px; --space-xl: 20px; --space-2xl: 24px; --space-3xl: 32px;

    /* Movimento */
    --dur-fast: .15s; --dur-base: .22s; --dur-slow: .35s;
    --ease-out: cubic-bezier(.22,1,.36,1); --ease-spring: cubic-bezier(.34,1.56,.64,1);

    /* Superfícies */
    --bg: #080c12;
    --surface: #0d1118;
    --surface-2: #111820;
    --surface-3: #131c2c;
    --surface-raised: #0d1118;
    --surface-sunken: #080c12;
    --surface-hover: rgba(255,255,255,.04);
    --surface-active: rgba(255,255,255,.08);
    --input-bg: #080c12;
    --nav-bg: #080c12;
    --track: #080c12;
    --bg2: #0d1118;
    --backdrop: rgba(0,0,0,.82);
    --backdrop-soft: rgba(0,0,0,.55);

    /* Bordas */
    --border: #1e293b;
    --border-subtle: #0f1825;
    --border-strong: #1a2840;

    /* Texto */
    --text-1: #e2e8f0;
    --text-2: #cbd5e1;
    --text-3: #94a3b8;
    --text-4: #7a8ca3;
    --text-placeholder: #666677;
    --text-on-accent: #080c12;

    /* Marca / accent (azul) */
    --accent: #8ab4f8;
    --accent-strong: #a8c7fa;
    --accent-soft: rgba(138,180,248,.1);
    --accent-border: #1a3a6e;
    --accent-surface: #0d1a2e;
    --accent-muted: #1a3a6e;
    --tab-active-border: #1a3a6e;

    /* Semânticas: solid (texto/ícone/fill) · -soft (fundo tint) · -border · -surface (painel opaco) · -on (texto sobre fill sólido) */
    --success: #4ade80; --success-soft: rgba(74,222,128,.1);  --success-border: rgba(74,222,128,.3);  --success-surface: #0d2a1a; --success-on: #052e16;
    --danger:  #f87171; --danger-soft:  rgba(248,113,113,.1); --danger-border:  rgba(248,113,113,.3); --danger-surface:  #2a0d0d; --danger-on:  #450a0a;
    --warning: #facc15; --warning-soft: rgba(250,204,21,.1);  --warning-border: rgba(250,204,21,.3);  --warning-surface: #1f1a07; --warning-on: #422006;
    --orange:  #fb923c; --orange-soft:  rgba(251,146,60,.1);  --orange-border:  rgba(251,146,60,.3);  --orange-surface:  #1a1208; --orange-on:  #431407;
    --info:    #8ab4f8; --info-soft:    rgba(138,180,248,.1); --info-border:    rgba(138,180,248,.3); --info-surface:    #0d1a2e; --info-on:    #080c12;
    --purple:  #a78bfa; --purple-soft:  rgba(167,139,250,.1); --purple-border:  rgba(167,139,250,.3); --purple-surface:  #1a1430; --purple-on:  #1e1038;
    --emerald: #34d399; --emerald-soft: rgba(52,211,153,.1);  --emerald-border: rgba(52,211,153,.3);  --emerald-surface: #0a2420; --emerald-on: #022c22;
    --danger-strong: #ef4444; --warning-strong: #f59e0b;

    /* Hero / saldo */
    --hero-bg: linear-gradient(135deg,#0a2a1a 0%,#0d1f12 50%,#0a1a10 100%);
    --hero-border: rgba(74,222,128,.2);
    --hero-text-2: rgba(255,255,255,.6);
    --hero-text-3: rgba(255,255,255,.35);
    --hero-divider: rgba(255,255,255,.08);
    --hero-shadow: none;
    --hero-glow: rgba(74,222,128,.15);
    --celebrate-bg: linear-gradient(90deg,#0a2a1a,#0d3520,#0a2a1a);

    /* Botões */
    --primary-bg: linear-gradient(135deg,#1a3a6e,#0d2247);
    --primary-bg-hover: linear-gradient(135deg,#1a3a6e,#0d2247);
    --primary-border: rgba(42,74,142,.27);
    --primary-text: #8ab4f8;
    --btn-success-bg: linear-gradient(135deg,#1a4a2e,#0d2a1a); --btn-success-border: rgba(74,222,128,.2);  --btn-success-text: #4ade80;
    --btn-danger-bg:  linear-gradient(135deg,#4a1a1a,#2a0d0d); --btn-danger-border:  rgba(248,113,113,.27); --btn-danger-text: #f87171;
    --btn-purple-bg:  linear-gradient(135deg,#4a2a8e,#2d1a6e); --btn-purple-border:  rgba(167,139,250,.2); --btn-purple-text: #a78bfa;
    --fab-bg: linear-gradient(135deg,#1a6e3a,#0d4727); --fab-border: rgba(74,222,128,.3); --fab-shadow: 0 4px 20px rgba(74,222,128,.25);

    /* Barras de progresso */
    --progress-success: linear-gradient(90deg,#4ade80,#34d399);
    --progress-danger:  linear-gradient(90deg,#f87171,#ef4444);
    --progress-warning: linear-gradient(90deg,#facc15,#f59e0b);

    /* Foco / sombra */
    --focus-ring: #8ab4f8;
    --focus-ring-soft: rgba(138,180,248,.35);
    --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
    --shadow-md: 0 4px 16px rgba(0,0,0,.45);
    --shadow-lg: 0 -2px 40px rgba(0,0,0,.7);
    --shadow-app: 0 0 40px rgba(0,0,0,.3);

    /* Gráficos */
    --chart-1: #8ab4f8; --chart-2: #4ade80; --chart-3: #f87171; --chart-4: #fb923c;
    --chart-5: #facc15; --chart-6: #a78bfa; --chart-7: #34d399; --chart-8: #f472b6;
    --chart-grid: #111820; --chart-axis: #64748b; --chart-label: #94a3b8;
    --chart-tooltip-bg: #0d1118; --chart-tooltip-border: #1a2840;

    /* Diversos */
    --scrollbar-thumb: #1a2a40;
    --scrollbar-track: transparent;
    --select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238896a8' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  }

  /* ── 2. Tema claro ── (texto ≥ 4.5:1 sobre --bg/--surface/--surface-2 e sobre o -soft da própria cor) */
  .light-mode {
    color-scheme: light;

    --bg: #f8fafc;
    --surface: #ffffff;
    --surface-2: #f1f5f9;
    --surface-3: #e2e8f0;
    --surface-raised: #ffffff;
    --surface-sunken: #f8fafc;
    --surface-hover: #f8fafc;
    --surface-active: #f1f5f9;
    --input-bg: #ffffff;
    --nav-bg: #ffffff;
    --track: #e2e8f0;
    --bg2: #e2e8f0;
    --backdrop: rgba(15,23,42,.5);
    --backdrop-soft: rgba(15,23,42,.35);

    --border: #e2e8f0;
    --border-subtle: #eef2f6;
    --border-strong: #cbd5e1;

    --text-1: #0f172a;
    --text-2: #334155;
    --text-3: #475569;
    --text-4: #5b6b80;
    --text-placeholder: #64748b;
    --text-on-accent: #ffffff;

    --accent: #2563eb;
    --accent-strong: #1d4ed8;
    --accent-soft: rgba(37,99,235,.08);
    --accent-border: #93c5fd;
    --accent-surface: #eff6ff;
    --accent-muted: #dbeafe;
    --tab-active-border: #2563eb;

    --success: #15803d; --success-soft: rgba(22,163,74,.1);  --success-border: rgba(22,163,74,.35); --success-surface: #f0fdf4; --success-on: #ffffff;
    --danger:  #b91c1c; --danger-soft:  rgba(220,38,38,.08); --danger-border:  rgba(220,38,38,.3);  --danger-surface:  #fef2f2; --danger-on:  #ffffff;
    --warning: #854d0e; --warning-soft: rgba(202,138,4,.12); --warning-border: rgba(202,138,4,.4);  --warning-surface: #fefce8; --warning-on: #ffffff;
    --orange:  #c2410c; --orange-soft:  rgba(234,88,12,.1);  --orange-border:  rgba(234,88,12,.35); --orange-surface:  #fff7ed; --orange-on:  #ffffff;
    --info:    #1d4ed8; --info-soft:    rgba(37,99,235,.08); --info-border:    rgba(37,99,235,.3);  --info-surface:    #eff6ff; --info-on:    #ffffff;
    --purple:  #6d28d9; --purple-soft:  rgba(124,58,237,.08); --purple-border: rgba(124,58,237,.3); --purple-surface:  #f5f3ff; --purple-on:  #ffffff;
    --emerald: #047857; --emerald-soft: rgba(5,150,105,.1);  --emerald-border: rgba(5,150,105,.35); --emerald-surface: #ecfdf5; --emerald-on: #ffffff;
    --danger-strong: #991b1b; --warning-strong: #b45309;

    --hero-bg: linear-gradient(135deg,#f0fdf4 0%,#dcfce7 60%,#f0fdf4 100%);
    --hero-border: #bbf7d0;
    --hero-text-2: #374151;
    --hero-text-3: #4b5563;
    --hero-divider: rgba(15,23,42,.08);
    --hero-shadow: 0 2px 12px rgba(22,163,74,.1);
    --hero-glow: rgba(22,163,74,.15);
    --celebrate-bg: linear-gradient(90deg,#f0fdf4,#dcfce7,#f0fdf4);

    --primary-bg: linear-gradient(135deg,#1e40af,#1d4ed8);
    --primary-bg-hover: linear-gradient(135deg,#1d4ed8,#2563eb);
    --primary-border: #3b82f6;
    --primary-text: #ffffff;
    --btn-success-bg: linear-gradient(135deg,#15803d,#166534); --btn-success-border: #15803d; --btn-success-text: #ffffff;
    --btn-danger-bg:  linear-gradient(135deg,#dc2626,#b91c1c); --btn-danger-border:  #b91c1c; --btn-danger-text: #ffffff;
    --btn-purple-bg:  linear-gradient(135deg,#7c3aed,#6d28d9); --btn-purple-border:  #6d28d9; --btn-purple-text: #ffffff;
    --fab-bg: linear-gradient(135deg,#16a34a,#15803d); --fab-border: rgba(34,197,94,.33); --fab-shadow: 0 4px 16px rgba(22,163,74,.35);

    --progress-success: linear-gradient(90deg,#16a34a,#059669);
    --progress-danger:  linear-gradient(90deg,#ef4444,#dc2626);
    --progress-warning: linear-gradient(90deg,#eab308,#d97706);

    --focus-ring: #2563eb;
    --focus-ring-soft: rgba(37,99,235,.3);
    --shadow-sm: 0 1px 3px rgba(15,23,42,.06);
    --shadow-md: 0 4px 16px rgba(15,23,42,.1);
    --shadow-lg: 0 8px 32px rgba(15,23,42,.14);
    --shadow-app: 0 0 40px rgba(15,23,42,.06);

    --chart-1: #2563eb; --chart-2: #16a34a; --chart-3: #dc2626; --chart-4: #ea580c;
    --chart-5: #ca8a04; --chart-6: #7c3aed; --chart-7: #059669; --chart-8: #db2777;
    --chart-grid: #e5e7eb; --chart-axis: #cbd5e1; --chart-label: #64748b;
    --chart-tooltip-bg: #ffffff; --chart-tooltip-border: #e2e8f0;

    --scrollbar-thumb: #d1d5db;
    --scrollbar-track: #f8fafc;
    --select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  }

  /* ── 3. Aliases legados + tokens derivados ──
     Variáveis que referenciam outras (var(--x)) são resolvidas no elemento onde
     são declaradas e herdadas JÁ resolvidas. Por isso este bloco casa em toda
     raiz de tema (<html>, .appRoot[data-theme], wrapper do onboarding): se só um
     deles tiver .light-mode, os aliases daquele subtree continuam corretos.
     Nomes legados — mantidos para o código existente; código novo usa os canônicos. */
  :root, [data-theme], .light-mode {
    --card-bg: var(--surface);
    --card-bg2: var(--surface-2);
    --panel-bg: var(--surface);
    --panel-bg2: var(--surface-sunken);
    --inp-bg: var(--input-bg);
    --border2: var(--border-subtle);
    --border3: var(--border);
    --section-border: var(--border-subtle);
    --text1: var(--text-1);
    --text2: var(--text-2);
    --text3: var(--text-3);
    --text4: var(--text-4);
    --tab-active-bg: var(--accent-surface);
    --tab-active-color: var(--accent);
    --submit-bg: var(--primary-bg);
    --submit-border: var(--primary-border);
    --submit-color: var(--primary-text);
  }

  /* ── Light mode base ── */
  .light-mode { background: var(--bg); color: var(--text1); }

  /* ── Global color resets in light mode ──
     All the hardcoded dark colors (#0d1118, #080c12, #111820, #0f1825) must become
     light equivalents. We use attribute selector for broad coverage. */

  /* Inputs, selects, textareas */
  .light-mode input, .light-mode select, .light-mode textarea {
    background: var(--inp-bg) !important; color: var(--text1) !important; }
  /* Campo inválido: borda vermelha visível em qualquer tema */
  input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"] { border-color: var(--danger) !important; }
  .light-mode input::placeholder, .light-mode textarea::placeholder { color: var(--text3) !important; }
  .light-mode input[type=date]::-webkit-calendar-picker-indicator { filter: none !important; }
  .light-mode select option { background: #ffffff; color: #111827; }


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


  /* Chart boxes */
  .light-mode .chartBox { background: #ffffff !important; border-color: #e5e7eb !important; box-shadow: 0 1px 4px rgba(0,0,0,.06) !important; }


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

  [data-theme="light"] .xBtn { background: #f3f4f6 !important; color: #374151 !important; }


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


  /* ── Hero card class-based overrides ── */
  .light-mode .heroSubtext { color: #374151 !important; }
  .light-mode .heroMuted { color: #6b7280 !important; }
  .light-mode .heroCardFooter { border-top-color: rgba(0,0,0,.08) !important; }
  .light-mode .monthLabel { color: #111827 !important; }


  /* ── Health score circle track ── */
  .light-mode [stroke="#111820"] { stroke: #e5e7eb !important; }
  .light-mode [fill="#111820"] { fill: #f3f4f6 !important; }
  .light-mode [fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode [fill="#94a3b8"] { fill: #6b7280 !important; }
  .light-mode [stroke="#64748b"] { stroke: #d1d5db !important; }

  /* ── Scrollbar ── */
  .light-mode ::-webkit-scrollbar-thumb { background: #d1d5db !important; }
  .light-mode ::-webkit-scrollbar { background: #f9fafb; }

  /* ══ Acessibilidade global (manter no FIM: precisa vencer os overrides acima) ══ */

  /* Foco visível só para teclado. Inputs têm outline:none inline → anel via borda+sombra. */
  button:focus-visible, a:focus-visible, select:focus-visible, summary:focus-visible,
  [role="button"]:focus-visible, [tabindex]:not([tabindex="-1"]):focus-visible {
    outline: 2px solid var(--focus-ring) !important;
    outline-offset: 2px;
  }
  input:focus-visible, textarea:focus-visible {
    outline: none !important;
    border-color: var(--focus-ring) !important;
    box-shadow: 0 0 0 3px var(--focus-ring-soft) !important;
  }
  input[type=checkbox]:focus-visible, input[type=radio]:focus-visible, input[type=range]:focus-visible {
    outline: 2px solid var(--focus-ring) !important;
    outline-offset: 2px;
    box-shadow: none !important;
  }

  /* Movimento reduzido: confete, slide-up de modal, toast, glow e pulsos param.
     Duração ~0 (em vez de animation:none) para animações com "forwards"
     terminarem no estado final (confete some, modal aparece no lugar). */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
      scroll-behavior: auto !important;
    }
    .toast-in, .modal-in, .celebrate-glow, .onboard-step { animation: none !important; }
    .statusToggleBtn:hover, .sumAddBtn:hover, .iconBtn:hover { transform: none !important; }
  }
`;
