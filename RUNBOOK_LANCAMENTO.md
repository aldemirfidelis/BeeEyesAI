# Runbook de Lançamento — BeeEyesAI

4 ações finais antes de submeter na Play Store. Total estimado: **2-3 horas** (a maior parte é tempo de build na nuvem do EAS).

Por que **eu (Claude) não posso fazer essas 4**: cada uma exige login em uma conta SaaS sua (Sentry, Expo, Firebase) ou SSH no seu droplet. Te entrego os comandos prontos.

---

## 1) Sentry — crash reporting (~10 min)

### 1.1 Criar projeto

1. Acesse https://sentry.io/signup/ (free tier: 5k erros/mês, suficiente para começar)
2. Login com Google ou e-mail
3. "Create Project" → plataforma **React Native** → nome `bee-eyes-ai`
4. Na tela final aparece o **DSN** (formato `https://abc123@o123456.ingest.sentry.io/789`). **Copie**.

### 1.2 Adicionar em `mobile/.env`

Abra `d:\Projetos\BeeEyesAI\mobile\.env` no VSCode e adicione no final:

```
EXPO_PUBLIC_SENTRY_DSN=https://SEU_DSN_AQUI@oXXXXX.ingest.sentry.io/YYYYY
EXPO_PUBLIC_SENTRY_ENV=production
```

### 1.3 Adicionar também no `mobile/eas.json` (build prod)

Edite `d:\Projetos\BeeEyesAI\mobile\eas.json`, dentro de `build.production.env`, adicione:

```json
"EXPO_PUBLIC_SENTRY_DSN": "https://SEU_DSN_AQUI@oXXXXX.ingest.sentry.io/YYYYY",
"EXPO_PUBLIC_SENTRY_ENV": "production"
```

Sem isso, o build de prod não vai capturar nada. O `.env` local é só pra dev.

### 1.4 Como verificar (pós-build)

- Abre o app em dispositivo de teste
- Provoca um erro de propósito (em dev pode chamar `captureError(new Error("test"))` em algum lugar temporário)
- Olha o dashboard do Sentry — deve aparecer em ~1 min

---

## 2) Criptografar tokens Google Calendar legados (~5 min)

Isso roda **uma vez** em produção, **idempotente**. Pula tokens que já estão cifrados.

### 2.1 Gerar a chave (local, uma vez)

Abre PowerShell na pasta do projeto e roda:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Vai imprimir 64 chars hex. **Salve essa chave em local seguro** (1Password, gerenciador de senhas). Ela vai ficar com você pra sempre — perder = perder acesso aos tokens criptografados.

### 2.2 Adicionar a chave no servidor de produção

SSH no droplet:

```powershell
ssh -i $env:USERPROFILE\.ssh\id_rsa root@146.190.72.195
```

No servidor:

```bash
cd /opt/beeeyes
# Backup do .env atual (segurança)
cp .env .env.backup-$(date +%Y%m%d)
# Adicionar ENCRYPTION_KEY ao final
echo "ENCRYPTION_KEY=SUA_CHAVE_64_HEX_AQUI" >> .env
# Confirmar que tá lá
grep ENCRYPTION_KEY .env
# Sair
exit
```

### 2.3 Deploy do código novo (que já está em `main`)

Na sua máquina, na pasta do projeto:

```powershell
.\deploy.ps1
```

Isso faz `git push` + SSH + `docker compose up -d --build`. O container vai reiniciar lendo a nova `ENCRYPTION_KEY`.

### 2.4 Rodar o backfill (criptografa tokens legados)

```powershell
ssh -i $env:USERPROFILE\.ssh\id_rsa root@146.190.72.195 "cd /opt/beeeyes && docker compose exec -T app npx tsx scripts/encrypt-legacy-google-tokens.ts"
```

Saída esperada:
```
[ok] google_calendar id=xxx-xxx: encriptado (access=true, refresh=true)
...
Resumo: encrypted=N, alreadyEncrypted=0, failed=0, total=N
```

Se aparecer `failed > 0`, copia a saída completa e me manda.

### 2.5 Como verificar

Após rodar o backfill, fazer uma query no Neon (ou pelo painel admin Drizzle):

```sql
SELECT id, provider, LEFT(access_token, 7) AS access_prefix, LEFT(refresh_token, 7) AS refresh_prefix
FROM user_integrations
WHERE provider = 'google_calendar';
```

Todos devem ter prefixo `enc:v1:`. Se algum não tiver, o `decryptTokenSafe` ainda funciona com plaintext (coexistência), mas vale investigar.

---

## 3) EAS Build → AAB para Play Console (~30-60 min)

### 3.1 Pré-requisitos

```powershell
cd d:\Projetos\BeeEyesAI\mobile
# Login Expo (uma vez)
npx eas-cli login
# Vai abrir o browser para autenticar com sua conta Expo
```

Se você não tem conta Expo: cria em https://expo.dev/signup (gratuito).

### 3.2 Confirmar projeto vinculado

O `app.json` já tem `extra.eas.projectId` = `d0d86027-eada-4f64-bf91-faba1d627a58`. Se você criou esse projeto, ótimo. Senão, vai precisar rodar:

```powershell
npx eas-cli build:configure
```

Aceita criar projeto novo. O `app.json` será atualizado.

### 3.3 Confirmar `google-services.json` local

Verifica que existe (não está no git, mas local sim):

```powershell
ls d:\Projetos\BeeEyesAI\mobile\google-services.json
```

Se NÃO existir: baixe do Firebase Console (depois do passo 4 abaixo).

### 3.4 Build de produção

```powershell
cd d:\Projetos\BeeEyesAI\mobile
npx eas-cli build --platform android --profile production
```

Vai perguntar:
- **"Generate a new Android Keystore?"** → **Yes** (Expo gera e guarda na nuvem; você nunca precisa lidar com isso)
- Build sobe pra fila → você recebe link e progresso no terminal
- Tempo médio: **15-30 min** (depende da fila)

Quando terminar, baixa o `.aab` (link aparece no terminal e em https://expo.dev/accounts/<seu>/projects/bee-eyes-ai/builds).

### 3.5 Submeter ao Play Console

1. Acesse https://play.google.com/console
2. Cria app (se ainda não existe): "Create app" → "BeeEyes" → idioma PT-BR
3. Lado esquerdo: **Testing → Internal testing → Create new release**
4. Upload do `.aab` baixado
5. Adicionar testers (e-mails ou Google Groups)
6. Salvar e revisar

Antes de promover para produção, preencher também: Data Safety, Content rating, Store listing — tudo documentado em [`PLAY_STORE_CHECKLIST.md`](PLAY_STORE_CHECKLIST.md).

---

## 4) Rotacionar chave Firebase (~5 min)

A chave `AIzaSyAl3xfCBcvIB8RRDho3Du3VKZHHfslSilU` está exposta no histórico git. Mesmo já sendo "pública por design" (Android keys), boa prática é rotacionar.

### 4.1 Acessar Firebase Console

1. https://console.firebase.google.com
2. Projeto **com-beeeyes-ai** (id já está no template `mobile/google-services.example.json`)

### 4.2 Restringir a chave antiga (mitigação rápida)

1. Vai para **Project Settings (engrenagem) → General → Your apps → Android app `com.beeeyes.ai`**
2. Clica em "Manage API keys in Google Cloud Console" → abre Google Cloud Console
3. Acha a chave atual `AIzaSyAl3x...`
4. Edita → **Application restrictions** → **Android apps** → adiciona apenas o package `com.beeeyes.ai` com o SHA-1 do seu certificado de release
5. **API restrictions** → restrict to: Firebase Cloud Messaging, Identity Toolkit, e o que mais usar (NÃO deixe "Don't restrict key")
6. Save

Isso já impede uso da chave fora do seu app.

### 4.3 Gerar chave nova (opcional, mas recomendado)

1. Google Cloud Console → APIs & Services → Credentials
2. **+ Create credentials → API key** → nome `bee-eyes-ai-android-2026`
3. Aplica as mesmas restrições do passo 4.2
4. Anota a nova chave

### 4.4 Baixar novo `google-services.json`

1. Firebase Console → Project Settings → Your apps → Android → ícone de download ⬇️
2. Salva em `d:\Projetos\BeeEyesAI\mobile\google-services.json` (substitui o antigo)
3. NÃO commitar (`.gitignore` já cuida)
4. Confirma:
   ```powershell
   git status mobile/google-services.json
   # deve dizer "ignored"
   ```

### 4.5 Refazer build

Se você já fez o EAS Build no passo 3 ANTES de rotacionar:
```powershell
cd d:\Projetos\BeeEyesAI\mobile
npx eas-cli build --platform android --profile production
```
Novo AAB com a chave nova → submete substituindo no Play Console.

### 4.6 Deletar chave antiga

**Depois de confirmar que o app com a nova chave funciona** (faz login, recebe push notif):

1. Google Cloud Console → Credentials → chave antiga `AIzaSyAl3x...`
2. **Delete**

---

## Ordem recomendada

Se tudo for novo pra você, melhor ordem é:

1. **Sentry** (1.1 → 1.3) — 10 min
2. **Firebase** (passo 4 inteiro) — 5 min
3. **ENCRYPTION_KEY local** (2.1 — gerar e salvar) — 1 min
4. **Deploy + backfill** (2.2 → 2.4) — 5 min
5. **EAS Build** (passo 3 inteiro) — 30-60 min (a maior parte é espera)
6. **Play Console** (3.5) — 30 min (preenchimento de forms)

Total ativo seu: ~1h. Total com esperas: 2-3h.

---

## Se algo der errado

- **Sentry não captura nada**: verifica que `EXPO_PUBLIC_SENTRY_DSN` está **dentro de `build.production.env`** em `eas.json`, não só em `mobile/.env`. Em build de prod, `.env` local não é lido.
- **Backfill falha com "ENCRYPTION_KEY é obrigatória em produção"**: o `.env` do servidor não foi recarregado. Faz `docker compose restart app` depois de editar `.env`.
- **EAS build falha em "Cannot find google-services.json"**: o arquivo precisa estar em `mobile/google-services.json` localmente. Ele não vai pro git mas o EAS pega do filesystem no upload.
- **Play Console rejeita por "Privacy Policy URL"**: confirma que `https://beeyes.net/legal/privacy` está respondendo HTTP 200 com HTML. Testa: `curl -I https://beeyes.net/legal/privacy`.

Em qualquer um desses, me passa o erro completo que eu te ajudo a destravar.
