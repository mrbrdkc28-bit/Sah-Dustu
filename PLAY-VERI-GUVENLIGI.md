# Play Console — Veri güvenliği formu (hazır cevaplar)

Kaynak: uygulamanın kodu ve yayındaki gizlilik politikası
(https://mrbrdkc28-bit.github.io/Sah-Dustu/privacy.html). 3 Ekim 2026'da hazırlandı.
Play Console › Uygulama içeriği › **Veri güvenliği** bölümünde sırayla işaretle.

## 1. Veri toplama ve güvenlik (ilk sayfa)

| Soru | Cevap |
|---|---|
| Uygulamanız gerekli kullanıcı veri türlerinden herhangi birini topluyor veya paylaşıyor mu? | **Evet** |
| Toplanan tüm kullanıcı verileri aktarım sırasında şifreleniyor mu? | **Evet** (Firebase ve AdMob HTTPS/TLS kullanır) |
| Kullanıcıların verilerinin silinmesini isteyebilecekleri bir yol sunuyor musunuz? | **Evet** — uygulama içinden (Profilim › Hesabımı Sil) ve e-postayla |
| Hesap silme bağlantısı (web) | `https://mrbrdkc28-bit.github.io/Sah-Dustu/privacy.html#hesap-silme` |
| Hesap oluşturma | E-posta + şifre **ve** Google ile giriş (OAuth); hesap **isteğe bağlı** (misafir oynanabilir) |

## 2. Veri türleri

Her satırda: **Toplanıyor mu / Paylaşılıyor mu / İsteğe bağlı mı / Amaçlar**.
"Paylaşılıyor" = üçüncü tarafa aktarılıyor. Firebase, Google'ın sizin adınıza işlediği hizmet sağlayıcı
olduğu için Play kurallarında *paylaşım sayılmaz*; AdMob reklam amaçlı işlediği için **paylaşım sayılır**.

| Veri türü (Play'deki adı) | Toplanıyor | Paylaşılıyor | Zorunlu mu | Amaçlar |
|---|---|---|---|---|
| Kişisel bilgiler › **E-posta adresi** | Evet | Hayır | İsteğe bağlı (yalnız hesap açılırsa) | Hesap yönetimi |
| Kişisel bilgiler › **Kullanıcı kimlikleri** (kullanıcı adı, Firebase UID) | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği, Hesap yönetimi |
| Kişisel bilgiler › **Diğer bilgiler** (ülke) | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği |
| Fotoğraflar ve videolar › **Fotoğraflar** (profil fotoğrafı) | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği |
| Mesajlar › **Diğer uygulama içi mesajlar** (çevrimiçi sohbet) | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği |
| Uygulama etkinliği › **Diğer kullanıcı tarafından oluşturulan içerik** (oyun hamleleri, şikâyetler) | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği, Dolandırıcılık önleme/güvenlik |
| Uygulama etkinliği › **Uygulama içi etkileşimler** (istatistikler, puan, arkadaşlar) | Evet | Hayır | İsteğe bağlı | Uygulama işlevselliği |
| Cihaz veya diğer kimlikler › **Cihaz veya diğer kimlikler** (Reklam Kimliği) | Evet | **Evet** (AdMob) | İsteğe bağlı (reklam izlemek isteğe bağlı) | Reklamcılık veya pazarlama, Analiz |
| Konum › **Yaklaşık konum** (AdMob, IP'den) | Evet | **Evet** (AdMob) | İsteğe bağlı | Reklamcılık veya pazarlama |
| Ses › **Ses kayıtları** | **Hayır** — bkz. not | Hayır | — | — |

**Mikrofon notu:** Uygulama ses kaydetmez, saklamaz, sunucuya göndermez; konuşmayı telefonun kendi
Android konuşma tanıma hizmeti metne çevirir ve uygulamaya yalnız tanınan metin ("at f4") gelir, o da
saklanmaz. Google'ın tanımına göre geçici olarak cihazda işlenen ve hiçbir yere gönderilmeyen veri
"toplanan" sayılmaz; bu yüzden **Ses kayıtları = Toplanmıyor**. Formdaki "Veriler geçici olarak mı
işleniyor?" sorusu çıkarsa: **Evet, geçici**.

**Hiç toplanmayanlar** (hepsine "Hayır"): ad-soyad, adres, telefon, ırk/din/siyasi görüş, finansal bilgi,
sağlık, kesin konum, kişiler/rehber, takvim, web geçmişi, dosyalar, uygulama listesi, kilitlenme
günlükleri (hatalar yalnız cihazda tutulur), performans tanılama.

## 3. Diğer içerik beyanları (aynı bölüm, ayrı sorular)

| Beyan | Cevap |
|---|---|
| Reklam içeriyor mu? | **Evet** (AdMob ödüllü reklam) |
| Hedef yaş grubu | **13 yaş ve üzeri** (gizlilik politikası 13 yaş altını hedeflemez) |
| Uygulama erişimi | Tüm işlevler giriş gerektirmeden açık değil: çevrimiçi/liderlik için hesap gerekir. İnceleme için **test hesabı** vermen gerekebilir (e-posta + şifre) — bunu sen oluşturup Console'a yaz. |
| Gizlilik politikası URL'si | `https://mrbrdkc28-bit.github.io/Sah-Dustu/privacy.html` |
| Haber uygulaması / sağlık / finans | Hayır |

## 4. Ekipten kontrol edilmesi gerekenler
- AdMob panelinde "Kullanıcı Mesajlaşma Platformu" (AB onayı) etkin mi — gizlilik politikası bunu vaat ediyor.
- Play Console'daki **Uygulama imzalama**: Google Play App Signing açık olmalı. Böylece yükleme anahtarı
  (sahdustu-upload.jks) kaybolsa bile Google'a başvurup sıfırlatabilirsin.
