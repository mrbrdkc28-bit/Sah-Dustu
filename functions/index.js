/* Chess64 — sunucu işlevleri (Firebase Cloud Functions, Blaze planı).
   oyunIstegiBildir: davetler/{id} oluşunca davet edilen oyuncunun telefonlarına bildirim gönderir
   (uygulama kapalıyken de). Android: Firebase Cloud Messaging. iOS: doğrudan Apple (APNs, .p8 anahtarı).
   Bildirim adresleri oyuncular/{uid}/ozel/bildirim belgesinde: {android:[...], ios:[...], dil:'tr'}.
   Aynı gönderen → aynı alıcı en çok 10 dakikada bir bildirim (sunucuda da sınırlı; istemci sınırı atlatılsa bile). */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const http2 = require('http2');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

const APNS_ANAHTAR = defineSecret('APNS_ANAHTAR');       // .p8 dosyasının içeriği
const APNS_ANAHTAR_ID = 'AQKFN55HZS';   // Key ID (gizli değil): Apple Developer → Keys → "Ucuzcum Push" (takım geneli)
const APPLE_TAKIM = 'PSZ843QLH4';
const PAKET = 'com.emre.sahdustu';
const SINIR_MS = 10 * 60 * 1000;

const METIN = {
  tr: { b: 'Oyun isteği', g: (ad, s) => `${ad} seni oyuna davet ediyor (${s})` },
  en: { b: 'Game request', g: (ad, s) => `${ad} invites you to a game (${s})` },
  ru: { b: 'Приглашение в игру', g: (ad, s) => `${ad} приглашает вас сыграть (${s})` },
  ar: { b: 'طلب لعب', g: (ad, s) => `${ad} يدعوك إلى مباراة (${s})` },
  fr: { b: 'Demande de partie', g: (ad, s) => `${ad} vous invite à jouer (${s})` },
  de: { b: 'Spielanfrage', g: (ad, s) => `${ad} lädt dich zu einer Partie ein (${s})` },
  it: { b: 'Richiesta di partita', g: (ad, s) => `${ad} ti invita a giocare (${s})` },
  zh: { b: '对局邀请', g: (ad, s) => `${ad} 邀请你下棋（${s}）` },
};

function sureMetni(d) {
  const dk = +(d.sure != null ? d.sure : 3), inc = +(d.inc || 0);
  return dk > 0 ? `${dk}+${inc}` : '∞';
}

/* ---- APNs (Apple) ---- */
let apnsJwt = null, apnsJwtZaman = 0;
function apnsJetonu(anahtar, anahtarId) {
  if (apnsJwt && Date.now() - apnsJwtZaman < 40 * 60 * 1000) return apnsJwt;
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const govde = b64({ alg: 'ES256', kid: anahtarId }) + '.' + b64({ iss: APPLE_TAKIM, iat: Math.floor(Date.now() / 1000) });
  const imza = crypto.sign('sha256', Buffer.from(govde), { key: anahtar, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  apnsJwt = govde + '.' + imza; apnsJwtZaman = Date.now();
  return apnsJwt;
}
function apnsGonder(istemci, jwt, cihaz, yuk) {
  return new Promise(coz => {
    const istek = istemci.request({
      ':method': 'POST', ':path': '/3/device/' + cihaz,
      authorization: 'bearer ' + jwt, 'apns-topic': PAKET, 'apns-push-type': 'alert',
      'apns-priority': '10', 'apns-expiration': String(Math.floor((Date.now() + SINIR_MS) / 1000)),
    });
    let durum = 0, cevap = '';
    istek.on('response', h => { durum = h[':status']; });
    istek.on('data', p => { cevap += p; });
    istek.on('end', () => coz({ durum, cevap }));
    istek.on('error', e => coz({ durum: 0, cevap: String(e) }));
    istek.end(JSON.stringify(yuk));
  });
}

exports.oyunIstegiBildir = onDocumentCreated(
  { document: 'davetler/{davetId}', region: 'europe-west1', secrets: [APNS_ANAHTAR] },
  async (olay) => {
    const d = olay.data && olay.data.data();
    if (!d || !d.hedef || !d.gonderen || d.hedef === d.gonderen) return;

    // Sunucu tarafı sınır: aynı gönderen → aynı alıcı 10 dk'da bir
    const sinirRef = db.collection('bildirimSinir').doc(d.hedef + '_' + d.gonderen);
    const gec = await db.runTransaction(async tx => {
      const s = await tx.get(sinirRef);
      if (s.exists && Date.now() - (s.get('ts') || 0) < SINIR_MS) return false;
      tx.set(sinirRef, { ts: Date.now() });
      return true;
    });
    if (!gec) { logger.info('sınır: bildirim atlandı', olay.params.davetId); return; }

    const kayit = await db.doc(`oyuncular/${d.hedef}/ozel/bildirim`).get();
    if (!kayit.exists) { logger.info('adres yok: alıcı bildirim adresi kaydetmemiş', { hedef: d.hedef }); return; }
    const k = kayit.data() || {};
    logger.info('gönderiliyor', { hedef: d.hedef, android: (k.android || []).length, ios: (k.ios || []).length, dil: k.dil });
    const m = METIN[k.dil] || METIN.en;
    const ad = String(d.ad || 'Chess64').slice(0, 30);
    const baslik = m.b, govde = m.g(ad, sureMetni(d));
    const silinecek = { android: [], ios: [] };

    // Android (FCM)
    const android = (k.android || []).filter(Boolean);
    if (android.length) {
      const sonuc = await admin.messaging().sendEachForMulticast({
        tokens: android,
        notification: { title: baslik, body: govde },
        data: { tur: 'davet', davet: olay.params.davetId },
        android: { priority: 'high', ttl: SINIR_MS, notification: { channelId: 'davet', tag: 'davet_' + d.gonderen } },
      });
      logger.info('FCM sonuç', { basarili: sonuc.successCount, hatali: sonuc.failureCount,
        hatalar: sonuc.responses.filter(x => x.error).map(x => x.error.code) });
      sonuc.responses.forEach((r, i) => {
        const kod = r.error && r.error.code;
        if (kod === 'messaging/registration-token-not-registered' || kod === 'messaging/invalid-registration-token')
          silinecek.android.push(android[i]);
      });
    }

    // iOS (APNs)
    const ios = (k.ios || []).filter(Boolean);
    if (ios.length) {
      const anahtar = APNS_ANAHTAR.value(), anahtarId = APNS_ANAHTAR_ID;
      if (anahtar && anahtarId) {
        const istemci = http2.connect('https://api.push.apple.com');
        try {
          const jwt = apnsJetonu(anahtar, anahtarId);
          const yuk = { aps: { alert: { title: baslik, body: govde }, sound: 'default', 'thread-id': 'davet' }, tur: 'davet', davet: olay.params.davetId };
          for (const cihaz of ios) {
            const r = await apnsGonder(istemci, jwt, cihaz, yuk);
            if (r.durum === 410 || (r.durum === 400 && /BadDeviceToken/.test(r.cevap))) silinecek.ios.push(cihaz);
            else if (r.durum !== 200) logger.warn('APNs', r.durum, r.cevap);
            else logger.info('APNs gönderildi');
          }
        } finally { istemci.close(); }
      }
    }

    if (silinecek.android.length || silinecek.ios.length) {
      const g = {};
      if (silinecek.android.length) g.android = admin.firestore.FieldValue.arrayRemove(...silinecek.android);
      if (silinecek.ios.length) g.ios = admin.firestore.FieldValue.arrayRemove(...silinecek.ios);
      await kayit.ref.update(g).catch(() => {});
    }
  });
