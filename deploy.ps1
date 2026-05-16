# ==========================================
#   BeeEyesAI — Deploy para DigitalOcean
# ==========================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host " =========================================="
Write-Host "   BeeEyesAI - Deploy para DigitalOcean"
Write-Host " =========================================="
Write-Host ""

# ── [1/2] Push para o GitHub ─────────────
Write-Host "[1/2] Enviando codigo para o GitHub..."

git add -A

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Nada novo para enviar."
} else {
    $date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "deploy: $date"
    git push origin main
}

# ── [2/2] Deploy no servidor ─────────────
Write-Host ""
Write-Host "[2/2] Atualizando servidor..."

$SSH_KEY    = if ($env:SSH_KEY)       { $env:SSH_KEY }       else { "$env:USERPROFILE\.ssh\id_rsa" }
$DEPLOY_HOST = if ($env:DEPLOY_HOST) { $env:DEPLOY_HOST }   else { "146.190.72.195" }
$DEPLOY_USER = if ($env:DEPLOY_USER) { $env:DEPLOY_USER }   else { "root" }

# pull + garante /opt/beeeyes/uploads (bind mount do docker-compose) + rebuild + limpa imagens
ssh -i $SSH_KEY -o StrictHostKeyChecking=no "${DEPLOY_USER}@${DEPLOY_HOST}" `
    "set -e; cd /opt/beeeyes && git pull && mkdir -p /opt/beeeyes/uploads && chmod 755 /opt/beeeyes/uploads && docker compose up -d --build && docker image prune -f"

# Migracao idempotente de imagens base64 -> /uploads (so afeta posts com data:image/% no DB)
Write-Host ""
Write-Host "[3/3] Migrando imagens legadas base64 (idempotente)..."
ssh -i $SSH_KEY -o StrictHostKeyChecking=no "${DEPLOY_USER}@${DEPLOY_HOST}" `
    "cd /opt/beeeyes && docker compose exec -T app npx tsx scripts/migrate-post-images-to-files.ts"

# Warmup do Neon (acorda o compute para o primeiro request do usuario)
$healthUrl = if ($env:HEALTHZ_URL) { $env:HEALTHZ_URL } else { "https://beeyes.net/api/healthz" }
try {
    $r = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 30
    Write-Host "  Warmup OK: db=$($r.db) latency=$($r.dbLatencyMs)ms"
} catch {
    Write-Host "  Warmup falhou ($healthUrl) - verifique manualmente"
}

Write-Host ""
Write-Host " =========================================="
Write-Host "   Deploy concluido! App atualizado."
Write-Host " =========================================="
Write-Host ""
