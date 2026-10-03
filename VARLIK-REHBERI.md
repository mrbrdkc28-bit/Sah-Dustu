# VARLIK REHBERİ — Gerçekçi Model ve Ses Ekleme

Oyun, aşağıdaki klasörlere atılan dosyaları OTOMATİK kullanır; kod değişikliği gerekmez.

## 1) SESLER → `app/src/main/assets/sfx/`
Dosya adları (mp3): at.mp3, fil.mp3, top.mp3, kilic.mp3, buyu.mp3, simsek.mp3

Doğrulanmış telif-güvenli kaynaklar:
- **BigSoundBank** (bigsoundbank.com) — açıkça CC0 / kamu malı; hesap gerektirmez.
  "Horse Neighing" araması → at.mp3 için birebir.
- **Pixabay Ses Efektleri** (pixabay.com/sound-effects) — telifsiz, atıf gerekmez.
  Aramalar: "horse neighing" (at), "cannon" (top), "sword" (kilic),
  "thunder" (simsek), "elephant" (fil), "magic" (buyu).
- **ZapSplat** (zapsplat.com) — bazı sesler CC0 1.0 etiketli (ör. fil borusu);
  indirme sayfasındaki lisans etiketini kontrol et, yalnızca CC0 olanları al.

## 2) MODELLER → `app/src/main/assets/models/`
Dosya adı düzeni: `<ordu>_<tas>_<renk>.glb` → örn. `osmanli_n_w.glb`
(ordular: misir, pers, osmanli, sparta, napolyon · taşlar: p r n b q k · renk: w b)

Hazır, telif-güvenli setler:
- **KayKit Board Game Bits** (kaylousberg.itch.io/board-game-bits) — CC0,
  ticari kullanım serbest, atıf gerekmez; GLTF formatı dahil ve satranç taşları içerir.
  En hızlı başlangıç bu.
- **Poly Pizza** (poly.pizza/search/chess) — tam satranç seti dahil çok sayıda
  ücretsiz model; her modelin sayfasındaki lisansı tek tek kontrol et
  (çoğu CC0 veya CC-BY; CC-BY ise oyuna "Krediler" ekranı koyup atıf yapman gerekir).
- **OpenGameArt "Chess Pieces"** (opengameart.org/content/chess-pieces-0) — CC0;
  .blend formatında, Blender'dan File > Export > glTF 2.0 (.glb) ile dönüştür.


## DURUM (güncel)
- 6 taşın TAMAMI hazır: kullanıcının indirdiği satranç setinden ayıklandı,
  beyaz/siyah boyandı, `models/klasik_*.glb` olarak gömüldü. Oyun bunları yükler.
- ⚠ LİSANS KAYDI EKSİK: Bu setin indirildiği Poly Pizza sayfasındaki yazar adı ve
  lisans satırı (CC0 / CC-BY) bu dosyaya işlenmeli. CC-BY ise oyun menüsüne
  krediler satırı eklenmesi ZORUNLUDUR.
- `models/klasik_p_w.glb` ve `models/klasik_p_b.glb` HAZIR (KayKit pawn_A, CC0,
  beyaz/siyah boyandı). Oyun bunları otomatik yükler — boru hattı kanıtlandı.
- `klasik_` öneki TÜM ordular için geçerli yedektir: `klasik_<tas>_<renk>.glb`
  koyarsan beş orduda da o model kullanılır. Ordu-özel dosya (`osmanli_n_w.glb`)
  varsa o öncelik kazanır.
- KALAN 5 TAŞ: Poly Pizza'daki Jarlan Perez seti (King/Queen/Rook/Knight/Bishop
  tek tek mevcut): https://poly.pizza/search/chess — her modelin sayfasındaki
  lisansı kontrol et (CC-BY ise oyuna krediler ekranı eklenmeli).

## .gltf → .glb dönüştürme (araclar/paketle.py)
Bilgisayarında Python varsa (ComfyUI kuruluysa vardır):
  python paketle.py model.gltf klasik_r_w.glb 0.91 0.87 0.78   ← beyaz boya
  python paketle.py model.gltf klasik_r_b.glb 0.13 0.13 0.17   ← siyah boya
  python paketle.py model.gltf cikti.glb                        ← dokuyu koru
Model zaten .glb ise dönüştürme gerekmez; sadece doğru adla models/ klasörüne at.

## 3) Çağ temalı (Mısır/Osmanlı vb.) GERÇEKÇİ taşlar
Hazır CC0 arşivlerinde çağ temalı satranç seti yok denecek kadar azdır.
İki gerçekçi yol:
a) **Metinden-3B AI üretimi:** "Ottoman sultan chess king piece, marble statue,
   game asset" gibi promptlarla taş taş üret, .glb indir, yukarıdaki adlarla koy.
   ÜCRETSİZ KATMANIN LİSANSINI ÜRETMEDEN ÖNCE KONTROL ET — servise göre değişir
   ve ticari kullanım kısıtlı olabilir.
b) **Blender:** CC0 taban modeli alıp süsleri (sarık, hilâl, miğfer) kendin ekle.
   %100 telif-güvenli ve en kontrollü yol.

## 4) Format dönüştürme
OBJ/FBX/BLEND → GLB: Blender (ücretsiz) → File > Import → File > Export > glTF 2.0.
Tek taş tek dosya olacak şekilde dışa aktar; oyun boyutu otomatik ölçekler.

## Altın kural
Her indirdiğin dosya için kaynak + lisansı bir listeye yaz (yayıncıya/Play Store'a
gerektiğinde gösterebilmek için). CC0 = serbest; CC-BY = atıf zorunlu;
"editorial use" veya lisansı belirsiz = kullanma.

## LİSANS KAYITLARI (kullanıcının indirdikleri)
3B Modeller:
- Satranç seti (k,q,r,b,p): Poly Pizza "Chess Set" — YAZAR + LİSANS SATIRI EKLENECEK (sayfadan kopyala)
- At (klasik_n): Poly Pizza, nickpanek / AI Assets, "Knight" (id 1643) — LİSANS SATIRI EKLENECEK
Görseller (menü arka planı + tasarım referansı), Pixabay Content License
(ticari kullanım serbest, atıf gerekmez):
- piro4d (1697133) — menü arka planında KULLANILDI
- stux (546617), van3ssa (6872239), alsen (343919), gagan2246 (9182741) — tasarım referansı
Sesler: BigSoundBank / Pixabay (CC0 / telifsiz) — kullanıcı indirdi, oyuna işlendi.

## STOCKFISH ANALİZİ (GPL-3.0) — KURULU ✓
Stockfish 18 lite-single dosyaları engine/ klasörüne yerleştirildi:
  engine/stockfish.js  +  engine/stockfish.wasm  (~7 MB)
Oyun sonu "DEĞERLENDİR" tuşu otomatik Stockfish'e geçer; her hamleyi gerçek
motorla analiz eder, çoklu dil (TR/EN) sesli yorum üretir (cihaz TTS).
ÖNEMLİ: APK'da çalışır. Tek-dosya tarayıcı önizlemesinde worker/wasm yüklenemez,
o yüzden önizlemede basit motor devrede kalır — gerçek Stockfish'i APK'da görürsün.
GPL yükümlülüğü: engine/COPYING.txt + GPL-NOTICE.txt — kaynak kod linkini eklemeyi unutma.

## STOCKFISH ANALİZİ — ESKİ NOT
- Oyun sonu "DEĞERLENDİR" tuşu, engine/ klasöründe stockfish.js + stockfish.wasm
  varsa otomatik Stockfish 18'e geçer: santipiyon kaybı, gerçek doğruluk %,
  "ciddi hata / doğrusu şuydu" etiketleri. Dosya yoksa basit analiz devrede kalır.
- KULLAN: lite-single (tek thread) sürüm — mobil/WebView uyumlu, ~7 MB.
  Çok-thread sürümleri WebView'de ÇALIŞMAZ (SharedArrayBuffer/CORS gerektirir).
- LİSANS UYARISI: Stockfish GPL-3.0'dır. Eklersen tüm uygulaman GPL-3.0 olur;
  Play Store'da kaynak kodu açman ve lisans metnini eklemen gerekir.
  Kurulum ve yükümlülük ayrıntısı: engine/BURAYA-STOCKFISH-KOY.txt
