# Auditoria Final — Bee (BeeEyesAI) antes da Play Store

Data: 2026-05-16
Autor: revisão final pré-release
Status do projeto: **🟡 PRONTO COM RESSALVAS** — testes 31/31 ✓, tsc limpo ✓, mas 12 bloqueadores reais

---

## Resumo Executivo

A base do projeto é sólida: 31 testes unitários passando, typecheck limpo, arquitetura clara (web React + mobile Expo + backend Express + Drizzle/Neon), documentação existente boa, paridade web↔mobile em 14 de 17 features (83%).

Existem **4 bloqueadores diretos** para submissão na Play Store, **8 problemas de segurança críticos** e dezenas de melhorias de banco, IA e UX. Nenhum é insuperável; muitos são fixes de horas.

| Categoria | Críticos | Altos | Médios | Baixos |
|---|---:|---:|---:|---:|
| Play Store / Mobile | 4 | 7 | 8 | 4 |
| Segurança backend | 8 | 9 | 8 | 5 |
| Banco / Performance | 4 | 5 | 6 | 3 |
| IA da Bee | 3 | 4 | 5 | — |
| UX / PT-BR / Paridade | 1 | 2 | 5 | — |
| Código morto / Dívida | 0 | 4 | 6 | — |

---

## 🔴 BLOQUEADORES PLAY STORE (não submete sem)

### B1. `usesCleartextTraffic: true` em produção — `mobile/app.json:42`
HTTP cleartext habilitado para todo o app. Google Play exige HTTPS. **Rejeição automática**.
**Fix:** remover ou condicionar a debug. APIs já são HTTPS em produção — não há motivo legítimo.

### B2. Release Android assinado com debug.keystore — `mobile/android/app/build.gradle:115`
```gradle
release {
    signingConfig signingConfigs.debug  // ← bloqueador
}
```
Play Console rejeita AAB com debug keystore. **Decisão necessária:** EAS Build (recomendado, gerencia keystore na nuvem) ou keystore manual local.

### B3. `mobile/google-services.json` versionado no Git
Confirmado em `git ls-files`. Contém `api_key: AIzaSyAl3xfCBcvIB8RRDho3Du3VKZHHfslSilU`. Embora API key Android seja "pública por design", expõe a app de uso por terceiros. `.gitignore` não cobre.
**Fix:** `git rm --cached mobile/google-services.json` + adicionar ao `.gitignore` + rotacionar chave + documentar setup local (`eas secret:create`).

### B4. Privacy Policy e Termos sem URL pública
Textos existem em `mobile/lib/legalTexts.ts` e `client/src/lib/legalTexts.ts` (duplicados), mas Play Console exige **URL pública**. Sem URL ⇒ submissão bloqueada.
**Decisão necessária:** hospedar onde? (sugestões: `https://app.beeeyes.ai/privacy`, `https://beeeyes.net/privacy`). Posso gerar os HTMLs e rota Express servindo de `/legal/privacy` e `/legal/terms`.

### Outros itens Play Store ALTOS (não bloqueadores mas vão render rejeição/rebaixamento)

- **Permissões declaradas mas não usadas:** `USE_BIOMETRIC`, `USE_FINGERPRINT`, possivelmente `RECORD_AUDIO`, possivelmente `ACCESS_FINE_LOCATION` (`expo-location` plugin pediu, mas não vi `getCurrentLocation` no código exceto daily-briefing geo opcional)
- **Sem crash reporter** (Sentry/Crashlytics) — vai ficar cego a crashes pós-lançamento
- **Sem ErrorBoundary global** em `mobile/app/_layout.tsx`
- **Google Sign-In webClientId** precisa ser testado em release APK contra OAuth Console (pode falhar silenciosamente em prod se não bater)

---

## 🔴 SEGURANÇA — CRÍTICOS

### S1. JWT no `localStorage` (web) — vulnerável a XSS
`client/src/pages/Home.tsx:51-53`, `client/src/pages/Admin.tsx:11,132`, e ~7 outros componentes (`SponsoredChatCard`, `SponsoredFeedCard`, `AdMobSmartAdCard`, `AdsCard`).
Qualquer XSS exfiltra a sessão. Combinado com CORS `*` (S2), o risco é amplificado.
**Fix sugerido (grande):** mover para cookie `httpOnly; Secure; SameSite=Strict`, adicionar CSRF token. Backend emite `Set-Cookie` no login.
**Mitigação intermediária:** se migração de cookie é cara, ao menos reduzir TTL do JWT + adicionar CSP estrito que cubra `script-src` mais agressivo.

### S2. CORS `Access-Control-Allow-Origin: *` em produção — `server/index.ts:17-23`
Mobile usa header Authorization (não cookies), então mobile não depende de CORS. Web está no mesmo domínio (servido pelo Express), também não precisa de `*`.
**Fix:** whitelist (`https://app.beeeyes.ai` + `http://localhost:5173` em dev). É um change de 10 linhas.

### S3. Sem rate limit em `/api/auth/login`, `/api/auth/register`, `/api/auth/password-reset/request`
`server/rateLimit.ts` cobre apenas `/api/chat`. Brute force trivial. Account enumeration via `forgot-password` mudando comportamento conforme email exista.
**Fix:** aplicar rate limit por IP em rotas auth. 5 req/15min para login/register, 3 req/h para reset.

### S4. Tokens Google Calendar em plaintext no banco — `shared/schema.ts:841-842`
`user_integrations.accessToken` e `refreshToken` como `text`. Vazamento de banco = acesso aos calendários de todos.
**Fix:** AES-256-GCM com chave em `ENCRYPTION_KEY` env. Migration backfill criptografando linhas existentes.

### S5. Reset de senha — token em log + timing attack
`server/routes/auth.ts`: quando `RESEND_API_KEY` não existe, link de reset vai pro `console.info`. Em produção sem Resend configurado, isso pode acabar em logs de container persistidos.
Timing attack: se email não existe, retorna rápido; se existe, faz INSERT + (opcional) fetch SMTP. Atacante enumera usuários.
**Fix:** sempre fazer trabalho equivalente (dummy hash); remover log de link em produção.

### S6. PII do usuário injetada em prompts de IA externa sem aviso explícito
`server/ai.ts:104-184` envia para OpenAI/Groq/Gemini/Cerebras: nome, interesses, memórias factuais ("João Silva trabalha na X", possivelmente saúde/relacionamentos), tópicos recentes, mood, streak.
LGPD Art. 9° (consentimento granular) — usuário precisa saber que dados pessoais vão para terceiros e poder optar-sair.
**Fix:** adicionar toggle "Permitir contexto pessoal nas conversas" em Settings, default desativado para dados sensíveis (memórias). Mencionar explicitamente em Privacy Policy.

### S7. OAuth Google — sem verificação de assinatura do ID token
`server/routes/auth.ts` validação social usa apenas `fetch userinfo` com access token. Atacante pode forjar com token de outro app.
**Fix:** usar `google-auth-library` com `client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`.

### S8. Sem `DELETE /api/me` (LGPD direito ao esquecimento)
Conta não pode ser deletada via app. Posts, DMs, comentários persistem.
**Fix:** rota autenticada que confirma senha + apaga em cascata (FKs já têm `onDelete: cascade` em vários lugares).

### Outros ALTOS
- JWT TTL = 30 dias (`server/auth.ts:21`). Reduzir para 1h + refresh token (mas é refactor grande).
- Sem HSTS no `server/security.ts`. Adição de 1 linha em produção.
- Upload base64: sem cap de tamanho em `server/media.ts`, sem whitelist real de MIME (só prefix `data:image/`). Risco DoS + path traversal.
- Tamanho de string sem cap em posts, DMs, comments — risco DB bloat e DoS.
- CSP usa `'unsafe-inline'` em `style-src` (`server/security.ts:12`). Para Tailwind compilado, nonces resolvem.

---

## 🟠 BANCO — CRÍTICOS

### D1. Índice faltando `community_members(community_id, status)`
`server/storage.ts:1167, 1213, 1223, 1236` — queries por status fazem table scan.
**Fix:** `CREATE INDEX community_members_community_status_idx ON community_members(community_id, status);`

### D2. Índice faltando `direct_messages(recipient_id, created_at DESC)`
`getDirectConversations()` usa `OR (sender,recipient)` mas só há índice em `(sender_id, recipient_id, created_at)`. Em 10k+ mensagens, gargalo grave.
**Fix:** `CREATE INDEX direct_messages_recipient_created_idx ON direct_messages(recipient_id, created_at DESC);`

### D3. FK ausente em `messages.replied_to_message_id`
`shared/schema.ts:325`. Sem `references()` → orfãos quando mensagem origem é deletada.
**Fix:** `ALTER TABLE messages ADD CONSTRAINT messages_replied_to_message_id_fk FOREIGN KEY (replied_to_message_id) REFERENCES messages(id) ON DELETE SET NULL;`

### D4. `getAllUsersExcept()` sem `LIMIT` — `server/storage.ts:267`
Hoje sem uso em rotas (código morto), mas se chamado em escala = OOM. Remover ou capar.

### Outros índices recomendados
```sql
CREATE INDEX community_post_comments_user_idx ON community_post_comments(user_id);
CREATE INDEX ad_impressions_expires_idx ON ad_impressions(expires_at);
CREATE INDEX notification_reads_notification_idx ON notification_reads(notification_id);
```

### Outros DB altos
- **`getDirectConversations()`** carrega TODAS as mensagens do usuário em memória e agrupa em JS. Em DB grandes vira gargalo. Refatorar com `DISTINCT ON` ou subquery.
- **Paginação `OFFSET`** em `getCommunityPosts()` etc — substituir por cursor (`created_at < ?`).
- **Enums como `text`** em `messages.role`, `userConnections.status`, `communityMembers.role/status`, `alarmReminders.kind`, `wishlistItems.status` — sem CHECK constraint.
- **`ensureDatabaseCompatibility()`** em `server/db.ts` aplica ALTERs em runtime — perigoso em produção. Migrar para migrations Drizzle puras.

---

## 🔴 IA DA BEE — CRÍTICOS

### A1. `parseAIActions` frágil — `server/ai.ts:1457+`
Regex `[^}]*` quebra com JSON aninhado, chaves dentro de strings, JSON parcial em SSE truncado. Pode criar `calendar_events.startAt = ""` e similares.
**Fix recomendado:** migrar para OpenAI **function calling** (suportado por gpt-4o-mini). Para fallbacks Groq/Gemini/Cerebras manter JSON mas validar com Zod **antes** de INSERT.

### A2. Sem detecção de crise/risco psicológico
Nenhuma palavra-chave dispara redirecionamento para CVV (188) / CAPS / SAMU 192. Em app que se posiciona como "assistente acolhedora" e usa dados de mood/saúde, é gap relevante (e Play Store cobra "Health & Fitness" apps que tenham safeguards).
**Fix:** detector regex simples + bloco substituto antes de chamar LLM:
```
"Notei que você está em momento difícil. Não estou sozinho aqui:
• CVV: 188 (24h, gratuito)
• SAMU: 192
• CAPS [cidade do user]: ..."
```

### A3. Sem rate limit financeiro (custo descontrolado)
60 msgs/h por user × custo OpenAI = potencialmente $4-5/user/mês ativo. 1000 users virais = $5k/mês só em IA. Bot abuso = mais.
**Fix:** tracking de custo cumulativo (memória ou tabela `ai_cost_usage`) com cap configurável; em prod, Redis.

### Outros IA
- Streaming mobile usa `await response.text()` em `mobile/hooks/useChat.ts:101` → não é streaming real, espera tudo. Migrar para `response.body.getReader()`.
- Histórico de chat enviado sem janela de tokens — cresce indefinido. Implementar truncamento com resumo.
- Daily briefing sem cache de IA — geração nova a cada hit sem `lastDailyBriefingDate`.
- API keys de IA não são obrigatórias (`?? ""`) — silencia falhas.

---

## 🟠 UX / PT-BR / Paridade

### U1. Mojibake em `mobile/app/onboarding.tsx:18, 72`
Confirmado: caracteres `â”€` (UTF-8 mal interpretado) em comentários. Inofensivo em runtime (são comentários), mas evidencia que arquivo foi salvo em encoding errado em algum momento. **Fix de 1 linha.**

### U2. Health Coach existe no web mas não no mobile (e vice-versa)
`mobile/features/colmeia/screens/HealthCoachSection.tsx` existe (segundo memória), mas listagem do agente diz que está faltando. Validar e equiparar.

### U3. Web sem onboarding obrigatório?
Mobile força onboarding antes de tabs; web vai direto para Home. Causa de drift de dados em `user_personality.interests` vazio em users web.

### Outros
- Mensagens de erro genéricas ("Não conseguimos carregar seu feed") sem ação clara.
- Web sem i18n (mobile tem). Aceitável v1, mas planejar.
- Acessibilidade: alguns ícone-only sem `aria-label` (a maioria está OK).
- Acentuação está OK em geral (apenas o caso do `onboarding.tsx`).

---

## 🟢 CÓDIGO MORTO / DUPLICAÇÃO

### Dependências NPM nunca importadas (remover do `package.json` raiz)
- `passport`, `passport-local` — auth migrou para JWT puro
- `express-session`, `memorystore`, `connect-pg-simple` — não há session-cookie em uso

### Arquivos órfãos confirmados
- `mobile/hooks/useMissions.ts` — `export {};` apenas
- `client/src/pages/examples/Home.tsx` — wrapper trivial
- `client/src/components/examples/*.tsx` — 7 componentes nunca importados
- `mobile/features/auth/screens/LoginScreen.tsx` — versão antiga (Expo Router em `mobile/app/(auth)/login.tsx` é a viva)
- `mobile/features/auth/screens/RegisterScreen.tsx` — idem
- `fly.toml` — resíduo de tentativa abandonada
- `atualizacoes-planilha.md` — to-do histórico
- `deploy/hostgator/*` — legado MySQL+PHP, infra atual é DigitalOcean+Neon
- `icons-colmeia/` — possivelmente substituído por `mobile/assets/`

### Endpoint API sem consumo aparente
- `POST /api/bee/research` (`server/routes/research.ts:31`) — verificar antes de remover

### TODOs ativos (intencionais)
- `client/.../ColmeiaPanel.tsx:1387` `// TODO: replace with POST /api/health/workout-plan`
- `mobile/lib/adService.ts:2,113,171` — integrar com rede real de ads

### Pastas a decidir
- `beeyes-design/` — projeto Vite separado, mockup
- `unity/` — o que é mesmo?
- `_svg_convert/` — ferramenta de build (mantém, documentar)

---

## ✅ O que está bem feito

Não é tudo que precisa melhorar — vale registrar o que está sólido:

- **bcrypt 12 rounds**, `JWT_SECRET` fail-fast em produção (`server/auth.ts`)
- **31 testes unitários passando**, incluindo auth, ai-actions, rate limit, holidays, schema
- **Drizzle ORM** parametrizando queries (SQL injection mitigado por padrão)
- **`requireAuth`/`requireAdmin`** consistentes
- **Mobile usa SecureStore** para token (não localStorage)
- **CSP em produção**, `x-powered-by` desligado, Referrer-Policy/X-Content-Type-Options/X-Frame-Options corretos
- **Cascade deletes** configurados nas FKs principais
- **Observabilidade estruturada** (`req.logger`, request-id, métricas Prometheus, traces JSONL)
- **Validação Zod** em rotas críticas (`insertUserSchema` testado)
- **Whisper anti-hallucination patterns**
- **Documentação extensa** (`DOCUMENTACAO_COMPLETA_DO_PROJETO.md`, `DOCUMENTACAO_ANUNCIOS.md`, `DOCUMENTACAO_CONTEXTOS_BEE.md`, `DOCUMENTACAO_LISTA_DE_DESEJOS.md`)
- **Build Android** com `targetSdk 36 / compileSdk 36` (atende 2026)

---

## Plano de Correções Sugerido (faseado)

### Fase 1 — Bloqueadores Play Store + segurança crítica (1-2 dias)
Esses dão pra fazer agora, **maioria sem decisão de negócio**:

1. **B1** Remover `usesCleartextTraffic: true` (`mobile/app.json:42`)
2. **B3** `git rm --cached mobile/google-services.json` + atualizar `.gitignore` (também `*.keystore`, `*.jks`, exceto `debug.keystore`)
3. **U1** Corrigir mojibake em `mobile/app/onboarding.tsx`
4. **D1, D2, D3** Migration de índices + FK
5. **S2** Whitelist CORS por ambiente
6. **S3** Rate limit em rotas auth
7. **S5** Remover log de link de reset; mitigação timing attack
8. **S7** Validar ID token Google com `google-auth-library`
9. **S8** `DELETE /api/me` com cascata
10. **Headers** HSTS + remover `unsafe-inline` no style-src
11. **Permissions** mobile — remover `BIOMETRIC/FINGERPRINT` se não usados; idem para `RECORD_AUDIO`/`LOCATION`
12. **Validations** cap em tamanho de imagem base64 + content text

### Fase 2 — Decisões de negócio (precisam de você)
- **B2** Como assinar release? EAS Build (recomendado) ou keystore manual?
- **B4** Onde hospedar Privacy Policy / Terms? Eu posso servir via `/legal/*` no Express.
- **S1** Migrar JWT pra httpOnly cookie no web? (impacto: Admin.tsx, Home.tsx, todos os Sponsored*)
- **S6** Toggle "Bee pode usar minhas memórias e dados pessoais" — onde colocar em Settings?
- **A2** Detecção de crise — quais palavras-chave? telefones por região (CVV 188 é nacional)?
- **A3** Cap de custo IA — definir budget mensal por user
- **U2/U3** Health Coach mobile e Onboarding web — implementar ou remover?
- **Dead code** — autorizar remoção de `deploy/hostgator/`, `fly.toml`, `unity/`, `beeyes-design/`, `client/src/components/examples/`, duplicatas mobile auth?

### Fase 3 — Performance e escalabilidade (2-3 dias)
- Indices restantes (D)
- Refatorar `getDirectConversations` 
- Paginação cursor-based
- Cache daily briefing
- Streaming SSE real no mobile

### Fase 4 — IA robusta (2-3 dias)
- `parseAIActions` → function calling + Zod fallback
- Janela de contexto com truncamento
- Cap de custo persistente
- Detector de crise

### Fase 5 — Documentação final + Data Safety (1-2 dias)
- README operacional
- Privacy Policy expandida
- Data Safety form preenchido
- Checklist de submissão

---

## Métricas finais (a manter no relatório de entrega)

- 31/31 unit tests ✓
- tsc ✓
- 0 console.log de debug acidental
- 0 `.only`/`.skip` esquecidos
- 0 secrets em código (a única chave Firebase é "pública por design", mas será regenerada)
- 14/17 features com paridade web↔mobile

Próximo passo: aguardando suas respostas nas decisões da Fase 2 para liberar Fase 1 + 2 em paralelo.
