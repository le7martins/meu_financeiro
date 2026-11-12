import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const root = createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><App /></ErrorBoundary>);
const splash = document.getElementById('ld');
if (splash) splash.style.display = 'none';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/meu_financeiro/sw.js').catch(() => {});
}
