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

ssh -i $SSH_KEY -o StrictHostKeyChecking=no "${DEPLOY_USER}@${DEPLOY_HOST}" `
    "cd /opt/beeeyes && git pull && docker compose up -d --build && docker image prune -f"

Write-Host ""
Write-Host " =========================================="
Write-Host "   Deploy concluido! App atualizado."
Write-Host " =========================================="
Write-Host ""
