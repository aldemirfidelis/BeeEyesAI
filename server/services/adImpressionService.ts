import { and, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "../db";
import { adImpressions, messages, type AdImpression, type Message } from "../../shared/schema";

export const AD_IMPRESSION_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export type SponsoredMetadata = {
  type: "sponsored" | "sponsored_group";
  adId: string;
  beeIntroMessage: string;
  isPersonalized: boolean;
  ad: Record<string, unknown>;
  ads?: Array<Record<string, unknown>>;
  adGroupId?: string;
  groupTitle?: string;
  layoutType?: "carousel" | "grid" | "vertical";
  adImpressionId?: string;
  expiresAt?: string;
  addedToWishlist?: boolean;
  status?: "active" | "expired" | "unavailable";
  wishlistItemId?: string;
};

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isSponsoredMetadata(meta: Record<string, unknown>): meta is SponsoredMetadata {
  return (meta.type === "sponsored" || meta.type === "sponsored_group") && typeof meta.adId === "string";
}

function mergeSponsoredMetadata(message: Message, impression: AdImpression | null, allImpressions: AdImpression[] = []): Message {
  const meta = parseMetadata(message.metadata);
  if (!isSponsoredMetadata(meta) || !impression) return message;
  const impressionById = new Map(allImpressions.map((item) => [item.id, item]));
  const impressionByAdId = new Map(allImpressions.map((item) => [item.adId, item]));
  const ads = Array.isArray(meta.ads)
    ? meta.ads.map((ad) => {
        const adObject = ad && typeof ad === "object" ? ad as Record<string, unknown> : {};
        const matched = (typeof adObject.adImpressionId === "string" ? impressionById.get(adObject.adImpressionId) : null)
          ?? (typeof adObject.id === "string" ? impressionByAdId.get(adObject.id) : null);
        return matched
          ? {
              ...adObject,
              adImpressionId: matched.id,
              expiresAt: matched.expiresAt.toISOString(),
              addedToWishlist: matched.addedToWishlist,
              status: matched.status,
            }
          : adObject;
      })
    : meta.ads;

  return {
    ...message,
    metadata: JSON.stringify({
      ...meta,
      ads,
      adImpressionId: impression.id,
      expiresAt: impression.expiresAt.toISOString(),
      addedToWishlist: impression.addedToWishlist,
      status: impression.status,
    }),
  };
}

export function createAdExpiresAt(now = new Date()) {
  return new Date(now.getTime() + AD_IMPRESSION_TTL_MS);
}

export async function cleanupExpiredAdImpressions(userId: string, now = new Date()) {
  await db
    .update(adImpressions)
    .set({ status: "expired", updatedAt: now })
    .where(and(
      eq(adImpressions.userId, userId),
      eq(adImpressions.status, "active"),
      eq(adImpressions.addedToWishlist, false),
      lt(adImpressions.expiresAt, now),
    ));
}

export async function filterVisibleSponsoredMessages(userId: string, rows: Message[]) {
  await cleanupExpiredAdImpressions(userId);

  const sponsored = rows.flatMap((message) => {
    const meta = parseMetadata(message.metadata);
    if (!isSponsoredMetadata(meta)) return [];
    return [{
      messageId: message.id,
      impressionId: typeof meta.adImpressionId === "string" ? meta.adImpressionId : null,
    }];
  });

  if (sponsored.length === 0) return rows;

  const messageIds = sponsored.map((item) => item.messageId);
  const impressionIds = sponsored.map((item) => item.impressionId).filter((id): id is string => !!id);
  const conditions = [
    messageIds.length > 0 ? inArray(adImpressions.messageId, messageIds) : null,
    impressionIds.length > 0 ? inArray(adImpressions.id, impressionIds) : null,
  ].filter(Boolean);

  const impressions = conditions.length > 0
    ? await db
        .select()
        .from(adImpressions)
        .where(and(eq(adImpressions.userId, userId), or(...conditions as any)))
    : [];

  const byMessageId = new Map(impressions.filter((item) => item.messageId).map((item) => [item.messageId!, item]));
  const byId = new Map(impressions.map((item) => [item.id, item]));
  const now = Date.now();

  return rows.flatMap((message) => {
    const meta = parseMetadata(message.metadata);
    if (!isSponsoredMetadata(meta)) return [message];

    const messageImpressions = impressions.filter((item) => item.messageId === message.id);
    const impression = (typeof meta.adImpressionId === "string" ? byId.get(meta.adImpressionId) : null) ?? byMessageId.get(message.id) ?? messageImpressions[0] ?? null;

    if (meta.type === "sponsored_group") {
      const hasVisibleItem = messageImpressions.some((item) =>
        item.addedToWishlist || (item.status === "active" && item.expiresAt.getTime() >= now)
      );
      if (!hasVisibleItem) return [];
      return [mergeSponsoredMetadata(message, impression, messageImpressions)];
    }

    const addedToWishlist = impression?.addedToWishlist ?? meta.addedToWishlist === true;
    const status = impression?.status ?? (typeof meta.status === "string" ? meta.status : "active");
    const expiresAt = impression?.expiresAt ?? (typeof meta.expiresAt === "string" ? new Date(meta.expiresAt) : null);

    if (addedToWishlist) return [mergeSponsoredMetadata(message, impression, messageImpressions)];
    if (status !== "active") return [];
    if (expiresAt && expiresAt.getTime() < now) return [];

    return [mergeSponsoredMetadata(message, impression, messageImpressions)];
  });
}

export async function markAdImpressionsSaved(userId: string, input: {
  sourceAdId?: string | null;
  sourceMessageId?: string | null;
  adImpressionId?: string | null;
  wishlistItemId?: string | null;
}) {
  const conditions = [
    input.adImpressionId ? eq(adImpressions.id, input.adImpressionId) : null,
    input.sourceMessageId ? eq(adImpressions.messageId, input.sourceMessageId) : null,
    input.sourceAdId ? eq(adImpressions.adId, input.sourceAdId) : null,
  ].filter(Boolean);

  if (conditions.length === 0) return [];

  const updated = await db
    .update(adImpressions)
    .set({ addedToWishlist: true, status: "active", updatedAt: new Date() })
    .where(and(eq(adImpressions.userId, userId), or(...conditions as any)))
    .returning();

  for (const impression of updated) {
    if (!impression.messageId) continue;
    const [message] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.id, impression.messageId)))
      .limit(1);
    if (!message) continue;

    const metadata = parseMetadata(message.metadata);
    if (!isSponsoredMetadata(metadata)) continue;
    const ads = Array.isArray(metadata.ads)
      ? metadata.ads.map((ad) => {
          const adObject = ad && typeof ad === "object" ? ad as Record<string, unknown> : {};
          const isMatch = adObject.adImpressionId === impression.id || adObject.id === impression.adId;
          return isMatch
            ? {
                ...adObject,
                addedToWishlist: true,
                status: "active",
                wishlistItemId: input.wishlistItemId ?? adObject.wishlistItemId,
              }
            : adObject;
        })
      : metadata.ads;

    await db
      .update(messages)
      .set({
        metadata: JSON.stringify({
          ...metadata,
          ads,
          adImpressionId: impression.id,
          expiresAt: impression.expiresAt.toISOString(),
          addedToWishlist: true,
          status: "active",
          wishlistItemId: input.wishlistItemId ?? metadata.wishlistItemId,
        }),
      })
      .where(and(eq(messages.userId, userId), eq(messages.id, impression.messageId)));
  }

  return updated;
}
