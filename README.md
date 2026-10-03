# ŞAH DÜŞTÜ — 3B Satranç (v1.3)

Taş alımlarının sinematik "kill-cam" sahneleriyle oynandığı 3B satranç oyunu.
Yapay zekâya karşı, aynı cihazda iki kişi ve Firebase üzerinden çevrimiçi oynanır.

**Lisans:** Uygulama Stockfish (GPL-3.0) içerdiği için bütünüyle GPL-3.0'dır.
Üçüncü taraf bileşenler (Stockfish, Cburnett taş görselleri, CC-BY 3B modeller,
görseller, Three.js, Firebase SDK, Cinzel/Manrope yazı tipleri) ve lisansları
`app/src/main/assets/KREDILER.txt` dosyasında listelenir.

## Özellikler
- Tam kurallı satranç motoru: rok, geçerken alma (en passant), terfi, şah/mat/pat
- 5 çağ ordusu — taş tasarımları seçilebilir: Mısır (obelisk, piramit, firavun),
  Pers (soğan kubbe, kanatlı muhafız), Osmanlı (minare, sarık, hilâlli alem),
  Sparta (tepelikli miğfer, Dor sütunu, mızrak), Napolyon (top arabası, şapka, apolet).
  Tüm motifler kamu malı tarihî öğelerdir; hiçbir mevcut oyun tasarımı kopyalanmamıştır.
- 12 arena: Savaş Meydanı, Buzlar Ülkesi, Fırtınanın Çölü, Kayıp Orman, Kor Krateri,
  Gece Yarısı Sarayı, Gerçek Masa, Ahşap Turnuva, Mermer Salon, Retro Salon, Oyma Tahta,
  Ustanın Masası
  (ilk beşi kendi ışığı, sisi ve parçacık atmosferiyle: kül, kar, kum, ateşböceği, kor)
- Şah göstergesi: tehdit altındaki şahın karesi kırmızı yanıp sönen halka ve
  ışıkla işaretlenir, ekranda "ŞAH!" uyarısı belirir
- Gerçekçi yok oluş: alınan taş fiziksel parçalara ayrılır (moloz yere düşüp seker),
  kamera sarsılır, çarpma anında ağır çekim ve beyaz flaş, karede yanık izi kalır
- Torna (lathe) profilli pürüzsüz taş gövdeleri — gerçek satranç silüetleri
  (Staunton biçimi 1849'dan beri kamu malıdır) + silüetten kabartma at başı
- Taş tipine özel alım sahneleri:
  Kale → top atışı · At → dörtnala ezme · Fil → büyü sarmalı
  Vezir → enerji ışını · Şah → yıldırım · Piyon → hançer hamlesi
- Kill-cam: alım anında kamera sahneye iner, sinema şeridi ve anlatım yazısı belirir
- İki oyuncu (aynı cihaz) + yapay zekâya karşı mod (alfa-beta, ~0,5 sn düşünme)
- Tematik alım sesleri: at kişnemesi, fil borusu, kılıç, top, yıldırım — tamamı
  WebAudio ile sentezlenir (ses dosyası yok). Gerçekçi ses istersen
  `assets/sfx/` klasörüne şu adlarla CC0 lisanslı mp3 koy, oyun otomatik kullanır:
  `at.mp3, fil.mp3, top.mp3, kilic.mp3, buyu.mp3, simsek.mp3`
  (Kaynak önerisi: freesound.org — yalnızca CC0 / Public Domain filtresiyle.)
- Dokunmatik kamera: sürükle = döndür, iki parmak = yakınlaştır
- Oturum içi istatistik (hamle sayısı, esir taşlar, skor)

## Kontroller
- Tek parmak dokunuş: taş seç / hamle yap (kamera artık tek parmakta dönmez)
- İki parmak: kamerayı döndür + yakınlaştır
- Masaüstü: sol tık = seç, sağ tık sürükle = döndür, tekerlek = zoom

## Android Studio'da Derleme
1. Android Studio'yu aç → **File > Open** → bu klasörü (`SahDustu`) seç.
2. Gradle senkronizasyonunu bekle. "Gradle wrapper bulunamadı" uyarısı çıkarsa
   Android Studio'nun önerdiği düzeltmeyi (wrapper'ı oluştur) kabul et.
3. İlk senkronizasyonda internet gerekir (Gradle 8.7 ve AGP 8.5.2 indirilir).
4. APK için: **Build > Build App Bundle(s) / APK(s) > Build APK(s)**
   Çıktı: `app/build/outputs/apk/debug/app-debug.apk`
5. Play Store için imzalı sürüm: **Build > Generate Signed App Bundle / APK**

Gereksinimler: Android Studio (Koala veya üzeri önerilir), JDK 17 (Studio ile gelir),
hedef cihaz Android 8.0+ (API 26).

## İnternet
Oyun internetsiz açılır: Three.js, Firebase SDK'sı ve yazı tipleri
`app/src/main/assets/lib/` altında uygulamanın içindedir. İnternet yalnızca
giriş, çevrimiçi oyun, liderlik tablosu ve reklamlar için gerekir.

## Gerçekçi 3B Modeller (isteğe bağlı yükseltme)
Prosedürel taşlar stilize kalır; foto-gerçekçilik istersen oyuna gerçek model
kapısı eklidir: `app/src/main/assets/models/` klasörüne şu adlandırmayla
.glb dosyaları koy, oyun otomatik kullanır (yoksa prosedürele döner):
  `<ordu>_<tas>_<renk>.glb`  →  örn. `osmanli_n_w.glb` (Osmanlı, at, beyaz)
Taş kodları: p piyon, r kale, n at, b fil, q vezir, k şah. Renk: w / b.
Model kaynakları (telif-güvenli):
- poly.pizza ve Quaternius — CC0 model arşivleri
- Yapay zekâ ile üretim (metinden 3B model servisleri): üretmeden önce ücretsiz
  katmanın ticari kullanım lisansını mutlaka kontrol et; servisten servise değişir.

## Sunucu (Firebase)
- Firebase Authentication: e-posta/şifre ve Google ile giriş
- Cloud Firestore: profil, Elo puanı, arkadaşlar, davetler, çevrimiçi oyunlar
- Güvenlik kuralları: `FIRESTORE-GUVENLIK-KURALLARI.txt` (Firebase Console'daki
  yayındaki kurallarla aynı tutulmalı)

## Dosya Yapısı
- `app/src/main/assets/index.html` — oyunun tamamı (motor + sahne + arayüz)
- `app/src/main/java/.../MainActivity.kt` — WebView kabuğu
- `app/src/main/res/` — uygulama adı, tema, özgün "devrilmiş şah" simgesi
