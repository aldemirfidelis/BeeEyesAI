import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, forbidden, notFound } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";

export function createCommunitiesRouter(triggerMissionAction: (userId: string, actionType: string) => Promise<void>) {
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
    const { name, description, category, emoji } = req.body ?? {};
    if (!name?.trim()) {
      throw badRequest("Nome obrigatório");
    }

    const community = await storage.createCommunity({
      name: name.trim(),
      description: description?.trim() || null,
      category: category || "geral",
      emoji: emoji || "🐝",
      ownerId: req.userId!,
    });

    triggerMissionAction(req.userId!, "create_community").catch(() => {});
    return sendCreated(res, community);
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

  router.post("/api/communities/:id/join", requireAuth, asyncHandler(async (req, res) => {
    await storage.joinCommunity(req.params.id, req.userId!);
    triggerMissionAction(req.userId!, "join_community").catch(() => {});
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
    if (!content) {
      throw badRequest("Conteúdo obrigatório");
    }

    const community = await storage.getCommunityById(req.params.id, req.userId!);
    if (!community?.isMember) {
      throw forbidden("Entre na comunidade para publicar");
    }

    const post = await storage.createCommunityPost({ communityId: req.params.id, userId: req.userId!, content });
    const author = await storage.getUser(req.userId!);
    triggerMissionAction(req.userId!, "post_in_community").catch(() => {});

    return sendCreated(res, {
      ...post,
      username: author?.username ?? "usuário",
      displayName: author?.displayName ?? null,
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
