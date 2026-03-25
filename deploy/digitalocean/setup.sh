#!/bin/bash
# ============================================================
# Setup completo do Droplet DigitalOcean — BeeEyesAI
# Execute UMA VEZ como root após criar o Droplet:
#   ssh root@SEU_IP "bash <(curl -fsSL URL_DO_SCRIPT)"
# Ou copie e execute: bash setup.sh SEU_DOMINIO SEU_EMAIL_SSL
# ============================================================

set -e

DOMAIN=${1:-""}   # ex: api.beeeyes.com.br
EMAIL=${2:-""}    # ex: voce@email.com (para SSL)
APP_DIR="/opt/beeeyes"
REPO_URL="https://github.com/aldemirfidelis/BeeEyesAI.git"

echo ""
echo "=========================================="
echo "  BeeEyesAI — Setup do Droplet"
echo "=========================================="
echo ""

# ── Sistema ──────────────────────────────────────────────
echo "==> [1/7] Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ── Docker ───────────────────────────────────────────────
echo "==> [2/7] Instalando Docker..."
curl -fsSL https://get.docker.com | sh -s -- -q
systemctl enable docker
systemctl start docker
apt-get install -y -qq docker-compose-plugin

# ── Nginx ────────────────────────────────────────────────
echo "==> [3/7] Instalando Nginx + Certbot..."
apt-get install -y -qq nginx certbot python3-certbot-nginx

# ── Firewall ─────────────────────────────────────────────
echo "==> [4/7] Configurando firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── Clonar repositório ────────────────────────────────────
echo "==> [5/7] Clonando repositório..."
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

# Criar .env a partir do exemplo
cp .env.example .env
echo ""
echo "⚠️  ATENÇÃO: preencha o arquivo .env com suas chaves reais:"
echo "   nano $APP_DIR/.env"
echo ""
read -p "Pressione ENTER quando terminar de editar o .env..."

# ── Subir aplicação ───────────────────────────────────────
echo "==> [6/7] Fazendo build e subindo container..."
docker compose up -d --build

# ── Nginx config ─────────────────────────────────────────
echo "==> [7/7] Configurando Nginx..."
cp "$APP_DIR/deploy/digitalocean/nginx.conf" /etc/nginx/sites-available/beeeyes

if [ -n "$DOMAIN" ]; then
    sed -i "s/SEU_DOMINIO_OU_IP/$DOMAIN/g" /etc/nginx/sites-available/beeeyes
else
    SERVER_IP=$(curl -s ifconfig.me)
    sed -i "s/SEU_DOMINIO_OU_IP/$SERVER_IP/g" /etc/nginx/sites-available/beeeyes
fi

# Remover site padrão do Nginx
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/beeeyes /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# ── SSL (se domínio foi passado) ──────────────────────────
if [ -n "$DOMAIN" ] && [ -n "$EMAIL" ]; then
    echo "==> Obtendo certificado SSL para $DOMAIN..."
    certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
    echo "✅ SSL configurado! Auto-renovação ativa."
fi

# ── Verificação final ─────────────────────────────────────
echo ""
echo "=========================================="
echo "  ✅ Deploy concluído!"
echo "=========================================="
echo ""
echo "  App rodando em:  http://$(curl -s ifconfig.me)"
if [ -n "$DOMAIN" ]; then
echo "  Com SSL em:      https://$DOMAIN"
fi
echo ""
echo "  Comandos úteis:"
echo "    Ver logs:        docker compose -f $APP_DIR/docker-compose.yml logs -f"
echo "    Reiniciar:       docker compose -f $APP_DIR/docker-compose.yml restart"
echo "    Atualizar:       cd $APP_DIR && git pull && docker compose up -d --build"
echo ""
