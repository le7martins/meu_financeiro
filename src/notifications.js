// Notificações locais do navegador. A decisão do que alertar é pura (logic.js);
// aqui fica só a parte que depende de Notification / service worker.
import { collectDueAlerts, formatDueAlerts } from './logic.js';

export async function requestNotifPermission() {
  if(!("Notification" in window)) return "unsupported";
  if(Notification.permission==="granted") return "granted";
  if(Notification.permission==="denied")  return "denied";
  return await Notification.requestPermission();
}

export function fireNotification(title,body,tag) {
  if(!("Notification" in window)||Notification.permission!=="granted") return;
  // Usa service worker se disponível (funciona em PWA/Android)
  if(navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({type:'NOTIFY',title,body,tag});
  } else {
    try { new Notification(title,{body,tag,icon:'/meu_financeiro/icon-192.png'}); } catch { /* sem suporte */ }
  }
}

export function checkAndNotify(entries,dividas,cards,cardPurchases,cardFaturas,settings) {
  if(!settings.enabled||!("Notification" in window)||Notification.permission!=="granted") return 0;
  const msgs=formatDueAlerts(collectDueAlerts({entries,dividas,cards,cardPurchases,cardFaturas},settings));
  msgs.forEach(m=>fireNotification(m.title,m.body,m.tag));
  return msgs.length;
}
