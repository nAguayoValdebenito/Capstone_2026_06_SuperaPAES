# App de estudiantes (Flutter)

Una sola app para **Android 8 o superior** e **iOS**. Es una interfaz de usuario del monolito: no
tiene reglas de negocio y solo habla con la API por HTTP (`/api/v1/app`). Solo Android e iOS.

- Android: se compila con Android Studio (o `flutter build appbundle`) y se distribuye por la prueba
  cerrada de Google Play. Paquete `cl.superapaes.app`, `minSdk = 26`.
- iOS: se compila y firma con Xcode en macOS (`flutter build ios`) y se distribuye por TestFlight.
  Bundle identifier `cl.superapaes.app`. No se puede compilar en Windows.

## Primera vez

1. Instala Flutter estable (3.44 o superior) y revisa con `flutter doctor`. Para Android necesitas
   Android Studio con el SDK, las _Command-line Tools_ (SDK Manager) y las licencias aceptadas
   (`flutter doctor --android-licenses`). Instala también el **NDK 28.2.13676358** desde el SDK Manager
   (SDK Tools → NDK (Side by side) → «Show Package Details»): la instalación automática de Gradle falla
   en Windows.
2. `android/` e `ios/` ya están generadas. Solo si se borran, regenéralas con
   `powershell -ExecutionPolicy Bypass -File scripts/preparar_plataformas.ps1`.
3. Copia `config/desarrollo.example.json` como `config/desarrollo.json` (está en `.gitignore`).
   `API_URL` es la dirección de la API:
   - Emulador de Android: `http://10.0.2.2:3000` (en el emulador, `localhost` es el propio emulador).
   - Simulador de iOS: `http://localhost:3000`.
   - Teléfono físico: la IP del computador en la red local.

   Sin `API_URL`, en depuración la app usa la dirección local de su plataforma (las dos primeras de
   la lista). En `profile` y `release` es obligatoria: sin ella la app se detiene al iniciar.

## Comandos

```bash
flutter pub get
flutter run --dart-define-from-file=config/desarrollo.json   # con el emulador o el teléfono conectado
flutter analyze
flutter test
```

En depuración, Android permite HTTP sin cifrar (`android/app/src/debug/AndroidManifest.xml`) para
llegar a la API local; las versiones de prueba cerrada y producción usan HTTPS.

## Estructura de `lib/`

- `nucleo/`: configuración, tema, cliente HTTP (dio), lectura del formato `{ data, error, meta }`,
  errores y rutas (no depende de las pantallas).
- `dominio/`: entidades y contratos de repositorio (sin Flutter ni HTTP).
- `datos/`: fuentes remotas, modelos con `fromJson`/`toJson` y repositorios concretos.
- `presentacion/`: una carpeta por pantalla, con su estado (Riverpod). Las pantallas se declaran una
  sola vez en `comunes/secciones.dart`; de ahí salen las rutas (`enrutador.dart`), los títulos y la
  barra inferior (Inicio, Practicar, Evaluaciones, Progreso y Perfil; Planes se abre desde Perfil).

Tema: mismos colores y tipografías que la consola (Figtree para la interfaz y STIX Two Text para
fórmulas, empaquetadas en `assets/fuentes/` con licencia OFL). Diseño de referencia: 390 × 844. El
logo oficial (Figura 63 del DAS) está en `assets/imagenes/` y se muestra al iniciar sesión.

**Antes de crear o cambiar una pantalla, lee [`DISENO.md`](DISENO.md)**: el sistema de diseño del
prototipo (colores, textos, medidas y componentes de `presentacion/comunes/componentes.dart`), las
reglas para usarlo y el enlace al boceto de Figma de cada pantalla.

La compra de suscripciones (`in_app_purchase` y el archivo de StoreKit Testing) se agrega en el
sprint de suscripciones.
