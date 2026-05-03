# ==========================================
#   BeeEyesAI — Build APK local (Windows)
#   Uso: .\build-apk.ps1
# ==========================================
$ErrorActionPreference = "Stop"

$ANDROID_HOME   = "C:\Users\aldem\AppData\Local\Android\Sdk"
$NDK_VERSION    = "27.1.12297006"
$SCRIPT_DIR     = $PSScriptRoot
$MOBILE_DIR     = Join-Path $SCRIPT_DIR "mobile"
$ANDROID_DIR    = Join-Path $MOBILE_DIR "android"
$APK_PATH       = "$ANDROID_DIR\app\build\outputs\apk\release\app-release.apk"
$ADB            = "$ANDROID_HOME\platform-tools\adb.exe"

$env:ANDROID_HOME     = $ANDROID_HOME
$env:ANDROID_SDK_ROOT = $ANDROID_HOME
$env:Path             = "$ANDROID_HOME\platform-tools;$ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Write-Host ""
Write-Host "  ================================================"
Write-Host "    BeeEyesAI - Geracao de APK local (Windows)"
Write-Host "  ================================================"
Write-Host ""

# ── [1/3] local.properties ───────────────
Write-Host "[1/3] Atualizando local.properties..."
$sdkEscaped = $ANDROID_HOME.Replace("\", "\\")
@"
sdk.dir=$sdkEscaped
ndk.dir=$sdkEscaped\\ndk\\$NDK_VERSION
"@ | Set-Content -Path "$ANDROID_DIR\local.properties" -Encoding utf8
Write-Host "  OK: sdk.dir=$ANDROID_HOME"

# ── [2/3] Build APK ──────────────────────
Write-Host ""
Write-Host "[2/3] Limpando e gerando APK release (pode demorar 5-15 min)..."
Set-Location $ANDROID_DIR

& .\gradlew.bat clean assembleRelease `
    "-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m" `
    -Dorg.gradle.daemon=false

# ── [3/3] Resultado ──────────────────────
Write-Host ""
if (Test-Path $APK_PATH) {
    $sizeMB = [math]::Round((Get-Item $APK_PATH).Length / 1MB, 1)
    Write-Host "  ================================================"
    Write-Host "  APK gerado com sucesso!"
    Write-Host "  ================================================"
    Write-Host "  Arquivo : $APK_PATH"
    Write-Host "  Tamanho : $sizeMB MB"
    Write-Host ""
    Write-Host "  -- Como instalar --"
    Write-Host "  Via USB (ADB):"
    Write-Host "    $ADB install -r `"$APK_PATH`""
    Write-Host ""
    Write-Host "  Via arquivo:"
    Write-Host "    Copie o APK para o celular e abra"
    Write-Host "    (ative 'Fontes desconhecidas' nas configuracoes)"
    Write-Host ""
    Write-Host "  -- Logs de crash --"
    Write-Host "    $ADB logcat | findstr com.beeeyes.ai"
} else {
    Write-Host "  APK nao foi gerado. Verifique os erros acima."
    exit 1
}
