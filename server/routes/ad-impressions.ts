import { randomUUID } from "crypto";
import { Router } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendOk } from "../api/response";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { adGroupItems, adGroups, adImpressions, messages } from "../../shared/schema";
import {
  cleanupExpiredAdImpressions,
  createAdExpiresAt,
  type SponsoredMetadata,
} from "../services/adImpressionService";

const adPayloadSchema = z.object({
  id: z.string().trim().min(1).max(180),
  adMobAdUnitId: z.string().trim().max(260).optional().nullable(),
  adFormat: z.enum([
    "banner",
    "adaptive_banner",
    "native",
    "native_image",
    "native_video",
    "interstitial",
    "rewarded",
    "rewarded_interstitial",
    "app_open",
  ]).optional().default("native"),
  adType: z.string().trim().max(80).optional().default("product_ad"),
  title: z.string().trim().min(1).max(220),
  body: z.string().trim().max(1200).optional().nullable(),
  description: z.string().trim().max(1200).optional().nullable(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  videoUrl: z.string().trim().max(2000).optional().nullable(),
  mediaContent: z.record(z.string(), z.unknown()).optional().default({}),
  targetUrl: z.string().trim().max(2000).optional().nullable(),
  productUrl: z.string().trim().max(2000).optional().nullable(),
  originalUrl: z.string().trim().max(2000).optional().nullable(),
  advertiserName: z.string().trim().max(180).optional().nullable(),
  brand: z.string().trim().max(180).optional().nullable(),
  storeName: z.string().trim().max(180).optional().nullable(),
  callToAction: z.string().trim().max(120).optional().nullable(),
  ctaLabel: z.string().trim().max(120).optional().nullable(),
  callToActionText: z.string().trim().max(120).optional().nullable(),
  price: z.union([z.string(), z.number()]).optional().nullable(),
  priceLabel: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
}).passthrough();

const createChatImpressionSchema = z.object({
  anchorMessageId: z.string().trim().max(180).optional().nullable(),
  adId: z.string().trim().min(1).max(180).optional(),
  beeIntroMessage: z.string().trim().min(1).max(1200),
  isPersonalized: z.boolean().optional().default(false),
  ad: adPayloadSchema.optional(),
  ads: z.array(adPayloadSchema).min(1).max(3).optional(),
  groupTitle: z.string().trim().max(120).optional().default("Anúncios que podem te interessar"),
  layoutType: z.enum(["carousel", "grid", "vertical"]).optional().default("carousel"),
  source: z.string().trim().max(40).optional().default("chat"),
});

function normalizeAd(input: z.infer<typeof adPayloadSchema>) {
  const adFormat = input.adFormat ?? "native";
  return {
    id: input.id,
    adMobAdUnitId: input.adMobAdUnitId ?? null,
    adFormat,
    adType: input.adType ?? "product_ad",
    title: input.title,
    description: input.body ?? input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    videoUrl: input.videoUrl ?? null,
    mediaContent: input.mediaContent ?? {},
    productUrl: input.targetUrl ?? input.productUrl ?? input.originalUrl ?? null,
    advertiserName: input.advertiserName ?? input.brand ?? input.storeName ?? null,
    callToAction: input.callToAction ?? input.ctaLabel ?? input.callToActionText ?? null,
    price: input.priceLabel ?? (input.price != null ? String(input.price) : null),
    category: input.category ?? null,
  };
}

function isChatRenderableAdFormat(format: string) {
  return ["banner", "adaptive_banner", "native", "native_image", "native_video"].includes(format);
}

function messageWithCurrentAdMetadata(message: typeof messages.$inferSelect, impression: typeof adImpressions.$inferSelect) {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(message.metadata || "{}");
  } catch {
    metadata = {};
  }

  return {
    ...message,
    metadata: JSON.stringify({
      ...metadata,
      adImpressionId: impression.id,
      expiresAt: impression.expiresAt.toISOString(),
      addedToWishlist: impression.addedToWishlist,
      status: impression.status,
    }),
  };
}

export function createAdImpressionsRouter() {
  const router = Router();

  router.post("/api/ad-impressions/chat", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const body = createChatImpressionSchema.parse(req.body);
    const requestedAds = body.ads ?? (body.ad ? [body.ad] : []);
    const uniqueAds = requestedAds.filter((ad, index, list) => list.findIndex((item) => item.id === ad.id) === index).slice(0, 3);
    if (uniqueAds.length === 0) throw badRequest("Informe pelo menos um anúncio");
    const normalizedAds = uniqueAds.map(normalizeAd);
    const ad = normalizedAds[0];

    if (body.adId && ad.id !== body.adId) {
      throw badRequest("adId precisa corresponder ao anúncio enviado");
    }

    const unsupported = normalizedAds.find((item) => !isChatRenderableAdFormat(item.adFormat));
    if (unsupported) {
      throw badRequest(`O formato ${unsupported.adFormat} deve ser exibido fora do card do chat`);
    }

    await cleanupExpiredAdImpressions(userId);

    if (body.anchorMessageId && normalizedAds.length === 1) {
      const [existing] = await db
        .select()
        .from(adImpressions)
        .where(and(
          eq(adImpressions.userId, userId),
          eq(adImpressions.anchorMessageId, body.anchorMessageId),
          eq(adImpressions.adId, ad.id),
          eq(adImpressions.status, "active"),
          gte(adImpressions.expiresAt, new Date()),
        ))
        .limit(1);

      if (existing?.messageId) {
        const [message] = await db
          .select()
          .from(messages)
          .where(and(eq(messages.userId, userId), eq(messages.id, existing.messageId)))
          .limit(1);
        if (message) return sendOk(res, { message: messageWithCurrentAdMetadata(message, existing), impression: existing, reused: true });
      }
    }

    const expiresAt = createAdExpiresAt();
    const groupId = normalizedAds.length > 1 ? randomUUID() : null;
    const impressionIds = normalizedAds.map(() => randomUUID());
    const enrichedAds = uniqueAds.map((rawAd, index) => ({
      ...rawAd,
      adFormat: normalizedAds[index].adFormat,
      adType: normalizedAds[index].adType,
      adImpressionId: impressionIds[index],
      adGroupId: groupId ?? undefined,
      expiresAt: expiresAt.toISOString(),
      addedToWishlist: false,
      status: "active",
      isVideo: normalizedAds[index].adFormat === "native_video" || !!normalizedAds[index].videoUrl,
      isNative: normalizedAds[index].adFormat.startsWith("native"),
      isBanner: normalizedAds[index].adFormat === "banner" || normalizedAds[index].adFormat === "adaptive_banner",
      isInterstitial: false,
      isRewarded: false,
      isAppOpen: false,
    }));
    const metadata: SponsoredMetadata = {
      type: groupId ? "sponsored_group" : "sponsored",
      adId: ad.id,
      beeIntroMessage: body.beeIntroMessage,
      isPersonalized: body.isPersonalized,
      ad: enrichedAds[0],
      ads: enrichedAds,
      adGroupId: groupId ?? undefined,
      groupTitle: groupId ? body.groupTitle : undefined,
      layoutType: groupId ? body.layoutType : undefined,
      adImpressionId: groupId ? undefined : impressionIds[0],
      expiresAt: expiresAt.toISOString(),
      addedToWishlist: false,
      status: "active",
    };

    const [message] = await db.insert(messages).values({
      userId,
      role: "assistant",
      content: body.beeIntroMessage,
      metadata: JSON.stringify(metadata),
    }).returning();

    if (groupId) {
      await db.insert(adGroups).values({
        id: groupId,
        userId,
        messageId: message.id,
        anchorMessageId: body.anchorMessageId ?? null,
        title: body.groupTitle,
        layoutType: body.layoutType,
        maxItems: normalizedAds.length,
        status: "active",
        expiresAt,
      });
    }

    const impressions = await db.insert(adImpressions).values(normalizedAds.map((item, index) => ({
      id: impressionIds[index],
      userId,
      messageId: message.id,
      anchorMessageId: body.anchorMessageId ?? null,
      adGroupId: groupId,
      adId: item.id,
      adMobAdUnitId: item.adMobAdUnitId,
      adFormat: item.adFormat,
      adType: item.adType,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
      mediaContent: item.mediaContent,
      productUrl: item.productUrl,
      advertiserName: item.advertiserName,
      callToAction: item.callToAction,
      price: item.price,
      category: item.category,
      source: body.source,
      status: "active",
      addedToWishlist: false,
      expiresAt,
      adData: enrichedAds[index],
    }))).returning();

    if (groupId) {
      await db.insert(adGroupItems).values(impressions.map((impression, index) => ({
        adGroupId: groupId,
        adImpressionId: impression.id,
        order: index,
      })));
    }

    return sendOk(res, { message, impression: impressions[0], impressions, groupId, reused: false });
  }));

  router.get("/api/ad-impressions/recent", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    await cleanupExpiredAdImpressions(userId);

    const rows = await db
      .select()
      .from(adImpressions)
      .where(and(
        eq(adImpressions.userId, userId),
        eq(adImpressions.status, "active"),
        eq(adImpressions.addedToWishlist, false),
        gte(adImpressions.expiresAt, new Date()),
      ))
      .orderBy(desc(adImpressions.viewedAt))
      .limit(100);

    return sendOk(res, rows);
  }));

  router.post("/api/ad-impressions/:id/click", requireAuth, asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(adImpressions)
      .set({ clickedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(adImpressions.id, req.params.id), eq(adImpressions.userId, req.userId!)))
      .returning();
    if (!updated) throw notFound("Anúncio não encontrado");
    return sendOk(res, updated);
  }));

  router.post("/api/ad-impressions/:id/hide", requireAuth, asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(adImpressions)
      .set({ status: "unavailable", updatedAt: new Date() })
      .where(and(eq(adImpressions.id, req.params.id), eq(adImpressions.userId, req.userId!)))
      .returning();
    if (!updated) throw notFound("Anúncio não encontrado");
    return sendOk(res, updated);
  }));

  return router;
}
