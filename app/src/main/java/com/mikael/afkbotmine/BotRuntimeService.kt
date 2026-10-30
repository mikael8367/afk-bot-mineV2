package com.mikael.afkbotmine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Base64
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Owns the bundled Node.js process and the local Minecraft bot engine. */
class BotRuntimeService : Service() {
    private val stopped = AtomicBoolean(false)
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    @Volatile private var nodeProcess: Process? = null
    private var processThread: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val channelId = "local_bot_runtime"

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Preparando o motor local…"))
        acquireWakeLock()
        scheduler.scheduleAtFixedRate({
            acquireWakeLock()
            refreshNotification()
        }, 4, 5, TimeUnit.SECONDS)
        processThread = Thread({ superviseNode() }, "AFKBot-NodeSupervisor").apply {
            isDaemon = true
            start()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_BOT -> scheduler.execute {
                try {
                    localRequest("POST", "/api/disconnect", "{}")
                    updateNotification("Motor local ativo · bot parado")
                } catch (_: Exception) {
                    updateNotification("Não foi possível parar o bot. Verifique o motor local.")
                }
            }
            ACTION_STOP_RUNTIME -> {
                stopSelf()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    private fun superviseNode() {
        try {
            if (Build.VERSION.SDK_INT < 24) {
                updateNotification("O Node.js incluído exige Android 7 ou superior (API 24).")
                stopSelf()
                return
            }
            if (!Build.SUPPORTED_ABIS.any { it == "arm64-v8a" }) {
                updateNotification("Este aparelho não oferece suporte ao runtime ARM64 incluído.")
                stopSelf()
                return
            }

            val node = File(applicationInfo.nativeLibraryDir, "libnode.so")
            if (!node.isFile || !node.canExecute()) {
                updateNotification("Runtime Node.js ausente neste pacote. É necessário um APK preparado.")
                stopSelf()
                return
            }

            val serverDir = File(filesDir, "local-server")
            prepareServerAssets(serverDir)
            val token = getOrCreateToken(this)
            var retryDelay = 3000L

            while (!stopped.get()) {
                try {
                    updateNotification("Iniciando o motor Node.js no dispositivo…")
                    val builder = ProcessBuilder(node.absolutePath, "src/server.js")
                        .directory(serverDir)
                        .redirectErrorStream(true)
                    val env = builder.environment()
                    env["HOST"] = LOOPBACK_HOST
                    env["PORT"] = LOCAL_PORT.toString()
                    env["LOCAL_API_TOKEN"] = token
                    env["AUTO_RECONNECT"] = "true"
                    env["BEDROCK_RAKNET_BACKEND"] = "jsp-raknet"
                    env["HOME"] = filesDir.absolutePath
                    env["TMPDIR"] = cacheDir.absolutePath
                    val currentLibraryPath = env["LD_LIBRARY_PATH"].orEmpty()
                    env["LD_LIBRARY_PATH"] = applicationInfo.nativeLibraryDir +
                        if (currentLibraryPath.isBlank()) "" else ":$currentLibraryPath"

                    val process = builder.start()
                    nodeProcess = process
                    updateNotification("Motor local iniciado · aguardando API")
                    val reader = Thread({ readProcessOutput(process) }, "AFKBot-NodeLogs").apply {
                        isDaemon = true
                        start()
                    }
                    val exitCode = process.waitFor()
                    nodeProcess = null
                    reader.join(1200)
                    if (!stopped.get()) {
                        updateNotification("Motor local encerrou (código $exitCode). Tentando reiniciar…")
                        Thread.sleep(retryDelay)
                        retryDelay = (retryDelay * 2).coerceAtMost(30000L)
                    }
                } catch (interrupted: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                } catch (error: Exception) {
                    nodeProcess = null
                    updateNotification("Falha ao iniciar Node.js: ${error.message ?: "erro desconhecido"}")
                    try {
                        Thread.sleep(retryDelay)
                    } catch (_: InterruptedException) {
                        Thread.currentThread().interrupt()
                        break
                    }
                    retryDelay = (retryDelay * 2).coerceAtMost(30000L)
                }
            }
        } catch (error: Exception) {
            updateNotification("Erro ao preparar motor local: ${error.message ?: "erro desconhecido"}")
        }
    }

    private fun prepareServerAssets(target: File) {
        val marker = File(target, ".bundle-version")
        val expectedVersion = BUNDLE_VERSION
        if (marker.isFile && marker.readText() == expectedVersion &&
            File(target, "src/server.js").isFile && File(target, "node_modules").isDirectory) return

        target.deleteRecursively()
        if (!target.mkdirs() && !target.isDirectory) throw IllegalStateException("Não foi possível criar a pasta do motor.")
        copyAssetTree("local-server", target)
        if (!File(target, "src/server.js").isFile || !File(target, "node_modules").isDirectory) {
            throw IllegalStateException("O pacote não contém o servidor e suas dependências.")
        }
        marker.writeText(expectedVersion)
    }

    private fun copyAssetTree(assetPath: String, destination: File) {
        destination.parentFile?.let {
            if (!it.exists() && !it.mkdirs()) throw IllegalStateException("Falha ao criar pasta de assets.")
        }
        // Try opening as a file first; directories (including empty ones) cannot be opened.
        val input = try { assets.open(assetPath) } catch (_: Exception) { null }
        if (input != null) {
            input.use { source ->
                destination.outputStream().use { output -> source.copyTo(output) }
            }
            return
        }
        val children = assets.list(assetPath)
            ?: throw IllegalStateException("Asset não encontrado: " + assetPath)
        if (!destination.exists() && !destination.mkdirs()) {
            throw IllegalStateException("Não foi possível criar " + destination.name + ".")
        }
        for (child in children) copyAssetTree(assetPath + "/" + child, File(destination, child))
    }

    private fun readProcessOutput(process: Process) {
        try {
            BufferedReader(InputStreamReader(process.inputStream)).use { reader ->
                while (!stopped.get()) {
                    val line = reader.readLine() ?: break
                    appendRuntimeLog(line)
                }
            }
        } catch (_: Exception) {
            // Process shutdown closes the stream.
        }
    }

    private fun appendRuntimeLog(line: String) {
        try {
            val log = File(filesDir, "local-runtime.log")
            if (log.length() > MAX_LOG_BYTES) {
                val old = log.readLines().takeLast(500)
                log.writeText(old.joinToString("\n") + "\n")
            }
            log.appendText(line.take(1000) + "\n")
        } catch (_: Exception) {
            // Logging must never crash the bot process.
        }
    }

    private fun refreshNotification() {
        if (stopped.get()) return
        if (nodeProcess?.isAlive != true) {
            updateNotification("Motor local iniciando ou reiniciando…")
            return
        }
        try {
            val (_, raw) = localRequest("GET", "/api/status")
            val data = JSONObject(raw)
            val state = data.optString("state", "offline")
            val config = data.optJSONObject("config")
            val server = config?.let {
                val host = it.optString("host", "")
                val port = it.optInt("port", 0)
                if (host.isNotBlank()) "$host:$port" else "Servidor Minecraft"
            } ?: "Servidor Minecraft"
            val message = when (state) {
                "online" -> "Bot conectado · $server"
                "connecting" -> "Bot conectando · $server"
                "error" -> "Bot com erro · confira os logs"
                else -> if (config != null) "Bot desconectado · reconexão pendente" else "Motor local pronto · nenhum bot ativo"
            }
            updateNotification(message)
        } catch (_: Exception) {
            updateNotification("Motor local ativo · aguardando API")
        }
    }

    private fun localRequest(method: String, path: String, body: String = ""): Pair<Int, String> {
        val connection = URL("http://$LOOPBACK_HOST:$LOCAL_PORT$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 2500
            connection.readTimeout = 3500
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("X-Local-Token", getOrCreateToken(this))
            if (method == "POST") {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() } ?: ""
            return code to raw
        } finally {
            connection.disconnect()
        }
    }

    private fun acquireWakeLock() {
        try {
            val manager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (wakeLock == null) wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AFKBotMine:LocalRuntime")
            if (wakeLock?.isHeld != true) wakeLock?.acquire(WAKELOCK_RENEW_MS)
        } catch (_: Exception) {
            // The foreground service remains active even if a wake lock is denied.
        }
    }

    private fun updateNotification(message: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(message))
    }

    private fun buildNotification(message: String): Notification {
        val openApp = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopBot = PendingIntent.getService(
            this, 1, Intent(this, BotRuntimeService::class.java).setAction(ACTION_STOP_BOT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, channelId)
        else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("AFK Bot Mine · Dispositivo")
            .setContentText(message)
            .setStyle(Notification.BigTextStyle().bigText("$message\nO motor está executando no Android."))
            .setContentIntent(openApp)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_pause, "Parar bot", stopBot)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "Motor local e bots", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Estado do motor Node.js e do bot Minecraft executado neste aparelho."
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        stopped.set(true)
        scheduler.shutdownNow()
        try {
            nodeProcess?.destroy()
            if (nodeProcess?.isAlive == true) {
                val process = nodeProcess
                Thread {
                    try {
                        Thread.sleep(2500)
                        if (process?.isAlive == true) process.destroyForcibly()
                    } catch (_: Exception) {}
                }.start()
            }
        } catch (_: Exception) {}
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {}
        try { stopForeground(true) } catch (_: Exception) {}
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP_BOT = "com.mikael.afkbotmine.STOP_LOCAL_BOT"
        const val ACTION_STOP_RUNTIME = "com.mikael.afkbotmine.STOP_LOCAL_RUNTIME"
        const val LOCAL_PORT = 39391
        private const val LOOPBACK_HOST = "127.0.0.1"
        private const val NOTIFICATION_ID = 26062
        private const val BUNDLE_VERSION = "1.1.0"
        private const val PREFS = "afk_bot_runtime"
        private const val TOKEN_KEY = "local_api_token"
        private const val MAX_LOG_BYTES = 1024L * 1024L
        private const val WAKELOCK_RENEW_MS = 10 * 60 * 1000L

        fun getOrCreateToken(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            prefs.getString(TOKEN_KEY, null)?.let { return it }
            val bytes = ByteArray(32)
            SecureRandom().nextBytes(bytes)
            val token = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            prefs.edit().putString(TOKEN_KEY, token).commit()
            return token
        }
    }
}
