import { Router } from "express";
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendOk } from "../api/response";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import {
  userInterests,
  wishlistEvents,
  wishlistItems,
  wishlistPreferences,
} from "../../shared/schema";
import {
  containsSensitiveInterest,
  normalizeWishlistCategory,
  normalizeWishlistStatus,
  WISHLIST_CATEGORIES,
  WISHLIST_STATUS_LABELS,
  type WishlistCategory,
  type WishlistEventType,
} from "../../shared/wishlist";

const addWishlistItemSchema = z.object({
  sourceAdId: z.string().trim().max(180).optional().nullable(),
  productId: z.string().trim().max(180).optional().nullable(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  originalUrl: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  priceCents: z.number().int().min(0).max(2_000_000_00).optional().nullable(),
  price: z.number().min(0).max(2_000_000).optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
  brand: z.string().trim().max(180).optional().nullable(),
  storeName: z.string().trim().max(180).optional().nullable(),
  personalNote: z.string().trim().max(1000).optional().nullable(),
  sourceType: z.string().trim().max(40).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateWishlistItemSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(1200).nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  originalUrl: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(80).optional(),
  priceCents: z.number().int().min(0).max(2_000_000_00).nullable().optional(),
  price: z.number().min(0).max(2_000_000).nullable().optional(),
  brand: z.string().trim().max(180).nullable().optional(),
  storeName: z.string().trim().max(180).nullable().optional(),
  status: z.string().trim().max(32).optional(),
  personalNote: z.string().trim().max(1000).nullable().optional(),
  interestScore: z.number().int().min(1).max(10).optional(),
  priority: z.string().trim().max(32).optional(),
});

const updateSettingsSchema = z.object({
  allowPersonalizedRecommendations: z.boolean().optional(),
  allowPriceAlerts: z.boolean().optional(),
  allowBeeNotifications: z.boolean().optional(),
  showRecommendationReasons: z.boolean().optional(),
});

const AD_CATEGORY_TO_WISHLIST: Record<string, WishlistCategory> = {
  education: "Cursos",
  productivity: "Trabalho",
  career: "Trabalho",
  technology: "Tecnologia",
  wellness: "Saúde e bem-estar",
  books: "Estudos",
  tools: "Trabalho",
  organization: "Casa",
  study_materials: "Estudos",
  office_equipment: "Trabalho",
  professional_services: "Serviços",
};

const RECOMMENDATION_TEMPLATES: Record<WishlistCategory, Array<{ title: string; description: string; category: WishlistCategory; priceCents?: number; brand?: string }>> = {
  Tecnologia: [
    { title: "Organizador de cabos premium", description: "Ajuda a manter seu setup limpo e produtivo.", category: "Tecnologia", priceCents: 5990, brand: "Bee Picks" },
    { title: "Curso rápido de automações pessoais", description: "Para transformar apps do dia a dia em fluxos inteligentes.", category: "Cursos", priceCents: 14990, brand: "Bee Academy" },
  ],
  Moda: [
    { title: "Tênis casual respirável", description: "Um item versátil para rotina e viagens curtas.", category: "Moda", priceCents: 18990, brand: "Bee Picks" },
  ],
  Casa: [
    { title: "Kit de organização modular", description: "Recomendado para quem salva itens de casa e rotina.", category: "Casa", priceCents: 8990, brand: "Bee Home" },
  ],
  Estudos: [
    { title: "Planner de estudos semanal", description: "Uma forma leve de organizar metas e revisões.", category: "Estudos", priceCents: 4990, brand: "Bee Study" },
  ],
  Trabalho: [
    { title: "Template de produtividade profissional", description: "Para organizar entregas, prioridades e reuniões.", category: "Trabalho", priceCents: 7990, brand: "Bee Office" },
  ],
  "Saúde e bem-estar": [
    { title: "Garrafa com marcador de hidratação", description: "Sugestão ampla de bem-estar, sem perfil sensível.", category: "Saúde e bem-estar", priceCents: 6990, brand: "Bee Wellness" },
  ],
  Viagem: [
    { title: "Necessaire compacta de viagem", description: "Boa para listas de organização e presentes.", category: "Viagem", priceCents: 6490, brand: "Bee Travel" },
  ],
  Alimentação: [
    { title: "Kit marmita térmica", description: "Ajuda a manter rotina de refeições fora de casa.", category: "Alimentação", priceCents: 11990, brand: "Bee Food" },
  ],
  Serviços: [
    { title: "Consultoria inicial de organização digital", description: "Para transformar interesses salvos em um plano.", category: "Serviços", priceCents: 19990, brand: "Bee Services" },
  ],
  Cursos: [
    { title: "Curso introdutório de produtividade com IA", description: "Combina com listas de cursos e ferramentas digitais.", category: "Cursos", priceCents: 9900, brand: "Bee Academy" },
  ],
  Presentes: [
    { title: "Cartão presente flexível", description: "Uma opção segura quando a lista é para presentear alguém.", category: "Presentes", priceCents: 10000, brand: "Bee Gifts" },
  ],
  Outros: [
    { title: "Lista guiada de prioridades", description: "A Bee pode ajudar você a decidir o que pesquisar primeiro.", category: "Outros", brand: "Bee" },
  ],
};

function inferCategory(input: { category?: string | null; title?: string; description?: string | null; metadata?: Record<string, unknown> }) {
  const raw = input.category?.trim();
  if (raw && AD_CATEGORY_TO_WISHLIST[raw]) return AD_CATEGORY_TO_WISHLIST[raw];
  const normalized = normalizeWishlistCategory(raw);
  if (normalized !== "Outros") return normalized;

  const text = `${input.title ?? ""} ${input.description ?? ""}`.toLowerCase();
  if (/curso|aula|estudo|livro|power bi|excel|programa/.test(text)) return "Cursos";
  if (/celular|app|software|tech|tecnologia|dashboard|ia|digital/.test(text)) return "Tecnologia";
  if (/casa|decora|organiza|móvel|cozinha/.test(text)) return "Casa";
  if (/trabalho|carreira|entrevista|currículo|office/.test(text)) return "Trabalho";
  if (/viagem|hotel|mala|passagem/.test(text)) return "Viagem";
  if (/presente|gift/.test(text)) return "Presentes";
  if (/garrafa|bem-estar|hidrata|treino|fitness/.test(text)) return "Saúde e bem-estar";
  return "Outros";
}

function priceToCents(body: { price?: number | null; priceCents?: number | null }) {
  if (typeof body.priceCents === "number") return body.priceCents;
  if (typeof body.price === "number") return Math.round(body.price * 100);
  return null;
}

function getInterestNames(item: { title: string; category: string; brand?: string | null; storeName?: string | null; metadata?: Record<string, unknown> }) {
  const names = new Set<string>([item.category]);
  if (item.brand) names.add(item.brand);
  if (item.storeName) names.add(item.storeName);

  const metadataTags = item.metadata?.tags;
  if (Array.isArray(metadataTags)) {
    for (const tag of metadataTags) {
      if (typeof tag === "string" && tag.trim().length >= 3) names.add(tag.trim());
    }
  }

  const titleKeywords = item.title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, "").trim())
    .filter((word) => word.length >= 4)
    .slice(0, 3);
  for (const keyword of titleKeywords) names.add(keyword);

  return [...names].filter((name) => !containsSensitiveInterest(name));
}

async function recordWishlistEvent(userId: string, wishlistItemId: string | null, eventType: WishlistEventType | string, metadata: Record<string, unknown> = {}) {
  await db.insert(wishlistEvents).values({ userId, wishlistItemId, eventType, eventMetadata: metadata }).catch(() => {});
}

async function ensureWishlistPreferences(userId: string) {
  const [existing] = await db.select().from(wishlistPreferences).where(eq(wishlistPreferences.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(wishlistPreferences).values({ userId }).returning();
  return created;
}

async function updateInterestsFromItem(userId: string, item: { title: string; category: string; brand?: string | null; storeName?: string | null; metadata?: Record<string, unknown> }) {
  const prefs = await ensureWishlistPreferences(userId);
  if (!prefs.allowPersonalizedRecommendations) return;

  const names = getInterestNames(item);
  for (const interestName of names) {
    await db
      .insert(userInterests)
      .values({ userId, interestName, category: item.category, source: "wishlist", score: 1, active: true })
      .onConflictDoUpdate({
        target: [userInterests.userId, userInterests.interestName],
        set: {
          score: sql`${userInterests.score} + 1`,
          category: item.category,
          active: true,
          updatedAt: new Date(),
        },
      })
      .catch(() => {});
  }
}

function buildRecommendationReason(category: string) {
  if (category === "Outros") return "Recomendado porque você salvou itens parecidos na sua Lista de Desejos.";
  return `Recomendado porque você salvou itens de ${category.toLowerCase()}.`;
}

export function createWishlistRouter() {
  const router = Router();

  router.get("/api/wishlist", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const [items, interests, preferences] = await Promise.all([
      getWishlistItems(userId, req.query),
      db.select().from(userInterests).where(and(eq(userInterests.userId, userId), eq(userInterests.active, true))).orderBy(desc(userInterests.score), asc(userInterests.interestName)),
      ensureWishlistPreferences(userId),
    ]);

    const topCategories = [...new Set(items.map((item) => item.category as WishlistCategory))].slice(0, 3);
    const recommendations = topCategories.length === 0
      ? RECOMMENDATION_TEMPLATES.Outros.map((item, index) => ({ ...item, id: `rec-empty-${index}`, reason: "Recomendado para começar sua Lista de Desejos com controle e clareza." }))
      : topCategories.flatMap((category) =>
          (RECOMMENDATION_TEMPLATES[category] ?? RECOMMENDATION_TEMPLATES.Outros).map((item, index) => ({
            ...item,
            id: `rec-${category}-${index}`,
            reason: buildRecommendationReason(category),
          })),
        ).slice(0, 6);

    return sendOk(res, { items, interests, preferences, recommendations, categories: WISHLIST_CATEGORIES, statuses: WISHLIST_STATUS_LABELS });
  }));

  router.get("/api/wishlist/items", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await getWishlistItems(req.userId!, req.query));
  }));

  router.post("/api/wishlist/items", requireAuth, asyncHandler(async (req, res) => {
    const body = addWishlistItemSchema.parse(req.body);
    const category = inferCategory(body);
    const priceCents = priceToCents(body);

    const duplicateConditions = [
      body.sourceAdId ? eq(wishlistItems.sourceAdId, body.sourceAdId) : null,
      body.productId ? eq(wishlistItems.productId, body.productId) : null,
      body.originalUrl ? eq(wishlistItems.originalUrl, body.originalUrl) : null,
    ].filter(Boolean);

    if (duplicateConditions.length > 0) {
      const [existing] = await db
        .select()
        .from(wishlistItems)
        .where(and(eq(wishlistItems.userId, req.userId!), isNull(wishlistItems.removedAt), or(...duplicateConditions as any)))
        .limit(1);
      if (existing) {
        await recordWishlistEvent(req.userId!, existing.id, "duplicate_add_attempt", { sourceAdId: body.sourceAdId, productId: body.productId });
        return sendOk(res, { item: existing, alreadyExists: true, message: "Esse item já está na sua Lista de Desejos." });
      }
    }

    const [created] = await db.insert(wishlistItems).values({
      userId: req.userId!,
      sourceAdId: body.sourceAdId ?? null,
      productId: body.productId ?? null,
      title: body.title,
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      originalUrl: body.originalUrl ?? null,
      category,
      priceCents,
      currency: body.currency ?? "BRL",
      brand: body.brand ?? null,
      storeName: body.storeName ?? null,
      personalNote: body.personalNote ?? null,
      sourceType: body.sourceType ?? "manual",
      metadata: body.metadata ?? {},
    }).returning();

    await Promise.all([
      recordWishlistEvent(req.userId!, created.id, "added_to_wishlist", { sourceType: created.sourceType, category }),
      updateInterestsFromItem(req.userId!, { ...created, metadata: created.metadata }),
    ]);

    return sendOk(res, { item: created, alreadyExists: false, message: "Prontinho! Salvei isso na sua Lista de Desejos 🐝" });
  }));

  router.get("/api/wishlist/items/:id", requireAuth, asyncHandler(async (req, res) => {
    const item = await getWishlistItem(req.userId!, req.params.id);
    if (!item) throw notFound("Item não encontrado");
    await recordWishlistEvent(req.userId!, item.id, "opened");
    return sendOk(res, item);
  }));

  router.patch("/api/wishlist/items/:id", requireAuth, asyncHandler(async (req, res) => {
    const body = updateWishlistItemSchema.parse(req.body);
    const current = await getWishlistItem(req.userId!, req.params.id);
    if (!current) throw notFound("Item não encontrado");

    const status = body.status ? normalizeWishlistStatus(body.status) : undefined;
    const category = body.category ? normalizeWishlistCategory(body.category) : undefined;
    const updates: Partial<typeof wishlistItems.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.originalUrl !== undefined) updates.originalUrl = body.originalUrl;
    if (category !== undefined) updates.category = category;
    if (body.priceCents !== undefined || body.price !== undefined) updates.priceCents = priceToCents(body);
    if (body.brand !== undefined) updates.brand = body.brand;
    if (body.storeName !== undefined) updates.storeName = body.storeName;
    if (status !== undefined) {
      updates.status = status;
      if (status === "purchased") updates.purchasedAt = new Date();
      if (status !== "purchased") updates.purchasedAt = null;
    }
    if (body.personalNote !== undefined) updates.personalNote = body.personalNote;
    if (body.interestScore !== undefined) updates.interestScore = body.interestScore;
    if (body.priority !== undefined) updates.priority = body.priority;

    const [updated] = await db.update(wishlistItems)
      .set(updates)
      .where(and(eq(wishlistItems.id, req.params.id), eq(wishlistItems.userId, req.userId!), isNull(wishlistItems.removedAt)))
      .returning();
    if (!updated) throw notFound("Item não encontrado");

    let eventType: WishlistEventType | string = "status_changed";
    if (status === "interested") eventType = "marked_as_interested";
    else if (status === "purchased") eventType = "marked_as_purchased";
    else if (status === "not_interested") eventType = "marked_not_interested";
    else if (body.personalNote !== undefined) eventType = "note_added";
    else if (category !== undefined && category !== current.category) eventType = "category_changed";

    await Promise.all([
      recordWishlistEvent(req.userId!, updated.id, eventType, { status, category }),
      updateInterestsFromItem(req.userId!, { ...updated, metadata: updated.metadata }),
    ]);

    return sendOk(res, updated);
  }));

  router.delete("/api/wishlist/items/:id", requireAuth, asyncHandler(async (req, res) => {
    const [updated] = await db.update(wishlistItems)
      .set({ removedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(wishlistItems.id, req.params.id), eq(wishlistItems.userId, req.userId!), isNull(wishlistItems.removedAt)))
      .returning();
    if (!updated) throw notFound("Item não encontrado");
    await recordWishlistEvent(req.userId!, updated.id, "removed_from_wishlist");
    return sendOk(res, { ok: true });
  }));

  router.delete("/api/wishlist/items", requireAuth, asyncHandler(async (req, res) => {
    await db.update(wishlistItems)
      .set({ removedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(wishlistItems.userId, req.userId!), isNull(wishlistItems.removedAt)));
    await recordWishlistEvent(req.userId!, null, "wishlist_cleared");
    return sendOk(res, { ok: true });
  }));

  router.get("/api/wishlist/interests", requireAuth, asyncHandler(async (req, res) => {
    const rows = await db.select().from(userInterests).where(eq(userInterests.userId, req.userId!)).orderBy(desc(userInterests.score), asc(userInterests.interestName));
    return sendOk(res, rows);
  }));

  router.patch("/api/wishlist/interests/:id", requireAuth, asyncHandler(async (req, res) => {
    const body = z.object({ interestName: z.string().trim().min(2).max(120).optional(), category: z.string().trim().max(80).optional(), active: z.boolean().optional() }).parse(req.body);
    if (body.interestName && containsSensitiveInterest(body.interestName)) throw badRequest("Esse interesse parece sensível e não pode ser usado para personalização.");
    const [updated] = await db.update(userInterests)
      .set({ ...body, category: body.category ? normalizeWishlistCategory(body.category) : undefined, updatedAt: new Date() })
      .where(and(eq(userInterests.id, req.params.id), eq(userInterests.userId, req.userId!)))
      .returning();
    if (!updated) throw notFound("Interesse não encontrado");
    return sendOk(res, updated);
  }));

  router.delete("/api/wishlist/interests/:id", requireAuth, asyncHandler(async (req, res) => {
    const [updated] = await db.update(userInterests)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(userInterests.id, req.params.id), eq(userInterests.userId, req.userId!)))
      .returning();
    if (!updated) throw notFound("Interesse não encontrado");
    await recordWishlistEvent(req.userId!, null, "interest_removed", { interestId: req.params.id });
    return sendOk(res, updated);
  }));

  router.post("/api/wishlist/interests/clear", requireAuth, asyncHandler(async (req, res) => {
    await db.update(userInterests).set({ active: false, updatedAt: new Date() }).where(eq(userInterests.userId, req.userId!));
    await recordWishlistEvent(req.userId!, null, "interests_cleared");
    return sendOk(res, { ok: true });
  }));

  router.get("/api/wishlist/settings", requireAuth, asyncHandler(async (req, res) => {
    return sendOk(res, await ensureWishlistPreferences(req.userId!));
  }));

  router.patch("/api/wishlist/settings", requireAuth, asyncHandler(async (req, res) => {
    const body = updateSettingsSchema.parse(req.body);
    const prefs = await ensureWishlistPreferences(req.userId!);
    const [updated] = await db.update(wishlistPreferences)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(wishlistPreferences.id, prefs.id))
      .returning();
    if (body.allowPersonalizedRecommendations === false) {
      await recordWishlistEvent(req.userId!, null, "personalization_disabled");
    }
    return sendOk(res, updated);
  }));

  router.get("/api/wishlist/export", requireAuth, asyncHandler(async (req, res) => {
    const [items, interests, preferences, events] = await Promise.all([
      db.select().from(wishlistItems).where(eq(wishlistItems.userId, req.userId!)).orderBy(desc(wishlistItems.createdAt)),
      db.select().from(userInterests).where(eq(userInterests.userId, req.userId!)).orderBy(desc(userInterests.score)),
      ensureWishlistPreferences(req.userId!),
      db.select().from(wishlistEvents).where(eq(wishlistEvents.userId, req.userId!)).orderBy(desc(wishlistEvents.createdAt)).limit(500),
    ]);
    res.setHeader("content-disposition", "attachment; filename=bee-wishlist-export.json");
    return sendOk(res, { exportedAt: new Date().toISOString(), items, interests, preferences, events });
  }));

  return router;
}

async function getWishlistItem(userId: string, id: string) {
  const [item] = await db.select().from(wishlistItems).where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, userId), isNull(wishlistItems.removedAt))).limit(1);
  return item;
}

async function getWishlistItems(userId: string, query: Record<string, unknown>) {
  const conditions = [eq(wishlistItems.userId, userId), isNull(wishlistItems.removedAt)];
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const category = normalizeWishlistCategory(query.category);
  const status = normalizeWishlistStatus(query.status);
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);

  if (search) {
    conditions.push(or(
      ilike(wishlistItems.title, `%${search}%`),
      ilike(wishlistItems.description, `%${search}%`),
      ilike(wishlistItems.brand, `%${search}%`),
      ilike(wishlistItems.storeName, `%${search}%`),
    ) as any);
  }
  if (typeof query.category === "string" && query.category.trim()) conditions.push(eq(wishlistItems.category, category));
  if (typeof query.status === "string" && query.status.trim()) conditions.push(eq(wishlistItems.status, status));
  if (Number.isFinite(minPrice)) conditions.push(gte(wishlistItems.priceCents, Math.round(minPrice * 100)));
  if (Number.isFinite(maxPrice)) conditions.push(lte(wishlistItems.priceCents, Math.round(maxPrice * 100)));

  const sort = typeof query.sort === "string" ? query.sort : "recent";
  const orderBy = sort === "oldest"
    ? asc(wishlistItems.createdAt)
    : sort === "interest"
      ? desc(wishlistItems.interestScore)
      : sort === "price_asc"
        ? asc(wishlistItems.priceCents)
        : desc(wishlistItems.createdAt);

  return db.select().from(wishlistItems).where(and(...conditions)).orderBy(orderBy).limit(200);
}
