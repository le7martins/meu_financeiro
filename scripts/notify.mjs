#!/usr/bin/env node
/**
 * Cron: envia notificações push para usuários com vencimentos próximos.
 * Roda via GitHub Actions (diariamente às 08:00 BRT, com TZ=America/Sao_Paulo).
 * Usa as MESMAS regras do app (src/logic.js): recorrências, parcelas,
 * dívidas e faturas de cartão.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { collectDueAlerts, formatDueAlerts } from '../src/logic.js';
import { todayISO } from '../src/utils.js';

// GOOGLE_APPLICATION_CREDENTIALS aponta para o arquivo gravado pelo workflow
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const DATA_TYPES = ['entries', 'dividas', 'cards', 'purchases', 'faturas', 'settings'];

async function getUserData(uid) {
  const results = {};
  await Promise.all(DATA_TYPES.map(async t => {
    const snap = await db.doc(`users/${uid}/data/${t}`).get();
    if (snap.exists) results[t] = snap.data().v;
  }));
  return results;
}

// Resume os grupos de alerta em uma única notificação.
// O corpo é limitado: o FCM rejeita payloads acima de 4KB.
const MAX_BODY = 300;
const clip = (s) => (s.length > MAX_BODY ? `${s.slice(0, MAX_BODY - 1)}…` : s);
function summarize(msgs) {
  if (msgs.length === 1) return { title: msgs[0].title, body: clip(msgs[0].body) };
  return { title: `${msgs.length} alertas financeiros`, body: clip(msgs.map(m => `${m.title}: ${m.body}`).join(' · ')) };
}

async function processUser(uid, token, today) {
  const data = await getUserData(uid);
  const notif = data.settings?.notifSettings || {};
  if (notif.enabled === false) return false;

  const msgs = formatDueAlerts(collectDueAlerts({
    entries: data.entries || [],
    dividas: data.dividas || [],
    cards: data.cards || [],
    cardPurchases: data.purchases || [],
    cardFaturas: data.faturas || {},
  }, notif, today));
  if (msgs.length === 0) return false;

  const { title, body } = summarize(msgs);
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: { tag: 'mf-cron', count: String(msgs.length) },
      android: { priority: 'high', notification: { channelId: 'mf-alerts' } },
      apns: { payload: { aps: { badge: msgs.length, sound: 'default' } } },
      webpush: {
        notification: { icon: '/meu_financeiro/icon-192.png', badge: '/meu_financeiro/icon-192.png', vibrate: [200, 100, 200] },
        fcmOptions: { link: 'https://le7martins.github.io/meu_financeiro/' },
      },
    });
  } catch (err) {
    // Token inválido: remove do perfil
    if (err.code === 'messaging/registration-token-not-registered') {
      await db.doc(`userProfiles/${uid}`).update({ fcmToken: null });
    }
    throw err;
  }
  console.log(`[OK] ${uid.substring(0, 8)}… → ${msgs.length} grupo(s) de alerta`);
  return true;
}

async function run() {
  const today = todayISO();
  console.log(`Data de referência: ${today}`);
  const profilesSnap = await db.collection('userProfiles').get();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of profilesSnap.docs) {
    const uid = doc.id;
    const token = doc.data().fcmToken;
    if (!token) { skipped++; continue; }

    // Erro de um usuário (dado malformado, token inválido) não interrompe os demais
    try {
      if (await processUser(uid, token, today)) sent++; else skipped++;
    } catch (err) {
      failed++;
      console.warn(`[WARN] ${uid.substring(0, 8)}… → ${err.message}`);
    }
  }

  console.log(`\nConcluído: ${sent} enviado(s), ${skipped} sem alertas/token, ${failed} com erro.`);
}

run().catch(e => { console.error(e); process.exit(1); });
