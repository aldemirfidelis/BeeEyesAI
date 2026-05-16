# Checklist de Submissão — Google Play Store

App: **BeeEyes** (`com.beeeyes.ai`)
Data: 2026-05-16
Status geral: **Pronto para teste interno (Internal Testing)**, com 3 itens humanos pendentes antes da produção.

---

## 1. Build Android

| Item | Status | Nota |
|---|---|---|
| `targetSdkVersion ≥ 35` (Android 15) | ✅ Atende | Está em 36 (Android 16-preview) |
| `compileSdkVersion ≥ 35` | ✅ Atende | 36 |
| `minSdkVersion` razoável (≥ 24) | ✅ | 24 (Android 7.0) |
| `versionCode` controlado | ✅ | 1 inicial; EAS production tem `autoIncrement: true` |
| `versionName` controlado | ✅ | "1.0.0" |
| App Bundle (AAB) obrigatório | ✅ | EAS build profile produção gera AAB |
| 64-bit nativo | ✅ | RN 0.83 + abiFilters arm64-v8a/x86_64 (default Expo) |
| `usesCleartextTraffic: false` | ✅ Corrigido | Removido em `chore(security): remove google-services.json...` |
| Foreground service types declarados | ⚪ N/A | App não usa foreground services |
| Predictive back gesture | ⚪ Opcional | Android 14+ — não declarado, ok |

## 2. Assinatura

| Item | Status | Nota |
|---|---|---|
| Release keystore (não-debug) | ⚠️ **Pendente humano** | Decisão: **EAS Build**. Rodar `eas build --platform android --profile production` e a Expo gerencia o keystore. Não precisa configurar `signingConfigs.release` manualmente. |
| Debug keystore não versionado em release | ✅ | `mobile/android/app/debug.keystore` é só pra debug |
| Keystore real fora do git | ✅ | `.gitignore` cobre `*.keystore`, `*.jks` (exceto debug.keystore) |
| App Signing by Google Play | ⚪ Recomendado | Habilitar no Console — Google reassina o AAB |

## 3. Permissões declaradas vs uso real

| Permissão | Manifest | Uso real | Justificativa Data Safety |
|---|---|---|---|
| `INTERNET` | ✅ | API calls | Comunicação com servidor BeeEyes |
| `ACCESS_COARSE_LOCATION` | ✅ | `mobile/features/chat/screens/ChatScreen.tsx:48` — `Location.requestForegroundPermissionsAsync` | Daily Briefing: identificar cidade para previsão do tempo |
| `ACCESS_FINE_LOCATION` | ✅ | idem | idem |
| `RECORD_AUDIO` | ✅ | `ChatScreen.tsx:494` — `Audio.Recording.createAsync` | Gravação de áudio para transcrição (chat por voz com Bee → Whisper) |
| `READ_EXTERNAL_STORAGE` (maxSdk 32) | ✅ | expo-image-picker em SDK ≤32 | Upload de foto de perfil, posts, comunidades |
| `WRITE_EXTERNAL_STORAGE` (maxSdk 32) | ✅ | idem | Cache de imagens |
| `VIBRATE` | ✅ | Alarmes e notificações | Feedback tátil em alertas |
| `POST_NOTIFICATIONS` (auto Android 13+) | ✅ | expo-notifications | Alarmes, mensagens diretas, alertas |
| `RECEIVE_BOOT_COMPLETED` (auto) | ✅ | expo-notifications | Reagendar alarmes após boot |
| `SYSTEM_ALERT_WINDOW` | ❌ Removida | Zero uso | Auditoria detectou resíduo — bloqueada em `app.json android.blockedPermissions` |

## 4. Política de Privacidade e Termos

| Item | Status | Nota |
|---|---|---|
| Texto inline no app (mobile + web) | ✅ | `mobile/lib/legalTexts.ts`, `client/src/lib/legalTexts.ts` |
| URL pública para Play Console | ✅ Servida via Express | `GET /legal/privacy` e `GET /legal/terms` |
| URL canônica para o Play Console | ⚠️ **Pendente humano** | Colocar `https://<seu-dominio>/legal/privacy` no campo "Privacy Policy" do Play Console. Exemplo: `https://app.beeeyes.ai/legal/privacy` ou `https://beeeyes.net/legal/privacy` |
| Texto cobre LGPD | ✅ | DPO, direitos de acesso/correção/exclusão, base legal |
| Menciona uso de IA + provedores externos | ✅ | OpenAI, Groq, Gemini, Cerebras declarados |
| Menciona ads / coleta de wishlist | ✅ | Seção "ANÚNCIOS" nos Termos |

## 5. Data Safety form (preencher no Play Console)

### 5.1 Dados coletados pessoalmente

| Categoria | Dados | Coletado? | Compartilhado? | Criptografado em trânsito | Pode pedir exclusão |
|---|---|---|---|---|---|
| **Identidade** | Nome, e-mail, gênero (opcional) | Sim | Não vendido | HTTPS | Sim, `DELETE /api/me` |
| **Endereço** | Cidade (texto, opcional) | Sim, para clima | Não | HTTPS | Sim |
| **Identificadores** | ID interno, Google ID | Sim | Compartilhado com Google (auth) | HTTPS | Sim |
| **Foto** | Avatar | Sim, opcional | Não | HTTPS | Sim |
| **Comunicações** | Mensagens com IA, DMs, posts, comentários, depoimentos | Sim | Mensagens com IA enviadas a OpenAI/Groq/Gemini/Cerebras | HTTPS | Sim |
| **Áudio** | Gravações temporárias para transcrição | Sim, descartadas após transcrição | OpenAI Whisper | HTTPS | Sim |
| **Localização** | Coarse + Fine (opt-in runtime) | Sim, quando ativada | Não | HTTPS | Sim |
| **Atividade** | Mood, streak, XP, conquistas, mensagens enviadas | Sim | Não | HTTPS | Sim |
| **Saúde e fitness** | Health profile, workout plans, sessions | Sim | Não | HTTPS | Sim |
| **Finanças** | Transações Colmeia (entradas/saídas pessoais) | Sim | Não | HTTPS | Sim |
| **Calendário** | Eventos Colmeia + Google Calendar (se conectado) | Sim | Google Calendar (apenas se opt-in) | HTTPS + OAuth | Sim |
| **Wishlist / preferências** | Itens salvos, interesses | Sim | Não | HTTPS | Sim |
| **Push token** | Expo push token + device locale | Sim | FCM (Google) para entrega | HTTPS | Sim |

### 5.2 Práticas de segurança

| Item | Resposta |
|---|---|
| Dados em trânsito criptografados? | ✅ Sim — HTTPS em tudo, HSTS habilitado em produção |
| Usuário pode pedir exclusão? | ✅ Sim — endpoint `DELETE /api/me` no app e por e-mail |
| Compromisso com Family Policy? | ⚪ Não aplicável (apenas para apps direcionados a menores de 13) |
| Práticas de revisão independente | ⚪ Não auditado externamente ainda |
| Coleta de localização precisa | ✅ Opt-in via prompt runtime do sistema |

### 5.3 SDKs / Bibliotecas de terceiros (declarar)

| SDK | Finalidade | Coleta | Compartilhamento |
|---|---|---|---|
| Google Sign-In | Login social | E-mail, nome | Google |
| Google Cloud Messaging / FCM | Push notifications | Push token + payload | Google |
| OpenAI (gpt-4o-mini, whisper-1) | Chat + transcrição | Mensagem do usuário, contexto recente, perfil pseudonimizado | OpenAI Inc. (EUA) |
| Groq | Fallback de chat | idem (raro) | Groq Inc. (EUA) |
| Google Gemini | Fallback de chat | idem (raro) | Google |
| Cerebras (Llama via API) | Fallback de chat | idem (raro) | Cerebras (EUA) |
| Open-Meteo | Previsão do tempo + geocoding | Coordenadas/cidade | API pública (sem login) |
| Expo / EAS | Build, push, secure-store | Tokens de sessão local | Expo (EUA) — apenas serviços de build |
| Google Calendar API | Sincronização de eventos | Eventos (se opt-in) | Google |

## 6. Conteúdo da Play Store (preencher no Console)

| Campo | Status | Sugestão |
|---|---|---|
| Nome do app | ✅ | "BeeEyes" |
| Subtítulo curto | ⚠️ Pendente | "Sua assistente pessoal com IA acolhedora" (max 30 chars) |
| Descrição curta | ⚠️ Pendente | Ver `RELATORIO_FINAL.md` seção Marketing |
| Descrição completa | ⚠️ Pendente | Ver `RELATORIO_FINAL.md` |
| Categoria | ⚠️ Decisão | Sugestão: **Lifestyle** (não Health, para evitar Health Apps policy) |
| Tags | ⚠️ Pendente | assistente, ia, produtividade, social, bem-estar |
| Classificação indicativa (IARC) | ⚠️ Pendente | Fazer o questionário no Console. App de chat social com IA → provavelmente 13+ |
| Screenshots phone (mín. 2) | ⚠️ Pendente | 8 sugeridas: chat, feed, colmeia, calendário, wishlist, comunidades, mood, perfil |
| Screenshot tablet (opcional) | ⚪ | Não obrigatório se `supportsTablet: false` (não suportamos) |
| Ícone de alta resolução (512x512 PNG) | ✅ Já existe em assets | Conferir tamanho final |
| Imagem de destaque (1024x500) | ⚠️ Pendente | Banner amarelo com BeeEyes |
| Vídeo promocional (opcional) | ⚪ | Sugerido — 30s mostrando chat + colmeia |
| URL Privacy Policy | ⚠️ **Pendente humano** | Apontar para `/legal/privacy` no domínio público |
| E-mail de suporte | ⚠️ Pendente | suporte@beeeyes.net (alinhar com domínio real) |
| Site oficial | ⚠️ Pendente | URL da landing |
| Notas da versão (1.0.0) | ⚠️ Pendente | "Versão inicial. Sua assistente pessoal Bee chegou!" |

## 7. Testes na Play Store

| Trilha | Ação |
|---|---|
| **Internal Testing** | Criar com até 100 testers internos (e-mail individual). Validar fluxo completo: cadastro, login, chat, colmeia, push, logout. |
| **Closed Testing** | Após internal: requisito Google Play para apps novos é ≥12 testers ativos por 14 dias antes de ir a produção. Cumprir antes de submeter para produção. |
| **Open Testing** | Opcional, antes da produção pública. |
| **Production** | Só após closed testing cumprir requisitos. |

## 8. Critérios técnicos de saúde

| Item | Status |
|---|---|
| `npm test` | ✅ 44/44 |
| `npm run check` (tsc) | ✅ Sem erros |
| Build mobile (Android) | ⚠️ Não rodado nesta sessão — rodar `eas build --platform android --profile production` |
| Lint / format | ⚪ Sem lint configurado, apenas tsc |
| Sentry/Crashlytics | ❌ Não integrado — recomendação F3 |
| ErrorBoundary global mobile | ⚠️ Parcial — `RouteErrorBoundary.tsx` existe mas não envolve `Stack` em `_layout.tsx`. F3. |
| Privacy Policy URL | ⚠️ Servida pelo backend; falta apontar a URL pública no Play Console |
| Data Safety form | ⚠️ Preencher no Console com a tabela da seção 5 |

## 9. Bloqueadores remanescentes (humanos)

São 3 ações que **eu não posso fazer por você**:

1. **Regenerar chave Firebase** — `mobile/google-services.json` continha
   `AIzaSyAl3xfCBcvIB8RRDho3Du3VKZHHfslSilU`. Está untracked no git mas ainda no
   histórico (`git log --all -p`). Vá ao Firebase Console → Project Settings → APIs
   → Restrict API key → mudar para nova chave. Baixar novo `google-services.json`
   local (não commitar).

2. **Configurar EAS Build production** — rodar localmente:
   ```sh
   cd mobile
   eas login
   eas build:configure  # se ainda não fez
   eas build --platform android --profile production
   ```
   A Expo cria/usa o keystore Android automaticamente. AAB resultante vai pro
   Play Console.

3. **Apontar URL de Privacy/Termos no Play Console** — depois que o domínio
   estiver com SSL e servindo o Express (já feito em produção, ver
   `deploy/digitalocean/`), copiar `https://<seu-dominio>/legal/privacy` no
   campo "Privacy Policy URL" do Play Console + idem nos textos legais do app.
