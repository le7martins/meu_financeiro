#!/usr/bin/env node
/**
 * Cron: envia notificações push para usuários com vencimentos próximos.
 * Roda via GitHub Actions (diariamente às 08:00 BRT).
 * Requer: FIREBASE_SERVICE_ACCOUNT (JSON), VITE_VAPID_KEY no env.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// GOOGLE_APPLICATION_CREDENTIALS aponta para o arquivo gravado pelo workflow
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const TODAY = new Date().toISOString().split('T')[0];
const daysUntil = (ds) => {
  if (!ds) return null;
  return Math.ceil((new Date(ds + 'T12:00:00') - new Date(TODAY + 'T12:00:00')) / 86400000);
};
const getNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const addM = (k, n) => {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function getUserData(uid) {
  const types = ['entries', 'dividas', 'settings'];
  const results = {};
  await Promise.all(types.map(async t => {
    const snap = await db.doc(`users/${uid}/data/${t}`).get();
    if (snap.exists) results[t] = snap.data().v;
  }));
  return results;
}

function getUpcoming(entries = [], dividas = [], settings = {}) {
  const daysBefore = settings.notifSettings?.daysBefore ?? 3;
  const overdueAlert = settings.notifSettings?.overdueAlert !== false;
  const NOW = getNow();
  const NEXT = addM(NOW, 1);
  const alerts = [];

  const allEntries = [...(entries || [])];
  for (const mk of [NOW, NEXT]) {
    for (const e of allEntries) {
      if (e.type !== 'despesa') continue;
      const base = e.date.substring(0, 7);
      let active = false;
      if (e.recurrence === 'none') active = base === mk;
      else if (e.recurrence === 'fixed') active = base <= mk && (!e.endMonth || mk <= e.endMonth);
      if (!active) continue;
      const status = e.statusByMonth?.[mk] || e.status || 'a_pagar';
      if (status !== 'a_pagar') continue;
      const dueDate = e.recurrence !== 'none' ? `${mk}-${e.date.split('-')[2]}` : e.date;
      const days = daysUntil(dueDate);
      if (days === null) continue;
      if (days < 0 && overdueAlert) alerts.push({ title: `⚠️ Vencido há ${Math.abs(days)}d`, body: e.description });
      else if (days === 0) alerts.push({ title: '🔴 Vence hoje!', body: e.description });
      else if (days > 0 && days <= daysBefore) alerts.push({ title: `⏰ Vence em ${days}d`, body: e.description });
    }
  }

  for (const d of (dividas || [])) {
    const [sy, sm] = d.startMonth.split('-').map(Number);
    const [ny, nm] = NOW.split('-').map(Number);
    const diff = (ny - sy) * 12 + (nm - sm);
    if (diff < 0 || diff >= d.installments) continue;
    if (d.paidMonths?.includes(NOW)) continue;
    const dueDate = `${NOW}-${d.dueDay || '10'}`;
    const days = daysUntil(dueDate);
    if (days === null) continue;
    if (days < 0 && overdueAlert) alerts.push({ title: `⚠️ Dívida vencida há ${Math.abs(days)}d`, body: d.name });
    else if (days === 0) alerts.push({ title: '🔴 Dívida vence hoje!', body: d.name });
    else if (days > 0 && days <= daysBefore) alerts.push({ title: `⏰ Dívida vence em ${days}d`, body: d.name });
  }

  return alerts;
}

async function run() {
  const profilesSnap = await db.collection('userProfiles').get();
  let sent = 0;
  let skipped = 0;

  for (const doc of profilesSnap.docs) {
    const profile = doc.data();
    const uid = doc.id;
    const token = profile.fcmToken;
    if (!token) { skipped++; continue; }

    const data = await getUserData(uid);
    const alerts = getUpcoming(data.entries, data.dividas, data.settings);
    if (alerts.length === 0) { skipped++; continue; }

    // Agrupa em uma única notificação (resumo)
    const titles = [...new Set(alerts.map(a => a.title))];
    const bodies = alerts.map(a => a.body).slice(0, 5).join(', ');
    const title = titles.length === 1 ? titles[0] : `${alerts.length} alertas financeiros`;

    try {
      await messaging.send({
        token,
        notification: { title, body: bodies },
        data: { tag: 'mf-cron', count: String(alerts.length) },
        android: { priority: 'high', notification: { channelId: 'mf-alerts' } },
        apns: { payload: { aps: { badge: alerts.length, sound: 'default' } } },
        webpush: {
          notification: { icon: '/meu_financeiro/icon-192.png', badge: '/meu_financeiro/icon-192.png', vibrate: [200, 100, 200] },
          fcmOptions: { link: 'https://le7martins.github.io/meu_financeiro/' },
        },
      });
      sent++;
      console.log(`[OK] ${uid.substring(0, 8)}… → ${alerts.length} alerta(s)`);
    } catch (err) {
      console.warn(`[WARN] ${uid.substring(0, 8)}… → ${err.message}`);
      // Token inválido: remove do perfil
      if (err.code === 'messaging/registration-token-not-registered') {
        await db.doc(`userProfiles/${uid}`).update({ fcmToken: null });
      }
    }
  }

  console.log(`\nConcluído: ${sent} enviado(s), ${skipped} sem alertas/token.`);
}

run().catch(e => { console.error(e); process.exit(1); });
