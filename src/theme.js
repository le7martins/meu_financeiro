// Aplica as variáveis CSS do tema direto no <html> — garante a cascata
// independentemente da posição da tag <style>.
const VARS = {
  dark: {
    '--text1':'#e2e8f0','--text2':'#cbd5e1','--text3':'#94a3b8','--text4':'#64748b',
    '--bg':'#080c12','--card-bg':'#0d1118','--card-bg2':'#111820',
    '--border':'#1e293b','--border2':'#0f172a','--border3':'#1e293b',
    '--inp-bg':'#080c12','--nav-bg':'#080c12',
  },
  light: {
    '--text1':'#0f172a','--text2':'#1e293b','--text3':'#64748b','--text4':'#94a3b8',
    '--bg':'#f8fafc','--card-bg':'#ffffff','--card-bg2':'#f1f5f9',
    '--border':'#e2e8f0','--border2':'#e2e8f0','--border3':'#f1f5f9',
    '--inp-bg':'#ffffff','--nav-bg':'#ffffff',
  },
};

export function applyTheme(theme) {
  const root = document.documentElement;
  const dark = theme !== 'light';
  Object.entries(dark ? VARS.dark : VARS.light).forEach(([k, v]) => root.style.setProperty(k, v));
  root.classList.toggle('light-mode', !dark);
}
