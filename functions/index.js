/* Chess64 — sunucu işlevleri (Firebase Cloud Functions, Blaze planı).
   oyunIstegiBildir: davetler/{id} oluşunca davet edilen oyuncunun telefonlarına bildirim gönderir
   (uygulama kapalıyken de). Android: Firebase Cloud Messaging. iOS: doğrudan Apple (APNs, .p8 anahtarı).
   Bildirim adresleri oyuncular/{uid}/ozel/bildirim belgesinde: {android:[...], ios:[...], dil:'tr'}.
   Aynı gönderen → aynı alıcı en çok 5 saniyede bir bildirim (çift basma koruması; 28 Kasım 2026'ya kadar 10 dk). */
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
const SINIR_MS = 10 * 60 * 1000;   // bildirimin geçerlilik süresi (davet ömrü)
/* 28 Kasım 2026 (sahibin isteği): davet sıklığı sınırsız; yalnız çift basmaya karşı 5 sn (eskiden 10 dk) */
const BILDIRIM_ARA_MS = 5 * 1000;

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

/* Alıcının seçtiği bildirim saatleri (22 Kasım 2026): k.saat {tur:'tum'|'gunduz'|'ozel', bas, bit} alıcının YEREL saati,
   k.tz dakika (uygulama yazar; yoksa Türkiye +180). Seçim hiç yapılmadıysa varsayılan gündüz 08:00-22:00.
   bas > bit ise gece aşan aralık (ör. 20-02); bas == bit tüm gün sayılır. */
function saatUygun(k) {
  const s = (k && k.saat) || { tur: 'gunduz' };
  if (s.tur === 'tum') return true;
  const bas = s.tur === 'ozel' ? Number(s.bas) : 8, bit = s.tur === 'ozel' ? Number(s.bit) : 22;
  if (!Number.isFinite(bas) || !Number.isFinite(bit) || bas === bit) return true;
  const tz = Number.isFinite(Number(k.tz)) ? Number(k.tz) : 180;
  const yerel = new Date(Date.now() + tz * 60000).getUTCHours();
  return bas < bit ? (yerel >= bas && yerel < bit) : (yerel >= bas || yerel < bit);
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
    if (k.davetKapali) { logger.info('alıcı maç isteği bildirimlerini kapatmış', { hedef: d.hedef }); return; }
    if (!saatUygun(k)) { logger.info('alıcının bildirim saatleri dışında', { hedef: d.hedef }); return; }

    // Sunucu tarafı sınır: aynı gönderen → aynı alıcı 5 sn'de bir (yalnız gerçekten gönderilecekse sayılır)
    const sinirRef = db.collection('bildirimSinir').doc(d.hedef + '_' + d.gonderen);
    const gec = await db.runTransaction(async tx => {
      const s = await tx.get(sinirRef);
      if (s.exists && Date.now() - (s.get('ts') || 0) < BILDIRIM_ARA_MS) return false;
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
   22 Kasım 2026 (sahibin isteği): alıcıya "günde 1" sınırı ve sabit gece yasağı kaldırıldı; her gelişte haber verilir,
   ama yalnız alıcının seçtiği saatlerde (saatUygun: tüm gün / 08-22 / özel). Aynı oyuncu en erken 30 dk arayla duyurulur.
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
const YOKLUK_MS = 30 * 60 * 1000, DUYURU_MS = 30 * 60 * 1000, CEVRIMICI_MS = 5 * 60 * 1000;
const msAl = (s) => { const t = s && s.exists ? s.get('ts') : null; return t && t.toMillis ? t.toMillis() : 0; };

exports.cevrimiciBildir = onDocumentWritten(
  { document: 'cevrimici/{uid}', region: 'europe-west1', secrets: [APNS_ANAHTAR] },
  async (olay) => {
    const once = msAl(olay.data.before), simdi = msAl(olay.data.after);
    if (!simdi || simdi - once < YOKLUK_MS) return;          // 2 dakikalık kalp atışı: yeni gelmiş değil
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
    const kayitlar = await db.getAll(...adaylar.map(a => db.doc(`oyuncular/${a}/ozel/bildirim`)));
    const hedefler = [];
    adaylar.forEach((a, i) => {
      const k = kayitlar[i].exists ? kayitlar[i].data() : null;
      if (!k || k.cvKapali || (!(k.android || []).length && !(k.ios || []).length)) return;
      if (!saatUygun(k)) return;
      hedefler.push({ uid: a, k, ref: kayitlar[i].ref });
    });
    if (!hedefler.length) return;
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

/* ===================== BOT OYUNCULAR (28 Kasım 2026, sahibin kararı) =====================
   10 bot oyuncu oyuncular/{uid} kayıtlarıyla var olur (giriş yapılan hesap değildir). Oyunu oyuncunun telefonu
   botun yerine oynatır; maç bitince istemci botSonuc/{oda} yazar, botSonucIsle botun puanını gerçek oyuncu gibi
   işler (oyun başına bir kez: oyunlar/{oda}/sayim/{botUid}). botNabiz 2 saatte bir kayıtları kurar ve botların
   başkalarıyla da oynuyormuş gibi görünmesi için puanlarını hedef güçlerine doğru küçük adımlarla kaydırır.
   Hepsini kaldırmak: BOTLAR listesini boşalt, iki işlevi sil, oyuncular'daki bu 10 kaydı sil (bot:true). */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const BOTLAR = [
  { uid: 'gKby1KpvP1cllle2yyqOTjuaU343', ad: 'qaraambar',   ulke: 'TR', avatar: '♜', guc: 1250 },
  { uid: 'EC2bvpCyBSZx59W32Z0ooxaSk2jI', ad: 'darkknight',  ulke: 'TR', avatar: '♞', guc: 1550 },
  { uid: '5wIJiebWGs6TronqXK45uEb0rWtr', ad: 'foxxmulder',  ulke: 'TR', avatar: '♝', guc: 1100 },
  { uid: 'SGP67meK3aDejqAPrOvFI05dOAmX', ad: 'Heisennberg', ulke: 'DE', avatar: '♚', guc: 1800 },
  { uid: '1dv4rVR8vM8SDhPkLlcQrjKcT6lE', ad: 'trueelove',   ulke: 'US', avatar: '♛', guc: 950 },
  { uid: '08W65AfcqyGv35zJTrvuz5Avc2ef', ad: 'realcastle',  ulke: 'ES', avatar: '♜', guc: 1650 },
  { uid: 'KDIdhweMXKkAP0HJVn9XOwgTEeyM', ad: 'leooomate',   ulke: 'BR', avatar: '♟', guc: 1350 },
  { uid: '10g8KGZxxvgCwimpvopKVGQ5q70c', ad: 'icecream',    ulke: 'IT', avatar: '♕', guc: 1000 },
  { uid: 'umAJGzNzkfKLW1bRVJG7m6ZpMKzR', ad: 'malatyalıı',  ulke: 'TR', avatar: '⚔', guc: 1450 },
  { uid: 'AuASIQXz8SubhMxLBeMDB7O0c8pf', ad: 'statics',     ulke: 'GB', avatar: '♗', guc: 2000 },
];
const botBul = uid => BOTLAR.find(b => b.uid === uid);

/* İstemcideki haftaId ile birebir aynı: hafta pazar 00:00'da (Türkiye saati) başlar */
function haftaId() {
  const tr = new Date(Date.now() + 3 * 3600000);
  const pazar = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - tr.getUTCDay()));
  const d = new Date(pazar.getTime() + 86400000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const gun = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - gun + 3);
  const ilk = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const hafta = 1 + Math.round(((t - ilk) / 86400000 - 3 + ((ilk.getUTCDay() + 6) % 7)) / 7);
  return t.getUTCFullYear() + '_' + (hafta < 10 ? '0' : '') + hafta;
}

/* Bir sonucu bot kaydına işler (gercek: 1 kazandı, 0.5 berabere, 0 kaybetti) */
function sonucYaz(p, gercek, rakipPuan) {
  const eski = p.puan || 800;
  const beklenen = 1 / (1 + Math.pow(10, (rakipPuan - eski) / 400));
  const yeni = Math.max(100, eski + Math.round(24 * (gercek - beklenen)));
  const fark = yeni - eski;
  const h = haftaId(), alan = 'hp_' + h;
  const yaz = { puan: yeni, haftaId: h, haftaAlan: alan, [alan]: (p.haftaId === h ? (p[alan] || 0) : 0) + Math.max(0, fark),
    oyun: (p.oyun || 0) + 1 };
  if (gercek === 1) yaz.galibiyet = (p.galibiyet || 0) + 1;
  else if (gercek === 0) yaz.maglubiyet = (p.maglubiyet || 0) + 1;
  else yaz.beraberlik = (p.beraberlik || 0) + 1;
  return yaz;
}

exports.botSonucIsle = onDocumentCreated(
  { document: 'botSonuc/{oda}', region: 'europe-west1', maxInstances: 5 },
  async (olay) => {
    const oda = olay.params.oda;
    const o = await db.collection('oyunlar').doc(oda).get();
    if (!o.exists) return;
    const v = o.data() || {};
    if (v.durum !== 'bitti') return;
    const renk = botBul(v.beyaz) ? 'w' : (botBul(v.siyah) ? 'b' : null);
    if (!renk) return;
    const botUid = renk === 'w' ? v.beyaz : v.siyah;
    if ((v.hamleSayi || 0) < 2 && v.sonucTip !== 'berabere') return;   // iptal sayılan oyun
    const gercek = v.kazanan == null ? 0.5 : (v.kazanan === renk ? 1 : 0);
    const rakipPuan = (renk === 'w' ? v.siyahPuan : v.beyazPuan) || 800;
    const sayimRef = db.collection('oyunlar').doc(oda).collection('sayim').doc(botUid);
    const profRef = db.collection('oyuncular').doc(botUid);
    await db.runTransaction(async tx => {
      const s = await tx.get(sayimRef);
      if (s.exists) return;
      const p = (await tx.get(profRef)).data() || {};
      tx.set(sayimRef, { t: Date.now() });
      tx.set(profRef, sonucYaz(p, gercek, rakipPuan), { merge: true });
    });
    logger.info('bot sonucu işlendi', { oda, bot: botUid, gercek });
  });

exports.botNabiz = onSchedule({ schedule: 'every 120 minutes', region: 'europe-west1', timeZone: 'Europe/Istanbul' }, async () => {
  for (const b of BOTLAR) {
    const ref = db.collection('oyuncular').doc(b.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ kullaniciAdi: b.ad, ulke: b.ulke, avatar: b.avatar, puan: 800, oyun: 0, galibiyet: 0, beraberlik: 0,
        maglubiyet: 0, lobiGizli: false, bot: true, olusturma: Date.now() });
      continue;
    }
    const p = snap.data() || {};
    // Her turda yaklaşık yarı olasılıkla 1–2 "başka oyuncuyla" maç: hedef gücüne doğru eğilimli sonuç
    if (Math.random() < 0.5) continue;
    let yaz = {}, q = Object.assign({}, p);
    const mac = 1 + (Math.random() < 0.35 ? 1 : 0);
    for (let i = 0; i < mac; i++) {
      const rakip = Math.round((q.puan || 800) + (Math.random() - 0.5) * 260);
      const kazanmaOlas = 1 / (1 + Math.pow(10, (rakip - b.guc) / 400));
      const r = Math.random();
      const gercek = r < kazanmaOlas * 0.9 ? 1 : (r < kazanmaOlas * 0.9 + 0.1 ? 0.5 : 0);
      const y = sonucYaz(q, gercek, rakip);
      q = Object.assign(q, y); yaz = Object.assign(yaz, y);
    }
    await ref.set(yaz, { merge: true });
  }
});
