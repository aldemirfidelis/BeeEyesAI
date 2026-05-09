import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, forbidden, notFound } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";

export function createCommunitiesRouter() {
  const router = Router();

  router.get("/api/communities", requireAuth, asyncHandler(async (req, res) => {
    const search = String(req.query.search || "");
    try {
      return sendOk(res, await storage.getCommunities(req.userId!, search));
    } catch (error) {
      req.logger.warn("communities.fetch.failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return sendOk(res, []);
    }
  }));

  router.post("/api/communities", requireAuth, asyncHandler(async (req, res) => {
    const { name, description, category, emoji, imageUrl, isPrivate } = req.body ?? {};
    if (!name?.trim()) {
      throw badRequest("Nome obrigatório");
    }

    const community = await storage.createCommunity({
      name: name.trim(),
      description: description?.trim() || null,
      category: category || "geral",
      emoji: emoji || "🐝",
      imageUrl: imageUrl || null,
      isPrivate: !!isPrivate,
      ownerId: req.userId!,
    });

    return sendCreated(res, community);
  }));

  router.patch("/api/communities/:id", requireAuth, asyncHandler(async (req, res) => {
    const { name, description, imageUrl } = req.body ?? {};
    if (name !== undefined && !String(name).trim()) {
      throw badRequest("Nome não pode ficar vazio");
    }
    const updated = await storage.updateCommunity(req.params.id, req.userId!, {
      name: name !== undefined ? String(name).trim() : undefined,
      description: description !== undefined ? (description?.trim() || null) : undefined,
      imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined,
    });
    if (!updated) throw forbidden("Apenas o fundador pode editar esta comunidade");
    return sendOk(res, updated);
  }));

  router.delete("/api/communities/:id", requireAuth, asyncHandler(async (req, res) => {
    const community = await storage.getCommunityById(req.params.id, req.userId!);
    if (!community) throw notFound("Comunidade não encontrada");
    if (community.memberRole !== "owner") throw forbidden("Apenas o fundador pode apagar esta comunidade");
    await storage.deleteCommunity(req.params.id);
    return sendOk(res, { ok: true });
  }));

  router.get("/api/communities/mine", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.getUserCommunities(req.userId!));
  }));

  router.get("/api/communities/:id", requireAuth, asyncHandler(async (req, res) => {
    const community = await storage.getCommunityById(req.params.id, req.userId!);
    if (!community) {
      throw notFound("Comunidade não encontrada");
    }
    return sendOk(res, community);
  }));

  router.get("/api/communities/:id/members", requireAuth, asyncHandler(async (req, res) => {
    const community = await storage.getCommunityById(req.params.id, req.userId!);
    if (!community) {
      throw notFound("Comunidade nÃ£o encontrada");
    }
    return sendOk(res, await storage.getCommunityMembers(req.params.id));
  }));

  router.post("/api/communities/:id/join", requireAuth, asyncHandler(async (req, res) => {
    const result = await storage.joinCommunity(req.params.id, req.userId!);
    if (result === "joined") {
      storage.ensureAchievement(req.userId!, {
        type: "community_joined",
        title: "Cidadão do App",
        description: "Entrou na sua primeira comunidade. Bem-vindo ao coletivo.",
      }).catch(() => {});
    }
    return sendOk(res, { status: result });
  }));

  router.get("/api/communities/:id/requests", requireAuth, asyncHandler(async (req, res) => {
    const community = await storage.getCommunityById(req.params.id, req.userId!);
    if (!community) throw notFound("Comunidade não encontrada");
    if (community.memberRole !== "owner") throw forbidden("Apenas o fundador pode ver solicitações");
    return sendOk(res, await storage.getPendingJoinRequests(req.params.id));
  }));

  router.post("/api/communities/:id/invite", requireAuth, asyncHandler(async (req, res) => {
    const community = await storage.getCommunityById(req.params.id, req.userId!);
    if (!community) throw notFound("Comunidade não encontrada");

    const { userIds } = req.body ?? {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw badRequest("Lista de usuários inválida");
    }

    const requester = await storage.getUser(req.userId!);
    if (!requester) throw notFound("Usuário não encontrado");
    
    const requesterName = requester.displayName || requester.username;
    const members = await storage.getCommunityMembers(community.id);

    let invitedCount = 0;
    for (const targetId of userIds) {
      if (typeof targetId !== "string") continue;
      // Skip if already a member
      if (members.some((m) => m.id === targetId)) continue;
      
      await storage.createMessage({
        userId: targetId,
        role: "assistant",
        content: `${requesterName} convidou você para entrar na comunidade "${community.name}". Vá para a aba Comunidades e pesquise por "${community.name}" para participar!`,
        metadata: JSON.stringify({
          type: "community_invite",
          communityId: community.id,
          communityName: community.name,
          fromUserId: requester.id,
          fromName: requesterName,
        }),
      });
      invitedCount++;
    }

    return sendOk(res, { ok: true, invitedCount });
  }));

  router.post("/api/communities/:id/requests/:userId/approve", requireAuth, asyncHandler(async (req, res) => {
    const approved = await storage.approveJoinRequest(req.params.id, req.params.userId, req.userId!);
    if (!approved) throw notFound("Solicitação não encontrada ou sem permissão");
    return sendOk(res, { ok: true });
  }));

  router.delete("/api/communities/:id/requests/:userId", requireAuth, asyncHandler(async (req, res) => {
    const rejected = await storage.rejectJoinRequest(req.params.id, req.params.userId, req.userId!);
    if (!rejected) throw notFound("Solicitação não encontrada ou sem permissão");
    return sendOk(res, { ok: true });
  }));

  router.post("/api/communities/:id/leave", requireAuth, asyncHandler(async (req, res) => {
    await storage.leaveCommunity(req.params.id, req.userId!);
    return sendOk(res, { ok: true });
  }));

  router.get("/api/communities/:id/posts", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.getCommunityPosts(req.params.id, req.userId!));
  }));

  router.post("/api/communities/:id/posts", requireAuth, asyncHandler(async (req, res) => {
    const content = String(req.body?.content || "").trim();
    const imageUrl = typeof req.body?.imageUrl === "string" && req.body.imageUrl.startsWith("data:image/")
      ? req.body.imageUrl
      : null;
    if (!content && !imageUrl) {
      throw badRequest("Conteúdo obrigatório");
    }

    const community = await storage.getCommunityById(req.params.id, req.userId!);
    if (!community?.isMember) {
      throw forbidden("Entre na comunidade para publicar");
    }

    const post = await storage.createCommunityPost({ communityId: req.params.id, userId: req.userId!, content: content || "Imagem compartilhada", imageUrl });
    const author = await storage.getUser(req.userId!);
    storage.ensureAchievement(req.userId!, {
      type: "first_community_post",
      title: "Voz na Comunidade",
      description: "Publicou pela primeira vez em uma comunidade. Sua voz importa.",
    }).catch(() => {});

    return sendCreated(res, {
      ...post,
      username: author?.username ?? "usuário",
      displayName: author?.displayName ?? null,
      avatarUrl: author?.avatarUrl ?? null,
      likesCount: 0,
      liked: false,
      commentsCount: 0,
    });
  }));

  router.post("/api/communities/posts/:postId/like", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.toggleCommunityPostLike(req.params.postId, req.userId!));
  }));

  router.get("/api/communities/posts/:postId/comments", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.getCommunityPostComments(req.params.postId, req.userId!));
  }));

  router.post("/api/communities/posts/:postId/comments", requireAuth, asyncHandler(async (req, res) => {
    const content = String(req.body?.content || "").trim();
    if (!content) {
      throw badRequest("Comentário vazio");
    }

    const comment = await storage.createCommunityPostComment({ postId: req.params.postId, userId: req.userId!, content });
    const author = await storage.getUser(req.userId!);
    return sendCreated(res, {
      ...comment,
      username: author?.username ?? "usuário",
      displayName: author?.displayName ?? null,
      avatarUrl: author?.avatarUrl ?? null,
      likesCount: 0,
      liked: false,
    });
  }));

  router.post("/api/communities/comments/:commentId/like", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await storage.toggleCommunityCommentLike(req.params.commentId, req.userId!));
  }));

  router.post("/api/communities/posts/:postId/recommend", requireAuth, asyncHandler(async (req, res) => {
    const { communityName, communityEmoji, content, communityId } = req.body ?? {};
    const allPosts = await storage.getCommunityPosts(communityId || "", req.userId!);
    const original = allPosts.find((post) => post.id === req.params.postId);
    const finalContent = original
      ? `${communityEmoji || "📌"} Recomendado de **${communityName || "comunidade"}**:\n\n"${original.content}"`
      : content
        ? `${communityEmoji || "📌"} Recomendado de **${communityName || "comunidade"}**:\n\n"${content}"`
        : null;

    if (!finalContent) {
      throw badRequest("Conteúdo não encontrado");
    }

    return sendCreated(res, await storage.createPost({ userId: req.userId!, content: finalContent }));
  }));

  return router;
}
