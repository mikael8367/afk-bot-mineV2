package com.mikael.afkbotmine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class BotMonitorService : Service() {
    private val executor = Executors.newSingleThreadScheduledExecutor()
    @Volatile private var stopped = false
    private var offlineChecks = 0
    private val channelId = "active_bots"

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, notification("Verificando conexão com o bot…"))
        executor.scheduleWithFixedDelay({ checkBot() }, 0, 5, TimeUnit.SECONDS)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopMonitor()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    private fun checkBot() {
        if (stopped) return
        var connection: HttpURLConnection? = null
        try {
            connection = (URL("$PANEL_URL/api/status").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
                setRequestProperty("Accept", "application/json")
            }
            if (connection.responseCode !in 200..299) throw IllegalStateException("HTTP ${connection.responseCode}")
            val data = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val state = data.optString("state", "offline")
            val online = data.optBoolean("connected", state == "online")
            val active = online || state == "connecting"
            if (!active && !data.has("config") || (!active && data.isNull("config"))) {
                stopMonitor()
                return
            }
            if (active) {
                offlineChecks = 0
                val label = if (online) "Bot conectado" else "Bot reconectando"
                val server = data.optJSONObject("config")?.let {
                    it.optString("host", "") + ":" + it.optInt("port", 0)
                }?.takeIf { it != ":" } ?: "Servidor Minecraft"
                getSystemService(NotificationManager::class.java)
                    .notify(NOTIFICATION_ID, notification("$label · $server"))
            } else {
                offlineChecks++
                if (offlineChecks >= 12) stopMonitor()
            }
        } catch (_: Exception) {
            // Falhas temporárias de rede não encerram a notificação imediatamente.
            offlineChecks++
            if (offlineChecks >= 12) stopMonitor()
        } finally {
            connection?.disconnect()
        }
    }

    private fun notification(message: String): Notification {
        val openApp = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("AFK Bot Mine V2")
            .setContentText(message)
            .setStyle(Notification.BigTextStyle().bigText("$message\\nO monitoramento continua em segundo plano."))
            .setContentIntent(openApp)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
