import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

// Keystore bilgileri kok dizindeki keystore.properties dosyasindan okunur.
// Bu dosyayi ASLA git'e ekleme (sifre icerir).
// Dosya YOKSA imza yapilandirmasi olusturulmaz; build normal calisir (debug key ile).
val keystoreFile = rootProject.file("keystore.properties")
val keystoreVar = keystoreFile.exists()
val keystoreProps = Properties()
if (keystoreVar) {
    FileInputStream(keystoreFile).use { keystoreProps.load(it) }
}

android {
    namespace = "com.emre.sahdustu"
    // Android 16. Google Play, 31 Agustos 2026'dan itibaren yeni uygulama ve
    // guncellemelerde API 36 hedefi istiyor.
    compileSdk = 36

    defaultConfig {
        applicationId = "com.emre.sahdustu"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "1.5"
    }

    signingConfigs {
        if (keystoreVar) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Sadece keystore varsa imzala. Yoksa Android Studio debug key kullanir.
            if (keystoreVar) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    // BuildConfig.DEBUG kullanilabilsin (AGP 8'de varsayilan olarak kapali).
    // Reklam birimi bu bayrakla secilir: debug -> test reklami, release -> gercek.
    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    /* REKLAM SDK'SI: 23.6.0 -> 24.0.0
       SEBEP: cihazda "Unable to obtain a JavascriptEngine" (kod 0) hatasi test
       reklamlarinda bile aliniyordu; 23.6.0 (Aralik 2024) cihazin WebView 151
       surumuyle kendi motorunu kuramiyor. 24.0.0 "optimize initialization and
       ad loading"i VARSAYILAN yapiyor — SDK'nin baslatma ve WebView olusturma
       yolu tam takildigimiz yerde yeniden yazildi.

       NEDEN 25.4.0 DEGIL — OLCULDU (derleyici hatalarindan):
         ads 23.6.0 -> Kotlin 1.9 metadata
         ads 24.0.0 -> Kotlin 2.1 metadata
         ads 25.4.0 -> Kotlin 2.3 metadata
       Bu projede Kotlin 2.1.21 var (Gradle 8.7 + AGP 8.5.2 ile uyumlulugu
       dogrulandi). 25.4.0 icin Kotlin 2.3'e cikmak, ardindan buyuk olasilikla
       Gradle ve AGP'yi de oynatmak gerekirdi. 24.0.0 aradigimiz duzeltmeyi
       zaten iceriyor; zinciri daha fazla germenin karsiligi yok.

       API UYUMU: MobileAds.initialize, RewardedAd.load, AdRequest.Builder,
       RewardedAdLoadCallback, FullScreenContentCallback 24.0.0'da DEGISMEDI.
       Kaldirilanlar (interscroller, SearchAdView, AppOpenAd yon metotlari)
       bu projede kullanilmiyor. minSdk 23 istiyor -> projede 26. */
    implementation("com.google.android.gms:play-services-ads:24.0.0")
    // Google Play Faturalandırma: tek seferlik Premium (4 Ekim 2026)
    implementation("com.android.billingclient:billing-ktx:8.0.0")
    // Reklam onay penceresi (AEA/Ingiltere icin Google sarti).
    implementation("com.google.android.ump:user-messaging-platform:3.1.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")

    // Firebase (giris + istatistik). BoM surumleri yonetir.
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
}
