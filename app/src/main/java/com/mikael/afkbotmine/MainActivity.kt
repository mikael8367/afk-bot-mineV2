package com.mikael.afkbotmine

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.*
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.view.Gravity
import android.view.View
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val panelUrl = "file:///android_asset/panel/index.html"
    private val bridgeExecutor = Executors.newCachedThreadPool()
    @Volatile private var trustedPanelLoaded = false
    private lateinit var root: LinearLayout
    private lateinit var progress: ProgressBar
    private lateinit var browser: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(8, 17, 12)
        window.navigationBarColor = Color.rgb(8, 17, 12)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 26061)
        }
        if (runtimePreferences().getString(KEY_MODE, MODE_RENDER) == MODE_DEVICE) {
            BotRuntimeService.getOrCreateToken(this)
            startRuntimeService()
        }
        showPanel()
    }

    private fun showPanel() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(8, 17, 12))
        }
        val bar = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), 0, dp(12), 0)
            setBackgroundColor(Color.rgb(11, 25, 15))
        }
        val title = TextView(this).apply {
            text = "AFK BOT MINE  ·  V2"
            textSize = 13f
            setTextColor(Color.rgb(221, 255, 229))
            typeface = Typeface.DEFAULT_BOLD
        }
        bar.addView(title, LinearLayout.LayoutParams(0, dp(54), 1f))
        val reload = TextView(this).apply {
            text = "↻"
            textSize = 22f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(220, 255, 228))
            background = shape(Color.rgb(25, 49, 32), 12)
            isClickable = true
            isFocusable = true
        }
        bar.addView(reload, LinearLayout.LayoutParams(dp(44), dp(40)))
        root.addView(bar)

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(Color.rgb(103, 241, 145))
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(24, 44, 29))
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(3)))

        browser = WebView(this)
        browser.setBackgroundColor(Color.rgb(8, 17, 12))
        browser.settings.javaScriptEnabled = true
        browser.addJavascriptInterface(BotBridge(), "AndroidBotBridge")
        browser.settings.domStorageEnabled = true
        browser.settings.databaseEnabled = true
        browser.settings.loadsImagesAutomatically = true
        browser.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        // Only the packaged, read-only UI is loaded as a file URL. File-to-file access remains disabled.
        browser.settings.allowFileAccess = true
        browser.settings.allowFileAccessFromFileURLs = false
        browser.settings.allowUniversalAccessFromFileURLs = false
        browser.settings.allowContentAccess = false
        browser.settings.javaScriptCanOpenWindowsAutomatically = false
        browser.settings.setSupportMultipleWindows(false)
        browser.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return !isTrustedUrl(request.url.toString())
            }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                trustedPanelLoaded = isTrustedUrl(url)
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
                handler.cancel()
                Toast.makeText(this@MainActivity, "Certificado HTTPS inválido. Navegação bloqueada.", Toast.LENGTH_LONG).show()
            }
            override fun onPageFinished(view: WebView, url: String) {
                progress.visibility = View.GONE
                trustedPanelLoaded = isTrustedUrl(url)
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) Toast.makeText(this@MainActivity, "Não foi possível abrir a interface incluída no aplicativo.", Toast.LENGTH_LONG).show()
            }
        }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                progress.progress = newProgress
            }
        }
        root.addView(browser, LinearLayout.LayoutParams(-1, 0, 1f))
        reload.setOnClickListener { browser.reload() }
        setContentView(root)
        browser.loadUrl(panelUrl)
    }

    private fun isTrustedUrl(value: String): Boolean {
        return value == panelUrl || value.startsWith("file:///android_asset/panel/")
    }

    private fun runtimePreferences() = getSharedPreferences("afk_bot_runtime_mode", MODE_PRIVATE)

    private fun startRuntimeService() {
        val intent = Intent(this, BotRuntimeService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }

    private fun deliverApiResponse(callbackId: String, code: Int, responseBody: String) {
        val script = "window.__resolveLocalApi && window.__resolveLocalApi(" +
            JSONObject.quote(callbackId) + ",$code," + JSONObject.quote(responseBody) + ")"
        runOnUiThread {
            if (::browser.isInitialized && !isFinishing) browser.evaluateJavascript(script, null)
        }
    }

    private fun performApiRequest(path: String, method: String, body: String, callbackId: String, local: Boolean) {
        if (!trustedPanelLoaded || !ALLOWED_API_PATHS.contains(path) ||
            (method != "GET" && method != "POST") ||
            callbackId.length !in 1..64 ||
            !callbackId.matches(Regex("^[A-Za-z0-9_-]+$")) ||
            body.length > 10000
        ) return

        val token = if (local) BotRuntimeService.getOrCreateToken(this) else null
        bridgeExecutor.execute {
            var code = 503
            var responseBody = """{"error":"Serviço indisponível."}"""
            var connection: HttpURLConnection? = null
            try {
                val base = if (local) "http://127.0.0.1:${BotRuntimeService.LOCAL_PORT}" else REMOTE_API_BASE
                connection = (URL("$base$path").openConnection() as HttpURLConnection).apply {
                    requestMethod = method
                    connectTimeout = if (local) 3500 else 10000
                    readTimeout = if (local) 5000 else 15000
                    setRequestProperty("Accept", "application/json")
                    if (token != null) setRequestProperty("X-Local-Token", token)
                    if (method == "POST") {
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                    }
                }
                if (method == "POST") connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                code = connection.responseCode
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                responseBody = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
            } catch (error: Exception) {
                responseBody = JSONObject().put("error", error.message ?: "Não foi possível acessar o serviço.").toString()
            } finally {
                connection?.disconnect()
            }
            deliverApiResponse(callbackId, code, responseBody)
        }
    }

    private inner class BotBridge {
        @JavascriptInterface
        fun getRuntimeMode(): String = runtimePreferences().getString(KEY_MODE, MODE_RENDER) ?: MODE_RENDER

        @JavascriptInterface
        fun setRuntimeMode(mode: String): String {
            if (!trustedPanelLoaded) return "error:Painel não verificado."
            if (mode != MODE_RENDER && mode != MODE_DEVICE) return "error:Modo inválido."
            runtimePreferences().edit().putString(KEY_MODE, mode).commit()
            return try {
                if (mode == MODE_DEVICE) {
                    BotRuntimeService.getOrCreateToken(this@MainActivity)
                    stopService(Intent(this@MainActivity, BotMonitorService::class.java))
                    startRuntimeService()
                } else {
                    stopService(Intent(this@MainActivity, BotRuntimeService::class.java))
                }
                "ok"
            } catch (error: Exception) {
                runtimePreferences().edit().putString(KEY_MODE, MODE_RENDER).commit()
                "error:${error.message ?: "Não foi possível alterar o modo."}"
            }
        }

        @JavascriptInterface
        fun setBotActive(active: Boolean, mode: String) {
            if (!trustedPanelLoaded || mode != MODE_RENDER || !active) return
            runOnUiThread {
                val intent = Intent(this@MainActivity, BotMonitorService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
            }
        }

        @JavascriptInterface
        fun requestLocalApi(path: String, method: String, body: String, callbackId: String) {
            performApiRequest(path, method, body, callbackId, true)
        }

        @JavascriptInterface
        fun requestRenderApi(path: String, method: String, body: String, callbackId: String) {
            performApiRequest(path, method, body, callbackId, false)
        }
    }

    private fun shape(color: Int, radius: Int): GradientDrawable =
        GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (::browser.isInitialized && browser.canGoBack()) browser.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        trustedPanelLoaded = false
        bridgeExecutor.shutdownNow()
        if (::browser.isInitialized) {
            browser.stopLoading()
            browser.loadUrl("about:blank")
            browser.clearHistory()
            browser.removeAllViews()
            browser.destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val KEY_MODE = "execution_mode"
        private const val MODE_RENDER = "render"
        private const val MODE_DEVICE = "device"
        private const val REMOTE_API_BASE = "https://afk-bot-mine-v2.onrender.com"
        private val ALLOWED_API_PATHS = setOf(
            "/health", "/api/versions", "/api/status", "/api/logs", "/api/connect",
            "/api/options", "/api/control", "/api/chat", "/api/follow", "/api/disconnect"
        )
    }
}
