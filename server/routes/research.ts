import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../api/async-handler";
import { badRequest } from "../api/errors";
import { sendOk } from "../api/response";
import { requireAuth } from "../middleware/requireAuth";
import { runResearch, formatResultsForContext } from "../services/beeResearchService";
import { classifyIntent } from "../services/searchIntentService";
import { storage } from "../storage";

const researchSchema = z.object({
  message: z.string().trim().min(1).max(600),
  location: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      city: z.string().trim().max(100).optional(),
    })
    .optional()
    .nullable(),
});

export function createResearchRouter() {
  const router = Router();

  /**
   * POST /api/bee/research
   * Standalone research endpoint — can be called directly from client
   * to get search results without going through the full chat flow.
   */
  router.post("/api/bee/research", requireAuth, asyncHandler(async (req, res) => {
    const body = researchSchema.parse(req.body);
    const user = await storage.getUser(req.userId!);
    if (!user) throw badRequest("Usuário não encontrado");

    const intent = classifyIntent(body.message);
    if (intent.intent === "none") {
      return sendOk(res, { intent: "none", summary: null, results: [], cards: false });
    }

    const userCity = body.location?.city ?? user.city ?? undefined;
    const userLocation =
      body.location?.latitude != null && body.location?.longitude != null
        ? { latitude: body.location.latitude, longitude: body.location.longitude }
        : null;

    const { request, results } = await runResearch(body.message, userCity, userLocation);
    const contextSummary = formatResultsForContext(request.intent, results);

    return sendOk(res, {
      intent: request.intent,
      query: request.query,
      summary: contextSummary || null,
      results,
      cards: results.length > 0,
    });
  }));

  return router;
}
