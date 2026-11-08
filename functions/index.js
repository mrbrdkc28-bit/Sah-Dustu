/* Chess64 — sunucu işlevleri (Firebase Cloud Functions, Blaze planı).
   oyunIstegiBildir: davetler/{id} oluşunca davet edilen oyuncunun telefonlarına bildirim gönderir
   (uygulama kapalıyken de). Android: Firebase Cloud Messaging. iOS: doğrudan Apple (APNs, .p8 anahtarı).
   Bildirim adresleri oyuncular/{uid}/ozel/bildirim belgesinde: {android:[...], ios:[...], dil:'tr'}.
   Aynı gönderen → aynı alıcı en çok 10 dakikada bir bildirim (sunucuda da sınırlı; istemci sınırı atlatılsa bile). */
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
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

    // Önce adres: alıcının adresi yoksa gönderilecek bir şey yok, sınır da sayılmaz
    const kayit = await db.doc(`oyuncular/${d.hedef}/ozel/bildirim`).get();
    if (!kayit.exists) { logger.info('adres yok: alıcı bildirim adresi kaydetmemiş', { hedef: d.hedef }); return; }
    const k = kayit.data() || {};
    if (!(k.android || []).length && !(k.ios || []).length) { logger.info('adres yok: liste boş', { hedef: d.hedef }); return; }

    // Sunucu tarafı sınır: aynı gönderen → aynı alıcı 10 dk'da bir (yalnız gerçekten gönderilecekse sayılır)
    const sinirRef = db.collection('bildirimSinir').doc(d.hedef + '_' + d.gonderen);
    const gec = await db.runTransaction(async tx => {
      const s = await tx.get(sinirRef);
      if (s.exists && Date.now() - (s.get('ts') || 0) < SINIR_MS) return false;
      tx.set(sinirRef, { ts: Date.now() });
      return true;
    });
    if (!gec) { logger.info('sınır: bildirim atlandı', olay.params.davetId); return; }
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
        android: { priority: 'high', ttl: SINIR_MS, notification: { channelId: 'davet_ses', tag: 'davet_' + d.gonderen } },
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
          const yuk = { aps: { alert: { title: baslik, body: govde }, sound: 'ses_davet.wav', 'thread-id': 'davet' }, tur: 'davet', davet: olay.params.davetId };
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

/* ---- "X şu an çevrimiçi" (Kasım 2026, sahibin isteği) ----
   Bir oyuncu en az 30 dakika sonra yeniden çevrimiçi olunca, lobideki çevrimdışı oyunculara haber verilir.
   Sınırlar: aynı oyuncu en çok 3 saatte bir duyurulur; bir alıcıya günde en çok 1 bildirim; gece (23:00-09:00 TSİ) gönderilmez.
   Lobide gizli olan duyurulmaz. Alıcı Ayarlar'dan kapatabilir (oyuncular/{uid}/ozel/bildirim.cvKapali). */
const CV_METIN = {
  tr: { b: (ad) => `${ad} şu an çevrimiçi`, g: 'Hemen oyun isteği gönder!' },
  en: { b: (ad) => `${ad} is online now`, g: 'Send a game request!' },
  ru: { b: (ad) => `${ad} сейчас в сети`, g: 'Пригласите на партию!' },
  ar: { b: (ad) => `${ad} متصل الآن`, g: 'أرسل طلب لعب الآن!' },
  fr: { b: (ad) => `${ad} est en ligne`, g: 'Proposez-lui une partie !' },
  de: { b: (ad) => `${ad} ist jetzt online`, g: 'Sende eine Spielanfrage!' },
  it: { b: (ad) => `${ad} è online ora`, g: 'Invia una richiesta di partita!' },
  zh: { b: (ad) => `${ad} 现在在线`, g: '马上发起对局邀请！' },
};
const YOKLUK_MS = 30 * 60 * 1000, DUYURU_MS = 3 * 3600 * 1000, ALICI_MS = 20 * 3600 * 1000, CEVRIMICI_MS = 5 * 60 * 1000;
const msAl = (s) => { const t = s && s.exists ? s.get('ts') : null; return t && t.toMillis ? t.toMillis() : 0; };

exports.cevrimiciBildir = onDocumentWritten(
  { document: 'cevrimici/{uid}', region: 'europe-west1', secrets: [APNS_ANAHTAR] },
  async (olay) => {
    const once = msAl(olay.data.before), simdi = msAl(olay.data.after);
    if (!simdi || simdi - once < YOKLUK_MS) return;          // 2 dakikalık kalp atışı: yeni gelmiş değil
    const saat = new Date(Date.now() + 3 * 3600 * 1000).getUTCHours();
    if (saat >= 23 || saat < 9) return;
    const uid = olay.params.uid;
    const prof = await db.doc(`oyuncular/${uid}`).get();
    if (!prof.exists || prof.get('lobiGizli')) return;
    const ad = String(prof.get('kullaniciAdi') || '').slice(0, 30);
    if (!ad) return;

    const sinirRef = db.collection('bildirimSinir').doc('cvG_' + uid);
    const gec = await db.runTransaction(async tx => {
      const s = await tx.get(sinirRef);
      if (s.exists && Date.now() - (s.get('ts') || 0) < DUYURU_MS) return false;
      tx.set(sinirRef, { ts: Date.now() });
      return true;
    });
    if (!gec) return;

    // Alıcılar: lobideki son 60 oyuncudan şu an çevrimdışı olanlar
    const lobi = await db.collection('cevrimici').orderBy('ts', 'desc').limit(60).get();
    const adaylar = lobi.docs.filter(d => d.id !== uid && Date.now() - msAl(d) > CEVRIMICI_MS).map(d => d.id);
    if (!adaylar.length) return;
    const [kayitlar, sinirlar] = await Promise.all([
      db.getAll(...adaylar.map(a => db.doc(`oyuncular/${a}/ozel/bildirim`))),
      db.getAll(...adaylar.map(a => db.collection('bildirimSinir').doc('cvA_' + a))),
    ]);
    const hedefler = [];
    adaylar.forEach((a, i) => {
      const k = kayitlar[i].exists ? kayitlar[i].data() : null;
      if (!k || k.cvKapali || (!(k.android || []).length && !(k.ios || []).length)) return;
      if (sinirlar[i].exists && Date.now() - (sinirlar[i].get('ts') || 0) < ALICI_MS) return;
      hedefler.push({ uid: a, k, ref: kayitlar[i].ref });
    });
    if (!hedefler.length) return;
    const yaz = db.batch();
    hedefler.forEach(h => yaz.set(db.collection('bildirimSinir').doc('cvA_' + h.uid), { ts: Date.now() }));
    await yaz.commit();
    logger.info('çevrimiçi duyurusu', { uid, alici: hedefler.length });

    let istemci = null, jwt = null;
    try {
      for (const h of hedefler) {
        const m = CV_METIN[h.k.dil] || CV_METIN.en;
        const baslik = m.b(ad), govde = m.g;
        const silinecek = { android: [], ios: [] };
        const android = (h.k.android || []).filter(Boolean);
        if (android.length) {
          const sonuc = await admin.messaging().sendEachForMulticast({
            tokens: android, notification: { title: baslik, body: govde }, data: { tur: 'cevrimici', uid },
            android: { priority: 'normal', ttl: YOKLUK_MS, notification: { channelId: 'cevrimici', tag: 'cevrimici' } },
          });
          sonuc.responses.forEach((r, i) => {
            const kod = r.error && r.error.code;
            if (kod === 'messaging/registration-token-not-registered' || kod === 'messaging/invalid-registration-token') silinecek.android.push(android[i]);
          });
        }
        const ios = (h.k.ios || []).filter(Boolean);
        if (ios.length && APNS_ANAHTAR.value()) {
          if (!istemci) { istemci = http2.connect('https://api.push.apple.com'); jwt = apnsJetonu(APNS_ANAHTAR.value(), APNS_ANAHTAR_ID); }
          const yuk = { aps: { alert: { title: baslik, body: govde }, sound: 'ses_genel.wav', 'thread-id': 'cevrimici' }, tur: 'cevrimici', uid };
          for (const cihaz of ios) {
            const r = await apnsGonder(istemci, jwt, cihaz, yuk);
            if (r.durum === 410 || (r.durum === 400 && /BadDeviceToken/.test(r.cevap))) silinecek.ios.push(cihaz);
            else if (r.durum !== 200) logger.warn('APNs', r.durum, r.cevap);
          }
        }
        if (silinecek.android.length || silinecek.ios.length) {
          const g = {};
          if (silinecek.android.length) g.android = admin.firestore.FieldValue.arrayRemove(...silinecek.android);
          if (silinecek.ios.length) g.ios = admin.firestore.FieldValue.arrayRemove(...silinecek.ios);
          await h.ref.update(g).catch(() => {});
        }
      }
    } finally { if (istemci) istemci.close(); }
  });

/* ---- Tarayıcıya QR ile giriş (Kasım 2026) ----
   qrBaslat: tarayıcı tek kullanımlık kod alır. qrOnayla: giriş yapmış telefon kodu onaylar.
   qrAl: tarayıcı, yalnız kendisinin bildiği "gizli" ile oturum anahtarını alır; kod bir kez kullanılır, 2 dakika geçerlidir.
   qrGiris koleksiyonuna istemciden erişim yoktur (kurallarda izin yok); yalnız sunucu okur/yazar. */
const QR_OMUR = 2 * 60 * 1000;
const qrKimlikGecerli = (id) => typeof id === 'string' && /^[0-9a-f]{32}$/.test(id);

exports.qrBaslat = onCall({ region: 'europe-west1', maxInstances: 5 }, async () => {
  const id = crypto.randomBytes(16).toString('hex'), gizli = crypto.randomBytes(24).toString('hex');
  await db.collection('qrGiris').doc(id).set({ gizli, ts: Date.now(), durum: 'bekliyor' });
  const eski = await db.collection('qrGiris').where('ts', '<', Date.now() - 10 * 60 * 1000).limit(20).get();
  if (!eski.empty) { const b = db.batch(); eski.forEach(d => b.delete(d.ref)); await b.commit(); }
  return { id, gizli, omur: QR_OMUR };
});

exports.qrOnayla = onCall({ region: 'europe-west1', maxInstances: 5 }, async (istek) => {
  if (!istek.auth) throw new HttpsError('unauthenticated', 'giris gerekli');
  const id = istek.data && istek.data.id;
  if (!qrKimlikGecerli(id)) throw new HttpsError('invalid-argument', 'gecersiz kod');
  const ref = db.collection('qrGiris').doc(id);
  await db.runTransaction(async tx => {
    const d = await tx.get(ref);
    if (!d.exists || d.get('durum') !== 'bekliyor' || Date.now() - d.get('ts') > QR_OMUR) throw new HttpsError('failed-precondition', 'kodun suresi doldu');
    tx.update(ref, { durum: 'onay', uid: istek.auth.uid });
  });
  return { tamam: true };
});

exports.qrAl = onCall({ region: 'europe-west1', maxInstances: 10, serviceAccount: 'firebase-adminsdk-fbsvc@chess64-c6ff1.iam.gserviceaccount.com' }, async (istek) => {
  const id = istek.data && istek.data.id, gizli = istek.data && istek.data.gizli;
  if (!qrKimlikGecerli(id) || typeof gizli !== 'string') throw new HttpsError('invalid-argument', 'gecersiz');
  const ref = db.collection('qrGiris').doc(id), d = await ref.get();
  if (!d.exists || d.get('gizli') !== gizli || Date.now() - d.get('ts') > QR_OMUR) return { durum: 'bitti' };
  if (d.get('durum') !== 'onay') return { durum: 'bekliyor' };
  const token = await admin.auth().createCustomToken(d.get('uid'));
  await ref.delete();
  return { durum: 'tamam', token };
});
