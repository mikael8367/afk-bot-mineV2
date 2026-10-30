plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.mikael.afkbotmine"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.mikael.afkbotmine"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "1.1.1"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging {
        jniLibs {
            useLegacyPackaging = true
            keepDebugSymbols += "**/libnode.so"
        }
    }
}
