import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { inferMessageCategory } from "../services/messageCategory";

const VALID_FEEDBACK_TYPES = new Set(["like", "dislike"]);
const VALID_DISLIKE_REASONS = new Set([
  "too_long",
  "confusing",
  "not_what_i_wanted",
  "inappropriate_tone",
  "incomplete",
  "other",
]);
const VALID_PRIVACY = new Set(["public", "friends", "private"]);

export function createFeedbackRouter() {
  const router = Router();

  // ── Curtir / Não curti em mensagens da Bee ──────────────────────────────

  router.post("/api/messages/:id/feedback", requireAuth, asyncHandler(async (req, res) => {
    const messageId = req.params.id;
    const { type, reason } = req.body ?? {};

    if (typeof type !== "string" || !VALID_FEEDBACK_TYPES.has(type)) {
      throw badRequest("Tipo de feedback inválido");
    }
    if (reason !== undefined && reason !== null && typeof reason !== "string") {
      throw badRequest("Motivo inválido");
    }
    if (type === "dislike" && reason && !VALID_DISLIKE_REASONS.has(reason)) {
      throw badRequest("Motivo de não-curti inválido");
    }

    // Busca a mensagem só para validar dono + categorizar
    const messages = await storage.getMessagesByUser(req.userId!, 500);
    const message = messages.find((m) => m.id === messageId);
    if (!message) throw notFound("Mensagem não encontrada");
    if (message.role !== "assistant") {
      throw badRequest("Só é possível dar feedback em mensagens da Bee");
    }

    const category = inferMessageCategory(message.content);
    const saved = await storage.upsertMessageFeedback({
      userId: req.userId!,
      messageId,
      feedbackType: type as "like" | "dislike",
      feedbackReason: reason ?? null,
      messageCategory: category,
    });

    return sendCreated(res, saved);
  }));

  router.delete("/api/messages/:id/feedback", requireAuth, asyncHandler(async (req, res) => {
    const removed = await storage.deleteMessageFeedback(req.userId!, req.params.id);
    return sendOk(res, { removed });
  }));

  router.post("/api/messages/feedback/batch", requireAuth, asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id: unknown) => typeof id === "string").slice(0, 200)
      : [];
    const rows = await storage.getMessageFeedbackByIds(req.userId!, ids);
    return sendOk(res, rows);
  }));

  router.get("/api/me/preferences-from-feedback", requireAuth, asyncHandler(async (req, res) => {
    const rows = await storage.getMessageFeedbackSummary(req.userId!);
    return sendOk(res, rows);
  }));

  // ── Feed drafts (Enviar para o Feed) ────────────────────────────────────

  router.post("/api/feed-drafts", requireAuth, asyncHandler(async (req, res) => {
    const { sourceMessageId, title, content, category, hashtags, privacy } = req.body ?? {};

    if (typeof content !== "string" || !content.trim()) {
      throw badRequest("Conteúdo do rascunho não pode ficar vazio");
    }
    if (content.length > 2000) {
      throw badRequest("Rascunho muito longo (máximo 2000 caracteres)");
    }
    if (privacy !== undefined && (typeof privacy !== "string" || !VALID_PRIVACY.has(privacy))) {
      throw badRequest("Privacidade inválida");
    }

    const draft = await storage.createFeedDraft({
      userId: req.userId!,
      sourceMessageId: typeof sourceMessageId === "string" ? sourceMessageId : null,
      title: typeof title === "string" ? title.trim().slice(0, 120) || null : null,
      content: content.trim(),
      category: typeof category === "string" ? category.trim().slice(0, 60) || null : null,
      hashtags: typeof hashtags === "string" ? hashtags.trim().slice(0, 240) || null : null,
      privacy: typeof privacy === "string" ? privacy : "public",
    });

    return sendCreated(res, draft);
  }));

  router.post("/api/feed-drafts/:id/publish", requireAuth, asyncHandler(async (req, res) => {
    const draft = await storage.getFeedDraft(req.params.id, req.userId!);
    if (!draft) throw notFound("Rascunho não encontrado");
    if (draft.status !== "draft") {
      throw badRequest("Rascunho já foi publicado ou cancelado");
    }

    // Monta o conteúdo final, incluindo título (se houver) + hashtags + assinatura da Bee
    const lines: string[] = [];
    if (draft.title) lines.push(`**${draft.title}**`);
    lines.push(draft.content);
    if (draft.hashtags) {
      const tags = draft.hashtags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));
      if (tags.length) lines.push(tags.join(" "));
    }
    lines.push("\n— Criado com ajuda da Bee 🐝");
    const finalContent = lines.join("\n\n").slice(0, 500);

    const post = await storage.createPost({
      userId: req.userId!,
      content: finalContent,
      imageUrl: null,
    });

    const updated = await storage.markFeedDraftPublished(draft.id, req.userId!, post.id);
    return sendOk(res, { draft: updated, post });
  }));

  router.post("/api/feed-drafts/:id/cancel", requireAuth, asyncHandler(async (req, res) => {
    const ok = await storage.cancelFeedDraft(req.params.id, req.userId!);
    if (!ok) throw notFound("Rascunho não encontrado");
    return sendOk(res, { ok: true });
  }));

  return router;
}
