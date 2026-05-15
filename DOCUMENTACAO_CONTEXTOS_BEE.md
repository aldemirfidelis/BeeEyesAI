# Revisao de Contextos da Bee

Data: 2026-05-14

## 1. Arquivos Revisados

Arquivos com contexto, prompt, memoria, preferencia, resposta automatica ou regras de IA revisados nesta passada:

- `server/ai.ts`
- `server/routes/messages.ts`
- `server/routes/auth.ts`
- `server/routes/daily-briefing.ts`
- `server/routes/index.ts`
- `server/routes/bee-context.ts`
- `server/storage.ts`
- `server/services/beeContextService.ts`
- `server/services/calendarInfoService.ts`
- `server/services/healthIntentService.ts`
- `server/services/workoutPlanService.ts`
- `server/services/beeResearchService.ts`
- `server/routes/wishlist.ts`
- `server/routes/calendar.ts`
- `server/routes/health.ts`
- `server/routes/colmeia.ts`
- `server/routes/social.ts`
- `server/routes/feedback.ts`
- `server/services/messageCategory.ts`
- `shared/schema.ts`
- `migrations/0010_bee_memory_context.sql`
- `client/src/pages/Home.tsx`
- `mobile/locales/pt.ts`
- `mobile/features/chat/screens/ChatScreen.tsx`
- `client/src/features/home/chat/ChatWorkspace.tsx`
- `client/src/features/home/colmeia/WishlistSection.tsx`
- `mobile/features/colmeia/screens/WishlistSection.tsx`
- `scripts/audit-bee-contexts.ts`
- `package.json`

## 2. Contextos Encontrados

| Contexto | Arquivo principal | Onde e usado | Finalidade | Status |
| --- | --- | --- | --- | --- |
| System prompt central da Bee | `server/ai.ts` | `/api/chat`, mensagens proativas, visita ao perfil | Define personalidade, tom, regras, ferramentas e seguranca | Ativo, melhorado |
| Prompt de chat com runtime context | `server/ai.ts` | `streamChat*` | Une prompt central, modo emocional/estrategico e contexto do usuario | Ativo, melhorado |
| Analise de personalidade | `server/ai.ts` | `updatePersonalityFromMessage` | Extrai estilo, interesses e topicos recentes | Ativo, parcialmente legado |
| Extracao de memorias | `server/ai.ts` | `updatePersonalityFromMessage` | Extrai fatos duradouros | Ativo, agora tambem grava `user_memories` |
| Contexto personalizado Bee | `server/services/beeContextService.ts` | `/api/chat` | Monta bloco com memorias, preferencias, feedback, humor e interesses | Novo, ativo |
| Resumo dinamico de conversa | `server/services/beeContextService.ts` | `/api/chat` | Mantem continuidade entre mensagens longas | Novo, ativo |
| Contexto de rotina | `server/routes/messages.ts` | `/api/chat` | Eventos de calendario e alarmes proximos | Ativo, melhorado por composicao |
| Contexto de calendario publico | `server/services/calendarInfoService.ts` | `/api/chat`, calendario, notificacoes | Feriados nacionais/estaduais e datas especiais | Ativo |
| Contexto de saude/treino | `server/services/healthIntentService.ts` | `/api/chat` | Perfil de treino, plano ativo e perguntas faltantes | Ativo |
| Sugestao estruturada de treino | `server/services/workoutPlanService.ts` | `/api/chat`, cards Web/Mobile | Gera plano de treino acionavel | Ativo |
| Contexto de pesquisa/noticias | `server/services/beeResearchService.ts`, `server/ai.ts` | `/api/chat` | Injeta resultados e busca noticias quando pedido | Ativo |
| Briefing diario | `server/ai.ts`, `server/routes/daily-briefing.ts` | Web/Mobile | Mensagem inicial com clima, interesses, streak e memorias | Ativo, melhorado |
| Mensagens proativas | `server/ai.ts`, `server/routes/messages.ts` | `/api/proactive` | Alertas sobre agenda, financas e dicas | Ativo |
| Onboarding | `server/routes/auth.ts` | Web/Mobile onboarding | Salva objetivos, rotina e interesses | Ativo, agora estrutura memorias/preferencias |
| Feedback de mensagens | `server/routes/feedback.ts`, `server/storage.ts` | Web/Mobile chat | Like/dislike e motivo | Ativo, agora entra no contexto |
| Lista de desejos/interesses | `server/routes/wishlist.ts` | Wishlist e chat | Preferencias de produto e interesses | Ativo, agora entra no chat |
| Preferencias de calendario | `server/routes/calendar.ts` | Calendario e chat | Estado, feriados e datas notificaveis | Ativo |
| Perfil de saude | `server/routes/health.ts` | Saude e chat | Objetivo, nivel, dias, aparelhos e restricoes | Ativo |
| Mensagem de boas-vindas Web | `client/src/pages/Home.tsx` | Login/registro Web | Primeira fala local da Bee | Ativa, melhorada |
| Mensagem vazia Mobile | `mobile/locales/pt.ts` | Chat Mobile vazio | Primeiro convite para conversa | Ativa, melhorada |
| Prompts sugeridos da Colmeia/Wishlist | Web/Mobile Wishlist | Cards de sugestao | Exemplos de comandos | Ativos |
| Auditoria de contextos | `scripts/audit-bee-contexts.ts` | `npm run audit:bee-contexts` | Detecta prompts, duplicados e respostas genericas | Novo, ativo |

## 3. Contextos Ativos

Ativos no fluxo principal da Bee:

- `buildSystemPrompt`
- `buildChatSystemPrompt`
- `buildBeePersonalizationContext`
- `buildConversationContextUpdate`
- `PERSONALITY_PROMPT`
- `MEMORY_PROMPT`
- `buildDailyBriefingPrompt`
- `buildProactivePrompt`
- `buildCalendarContextForAI`
- `buildHealthContextForAI`
- `formatResultsForContext`
- `formatRoutineContext`
- `parseBeeCommand` e `inferExplicitToolActions`
- Mensagens de boas-vindas Web/Mobile
- Feedback de mensagem e categorias
- Onboarding, wishlist, calendario, alarmes, saude e humor como fontes de contexto

## 4. Contextos Sem Uso ou Mal Aproveitados

- `user_personality.traits`: usado no prompt, mas era um deposito unico de fatos. Continua ativo por compatibilidade, mas agora foi complementado por `user_memories`.
- `message_feedback`: era salvo e exibido, mas nao personalizava a conversa. Agora entra no contexto como categorias bem recebidas ou que precisam ajuste.
- `user_interests` da Lista de Desejos: era usado na Wishlist/recomendacoes, mas nao entrava no chat principal. Agora entra no `runtimeContext`.
- `mood_entries`: usado pela tela de humor, mas pouco usado no chat. Agora o chat recebe media e notas recentes.
- `calendar_preferences`: usado no calendario; no chat so entrava indiretamente para feriados. Continua ativo e deve evoluir para carregar categorias habilitadas.
- Textos de erro/alerta Web e Mobile: ainda ha duplicacoes entre plataformas; alguns sao intencionais para equivalencia de UX, mas pedem centralizacao futura.

## 5. Contextos Duplicados

A auditoria (`npm run audit:bee-contexts`) encontrou:

- 135 builders/referencias de prompt/contexto.
- 75 referencias a dados de contexto.
- 0 riscos diretos de resposta generica literal depois do ajuste da auditoria.
- 61 grupos de literais duplicados.

Duplicacoes relevantes:

- Feedback de mensagem Web/Mobile: textos iguais em `client/src/pages/Home.tsx` e `mobile/features/chat/screens/ChatScreen.tsx`.
- Wishlist: "Prontinho! Salvei isso na sua Lista de Desejos" aparece no backend e nos componentes Web/Mobile como fallback.
- Rotas Colmeia: endpoints repetidos entre backend, Web e Mobile, esperado por consumo compartilhado.
- Mensagens de erro "Nao consegui..." repetidas entre Web/Mobile, aceitavel como fallback, mas candidatas a centralizacao.

## 6. O Que Foi Melhorado

- Prompt central reescrito para a Bee ser mais acolhedora, clara, util e emocionalmente adaptativa.
- Removido o tom excessivamente duro de "cobranca"; agora e "apoio firme".
- Criada camada estruturada de memoria inteligente:
  - `user_memories`
  - `user_preferences`
  - `bee_conversation_contexts`
- Onboarding agora grava objetivos/rotina/interesses em memoria e preferencia estruturadas.
- Chat principal agora recebe:
  - memorias ativas;
  - preferencias ativas;
  - resumo dinamico da conversa;
  - tom emocional detectado;
  - feedback de mensagens;
  - humor recente;
  - interesses da Lista de Desejos;
  - agenda e alarmes;
  - calendario publico;
  - contexto de saude;
  - resultados de pesquisa quando houver.
- Daily briefing agora tambem usa memorias estruturadas.
- Boas-vindas Web/Mobile deixaram de ser genericas e passaram a sugerir caminhos concretos.
- Criada API para visualizar/controlar memoria e personalizacao.
- Criada auditoria tecnica de contextos.

## 7. O Que Foi Removido ou Desativado

Nada foi removido fisicamente para evitar quebra de compatibilidade. O legado `user_personality.traits` continua ativo, mas deixa de ser a unica fonte de memoria.

Foi despriorizado no comportamento:

- Resposta fria/generica do tipo "Como posso ajudar?"
- Tom de cobranca agressivo.
- Personalizacao sem transparencia.
- Prompts enormes sem padrao interno explicito.

## 8. O Que Ainda Precisa Ser Criado

- Tela Web/Mobile completa para o usuario visualizar, editar e apagar memorias/preferencias usando `/api/bee/context`.
- Migracao historica opcional para popular `user_memories` a partir de `user_personality.traits` de usuarios antigos.
- Central de textos compartilhados Web/Mobile para reduzir duplicacao.
- Preferencias finas de tom: mais direta, mais carinhosa, mais tecnica, menos emojis, respostas curtas/longas.
- Sumarizacao com LLM para conversas muito longas; hoje o resumo dinamico e deterministico.
- Testes automatizados especificos para memoria, preferencias e continuidade conversacional.

## 9. Nova Logica de Contexto da Bee

Fluxo atual:

1. Usuario envia mensagem no Web ou Mobile.
2. Ambos usam o mesmo `/api/chat`.
3. Backend busca usuario, personalidade, historico, agenda, alarmes, memorias, preferencias, feedback, humor e interesses.
4. `buildBeePersonalizationContext` monta um bloco unico de personalizacao.
5. `buildChatSystemPrompt` junta personalidade central + contexto runtime.
6. IA responde com tom adaptado e, se necessario, JSON interno para ferramentas.
7. Backend executa ferramentas, salva resposta, atualiza personalidade e atualiza `bee_conversation_contexts`.
8. Proximas mensagens recebem o resumo e os topicos recentes, permitindo continuidade.

## 10. Como Testar

1. Rodar `npm run check`.
2. Rodar `npm run audit:bee-contexts`.
3. Aplicar migracao `migrations/0010_bee_memory_context.sql` ou usar fluxo de migracao do projeto.
4. Fazer onboarding com objetivos, rotina e interesses.
5. Chamar `GET /api/bee/context` autenticado e verificar memorias/preferencias.
6. No chat, testar:
   - "Estou cansado hoje."
   - "Me lembra de pagar a conta sexta."
   - "Quero treinar amanhã."
   - "Não gostei dessa resposta."
   - "E amanhã?" depois de falar de treino.
7. Verificar se Web e Mobile produzem o mesmo comportamento, pois ambos passam pelo mesmo backend.

## 11. Antes e Depois

Antes:

- "Como posso ajudar?"
- "Comando registrado."
- "Erro ao salvar."
- "Informe os dados."

Depois esperado:

- "Oi, Aldemir! Quer organizar sua rotina de hoje, revisar seus treinos ou ver seus próximos compromissos?"
- "Prontinho! A Bee já organizou isso para você."
- "Ops, não consegui salvar agora. Vamos tentar de novo?"
- "Me conta algumas informações para eu te ajudar melhor."

## 12. Web e Mobile

Confirmacao: Web e Mobile usam o mesmo padrao de personalidade no chat principal porque ambos consomem `/api/chat`.

Tambem foram alinhadas:

- mensagem inicial Web em `client/src/pages/Home.tsx`;
- mensagem de chat vazio Mobile em `mobile/locales/pt.ts`;
- backend compartilhado de memoria/contexto.

Ainda falta centralizar todos os textos de fallback para reduzir divergencias pequenas entre plataformas.

## 13. Sugestoes Futuras

- Criar "Painel da memoria da Bee" em Configuracoes.
- Permitir que o usuario diga "Bee, esquece isso" e acionar exclusao de memoria.
- Criar preferencias de resposta por categoria: saude, trabalho, estudos, social, emocional.
- Adicionar contexto de compromissos do dia no briefing de forma resumida.
- Usar feedback negativo para reescrever automaticamente a resposta com outro estilo.
- Criar metricas de qualidade conversacional: personalizacao, continuidade, genericidade e uso de contexto.
- Incluir explicacao "por que a Bee sugeriu isso" quando usar preferencias sensiveis.
