// ─── Design Tokens ────────────────────────────────────────────────────────────
// Single source of truth for visual constants.
// Use these instead of hardcoded numbers in inline styles.

export const RADIUS = {
  xs:   4,   // badges, tiny tags
  sm:   6,   // small buttons, count badges
  md:   8,   // inputs, chip buttons, icon buttons
  lg:   12,  // cards, standard modals
  xl:   16,  // hero card, gradcard
  xxl:  20,  // bottom-sheet modal top corners, FAB sheet
  full: 9999,
};

export const SHADOW = {
  sm:  '0 1px 3px rgba(0,0,0,.12)',
  md:  '0 4px 12px rgba(0,0,0,.18)',
  lg:  '0 8px 24px rgba(0,0,0,.28)',
  xl:  '0 16px 40px rgba(0,0,0,.4)',
  pop: '0 8px 32px rgba(0,0,0,.7)',
};

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
};

export const TYPE = {
  h1:    { fontSize: 28, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.5px' },
  h2:    { fontSize: 20, fontWeight: 800, lineHeight: 1.2,  letterSpacing: '-0.4px' },
  h3:    { fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
  body:  { fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
  small: { fontSize: 11, fontWeight: 500, lineHeight: 1.4 },
  tiny:  { fontSize:  9, fontWeight: 600, lineHeight: 1.2 },
  label: { fontSize:  9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' },
};

// Brand palette — intentional, not Tailwind defaults
export const COLOR = {
  income:       '#34d399',  // teal-green (not neon #4ade80)
  incomeLight:  '#6ee7b7',
  incomeDim:    'rgba(52,211,153,.15)',
  expense:      '#f97316',  // orange (not neon #fb923c)
  expenseLight: '#fdba74',
  expenseDim:   'rgba(249,115,22,.15)',
  debt:         '#f87171',
  debtDim:      'rgba(248,113,113,.15)',
  accent:       '#6366f1',  // indigo (replaces generic #8ab4f8)
  accentLight:  '#a5b4fc',
  accentDim:    'rgba(99,102,241,.15)',
  warn:         '#fbbf24',
  warnDim:      'rgba(251,191,36,.1)',
  error:        '#f87171',
  success:      '#34d399',
};
