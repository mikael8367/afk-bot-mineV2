package com.mikael.afkbotmine

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.view.Gravity
import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.webkit.*
import android.widget.*
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MainActivity : Activity() {
    private val host = "afk-bot-mine-v2.onrender.com"
    private lateinit var root: LinearLayout
    private var web: WebView? = null
    private var progress: ProgressBar? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(8, 17, 12)
        window.navigationBarColor = Color.rgb(8, 17, 12)
        window.decorView.systemUiVisibility = 0
        val saved = SecureLinkStore.read(this)
        if (saved != null && validLink(saved)) showPanel(saved) else showSetup()
    }

    private fun validLink(value: String): Boolean {
        return try {
            val uri = Uri.parse(value)
            uri.scheme == "https" && uri.host == host &&
                uri.pathSegments.size == 2 && uri.pathSegments[0] == "access" &&
                uri.pathSegments[1].matches(Regex("[A-Za-z0-9_-]{20,160}")) &&
                uri.query == null && uri.fragment == null
        } catch (_: Exception) { false }
    }

    private fun baseScreen(): LinearLayout {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(16))
            setBackgroundColor(Color.rgb(8, 17, 12))
        }
        return root
    }

    private fun showSetup(message: String? = null) {
        web?.destroy()
        web = null
        baseScreen()
        val spacer = View(this)
        root.addView(spacer, LinearLayout.LayoutParams(1, 0, 1f))
        val logo = text("A", 28, Color.rgb(8, 30, 17), true).apply {
            gravity = Gravity.CENTER
            background = shape(Color.rgb(108, 244, 151), 20)
        }
        root.addView(logo, LinearLayout.LayoutParams(dp(64), dp(64)).apply { gravity = Gravity.CENTER })
        root.addView(text("AFK BOT MINE", 23, Color.WHITE, true).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(20), 0, dp(3))
        })
        root.addView(text("CONTROL CENTER · V2", 11, Color.rgb(117, 194, 139), true).apply {
            gravity = Gravity.CENTER
        })
        root.addView(text("Conecte seu painel privado", 19, Color.WHITE, true).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(34), 0, dp(8))
        })
        root.addView(text("Cole o link privado de acesso do Render. Ele será salvo criptografado neste aparelho.", 13, Color.rgb(166, 187, 171), false).apply {
            gravity = Gravity.CENTER
        })
        val field = EditText(this).apply {
            hint = "https://afk-bot-mine-v2.onrender.com/access/..."
            setHintTextColor(Color.rgb(104, 130, 111))
            setTextColor(Color.WHITE)
            textSize = 12f
            singleLine = true
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_DONE
            setPadding(dp(14), dp(13), dp(14), dp(13))
            background = shape(Color.rgb(19, 35, 24), 14, Color.rgb(49, 78, 55))
        }
        root.addView(field, LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(22) })
        if (message != null) root.addView(text(message, 12, Color.rgb(255, 155, 130), false))
        val save = button("ABRIR MEU PAINEL")
        root.addView(save, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(12) })
        save.setOnClickListener {
            val link = field.text.toString().trim()
            if (!validLink(link)) {
                Toast.makeText(this, "Link inválido. Use o link privado /access/ do Render.", Toast.LENGTH_LONG).show()
            } else {
                try {
                    SecureLinkStore.save(this, link)
                    showPanel(link)
                } catch (e: Exception) {
                    Toast.makeText(this, "Não foi possível proteger o link neste aparelho.", Toast.LENGTH_LONG).show()
                }
            }
        }
        root.addView(text("O link dá acesso de controle ao seu bot. Não compartilhe com outras pessoas.", 11, Color.rgb(135, 157, 140), false).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, 0)
        })
        val bottom = View(this)
        root.addView(bottom, LinearLayout.LayoutParams(1, 0, 1f))
        setContentView(root)
    }

    private fun showPanel(url: String) {
        baseScreen()
        root.setPadding(0, 0, 0, 0)
        val bar = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), 0, dp(10), 0)
            background = shape(Color.rgb(11, 25, 15), 0)
        }
        val brand = text("AFK BOT MINE  ·  V2", 13, Color.rgb(221, 255, 229), true)
        bar.addView(brand, LinearLayout.LayoutParams(0, dp(52), 1f))
        val reload = smallButton("↻")
        bar.addView(reload, LinearLayout.LayoutParams(dp(42), dp(40)))
        val change = smallButton("LINK")
        bar.addView(change, LinearLayout.LayoutParams(dp(58), dp(40)).apply { leftMargin = dp(6) })
        root.addView(bar)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(Color.rgb(103, 241, 145))
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(24, 44, 29))
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(3)))
        val browser = WebView(this)
        web = browser
        browser.setBackgroundColor(Color.rgb(8, 17, 12))
        browser.settings.javaScriptEnabled = true
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
                progress?.visibility = View.GONE
                CookieManager.getInstance().flush()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) Toast.makeText(this@MainActivity, "Falha de rede. Verifique a internet e tente novamente.", Toast.LENGTH_LONG).show()
            }
        }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress?.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                progress?.progress = newProgress
            }
        }
        root.addView(browser, LinearLayout.LayoutParams(-1, 0, 1f))
        reload.setOnClickListener { browser.reload() }
        change.setOnClickListener {
            SecureLinkStore.clear(this)
            browser.stopLoading()
            browser.destroy()
            web = null
            showSetup()
        }
        setContentView(root)
        browser.loadUrl(url)
    }

    private fun text(value: String, size: Int, color: Int, bold: Boolean): TextView =
        TextView(this).apply {
            text = value
            textSize = size.toFloat()
            setTextColor(color)
            typeface = if (bold) Typeface.create("sans-serif", Typeface.BOLD) else Typeface.create("sans-serif", Typeface.NORMAL)
        }

    private fun button(value: String): Button = Button(this).apply {
        text = value
        textSize = 12f
        setTextColor(Color.rgb(5, 28, 13))
        typeface = Typeface.DEFAULT_BOLD
        background = shape(Color.rgb(108, 244, 151), 14)
        isAllCaps = false
        stateListAnimator = null
    }

    private fun smallButton(value: String): TextView = text(value, 12, Color.rgb(220, 255, 228), true).apply {
        gravity = Gravity.CENTER
        background = shape(Color.rgb(25, 49, 32), 12, Color.rgb(57, 91, 63))
        isClickable = true
        isFocusable = true
    }

    private fun shape(color: Int, radius: Int, stroke: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radius).toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onBackPressed() {
        val browser = web
        if (browser != null && browser.canGoBack()) browser.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        web?.apply { stopLoading(); loadUrl("about:blank"); clearHistory(); removeAllViews(); destroy() }
        web = null
        super.onDestroy()
    }
}

private object SecureLinkStore {
    private const val PREFS = "afk_secure_link"
    private const val KEY_ALIAS = "afk_bot_link_key"
    private const val CIPHER = "AES/GCM/NoPadding"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance("AES", "AndroidKeyStore")
        val spec = android.security.keystore.KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    fun save(context: Context, value: String) {
        val cipher = Cipher.getInstance(CIPHER)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("value", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply()
    }

    fun read(context: Context): String? {
        return try {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val iv = Base64.decode(prefs.getString("iv", null) ?: return null, Base64.NO_WRAP)
            val value = Base64.decode(prefs.getString("value", null) ?: return null, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(CIPHER)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(value), Charsets.UTF_8)
        } catch (_: Exception) {
            clear(context)
            null
        }
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
