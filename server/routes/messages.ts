import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendError, sendOk } from "../api/response";
import {
  buildIntelligentNotifications,
  buildScoreSnapshot,
  generateProactiveMessage,
  parseAIActions,
  streamChat,
  summarizeNewsArticle,
  updatePersonalityFromMessage,
} from "../ai";
import { parseBoundedInt } from "../http";
import { requireAuth } from "../middleware/requireAuth";
import { checkRateLimit } from "../rateLimit";
import { storage } from "../storage";

const APP_TIPS: { id: number; text: string }[] = [
  // ── Chat & IA ──────────────────────────────────────────────────────────────
  { id: 1,  text: "💡 Dica: para criar uma missão, diga claramente 'crie uma missão para...' ou 'quero uma meta de...'. Isso me avisa que é um compromisso de verdade, não só papo." },
  { id: 2,  text: "💡 Dica: você pode usar comandos rápidos no chat. Digite /missoes para ver suas tarefas, /feed para o timeline, /comunidades para grupos, ou /noticias para manchetes personalizadas." },
  { id: 3,  text: "💡 Dica: sente que está travado? Me manda uma frase sobre o que está bloqueando. Eu não deixo você ficar parado — te ajudo a encontrar o próximo passo agora." },
  { id: 4,  text: "💡 Dica: o painel Insight mostra seu foco, constância e disciplina da semana. Toque no ícone de insight no chat para ver sua pontuação atual e o que ela significa." },
  { id: 5,  text: "💡 Dica: me chame pelo que você precisa agora: 'Quero evoluir', 'Me cobre hoje' ou 'Criar meta'. Os botões de ação rápida no chat são atalhos para começar rápido." },
  { id: 6,  text: "💡 Dica: eu lembro de tudo que você me conta. Quanto mais você compartilha seus objetivos e desafios, mais personalizadas ficam minhas sugestões para você." },
  { id: 7,  text: "💡 Dica: se quiser notícias relevantes, toque em 'Buscar notícias' ou mande /noticias. Eu filtro as manchetes com base no seu perfil e interesses." },
  { id: 8,  text: "💡 Dica: você pode conversar comigo sobre qualquer coisa — produtividade, reflexões, ideias, planos. Quanto mais natural a conversa, melhores minhas análises sobre você." },

  // ── Missões & XP ──────────────────────────────────────────────────────────
  { id: 9,  text: "💡 Dica: complete missões diárias para ganhar XP e subir de nível. Cada nível desbloqueia recursos novos — Mensagens Diretas no nível 2, navegação anônima no nível 3." },
  { id: 10, text: "💡 Dica: os Desafios Bônus aparecem quando você completa todas as missões do dia. São aleatórios, valem XP extra e foram criados especialmente para manter seu ritmo." },
  { id: 11, text: "💡 Dica: missões do sistema (Boas-vindas, Social, Conectado, Criador) são a base do seu crescimento no app. Complete todas de uma fase para desbloquear a próxima." },
  { id: 12, text: "💡 Dica: o Resumo Semanal na tela de Missões traz um raio-x da sua semana — consistência, disciplina, ponto forte e onde melhorar. Aparece toda semana automaticamente." },
  { id: 13, text: "💡 Dica: mantenha sua sequência (streak) ativa todos os dias. Sequências de 3, 7 e 30 dias te dão bônus de XP e mostram que você é constante de verdade." },

  // ── Feed ───────────────────────────────────────────────────────────────────
  { id: 14, text: "💡 Dica: o Feed não é só uma timeline — é onde sua rede vê seu progresso. Publicar pequenas vitórias aumenta sua conexão com a comunidade e motiva os outros." },
  { id: 15, text: "💡 Dica: você pode postar texto + foto no Feed. Toque no ícone de câmera ou galeria no compositor de post para adicionar uma imagem ao que está pensando." },
  { id: 16, text: "💡 Dica: a IA comenta automaticamente nos posts do Feed com uma análise do sentimento e tom. É um jeito de ver como sua mensagem está sendo percebida." },

  // ── Comunidades ────────────────────────────────────────────────────────────
  { id: 17, text: "💡 Dica: Comunidades são grupos temáticos. Entre em comunidades alinhadas com seus objetivos — você encontra pessoas com os mesmos focos e objetivos que você." },
  { id: 18, text: "💡 Dica: postar numa Comunidade conta como interação social e pode desbloquear a conquista 'first_community_post'. Comunidades ativas aparecem para mais pessoas." },
  { id: 19, text: "💡 Dica: ao entrar em uma comunidade, você ganha pontos de conquista. Toque no nome da comunidade para ver todos os membros ativos." },

  // ── Amigos & Conexões ──────────────────────────────────────────────────────
  { id: 20, text: "💡 Dica: use a busca em Amigos para encontrar pessoas pelo nome de usuário. Quando você conecta com alguém, você pode acompanhar o progresso dela no app." },
  { id: 21, text: "💡 Dica: a aba Matches da Bee em Amigos mostra sugestões inteligentes baseadas nos seus interesses e comportamento. Pessoas que pensam parecido com você." },
  { id: 22, text: "💡 Dica: escreva um depoimento para um amigo! Vá ao perfil dele e toque em 'Depoimento'. É uma forma autêntica de reconhecer o crescimento de alguém." },
  { id: 23, text: "💡 Dica: ao aceitar uma conexão, vocês dois ganham a conquista de conexão. Com 5 amigos, você desbloqueia a medalha 'Abelha Social'." },

  // ── Mensagens Diretas ──────────────────────────────────────────────────────
  { id: 24, text: "💡 Dica: Mensagens Diretas desbloqueiam no nível 2. Complete missões para chegar lá e começar a conversar em privado com seus amigos." },
  { id: 25, text: "💡 Dica: na sua inbox, você pode responder em tempo real aos seus amigos. As conversas ficam organizadas por pessoa para você acompanhar facilmente." },

  // ── Humor & Bem-estar ──────────────────────────────────────────────────────
  { id: 26, text: "💡 Dica: registre seu humor todo dia no módulo Humor. Eu uso esses dados para ajustar o tom das minhas mensagens e o tipo de missão que proponho para você." },
  { id: 27, text: "💡 Dica: o calendário de humor mostra os últimos 30 dias em cores. Padrões de humor ruim repetido podem ser um sinal que vale levar ao insight da semana." },

  // ── Alertas & Notificações ────────────────────────────────────────────────
  { id: 28, text: "💡 Dica: os Alertas da Bee mostram sinais que precisam da sua atenção: riscos de streak, progresso social, novas conexões. Passe lá antes de fechar o app." },
  { id: 29, text: "💡 Dica: alertas com borda vermelha são urgentes — risco real de perder progresso. Amarelo é atenção. Verde é celebração. Fique de olho nas cores." },

  // ── Medalhas & Conquistas ──────────────────────────────────────────────────
  { id: 30, text: "💡 Dica: as medalhas ficam no seu perfil e mostram sua trajetória no app. Cada uma tem critérios específicos — toque nela para ver como desbloquear." },
  { id: 31, text: "💡 Dica: a primeira missão concluída, o primeiro post, o primeiro amigo — cada marco inicial te dá uma medalha. Veja as que ainda estão travadas para saber o que falta." },

  // ── Configurações & Privacidade ────────────────────────────────────────────
  { id: 32, text: "💡 Dica: a navegação anônima (nível 3) faz suas visitas a perfis não aparecerem para o dono. Ative nas Configurações quando não quiser ser identificado ao explorar perfis." },
  { id: 33, text: "💡 Dica: você pode alterar nome de exibição e bio a qualquer momento nas Configurações. Manter seu perfil atualizado ajuda a IA a entender melhor quem você é hoje." },
  { id: 34, text: "💡 Dica: o tema escuro está disponível nas Configurações em Aparência. O app detecta automaticamente o idioma do seu dispositivo — português, inglês ou espanhol." },

  // ── Estratégia de uso ──────────────────────────────────────────────────────
  { id: 35, text: "💡 Dica: o melhor jeito de usar o BeeEyes é abrir o chat uma vez por dia e me contar o que está na cabeça. Não precisa ser longo — uma frase já ativa o sistema." },
  { id: 36, text: "💡 Dica: trate suas missões como compromissos reais, não sugestões. Completar todas do dia, mesmo as simples, muda sua relação com consistência ao longo do tempo." },
  { id: 37, text: "💡 Dica: invista uns 5 minutos por semana lendo o Resumo Semanal. Ele mostra onde você está evoluindo e o que está travado antes que vire um problema maior." },
  { id: 38, text: "💡 Dica: o BeeEyes foi feito para ser parte da sua rotina diária, não uma tarefa pesada. Pequenos check-ins frequentes valem muito mais do que sessões longas e raras." },
];

export function createMessagesRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
  const router = Router();

  type NotificationCenterItem = {
    id: string;
    category: "alert" | "activity" | "social";
    source: "intelligent" | "proactive" | "visit" | "connection";
    title: string;
    body: string;
    tone: "danger" | "warning" | "positive" | "neutral";
    createdAt: string;
    read: boolean;
  };

  async function getUserActivitySnapshot(userId: string) {
    const [user, missions, messages, posts] = await Promise.all([
      storage.getUser(userId),
      storage.getMissionsByUser(userId),
      storage.getMessagesByUser(userId, 200),
      storage.getPostsByUser(userId, 50),
    ]);

    if (!user) {
      throw notFound("UsuÃ¡rio nÃ£o encontrado");
    }

    const now = new Date();
    const since = new Date(now);
    since.setDate(now.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
    const dailyActivity = new Map<string, number>();

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      dailyActivity.set(weekday.format(day), 0);
    }

    const touch = (dateValue: Date | string | null | undefined) => {
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (date < since) return;
      const key = weekday.format(date);
      dailyActivity.set(key, (dailyActivity.get(key) ?? 0) + 1);
    };

    const weeklyMissions = missions.filter((mission) => new Date(mission.createdAt) >= since);
    weeklyMissions.forEach((mission) => {
      touch(mission.createdAt);
      if (mission.completedAt) touch(mission.completedAt);
    });
    messages.forEach((message) => touch(message.createdAt));
    posts.forEach((post) => touch(post.createdAt));

    const activeDays = [...dailyActivity.values()].filter((count) => count > 0).length;
    const completedMissions = weeklyMissions.filter((mission) => mission.completed).length;
    const pendingMissions = missions.filter((mission) => !mission.completed).length;
    const lastActiveHours = user.lastActiveAt
      ? Math.max(0, (Date.now() - new Date(user.lastActiveAt).getTime()) / 3600000)
      : null;

    return {
      user,
      activeDays,
      completedMissions,
      totalMissionsTouched: weeklyMissions.length,
      pendingMissions,
      lastActiveHours,
    };
  }

  function shouldCreateMissionFromChat(userMessage: string, suggestedMission?: { title: string; description: string; xp_reward: number }) {
    if (!suggestedMission) return false;
    const text = userMessage.toLowerCase().trim();

    // Exige pedido EXPLÍCITO de criação de missão/meta/tarefa.
    // Menções genéricas ("quero estudar", "vou treinar") NÃO criam missão.
    const explicitRequest =
      // "crie uma missão para X" / "cria uma tarefa" / "adiciona uma meta"
      /\b(cri[ae]|registr[ae]|adicion[ae]|coloc[ae]|quer[ao] (criar|registrar|adicionar))\b.{0,40}\b(miss[aã]o|tarefa|meta|objetivo|compromisso)\b/.test(text) ||
      // "pode colocar isso como missão" / "transforma isso em missão"
      /\b(transform[ae]|coloc[ae]|bot[ae])\b.{0,30}\b(miss[aã]o|tarefa|meta)\b/.test(text) ||
      // "quero criar uma missão de X"
      /\bquero criar (uma |a )?(miss[aã]o|tarefa|meta)\b/.test(text);

    if (!explicitRequest) return false;

    const title = suggestedMission.title?.trim() ?? "";
    // Título precisa ser concreto: entre 8 e 70 chars, não pode ser genérico
    if (title.length < 8 || title.length > 70) return false;
    const isGenericTitle = /^(fazer algo|tarefa|missao|meta|objetivo|compromisso|estudar|treinar)$/i.test(title);
    return !isGenericTitle;
  }

  router.get("/api/messages", requireAuth, asyncHandler(async (req, res) => {
    const limit = parseBoundedInt(req.query.limit, { fallback: 50, min: 1, max: 100 });
    return sendOk(res, await storage.getMessagesByUser(req.userId!, limit));
  }));

  router.get("/api/score", requireAuth, asyncHandler(async (req, res) => {
    const snapshot = await getUserActivitySnapshot(req.userId!);
    return sendOk(res, buildScoreSnapshot({
      activeDays: snapshot.activeDays,
      completedMissions: snapshot.completedMissions,
      totalMissionsTouched: snapshot.totalMissionsTouched,
      streak: snapshot.user.currentStreak,
      level: snapshot.user.level,
      xp: snapshot.user.xp,
      lastActiveHours: snapshot.lastActiveHours,
      pendingMissions: snapshot.pendingMissions,
    }));
  }));

  router.get("/api/notifications/intelligent", requireAuth, asyncHandler(async (req, res) => {
    const snapshot = await getUserActivitySnapshot(req.userId!);
    const score = buildScoreSnapshot({
      activeDays: snapshot.activeDays,
      completedMissions: snapshot.completedMissions,
      totalMissionsTouched: snapshot.totalMissionsTouched,
      streak: snapshot.user.currentStreak,
      level: snapshot.user.level,
      xp: snapshot.user.xp,
      lastActiveHours: snapshot.lastActiveHours,
      pendingMissions: snapshot.pendingMissions,
    });

    return sendOk(res, buildIntelligentNotifications({
      focusScore: score.focusScore,
      consistencyScore: score.consistencyScore,
      disciplineScore: score.disciplineScore,
      completedMissions: snapshot.completedMissions,
      pendingMissions: snapshot.pendingMissions,
      streak: snapshot.user.currentStreak,
      lastActiveHours: snapshot.lastActiveHours,
    }));
  }));

  router.get("/api/notifications/center", requireAuth, asyncHandler(async (req, res) => {
    const [recentMessages, notificationReads] = await Promise.all([
      storage.getMessagesByUser(req.userId!, 40),
      storage.getNotificationReadsByUser(req.userId!),
    ]);
    const readIds = new Set(notificationReads.map((item) => item.notificationId));

    // Apenas eventos reais — sem leitura de score/análise (essa fica no Insight do Chat)
    const messageItems = recentMessages.flatMap<NotificationCenterItem>((message) => {
      if (message.role !== "assistant") return [];

      let metadata: Record<string, unknown> = {};
      try {
        metadata = JSON.parse(message.metadata || "{}");
      } catch {
        metadata = {};
      }

      if (metadata.visitFrom) {
        return [{
          id: `visit-${message.id}`,
          category: "social" as const,
          source: "visit" as const,
          title: "Alguem passou pelo seu perfil",
          body: message.content,
          tone: "positive" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
        }];
      }

      if (metadata.proactive === true) {
        return [{
          id: `proactive-${message.id}`,
          category: "activity" as const,
          source: "proactive" as const,
          title: "A Bee chamou sua atencao",
          body: message.content,
          tone: "neutral" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
        }];
      }

      if (metadata.type === "connection_request") {
        return [{
          id: `connection-${message.id}`,
          category: "social" as const,
          source: "connection" as const,
          title: "Nova solicitacao de conexao",
          body: message.content,
          tone: "positive" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
        }];
      }

      if (metadata.type === "community_invite") {
        return [{
          id: `community-invite-${message.id}`,
          category: "social" as const,
          source: "community" as const,
          title: "Convite para Comunidade",
          body: message.content,
          tone: "positive" as const,
          createdAt: new Date(message.createdAt).toISOString(),
          read: false,
        }];
      }

      return [];
    });

    const deduped: NotificationCenterItem[] = [...messageItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
      .map((item) => ({ ...item, read: readIds.has(item.id) }))
      .slice(0, 12);

    return sendOk(res, deduped);
  }));

  router.post("/api/notifications/push-token", requireAuth, asyncHandler(async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token.trim()) {
      throw badRequest("token obrigatório");
    }
    await storage.updateUserPushToken(req.userId!, token.trim());
    return sendOk(res, { registered: true });
  }));

  router.delete("/api/notifications/push-token", requireAuth, asyncHandler(async (req, res) => {
    await storage.updateUserPushToken(req.userId!, null);
    return sendOk(res, { unregistered: true });
  }));

  router.post("/api/notifications/read", requireAuth, asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (ids.length === 0) {
      throw badRequest("ids obrigatorios");
    }

    await storage.markNotificationsAsRead(
      ids.map((notificationId: string) => ({
        userId: req.userId!,
        notificationId,
      }))
    );

    return sendOk(res, { acknowledged: true, count: ids.length });
  }));

  router.post("/api/chat", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { content, isSystem = false } = req.body ?? {};

    if (!content?.trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "Mensagem não pode ser vazia");
    }

    if (!isSystem) {
      const rate = checkRateLimit(userId);
      if (!rate.allowed) {
        const minutes = Math.ceil(rate.resetInMs / 60000);
        return sendError(
          res,
          429,
          "RATE_LIMITED",
          `Você enviou muitas mensagens. Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} para continuar. 🐝`,
        );
      }
    }

    const [user, personality, history] = await Promise.all([
      storage.getUser(userId),
      storage.getPersonality(userId),
      storage.getMessagesByUser(userId, 20),
    ]);

    if (!user || !personality) {
      return sendError(res, 404, "NOT_FOUND", "Usuário não encontrado");
    }

    if (!isSystem) {
      await storage.createMessage({ userId, role: "user", content });
      await storage.incrementMessageCount(userId);
      triggerMissionAction(userId, "send_message").catch(() => {});
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const chatHistory = history.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

    let fullResponse = "";
    try {
      fullResponse = await streamChat(user, personality, chatHistory, content, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      });
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Erro ao gerar resposta" })}\n\n`);
      res.end();
      return;
    }

    const { cleanText, suggestedMission, achievement, fetchNews } = parseAIActions(fullResponse);
    await storage.createMessage({ userId, role: "assistant", content: cleanText });

    const missionDraft = suggestedMission && shouldCreateMissionFromChat(content, suggestedMission) ? suggestedMission : null;
    if (missionDraft) {
      const mission = await storage.createMission({
        userId,
        title: missionDraft.title,
        description: missionDraft.description,
        xpReward: missionDraft.xp_reward || 20,
      });
      res.write(`data: ${JSON.stringify({ type: "mission_created", mission })}\n\n`);
    }

    if (achievement) {
      const alreadyHas = await storage.hasAchievement(userId, achievement.type);
      if (!alreadyHas) {
        const unlocked = await storage.createAchievement({ userId, ...achievement });
        res.write(`data: ${JSON.stringify({ type: "achievement_unlocked", achievement: unlocked })}\n\n`);
      }
    }

    storage.hasAchievement(userId, "first_message")
      .then(async (hasAchievement) => {
        if (hasAchievement) return;
        const unlocked = await storage.createAchievement({
          userId,
          type: "first_message",
          title: "Primeira Conversa!",
          description: "Você começou sua jornada com o BeeEyes 🐝",
        });
        res.write(`data: ${JSON.stringify({ type: "achievement_unlocked", achievement: unlocked })}\n\n`);
      })
      .catch(() => {});

    if (fetchNews?.query) {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(fetchNews.query)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
        const rssRes = await fetch(rssUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(8000),
        });

        if (rssRes.ok) {
          const xml = await rssRes.text();
          const items: Array<{ title: string; link: string; source: string }> = [];
          const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

          for (const match of matches) {
            const block = match[1];
            const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
            const link = (block.match(/<link>(.*?)<\/link>/)?.[1] ?? "").trim();
            const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "").trim();
            if (title && link) items.push({ title, link, source });
            if (items.length >= 5) break;
          }

          res.write(`data: ${JSON.stringify({ type: "news_fetched", query: fetchNews.query, items })}\n\n`);
        }
      } catch {
        // ignore
      }
    }

    storage.updateUserStreak(userId).catch(() => {});
    updatePersonalityFromMessage(userId, content, cleanText).catch(() => {});

    res.write(`data: ${JSON.stringify({ type: "done", cleanText })}\n\n`);
    res.end();
  }));

  router.get("/api/proactive", requireAuth, asyncHandler(async (req, res) => {
    const recentMessages = await storage.getMessagesByUser(req.userId!, 10);

    if (recentMessages.length > 0) {
      const lastMsg = recentMessages[recentMessages.length - 1];
      const minutesSinceLast = (Date.now() - new Date(lastMsg.createdAt).getTime()) / 60000;
      if (minutesSinceLast < 15) return sendOk(res, { message: null });

      const lastProactive = [...recentMessages].reverse().find((message) => {
        try {
          return JSON.parse(message.metadata || "{}").proactive === true;
        } catch {
          return false;
        }
      });

      if (lastProactive) {
        const minutesSince = (Date.now() - new Date(lastProactive.createdAt).getTime()) / 60000;
        if (minutesSince < 90) return sendOk(res, { message: null });
      }
    }

    if (Math.random() > 0.4) {
      return sendOk(res, { message: null });
    }

    const [user, personality, missions] = await Promise.all([
      storage.getUser(req.userId!),
      storage.getPersonality(req.userId!),
      storage.getMissionsByUser(req.userId!, false),
    ]);

    if (!user || !personality) {
      return sendOk(res, { message: null });
    }

    const content = Math.random() < 0.35
      ? APP_TIPS[Math.floor(Math.random() * APP_TIPS.length)].text
      : await generateProactiveMessage(user, personality, missions);
    if (!content) {
      return sendOk(res, { message: null });
    }

    await storage.createMessage({
      userId: req.userId!,
      role: "assistant",
      content,
      metadata: JSON.stringify({ proactive: true }),
    });

    return sendOk(res, { message: content });
  }));

  router.get("/api/app-tip", requireAuth, asyncHandler(async (req, res) => {
    const recentMessages = await storage.getMessagesByUser(req.userId!, 60);

    // Check 4-hour cooldown since last tip
    const lastTip = [...recentMessages].reverse().find((m) => {
      try { return JSON.parse(m.metadata || "{}").appTip === true; } catch { return false; }
    });
    if (lastTip) {
      const hoursSince = (Date.now() - new Date(lastTip.createdAt).getTime()) / 3600000;
      if (hoursSince < 4) return sendOk(res, { tip: null });
    }

    // Collect tip IDs shown in the last 60 messages to avoid recent repetition
    const recentTipIds = new Set<number>();
    for (const m of recentMessages) {
      try {
        const meta = JSON.parse(m.metadata || "{}");
        if (meta.appTip && typeof meta.tipId === "number") recentTipIds.add(meta.tipId);
      } catch { /* ignore */ }
    }

    // Pick a tip not recently shown; fall back to any if all were shown
    const available = APP_TIPS.filter((tip) => !recentTipIds.has(tip.id));
    const pool = available.length > 0 ? available : APP_TIPS;
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    await storage.createMessage({
      userId: req.userId!,
      role: "assistant",
      content: chosen.text,
      metadata: JSON.stringify({ appTip: true, tipId: chosen.id }),
    });

    return sendOk(res, { tip: chosen.text });
  }));

  router.patch("/api/messages/:id", requireAuth, asyncHandler(async (req, res) => {
    const { content, metadata } = req.body ?? {};
    if (typeof content !== "string" || typeof metadata !== "string") {
      throw badRequest("content e metadata são obrigatórios");
    }

    const updated = await storage.updateMessageMetadata(req.params.id, req.userId!, { content, metadata });
    if (!updated) {
      throw notFound("Mensagem não encontrada");
    }

    return sendOk(res, updated);
  }));

  router.post("/api/news/summarize", requireAuth, asyncHandler(async (req, res) => {
    const { url, title } = req.body ?? {};
    if (!url || !title) {
      throw badRequest("url e title obrigatórios");
    }

    const summary = await summarizeNewsArticle(url, title);
    if (!summary) {
      return sendError(res, 502, "UPSTREAM_ERROR", "Não foi possível gerar o resumo");
    }

    return sendOk(res, { summary });
  }));

  return router;
}
