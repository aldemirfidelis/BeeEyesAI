# Auditoria Final — Bee (BeeEyesAI) antes da Play Store

Data: 2026-05-16
Última atualização: 2026-05-16 (pós-correções)
Status do projeto: **🟢 PRONTO PARA TESTE INTERNO** — testes 44/44 ✓, tsc limpo ✓, 8 commits aplicados
Bloqueadores Play Store remanescentes: **3 ações humanas** (rotacionar Firebase key, rodar EAS Build, apontar URL no Console)

> **Resumo das correções já aplicadas (8 commits, 26 arquivos novos/modificados, ~1500 linhas):**
> 1. `chore(security): remove google-services.json from git, fix Play Store blockers`
> 2. `feat(server): security hardening for Play Store release` (HSTS, CORS whitelist, rate limit auth, timing attack, Google ID verify, DELETE /api/me, media caps, /legal/* routes, JWT cookie httpOnly backend)
> 3. `feat(db): índices faltantes + FK em messages.replied_to_message_id`
> 4. `refactor(web): migrate JWT auth from localStorage to httpOnly cookie`
> 5. `docs: auditoria final pré-Play Store`
> 6. `chore: remove dead code, orphan files e deps NPM zombies`
> 7. `feat(bee): detecção de crise + cap de custo IA por usuário/mês`
> 8. `chore(android): remove permissão SYSTEM_ALERT_WINDOW`

Ver [`PLAY_STORE_CHECKLIST.md`](PLAY_STORE_CHECKLIST.md) para a checklist completa de submissão com Data Safety mapeado.

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

✅ **APLICADO** (commit `ea3ecd2`): removido de `mobile/app.json`.

### B2. Release Android assinado com debug.keystore — `mobile/android/app/build.gradle:115`
```gradle
release {
    signingConfig signingConfigs.debug  // ← bloqueador
}
```
Play Console rejeita AAB com debug keystore. **Decisão necessária:** EAS Build (recomendado, gerencia keystore na nuvem) ou keystore manual local.

⚠️ **PENDENTE (ação humana):** decisão tomada — usar EAS Build. Rodar:
```sh
cd mobile && eas build --platform android --profile production
```
A Expo gera/usa keystore na nuvem automaticamente. O AAB resultante é submetido ao Play Console. `mobile/eas.json` já tem profile `production` com `autoIncrement: true`.

### B3. `mobile/google-services.json` versionado no Git
Confirmado em `git ls-files`. Contém `api_key: AIzaSyAl3xfCBcvIB8RRDho3Du3VKZHHfslSilU`. Embora API key Android seja "pública por design", expõe a app de uso por terceiros. `.gitignore` não cobre.
**Fix:** `git rm --cached mobile/google-services.json` + adicionar ao `.gitignore` + rotacionar chave + documentar setup local (`eas secret:create`).

✅ **PARCIALMENTE APLICADO** (commit `ea3ecd2`):
- `git rm --cached mobile/google-services.json` feito.
- `.gitignore` atualizado para cobrir `google-services.json`, `*.keystore`, `*.jks`, `mobile/.env`, `uploads/`.
- Template `mobile/google-services.example.json` criado.
- ⚠️ **PENDENTE (ação humana):** rotacionar a chave Firebase no Console e baixar novo google-services.json local. A chave antiga continua no histórico git.

### B4. Privacy Policy e Termos sem URL pública
Textos existem em `mobile/lib/legalTexts.ts` e `client/src/lib/legalTexts.ts` (duplicados), mas Play Console exige **URL pública**. Sem URL ⇒ submissão bloqueada.
**Decisão necessária:** hospedar onde? (sugestões: `https://app.beeeyes.ai/privacy`, `https://beeeyes.net/privacy`). Posso gerar os HTMLs e rota Express servindo de `/legal/privacy` e `/legal/terms`.

✅ **APLICADO** (commit `9d9ca0c`): `server/routes/legal.ts` cria:
- `GET /legal/privacy` (HTML estilizado em PT-BR cobrindo LGPD)
- `GET /legal/privacy.json` (mesmo texto em JSON)
- `GET /legal/terms` + `/legal/terms.json`

Versão consolidada e expandida (mais completa que os textos inline). Inclui menção a IA, ads, exclusão de conta via app, contato `suporte@beeeyes.net`.

⚠️ **PENDENTE (ação humana):** colocar `https://<seu-dominio>/legal/privacy` no campo "Privacy Policy" do Play Console.

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

### Fase 1 — Bloqueadores Play Store + segurança crítica ✅ APLICADA

Aplicados em 5 commits sequenciais. Resultado:

1. ✅ **B1** Removido `usesCleartextTraffic: true`
2. ✅ **B3** `mobile/google-services.json` untracked + `.gitignore` atualizado + template `.example.json`
3. ✅ **U1** Mojibake `mobile/app/onboarding.tsx:18,72` corrigido (separadores ASCII limpos)
4. ✅ **D1, D2, D3, D4** Migration `0014_play_store_indexes.sql` + `ensureDatabaseCompatibility` aplicam todos os índices e FK; getAllUsersExcept comentado como código morto a remover
5. ✅ **S2** CORS por whitelist (env `CORS_ALLOWED_ORIGINS`); dev libera localhost
6. ✅ **S3** Rate limit em `/login` (5/15min), `/register` (5/h), `/password-reset/request` (3/h IP + 3/h email), `/social` (10/15min)
7. ✅ **S5** Log de link removido em produção (`NODE_ENV === production`); timing attack mitigado com dummy bcrypt + dummy delay
8. ✅ **S7** Google ID verify via `tokeninfo?id_token=` + audience check (suporta tanto idToken quanto accessToken)
9. ✅ **S8** `DELETE /api/me` (LGPD) com confirmação de senha + `hardDeleteUser` no storage
10. ✅ **Headers** HSTS adicionado (max-age 1 ano + preload); CSP `unsafe-inline` mantido em style-src (refatoração de nonces fica para F3)
11. ✅ **Permissions** SYSTEM_ALERT_WINDOW removida (zero uso confirmado); LOCATION e RECORD_AUDIO validadas como em uso real e mantidas
12. ✅ **Validations** `server/media.ts` agora limita imagem decoded a 8MB + MIME whitelist (`jpg/jpeg/png/webp/gif`)
13. ✅ **S1** JWT no `localStorage` → cookie httpOnly (refactor backend completo + 7 arquivos web)

**Validação Fase 1:** 44/44 testes passam, tsc limpo.

### Fase 2 — Decisões de negócio ✅ PARCIALMENTE APLICADA

Resolvidas:
- ✅ **B2** EAS Build escolhido (`mobile/eas.json` profile production já configurado)
- ✅ **B4** Servido por Express em `/legal/privacy` e `/legal/terms` com texto consolidado em PT-BR (commit `9d9ca0c`)
- ✅ **S1** JWT migrado para cookie httpOnly (commit `9d9ca0c` + `75b20a4`)
- ✅ **A2** Detector de crise em `server/ai-crisis.ts` (CVV 188, SAMU 192, chat CVV); hook em `/api/chat` antes do LLM; 6 testes (commit `17228d9`)
- ✅ **A3** Cap mensal de custo IA em `server/aiBudget.ts` ($5/user/mês default, configurável); estimativa gpt-4o-mini; exemption list; 7 testes (commit `17228d9`)
- ✅ **Dead code parcial** (commit anterior): 5 deps NPM zombies removidas, `client/src/{components,pages}/examples`, `mobile/features/auth/screens/{Login,Register}Screen.tsx`, `mobile/hooks/useMissions.ts` deletados

Pendentes (decisão tua):
- ⚠️ **S6** Toggle "Bee pode usar dados pessoais nas conversas" em Settings — não aplicado; existe `bee_conversation_contexts.personalizationEnabled` no schema mas não é honrado no prompt. Refactor moderado.
- ⚠️ **S4** Criptografia AES-256-GCM para `user_integrations.accessToken`/`refreshToken` (Google Calendar). Esforço médio + migration de backfill.
- ⚠️ **A1** Migrar `parseAIActions` para function calling nativo do OpenAI + Zod validation. Esforço alto.
- ⚠️ **U2** Health Coach já existe na web; precisa criar paridade mobile OU remover do web. Decisão de produto.
- ⚠️ **U3** Onboarding obrigatório no web (mobile já tem). Decisão de produto.
- ⚠️ **Dead code restante**: `deploy/hostgator/`, `unity/`, `beeyes-design/`, `icons-colmeia/` — não tocado (sem autorização para mover, e usuário pode usar `beeyes-design/`).
- ⚠️ **Sentry / Crashlytics** — não integrado. Bom adicionar antes do release.

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
