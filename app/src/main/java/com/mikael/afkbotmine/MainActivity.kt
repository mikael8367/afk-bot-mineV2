package com.mikael.afkbotmine

import android.app.Activity
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.webkit.*
import android.widget.*
import android.view.View

class MainActivity : Activity() {
    private val host = "afk-bot-mine-v2.onrender.com"
    private val panelUrl = "https://afk-bot-mine-v2.onrender.com/"
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
        browser.settings.allowFileAccess = false
        browser.settings.allowContentAccess = false
        browser.settings.javaScriptCanOpenWindowsAutomatically = false
        browser.settings.setSupportMultipleWindows(false)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, false)
        browser.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return !(uri.scheme == "https" && uri.host == host)
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
                handler.cancel()
                Toast.makeText(this@MainActivity, "Certificado HTTPS inválido. Navegação bloqueada.", Toast.LENGTH_LONG).show()
            }
            override fun onPageFinished(view: WebView, url: String) {
                progress.visibility = View.GONE
                CookieManager.getInstance().flush()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) Toast.makeText(this@MainActivity, "Falha de rede. Verifique a internet e tente novamente.", Toast.LENGTH_LONG).show()
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


    private inner class BotBridge {
        @JavascriptInterface
        fun setBotActive(active: Boolean) {
            runOnUiThread {
                val intent = Intent(this@MainActivity, BotMonitorService::class.java)
                if (active) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent)
                    else startService(intent)
                } else {
                    stopService(intent)
                }
            }
        }
    }

    private fun shape(color: Int, radius: Int): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radius).toFloat()
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (browser.canGoBack()) browser.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        if (::browser.isInitialized) {
            browser.stopLoading()
            browser.loadUrl("about:blank")
            browser.clearHistory()
            browser.removeAllViews()
            browser.destroy()
        }
        super.onDestroy()
    }
}
