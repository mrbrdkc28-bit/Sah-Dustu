# ŞAH DÜŞTÜ — Proje Durum Dosyası

> **Bu dosya ne işe yarar:** Yeni bir sohbete başlarken bunu proje bilgi tabanına
> (Project knowledge) yükle. Kod "ne olduğunu" anlatır; bu dosya **neden öyle
> olduğunu, neyin denenip elendiğini ve neyin açık kaldığını** anlatır. Bu bilgi
> hiçbir kaynak dosyada yazmıyor ve her yeni sohbette sıfırdan keşfedilmesi
> gerekiyor — ya da bu dosya okunur.
>
> Son güncelleme: 3 Ekim 2026 · Doğrulama: aşağıdaki tüm sürüm/ayar değerleri
> `C:\Users\Emre\Desktop\SahDustu` içindeki gerçek dosyalardan okunarak yazıldı.

---

## 1. Proje nedir

Android için 3B satranç oyunu. Mimari alışılmadık: oyunun **tamamı tek bir dev
`index.html`** içinde (Three.js + saf JS satranç motoru), Kotlin tarafı yalnızca
bir WebView kabuğu ve yerli Android yeteneklerine köprü.

| | |
|---|---|
| Paket adı | `com.emre.sahdustu` |
| Depo (GPL yükümlülüğü) | https://github.com/mrbrdkc28-bit/Sah-Dustu |
| Ana dosya | `app/src/main/assets/index.html` — **~1.25 MB, ~11.300 satır** |
| Kabuk | `app/src/main/java/com/emre/sahdustu/MainActivity.kt` — ~56 KB |
| Yayın durumu | **Henüz yayında değil.** Bölüm 9'daki engeller açık. |

### Klasör haritası
```
SahDustu/
├─ app/src/main/
│  ├─ AndroidManifest.xml
│  ├─ java/com/emre/sahdustu/MainActivity.kt
│  └─ assets/
│     ├─ index.html          ← oyunun tamamı
│     ├─ KREDILER.txt        ← lisans/atıf metni (uygulama içinde gösterilir)
│     ├─ engine/             ← Stockfish wasm
│     ├─ models/             ← GLB taş setleri
│     ├─ dokular/  onizleme/  sfx/
├─ privacy.html              ← GİZLİLİK POLİTİKASI (GitHub Pages'te yayında)
├─ VARLIK-REHBERI.md         ← ⚠ BAYAT, bkz. Bölüm 8
├─ README.md · FIRESTORE-GUVENLIK-KURALLARI.txt · GOOGLE-GIRISI-DUZELTME.txt
└─ keystore.properties.ORNEK ← gerçeği yok, oluşturulacak (Bölüm 9)
```

---

## 2. Derleme yapılandırması — ve neden bu sürümler

**Bu zincire dokunmadan önce Bölüm 7'yi oku.** Sürümler keyfî değil, ölçülerek seçildi.

| Bileşen | Sürüm |
|---|---|
| compileSdk / targetSdk | 36 |
| minSdk | 26 |
| versionCode / versionName | 2 / "1.3" |
| Java / Kotlin jvmTarget | 17 |
| AGP | 8.5.2 |
| Gradle | 8.7 |
| Kotlin (KGP) | **2.1.21 — zorunlu, tercih değil** |
| google-services | 4.4.2 |
| play-services-ads | **24.0.0** |
| firebase-bom | 33.1.2 (auth + firestore) |
| androidx | core-ktx 1.13.1 · appcompat 1.7.0 · webkit 1.11.0 |

### Sürüm zincirinin gerekçesi (ölçüldü)

Reklam SDK'sı sürümleri şu Kotlin metadata'sını dayatıyor:

```
play-services-ads 23.6.0  →  Kotlin 1.9 metadata
play-services-ads 24.0.0  →  Kotlin 2.1 metadata
play-services-ads 25.4.0  →  Kotlin 2.3 metadata
```

- **23.6.0'da kalınamaz:** cihazda `Unable to obtain a JavascriptEngine` (kod 0)
  hatası test reklamlarında bile geliyordu.
- **25.4.0'a çıkılamaz:** Kotlin 2.3 gerekir, o da büyük olasılıkla Gradle ve
  AGP'yi de oynatmayı gerektirir.
- **Sonuç: Kotlin 2.1.21 + ads 24.0.0.** KGP 2.1.21 uyumluluk aralığı
  Gradle 7.6.3–8.12.1 ve AGP 7.3.1–8.7.2; projenin Gradle 8.7 / AGP 8.5.2
  ikilisi aralık içinde, bu yüzden **Gradle ve AGP'ye dokunulmadı**.

`gradle.properties` içinde `android.suppressUnsupportedCompileSdk=36` var:
AGP 8.5.2 resmen compileSdk 34'e kadar test edilmiş, 36 ile derliyor ama uyarıyor.
**Yapılacak (ertelendi):** AGP 8.9+ — ayrı iş.

### Reklam bayrağı
`MainActivity.kt` içinde `private val REKLAM_TEST = BuildConfig.DEBUG`.
Elle değiştirilen bayrak kaldırıldı; debug → test reklamı, release → gerçek reklam.
`buildFeatures { buildConfig = true }` bu yüzden açık.
**Güvenlik notu:** release derlemesinde kendi cihazında reklama tıklama —
AdMob geçersiz trafik nedeniyle hesabı kapatabilir.

---

## 3. Mimari

### 3.1 `index.html` — başlıca modüller

| Modül / fonksiyon | İş |
|---|---|
| `Motor` (IIFE, ~1727. satır) | Satranç kuralları. `legal()`, `yap()`, `gerial()`, `notasyon()`, `durum()`, `fenYukle()`, `tasAl()` |
| `Konus` | TTS sarmalayıcı — **nesil sayacı** ile zincir güvenliği (bkz. 7.2/7.3) |
| `SesKomut` | Sesli komut ayrıştırıcı (yeni) |
| `SesOyun` | Sesli oynama çalışma zamanı (yeni) |
| `dokun(cx,cy)` | Tahtaya dokunma — tek giriş noktası |
| `hamleBaslat(h)` → `hamleOnayAsamasi(h)` → `hamleOyna(h)` | Hamle uygulama zinciri (terfi + onay ayarı burada) |
| `vurguGoster(kareler, seciliKare)` / `vurguTemizle()` | Kare vurgulama |
| `hudGuncelle()` | Üst bar; her hamleden sonra çağrılır (sesli oynama kancası burada) |
| `tasRenkleri()` / `malzeme(c)` | Taş rengi koşullandırma (bkz. 5.5) |
| `winYuzde` / `hamleDogruluk` | Lichess doğruluk modeli (bkz. 5.1) |
| `ACILISLAR` | ~306 giriş açılış kitabı |
| `nesneyiSerbestBirak(kok, dokuDa)` | Three.js bellek boşaltma, paylaşılan geometriyi atlar |
| `agacTara` / `dilGozcu` (MutationObserver) | Otomatik çeviri: TR metin düğümlerini sözlükten çevirir |

**Global durum değişkenleri** (script kapsamında `let`):
`mod` ('2p'/'ai'), `oyunBitti`, `kilit`, `secili`, `legalSet`, `gozdenGecir`,
`aktifInsanRenk`, `cevrimiciAktif`, `bulmacaModu`, `yorumDil` ('tr'/'en'),
`sesProfili` (`{dil, cinsiyet}`), `uygDil` ('tr'/'en'/'ru'/'ar').

### 3.2 Kotlin köprüleri (`addJavascriptInterface`)

| Köprü adı | İş |
|---|---|
| `AndroidKopru` | Ödüllü reklam, premium kontrolü, satın alma iskeleti |
| `AndroidTTS` | Konuşma: `konus()`, `sustur()`, `hazirMi()`, ses listesi/seçimi |
| `AndroidTani` | Tanılama: SDK durumu, adaptör raporu, reklamı yeniden dene |
| `AndroidGuvenlik` | `FLAG_SECURE` — oyun ekranında ekran görüntüsü engelleme |
| `AndroidBildirim` | "Sıra sende" bildirimi |
| `AndroidSes` | **Konuşma tanıma** (yeni) — `dinle()`, `dur()`, `iptal()`, `izinIste()`, `rapor()` |

JS'e geri çağrı: `window.ttsBitti`, `window.sesDurum`, `window.sesSonuc`,
`window.sesOnSonuc`, `window.sesHata`, `window.sesSeviye`, `window.sesIzin`.

### 3.3 Çalışma zamanı ayrıntıları

- Asset'ler `WebViewAssetLoader` ile `https://appassets.androidplatform.net/assets/`
  üzerinden sunulur. **Bu şart:** Stockfish Web Worker `file://` üzerinde çalışmaz.
- Reklam SDK'sı `onPageFinished` + 2 sn sonra başlatılır (`reklamSdkBaslat()`),
  WebView yükleme anında sıkışmasın diye.
- Android 16 zorunlu edge-to-edge:
  `WindowCompat.setDecorFitsSystemWindows(window,false)` +
  `WindowInsetsControllerCompat(...).hide(systemBars())`.

---

## 4. Özellikler (mevcut durum)

Tek/iki kişilik oyun · yapay zekâ rakip · çevrimiçi oyun (Firebase Firestore) ·
arkadaş sistemi · sohbet · bulmacalar · başarımlar · liderlik tablosu ·
oyun sonu analizi (Stockfish) · hamle hamle sesli anlatım · tahtada inceleme ·
2B/3B görünüm · arenalar ve ordular (taş setleri) · 4 dil (tr/en/ru/ar) ·
**sesle oynama (yeni)**.

---

## 5. Büyük çalışmalar ve alınan kararlar

### 5.1 Doğruluk hesaplaması — Lichess modeli

**Sorun:** çoban matını yiyen oyuncu %70+ doğruluk alıyordu.
**Kök sebep:** kod önce hamle kayıplarını ortalayıp sonra eğriye sokuyordu
(Jensen eşitsizliği — tek bir vahim hata ortalamada eriyordu).
**Çözüm:** Lichess modeli. Önce **her hamle** ayrı puanlanır, sonra toplanır.

```js
function winYuzde(cp){ cp=Math.max(-1000,Math.min(1000,cp||0));
  return 50 + 50*(2/(1+Math.exp(-0.00368208*cp))-1); }

function hamleDogruluk(wpOnce,wpSonra){ if(wpSonra>=wpOnce) return 100;
  const d=wpOnce-wpSonra;
  return Math.max(0,Math.min(100,103.1668*Math.exp(-0.04354*d)-3.1669)); }
```

Toplama = (oynaklık ağırlıklı ortalama + harmonik ortalama) / 2.
Eski `dogrulukEgri` tamamen kaldırıldı.
**Doğrulama:** çoban matı kaybedeni %46 → **%23**.

Analiz panelinde 3 kutu: **sen · rakip · hamle** (kullanıcı isteği).

### 5.2 Açılış tanıma
`ACILISLAR` 45 → **~306 giriş**. Hepsi oyunun kendi `Motor.notasyon()`
çıktısıyla makine doğrulamalı üretildi (elle yazılmadı). Tarama derinliği
6 → 12 yarım hamle.
Ayrıca `sinifBelirle` içinde kitap hamlesi tuzağı düzeltildi:
`if(o.kitapMi && o.kayipPuan<=0.05) return 'kitap';`

### 5.3 TTS / seslendirme
- **Nesil sayacı:** her konuşma isteği bir numara alır; yalnızca güncel neslin
  callback'i çalışır. Zaman aşımı ağı var (motor hiç haber vermezse zincir devam eder).
- `_bitti(id)`: **bayat kimlik gelirse `true` döner** — bu kritik, bkz. 7.3.
- Türkçe notasyon okuma (`notasyonuSesleKurala`): `Nbd7` → "b sütunundaki At d yedi",
  `Qxf7#` → "Vezir f yediyi aldı, şah mat". Belirsizlik çözümü + Türkçe ek tabloları
  (`ACC_TR`, `LOC_TR`, `ORD_TR`).
- **Ses cinsiyeti:** Android ses kodlarında cinsiyet **ORTA harfte**, son harfte değil.
  `TR_ERKEK = setOf("ama","tmc")`, `TR_KADIN = setOf("cfs","efu","mfm")`.
  Ayrıca elle ses seçme ekranı var (`sesListesi/sesDene/sesSabitle`).
- `sesleriTara()` boş tarama sonucunu **önbelleğe almaz** (`if (hepsi.isEmpty()) return`).

### 5.4 Motor doğruluğu
Eklenenler: `yetersizMateryal()`, `ucTekrar()`, `konumAnahtari()`, `tekrarKaydet()`.
`durum()` artık `'yetersiz' | '3tekrar' | '50hamle'` da döndürür.
`fenYukle` en-passant ve yarım hamle sayacını ayrıştırır.
Rok hamlelerine `+`/`#` eki eklenir. Belirsizlik çözümü iki aşamalı
(önce ucuz sözde-legal tarama, aday varsa legallik kontrolü).

**Terfi hatası (perft ile bulundu):** pozisyon 4'te 228 yerine 264 bekleniyordu.
Terfi yalnızca vezir üretiyordu; 4 varyantın hepsi üretilecek şekilde düzeltildi
(vezir ilk sırada kaldı ki insan davranışı bozulmasın). **perft 5/5 geçiyor.**

### 5.5 Taş ayırt edilebilirliği (renk koşullandırma)

**Kök sebep:** `malzeme()` yalnızca arena renklerini kullanıyor, `ORDULAR[].w/.b`
değerlerini **tamamen yok sayıyordu**. Sonuç: Klasik, Mısır, Pers, Osmanlı, Sparta
ve Napolyon herhangi bir arenada **birebir aynı** görünüyordu.

`tasRenkleri()` eklendi. Ordunun renk kimliğini (ton/doygunluk) korur, yalnızca
açıklığı kaydırır ve şunları garanti eder:

- koyu taş ↔ koyu kare kontrastı **≥ 1.90**
- ordu-ordu ayrımı **≥ 3.50**
- **beyaz taş yalnızca açılır, asla koyulaşmaz** (bkz. 7.6)

WCAG bağıl parlaklık / kontrast oranı kullanılır (`_lin`, `_isik`, `_oran`).
Sonuç önbelleğe alınır (`_tasRenkOnbellek`, anahtar `ordu.id|arena.id`).

Dokulu/GLB tahtalar için **ölçülmüş gerçek kare renkleri** `ARENALAR`'a
`kareAcik`/`kareKoyu` olarak eklendi:
`gercekci 0x8D2402/0x2A1508` · `ahsapmasa 0x683917/0x000000` ·
`mermersalon 0xDBDEE5/0x14181B` · `oymamasa 0x74350C/0x0D0002` ·
`ustamasa 0xCCCCCC/0x020202`.

Taş altındaki temas halkası da tahta parlaklığına göre uyarlanır.

**Doğrulama:** 72/72 ordu-arena kombinasyonu geçti; ilk 6 ordunun koyu rengi
birbirinden ayrı (`Klasik 0x495062 · Mısır 0x5F4D3A · Pers 0x415075 ·
Osmanlı 0x5E486A · Sparta 0x604E31 · Napolyon 0x425071`).

### 5.6 Bellek ve sızıntılar
`nesneyiSerbestBirak(kok, dokuDa)` — `userData.paylasilanGeo` ve
`userData.paylasilanDoku` işaretli nesneleri **atlar** (GLB `model.clone()`
geometriyi paylaşır; körlemesine dispose çökme üretir). Dispose çağrısı 11 → 15.
Beraberlikte sonsuz `setInterval` ve çıkışta Firestore dinleyici sızıntısı kapatıldı.

### 5.7 Sesle oynama (en yeni iş)

**Mimari zorunluluk:** WebView'de `webkitSpeechRecognition` **yok**
(Chromium bug 487255, hâlâ açık). Tanıma Kotlin'de `SpeechRecognizer` ile yapılır.

**Ayrıştırma yaklaşımı — serbest metin ÇÖZÜLMEZ.** Türkçede b/c/d/e/g harfleri
sürekli karışır. Bunun yerine her token için olasılık dağılımı çıkarılır ve
**o anki yasal hamle listesine** karşı puanlanır. 30-40 yasal hamle varken
bulanık duyum bile doğru hamleye oturur.

Ayarlanabilir 3 onay modu (kareyi işaretle / sesli sor / direkt oyna) ve
3 mikrofon modu (bas-konuş / sıra bendeyken / uyandırma kelimesi).
Özellik ilk açılışta sihirbaz sorar. Fonetik alfabe ("fatsa dört") ve
çevrimdışı tanıma anahtarları var.

**Ayarlanmış sabitler** (hepsi ölçülerek seçildi):
```
ESIK        0.34   token eşleşme alt sınırı
ESIK_MARJ   0.055  altındaki göreli marj → "hangisi?" diye sor
ADAY_SONUM  0.45   n-best alt adaylarının oy ağırlığı (üstel)
TAVAN       0.38   birebir harf eşleşmesi varken rakip harflerin tavanı
GUVEN_OYNA  0.85   üstünde kullanıcının seçtiği moda göre davran
GUVEN_SOR   0.60   altında hiç tahmin etme, tekrar iste
puanlama    0.44*taş + 0.31*harf + 0.25*rakam + konum bonusu
konum bonusu +0.085 bitişik-doğru sıra · +0.040 doğru sıra · −0.060 ters sıra
```

**Ölçülen sonuç** (gerçek yasal hamleler + Türkçe karışma örüntüsü, 900 deneme):

| Gürültü | Doğru oynadı | **Yanlış oynadı** | Sordu | Reddetti |
|---|---|---|---|---|
| %20 | 45.3% | **2.0%** | 43.7% | 9.0% |
| %40 | 44.7% | **2.9%** | 32.4% | 20.0% |

Kazanım doğruluğun artmasından çok **emin olmadığında oynamamasından** geliyor.
Güven ayrımı: doğru eşleşmelerin medyanı 0.94, yanlışların 0.63.

**Manifest eklentileri:** `RECORD_AUDIO`, `uses-feature microphone required=false`,
ve API 30+ paket görünürlüğü için
`<queries><intent><action android:name="android.speech.RecognitionService"/></intent></queries>`
— bu sonuncusu olmadan `isRecognitionAvailable()` her zaman `false` döner.

### 5.8 Üst bar (HUD) yeniden düzeni
Dikey modda 10 simge butonu tek satıra sığmıyordu. İkincil butonlar
(2B, taş adı, sahne, yardım, yeni oyun) **Ayarlar modalındaki ızgaraya** taşındı
(orijinal butonlara `.click()` ile vekâlet eder — mevcut mantık bozulmadı).
Kalan 4 buton (Sesli · Ses · Ayarlar · Menü) metin etiketiyle gösteriliyor.
Notasyon şeridi `top: 60px → 84px`.

**Dikkat:** yeni arayüz metinleri `SOZLUK`'e eklenmezse TR kalır. Sayfa geneli
`MutationObserver` + `TreeWalker` ile birebir metin eşleşmesinden çeviriyor.

---

## 6. Ölçüm ve doğrulama alışkanlığı

Bu projede iddialar ölçülerek doğrulandı, göz kararı kabul edilmedi:

- Doğruluk formülü: bağımsız Node testi, çoban matı senaryosu
- Hamle üretimi: **perft 5/5**
- Renk kontrastı: 72 kombinasyonun WCAG oranı hesaplandı
- Sesli komut: 44/44 birim testi + 900'er denemelik simülasyon
- Arayüz: headless Chromium'da **gerçek `index.html`** ile uçtan uca test
  (hamle gerçekten oynandı mı, bar kapandı mı, 0 sayfa hatası)

Yeni sohbette aynı yolu izlemek istersen: Three.js r128'i npm'den
(`three@0.128.0`) indirip `cdnjs` yolunu yerel `/vendor/`'a çevirerek sayfa
headless tarayıcıda tam çalışıyor.

---

## 7. DENENİP ELENEN YOLLAR (bunları tekrar deneme)

> Bu bölüm en değerli kısım. Her biri zaman kaybı olarak öğrenildi.

**7.1 — Doğrulukta "önce ortala, sonra eğri".** Jensen eşitsizliği yüzünden tek
vahim hata eriyor. Her hamleyi ayrı puanla, sonra topla.

**7.2 — Kotlin TTS'te sessiz `return`.** `if (!ttsHazir) return` yazıldığında
JS'e hiç haber gitmiyor ve otomatik anlatım **sonsuza kadar** bekliyordu.
Kotlin tarafı **her koşulda** `konusmaBitti()` çağırmalı.

**7.3 — `onStop` override'ı hamleleri hızlı oynattı (benim regresyonum).**
Bayat "bitti" bildirimleri `_bitti()`'den `false` dönünce eski otomatik-adım
yoluna düşüyordu. Çözüm: **bayat kimlik için `true` dön.** Kullanıcı bunu
"ses cinsiyetini değiştirince hamleleri hızlı hızlı oynatıyor" diye bildirdi.

**7.4 — Ses cinsiyetini kodun SON harfinden okumak.** `mfm` "erkek" sanılıyordu.
Doğru örüntü **orta harf**. Tahmin yerine açık tablo kullan.

**7.5 — "ads 24.0.0 Kotlin içermiyor" iddiası.** Bağımlılık listesinde
`kotlin-stdlib` görünmediği için böyle denildi — **yanlıştı**, protobuf-kotlin
modülleri paketliyor. Ardından "Kotlin'i geri al, 24.0.0'da kal" planı denendi,
**başarısız oldu**. Doğru çözüm Bölüm 2'deki ölçülmüş merdiven.

**7.6 — Renk koşullandırmanın ilk hali beyazları koyulaştırdı.** Klasik fildişi
`0xF0E6CC` → hardal `0xC29C39` oldu. Kimlik bozucu olduğu için reddedildi.
Kural: **beyaz yalnızca açılır.**

**7.7 — Bayat TODO'ya güvenmek.** `VARLIK-REHBERI.md` içindeki "EKLENECEK"
notuna bakılıp lisansların eksik olduğu söylendi. Gerçekte 13 set CC-BY-4.0
ile tam atıflıydı ve zaten uygulama içi kredilerde listeliydi (kanıt: gömülü
GLB metadata'sı). **Bu dosya bayat, kanıt olarak kullanma.**

**7.8 — Denetim alt-ajanının perft sonucunu doğrulamadan kabul etmek.**
Ajan testlerin geçtiğini bildirdi; gerçekte terfi hatası vardı ve bu hata
**benim değişikliklerimden önce de mevcuttu** (pristine zip ile doğrulandı).

**7.9 — n-best adaylarında "en iyi adayı seç".** Her adayı ayrı puanlayıp
en yükseği almak yanlış: bozuk bir aday yanlış bir hamlede tesadüfen yüksek
puan alıp doğruyu geçiyor. **Ölçüldü: %70 → %46 doğruluk.** Doğrusu
**oy biriktirme** — her aday oy verir, oylar hamle başına toplanır.

**7.10 — Tek `SpeechRecognizer` örneğini yeniden kullanmak.** Birkaç oturum
sonra `ERROR_CLIENT` (kod 5) gelir ve bir daha düzelmez. Kullanıcının
"birkaç hamle sonra istemci hatası" şikâyeti buydu. Çözüm: **her oturumda
tanıyıcıyı sıfırdan kur, oturum bitince yok et** (~50 ms maliyet).

**7.11 — Birebir harf eşleşmesinde diğer harfleri tamamen elemek.** Net komutun
güvenini yükseltiyor ama tanıyıcı "be" yerine "de" ürettiğinde doğru hamle hiç
aday olamıyor. **Ölçüldü: duymama oranı %3.8 → %16.3.** Çözüm: elemek değil,
**tavanlamak** (`TAVAN = 0.38`).

**7.12 — Güveni "toplam oy içindeki pay" ile hesaplamak.** Yakın puanlı aday
sayısı arttıkça net komutlar da düşük güven alıyordu ("e dört" → 0.68).
Doğru sinyal **ikinciye göre göreli marj**.

**7.13 — Renk kontrastını malzeme renginden hesaplamak (5.5).** `tasRenkleri()`
koyu taşı koyu kareye karşı 1.9 olsun diye AÇIYORDU (Klasik 0x14161B → 0x495062).
Malzeme renginde doğru görünen kontrast, ekranda yok oldu: 6 ışık × pozlama 2.6 ×
Reinhard sahneyi doyurup her şeyi 150-220 arasına sıkıştırıyordu. Telefonda
ölçüldü: Klasik beyaz/siyah ayrımı **1.25** (siyah taş açık gri). Ders: kontrastı
**çizilmiş pikselde** ölç, malzemede değil. Işık tek tek kısılınca neredeyse hiçbir
şey değişmemesi de doygunluğun işaretiydi (diğer ışıklar yine doyuruyor).

**7.14 — Dikeyde kararmayı ışık artırarak çözmek.** `isikDikeyAyar` ortamı ×1.7,
tepeyi ×1.5, ön dolguyu ×4.5 yapıyordu; sahneyi daha da doyurdu. Pozlama ya da ışık
yükseltmek yerine `ISIK_OLCEK` ile ayarla.

---

## 8. Bilinen açık sorunlar ve riskler

**8.1 — Reklamlar Xiaomi 21081111RG'de yüklenmiyor.** Adaptör durumu
`NOT_READY: timeout`. **Aynı APK başka telefonda çalışıyor.** Sorun koddaki
değil, o cihazın Play Services reklam dinamit modülünde. Kod tarafında
yapılacak bir şey kalmadı; 6 denemeli üstel geri çekilme + `onResume` sıfırlama
+ tanılama ekranı zaten eklendi.

**8.2 — Three.js ve Firebase CDN'den yükleniyor.** [Kesin]
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js">
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js">
```
Uygulama **internetsiz açılırsa `THREE is not defined` alır ve tahta hiç
çizilmez.** Baştan beri böyle. `three.min.js` ~600 KB; assets'e gömmek yarım
saatlik iş ve uygulamayı çevrimdışı çalışır hale getirir. **Önerilen sıradaki iş.**

**8.3 — `VARLIK-REHBERI.md` bayat.** İçindeki "EKLENECEK" notları gerçeği
yansıtmıyor (bkz. 7.7). Güncellenmeli ya da silinmeli.

**8.4 — AGP 8.5.2 / compileSdk 36 uyumsuzluk uyarısı** susturuldu, kalıcı
çözüm AGP 8.9+ (ertelendi).

**8.5 — Ölü dosyalar:** ✅ 3 Ekim 2026: `klasik_*.glb` (12 dosya, 2.3 MB) APK'dan
çıkarıldı, `_yedek_2026-09-29/kullanilmayan_klasik_glb/` içinde duruyor.
(`klasikModelleriYukle()` hiç çağrılmıyor; Klasik ordu bilerek geometrik taş kullanır.)

**8.7 — Çevrimiçi puan koruması (3 Ekim 2026).** Eskiden bilgisayara (her zorlukta
1000 sayılırdı) ve yerel 2 kişilik oyuna (oyuncu hep kazanan sayılırdı) karşı da puan
değişiyordu; puanı istemci yazıyordu. Şimdi: yerel oyunlar puanı değiştirmez;
çevrimiçi puanı yalnızca `puanIsle()` yazar, oda kaydındaki sonuca göre.
Kurallar (`firestore.rules`): oda `bitti`, iki tarafın `katilim` kaydı var, oyun başına
bir `sayim` (aynı batch), |değişim| ≤ 24 (beraberlik ≤ 12) ve sonuçla aynı yön,
haftalık `hp_` artışı ≤ puan artışı, profil alan beyaz listesi, bitmiş oda sonucu kilitli.
Oyun ortasında kapatılan uygulama: `acikOda` → sonraki açılışta sayılır.
Emülatörde 34/34 senaryo + gerçek `puanIsle` uçtan uca doğrulandı.
**Kalan risk:** iki hesapla kendine karşı oynamak (~+12/oyun) ve değiştirilmiş istemcinin
gerçek rakibe karşı kendini kazanan yazması. Tam çözüm: Cloud Functions (Blaze).
Test: `firebase emulators:exec --only firestore` (Java: Android Studio `jbr`).
Kural dili notları: `math.max` yok; yol için `path('/databases/'+database+'/documents/'+p)`
kullan — `$(p)` içine `a/b` verilirse tek parça sayılır.

**8.8 — Taş okunurluğu / aydınlatma (3 Ekim 2026).** 17 ordu × 12 arena, telefonda
dikey + yatay ölçüldü (WebView'e CDP ile bağlanıp: normal kare, taşsız kare ve
taş-kimlik maskesi aynı karede çizilip her taşın ekrandaki rengi arkasındaki zeminle
karşılaştırıldı; ekran görüntüsüyle birkaç birim farkla doğrulandı). Değişiklik:
ACES + pozlama 1.0 + `ISIK_OLCEK=0.35`, koyu taş ordu rengi olduğu gibi,
`GLB_BEYAZ_TAVAN` 0.45 → 0.80 (0.45/0.65/0.80 denendi), metal yüzeylere PMREM ile
basit stüdyo yansıması (`ortamHaritasi`), Altın & Gümüş'ün ana metal rengi parlatıldı.
Sonuç (telefon, 2×204): beyaz/siyah ayrımı zayıf (<1.6) kombinasyon dikeyde 92 → 5,
yatayda 79 → 0. Klasik 1.25 → 4.55 (dikey), 1.35 → 5.94 (yatay). Kalan 5'in hepsi
Altın & Gümüş (karşı taraf gövdesi siyah lake; gözle gümüş/siyah-altın net).
Kalan: Mermer Salon / Usta Masası'nda açık taş açık karede, koyu taş koyu karede az
ayrışır (gerçek takımlarda da böyle; taban halkası taşıyor).
Aynı çalışmada: Oyma/Usta/Retro GLB tahtaları 90° dönüktü (h1 koyuydu, `tahtaDon`);
Oyun Kur ekranı Hızlı Oyna sonrası eski seçimi gösteriyordu (`kurulumSecimEsitle`);
Hızlı Oyna kilitli ordu/arenayı açıyordu.
Test araçları depoda değil: debug derlemede `setWebContentsDebuggingEnabled(true)`,
`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`.

**8.9 — Eller serbest sesli oynama (3 Ekim 2026, ÇALIŞIYOR — sahibi canlı denedi).**
Ölçülen sorunlar (telefonda, CDP + logcat) ve çözümler:
- Eski döngü her ~5 sn oturumu kapatıp JS üzerinden ~0.7 sn'de yeniden açıyordu.
  → Döngü Android tarafında (`dinleSurekli`, `surekliAktif`, `surekliYenidenAc`), cihaz
  üstü tanıyıcı (`createOnDeviceSpeechRecognizer`; dil hatasında çevrimiçiye döner).
  Segmented session (API 33) bu cihazda çalışmadı; oturum yine 5-10 sn'de biter.
- Google tanıma servisi her oturumda "open"/"failure" bipi çalıyor
  (USAGE_NOTIFICATION_EVENT). → Döngü açıkken bildirim kanalı susturulur; kapanınca /
  onPause / onCreate'te açılır (kullanıcı zaten kapattıysa dokunulmaz).
- ERROR_CLIENT tekrarı düz oturum açıp döngüyü koparıyordu → eller serbest modu korur;
  JS güvenlik ağı sıra sendeyken kapalı mikrofonu 2.5 sn'de açar.
- **Cihaz üstü tanıyıcı skor vermiyor (hep 0)**; 0 "hiç emin değil" sayıldığı için net
  komutlar güven 0.65 alıp hep onay istiyor, e kareleri 0.59 ile reddediliyordu.
  → skor 0 = bilinmiyor; güven 0.93-1.00.
- "piyon e3"te a3/b3 ikinci aday (oran 0.82, harf tavanı 0.38) → tanıyıcının hiçbir
  adayında o sütun harfi yoksa rakip sayılmaz.
- Eller serbestte onay beklerken mikrofon kapanıyordu (tek yol tahtaya dokunmak) →
  açık kalır; "evet" ya da aynı hamleyi tekrar söylemek oynatır.
Test için: `adb shell pm grant com.emre.sahdustu android.permission.RECORD_AUDIO`,
olay kaydı: window.sesDurum/sesHata/sesSonuc/sesBolum sarmalanıp zaman damgalı tutulur.
Yasal olmayan taş+kare duyulunca sesli ve yazılı uyarı ("Fil f2'ye gidemez", ek rakamın
okunuşuna göre: `YONELME`); eller serbestte "geri bildirim" kapalı olsa da söylenir.

**8.10 — Ekran yönü (3 Ekim 2026).** Manifest `portrait`; menüler hep dikey. Oyun ekranı
(`#hud.acik`, MutationObserver) açılınca kayıtlı yön (`localStorage.oyunYonu`, ilk sefer
yatay) `AndroidEkran.yon()` ile kilitlenir (yatay = SENSOR_LANDSCAPE, 180° çevirmeye izin;
dikey = PORTRAIT); telefonun kendi döndürmesi yok sayılır. Oyun ekranında sol üstte
`#yonBtn` (dikeyde süre çubuğunun altında). Telefonda test edildi: menü 392×842, oyun
842×392, düğme ↔, menüye dönüş dikey, yeni oyun son seçimle.
Yatayda telefonda kontrol edildi (3 Ekim): Seçenekler (kayar, uygun), kill-cam (yan paneller ve
yön düğmesi `body.sinema` iken gizlenir), şah uyarısı (okunur, biraz daha belirgin olabilir),
oyun sonu kartı (sığar, içerik kayar), premium kilit penceresi (uygun), bulmaca (kart tahtayı
kapatıyordu → yatayda sağda dar kart), analiz (özet 272/392 px alıyordu → sıkıştırıldı,
liste 55 → 166 px). Kontrol edilmedi: sohbet ve çevrimiçi ekranlar (iki cihaz gerekir).
Açık gözlemler: yatayda solda kamera çentiği bölgesi siyah şerit (cutout modu); notasyon
Cinzel yazı tipiyle "f3" → "F3" görünüyor (Cinzel'de küçük harf yok; piyon hamlesi taş
hamlesi gibi okunabilir).

**8.11 — Diller (3 Ekim 2026): tr, en, ru, ar + fr, de, it, zh.** Eklemeler `DIL_EK` bloğunda
(HAMLE_SAYI'nın hemen arkasında), açılışta SOZLUK/CEVM/CEVR'e birleştirilir:
fr/de/it/zh tüm mevcut metinlere; en/ru/ar'da hiç çevrilmeyen ~150 arayüz metni (arena/ordu
ad+açıklama, arkadaşlar, giriş/kayıt hataları, hesap silme, şikâyet, analiz yorumları,
lisans metni); 291 açılış adı 7 dilde; kodda `tr()?…:…` ile İngilizce üretilen mesajlar
İngilizce anahtarla. Ülke adları `Intl.DisplayNames` ile otomatik. `cev()` artık eksikte
Türkçeye değil İngilizceye düşer. Boşluk/satır sonu farkı olan metinler de eşleşir.
Arapça'da `dir=rtl` (menü, giriş, yardım, oyun ekranı tarayıcıda kontrol edildi; tahta
olduğu gibi kalır). Dil düğmeleri: TR EN RU AR FR DE IT 中文; telefon dili otomatik.
Android `res/values*`: bildirim kanalı adı/açıklaması ve satın alma mesajı 8 dilde.
SINIRLAR: sesli oynama ve sesli anlatım yalnız tr/en (diğer dillerde İngilizce);
anlatım yorumları (yorumDil) tr/en. Çeviriler Claude'un — yayından önce her dilin ana
dili konuşanlarca gözden geçirilmeli (özellikle ar, zh). Gizlilik politikası yalnız TR+EN.

**8.12 — Isınma / şarj (3 Ekim 2026).** Telefonda ölçüldü (CDP + `top`): tahta dururken
saniyede ~116 çizim (ekran 120 Hz), uygulama %146 + WebView çizim süreci %141 + surfaceflinger
%55 işlemci. Sebepler: `kameraGuncelle()` koşulsuz `true` dönüyordu ("hareketsizken 2 kare"
tasarrufu hiç çalışmıyordu) + parçacıklar her karede çizim istiyordu. Düzeltme: kamera yalnız
matris değişince true; parçacıklar ~30 güncelleme/sn (dt biriktirilir); çizim en çok ~60 Hz;
dokunuşta çizim isteği (güvenlik ağı); ekran yalnız oyun ekranında açık
(`AndroidEkran.acikTut`, eskiden tüm uygulamada). Sonuç: boşta 27 çizim/sn, %74 + %73 + %28;
hamle animasyonu 56, kill-cam 57 kare/sn. Denenip etkisiz bulunan: gölgeyi her karede
hesaplamamak, CSS sonsuz animasyonlarını durdurmak. Kalan yük parçacıklı 3B çizimin kendisi;
daha fazlası için seçenek: parçacıkları 20/sn, pixelRatio 2 → 1.5 (görsel kalite, onay gerek).

**8.6 — Dil kapsamı:** (8.11 ile büyük ölçüde kapandı) sözlükte karşılığı olmayan yeni metin
Türkçe kalır — yeni arayüz metni eklerken DIL_EK'e de ekle.

**8.13 — 3 Ekim 2026 düzeltmeleri:** Oyun Kur düğmeleri gerçek seçimi gösterir
(`kurulumSecimEsitle`; Hızlı Oyna sonrası "İki Oyuncu" görünürken AI açılıyordu). İncelemede
oynatırken ses/dil değişince oynatma takılmaz (`inceleOtoNesil`, `otoDevam`, `inceleSesDegisti`).
Sınıf adları ekranda ARAYÜZ dilinde (`sinifAd(s)`; yorum kutusu `sinifAd(s, yorumDil)`), eksik
çeviriler eklendi. İki kişilikte "Beyaz/Siyah doğruluğu". Hamle yazısı Manrope (Cinzel'de küçük
harf yok). Kamera deliği: `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` + CSS "KAMERA DELİĞİ"
bloğu (tam ekran katmanlara env(safe-area-inset-*) kadar saydam kenarlık, background-origin
border-box). YENİ TAM EKRAN KATMAN EKLERSEN o listeye ekle. Yatay oyun sonu iki sütun.

**8.14 — Temalar (3 Ekim 2026):** 7 tema, varsayılan Fildişi (açık); diğerleri Gece Altını,
Obsidyen, Zümrüt Kulüp, Bordo Kadife, Buzlu Cam, Klasik (eski görünüm). `html[data-tema]`
(localStorage `c64_tema`, head'deki erken script; klasik = öznitelik yok). CSS bloğu "TEMALAR".
Kapsam: menü + menüden açılan ekranlar (SC listesi: kurulum, ist, arkadas, cevrimici, giris,
lisans, lider, bulmacaZorluk); oyun içi bilinçli koyu. Açık temada satır içi sabit açık renkler
öznitelik seçicileriyle koyulaştırılır — YENİ satır içi renk yazma, değişken kullan.
Menü altında dil + tema düğmeleri, alttan açılan `#secimSayfa` (eski 8'li dil sırası gizli).

**8.15 — Oyun Kur + önizlemeler (3 Ekim 2026):** Oyun Kur: dolu seçili durum, renk simgeleri,
süre 3x2 + Bullet/Blitz/Rapid, `#digerAyarlar` (Savaş Sahnesi + Grafik) katlanır. Arena/ordu
önizlemeleri oyunun 3B motoruyla çekildi: `onizleme/arena_<id>.webp`, `ordu_<id>.webp` (416x256,
toplam ~352 KB; eski PNG'ler silindi). YENİ arena/ordu eklenince önizlemesini aynı yolla çek:
telefonda CDP ile renderer'ı 416x256'ya al, arena açısı pitch .40 yaw .75 uzak 11; ordu açısı
pitch .26 yaw .38 uzak 4.3 hedef (0.2,.75,3.1), arena 'harp'; `toDataURL('image/webp',.82)`.
Buzlu Cam teması: menü zemini boş, arkada canlı 3B sahne (ek çizim yükü yok, sahne zaten çiziliyor).

**8.16 — Tasarım birliği (3 Ekim 2026, devam):** Tüm ekranlar aynı dil: seçili = dolu (Fildişi lacivert+altın,
koyu temalarda altın), radius 12-16, ince çizgi SVG ikonlar (`window.IKON`, head'deki erken script; emoji
YOK — yeni simge gerekirse oraya ekle). Çevrimiçi, Profil, Liderlik (sınıf tabanlı satırlar `.liderSatir`,
`.ben`), Arkadaşlar, kilitli kartlar (`.kilitKart` + "Premium" rozeti), oyun içi HUD (cam düğmeler),
seçenekler, yardım, inceleme. Hamle yazıları/listeleri Manrope (Cinzel'de küçük harf yok).
Menü sloganı "Satranç her şeydir." (`.menuSlogan`): 10 sn'de bir silinip yeniden yazılır, renk döner;
yazı tipi `SloganYazi` = Great Vibes/Aref Ruqaa/Ma Shan Zheng ALT KÜMELERİ (yalnız slogan harfleri) —
slogan metni değişirse alt küme yeniden üretilmeli (fontTools pyftsubset). Grafik (oyun sonu): Stockfish
`_cpBeyaz` ile avantaj grafiği. Menüye dönüşte `menuSahnesiniSifirla()` sahneyi başlangıca alır.
Parçacıklar grafik kalitesine bağlı (`KADEME.*.parcacikMs`: 33/66/0). Lisanslar ekranında Yazı Tipleri bölümü.
Açılış: taşlar indikten sonra her birine kendi renginde boya damlası düşer, boya tepeden akar
(`@property --boya` + background-clip:text; text-shadow KAPALI olmalı, yoksa taş griye boğulur).
Perde 4.8 sn'de kalkar (eskiden 4.2; bağlı zamanlayıcılar 5800). Açılışta basla.mp3 ÇALMAZ (sahibi
istemedi: oyun başlama sesiyle aynı). Onun yerine `acilisNotalari()`: her taş oturuşunda yükselen
pentatonik nota (D4..E5), her boya damlasında küçük "damla", logoda akor; WebAudio ile anlık üretilir,
zamanı CSS animasyonunun startTime'ına eşlenir, dokununca susar, ses kapalıysa çalmaz.

---

### 8.17 Gezinme çubuğu, giriş düğmesi, çevrimiçi eşleşme (4 Ekim 2026)
- **Gezinme çubuğu:** menülerde/analizde telefonun Geri/Ana ekran tuşları görünür, tahtada ve açılışta gizli
  (`AndroidEkran.gezinme(goster, renk, acik)`; WebView `kok` FrameLayout içinde, alt boşluk inset kadar).
  Android 14'te temadaki opak `navigationBarColor` çiziliyordu → `window.navigationBarColor` da ayarlanır.
  Şerit rengi temaya göre (telefonda ölçüldü); Buzlu Cam'de 3B sahnenin alt pikseli okunur.
- **Giriş yap:** çıkış sonrası profil alanı boş kalıyordu → "Giriş yap" düğmesi (`girisEkraniAc`).
- **Sahne düğmesi:** basınca `kisaBilgi()` balonu "Animasyon açık/kapalı".
- **Çevrimiçi:** "Süresiz" seçeneği eklendi (herkes eşleşir). Eşleşmede süre AYNI olmalı (eskiden bakılmıyordu).
  Süreli maçta yalnız aynı animasyon ayarındakiler eşleşir; maç boyunca ayar `cvSahneSabit` ile sabit
  (`sahneAcik()`). Oda/davet: kurucunun ayarı. Her hamle `kalan` süreyi taşır, karşı saat eşitlenir.
  **Oda kuralı:** odayı kuran süre + animasyonu belirler. Süreli odada katılanın animasyon ayarı farklıysa
  "ODA AYARI" kutusu nedenini söyler, "Animasyonu aç/kapat ve katıl" ya da Vazgeç (`odayaKatilAkis`,
  `odaAyarSor`). Süresizde şart yok. Davet penceresi ve oda bekleme ekranı ayarı gösterir ("3+2 · animasyonlu").
  Yerel emülatörde iki oyuncuyla 6 senaryo test edildi, hepsi geçti (`araclar/cevrimici-test/OKU.txt`).
  Gerçek sunucuda iki gerçek cihazla deneme kapalı testte yapılacak.

### 8.19 AKICILIK: asıl sebep bulundu (4 Ekim 2026, telefonda ölçüldü)
- 120 Hz ekranda oyun ~55-69 kare/sn'de kalıyordu. 3B sahne tek başına 5,5 ms (120'ye yeter); piksel oranı,
  gölge, yansıma değiştirmek kare hızını OYNATMIYORDU. Çizim yokken rAF 118, çizince tam yarısı.
- **Sebep 1 (ana):** tahtanın üstündeki 14 öğede `backdrop-filter` bulanıklığı (3 Ekim "cam düğmeler").
  Arkadaki sahne her karede değiştiği için tarayıcı bulanıklığı her karede yeniden hesaplıyor. Kaldırıldı,
  yerine daha koyu düz zemin (`.hbtn`, `#sira`, `.notSerit`, `#son`, `.karne`, `#kisaBilgi`…).
  **Oyun ekranına tekrar backdrop-filter KOYMA.**
- **Sebep 2:** `#menu.gizli` yalnız opacity:0 idi; görünmez menü (animasyonlu başlık/slogan, gölgeli kartlar)
  oyunun üstünde çizimde kalıyordu → artık visibility:hidden (geçişten sonra).
- Sonuç: Yüksek'te tahta dururken ve kamera dönerken 119-121 kare/sn, takılan kare 0-2.
- Yüksek = sürekli çizim yalnız oyun tahtasında (`tahtaGorunur()`); Buzlu Cam menüsünde bulanıklık tasarımın
  parçası olduğu için orada sürekli çizim yok, parçacıklar 30/sn.
- Ayrıca taş parçaları aynı malzemeye göre birleştiriliyor (`tasParcaBirlestir`, 421→337 çağrı; asıl sebep değildi).

### 8.20 İlk girişte akıcılık seçimi + canlı arena/ordu önizlemesi (4 Ekim 2026)
- İlk girişte "Oyun ekranı akıcılığı" zorunlu seçilir (`ilkAkicilikSor`, `localStorage.grafikSecildi`);
  Yüksek'te ısınma/şarj uyarısı (ayar penceresi ve Oyun Kur'da da).
- Arena/ordu kartlarında göz düğmesi (Oyun Kur + çevrimiçi). Tam ekran canlı önizleme aynı 3B motorla:
  dönen kamera, dizilme, İspanyol değişim açılışı, iki alımda savaş sahnesi (sahne ayarı açıksa), döngü.
  Arena önizlenirken seçili ordu, ordu önizlenirken seçili arena. Alt şeritten diğerlerine geçiş.
  "Bunu seç" kartın kendi tıklamasını tetikler (premiumKapi aynen); kilitliyse "Kilidi aç" → Premium penceresi
  önizlemenin üstünde. Kilit önizlemedeyken açılırsa otomatik seçilip kapanır. Geri/Android geri: önceki seçim
  ve menü sahnesi geri yüklenir. Oyun sürerken önizleme kapalı. hamleOyna kullanılmaz (istatistik/kayıt yok).

### 8.18 Yenileme hızı, ısınma koruması, Oyun Ayarları penceresi (4 Ekim 2026)
- 3 Ekim ısınma düzeltmesi çizimi her kademede ~60 Hz'e sabitlemişti → 120 Hz ekranda akıcılık düştü (sahibin
  denemesi). Artık `KADEME[..].hz`: **Yüksek = 0 (ekranın en yükseği; 120/90)**, Orta/Düşük = 60.
  Yüksek'te Kotlin `AndroidEkran.yenileme(true)` en hızlı ekran modunu ister (`preferredDisplayModeId`).
  Telefonda ölçüldü: Yüksek'te rAF 121/sn, ekran 120 Hz modu.
- **Isınma koruması:** `PowerManager` sıcaklık durumu ≥2 (orta) → parçacıklar kapalı, çizim 60, ekran modu
  sisteme; soğuyunca geri (`window.isiDurumu`, `isiKoruma`, `kareMs()`). Kullanıcıya kısa bilgi balonu.
- **Oyun Ayarları:** ana menüde dil/tema yanında dişli; çevrimiçi ekranda "Animasyon · Grafik (Hz)" satırı.
  İkisi de aynı pencereyi açar (savaş animasyonu + grafik). `grafikAyarla()` / `sahneAyarla()` her yeri eşitler,
  grafik seçimi `localStorage.grafikKademe`.

## 9. YAYIN ENGELLERİ (hepsi kullanıcı tarafında)

1. ✅ **GPL-3.0 kaynak yükümlülüğü** (3 Ekim 2026). Proje artık git deposu;
   tam kaynak `github.com/mrbrdkc28-bit/Sah-Dustu` `main` dalında (eski web
   yüklemelerinin geçmişi korunarak birleştirildi). Kök `index.html` GitHub Pages
   için `app/src/main/assets/index.html`'e yönlendirir.
   ⚠ `.gitignore` şunları dışlıyor, **asla commit etme**:
   `keystore.properties`, `*.jks`, `*.keystore`, `google-services.json`.
2. ✅ **Gizlilik politikası** `privacy.html` (3 Ekim 2026: 8 dil — tr, en, ru, ar, fr, de, it, zh;
   üstte dil seçici, uygulama bağlantısı `#<dil>` ile açar; AdMob ve mikrofon dahil) yayında: https://mrbrdkc28-bit.github.io/Sah-Dustu/privacy.html
   — Play Console'a bu adres girilecek.
3. ✅ **Keystore** (3 Ekim 2026): `C:/Users/Emre/sahdustu-keys/sahdustu-upload.jks`,
   şifre aynı klasörde `OKU-BENI.txt`. `keystore.properties` buna bakıyor.
   Klasör iki ayrı yere yedeklenmeli — HENÜZ YAPILMADI (otomatik kopyalama güvenlik denetimince
   engellendi; OneDrive eşitlenmiyor). Kullanıcı elle yedeklemeli. Play App Signing açılacak.
3b. ✅ **Firestore kuralları yayında** (3 Ekim 2026): `firebase deploy --only firestore:rules
   --project chess64-c6ff1` (kökteki firebase.json). Emülatörde 34/34 test + canlıda doğrulandı:
   normal kayıt geçiyor, sahte puan ve başkasının kaydına yazma reddediliyor.
4. ✅ **Play Console › Uygulama içeriği** (3 Ekim 2026) — uygulama "Chess64 – 3D Satranç" olarak açıldı,
   7 beyanın hepsi tamam: Veri güvenliği (`PLAY-VERI-GUVENLIGI.md`'deki cevaplar), gizlilik politikası,
   reklam var, reklam kimliği (Reklam + Analiz), **hedef kitle yalnız 18+** (13-17 seçilince Aile
   politikası şartları geliyordu; sohbet yüzünden bilerek dışarıda bırakıldı), oturum açma bilgileri
   (test hesabını kullanıcı girdi), resmi kurum/finans/sağlık hayır, IARC anketi → Tüm yaşlar / PEGI 3.
5. ✅ **Mağaza girişi** (3 Ekim 2026): kategori Oyun › Masa, iletişim emvmete1223@gmail.com; Türkçe
   ad/kısa/tam açıklama (`magaza/aciklama-tr.txt`), ikon `magaza/ikon-512.png`, öne çıkan görsel
   `magaza/one-cikan-1024x500.png`, 7 ekran görüntüsü `magaza/ekran-1..7.png` (1080×1920; şablon
   `magaza/sablon.html`, ham telefon görüntüleri `magaza/ham/`). Headless Chrome ile yeniden üretilebilir.
   Kalan: **kapalı test** (en az 12 test kullanıcısı, 14 gün) → AAB yükleme, test kullanıcı listesi.

---

## 10. Lisanslar

Uygulama **GPL-3.0**'a tabidir (Stockfish nedeniyle). `KREDILER.txt` uygulama
içinde gösterilir ve şunları kapsar:

- **Stockfish** (stockfish.js, Nathan Rugg derlemesi) — GPL-3.0
- **Cburnett 2B taş seti** — GPLv2+ (Lichess varsayılanı, değiştirilmedi)
- **13 GLB taş seti** — CC-BY-4.0, tamamı atıflı (kanıt: gömülü GLB metadata'sı)
- Kalan 2 set — **KayKit**, CC0, atıf gerekmiyor

Bu konu bir kez yanlışlıkla "eksik" diye açıldı (7.7). **Lisanslar tamam.**

---

## 11. Çalışma biçimi / kod kuralları

- **Tanımlayıcılar ve yorumlar Türkçe.** (`hamleOyna`, `vurguTemizle`, `tasRenkleri`…)
- Yorumlar **ne yaptığını değil, neden öyle yapıldığını** anlatır; özellikle
  bir hatanın izini taşıyanlar korunmalı.
- Kotlin dosyasında Türkçe karakter kullanılmıyor (`baslatildi`, `tanici`…).
- `index.html` tek dosya; düzenleme betikle (Python `str.replace`) yapılıyor,
  her değişiklikten sonra tüm `<script>` blokları `node --check` ile doğrulanıyor.
- Değişiklik uygulamadan **önce sor** — kullanıcının açık talebi.
  Kullanıcı ayrıca doğrudan, övgüsüz ve iddiaların güven etiketli
  ([Kesin]/[Muhtemel]/[Tahmin]) olduğu yanıt istiyor.

---

## 12. Yeni sohbete başlarken

1. Bu dosyayı proje bilgi tabanına yükle.
2. Cowork kullanıyorsan zip yerine **klasörü bağla**:
   `C:\Users\Emre\Desktop\SahDustu` — zip bayatlar, klasör bayatlamaz.
3. Derleme, imzalama ve GitHub'a yükleme **sende**: asistan senin makinende
   Gradle/keytool/git çalıştıramıyor.
4. Sıradaki mantıklı iş: **8.2** (Three.js'i gömerek çevrimdışı çalışır hale
   getirmek), ardından Bölüm 9'daki yayın engelleri.
