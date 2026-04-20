#!/bin/bash
# ==========================================
#   BeeEyesAI — Deploy para DigitalOcean
# ==========================================

set -e

cd "$(dirname "$0")"

# ── [1/2] Push para o GitHub ──────────────
echo ""
echo " =========================================="
echo "   BeeEyesAI — Deploy para DigitalOcean"
echo " =========================================="
echo ""
echo "[1/2] Enviando código para o GitHub..."

git add -A

if git diff --cached --quiet; then
    echo "  Nada novo para enviar."
else
    git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main
fi

# ── [2/2] Deploy no servidor ─────────────
echo ""
echo "[2/2] Atualizando servidor..."

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
DEPLOY_HOST="${DEPLOY_HOST:-146.190.72.195}"
DEPLOY_USER="${DEPLOY_USER:-root}"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" \
    "cd /opt/beeeyes && git pull && docker compose up -d --build && docker image prune -f"

echo ""
echo " =========================================="
echo "   Deploy concluído! App atualizado."
echo " =========================================="
echo ""
