#!/bin/bash
# ==============================================================
#  BeeEyesAI — Build APK local (Ubuntu)
#  Uso: bash build-apk.sh
# ==============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$SCRIPT_DIR/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
ANDROID_HOME="$HOME/Android/Sdk"
CMDLINE_TOOLS_VERSION="11076708"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"

# Versões requeridas pelo React Native 0.83.4 + Expo SDK 55
BUILD_TOOLS_VERSION="35.0.0"
ANDROID_API_VERSION="35"
NDK_VERSION="27.1.12297006"

log()  { echo -e "\n\033[1;34m[$(date +%H:%M:%S)] $*\033[0m"; }
ok()   { echo -e "\033[1;32m  ✓ $*\033[0m"; }
warn() { echo -e "\033[1;33m  ⚠ $*\033[0m"; }
err()  { echo -e "\033[1;31m  ✗ $*\033[0m"; exit 1; }

echo ""
echo "  ================================================"
echo "    BeeEyesAI — Geração de APK local (Ubuntu)"
echo "  ================================================"
echo ""

# ── [1/7] Java JDK 17 ────────────────────────────────────────
log "[1/7] Verificando Java 17..."

if java -version 2>&1 | grep -q "version \"17"; then
    ok "Java 17 já instalado: $(java -version 2>&1 | head -1)"
else
    log "Instalando OpenJDK 17 e ferramentas necessárias..."
    sudo apt-get update -qq
    sudo apt-get install -y openjdk-17-jdk curl unzip wget 2>&1 | tail -3
    ok "Java 17 instalado."
fi

export JAVA_HOME="$(update-java-alternatives -l 2>/dev/null | grep java-17 | awk '{print $3}' | head -1)"
if [ -z "$JAVA_HOME" ]; then
    JAVA_HOME="$(dirname $(dirname $(readlink -f $(which java))))"
fi
export PATH="$JAVA_HOME/bin:$PATH"
ok "JAVA_HOME=$JAVA_HOME"

# ── [2/7] Android SDK ────────────────────────────────────────
log "[2/7] Verificando Android SDK..."

if [ -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
    ok "Android SDK já configurado em $ANDROID_HOME"
else
    log "Baixando Android command-line tools..."
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    TMP_ZIP="/tmp/cmdline-tools.zip"

    if command -v curl &>/dev/null; then
        curl -fL "$CMDLINE_TOOLS_URL" -o "$TMP_ZIP" --progress-bar
    else
        wget -q --show-progress "$CMDLINE_TOOLS_URL" -O "$TMP_ZIP"
    fi

    log "Extraindo command-line tools..."
    unzip -q "$TMP_ZIP" -d /tmp/cmdline-tmp
    mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
    mv /tmp/cmdline-tmp/cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"
    rm -rf "$TMP_ZIP" /tmp/cmdline-tmp
    ok "Command-line tools instalados."
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

# ── [3/7] Componentes do SDK ─────────────────────────────────
log "[3/7] Instalando componentes do Android SDK..."

yes | "$SDKMANAGER" --licenses > /dev/null 2>&1 || true

PACKAGES=(
    "build-tools;${BUILD_TOOLS_VERSION}"
    "platform-tools"
    "platforms;android-${ANDROID_API_VERSION}"
    "ndk;${NDK_VERSION}"
)

for pkg in "${PACKAGES[@]}"; do
    if "$SDKMANAGER" --list_installed 2>/dev/null | grep -q "$(echo "$pkg" | sed 's/;/ /')"; then
        ok "Já instalado: $pkg"
    else
        log "Instalando $pkg..."
        "$SDKMANAGER" "$pkg" 2>&1 | grep -v "^\[=" | tail -3
        ok "Instalado: $pkg"
    fi
done

# ── [4/7] local.properties ───────────────────────────────────
log "[4/7] Atualizando local.properties..."

cat > "$ANDROID_DIR/local.properties" <<EOF
sdk.dir=$ANDROID_HOME
ndk.dir=$ANDROID_HOME/ndk/$NDK_VERSION
EOF
ok "local.properties → sdk.dir=$ANDROID_HOME"

# ── [5/7] npm install ────────────────────────────────────────
log "[5/7] Verificando dependências npm..."

if [ -d "$MOBILE_DIR/node_modules" ]; then
    ok "node_modules já existe."
else
    log "Instalando dependências npm..."
    cd "$MOBILE_DIR"
    npm install 2>&1 | tail -5
    ok "Dependências instaladas."
fi

# ── [6/7] Limpeza e build ────────────────────────────────────
# IMPORTANTE: assembleRelease embute o bundle JS no APK (necessário para
# instalar direto no celular sem servidor Metro rodando).
# assembleDebug NÃO embute o bundle por padrão.
log "[6/7] Limpando cache e gerando APK release..."

cd "$ANDROID_DIR"
chmod +x gradlew

export ANDROID_HOME="$ANDROID_HOME"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# Limpeza total: remove artefatos antigos (inclusive do Windows)
log "Executando gradle clean..."
./gradlew clean \
    -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=512m" \
    -Dorg.gradle.daemon=false 2>&1 | tail -5
ok "Cache limpo."

log "Executando assembleRelease (pode demorar 5-15 min no primeiro build)..."
./gradlew assembleRelease \
    -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=512m" \
    -Dorg.gradle.daemon=false \
    2>&1 | tee /tmp/beeeyes-build.log | grep -E "^(BUILD|> Task|.*error:|.*FAILED)" || true

# ── [7/7] Resultado ─────────────────────────────────────────
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

echo ""
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -sh "$APK_PATH" | cut -f1)
    echo "  ================================================"
    echo -e "  \033[1;32m✅ APK gerado com sucesso!\033[0m"
    echo "  ================================================"
    echo "  Arquivo : $APK_PATH"
    echo "  Tamanho : $APK_SIZE"
    echo ""
    echo "  ── Como instalar ──────────────────────────────"
    echo "  Via USB (ADB):"
    echo "    $ANDROID_HOME/platform-tools/adb install -r \"$APK_PATH\""
    echo ""
    echo "  Via arquivo:"
    echo "    Copie o APK para o celular e abra"
    echo "    (ative 'Fontes desconhecidas' nas configurações)"
    echo ""
    echo "  ── Para ver logs de crash ─────────────────────"
    echo "    $ANDROID_HOME/platform-tools/adb logcat --pid=\$($ANDROID_HOME/platform-tools/adb shell pidof -s com.beeeyes.ai) 2>/dev/null"
    echo ""

    # Persistir variáveis no ~/.bashrc
    if ! grep -q "ANDROID_HOME" "$HOME/.bashrc"; then
        log "Adicionando variáveis de ambiente ao ~/.bashrc..."
        cat >> "$HOME/.bashrc" <<ENVEOF

# Android SDK — adicionado por build-apk.sh
export ANDROID_HOME="$ANDROID_HOME"
export ANDROID_SDK_ROOT="\$ANDROID_HOME"
export PATH="\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator:\$PATH"
ENVEOF
        ok "Variáveis salvas em ~/.bashrc (rode 'source ~/.bashrc' para ativar)"
    fi
else
    echo -e "  \033[1;31m✗ APK não foi gerado.\033[0m"
    echo "  Log completo em: /tmp/beeeyes-build.log"
    echo ""
    grep -iE "error:|exception:|failed" /tmp/beeeyes-build.log | grep -v "^[[:space:]]*\/\/" | tail -30
    exit 1
fi
