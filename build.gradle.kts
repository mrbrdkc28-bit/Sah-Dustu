/* KOTLIN 2.1.21 — ZORUNLU, tercih degil.
   Olculdu: play-services-ads'in 24.0.0 ve 25.4.0 surumlerinin IKISI de
   Kotlin 2.1 ile derlenmis moduller paketliyor (protobuf-kotlin,
   filecompliance). Derleyici hatasi birebir soyle:
     "play-services-ads-24.0.0-api.jar!/META-INF/...kotlin_module
      metadata is 2.1.0, expected version is 1.9.0"
   Yani reklam SDK'sini 23.6.0'dan ILERI tasimanin bedeli Kotlin 2.1.
   23.6.0'da kalmak da secenek degil: cihazda reklam hic yuklenmiyor.

   SURUM ZINCIRI (kotlinlang.org uyumluluk tablosundan):
     KGP 2.1.21 -> Gradle 7.6.3-8.12.1 · AGP 7.3.1-8.7.2
     bu proje   -> Gradle 8.7          · AGP 8.5.2        ikisi de araliktaki
   Gradle ve AGP'ye DOKUNULMADI. */
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.1.21" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
}
