# Regenera las carpetas android/ e ios/ con flutter create y aplica los ajustes del proyecto:
# identificador cl.superapaes.app, nombre visible "Supera PAES", Android 8 o superior (API 26) y
# HTTP sin cifrar solo en depuración (API local en 10.0.2.2). Ejecutar solo si se borran las carpetas:
#   powershell -ExecutionPolicy Bypass -File app/scripts/preparar_plataformas.ps1
# flutter create no sobrescribe archivos existentes (lib/, test/, pubspec.yaml quedan intactos).
# Plataformas de la app: solo android e ios.

$ErrorActionPreference = 'Stop'
$app = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $app

function Leer([string]$ruta) { [System.IO.File]::ReadAllText((Resolve-Path $ruta)) }
function Escribir-SinBom([string]$ruta, [string]$texto) {
  [System.IO.File]::WriteAllText((Resolve-Path $ruta), $texto, (New-Object System.Text.UTF8Encoding($false)))
}

flutter create --org cl.superapaes --project-name supera_paes --platforms=android,ios .
if ($LASTEXITCODE -ne 0) { throw 'Error al ejecutar flutter create' }

# Android: applicationId, namespace y versión mínima
$gradle = (Get-ChildItem 'android/app' -Filter 'build.gradle*' | Select-Object -First 1).FullName
$texto = (Leer $gradle) -replace 'cl\.superapaes\.supera_paes', 'cl.superapaes.app'
$texto = $texto -replace 'minSdk = flutter\.minSdkVersion', 'minSdk = 26'
Escribir-SinBom $gradle $texto

# Android: carpeta y paquete de MainActivity
$origen = 'android/app/src/main/kotlin/cl/superapaes/supera_paes'
$destino = 'android/app/src/main/kotlin/cl/superapaes/app'
if (Test-Path $origen) {
  New-Item -ItemType Directory -Force $destino | Out-Null
  Get-ChildItem $origen | Move-Item -Destination $destino -Force
  Remove-Item $origen -Recurse -Force
}
$actividad = Join-Path $destino 'MainActivity.kt'
Escribir-SinBom $actividad ((Leer $actividad) -replace 'package cl\.superapaes\.supera_paes', 'package cl.superapaes.app')

# Android: permiso de internet en todas las variantes y nombre visible
$manifiesto = 'android/app/src/main/AndroidManifest.xml'
$texto = Leer $manifiesto
if ($texto -notmatch 'android.permission.INTERNET') {
  $texto = $texto -replace '(<manifest[^>]*>)', "`$1`n    <uses-permission android:name=`"android.permission.INTERNET`" />"
}
Escribir-SinBom $manifiesto ($texto -replace 'android:label="supera_paes"', 'android:label="Supera PAES"')

# Android: HTTP sin cifrar solo en depuración
$depuracion = 'android/app/src/debug/AndroidManifest.xml'
$texto = Leer $depuracion
if ($texto -notmatch 'usesCleartextTraffic') {
  Escribir-SinBom $depuracion ($texto -replace '</manifest>', "    <application android:usesCleartextTraffic=`"true`" />`n</manifest>")
}

# iOS: bundle identifier y nombre visible
$proyecto = 'ios/Runner.xcodeproj/project.pbxproj'
Escribir-SinBom $proyecto ((Leer $proyecto) -replace 'cl\.superapaes\.superaPaes', 'cl.superapaes.app')
$plist = 'ios/Runner/Info.plist'
$texto = (Leer $plist) -replace '<string>Supera Paes</string>', '<string>Supera PAES</string>'
Escribir-SinBom $plist ($texto -replace '<string>supera_paes</string>', '<string>Supera PAES</string>')

Write-Host 'Plataformas listas: Android e iOS con identificador cl.superapaes.app'
Select-String -Path $gradle -Pattern 'applicationId|namespace|minSdk'
Select-String -Path $proyecto -Pattern 'PRODUCT_BUNDLE_IDENTIFIER' | Select-Object -First 1
