// Tema: as variáveis CSS vivem SOMENTE em src/appCss.js (:root = escuro,
// .light-mode = claro). Aqui apenas alternamos a classe no <html>, para que
// tudo fora de .appRoot (body, overlays fixos, scrollbar) resolva o mesmo tema.
// .appRoot recebe a mesma classe via App.jsx.

// Variáveis que versões antigas gravavam inline no <html>. Inline vence o CSS,
// então removemos qualquer resto (ex.: HMR / sessão antiga) para não divergir.
const LEGACY_INLINE_VARS = [
  '--text1', '--text2', '--text3', '--text4',
  '--bg', '--card-bg', '--card-bg2',
  '--border', '--border2', '--border3',
  '--inp-bg', '--nav-bg',
];

export function applyTheme(theme) {
  const root = document.documentElement;
  const light = theme === 'light';
  LEGACY_INLINE_VARS.forEach((k) => root.style.removeProperty(k));
  root.classList.toggle('light-mode', light);
  // Barra do navegador/status bar do PWA acompanha o tema (mesmo valor de --bg)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f8fafc' : '#080c12');
}
