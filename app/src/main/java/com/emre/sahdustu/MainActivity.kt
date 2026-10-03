package com.emre.sahdustu

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var tts: TextToSpeech? = null
    private var ttsHazir = false
    private var trDilVar = true        // cihazda Turkce TTS verisi kurulu mu
    private var webViewYok = false     // onDestroy sonrasi JS cagrilarini engelle

    // ---- REKLAM ----
    // ESKIDEN elle degistirilen bir bayrakti (REKLAM_TEST = true) ve iki yonlu
    // risk tasiyordu: yayina cikarken false yapmayi unutursan gercek reklam hic
    // gosterilmez; test ederken false birakirsan kendi cihazinda gercek reklama
    // tiklayip AdMob hesabini geceersiz trafikten kapattirabilirsin.
    // Artik DERLEME TURUNE bagli, elle mudahale gerekmiyor:
    //   debug (Android Studio'dan Run)  -> Google test reklami
    //   release (imzali yayin surumu)   -> gercek reklam birimi
    private val REKLAM_TEST = BuildConfig.DEBUG
    private val REKLAM_BIRIMI: String
        get() = if (REKLAM_TEST) "ca-app-pub-3940256099942544/5224354917"
        else "ca-app-pub-9870524422405873/8050874239"
    private var odulluReklam: RewardedAd? = null
    private var reklamDeneme = 0
    private var reklamSonHata = "-"
    private var reklamSdkHazir = false

    // ---- DOSYA SECICI (avatar fotografi) ----
    private var dosyaSecimCallback: ValueCallback<Array<Uri>>? = null

    // Zamanlayici: webView.postDelayed KULLANMA — webView 'lateinit' ve reklam
    // yuklemesi ondan once tetiklenebiliyor (cokme riski).
    private val anaKuyruk = android.os.Handler(android.os.Looper.getMainLooper())

    // ===================== SESLI OYNAMA (konusma tanima) =====================
    // WebView'de webkitSpeechRecognition YOK (Chromium bug 487255, hala acik).
    // Bu yuzden tanima yerli SpeechRecognizer ile yapilir ve JS'e koprulenir.
    private var tanici: SpeechRecognizer? = null
    private var dinliyor = false
    private var sesSonHata = "-"
    private var sesIzinBekliyor = false
    private var sonRmsGonderim = 0L
    private var sesOturum = 0                 // kacinci dinleme oturumu
    private var sonDil = "tr-TR"
    private var taniciYenilensin = false      // bir sonraki dinlemede sifirdan kur
    private var sonBaslatma = 0L
    private var hazirBekcisi: Runnable? = null
    private var otoTekrar = 0                 // ERROR_CLIENT sonrasi tek seferlik otomatik tekrar
    private var sesCevrimdisiTercih = false   // JS'ten ayarlanir: offline tanima dene
    private val SES_IZIN_KODU = 2101
    private var reklamYuklemeSuruyor = false
    /* Reklam yeniden denemesi AYRI bir Runnable ile kuyruga atilir.
       ESKI HATA: reklamiTazele() anaKuyruk.removeCallbacksAndMessages(null)
       ile kuyruktaki HER SEYI siliyordu — sesli oynamanin zaman asimi bekcisi
       ve tekrar denemesi de dahil. Artik yalnizca bu Runnable silinir. */
    private val reklamTekrarIsi = Runnable { reklamYukle() }

    /* ESKI DAVRANIS VE HATASI:
       Yukleme 3 kez denenip PES EDIYORDU (4+8+12 sn icinde biter). AdMob'un
       "Unable to obtain a JavascriptEngine" (kod 0) hatasi cogu zaman GECICIDIR:
       SDK kendi WebView'ini olusturamaz, birkac saniye sonra olusturabilir.
       Uc deneme de acilisin ilk 25 saniyesine sikistigi icin hepsi ayni gecici
       duruma denk geliyor, sonra reklam BIR DAHA HIC denenmiyordu. Kullanici
       kilide bastiginda 'odulluReklam' null oldugu icin aninda hata aliyordu.
       YENI: 6 deneme, ustel bekleme (3s'ten 60s'ye), uygulama one gelince
       sayac sifirlanir, ayrica kilide basildiginda taze bir deneme yapilir. */
    private fun reklamYukle() {
        if (reklamYuklemeSuruyor || odulluReklam != null) return
        reklamYuklemeSuruyor = true
        RewardedAd.load(this, REKLAM_BIRIMI, AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    odulluReklam = ad; reklamDeneme = 0
                    reklamYuklemeSuruyor = false
                    reklamSonHata = "-"
                }
                override fun onAdFailedToLoad(e: LoadAdError) {
                    odulluReklam = null
                    reklamYuklemeSuruyor = false
                    reklamSonHata = "kod " + e.code + ": " + e.message
                    if (reklamDeneme < 6) {
                        reklamDeneme++
                        // 3s, 6s, 12s, 24s, 48s, 60s
                        val bekle = minOf(60_000L, 3_000L * (1 shl (reklamDeneme - 1)))
                        anaKuyruk.removeCallbacks(reklamTekrarIsi)
                        anaKuyruk.postDelayed(reklamTekrarIsi, bekle)
                    }
                    hataKaydet("Reklam yuklenemedi: " + e.code + " " + e.message)
                }
            })
    }

    private var sdkBaslatildi = false
    private var baslatmaDurumu = "(henuz baslatilmadi)"
    /* Reklam SDK'sini baslatir. Yalnizca bir kez calisir. */
    private fun reklamSdkBaslat() {
        if (sdkBaslatildi) return
        // Onay (UMP) sonucu gelmeden veya reklam izni yokken SDK baslatilmaz.
        if (!this::onayBilgisi.isInitialized || !onayBilgisi.canRequestAds()) return
        sdkBaslatildi = true
        try {
            MobileAds.initialize(this) { durum ->
                reklamSdkHazir = true
                /* KRITIK TANI: initialize'in "bitti" demesi, reklam motorunun
                   HAZIR oldugu anlamina GELMEZ. Gercek durum adaptor haritasinda.
                   Play Services tarafindaki dinamik modul yuklenemediyse adaptor
                   NOT_READY kalir ve aciklamasi sebebi yazar. */
                try {
                    val sb = StringBuilder()
                    for ((ad, d) in durum.adapterStatusMap) {
                        sb.append(ad.substringAfterLast('.')).append(": ")
                            .append(d.initializationState.name)
                        if (d.description.isNotEmpty()) sb.append(" — ").append(d.description)
                        sb.append("\n")
                    }
                    baslatmaDurumu = sb.toString().trim().ifEmpty { "(adaptor yok)" }
                } catch (t: Throwable) { baslatmaDurumu = "okunamadi: " + (t.message ?: "?") }
                anaKuyruk.removeCallbacks(reklamTekrarIsi)
                anaKuyruk.postDelayed(reklamTekrarIsi, 1000L)
            }
        } catch (t: Throwable) {
            sdkBaslatildi = false
            hataKaydet("Reklam SDK baslatilamadi: " + (t.message ?: t.toString()))
        }
    }

    // ---- REKLAM ONAYI (UMP) ----
    /* Google, AEA/Ingiltere/Isvicre kullanicilari icin sertifikali bir onay
       penceresi istiyor. AdMob panelinde "Privacy & messaging" altinda GDPR
       mesaji olusturulmadiysa form hic gosterilmez ve reklamlar normal calisir. */
    private lateinit var onayBilgisi: ConsentInformation
    private var onayIstendi = false
    private fun reklamOnayiAl() {
        if (onayIstendi) return
        onayIstendi = true
        try {
            onayBilgisi = UserMessagingPlatform.getConsentInformation(this)
            val parametreler = ConsentRequestParameters.Builder().build()
            onayBilgisi.requestConsentInfoUpdate(this, parametreler, {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) { hata ->
                    if (hata != null) hataKaydet("Onay formu: " + hata.errorCode + " " + hata.message)
                    reklamSdkBaslat()
                }
            }, { hata ->
                hataKaydet("Onay bilgisi alinamadi: " + hata.errorCode + " " + hata.message)
                reklamSdkBaslat()   // onceki oturumdan izin varsa yine calisir
            })
            // Onceki oturumda onay alindiysa beklemeden basla
            reklamSdkBaslat()
        } catch (t: Throwable) {
            hataKaydet("UMP istisnasi: " + (t.message ?: t.toString()))
        }
    }

    /* Kullanici kilide bastiginda cagrilir: sayaci sifirlayip HEMEN dener. */
    private fun reklamiTazele() {
        reklamDeneme = 0
        anaKuyruk.removeCallbacks(reklamTekrarIsi)
        if (!reklamSdkHazir) { reklamSdkBaslat(); return }
        reklamYukle()
    }

    // Hatalari gelistirici paneline (localStorage c64_hatalar) yazar
    private fun hataKaydet(mesaj: String) {
        val m = mesaj.replace("'", " ").replace("\"", " ").replace("\n", " ")
        // GUVENLIK: webView 'lateinit'. TTS baslatma geri cagrisi WebView
        // olusturulmadan once tetiklenirse burasi COKERDI. Ayrica onDestroy
        // sonrasi cagri da cokme uretir. Iki durum da korunuyor.
        if (webViewYok || !this::webView.isInitialized) return
        runOnUiThread {
            if (webViewYok || !this::webView.isInitialized) return@runOnUiThread
            try {
                webView.evaluateJavascript(
                    "try{var l=JSON.parse(localStorage.getItem('c64_hatalar')||'[]');" +
                            "l.unshift('" + m + "');" +
                            "localStorage.setItem('c64_hatalar',JSON.stringify(l.slice(0,5)));}catch(x){}", null)
            } catch (t: Throwable) {}
        }
    }

    // ---- TTS SES SECIMI (cinsiyete gore AYRI) ----
    // ONCEKI HATA: tek bir ses secilip hem kadin hem erkek icin kullaniliyor,
    // sadece perde degistiriliyordu. Bu yuzden "erkek" secilince de kadin
    // konusuyordu (sadece tonu farkliydi) ve perde oynamasi sesi bozuyordu.
    // Android ses adlari cinsiyet tasir: "tr-tr-x-ama#female_1-local" gibi.
    private var sesKadin: android.speech.tts.Voice? = null
    private var sesErkek: android.speech.tts.Voice? = null
    private var sesTara = false
    private var sesFarkiPerdeyle = false   // cihazda tek ses varsa perdeyle ayir
    private var sonKullanilan = "(henuz konusulmadi)"
    private var sesRapor = ""

    // Kullanicinin elle sabitledigi sesler (gelistirici panelinden secilir)
    private var elleKadin: String? = null
    private var elleErkek: String? = null

    /* GOOGLE TURKCE SES KODLARI — OLCULMUS ESLEME
       Cihaz raporundan gelen kodlar: ama, cfs, efu, mfm, tmc
       Ortadaki harf cinsiyeti veriyor:  ...f... = kadin,  ...m... = erkek
         cfs -> kadin   mfm -> kadin(!)  efu -> kadin
         ama -> erkek   tmc -> erkek
       ESKI HATA: kod SON harfine bakiliyordu ("m ile biterse erkek"), bu yuzden
       'mfm' erkek sanildi ama gercekte kadin sesi. Kullanici erkek secince
       yine kadin duyuyordu. Artik ACIK TABLO kullaniliyor. */
    private val TR_ERKEK = setOf("ama", "tmc")
    private val TR_KADIN = setOf("cfs", "efu", "mfm")

    private fun sesleriTara() {
        if (sesTara) return
        try {
            val hepsi = tts?.voices?.filter { it.locale.language == "tr" } ?: emptyList()
            // BOS TARAMAYI ONBELLEGE ALMA: TTS hazir olsa bile voices listesi
            // ilk anlarda bos gelebiliyor. Eskiden bu bos sonuc kalici olarak
            // saklaniyor ve ses secimi BIR DAHA ASLA calismiyordu.
            if (hepsi.isEmpty()) return
            sesTara = true
            // Google TR ses kodlari: "tr-tr-x-cfs-local" gibi. Isimde
            // "female/male" YOKTUR ama 4 harfli kodun SON harfi cinsiyeti verir:
            //   ...s / ...f  -> kadin      ...m / ...d -> erkek
            fun kod(v: android.speech.tts.Voice): String {
                val m = Regex("-x-([a-z]{3,4})").find(v.name.lowercase())
                return m?.groupValues?.getOrNull(1) ?: ""
            }
            fun kadinMi(v: android.speech.tts.Voice): Boolean {
                val n = v.name.lowercase()
                if (n.contains("female") || n.contains("#f") || n.contains("-f-")) return true
                val k = kod(v)
                if (k in TR_KADIN) return true          // olculmus tablo once
                if (k in TR_ERKEK) return false
                return k.length == 3 && k[1] == 'f'     // genel kural: orta harf f
            }
            fun erkekMi(v: android.speech.tts.Voice): Boolean {
                val n = v.name.lowercase()
                if (n.contains("male") && !n.contains("female")) return true
                if (n.contains("#m") || n.contains("-m-")) return true
                val k = kod(v)
                if (k in TR_ERKEK) return true
                if (k in TR_KADIN) return false
                return k.length == 3 && k[1] == 'm'     // genel kural: orta harf m
            }
            // Gomulu (offline) sesler once: guvenilir ve gecikmesiz
            val gomulu = hepsi.filter { !it.isNetworkConnectionRequired }
            val agli   = hepsi.filter { it.isNetworkConnectionRequired }

            sesKadin = gomulu.filter { kadinMi(it) }.maxByOrNull { it.quality }
                    ?: agli.filter { kadinMi(it) }.maxByOrNull { it.quality }
            sesErkek = gomulu.filter { erkekMi(it) }.maxByOrNull { it.quality }
                    ?: agli.filter { erkekMi(it) }.maxByOrNull { it.quality }

            // SORUN: Turkce TTS seslerinin cogunda cinsiyet etiketi YOKTUR
            // (ornek: "tr-tr-x-ama-local"). O zaman iki secim de ayni sese
            // dusuyor ve degistirmek hicbir sey yapmiyordu.
            // COZUM: etiketsiz sesleri kaliteye gore sirala, iki secime
            // FARKLI sesler ata. Boylece secim her zaman duyulur bir fark yaratir.
            val sirali = (gomulu + agli).sortedByDescending { it.quality }
            if (sesKadin == null || sesErkek == null) {
                val kullanilan = mutableSetOf<String>()
                sesKadin?.let { kullanilan.add(it.name) }
                sesErkek?.let { kullanilan.add(it.name) }
                val bosta = sirali.filter { it.name !in kullanilan }
                if (sesKadin == null) { sesKadin = bosta.firstOrNull() ?: sirali.firstOrNull() }
                if (sesErkek == null) {
                    sesErkek = bosta.firstOrNull { it.name != sesKadin?.name }
                              ?: sirali.firstOrNull { it.name != sesKadin?.name }
                              ?: sirali.firstOrNull()
                }
            }
            // Iki secim ayni sese dustuyse: erkege LISTEDEKI BASKA bir sesi ver
            if (sesKadin != null && sesErkek != null && sesKadin?.name == sesErkek?.name) {
                val alternatif = sirali.firstOrNull { it.name != sesKadin?.name }
                if (alternatif != null) sesErkek = alternatif
                else sesFarkiPerdeyle = true   // gercekten tek ses var: perdeyle ayir
            }

            val sb = StringBuilder()
            sb.append("Turkce ses sayisi: ").append(hepsi.size).append("\n")
            hepsi.take(12).forEach {
                sb.append("  ").append(it.name)
                    .append(" q=").append(it.quality)
                    .append(if (kadinMi(it)) " [K]" else if (erkekMi(it)) " [E]" else " [?]")
                    .append(if (it.isNetworkConnectionRequired) " [ag]" else " [gomulu]")
                    .append("\n")
            }
            sb.append("SECILEN kadin: ").append(sesKadin?.name ?: "-").append("\n")
            sb.append("SECILEN erkek: ").append(sesErkek?.name ?: "-").append("\n")
            sb.append("Ayni ses mi: ").append(
                if (sesKadin?.name == sesErkek?.name) "EVET (perdeyle ayrilacak)" else "HAYIR")
            sesRapor = sb.toString()
        } catch (t: Throwable) {
            sesRapor = "Ses taramasi basarisiz: " + (t.message ?: "?")
        }
    }
    private fun turkceSes(kadin: Boolean): android.speech.tts.Voice? {
        sesleriTara()
        // Kullanici gelistirici panelinden bir ses sabitlediyse O kazanir
        val elle = if (kadin) elleKadin else elleErkek
        if (elle != null) {
            val bulunan = tts?.voices?.firstOrNull { it.name == elle }
            if (bulunan != null) return bulunan
        }
        return if (kadin) sesKadin else sesErkek
    }

    private var enKadin: android.speech.tts.Voice? = null
    private var enErkek: android.speech.tts.Voice? = null
    private var enTara = false
    private fun ingilizceSes(kadin: Boolean): android.speech.tts.Voice? {
        if (!enTara) {
            enTara = true
            try {
                val hepsi = tts?.voices?.filter { it.locale.language == "en" } ?: emptyList()
                val gomulu = hepsi.filter { !it.isNetworkConnectionRequired }
                val agli = hepsi.filter { it.isNetworkConnectionRequired }
                fun k(v: android.speech.tts.Voice) = v.name.lowercase().let {
                    it.contains("female") || it.contains("#f") }
                fun e(v: android.speech.tts.Voice) = v.name.lowercase().let {
                    (it.contains("male") && !it.contains("female")) || it.contains("#m") }
                enKadin = gomulu.filter { k(it) }.maxByOrNull { it.quality }
                       ?: agli.filter { k(it) }.maxByOrNull { it.quality }
                enErkek = gomulu.filter { e(it) }.maxByOrNull { it.quality }
                       ?: agli.filter { e(it) }.maxByOrNull { it.quality }
                val enIyi = gomulu.maxByOrNull { it.quality } ?: agli.maxByOrNull { it.quality }
                if (enKadin == null) enKadin = enIyi
                if (enErkek == null) enErkek = enIyi
            } catch (t: Throwable) {}
        }
        return if (kadin) enKadin else enErkek
    }

    private fun reklamSonucJs(etiket: String, durum: String) {
        val e = etiket.replace("'", "")
        if (webViewYok || !this::webView.isInitialized) return
        runOnUiThread {
            if (webViewYok) return@runOnUiThread
            webView.evaluateJavascript(
                "if(window.reklamSonucu)window.reklamSonucu('$e','$durum');", null)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ekrani acik tut. Sistem navigasyon cubugu (alt tuslar) GORUNUR kalsin ki
        // kullanici oyundan cikabilsin; sadece ust durum cubugunu gizle, icerik altina kaymasin.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        /* TAM EKRAN — Android 16 (API 36) UYUMU
           Eski systemUiVisibility bayraklari kullanimdan kalkti ve targetSdk 35+
           uygulamalarda ETKISIZ: Android 16'da kenardan-kenara duzen ZORUNLU,
           uygulama sistem cubuklarinin ALTINA cizer. Eski kodla oyun arayuzu
           durum cubugunun ve gezinme cubugunun altinda kalirdi.
           Modern karsiligi WindowInsetsController ile "sürükleyici" tam ekran.
           Web katmani zaten hazir: viewport-fit=cover + CSS safe-area-inset. */
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        // Android'in kendi TextToSpeech motoru (WebView TTS calismadigi icin)
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                // setLanguage SONUCU KONTROL EDILIR. Eskiden edilmiyordu: Turkce
                // ses verisi kurulu degilse motor sessizce basarisiz oluyor ya da
                // Turkce metni yabanci bir sesle anlamsiz okuyordu.
                val sonuc = tts?.setLanguage(Locale("tr", "TR")) ?: TextToSpeech.ERROR
                trDilVar = (sonuc != TextToSpeech.LANG_MISSING_DATA &&
                            sonuc != TextToSpeech.LANG_NOT_SUPPORTED)
                if (!trDilVar) {
                    // Turkce yoksa cihaz varsayilanina don; JS tarafi durumu okuyabilsin
                    try { tts?.language = Locale.getDefault() } catch (t: Throwable) {}
                    hataKaydet("TTS: Turkce ses verisi kurulu degil (kod $sonuc)")
                }
                tts?.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onError(id: String?) { konusmaBitti(id ?: "") }
                    override fun onDone(id: String?) { konusmaBitti(id ?: "") }
                    // stop()/QUEUE_FLUSH sirasinda onDone-onError gelmeyebilir;
                    // zincir kilitlenmesin diye onStop da bildirilir. Kimlik
                    // gonderildigi icin kesilen eski konusma yenisini bozmaz.
                    override fun onStop(id: String?, interrupted: Boolean) { konusmaBitti(id ?: "") }
                })
                ttsHazir = true
            } else {
                ttsHazir = false
                hataKaydet("TTS baslatilamadi (status $status)")
            }
        }

        // Yalniz debug derlemede: chrome://inspect ile cihazda olcum/hata ayiklama.
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            textZoom = 100   // sistemin yazi boyutu ayari oyun arayuzunu bozmasin
            loadWithOverviewMode = true
        }

        // Reklam SDK'sini baslat ve ilk reklami onceden yukle
        // SDK ana is parcaciginda baslatilir (Looper'siz arka plan
        // is parcacigi "JavaScript engine" hatasini tetikleyebiliyor).
        // Ilk reklam yuklemesi SDK gercekten hazir olunca yapilir.
        /* REKLAM SDK'SI ARTIK BURADA BASLATILMIYOR — sayfa yuklendikten sonra.
           HIPOTEZ: "Unable to obtain a JavascriptEngine" (kod 0) hatasi, Ads
           SDK'sinin KENDI WebView'ini olusturamamasidir. Bu uygulama acilista
           1,1 MB HTML + 7 MB Stockfish wasm yukluyor; WebView isleyicisi o anda
           doygun. SDK ayni anda ikinci bir WebView kurmaya calisinca basarisiz
           oluyor ve uc denemenin ucu de bu pencereye denk geliyordu.
           Baslatma onPageFinished + 2 sn'ye tasindi. Bkz. reklamSdkBaslat(). */

        // Reklam & Premium koprusu: JS tarafindaki premiumKapi buraya baglanir
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun reklamGoster(etiket: String) {
                runOnUiThread {
                    // TAMAMI try/catch icinde: burada firlatilan hicbir hata JS'e ulasmaz,
                    // yakalamazsak JS tarafi sonsuza kadar bekler ve pencere acik kalir.
                    try {
                        val ad = odulluReklam
                        if (ad == null) {
                            // Reklam hazir degil: kullaniciyi bekletme, hakki ver.
                            // Ayrica sayaci sifirlayip TAZE bir yukleme baslat ki
                            // bir sonraki denemede reklam hazir olsun.
                            reklamSonucJs(etiket, "hata")
                            reklamiTazele()
                            return@runOnUiThread
                        }
                        var odulVerildi = false
                        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                            override fun onAdDismissedFullScreenContent() {
                                odulluReklam = null; reklamYukle()
                                reklamSonucJs(etiket, if (odulVerildi) "ok" else "iptal")
                            }
                            override fun onAdFailedToShowFullScreenContent(e: AdError) {
                                odulluReklam = null; reklamYukle()
                                hataKaydet("Reklam gosterilemedi: " + e.code + " " + e.message)
                                reklamSonucJs(etiket, "hata")
                            }
                        }
                        ad.show(this@MainActivity) { odulVerildi = true }
                    } catch (t: Throwable) {
                        odulluReklam = null
                        hataKaydet("Reklam istisnasi: " + (t.message ?: t.toString()))
                        reklamSonucJs(etiket, "hata")
                        try { reklamYukle() } catch (x: Throwable) {}
                    }
                }
            }
            /* Reklam gizlilik secenekleri: AEA kullanicilari onaylarini
               sonradan degistirebilmeli (Google sarti). JS profil ekraninda
               bu dugmeyi yalnizca gerekliyse gosterir. */
            @JavascriptInterface
            fun gizlilikSecenekleriGerekli(): Boolean = try {
                this@MainActivity::onayBilgisi.isInitialized &&
                    onayBilgisi.privacyOptionsRequirementStatus ==
                    ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
            } catch (t: Throwable) { false }
            @JavascriptInterface
            fun gizlilikSecenekleriAc() {
                runOnUiThread {
                    try {
                        UserMessagingPlatform.showPrivacyOptionsForm(this@MainActivity) { hata ->
                            if (hata != null) hataKaydet("Gizlilik formu: " + hata.message)
                        }
                    } catch (t: Throwable) { hataKaydet("Gizlilik formu istisnasi: " + (t.message ?: "?")) }
                }
            }
            @JavascriptInterface
            fun premiumMu(): String = "0"  // Play Billing eklenince gercek kontrole baglanacak
            @JavascriptInterface
            fun satinAlBaslat() {
                runOnUiThread {
                    Toast.makeText(this@MainActivity,
                        "Satın alma yakında eklenecek", Toast.LENGTH_SHORT).show()
                }
            }
        }, "AndroidKopru")

        // JS'ten Android TTS'e kopru: window.AndroidTTS.konus(...)
        webView.addJavascriptInterface(object {
            // Eski 3 parametreli cagri hala desteklenir (geriye donuk uyum)
            @JavascriptInterface
            fun konus(metin: String, dil: String, kadin: Boolean) {
                konus(metin, dil, kadin, "")
            }
            @JavascriptInterface
            fun konus(metin: String, dil: String, kadin: Boolean, id: String) {
                // ESKI HATA: motor hazir degilse sessizce return ediliyordu ve
                // JS'e HIC "bitti" haberi gitmiyordu -> otomatik anlatim zinciri
                // sonsuza kadar bekliyordu. Artik her durumda haber verilir.
                if (!ttsHazir) { konusmaBitti(id); return }
                runOnUiThread {
                    val tr = !dil.startsWith("en")
                    if (tr) {
                        // Cinsiyete gore GERCEKTEN farkli ses sec
                        val ses = turkceSes(kadin)
                        sonKullanilan = (if (kadin) "KADIN -> " else "ERKEK -> ") +
                                        (ses?.name ?: "(varsayilan)")
                        if (ses != null) tts?.voice = ses
                        else tts?.language = Locale("tr", "TR")
                        // Farkli sesler bulunduysa perde OYNATILMAZ (dogal kalir).
                        // Cihazda tek ses varsa mecburen perdeyle ayirt edilir.
                        tts?.setPitch(if (sesFarkiPerdeyle && !kadin) 0.86f else 1.0f)
                        tts?.setSpeechRate(0.95f)
                    } else {
                        val enSes = ingilizceSes(kadin)
                        if (enSes != null) tts?.voice = enSes
                        else tts?.language = Locale.ENGLISH
                        tts?.setPitch(1.0f)
                        tts?.setSpeechRate(0.98f)
                    }
                    // speak() DONUS DEGERI KONTROL EDILIR: hata donerse
                    // onDone/onError hic gelmez ve zincir kilitlenirdi.
                    // utteranceId = JS'in gonderdigi nesil numarasi; boylece
                    // kesilen eski konusmanin haberi yenisiyle karistirilmaz.
                    val utId = if (id.isEmpty()) "chess64" else id
                    val r = tts?.speak(metin, TextToSpeech.QUEUE_FLUSH, null, utId)
                        ?: TextToSpeech.ERROR
                    if (r != TextToSpeech.SUCCESS) {
                        hataKaydet("TTS speak basarisiz (kod $r)")
                        konusmaBitti(id)
                    }
                }
            }
            @JavascriptInterface
            fun sustur() {
                runOnUiThread { try { tts?.stop() } catch (t: Throwable) {} }
            }
            @JavascriptInterface
            fun hazirMi(): Boolean = ttsHazir
            // JS tarafi Turkce ses verisinin varligini sorabilsin
            @JavascriptInterface
            fun turkceVarMi(): Boolean = trDilVar
            @JavascriptInterface
            fun sesRaporu(): String { sesleriTara(); return sesRapor + "\nSON KULLANILAN: " + sonKullanilan }

            /* ---- SES SECICI KOPRULERI ----
               Android cinsiyeti bildirmedigi icin tahmin yerine KULLANICI secer:
               liste + onizleme + sabitleme. */
            @JavascriptInterface
            fun sesListesi(): String {
                sesleriTara()
                val hepsi = tts?.voices?.filter { it.locale.language == "tr" }
                    ?.sortedBy { it.name } ?: emptyList()
                val sb = StringBuilder("[")
                var ilk = true
                for (v in hepsi) {
                    if (!ilk) sb.append(",")
                    ilk = false
                    val ad = v.name.replace("\"", "")
                    val rol = when (v.name) {
                        elleErkek -> "erkek*"
                        elleKadin -> "kadin*"
                        sesErkek?.name -> "erkek"
                        sesKadin?.name -> "kadin"
                        else -> ""
                    }
                    sb.append("{\"ad\":\"").append(ad).append("\",")
                        .append("\"ag\":").append(v.isNetworkConnectionRequired).append(",")
                        .append("\"rol\":\"").append(rol).append("\"}")
                }
                sb.append("]")
                return sb.toString()
            }

            /* Belirli bir sesi ANINDA dene (secimi degistirmez) */
            @JavascriptInterface
            fun sesDene(ad: String, metin: String) {
                if (!ttsHazir) return
                runOnUiThread {
                    try {
                        val v = tts?.voices?.firstOrNull { it.name == ad } ?: return@runOnUiThread
                        tts?.voice = v
                        tts?.setPitch(1.0f)
                        tts?.setSpeechRate(0.95f)
                        sonKullanilan = "DENEME -> " + ad
                        tts?.speak(metin, TextToSpeech.QUEUE_FLUSH, null, "deneme")
                    } catch (t: Throwable) { hataKaydet("Ses denemesi: " + (t.message ?: "?")) }
                }
            }

            /* Bir sesi kadin/erkek olarak SABITLE (tahmini ezer) */
            @JavascriptInterface
            fun sesSabitle(ad: String, kadin: Boolean) {
                if (kadin) elleKadin = ad else elleErkek = ad
                sesTara = false          // rapor tazelensin
                sesRapor = ""
                sesleriTara()
            }

            /* Elle sabitlemeleri temizle */
            @JavascriptInterface
            fun sesSabitTemizle() { elleKadin = null; elleErkek = null }
        }, "AndroidTTS")

        // Tani koprusu: gelistirici panelinden reklam durumunu okur
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun durum(): String {
                val sb = StringBuilder()
                sb.append("SDK baslatildi: ").append(if (reklamSdkHazir) "EVET" else "HAYIR").append("\n")
                sb.append("Reklam hazir: ").append(if (odulluReklam != null) "EVET" else "HAYIR").append("\n")
                sb.append("Deneme sayisi: ").append(reklamDeneme).append("\n")
                sb.append("Son hata: ").append(reklamSonHata).append("\n")
                sb.append("Test modu: ").append(if (REKLAM_TEST) "ACIK" else "KAPALI").append("\n")
                sb.append("SDK baslatma cagrildi: ").append(if (sdkBaslatildi) "EVET" else "HAYIR").append("\n")
                try {
                    sb.append("Ads SDK: ").append(MobileAds.getVersion().toString()).append("\n")
                } catch (t: Throwable) { sb.append("Ads SDK: okunamadi\n") }
                sb.append("--- ADAPTOR DURUMU ---\n").append(baslatmaDurumu).append("\n")
                try {
                    val pi = packageManager.getPackageInfo("com.google.android.gms", 0)
                    sb.append("Play Services: ").append(pi.versionName).append("\n")
                } catch (t: Throwable) { sb.append("Play Services: YOK/okunamadi\n") }
                try {
                    val wv = android.webkit.WebView.getCurrentWebViewPackage()
                    sb.append("WebView saglayici: ")
                        .append(wv?.packageName ?: "YOK")
                        .append(" ").append(wv?.versionName ?: "").append("\n")
                } catch (t: Throwable) { sb.append("WebView saglayici: okunamadi\n") }
                try {
                    val cm = getSystemService(android.content.Context.CONNECTIVITY_SERVICE)
                            as android.net.ConnectivityManager
                    val ag = cm.activeNetwork
                    sb.append("Internet: ").append(if (ag != null) "VAR" else "YOK").append("\n")
                } catch (t: Throwable) { sb.append("Internet: bilinmiyor\n") }
                try {
                    val pi = packageManager.getPackageInfo("com.google.android.webview", 0)
                    sb.append("WebView surumu: ").append(pi.versionName)
                } catch (t: Throwable) {
                    try {
                        val pi2 = packageManager.getPackageInfo("com.android.webview", 0)
                        sb.append("WebView surumu: ").append(pi2.versionName)
                    } catch (x: Throwable) { sb.append("WebView surumu: okunamadi") }
                }
                return sb.toString()
            }
            @JavascriptInterface
            fun yenidenDene() {
                reklamDeneme = 0
                reklamSonHata = "-"
                runOnUiThread { try { reklamYukle() } catch (t: Throwable) {
                    reklamSonHata = "yukleme istisnasi: " + (t.message ?: "?") } }
            }
        }, "AndroidTani")

        // Guvenlik koprusu: oyun ekraninda ekran goruntusu/kayit engelle (FLAG_SECURE)
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun ekranGizle(gizle: Boolean) {
                runOnUiThread {
                    if (gizle) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    }
                }
            }
        }, "AndroidGuvenlik")

        // Bildirim koprusu: JS'ten "sira sende" bildirimi goster
        olusturBildirimKanali()
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun goster(baslik: String, govde: String) {
                runOnUiThread { gosterBildirim(baslik, govde) }
            }
        }, "AndroidBildirim")

        // ===================== SESLI OYNAMA KOPRUSU =====================
        webView.addJavascriptInterface(object {

            /** Cihazda konusma tanima servisi var mi. API 30+ icin manifest'te
             *  <queries><intent action=android.speech.RecognitionService> SART,
             *  yoksa bu her zaman false doner. */
            @JavascriptInterface
            fun destekVarMi(): Boolean = try {
                SpeechRecognizer.isRecognitionAvailable(this@MainActivity)
            } catch (t: Throwable) { false }

            @JavascriptInterface
            fun izinVarMi(): Boolean =
                checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
                    android.content.pm.PackageManager.PERMISSION_GRANTED

            /** Calisma anindaki mikrofon iznini ister. Sonuc window.sesIzin(bool) ile doner. */
            @JavascriptInterface
            fun izinIste() {
                if (izinVarMi()) { jsSes("if(window.sesIzin)window.sesIzin(true,false);"); return }
                runOnUiThread {
                    sesIzinBekliyor = true
                    try {
                        requestPermissions(
                            arrayOf(android.Manifest.permission.RECORD_AUDIO), SES_IZIN_KODU)
                    } catch (t: Throwable) {
                        sesIzinBekliyor = false
                        jsSes("if(window.sesIzin)window.sesIzin(false,false);")
                    }
                }
            }

            /** Izin kalici reddedildiyse kullaniciyi uygulama ayarlarina goturur. */
            @JavascriptInterface
            fun ayarlariAc() {
                runOnUiThread {
                    try {
                        startActivity(Intent(
                            android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", packageName, null)))
                    } catch (t: Throwable) {}
                }
            }

            @JavascriptInterface
            fun cevrimdisiTercih(acik: Boolean) { sesCevrimdisiTercih = acik }

            /** Dinlemeyi baslatir. dilKodu ornek: "tr-TR". */
            @JavascriptInterface
            fun dinle(dilKodu: String) { runOnUiThread { dinlemeBaslat(dilKodu) } }

            /** Kullanici konusmayi bitirdi (bas-birak): sonucu isle. */
            @JavascriptInterface
            fun dur() { runOnUiThread { try { tanici?.stopListening() } catch (t: Throwable) {} } }

            /** Tamamen iptal: sonuc uretilmez. */
            @JavascriptInterface
            fun iptal() {
                runOnUiThread {
                    dinliyor = false
                    bekciIptal()
                    taniciYenilensin = true
                    try { tanici?.cancel() } catch (t: Throwable) {}
                    jsSes("if(window.sesDurum)window.sesDurum('bitti');")
                }
            }

            @JavascriptInterface
            fun dinliyorMu(): Boolean = dinliyor

            /** TTS su anda konusuyor mu — mikrofonu kendi sesimizle doldurmamak icin. */
            @JavascriptInterface
            fun ttsKonusuyorMu(): Boolean = try { tts?.isSpeaking == true } catch (t: Throwable) { false }

            @JavascriptInterface
            fun rapor(): String {
                val sb = StringBuilder()
                sb.append("TANIMA SERVISI: ").append(
                    try { SpeechRecognizer.isRecognitionAvailable(this@MainActivity) }
                    catch (t: Throwable) { "hata: " + t.message })
                sb.append("\nMIKROFON IZNI: ").append(if (izinVarMi()) "var" else "yok")
                sb.append("\nDINLIYOR: ").append(dinliyor)
                sb.append("\nCEVRIMDISI TERCIH: ").append(sesCevrimdisiTercih)
                sb.append("\nOTURUM SAYISI: ").append(sesOturum)
                sb.append("\nSON HATA: ").append(sesSonHata)
                sb.append("\nSDK: ").append(Build.VERSION.SDK_INT)
                return sb.toString()
            }
        }, "AndroidSes")

        // Asset'leri https://appassets.androidplatform.net uzerinden sun.
        // BU SART: Web Worker (Stockfish) file:// uzerinde calismaz; https benzeri origin gerekir.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Oyun sayfasi yuklendi: WebView isleyicisi rahatladi, simdi
                // reklam SDK'sini baslatmak icin uygun an.
                anaKuyruk.postDelayed({ reklamOnayiAl() }, 2000L)
            }
        }

        // Dosya secici koprusu: <input type="file"> tiklaninca galeriyi ac (avatar fotografi)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                dosyaSecimCallback?.onReceiveValue(null)
                dosyaSecimCallback = filePathCallback
                val secimIntent = params?.createIntent()
                if (secimIntent == null) {
                    dosyaSecimCallback = null
                    return false
                }
                return try {
                    startActivityForResult(secimIntent, 3001)
                    true
                } catch (e: Exception) {
                    dosyaSecimCallback = null
                    false
                }
            }
        }

        webView.setBackgroundColor(0xFF06070B.toInt())

        /* GERI TUSU — Android 16 (API 36) UYUMU
           targetSdk 36 ile Android 16'da ongorulu geri hareketi varsayilan;
           sistem eski onBackPressed() override'ini cagirmayabilir ve geri tusu
           uygulamayi kapatabilir (Android 14'te test edildi, 16'da edilmedi).
           OnBackPressedDispatcher her surumde calisan resmi yoldur. */
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webViewYok) return
                webView.evaluateJavascript(
                    "(function(){ try{ return window.geriTusu ? window.geriTusu() : false; }catch(e){ return false; } })();"
                ) { sonuc ->
                    if (sonuc == null || sonuc == "false" || sonuc == "null") {
                        // JS islemedi: normal geri (cikis). Kendimizi gecici kapatip
                        // sistemin varsayilan davranisini calistiririz.
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            }
        })

        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")

        // Android 13+ bildirim izni iste
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 2001)
            }
        }
    }

    // Dosya secici sonucu: secilen fotografi WebView'e teslim et
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 3001) {
            dosyaSecimCallback?.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            dosyaSecimCallback = null
        }
    }

    // ===================== SESLI OYNAMA: UYGULAMA =====================

    /** WebView yok edildikten sonra evaluateJavascript cokme uretir; tek kapi. */
    private fun jsSes(kod: String) {
        if (webViewYok || !this::webView.isInitialized) return
        runOnUiThread {
            if (webViewYok || !this::webView.isInitialized) return@runOnUiThread
            try { webView.evaluateJavascript(kod, null) } catch (t: Throwable) {}
        }
    }

    /** Android hata kodunu JS'in anlayacagi kisa etikete cevirir. */
    private fun sesHataEtiket(kod: Int): String = when (kod) {
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "ag_zaman_asimi"
        SpeechRecognizer.ERROR_NETWORK -> "ag_yok"
        SpeechRecognizer.ERROR_AUDIO -> "ses_donanimi"
        SpeechRecognizer.ERROR_SERVER -> "sunucu"
        SpeechRecognizer.ERROR_CLIENT -> "istemci"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "sessizlik"
        SpeechRecognizer.ERROR_NO_MATCH -> "anlasilmadi"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "mesgul"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "izin_yok"
        11 -> "sunucu_baglanti"          // ERROR_SERVER_DISCONNECTED (API 31)
        12 -> "dil_desteklenmiyor"       // ERROR_LANGUAGE_NOT_SUPPORTED (API 31)
        13 -> "dil_kullanilamiyor"       // ERROR_LANGUAGE_UNAVAILABLE (API 31)
        14 -> "cevrimdisi_veri_yok"      // ERROR_CANNOT_CHECK_SUPPORT (API 31)
        else -> "bilinmeyen_$kod"
    }

    /** Dinlemeyi baslatir. SpeechRecognizer YALNIZCA ana is parcaciginda kullanilabilir. */
    private fun dinlemeBaslat(dilKodu: String) {
        // 1) Kendi TTS'imiz konusuyorsa mikrofonu acma: kendi sesini duyar.
        if (try { tts?.isSpeaking == true } catch (t: Throwable) { false }) {
            sesSonHata = "tts konusuyor"
            jsSes("if(window.sesHata)window.sesHata('tts_konusuyor','');")
            return
        }
        // 2) Izin
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED) {
            sesSonHata = "izin yok"
            jsSes("if(window.sesHata)window.sesHata('izin_yok','');")
            return
        }
        // 3) Servis
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sesSonHata = "tanima servisi yok"
            jsSes("if(window.sesHata)window.sesHata('servis_yok','');")
            return
        }
        // 4) Cok hizli ard arda startListening -> ERROR_CLIENT. Nefes payi birak.
        val gecen = android.os.SystemClock.uptimeMillis() - sonBaslatma
        if (gecen in 0..280) {
            anaKuyruk.postDelayed({ dinlemeBaslat(dilKodu) }, 300 - gecen)
            return
        }
        if (dinliyor) { try { tanici?.cancel() } catch (t: Throwable) {} }

        /* SpeechRecognizer ORNEGI YENIDEN KULLANILAMAZ.
           Ayni ornekle birkac oturum sonra ERROR_CLIENT (kod 5) gelir ve bir daha
           duzelmez — Android'in bilinen davranisi. Bu yuzden her dinleme oturumu
           icin tanici sifirdan kurulur, oturum bitince yok edilir.
           Maliyeti ~50 ms; alternatifi birkac hamle sonra ozelligin olmesi. */
        if (tanici == null || taniciYenilensin) {
            taniciYok(true)
            tanici = try { SpeechRecognizer.createSpeechRecognizer(this) } catch (t: Throwable) { null }
            if (tanici == null) {
                sesSonHata = "tanici olusturulamadi"
                jsSes("if(window.sesHata)window.sesHata('servis_yok','');")
                return
            }
            taniciYenilensin = false
            tanici?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(p: Bundle?) {
                    bekciIptal()
                    dinliyor = true
                    otoTekrar = 0
                    jsSes("if(window.sesDurum)window.sesDurum('dinliyor');")
                }
                override fun onBeginningOfSpeech() {
                    jsSes("if(window.sesDurum)window.sesDurum('konusma');")
                }
                override fun onRmsChanged(rms: Float) {
                    // Saniyede ~12 kereden fazla JS'e girme: evaluateJavascript pahali.
                    val simdi = android.os.SystemClock.uptimeMillis()
                    if (simdi - sonRmsGonderim < 80L) return
                    sonRmsGonderim = simdi
                    val v = Math.max(0f, Math.min(10f, rms))
                    jsSes("if(window.sesSeviye)window.sesSeviye($v);")
                }
                override fun onBufferReceived(b: ByteArray?) {}
                override fun onEndOfSpeech() {
                    jsSes("if(window.sesDurum)window.sesDurum('isliyor');")
                }
                override fun onError(hata: Int) {
                    bekciIptal()
                    dinliyor = false
                    taniciYenilensin = true          // bu ornek artik guvenilmez
                    val et = sesHataEtiket(hata)
                    sesSonHata = et + " (oturum " + sesOturum + ")"
                    /* ERROR_CLIENT ve BUSY genelde ornegin bozulmasindan gelir.
                       Taniciyi atip BIR KEZ kendimiz tekrar deneriz; JS'e hata
                       gondermeyiz ki kullanici gereksiz uyari gormesin. */
                    if ((hata == SpeechRecognizer.ERROR_CLIENT ||
                         hata == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) && otoTekrar < 1) {
                        otoTekrar++
                        taniciYok()
                        anaKuyruk.postDelayed({ dinlemeBaslat(sonDil) }, 420L)
                        return
                    }
                    otoTekrar = 0
                    jsSes("if(window.sesHata)window.sesHata(" + JSONObject.quote(et) + ",'');")
                }
                override fun onResults(sonuc: Bundle?) {
                    bekciIptal()
                    dinliyor = false
                    taniciYenilensin = true          // oturum bitti, sonraki icin yenile
                    otoTekrar = 0
                    sonuclariGonder(sonuc, true)
                }
                override fun onPartialResults(sonuc: Bundle?) {
                    sonuclariGonder(sonuc, false)
                }
                override fun onEvent(tur: Int, p: Bundle?) {}
            })
        }

        val niyet = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                     RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, dilKodu)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, dilKodu)
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, true)
            // n-best: tek bir metin yerine aday listesi al. Satranc komutlarinda
            // dogru hamle cogu zaman 1. adayda degil 2-3. adayda cikiyor.
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 8)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
            // Komutlar kisa: uzun sessizlik beklemeden kapat.
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 900L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 900L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 700L)
            if (sesCevrimdisiTercih && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            }
        }
        sonDil = dilKodu
        sonBaslatma = android.os.SystemClock.uptimeMillis()
        sesOturum++
        try {
            tanici?.startListening(niyet)
            /* BEKCI: bazi cihazlarda startListening sessizce hicbir sey yapmaz —
               ne onReadyForSpeech ne onError gelir, ozellik donar. 4 sn icinde
               hazir olmazsa taniciyi atip JS'i haberdar ederiz. */
            bekciIptal()
            hazirBekcisi = Runnable {
                if (!dinliyor) {
                    taniciYenilensin = true
                    taniciYok()
                    sesSonHata = "hazir olmadi (zaman asimi)"
                    jsSes("if(window.sesHata)window.sesHata('baslatilamadi','');")
                }
            }
            anaKuyruk.postDelayed(hazirBekcisi!!, 4000L)
        } catch (t: Throwable) {
            dinliyor = false
            taniciYenilensin = true
            sesSonHata = "baslatilamadi: " + (t.message ?: "?")
            jsSes("if(window.sesHata)window.sesHata('baslatilamadi','');")
        }
    }

    private fun bekciIptal() {
        hazirBekcisi?.let { try { anaKuyruk.removeCallbacks(it) } catch (t: Throwable) {} }
        hazirBekcisi = null
    }

    /** Taniciyi guvenle yok et. Callback ICINDEN destroy() cagirmak cokme uretebilir,
     *  bu yuzden dinleyici once sokulur. */
    private fun taniciYok(hemen: Boolean = false) {
        val t = tanici
        tanici = null
        if (t == null) return
        try { t.setRecognitionListener(null) } catch (x: Throwable) {}
        try { t.cancel() } catch (x: Throwable) {}
        // Callback ICINDEN destroy() cokme uretebilir -> kuyruga at.
        // Callback disindaysak hemen yok et ki iki tanici ayni anda servise
        // baglanip ERROR_RECOGNIZER_BUSY uretmesin.
        if (hemen) { try { t.destroy() } catch (x: Throwable) {} }
        else anaKuyruk.post { try { t.destroy() } catch (x: Throwable) {} }
    }

    /** n-best listesini ve varsa guven skorlarini JSON olarak JS'e verir. */
    private fun sonuclariGonder(sonuc: Bundle?, kesin: Boolean) {
        val liste = sonuc?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        if (liste == null || liste.isEmpty()) {
            if (kesin) jsSes("if(window.sesHata)window.sesHata('anlasilmadi','');")
            return
        }
        val skorlar = try { sonuc.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES) } catch (t: Throwable) { null }
        val dizi = JSONArray()
        for (i in liste.indices) {
            val o = JSONObject()
            o.put("metin", liste[i])
            o.put("skor", if (skorlar != null && i < skorlar.size) skorlar[i].toDouble() else -1.0)
            dizi.put(o)
        }
        // JSON'u JS string literali olarak kacir, sonra JS tarafinda parse et.
        val yuk = JSONObject.quote(dizi.toString())
        val fn = if (kesin) "sesSonuc" else "sesOnSonuc"
        jsSes("if(window.$fn)window.$fn(JSON.parse($yuk));")
    }

    /** Mikrofon izni cevabi. */
    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != SES_IZIN_KODU) return
        sesIzinBekliyor = false
        val verildi = grantResults.isNotEmpty() &&
            grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
        // Kalici red: kullanici "bir daha sorma" dediyse rationale de false doner.
        // Bu durumda JS ayarlara yonlendirme teklif eder.
        val kalici = !verildi && !shouldShowRequestPermissionRationale(
            android.Manifest.permission.RECORD_AUDIO)
        jsSes("if(window.sesIzin)window.sesIzin($verildi,$kalici);")
    }

    private val BILDIRIM_KANAL = "sah_dustu_sira"

    private fun olusturBildirimKanali() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val kanal = NotificationChannel(
                BILDIRIM_KANAL,
                "Oyun Sırası",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Rakip hamle yaptığında bildirim"
            }
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            mgr.createNotificationChannel(kanal)
        }
    }

    private fun gosterBildirim(baslik: String, govde: String) {
        // Uygulamayi one getiren niyet
        val niyet = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val bayrak = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val pi = PendingIntent.getActivity(this, 0, niyet, bayrak)

        val bildirim = NotificationCompat.Builder(this, BILDIRIM_KANAL)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setContentTitle(baslik)
            .setContentText(govde)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        try {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            mgr.notify(1001, bildirim)
        } catch (e: Exception) {}
    }

    private fun konusmaBitti(id: String = "") {
        // WebView yok edildikten sonra evaluateJavascript COKME uretir.
        if (webViewYok || !this::webView.isInitialized) return
        // Kimlik JS'e string olarak gecer; tirnak kacisi sart.
        val g = id.replace("\\", "").replace("'", "").replace("\n", "")
        runOnUiThread {
            if (webViewYok || !this::webView.isInitialized) return@runOnUiThread
            try {
                webView.evaluateJavascript("if(window.ttsBitti)window.ttsBitti('$g');", null)
            } catch (t: Throwable) {}
        }
    }

    override fun onPause() {
        super.onPause()
        // Arka plana gecerken mikrofonu MUTLAKA birak: acik kalirsa hem pil yer
        // hem de kullanici "dinleniyorum" hissi yasar.
        bekciIptal()
        if (dinliyor) {
            dinliyor = false
            taniciYok()
            jsSes("if(window.sesDurum)window.sesDurum('bitti');")
        }
    }

    override fun onResume() {
        super.onResume()
        /* Uygulama one geldiginde reklam denemelerini sifirla: gecici bir ag
           veya WebView sorunu yuzunden "pes edilmis" durumda kalmasin. */
        if (reklamSdkHazir && odulluReklam == null) {
            reklamDeneme = 0
            anaKuyruk.removeCallbacks(reklamTekrarIsi)
            anaKuyruk.postDelayed(reklamTekrarIsi, 800L)
        }
    }

    override fun onDestroy() {
        // Once bayrak: bu andan sonra konusmaBitti() WebView'e dokunmaz.
        webViewYok = true
        try { anaKuyruk.removeCallbacksAndMessages(null) } catch (t: Throwable) {}
        try { tts?.setOnUtteranceProgressListener(null) } catch (t: Throwable) {}
        try { tts?.stop() } catch (t: Throwable) {}
        try { tts?.shutdown() } catch (t: Throwable) {}
        tts = null
        dinliyor = false
        bekciIptal()
        val _t = tanici; tanici = null
        try { _t?.setRecognitionListener(null) } catch (t: Throwable) {}
        try { _t?.cancel() } catch (t: Throwable) {}
        try { _t?.destroy() } catch (t: Throwable) {}
        try { webView.destroy() } catch (t: Throwable) {}
        super.onDestroy()
    }
}