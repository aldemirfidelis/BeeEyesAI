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
    "set -e; cd /opt/beeeyes && git pull && mkdir -p /opt/beeeyes/uploads && chmod 755 /opt/beeeyes/uploads && docker compose up -d --build && docker image prune -f"

echo ""
echo "[3/3] Migrando imagens legadas base64 (idempotente)..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" \
    "cd /opt/beeeyes && docker compose exec -T app npx tsx scripts/migrate-post-images-to-files.ts"

HEALTHZ_URL="${HEALTHZ_URL:-https://beeyes.net/api/healthz}"
if curl -fsS --max-time 30 "$HEALTHZ_URL" >/dev/null 2>&1; then
  echo "  Warmup OK: $HEALTHZ_URL"
else
  echo "  Warmup falhou ($HEALTHZ_URL) - verifique manualmente"
fi

echo ""
echo " =========================================="
echo "   Deploy concluído! App atualizado."
echo " =========================================="
echo ""
