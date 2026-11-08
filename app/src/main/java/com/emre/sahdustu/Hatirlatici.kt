package com.emre.sahdustu

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/* Bildirim kanallari ve gunluk hatirlatma (Kasim 2026, sahibin istegi).
   Kanal sesi Android'de kanal olusturulduktan sonra degistirilemez; bu yuzden sesli kanallar yeni adla acildi.
   Hatirlatma her gun 13:00-13:30 arasinda gelir; o gun oyun oynandiysa gosterilmez. Sunucu gerektirmez. */
object Hatirlatici {
    const val KANAL_DAVET = "davet_ses"
    const val KANAL_HATIRLATMA = "hatirlatma"
    const val KANAL_CEVRIMICI = "cevrimici"
    private const val PREF = "c64_bildirim"
    private const val ANAHTAR_ACIK = "hatirlatma_acik"
    private const val ANAHTAR_SON_GUN = "son_oyun_gun"
    private const val BILDIRIM_ID = 6401
    private const val SAAT = 13

    private fun bugun() = SimpleDateFormat("yyyyMMdd", Locale.ROOT).format(Date())
    private fun tercih(c: Context) = c.getSharedPreferences(PREF, Context.MODE_PRIVATE)

    fun acikMi(c: Context) = tercih(c).getBoolean(ANAHTAR_ACIK, true)
    fun ayarla(c: Context, acik: Boolean) {
        tercih(c).edit().putBoolean(ANAHTAR_ACIK, acik).apply()
        if (acik) planla(c) else alarmAyarla(c, null)
    }
    fun oynandi(c: Context) { tercih(c).edit().putString(ANAHTAR_SON_GUN, bugun()).apply() }
    fun bugunOynandiMi(c: Context) = tercih(c).getString(ANAHTAR_SON_GUN, "") == bugun()

    private fun sesUri(c: Context, ad: String): Uri =
        Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + c.packageName + "/raw/" + ad)

    fun kanallariKur(c: Context) {
        val m = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val ses = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        fun kur(id: String, ad: Int, aciklama: Int, onem: Int, dosya: String) {
            m.createNotificationChannel(NotificationChannel(id, c.getString(ad), onem).apply {
                description = c.getString(aciklama)
                setSound(sesUri(c, dosya), ses)
            })
        }
        kur(KANAL_DAVET, R.string.davet_kanal_ad, R.string.davet_kanal_aciklama, NotificationManager.IMPORTANCE_HIGH, "ses_davet")
        kur(KANAL_HATIRLATMA, R.string.hatirlatma_kanal_ad, R.string.hatirlatma_kanal_aciklama, NotificationManager.IMPORTANCE_DEFAULT, "ses_genel")
        kur(KANAL_CEVRIMICI, R.string.cevrimici_kanal_ad, R.string.cevrimici_kanal_aciklama, NotificationManager.IMPORTANCE_DEFAULT, "ses_genel")
        try { m.deleteNotificationChannel("davet") } catch (t: Throwable) {}   // eski sessiz kanal
    }

    private fun niyet(c: Context): PendingIntent = PendingIntent.getBroadcast(
        c, BILDIRIM_ID, Intent(c, HatirlatmaAlici::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun alarmAyarla(c: Context, zaman: Long?) {
        val a = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        a.cancel(niyet(c))
        // setWindow tam zamanli alarm izni istemez; pil icin yarim saatlik pencere yeterli
        if (zaman != null) a.setWindow(AlarmManager.RTC_WAKEUP, zaman, 30 * 60 * 1000L, niyet(c))
    }

    fun planla(c: Context) {
        if (!acikMi(c)) return
        val t = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, SAAT); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
        alarmAyarla(c, t.timeInMillis)
    }

    private val METIN = mapOf(
        "tr" to listOf("Tahta seni bekliyor" to "Bugün bir oyun oynamaya ne dersin?",
                       "Günün bulmacası hazır" to "Bakalım bugünkü taktiği bulabilecek misin?",
                       "Puanını yükseltme zamanı" to "Çevrimiçi bir maç yap, sıralamada yüksel."),
        "en" to listOf("The board is waiting" to "How about a game today?",
                       "Today's puzzle is ready" to "Can you find today's tactic?",
                       "Time to climb" to "Play an online game and raise your rating."),
        "ru" to listOf("Доска ждёт вас" to "Как насчёт партии сегодня?"),
        "ar" to listOf("الرقعة بانتظارك" to "ما رأيك في مباراة اليوم؟"),
        "fr" to listOf("L'échiquier vous attend" to "Et si vous faisiez une partie aujourd'hui ?"),
        "de" to listOf("Das Brett wartet" to "Wie wäre es heute mit einer Partie?"),
        "it" to listOf("La scacchiera ti aspetta" to "Che ne dici di una partita oggi?"),
        "zh" to listOf("棋盘在等你" to "今天来下一局吧？"))

    fun goster(c: Context) {
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return
        val l = METIN[Locale.getDefault().language] ?: METIN.getValue("en")
        val (baslik, govde) = l[Calendar.getInstance().get(Calendar.DAY_OF_YEAR) % l.size]
        val ac = PendingIntent.getActivity(c, BILDIRIM_ID,
            Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val b = NotificationCompat.Builder(c, KANAL_HATIRLATMA)
            .setSmallIcon(R.drawable.ic_bildirim).setContentTitle(baslik).setContentText(govde)
            .setAutoCancel(true).setContentIntent(ac).build()
        try { NotificationManagerCompat.from(c).notify(BILDIRIM_ID, b) } catch (t: SecurityException) {}
    }
}

class HatirlatmaAlici : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        Hatirlatici.kanallariKur(c)
        if (Hatirlatici.acikMi(c) && !Hatirlatici.bugunOynandiMi(c)) Hatirlatici.goster(c)
        Hatirlatici.planla(c)
    }
}

/* Telefon yeniden baslayinca ya da uygulama guncellenince alarmlar silinir; yeniden kurulur. */
class AcilisAlici : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (i.action == Intent.ACTION_BOOT_COMPLETED || i.action == Intent.ACTION_MY_PACKAGE_REPLACED) Hatirlatici.planla(c)
    }
}
