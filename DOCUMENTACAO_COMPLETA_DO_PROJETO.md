# Documentação Completa do Projeto BeeEyesAI

Documento gerado a partir da leitura do projeto local em `d:\Projetos\BeeEyesAI`.

Base analisada: arquivos versionados pelo Git, configurações de raiz, backend, frontend web, aplicativo mobile Expo, migrations, testes e arquivos de deploy. Pastas geradas ou de dependências como `node_modules`, `dist`, `.local`, caches e artefatos de build foram consideradas apenas como contexto operacional, não como código-fonte principal.

Observação importante: o arquivo `PROJECT_DOCUMENTATION.md` aparece como versionado, mas estava deletado no worktree atual no momento da análise. Esta documentação não recria nem reverte esse arquivo.

## 1. Visão Geral

O BeeEyesAI é um sistema de assistente pessoal/social com IA, gamificação, comunidade, mensagens, feed social e ferramentas de produtividade chamadas de Colmeia. O produto existe em três superfícies principais:

| Superfície | Tecnologia | Função |
| --- | --- | --- |
| Web | React + Vite + Wouter + TanStack Query + Tailwind/shadcn | Experiência principal em navegador, com chat, feed, amigos, comunidades, inbox, configurações, painel admin e reset de senha. |
| Mobile | Expo Router + React Native + Zustand + TanStack Query | Aplicativo nativo com chat, feed, Colmeia, inbox, comunidades, amigos, perfil, humor, notificações e configurações. |
| Backend | Express + TypeScript + Drizzle ORM + Neon/PostgreSQL | API REST/SSE, autenticação JWT, IA, banco, integrações externas, observabilidade e regras de negócio. |

Objetivo principal: oferecer uma assistente chamada BeeEyes que combina conversa com IA, acompanhamento de hábitos, rede social leve, comunidades e ferramentas pessoais de calendário, finanças, notas e alarmes.

Problema que resolve: centraliza apoio pessoal, organização diária, notificações inteligentes, interações sociais e registro de progresso em um único app com uma assistente personalizada.

Público-alvo inferido: usuários finais que desejam suporte pessoal, motivacional e organizacional em português, com elementos sociais e gamificação. Não há documento formal de personas no projeto; portanto, público-alvo detalhado é necessário validar.

Fluxo geral de uso:

1. Usuário cria conta por e-mail/senha ou entra com Google.
2. Usuário passa pelo onboarding definindo objetivos, rotina, perfil de trabalho, período ativo e interesses.
3. Sistema libera chat com IA, feed social, amigos, comunidades, Colmeia e configurações.
4. Chat envia mensagens para `/api/chat`, recebe resposta por SSE e pode disparar ações como criar evento, registrar finança, salvar nota, criar alarme ou buscar notícias.
5. Ações do usuário geram XP, streak, conquistas, notificações e sugestões.
6. Dados persistem em PostgreSQL via Drizzle/Neon; parte das preferências mobile fica em SecureStore.

## 2. Estrutura Completa de Pastas

| Pasta | Função | Tipo |
| --- | --- | --- |
| `.agents` | Skills locais e instruções auxiliares para agentes. Inclui skill Neon. | Contexto/automação local |
| `.claude` | Configurações e locks de tarefas automatizadas locais. | Configuração local |
| `.github/workflows` | Workflow de deploy GitHub Actions. | CI/CD |
| `.local` | Saída local de observabilidade em runtime, como métricas/traces. | Gerado localmente |
| `.vscode` | Recomendações e configurações do VS Code. | Configuração |
| `_svg_convert` | Utilitário Node separado para conversão/processamento de SVG. | Ferramenta auxiliar |
| `beeyes-design` | Mockup/protótipo visual independente em Vite/React com componentes UI e imagens. | Design/protótipo |
| `client` | Aplicação web React. | Frontend web |
| `client/public` | Assets públicos do web app, manifest e ícones. | Assets web |
| `client/src/components` | Componentes visuais reutilizáveis da web. | UI web |
| `client/src/components/ui` | Primitivos shadcn/Radix usados pela web. | UI base |
| `client/src/features/home` | Módulos da tela Home web: auth, chat, Colmeia, feed, amigos, comunidades, settings. | Funcionalidades web |
| `client/src/hooks` | Hooks web compartilhados. | Hooks |
| `client/src/lib` | Utilitários web de API, tema, imagens, textos legais, medalhas e classes. | Utilitários |
| `client/src/pages` | Páginas roteadas web. | Telas web |
| `deploy` | Configurações e scripts de deploy para HostGator e DigitalOcean. | Deploy |
| `icons-colmeia` | Ícones originais/avulsos das ferramentas Colmeia. | Assets |
| `migrations` | Migrations Drizzle/PostgreSQL e snapshots. | Banco |
| `mobile` | Aplicativo Expo/React Native. | Mobile |
| `mobile/android` | Projeto Android nativo gerado/prebuild do Expo. | Mobile nativo |
| `mobile/app` | Rotas Expo Router. | Navegação mobile |
| `mobile/assets` | Ícones, splash e imagens do app mobile. | Assets mobile |
| `mobile/components` | Componentes reutilizáveis mobile. | UI mobile |
| `mobile/features` | Telas mobile por domínio: auth, chat, Colmeia, comunidades, feed, amigos, inbox, humor, notícias, notificações, perfil, settings. | Funcionalidades mobile |
| `mobile/hooks` | Hooks mobile de chat, humor e recursos auxiliares. | Hooks mobile |
| `mobile/lib` | API, i18n, tema, notificações, Google Auth, social, medalhas e textos legais. | Utilitários mobile |
| `mobile/locales` | Traduções `pt`, `en`, `es`. | Internacionalização |
| `mobile/stores` | Zustand stores de autenticação, chat e UI. | Estado global mobile |
| `server` | Backend Express/TypeScript. | Backend |
| `server/api` | Helpers de erro, resposta e async handler. | Backend utilitário |
| `server/middleware` | Middlewares de autenticação e admin. | Backend segurança |
| `server/observability` | Logs estruturados, métricas, traces e persistência local. | Observabilidade |
| `server/routes` | Módulos de rotas REST/SSE. | API |
| `shared` | Código compartilhado: schema Drizzle/Zod, envelope de API e regras de unlock. | Compartilhado |
| `tests` | Testes unitários Node e E2E Playwright. | Testes |

Pastas mais importantes: `server`, `shared`, `client/src`, `mobile/app`, `mobile/features`, `mobile/lib`, `mobile/stores`, `migrations`.

Conexão entre pastas:

- `shared/schema.ts` define tabelas e tipos usados por `server/storage.ts` e validações de rota.
- `server/routes/*` expõe APIs consumidas por `client/src/pages/Home.tsx`, componentes web em `client/src/features/home/*` e telas mobile em `mobile/features/*`.
- `client/src/lib/queryClient.ts`, `client/src/features/home/shared/api.ts` e `mobile/lib/api.ts` centralizam chamadas HTTP.
- `mobile/app/*` funciona como camada de roteamento que reexporta telas de `mobile/features/*`.
- `migrations` acompanha o schema Drizzle usado por `server/db.ts` e `drizzle.config.ts`.

## 3. Tecnologias, Scripts e Dependências

### Scripts da raiz

| Script | Comando | Uso |
| --- | --- | --- |
| `dev` | `cross-env NODE_ENV=development tsx server/index.ts` | Sobe backend Express com Vite em desenvolvimento. |
| `build` | `vite build && esbuild server/index.ts ... --outdir=dist` | Gera web em `dist/public` e backend bundle em `dist`. |
| `start` | `cross-env NODE_ENV=production node dist/index.js` | Executa build de produção. |
| `check` | `tsc` | Typecheck TypeScript. |
| `test` | `tsx --test tests/**/*.test.ts` | Testes unitários Node. |
| `db:push` | `drizzle-kit push` | Aplica schema no banco. |
| `db:generate` | `drizzle-kit generate` | Gera migrations Drizzle. |
| `e2e` | `playwright test` | Testes Playwright. |
| `e2e:headed` | `playwright test --headed` | Playwright com navegador visível. |

### Dependências principais da raiz

| Dependência | Uso |
| --- | --- |
| `express` | Servidor HTTP/API. |
| `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless` | ORM, migrations e conexão Neon/PostgreSQL. |
| `jsonwebtoken`, `bcryptjs` | Autenticação JWT e senha. |
| `openai`, `@google/generative-ai`, `groq-sdk` | Integrações de IA. Cerebras usa cliente OpenAI compatível. |
| `zod`, `drizzle-zod` | Validação e schemas derivados. |
| `react`, `react-dom`, `vite`, `wouter`, `@tanstack/react-query` | Frontend web. |
| `@radix-ui/*`, `lucide-react`, `framer-motion`, `tailwindcss`, `class-variance-authority` | UI web, ícones, animações e design system. |
| `playwright`, `tsx`, `typescript`, `esbuild` | Testes, execução TS, build e typecheck. |

### Dependências mobile

Mobile usa Expo 55, React 19, React Native 0.83.4, Expo Router, Zustand, TanStack Query, Axios, SecureStore, Notifications, ImagePicker, ImageManipulator, Audio/FileSystem, Location, AuthSession, Google Sign-In nativo, i18next, Reanimated, Gesture Handler, FlashList, LinearGradient, SVG e Feather icons.

### Variáveis de ambiente

Variáveis identificadas pelo código/configurações:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Obrigatória para Drizzle/Neon. |
| `JWT_SECRET` | Segredo JWT; obrigatório em produção. Em dev há fallback. |
| `PORT` | Porta do Express; padrão `5000`. |
| `OPENAI_API_KEY` | OpenAI, chat/análise/transcrição quando disponível. |
| `GROQ_API_KEY` | Fallback Groq. |
| `GEMINI_API_KEY` | Fallback Gemini. |
| `CEREBRAS_API_KEY` | Fallback Cerebras compatível com OpenAI. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | OAuth Google Calendar no backend. |
| `RESEND_API_KEY` | Envio de e-mail de recuperação de senha; sem ela o link é logado. |
| `APP_BASE_URL`, `CLIENT_BASE_URL` | Links de reset/callback, quando configurados. |
| `VITE_GOOGLE_CLIENT_ID` | Login Google no web build. |
| `EXPO_PUBLIC_API_URL` | Base URL do app mobile. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Login Google mobile. |

Não foram documentados valores secretos. Arquivos como `.env`, `mobile/eas.json` e `mobile/google-services.json` devem ser tratados com cuidado.

## 4. Banco de Dados

Banco principal: PostgreSQL via Neon Serverless, usando Drizzle ORM.

Arquivo de schema principal: `shared/schema.ts`.

Migrations:

| Arquivo | Função |
| --- | --- |
| `migrations/0000_bent_madame_web.sql` | Base inicial do schema. |
| `migrations/0001_anonymous_profile_visits.sql` | Adiciona suporte a visitas anônimas. |
| `migrations/0002_notification_reads.sql` | Leitura de notificações por usuário. |
| `migrations/0003_post_images_and_community_members.sql` | Imagens em posts e membros de comunidades. |
| `migrations/0004_profile_onboarding_testimonials.sql` | Onboarding/perfil/depoimentos. |
| `migrations/0005_alarm_reminders.sql` | Alarmes/lembretes. |
| `migrations/meta/*` | Snapshots e journal do Drizzle. |

Tabelas principais:

| Tabela | Campos principais | Relacionamentos/regras |
| --- | --- | --- |
| `users` | `id`, `username`, `email`, `password`, `displayName`, `gender`, `bio`, `language`, `onboardingCompleted`, `avatarUrl`, `googleId`, `level`, `xp`, `currentStreak`, `longestStreak`, `totalMessagesCount`, `personalityProfile`, `expoPushToken`, `city`, `lastDailyBriefingDate`, `lastActiveAt`, `createdAt`, `isAdmin` | Usuário central. `username`, `email`, `googleId` únicos. |
| `password_reset_tokens` | `id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt` | Reset de senha. Token hash único, expira em 1h. |
| `user_personality` | `userId`, `traits`, `communicationStyle`, `interests`, `recentTopics`, `lastAnalyzed` | Perfil dinâmico de IA. Um por usuário. |
| `messages` | `userId`, `role`, `content`, `metadata`, `createdAt` | Histórico de chat e notificações inteligentes. |
| `notification_reads` | `userId`, `notificationId`, `readAt` | Único por usuário/notificação. |
| `mood_entries` | `userId`, `mood`, `note`, `createdAt` | Registro de humor. |
| `achievements` | `userId`, `type`, `title`, `description`, `unlockedAt` | Conquistas; único por `userId/type`. |
| `posts` | autor, conteúdo, imagem, contadores, análise IA | Feed social. |
| `post_likes`, `post_comments`, `comment_likes` | relações entre usuários, posts e comentários | Likes e comentários do feed. |
| `user_connections` | requester, addressee, status, createdAt | Amizades/solicitações. |
| `direct_messages` | sender, receiver, content, readAt | Inbox/DM. |
| `testimonials` | author, target, content, createdAt | Depoimentos no perfil. |
| `communities` | owner, nome, descrição, cor, privacidade, contadores | Comunidades públicas/privadas. |
| `community_members` | community, user, role, status | Dono/admin/member, pending/active. |
| `community_posts`, `community_post_likes`, `community_post_comments`, `community_post_comment_likes` | posts, likes e comentários em comunidades | Feed interno de comunidade. |
| `calendar_events` | user, title, description, start/end, source, externalId | Calendário Colmeia e Google Calendar. |
| `finance_transactions` | user, type, amountCents, category, occurredAt | Finanças mensais. |
| `user_integrations` | user, provider, access/refresh token, expiry | Integrações externas, hoje Google Calendar. |
| `notes` | user, title, content | Notas Colmeia. |
| `alarm_reminders` | user, title, scheduledAt, repeat, kind, active, paused, reactivation | Alarmes, medicamentos e compromissos. |

Regras de dados relevantes:

- XP de nível: `xpForLevel(level) = level * 100 + (level - 1) * 50`.
- Unlocks: nível 2 conexões, nível 3 visitas anônimas, nível 4 badge, nível 5 IA avançada.
- `ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL = 3`.
- Streak: atividade em menos de 24h mantém; entre 24h e 48h incrementa; acima disso reinicia em 1.
- `server/db.ts` executa `ensureDatabaseCompatibility()` com `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS` para compatibilidade em bancos existentes.
- Comunidade privada gera membro `pending`; pública gera membro `active`.
- Dono de comunidade é inserido como membro automaticamente.

Deploy alternativo HostGator:

- `deploy/hostgator/mysql_schema.sql` é um schema MySQL reduzido para `users`, `messages`, `missions`, `mood_entries`, `achievements`.
- APIs PHP em `deploy/hostgator/api/*.php` implementam uma superfície menor que a API Express.
- Necessário validar se esse deploy ainda está em uso, pois o backend principal atual é Express/PostgreSQL.

## 5. Backend, APIs e Serviços

### Arquitetura backend

`server/index.ts` cria o app Express, desliga `x-powered-by`, aplica CORS permissivo `*`, headers de segurança, request context, parsers JSON/urlencoded até 25mb, serve `/uploads`, garante compatibilidade do banco, registra rotas, centraliza tratamento de erro, usa Vite em desenvolvimento e arquivos estáticos em produção.

Autenticação:

- `server/auth.ts` gera JWT com validade de 30 dias.
- Senhas usam bcrypt com 12 rounds.
- `requireAuth` valida Bearer token, define `req.userId` e atualiza atividade.
- `requireAdmin` valida token e `users.isAdmin`.

Observabilidade:

- `request-context.ts` cria `requestId`, logger por requisição, métrica de duração e trace.
- `metrics.ts` mantém contadores em memória e exporta formato Prometheus.
- `tracing.ts` persiste traces JSONL.
- `persistence.ts` escreve snapshots em `.local/observability`.
- `logger.ts` escreve logs JSON estruturados.

Uploads/mídia:

- `server/media.ts` valida data URL `data:image/*;base64`, salva em `uploads/YYYY-MM/uuid.ext` e retorna `/uploads/...`.

Push:

- `server/push.ts` envia mensagens para Expo Push API (`https://exp.host/--/api/v2/push/send`).
- Falhas de push são não bloqueantes.
- Há envio individual e para membros de comunidade.

### Rotas de sistema

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/system/health` | Health check. |
| `GET` | `/api/system/metrics` | Snapshot de métricas. |
| `GET` | `/api/system/metrics/export` | Métricas Prometheus. |
| `GET` | `/api/system/traces` | Traces recentes. |

### Rotas admin

Todas exigem admin.

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Métricas gerais. |
| `GET` | `/api/admin/growth` | Crescimento. |
| `GET` | `/api/admin/dau` | Usuários ativos diários. |
| `GET` | `/api/admin/top-users` | Ranking. |
| `GET` | `/api/admin/recent-users` | Usuários recentes. |
| `GET` | `/api/admin/streaks` | Distribuição de streak. |
| `GET` | `/api/admin/heatmap` | Heatmap de atividade. |
| `GET` | `/api/admin/users` | Lista paginada. |
| `PATCH` | `/api/admin/users/:id/toggle-admin` | Alterna admin. |

### Rotas de autenticação e usuário

| Método | Rota | Entrada | Saída/efeito |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `username`, `email`, `password`, `displayName`, `gender` | Cria usuário, hash de senha, token, conquista `early_adopter`. |
| `POST` | `/api/auth/social` | `provider`, `accessToken` | Valida Google userinfo, cria/acha usuário, token. |
| `POST` | `/api/auth/login` | `username` ou e-mail, `password` | Token e usuário. |
| `POST` | `/api/auth/password-reset/request` | `email` | Cria token hash, envia via Resend ou loga link. |
| `POST` | `/api/auth/password-reset/confirm` | `token`, nova senha | Atualiza senha e marca token usado. |
| `GET` | `/api/me` | Bearer token | Usuário atual. |
| `PATCH` | `/api/me/avatar` | data URL ou `null` | Salva/remove avatar. |
| `PATCH` | `/api/me/preferences` | displayName, bio, language, onboarding, anonymous | Atualiza preferências; visitas anônimas dependem de nível 3. |
| `PATCH` | `/api/me/password` | senha atual e nova | Troca senha. |
| `POST` | `/api/me/onboarding` | objetivos/rotina/perfil/interesses | Salva traits/interests e marca onboarding. |

Validações principais: username 3-30, senha forte com tamanho mínimo e letra/número, e-mail obrigatório na rota de registro, token reset expira, senha atual precisa conferir.

### Rotas de chat, IA, notificações e mensagens

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/messages?limit=` | Lista histórico. |
| `GET` | `/api/score` | Score de atividade semanal. |
| `GET` | `/api/notifications/intelligent` | Notificações inteligentes geradas por IA/dados. |
| `GET` | `/api/notifications/center` | Centro de notificações com estado lido. |
| `POST` | `/api/notifications/push-token` | Salva Expo token. |
| `DELETE` | `/api/notifications/push-token` | Remove Expo token. |
| `POST` | `/api/notifications/read` | Marca notificação lida. |
| `POST` | `/api/chat` | Chat SSE com IA e ações. |
| `GET` | `/api/proactive` | Mensagem proativa com cooldown. |
| `GET` | `/api/app-tip` | Dica de app com cooldown. |
| `PATCH` | `/api/messages/:id` | Atualiza conteúdo/metadados. |
| `POST` | `/api/news/summarize` | Resume notícia. |
| `POST` | `/api/transcribe` | Transcreve áudio base64. |

`POST /api/chat`:

- Valida conteúdo.
- Aplica rate limit por usuário: 60 mensagens/hora.
- Carrega usuário, personalidade, histórico, eventos e alarmes.
- Salva mensagem do usuário.
- Chama `streamChat` e envia eventos SSE `chunk`, `achievement_unlocked`, `news_fetched`, `event_created`, `finance_logged`, `note_saved`, `alarm_created`, `done`.
- Extrai JSON de ações da IA e também infere ações determinísticas em `ai-actions.ts`.
- Atualiza streak, XP, personalidade e histórico.

### Rotas sociais

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/achievements` | Conquistas do usuário. |
| `GET` | `/api/feed` | Feed `for-you` ou `friends`. |
| `GET` | `/api/posts` | Posts. |
| `POST` | `/api/posts` | Cria post com texto/imagem. |
| `PATCH` | `/api/posts/:id` | Edita post próprio. |
| `DELETE` | `/api/posts/:id` | Remove post próprio. |
| `POST` | `/api/posts/:id/like` | Alterna like. |
| `GET` | `/api/posts/:id/comments` | Lista comentários. |
| `POST` | `/api/posts/:id/comments` | Comenta. |
| `POST` | `/api/comments/:id/like` | Like em comentário. |
| `GET` | `/api/news` | RSS Google News. |
| `GET` | `/api/connections/suggestions` | Sugestões de conexão. |
| `GET` | `/api/connections` | Conexões. |
| `GET` | `/api/connections/incoming` | Solicitações recebidas. |
| `GET` | `/api/connections/sent` | Solicitações enviadas. |
| `POST` | `/api/connections` | Solicita conexão. |
| `DELETE` | `/api/connections/to/:targetUserId` | Cancela solicitação. |
| `DELETE` | `/api/connections/with/:targetUserId` | Remove amizade. |
| `PUT` | `/api/connections/:id/accept` | Aceita solicitação. |
| `PUT` | `/api/connections/:id/reject` | Rejeita solicitação. |
| `GET` | `/api/friends` | Amigos. |
| `GET` | `/api/connections/accepted` | Conexões aceitas. |
| `GET` | `/api/dm/conversations` | Conversas DM. |
| `GET` | `/api/dm/:userId` | Thread com usuário. |
| `POST` | `/api/dm/:userId` | Envia DM. |
| `DELETE` | `/api/dm/:userId` | Limpa conversa. |
| `GET` | `/api/users/search` | Busca usuários. |
| `GET` | `/api/users/:userId/testimonials` | Depoimentos. |
| `POST` | `/api/users/:userId/testimonials` | Cria depoimento. |
| `GET` | `/api/users/:userId/profile` | Perfil público. |
| `POST` | `/api/users/:userId/visit` | Registra visita/perfil. |

Regras: post aceita conteúdo até limite definido na rota e/ou imagem; imagem base64 é salva em `/uploads`; primeiro post gera conquista; DMs têm limite de caracteres; visita pode ser anônima somente com unlock.

### Rotas de comunidades

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/communities` | Lista/busca comunidades. |
| `POST` | `/api/communities` | Cria comunidade. |
| `GET` | `/api/communities/mine` | Comunidades do usuário. |
| `GET` | `/api/communities/:id` | Detalhe. |
| `PATCH` | `/api/communities/:id` | Edita comunidade. |
| `DELETE` | `/api/communities/:id` | Remove comunidade. |
| `GET` | `/api/communities/:id/members` | Membros. |
| `POST` | `/api/communities/:id/join` | Entrar/solicitar entrada. |
| `GET` | `/api/communities/:id/requests` | Pedidos pendentes. |
| `POST` | `/api/communities/:id/requests/:userId/approve` | Aprova pedido. |
| `DELETE` | `/api/communities/:id/requests/:userId` | Rejeita pedido. |
| `POST` | `/api/communities/:id/invite` | Convida amigo. |
| `POST` | `/api/communities/:id/leave` | Sai da comunidade. |
| `GET` | `/api/communities/:id/posts` | Posts da comunidade. |
| `POST` | `/api/communities/:id/posts` | Cria post. |
| `POST` | `/api/communities/posts/:postId/like` | Like. |
| `DELETE` | `/api/communities/posts/:postId` | Remove post. |
| `GET` | `/api/communities/posts/:postId/comments` | Comentários. |
| `POST` | `/api/communities/posts/:postId/comments` | Comenta. |
| `POST` | `/api/communities/comments/:commentId/like` | Like em comentário. |
| `POST` | `/api/communities/posts/:postId/recommend` | Recomenda post no feed. |

### Rotas Colmeia

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/colmeia/google/auth-url` | URL OAuth Google Calendar. |
| `GET` | `/api/colmeia/google/callback` | Callback OAuth. |
| `GET` | `/api/colmeia/google/status` | Status da integração. |
| `DELETE` | `/api/colmeia/google/disconnect` | Desconecta Google Calendar. |
| `GET` | `/api/colmeia/events` | Lista eventos; sincroniza Google se conectado. |
| `POST` | `/api/colmeia/events` | Cria evento local/Google. |
| `PUT` | `/api/colmeia/events/:id` | Atualiza evento. |
| `DELETE` | `/api/colmeia/events/:id` | Remove evento. |
| `GET` | `/api/colmeia/finance` | Transações e resumo mensal. |
| `POST` | `/api/colmeia/finance` | Registra receita/despesa. |
| `DELETE` | `/api/colmeia/finance/:id` | Remove transação. |
| `GET` | `/api/colmeia/alarms` | Lista alarmes. |
| `POST` | `/api/colmeia/alarms` | Cria alarme. |
| `PATCH` | `/api/colmeia/alarms/:id` | Atualiza/pausa/reativa. |
| `DELETE` | `/api/colmeia/alarms/:id` | Remove alarme. |
| `POST` | `/api/colmeia/alarms/due` | Consulta/processa vencidos. |
| `GET` | `/api/colmeia/notes` | Lista notas. |
| `POST` | `/api/colmeia/notes` | Cria nota. |
| `PUT` | `/api/colmeia/notes/:id` | Atualiza nota. |
| `DELETE` | `/api/colmeia/notes/:id` | Remove nota. |

### Daily briefing

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/daily-briefing` | Gera briefing diário com clima, interesses e dados do usuário. |
| `POST` | `/api/daily-briefing/dismiss` | Marca como dispensado/feito no dia. |
| `PATCH` | `/api/daily-briefing/city` | Atualiza cidade do usuário. |

Integrações: Open-Meteo geocoding/forecast, IA para texto personalizado, geolocalização no mobile/web quando permitida.

### Humor

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/mood?days=` | Lista registros de humor. |
| `POST` | `/api/mood` | Cria registro, atualiza streak e conquista inicial. |

## 6. Integração com IA

Arquivos principais: `server/ai.ts`, `server/ai-actions.ts`, `server/routes/messages.ts`, `mobile/hooks/useChat.ts`, `client/src/pages/Home.tsx`.

Serviços/modelos identificados:

- OpenAI: chat/análise/transcrição. Transcrição usa `whisper-1`.
- Groq: fallback, incluindo `llama-3.1-8b-instant`.
- Gemini: fallback com `gemini-2.0-flash-lite`.
- Cerebras: fallback via cliente OpenAI compatível, incluindo `llama-3.3-70b`.

Prompt:

- Montado em `buildSystemPrompt`.
- Persona: BeeEyes, assistente feminina em português.
- Inclui usuário, perfil de personalidade, interesses, memórias, progresso, streak, nível, histórico e contexto Colmeia.
- Regra de resposta: respostas curtas, úteis e personalizadas.
- Permite JSON de ações: `achievement`, `fetch_news`, `create_event`, `log_finance`, `save_note`.

Modos de resposta:

- `apoio`: acolhimento.
- `estrategico`: organização/planejamento.
- `cobranca`: cobrança gentil quando há procrastinação/inatividade.

Ações de IA:

- `parseAIActions` extrai JSON embutido da resposta.
- `ai-actions.ts` também infere comandos explícitos em português para reduzir dependência do modelo.
- Ações criam eventos, transações, notas, alarmes ou cards de notícia.

Dados enviados para IA:

- Mensagem do usuário.
- Histórico recente.
- Perfil e personalidade.
- Interesses/onboarding.
- Dados agregados de calendário/alarme/finanças quando relevantes.

Respostas exibidas:

- Web: Home/chat via stream SSE.
- Mobile: `useChat` + `ChatScreen` via stream tratado após leitura do texto SSE.

Tratamento de erros:

- Fallbacks entre provedores.
- Mensagens amigáveis no frontend.
- Rate limit 429 para excesso de chat.
- Transcrição rejeita áudio pequeno ou padrões de alucinação/no speech.

Pontos de melhoria:

- `parseAIActions` usa regex/string parsing e pode falhar com JSON aninhado ou chaves dentro de strings.
- Prompts poderiam ser versionados e separados por domínio.
- Contexto de conversa poderia ter janela/resumo persistente mais explícito.
- Resposta SSE mobile é lida com `response.text()`, então o streaming visual real pode ficar limitado dependendo da plataforma.

## 7. Frontend Web

### Rotas web

| Rota | Arquivo | Objetivo | Proteção |
| --- | --- | --- | --- |
| `/` | `client/src/pages/Home.tsx` | App principal: auth, onboarding, chat, feed, Colmeia, amigos, inbox, comunidades, settings. | Controlada por token local. |
| `/reset-password` | `client/src/pages/ResetPassword.tsx` | Confirma reset de senha por token. | Pública. |
| `/admin` | `client/src/pages/Admin.tsx` | Painel admin com token manual. | APIs exigem admin. |
| `*` | `client/src/pages/not-found.tsx` | 404. | Pública. |

`client/src/App.tsx` registra rotas Wouter e providers: `QueryClientProvider`, `TooltipProvider`, `Toaster`.

### Tela Home web

Arquivo: `client/src/pages/Home.tsx`.

Responsabilidades:

- Autenticação por localStorage `bee_token`.
- Carregar `/api/me` e `/api/messages`.
- Exibir `AuthScreen` se não autenticado.
- Exibir `OnboardingScreen` se autenticado sem onboarding.
- Gerenciar chat SSE, mensagens, cards de ação, conquistas, score, humor, daily briefing.
- Carregar feed, amigos, comunidades, inbox e perfil.
- Controlar layout responsivo com sidebar desktop e navegação mobile.
- Persistir foto de perfil local em `bee_profile_photo`.

Estados importantes: token, user, messages, input, isTyping, streaming, eyeExpression, achievements, activeMobileTab, activeSidebarTab, feed mode, posts, friends, communities, DMs, settings, daily briefing, modais.

Ações do usuário: login/register/logout, enviar mensagem, resolver cards, curtir/comentar/postar, criar comunidade, entrar/sair, convidar, aprovar/rejeitar, enviar DM, editar preferências, trocar avatar/senha, marcar humor.

### Outras páginas web

| Página | Arquivo | Dados/ações |
| --- | --- | --- |
| Admin | `client/src/pages/Admin.tsx` | Usa JWT informado manualmente; consulta endpoints admin; exibe cards, gráficos, usuários, toggle admin. |
| Reset Password | `client/src/pages/ResetPassword.tsx` | Lê `token` da query e envia nova senha a `/api/auth/password-reset/confirm`. |
| Not Found | `client/src/pages/not-found.tsx` | Card simples de 404. |

### Componentes web de domínio

| Componente | Arquivo | Props/uso | Responsabilidade |
| --- | --- | --- | --- |
| `AuthScreen` | `client/src/features/home/auth/AuthScreen.tsx` | callbacks de login/register/social | Tela de entrada e cadastro web. |
| `OnboardingScreen` | `client/src/features/home/auth/OnboardingScreen.tsx` | usuário/callbacks | Coleta objetivos, rotina, interesses e envia onboarding. |
| `ChatWorkspace` | `client/src/features/home/chat/ChatWorkspace.tsx` | mensagens, input, callbacks, estado BeeEyes | Área principal de chat web. |
| `InboxPanel` | `client/src/features/home/chat/InboxPanel.tsx` | conversas/thread/callbacks | Mensagens diretas. |
| `ColmeiaPanel` | `client/src/features/home/colmeia/ColmeiaPanel.tsx` | token/dados/callbacks | Calendário, finanças, notas, alarmes e Google Calendar. |
| `CommunitiesPanel` | `client/src/features/home/communities/CommunitiesPanel.tsx` | comunidades/posts/membros/actions | Listagem, detalhe, CRUD e interação em comunidades. |
| `FeedPanel` | `client/src/features/home/feed/FeedPanel.tsx` | posts, sugestões, callbacks | Feed social, compositor, comentários e recomendações. |
| `FriendsPanel` | `client/src/features/home/friends/FriendsPanel.tsx` | amigos/busca/conexões | Rede de amigos e solicitações. |
| `FriendProfileModal` | `client/src/features/home/friends/FriendProfileModal.tsx` | perfil/testimonials/actions | Modal de perfil público. |
| `SettingsScreen` | `client/src/features/home/settings/SettingsScreen.tsx` | user/preferences/logout | Preferências web. |

### Componentes web reutilizáveis

| Arquivo | Função |
| --- | --- |
| `AchievementPopup.tsx` | Toast/modal visual de conquista. |
| `BeeEyes.tsx` | Avatar BeeEyes animado/expressivo. |
| `BeeEyesSVG.tsx` | Versão SVG do avatar. |
| `ChatMessage.tsx` | Renderiza mensagem de chat e metadados/cards. |
| `CommunityPostCard.tsx` | Card de post em comunidade. |
| `DailyBriefingModal.tsx` | Modal de briefing diário. |
| `FeedPostCard.tsx` | Card de post no feed. |
| `MedalBadge.tsx` | Medalha/badge de conquista. |
| `MoodSelector.tsx` | Seleção de humor. |
| `NewsCard.tsx` | Card de notícia/resumo. |
| `StreakDisplay.tsx` | Exibição de sequência/streak. |
| `ThemeToggle.tsx` | Alternância claro/escuro. |
| `UserAvatar.tsx` | Avatar de usuário com fallback. |
| `XPProgress.tsx` | Barra de nível/XP. |

`client/src/components/examples/*` contém versões de exemplo/demonstração desses componentes.

`client/src/components/ui/*` contém wrappers/primitivos shadcn/Radix: accordion, alert, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown, form, hover-card, input, label, menubar, navigation-menu, pagination, popover, progress, radio, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, toast, toggle e tooltip.

### Utilitários web

| Arquivo | Exporta/faz |
| --- | --- |
| `client/src/lib/queryClient.ts` | `apiRequest`, `getQueryFn`, `queryClient`; padroniza fetch e erros. |
| `client/src/features/home/shared/api.ts` | `apiFetch`, `apiTryFetch`, `parseApiResponse`; aceita resposta crua ou envelope. |
| `client/src/features/home/types.ts` | Tipos de usuário, mensagem, feed, comunidade, DM, notícia e metadados. |
| `client/src/lib/image.ts` | Compressão/conversão de imagens para upload. |
| `client/src/lib/theme.ts` | Persistência/aplicação de tema. |
| `client/src/lib/medals.ts` | Catálogo de medalhas. |
| `client/src/lib/legalTexts.ts` | Termos e política. |
| `client/src/lib/utils.ts` | `cn` e utilidades de classes. |
| `client/src/hooks/use-mobile.tsx` | Detecção responsiva/mobile. |
| `client/src/hooks/use-toast.ts` | Estado de toast. |

## 8. Aplicativo Mobile

### Navegação mobile

Expo Router em `mobile/app`.

| Rota | Arquivo | Tela |
| --- | --- | --- |
| `/` | `mobile/app/index.tsx` | Redireciona conforme token/onboarding. |
| `/_layout` | `mobile/app/_layout.tsx` | Providers globais, auth init, notificações. |
| `/onboarding` | `mobile/app/onboarding.tsx` | Onboarding mobile. |
| `/(auth)/login` | `mobile/app/(auth)/login.tsx` | Login. |
| `/(auth)/register` | `mobile/app/(auth)/register.tsx` | Cadastro. |
| `/(auth)/forgot-password` | `mobile/app/(auth)/forgot-password.tsx` | Solicitar reset. |
| `/(auth)/reset-password` | `mobile/app/(auth)/reset-password.tsx` | Confirmar reset. |
| `/(tabs)` / centro | `mobile/app/(tabs)/index.tsx` | Chat. |
| `/(tabs)/feed` | `mobile/app/(tabs)/feed.tsx` | Feed. |
| `/(tabs)/colmeia` | `mobile/app/(tabs)/colmeia.tsx` | Colmeia. |
| `/(tabs)/inbox` | `mobile/app/(tabs)/inbox.tsx` | Inbox/DM. |
| `/(tabs)/communities` | `mobile/app/(tabs)/communities.tsx` | Comunidades. |
| `/(tabs)/friends` | `mobile/app/(tabs)/friends.tsx` | Amigos. |
| `/(tabs)/profile` | `mobile/app/(tabs)/profile.tsx` | Perfil. |
| `/(tabs)/mood` | `mobile/app/(tabs)/mood.tsx` | Humor. |
| `/(tabs)/settings` | `mobile/app/(tabs)/settings.tsx` | Configurações. |
| `/(tabs)/notifications` | `mobile/app/(tabs)/notifications.tsx` | Notificações. |
| `/(tabs)/news` | `mobile/app/(tabs)/news.tsx` | Notícias. |

`mobile/app/(tabs)/_layout.tsx` mostra bottom tabs: Feed, Colmeia, Chat central, Inbox, Comunidades. Rotas como amigos, perfil, humor, settings, notícias e notificações ficam ocultas na tab bar.

### Telas mobile

| Tela | Arquivo | Objetivo e comportamento |
| --- | --- | --- |
| Login | `mobile/app/(auth)/login.tsx`, `mobile/features/auth/screens/LoginScreen.tsx` | Login por usuário/senha ou Google; salva token no SecureStore; redireciona onboarding/tabs. Há versões duplicadas/alternativas. |
| Cadastro | `mobile/app/(auth)/register.tsx`, `mobile/features/auth/screens/RegisterScreen.tsx` | Cadastro com usuário, e-mail na rota atual, nome, gênero, senha, Google e textos legais. |
| Forgot/Reset | `mobile/app/(auth)/forgot-password.tsx`, `reset-password.tsx` | Solicita e confirma reset. |
| Onboarding | `mobile/app/onboarding.tsx` | Coleta objetivos, rotina, perfil de trabalho, período ativo e interesses; chama `/api/me/onboarding`. |
| Chat | `mobile/features/chat/screens/ChatScreen.tsx` | Chat com IA, score, notificações inteligentes, daily briefing, gravação/transcrição de áudio, mensagens proativas e dicas. |
| Feed | `mobile/features/feed/screens/FeedScreen.tsx` | Feed social, composer, imagem via câmera/galeria, compressão, likes, comentários, recomendações, perfis. |
| Colmeia | `mobile/features/colmeia/screens/ColmeiaScreen.tsx` | Calendário, finanças, notas, relógio/alarmes e Google Calendar. |
| Comunidades | `mobile/features/communities/screens/CommunitiesScreen.tsx` | Listar/criar/editar/excluir, pedidos, convites, posts, likes e comentários. |
| Amigos | `mobile/features/friends/screens/FriendsScreen.tsx` | Busca, sugestões, solicitações, aceitar/rejeitar, remover, perfil e depoimentos. |
| Inbox | `mobile/features/inbox/screens/InboxScreen.tsx` | Conversas diretas, thread e envio/remoção de mensagens. |
| Humor | `mobile/features/mood/screens/MoodScreen.tsx` | Registro de humor e histórico/heatmap. |
| Notícias | `mobile/features/news/screens/NewsScreen.tsx` | Lista notícias e aciona resumo. |
| Notificações | `mobile/features/notifications/screens/NotificationsScreen.tsx` | Central de notificações; marca lidas e navega por tipo. |
| Perfil | `mobile/features/profile/screens/ProfileScreen.tsx` | Perfil, conquistas, amigos, depoimentos, estatísticas e logout. |
| Settings | `mobile/features/settings/screens/SettingsScreen.tsx` | Avatar, tema, idioma, bio, visitas anônimas, senha, termos/política. |

### Estados globais mobile

| Store | Arquivo | Estado/ações |
| --- | --- | --- |
| Auth | `mobile/stores/authStore.ts` | `token`, `user`, `loading`, `setToken`, `setUser`, `logout`, `initialize`; usa SecureStore e aplica idioma. |
| Chat | `mobile/stores/chatStore.ts` | Mensagens, typing, streaming, add/append/finalize. |
| UI | `mobile/stores/uiStore.ts` | Expressão BeeEyes, conquista, tema, imagem de perfil local, inicialização de preferências. |

### Hooks mobile

| Hook | Arquivo | Função |
| --- | --- | --- |
| `useChat` | `mobile/hooks/useChat.ts` | Envia `/api/chat`, interpreta SSE, limpa JSON de ações, atualiza stores e invalida queries. |
| `useMood` | `mobile/hooks/useMood.ts` | Query `/api/mood`, mutation `POST /api/mood`, invalida mood/me. |
| `useMissions` | `mobile/hooks/useMissions.ts` | Arquivo legado vazio/sem funcionalidade identificada. |

### Libs mobile

| Arquivo | Função |
| --- | --- |
| `mobile/lib/api.ts` | Axios com base `EXPO_PUBLIC_API_URL` ou `http://10.0.2.2:5000`; injeta Bearer token; limpa token em 401. |
| `mobile/lib/notifications.ts` | Canais Expo, token push, listener de tap e notificações locais. |
| `mobile/lib/googleAuth.ts` | Configuração e login Google nativo. |
| `mobile/lib/i18n.ts` | i18next, normalização/aplicação de idioma. |
| `mobile/lib/theme.ts` | Paleta, fonts, tamanhos, temas claro/escuro. |
| `mobile/lib/social.ts` | Tipos/metadados sociais, helpers de display e tempo. |
| `mobile/lib/intelligence.ts` | Tipos de score e notificações inteligentes. |
| `mobile/lib/medals.ts` | Catálogo de medalhas. |
| `mobile/lib/legalTexts.ts` | Termos e privacidade. |
| `mobile/lib/queryClient.ts` | QueryClient mobile. |

### Componentes mobile

| Arquivo | Responsabilidade |
| --- | --- |
| `AchievementToast.tsx` | Toast de conquista. |
| `BeeEyes.tsx` | Avatar BeeEyes mobile. |
| `ChatMessage.tsx` | Mensagem/card de chat mobile. |
| `DailyBriefingModal.tsx` | Briefing diário. |
| `DrumRollDatePicker.tsx` | Picker visual de data/hora. |
| `MedalBadge.tsx` | Medalha. |
| `MoodSelector.tsx` | Seleção de humor. |
| `RouteErrorBoundary.tsx` | Boundary por rota. |
| `StreakDisplay.tsx` | Streak. |
| `UserAvatar.tsx` | Avatar. |
| `UserProfileModal.tsx` | Modal de perfil. |
| `XPProgress.tsx` | Barra XP. |

## 9. Estilos, Tema e Identidade Visual

Identidade visual:

- Marca: BeeEyes / bee-eyes.
- Paleta dominante: amarelo/mel (`#FFD940`, `#FFD700`, `#F5C842`, `#E8B800`), preto/cinza para texto, superfícies claras e acentos verdes em partes do app.
- Tema web: CSS variables em `client/src/index.css`, com modo light/dark.
- Tailwind: `tailwind.config.ts` mapeia tokens CSS, fontes, radius, chart/status colors e plugins.
- Fontes web: configuradas como Nunito, Fredoka e JetBrains Mono.
- Mobile: `mobile/lib/theme.ts` concentra `COLORS`, tamanhos e tokens.
- Componentes: shadcn/Radix na web; React Native StyleSheet/Reanimated/LinearGradient no mobile.
- Ícones: Lucide no web, Feather/React Native SVG no mobile, PNGs de Colmeia nos assets.

Padrões visuais:

- Avatar BeeEyes como elemento central de empatia.
- Cards arredondados, sombras suaves, gradientes amarelos em auth mobile.
- Bottom tab mobile com botão central destacado para chat.
- Desktop web usa área de chat e painel lateral/abas.
- Colmeia usa ícones próprios de calendário, finanças, notas, alarmes.

Responsividade:

- Web Home alterna entre layout desktop com sidebar e navegação mobile/tabs.
- Mobile é portrait por `mobile/app.json`.
- Admin web usa cards/gráficos/tabelas responsivas.

Animações:

- Framer Motion e CSS keyframes no web.
- React Native Reanimated no mobile.
- BeeEyes muda expressão por contexto: neutral, happy, curious, excited, celebrating etc.

## 10. Fluxos Importantes

### Cadastro

Arquivos: `server/routes/auth.ts`, `server/auth.ts`, `shared/schema.ts`, `client/src/features/home/auth/AuthScreen.tsx`, `mobile/app/(auth)/register.tsx`.

Passos:

1. Usuário informa username, e-mail, senha e dados opcionais.
2. Frontend chama `POST /api/auth/register`.
3. Backend valida schema e e-mail, verifica duplicidade, faz hash da senha.
4. Cria user e personalidade inicial.
5. Retorna token JWT e user.
6. Frontend salva token e redireciona para onboarding ou app.

Falhas: campos inválidos, senha fraca, usuário/e-mail existente. Ponto de atenção: há versão mobile antiga em `mobile/features/auth/screens/RegisterScreen.tsx` que não evidencia e-mail na descrição levantada inicialmente; a rota atual `mobile/app/(auth)/register.tsx` inclui e-mail. Manter duplicatas alinhadas.

### Login/logout

Login:

- `POST /api/auth/login` aceita username ou e-mail e senha.
- Web usa localStorage; mobile usa SecureStore.
- Mobile inicializa sessão em `mobile/app/_layout.tsx` e busca `/api/me`.

Logout:

- Remove token local.
- Mobile também limpa preferências locais de UI/perfil.

### Recuperação de senha

Arquivos: `server/routes/auth.ts`, `client/src/pages/ResetPassword.tsx`, `mobile/app/(auth)/forgot-password.tsx`, `mobile/app/(auth)/reset-password.tsx`.

Fluxo:

1. Usuário informa e-mail.
2. Backend gera token aleatório, salva hash e expiração.
3. Se `RESEND_API_KEY` existir, envia e-mail; senão loga link.
4. Usuário envia token e nova senha.
5. Backend valida token não usado/não expirado e atualiza senha.

### Onboarding

Arquivos: `mobile/app/onboarding.tsx`, `client/src/features/home/auth/OnboardingScreen.tsx`, `server/routes/auth.ts`.

Dados: objetivos, rotina, perfil de trabalho, período ativo e interesses. Resultado: `users.onboardingCompleted = true` e `user_personality.traits/interests` preenchidos.

### Chat e ações inteligentes

Arquivos: `server/routes/messages.ts`, `server/ai.ts`, `server/ai-actions.ts`, `mobile/hooks/useChat.ts`, `mobile/features/chat/screens/ChatScreen.tsx`, `client/src/pages/Home.tsx`.

Passos:

1. Usuário envia texto.
2. Frontend salva mensagem local e chama `/api/chat`.
3. Backend salva mensagem, carrega contexto e chama IA.
4. Stream SSE retorna chunks e eventos.
5. Ações podem criar dados na Colmeia ou notícias.
6. Backend salva resposta final com metadata.
7. Frontend renderiza mensagem, cards e conquistas.

Falhas: rate limit, token expirado, indisponibilidade IA, parsing de ação, rede.

### Comunidade

Passos:

1. Usuário lista/cria comunidade.
2. Se pública, entra direto; se privada, pedido fica pendente.
3. Membro cria posts, comenta, curte e recomenda.
4. Dono/admin aprova pedidos, edita ou remove comunidade.

Arquivos: `server/routes/communities.ts`, `server/storage.ts`, `client/src/features/home/communities/CommunitiesPanel.tsx`, `mobile/features/communities/screens/CommunitiesScreen.tsx`.

### Feed

Passos:

1. Carrega feed `for-you` ou `friends`.
2. Usuário cria post com texto/imagem.
3. Backend salva imagem se base64, analisa post por IA de forma assíncrona, concede XP/conquista.
4. Usuários curtem/comentam/recomendam.

### Colmeia

Módulos: calendário, finanças, notas, alarmes.

Calendário:

- CRUD local.
- Integra Google Calendar via OAuth quando configurado.
- Sync inicial busca janela ampla de eventos.

Finanças:

- Receita/despesa em centavos.
- Resumo mensal por categoria/tipo.

Notas:

- CRUD simples.

Alarmes:

- Tipos `alarm`, `medicine`, `appointment`.
- Repetição `once`, `daily`, `weekly`, `interval`.
- Scheduler backend verifica vencidos e envia push.
- Mobile também agenda notificação local.

### Upload de imagem

Web/mobile convertem imagem para base64; backend valida data URL e salva em `uploads/YYYY-MM`. Usado por feed, comunidades e avatar.

### Notificações

Tipos: push token, centro de notificações, conexão, comunidade, visitas, proactive, app tips, alarmes. Mobile registra canais Expo e listener de tap para navegar à tela correta.

## 11. Documentação Arquivo por Arquivo

### Raiz/configuração

| Arquivo | Função | Importa/exporta/conecta |
| --- | --- | --- |
| `package.json` | Scripts e dependências raiz. | Conecta backend/web/testes/build. |
| `package-lock.json` | Lock de dependências raiz. | N/A. |
| `tsconfig.json` | Configuração TypeScript raiz. | Usado por `npm run check`. |
| `vite.config.ts` | Vite web; root `client`, saída `dist/public`, aliases. | Importa plugins Vite; exporta config. |
| `tailwind.config.ts` | Tema Tailwind web. | Exporta config. |
| `postcss.config.js` | PostCSS/Tailwind. | Exporta config. |
| `components.json` | Config shadcn/ui. | Usado por geração de componentes. |
| `drizzle.config.ts` | Config Drizzle; exige `DATABASE_URL`. | Exporta config. |
| `playwright.config.ts` | Config E2E. | Exporta config Playwright. |
| `Dockerfile` | Build multi-stage Node 20. | Usa `npm run build`, expõe 5000. |
| `docker-compose.yml` | Serviço app com porta 5000 e `.env`. | Build local e produção (DigitalOcean Droplet). |
| `.dockerignore` | Exclui arquivos do contexto Docker. | N/A. |
| `.gitignore` | Ignorados Git. | N/A. |
| `.replit` | Config Replit. | N/A. |
| `.github/workflows/deploy.yml` | Workflow CI/CD. | Deploy automatizado; necessário validar segredos. |
| `.vscode/extensions.json`, `.vscode/settings.json` | Recomendações locais. | N/A. |
| `.claude/settings.json`, `.claude/settings.local.json`, `.claude/scheduled_tasks.lock` | Configurações locais de agente. | Não fazem parte do runtime do app. |
| `README.md` | Título básico `BeeEyesAI`. | Documentação mínima existente. |
| `design_guidelines.md` | Diretrizes visuais. | Apoia consistência visual. |
| `atualizacoes-planilha.md` | Notas de atualização. | Necessário validar uso atual. |
| `deploy.ps1`, `deploy.sh` | Scripts de deploy. | Automatizam deploy; detalhes dependem do ambiente. |
| `build-apk.ps1`, `build-apk.sh` | Scripts para build APK. | Relacionados ao mobile. |
| `PROJECT_DOCUMENTATION.md` | Arquivo versionado antigo. | Deletado no worktree atual. |

### Shared

| Arquivo | Exporta | Função |
| --- | --- | --- |
| `shared/schema.ts` | Tabelas Drizzle, schemas Zod, tipos, `xpForLevel`, `LEVEL_UNLOCKS`. | Fonte central de banco e validações. |
| `shared/api.ts` | `ApiResponse`, `isApiEnvelope`, `extractApiErrorPayload`, `getApiErrorMessage`. | Padroniza leitura de respostas/erros entre cliente e mobile. |
| `shared/unlocks.ts` | Nível de unlock de visitas anônimas e helper. | Regra compartilhada de recurso bloqueado. |

### Backend

| Arquivo | Função principal |
| --- | --- |
| `server/index.ts` | Bootstrap Express/Vite/static/errors/listen. |
| `server/routes/index.ts` | Monta todos os módulos de rota e inicia scheduler de alarmes. |
| `server/db.ts` | Conexão Neon/Drizzle e compatibilidade do schema. |
| `server/storage.ts` | Camada de persistência e regras de negócio. |
| `server/auth.ts` | Hash/verificação de senha e JWT. |
| `server/ai.ts` | Clientes IA, prompts, streaming, análise, notificações, transcrição. |
| `server/ai-actions.ts` | Inferência determinística de ações de calendário/finanças/notas/alarmes. |
| `server/alarm-reactivation.ts` | Reativação/sugestões relacionadas a alarmes pausados. |
| `server/rateLimit.ts` | Rate limit em memória para chat. |
| `server/http.ts` | Helpers HTTP como parsing bounded int. |
| `server/holidays.ts` | Detecção de feriados nacionais. |
| `server/media.ts` | Salvamento de imagens base64. |
| `server/push.ts` | Envio Expo Push. |
| `server/security.ts` | Headers/segurança HTTP. |
| `server/cache.ts` | Cache simples usado por rotas/serviços. |
| `server/vite.ts` | Integração Vite em dev e static em produção. |
| `server/types/express.d.ts` | Extende tipos Express com `userId`, `requestId`, `logger`. |
| `server/api/errors.ts` | Classe `ApiError` e factories. |
| `server/api/response.ts` | Helpers de resposta e erro. |
| `server/api/async-handler.ts` | Wrapper async para rotas. |
| `server/middleware/requireAuth.ts` | Autenticação Bearer. |
| `server/middleware/requireAdmin.ts` | Autorização admin. |
| `server/observability/logger.ts` | Logs JSON. |
| `server/observability/metrics.ts` | Métricas in-memory e Prometheus. |
| `server/observability/persistence.ts` | Escrita/leitura `.local/observability`. |
| `server/observability/request-context.ts` | Request ID, métricas, traces. |
| `server/observability/tracing.ts` | JSONL de traces. |
| `server/routes/auth.ts` | Auth, me, onboarding, reset. |
| `server/routes/messages.ts` | Chat, mensagens, notificações, transcrição, notícias. |
| `server/routes/social.ts` | Feed, amigos, DMs, perfis, testimonials. |
| `server/routes/communities.ts` | Comunidades, membros, posts e comentários. |
| `server/routes/colmeia.ts` | Calendário, Google Calendar, finanças, alarmes, notas. |
| `server/routes/daily-briefing.ts` | Briefing diário/clima/cidade. |
| `server/routes/mood.ts` | Humor. |
| `server/routes/admin.ts` | Painel admin. |
| `server/routes/system.ts` | Health/métricas/traces. |

### Web

| Arquivo | Função |
| --- | --- |
| `client/index.html` | HTML base Vite. |
| `client/src/main.tsx` | Mount React. |
| `client/src/App.tsx` | Providers e rotas. |
| `client/src/index.css` | Tailwind, tokens, tema, utilitários visuais, keyframes. |
| `client/src/pages/Home.tsx` | App web principal. |
| `client/src/pages/Admin.tsx` | Painel admin. |
| `client/src/pages/ResetPassword.tsx` | Reset de senha. |
| `client/src/pages/not-found.tsx` | 404. |
| `client/src/pages/examples/Home.tsx` | Exemplo/demonstração. |
| `client/src/features/home/auth/AuthScreen.tsx` | Login/cadastro web. |
| `client/src/features/home/auth/OnboardingScreen.tsx` | Onboarding web. |
| `client/src/features/home/chat/ChatWorkspace.tsx` | Workspace chat. |
| `client/src/features/home/chat/InboxPanel.tsx` | Inbox web. |
| `client/src/features/home/colmeia/ColmeiaPanel.tsx` | Colmeia web. |
| `client/src/features/home/communities/CommunitiesPanel.tsx` | Comunidades web. |
| `client/src/features/home/feed/FeedPanel.tsx` | Feed web. |
| `client/src/features/home/friends/FriendsPanel.tsx` | Amigos web. |
| `client/src/features/home/friends/FriendProfileModal.tsx` | Perfil público modal. |
| `client/src/features/home/settings/SettingsScreen.tsx` | Configurações web. |
| `client/src/features/home/shared/api.ts` | Fetch helpers do módulo Home. |
| `client/src/features/home/types.ts` | Tipos do módulo Home. |
| `client/src/hooks/use-mobile.tsx` | Detecção mobile. |
| `client/src/hooks/use-toast.ts` | Toast. |
| `client/src/lib/image.ts` | Imagens. |
| `client/src/lib/legalTexts.ts` | Textos legais. |
| `client/src/lib/medals.ts` | Medalhas. |
| `client/src/lib/queryClient.ts` | TanStack Query e fetch. |
| `client/src/lib/theme.ts` | Tema. |
| `client/src/lib/utils.ts` | `cn`. |
| `client/src/components/*.tsx` | Componentes reutilizáveis listados acima. |
| `client/src/components/examples/*.tsx` | Exemplos dos componentes. |
| `client/src/components/ui/*.tsx` | Primitivos UI shadcn/Radix. |
| `client/public/*` | Ícones, logo, manifest e imagens públicas. |

### Mobile

| Arquivo | Função |
| --- | --- |
| `mobile/package.json`, `mobile/package-lock.json` | Dependências/scripts mobile. |
| `mobile/app.json` | Config Expo: nome, slug, scheme, ícones, plugins, permissões e Android/iOS. |
| `mobile/eas.json` | Perfis EAS development/preview/production e env público. |
| `mobile/babel.config.js`, `mobile/metro.config.js`, `mobile/tsconfig.json` | Build/TS mobile. |
| `mobile/App.tsx`, `mobile/index.ts` | Entradas Expo. |
| `mobile/.env.example`, `.easignore`, `.gitignore` | Configuração mobile. |
| `mobile/app/_layout.tsx` | Providers, auth init, push, Google Sign-In. |
| `mobile/app/index.tsx` | Redirect inicial. |
| `mobile/app/onboarding.tsx` | Onboarding. |
| `mobile/app/(auth)/*.tsx` | Rotas de autenticação. |
| `mobile/app/(tabs)/*.tsx` | Rotas tab; reexportam telas de features. |
| `mobile/features/*/screens/*.tsx` | Telas principais mobile. |
| `mobile/components/*.tsx` | Componentes mobile listados acima. |
| `mobile/hooks/*.ts` | Hooks de chat, humor e recursos auxiliares. |
| `mobile/lib/*.ts` | API, tema, i18n, social, push, Google, textos. |
| `mobile/locales/en.ts`, `es.ts`, `pt.ts` | Traduções. |
| `mobile/stores/*.ts` | Zustand stores. |
| `mobile/assets/*` | Ícones, splash e imagens. |
| `mobile/visual/*` | SVGs/HTML de identidade visual. |
| `mobile/android/**` | Projeto Android nativo gerado, manifests, Gradle, Kotlin, resources, keystore debug. |
| `mobile/google-services.json` | Config Firebase/Google Android; tratar com cautela. |
| `mobile/shims/react-dom-client.js` | Shim de compatibilidade. |

### Design/protótipo

| Arquivo/pasta | Função |
| --- | --- |
| `beeyes-design/package.json`, `vite.config.ts`, `tsconfig.json`, `components.json` | Projeto Vite separado de design/mockup. |
| `beeyes-design/src/App.tsx`, `main.tsx`, `index.css` | App de preview. |
| `beeyes-design/src/components/mockups/beeyes-app/*` | Mockups Mobile/WebDesktop/BeeEyes e CSS de grupo. |
| `beeyes-design/src/components/ui/*` | Primitivos UI do protótipo. |
| `beeyes-design/src/hooks/*`, `src/lib/utils.ts` | Hooks/utilitários do protótipo. |
| `beeyes-design/public/images/*` | Imagens usadas no mockup. |
| `beeyes-design/src/.generated/mockup-components.ts` | Código gerado para preview. |

### Deploy, testes e ferramentas

| Arquivo | Função |
| --- | --- |
| `deploy/digitalocean/nginx.conf`, `setup.sh` | Configuração DigitalOcean/nginx. |
| `deploy/hostgator/README.md`, `.htaccess`, `subdir.htaccess` | Instruções/config Apache HostGator. |
| `deploy/hostgator/api/*.php` | API PHP reduzida para HostGator. |
| `deploy/hostgator/mysql_schema.sql` | Schema MySQL reduzido. |
| `deploy/hostgator/*.zip` | Builds públicos empacotados. |
| `_svg_convert/package.json`, `package-lock.json`, `convert.js` | Ferramenta de conversão SVG. |
| `icons-colmeia/*.png` | Ícones avulsos de Colmeia. |
| `tests/*.test.ts` | Testes unitários. |
| `tests/e2e/*.spec.ts`, `helpers.ts`, `README.md` | Testes Playwright e helpers. |

## 12. Testes

Unitários:

| Arquivo | Cobertura |
| --- | --- |
| `tests/auth.test.ts` | Hash/verificação de senha e JWT. |
| `tests/ai-actions.test.ts` | Inferência de evento, finança, nota e alarmes. |
| `tests/holidays.test.ts` | Feriado nacional vs dia comum. |
| `tests/http.test.ts` | `parseBoundedInt`. |
| `tests/rateLimit.test.ts` | Limite e bloqueio por hora. |
| `tests/schema.test.ts` | Validação de credenciais. |
| `tests/unlocks.test.ts` | Unlock de visitas anônimas no nível 3. |

E2E:

| Arquivo | Fluxo |
| --- | --- |
| `tests/e2e/auth.spec.ts` | Cadastro, logout, falha de login, login bem-sucedido. |
| `tests/e2e/onboarding-community.spec.ts` | Onboarding, recuperação de sessão, comunidades. |
| `tests/e2e/social-flows.spec.ts` | Feed, comunidade e DM entre usuários reais. |
| `tests/e2e/helpers.ts` | Helpers para criar usuário, login/logout, abrir abas e aguardar ações. |

Observação: helpers E2E podem conter rótulos antigos; o produto atual concentra os fluxos em score, conquistas e Colmeia. Necessário validar se os testes acompanham todos os textos atuais.

## 13. Pontos de Atenção

Críticos:

- `server/ai.ts`, `server/routes/messages.ts`, `server/storage.ts`, `shared/schema.ts` são arquivos de alto impacto.
- `server/db.ts` altera schema em runtime; mudanças devem ser auditadas.
- `server/routes/auth.ts` controla segurança de conta e reset.
- `mobile/app/_layout.tsx` e `mobile/stores/authStore.ts` controlam sessão mobile.
- `client/src/pages/Home.tsx` concentra muitas responsabilidades.

Possíveis bugs/riscos:

- Respostas de sucesso do backend são em geral dados crus, enquanto `shared/api.ts` e alguns helpers suportam envelope `{ok,data}`. O projeto lida com os dois, mas o contrato não é uniforme.
- CORS `*` é permissivo.
- JWT tem fallback em desenvolvimento; em produção exige `JWT_SECRET`.
- `parseAIActions` por regex é frágil.
- Campos de gênero aparecem como `female/male/other` em partes do mobile, enquanto prompts citam valores em português; necessário normalizar.
- Duplicação entre `mobile/app/(auth)/*.tsx` e `mobile/features/auth/screens/*.tsx`.
- `client/src/pages/Home.tsx` é grande e deveria ser progressivamente fatiado.
- `server/storage.ts` também é muito grande e reúne muitas regras.
- `mobile/google-services.json` e configs públicas devem ser revisadas antes de publicar repositório.
- `deploy/hostgator` parece legado/reduzido em relação ao backend atual; risco de documentação/deploy divergente.
- Alguns textos exibidos no terminal aparecem com mojibake de acentuação; necessário validar encoding real dos arquivos no editor.
- `uploads` é salvo em disco local; em deploy com containers/auto-stop pode precisar storage persistente.
- Rate limit em memória não escala entre múltiplas instâncias.
- Observabilidade em `.local` também é local/efêmera.

Performance:

- Feed/comunidades/DMs exigem cuidado com paginação e índices.
- SSE/chat e chamadas de IA podem segurar conexão por muito tempo.
- Imagens base64 aumentam payload; compressão existe no mobile, mas backend aceita até 25mb.

Segurança:

- Validar tamanho/tipo real de imagem, não apenas prefixo data URL.
- Revisar CORS por ambiente.
- Proteger endpoints admin e segredos de deploy.
- Evitar logar links de reset em ambientes compartilhados.
- Criptografar tokens de integrações externas se o banco for comprometido; hoje ficam armazenados como dados de integração.

## 14. Mapa Mental Textual

```text
BeeEyesAI
├─ Usuário
│  ├─ Auth: registro, login, social Google, reset
│  ├─ Onboarding: objetivos, rotina, perfil, interesses
│  ├─ Perfil: avatar, bio, idioma, visitas anônimas, conquistas
│  └─ Estado: nível, XP, streak, personalidade
├─ IA BeeEyes
│  ├─ Chat SSE
│  ├─ Prompt com perfil + histórico + Colmeia
│  ├─ Fallbacks OpenAI/Groq/Gemini/Cerebras
│  ├─ Ações: eventos, finanças, notas, alarmes, notícias
│  └─ Notificações inteligentes/proativas
├─ Social
│  ├─ Feed: posts, imagens, likes, comentários
│  ├─ Amigos: sugestões, solicitações, conexões
│  ├─ DMs: conversas diretas
│  ├─ Perfil público e depoimentos
│  └─ Comunidades: membros, posts, comentários, convites
├─ Colmeia
│  ├─ Calendário local + Google Calendar
│  ├─ Finanças mensais
│  ├─ Notas
│  └─ Alarmes/lembretes + push
├─ Interfaces
│  ├─ Web React: Home, Admin, Reset, 404
│  ├─ Mobile Expo: tabs e telas nativas
│  └─ Design mockup: beeyes-design
├─ Backend
│  ├─ Express routes
│  ├─ Storage Drizzle
│  ├─ Neon/PostgreSQL
│  ├─ Observabilidade local
│  └─ Deploy Docker em DigitalOcean Droplet (HostGator legado)
└─ Dados
   ├─ shared/schema.ts
   ├─ migrations
   ├─ uploads locais
   └─ SecureStore/localStorage para sessão cliente
```

Fluxo de dados:

```text
Web/Mobile -> API Express -> requireAuth -> storage.ts -> Drizzle/Neon
Chat -> /api/chat -> AI providers -> parse actions -> storage/Colmeia -> SSE -> UI
Social -> routes social/communities -> storage -> push/notifications -> UI
Colmeia -> routes colmeia -> DB + Google Calendar + Expo Push -> UI
```

## 15. Contexto para IA

BeeEyesAI é um monorepo com backend Express/TypeScript, web React/Vite e mobile Expo/React Native. O produto é uma assistente pessoal/social chamada BeeEyes, com chat de IA, gamificação, streak, XP, feed social, amigos, mensagens diretas, comunidades, perfil, conquistas, notificações inteligentes e Colmeia.

Tecnologias:

- Backend: Express, TypeScript, Drizzle ORM, Neon/PostgreSQL, JWT, bcrypt, SSE, Zod.
- IA: OpenAI, Groq, Gemini, Cerebras e Whisper.
- Web: React 18, Vite, Wouter, TanStack Query, Tailwind, Radix/shadcn, Framer Motion.
- Mobile: Expo Router, React Native, Zustand, TanStack Query, Axios, SecureStore, Expo Notifications, i18next.
- Banco: PostgreSQL; schema em `shared/schema.ts`; migrations em `migrations`.

Arquivos principais:

- `shared/schema.ts`: sempre consultar antes de mudar dados.
- `server/storage.ts`: regras de negócio e queries.
- `server/routes/*.ts`: API.
- `server/ai.ts` e `server/ai-actions.ts`: IA e ações.
- `client/src/pages/Home.tsx`: app web principal.
- `client/src/features/home/*`: módulos web.
- `mobile/app/*`: navegação mobile.
- `mobile/features/*/screens/*.tsx`: telas mobile.
- `mobile/lib/api.ts`, `client/src/lib/queryClient.ts`: clientes HTTP.
- `mobile/stores/*.ts`: estado mobile.

Padrões a respeitar:

- Não inventar campos fora de `shared/schema.ts`.
- Manter web e mobile usando os mesmos endpoints.
- Ao adicionar endpoint, considerar validação, auth, storage, tipos compartilhados, web, mobile e testes.
- Ao adicionar dados persistidos, atualizar schema, migration e `ensureDatabaseCompatibility` se necessário.
- Ao mexer em chat/IA, preservar SSE e eventos existentes.
- Ao mexer em Colmeia, manter consistência entre ação via chat, tela web, tela mobile e banco.
- Ao mexer em notificações, atualizar metadata, centro de notificações e navegação por tap no mobile.
- Ao mexer em autenticação, validar localStorage web, SecureStore mobile e middlewares backend.

Não alterar sem cuidado:

- `shared/schema.ts`
- `server/storage.ts`
- `server/routes/messages.ts`
- `server/ai.ts`
- `server/routes/auth.ts`
- `server/db.ts`
- `mobile/app/_layout.tsx`
- `mobile/lib/api.ts`
- `client/src/pages/Home.tsx`

Como adicionar funcionalidade:

1. Definir se precisa banco. Se sim, alterar `shared/schema.ts`, gerar migration e atualizar storage.
2. Criar/alterar rota em `server/routes`.
3. Validar entrada com Zod ou checks explícitos.
4. Adicionar método em `storage.ts` se houver persistência.
5. Atualizar web e mobile.
6. Atualizar tipos compartilhados quando aplicável.
7. Adicionar testes unitários ou E2E conforme risco.
8. Conferir responsividade e estados de erro/loading.

## 16. Recomendações Finais

Resumo executivo:

O projeto já possui uma base rica e funcional, com backend completo, app web, app mobile, banco modelado e múltiplos fluxos avançados. O núcleo do produto é coerente: BeeEyes como IA assistiva conectada a dados pessoais, sociais e de produtividade. O maior risco técnico está na concentração de responsabilidades em arquivos grandes, contratos de API parcialmente inconsistentes e integrações sensíveis com IA/push/Google Calendar.

Melhorias recomendadas:

- Dividir `client/src/pages/Home.tsx` em containers menores.
- Dividir `server/storage.ts` por domínio.
- Padronizar envelope de API em todo backend.
- Fortalecer parser de ações de IA com JSON estruturado/tool calling.
- Normalizar enums como gênero e idioma entre web/mobile/backend.
- Revisar CORS por ambiente.
- Persistir uploads em storage externo.
- Substituir rate limit em memória por Redis/serviço compartilhado se escalar.
- Remover ou isolar deploy HostGator se for legado.
- Revisar arquivos com possível mojibake/encoding.

Prioridades técnicas:

1. Contrato de API e erros.
2. Segurança/envs/CORS/secrets.
3. Refatoração de Home web e storage backend.
4. Parser/arquitetura de ações da IA.
5. Testes cobrindo Colmeia, reset, push e comunidades privadas.
6. Uploads e observabilidade prontos para produção.

Riscos:

- Divergência entre web e mobile.
- Mudança no schema quebrar rotas existentes.
- IA produzir JSON inesperado.
- Tokens externos armazenados sem camada adicional de proteção.
- Builds mobile dependerem de envs públicos e configurações nativas.
- Deploy legado HostGator induzir manutenção paralela.

Checklist para novo desenvolvedor ou IA:

- Ler `shared/schema.ts`.
- Ler `server/routes/index.ts` para entender módulos.
- Ler `server/storage.ts` antes de mudar regras.
- Ler `server/routes/messages.ts`, `server/ai.ts` e `server/ai-actions.ts` antes de mexer no chat.
- Ler `client/src/pages/Home.tsx` e `client/src/features/home/types.ts` antes de alterar web.
- Ler `mobile/app/_layout.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/lib/api.ts` e `mobile/stores/*` antes de alterar mobile.
- Verificar scripts `npm run check`, `npm test` e `npm run e2e`.
- Conferir migrations antes de alterar banco.
- Não expor valores de `.env`, tokens, Google configs sensíveis ou dados pessoais.
- Manter documentação atualizada quando endpoints, schema, telas ou fluxos mudarem.
