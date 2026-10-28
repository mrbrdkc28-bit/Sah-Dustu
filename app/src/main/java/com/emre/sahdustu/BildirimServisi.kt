package com.emre.sahdustu

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/* Uzak oyun istegi bildirimi (Ekim 2026).
   Uygulama kapali/arka plandayken sunucu (functions/index.js) "notification" yukuyle gonderir; sistem bildirimi
   kendisi gosterir (kanal ve simge AndroidManifest'teki meta-data'dan). Dokununca uygulama acilir ve
   oyun bekleyen daveti kendisi bulur (davetler dinleyicisi).
   Uygulama acikken gelen ileti burada sessizce yutulur: davet penceresi zaten oyunun icinde cikiyor.
   Yeni adres (onNewToken) oyun bir sonraki acilista FirebaseMessaging.token ile yeniden alip yazar. */
class BildirimServisi : FirebaseMessagingService() {
    override fun onMessageReceived(ileti: RemoteMessage) {}
    override fun onNewToken(jeton: String) {}
}
