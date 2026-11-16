import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firma de publicación (A-09): sale de android/key.properties, que nunca se versiona, igual que la
// clave. El manual de despliegue explica cómo crearlas.
val archivoFirma = rootProject.file("key.properties")
val firma = Properties().apply {
    if (archivoFirma.exists()) archivoFirma.inputStream().use { load(it) }
}

// Un release nunca se firma con la clave de depuración, que es pública. Solo para probar en local
// se permite con la propiedad -PpermitirFirmaDebug=true, que Flutter pasa a Gradle:
// `flutter run --release -PpermitirFirmaDebug=true`.
val permitirFirmaDebug =
    providers.gradleProperty("permitirFirmaDebug").map { it == "true" }.getOrElse(false)

android {
    namespace = "cl.superapaes.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "cl.superapaes.app"
        // Android 8 (API 26) o superior.
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (archivoFirma.exists()) {
            create("publicacion") {
                storeFile = rootProject.file(firma.getProperty("storeFile"))
                storePassword = firma.getProperty("storePassword")
                keyAlias = firma.getProperty("keyAlias")
                keyPassword = firma.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Con key.properties, la firma de publicación. Sin ella, la de depuración solo si se
            // pidió con permitirFirmaDebug; si no, exigirFirmaPublicacion detiene la compilación.
            signingConfig = when {
                archivoFirma.exists() -> signingConfigs.getByName("publicacion")
                permitirFirmaDebug -> signingConfigs.getByName("debug")
                else -> null
            }
        }
    }
}

// Corre antes de cualquier compilación release (apk o appbundle). Las de depuración no la usan.
val hayFirmaPublicacion = archivoFirma.exists()
val exigirFirmaPublicacion = tasks.register("exigirFirmaPublicacion") {
    doLast {
        if (!hayFirmaPublicacion && !permitirFirmaDebug) {
            throw GradleException(
                "Falta android/key.properties: un release no se firma con la clave de depuración. " +
                    "Crea la firma de publicación como explica el manual de despliegue o, solo para " +
                    "probar en este computador, agrega -PpermitirFirmaDebug=true " +
                    "(por ejemplo: flutter run --release -PpermitirFirmaDebug=true).",
            )
        }
    }
}
tasks.configureEach {
    if (name == "preReleaseBuild") dependsOn(exigirFirmaPublicacion)
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
