import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import express, { Router } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../api/async-handler";
import { badRequest, notFound } from "../api/errors";
import { sendCreated, sendOk } from "../api/response";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import {
  BEE_HOUSE_TASK_STATUSES,
  BEE_HOUSE_TASK_TYPES,
  DEFAULT_BEE_HOUSE_ITEMS,
  DEFAULT_BEE_HOUSE_OUTFITS,
  beeStateForTaskStatus,
  inferBeeHouseTaskType,
  speechForTaskStatus,
  stationForTaskType,
  type BeeHouseTaskStatus,
  type BeeHouseTaskType,
} from "../../shared/bee-house";
import {
  beeAiTasks,
  beeCurrencyTransactions,
  beeHouseVisits,
  beeItems,
  beeOutfits,
  beeProfiles,
  beeRoomLayouts,
  beeRooms,
  beeUserInventory,
  beeUserOutfits,
  users,
} from "../../shared/schema";

const taskTypeSchema = z.enum(BEE_HOUSE_TASK_TYPES);
const taskStatusSchema = z.enum(BEE_HOUSE_TASK_STATUSES);

const createTaskSchema = z.object({
  sourceMessageId: z.string().trim().max(120).optional().nullable(),
  taskType: taskTypeSchema.optional(),
  promptSnippet: z.string().trim().max(800).optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const updateTaskSchema = z.object({
  status: taskStatusSchema.optional(),
  taskType: taskTypeSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  sourceMessageId: z.string().trim().max(120).optional().nullable(),
  speechText: z.string().trim().max(240).optional().nullable(),
  resultSummary: z.string().trim().max(1200).optional().nullable(),
  errorMessage: z.string().trim().max(1200).optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const placeItemSchema = z.object({
  roomId: z.string().trim().min(1),
  inventoryId: z.string().trim().min(1),
  gridX: z.number().int().min(0).max(64),
  gridY: z.number().int().min(0).max(64),
  rotation: z.number().int().min(0).max(3).default(0),
  layer: z.number().int().min(0).max(50).default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const purchaseSchema = z.object({
  kind: z.enum(["item", "outfit"]),
  id: z.string().trim().min(1).max(80),
});

const taskRewardSchema = z.object({
  rewardPollen: z.number().int().min(0).max(100).default(10),
  rewardXp: z.number().int().min(0).max(100).default(15),
  bridgeTarget: z.enum(["search", "train", "calendar", "study", "sleep"]).optional(),
});

const beeHouseGameRoot = resolve(process.cwd(), "mobile", "casa da bee");
const beeHouseGameHtmlPath = resolve(beeHouseGameRoot, "casa-da-bee-fase1.html");
const beeHousePhaserPath = resolve(process.cwd(), "node_modules", "phaser", "dist", "phaser.min.js");
const beeHouseGridEnginePath = resolve(process.cwd(), "node_modules", "grid-engine", "dist", "GridEngine.esm.min.js");
const beeHouseReactPath = resolve(process.cwd(), "node_modules", "react", "umd", "react.production.min.js");
const beeHouseReactDomPath = resolve(process.cwd(), "node_modules", "react-dom", "umd", "react-dom.production.min.js");

let catalogSeeded = false;

export function createBeeHouseRouter() {
  const router = Router();

  router.get("/casa-da-bee/vendor/phaser.min.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(beeHousePhaserPath);
  });

  router.get("/casa-da-bee/vendor/grid-engine.esm.min.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(beeHouseGridEnginePath);
  });

  router.get("/casa-da-bee/vendor/react.production.min.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(beeHouseReactPath);
  });

  router.get("/casa-da-bee/vendor/react-dom.production.min.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(beeHouseReactDomPath);
  });

  router.use("/casa-da-bee/game", express.static(resolve(beeHouseGameRoot, "game"), {
    etag: true,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  }));

  router.get("/casa-da-bee", asyncHandler(async (_req, res) => {
    const html = await readFile(beeHouseGameHtmlPath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' http: https: ws: wss:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
    res.status(200).send(html);
  }));

  router.get("/api/bee-house/bootstrap", requireAuth, asyncHandler(async (req, res) => {
    const snapshot = await ensureBeeHouse(req.userId!);
    return sendOk(res, snapshot);
  }));

  router.get("/api/bee-house/tasks/active", requireAuth, asyncHandler(async (req, res) => {
    await ensureBeeHouse(req.userId!);
    return sendOk(res, await getActiveTask(req.userId!));
  }));

  router.post("/api/bee-house/tasks", requireAuth, asyncHandler(async (req, res) => {
    await ensureBeeHouse(req.userId!);
    const body = createTaskSchema.parse(req.body);
    const taskType = body.taskType ?? inferBeeHouseTaskType(body.promptSnippet ?? "");
    const status: BeeHouseTaskStatus = "processing";
    const [task] = await db.insert(beeAiTasks).values({
      userId: req.userId!,
      sourceMessageId: body.sourceMessageId ?? null,
      taskType,
      status,
      beeState: beeStateForTaskStatus(status, taskType),
      targetStation: stationForTaskType(taskType),
      speechText: speechForTaskStatus(status, taskType),
      progress: 10,
      promptSnippet: body.promptSnippet ?? null,
      payload: body.payload ?? {},
    }).returning();

    await updateBeeProfileState(req.userId!, task.beeState);
    return sendCreated(res, task);
  }));

  router.patch("/api/bee-house/tasks/:id", requireAuth, asyncHandler(async (req, res) => {
    const current = await getOwnedTask(req.userId!, req.params.id);
    if (!current) throw notFound("Tarefa da Bee nao encontrada");

    const body = updateTaskSchema.parse(req.body);
    const status = (body.status ?? current.status) as BeeHouseTaskStatus;
    const taskType = (body.taskType ?? current.taskType) as BeeHouseTaskType;
    const nextState = beeStateForTaskStatus(status, taskType);

    const [task] = await db.update(beeAiTasks).set({
      status,
      taskType,
      beeState: nextState,
      targetStation: stationForTaskType(taskType),
      speechText: body.speechText === undefined ? speechForTaskStatus(status, taskType) : body.speechText,
      progress: body.progress ?? progressForStatus(status),
      sourceMessageId: body.sourceMessageId === undefined ? current.sourceMessageId : body.sourceMessageId,
      resultSummary: body.resultSummary === undefined ? current.resultSummary : body.resultSummary,
      errorMessage: body.errorMessage === undefined ? current.errorMessage : body.errorMessage,
      payload: body.payload ? { ...(current.payload ?? {}), ...body.payload } : current.payload,
      completedAt: status === "completed" || status === "failed" ? new Date() : current.completedAt,
      updatedAt: new Date(),
    }).where(and(eq(beeAiTasks.id, req.params.id), eq(beeAiTasks.userId, req.userId!))).returning();

    await updateBeeProfileState(req.userId!, nextState);
    return sendOk(res, task);
  }));

  router.post("/api/bee-house/tasks/:id/reward", requireAuth, asyncHandler(async (req, res) => {
    const current = await getOwnedTask(req.userId!, req.params.id);
    if (!current) throw notFound("Tarefa da Bee nao encontrada");

    const body = taskRewardSchema.parse(req.body);
    const result = await claimTaskReward(req.userId!, current, body);
    return sendOk(res, result);
  }));

  router.post("/api/bee-house/layouts", requireAuth, asyncHandler(async (req, res) => {
    await ensureBeeHouse(req.userId!);
    const body = placeItemSchema.parse(req.body);
    const room = await getOwnedRoom(req.userId!, body.roomId);
    if (!room) throw notFound("Comodo nao encontrado");
    if (body.gridX >= room.width || body.gridY >= room.height) throw badRequest("Posicao fora da grade do comodo");

    const [inventory] = await db.select().from(beeUserInventory)
      .where(and(eq(beeUserInventory.id, body.inventoryId), eq(beeUserInventory.userId, req.userId!)))
      .limit(1);
    if (!inventory) throw notFound("Item do inventario nao encontrado");

    const [layout] = await db.insert(beeRoomLayouts).values({
      userId: req.userId!,
      roomId: body.roomId,
      inventoryId: body.inventoryId,
      itemId: inventory.itemId,
      gridX: body.gridX,
      gridY: body.gridY,
      rotation: body.rotation,
      layer: body.layer,
      metadata: body.metadata ?? {},
    }).returning();

    return sendCreated(res, layout);
  }));

  router.delete("/api/bee-house/layouts/:id", requireAuth, asyncHandler(async (req, res) => {
    const [removed] = await db.delete(beeRoomLayouts)
      .where(and(eq(beeRoomLayouts.id, req.params.id), eq(beeRoomLayouts.userId, req.userId!)))
      .returning();
    if (!removed) throw notFound("Item posicionado nao encontrado");
    return sendOk(res, { ok: true });
  }));

  router.post("/api/bee-house/outfits/:outfitId/equip", requireAuth, asyncHandler(async (req, res) => {
    await ensureBeeHouse(req.userId!);
    const outfitId = req.params.outfitId;
    const [owned] = await db.select().from(beeUserOutfits)
      .where(and(eq(beeUserOutfits.userId, req.userId!), eq(beeUserOutfits.outfitId, outfitId)))
      .limit(1);
    if (!owned) {
      const [outfit] = await db.select().from(beeOutfits).where(eq(beeOutfits.id, outfitId)).limit(1);
      if (!outfit) throw notFound("Roupa nao encontrada");
      if (outfit.pricePollen > 0 || outfit.priceHoney > 0) throw badRequest("Compre a roupa antes de equipar");
      await db.insert(beeUserOutfits).values({ userId: req.userId!, outfitId, equipped: false, source: "free" }).onConflictDoNothing();
    }

    await db.update(beeUserOutfits).set({ equipped: false }).where(eq(beeUserOutfits.userId, req.userId!));
    const [equipped] = await db.update(beeUserOutfits)
      .set({ equipped: true })
      .where(and(eq(beeUserOutfits.userId, req.userId!), eq(beeUserOutfits.outfitId, outfitId)))
      .returning();

    await db.update(beeProfiles)
      .set({ equippedOutfitId: outfitId, updatedAt: new Date() })
      .where(eq(beeProfiles.userId, req.userId!));

    return sendOk(res, equipped);
  }));

  router.post("/api/bee-house/shop/purchase", requireAuth, asyncHandler(async (req, res) => {
    await ensureBeeHouse(req.userId!);
    const body = purchaseSchema.parse(req.body);
    const profile = await getBeeProfile(req.userId!);
    if (!profile) throw notFound("Perfil da Bee nao encontrado");

    if (body.kind === "item") {
      const [item] = await db.select().from(beeItems).where(and(eq(beeItems.id, body.id), eq(beeItems.active, true))).limit(1);
      if (!item) throw notFound("Item da loja nao encontrado");
      assertCanPay(profile, item.pricePollen, item.priceHoney);
      await charge(req.userId!, item.pricePollen, item.priceHoney, "purchase_item", "bee_item", item.id);

      const [inventory] = await db.insert(beeUserInventory)
        .values({ userId: req.userId!, itemId: item.id, quantity: 1, source: "shop" })
        .onConflictDoUpdate({
          target: [beeUserInventory.userId, beeUserInventory.itemId],
          set: { quantity: sql`${beeUserInventory.quantity} + 1` },
        })
        .returning();
      return sendOk(res, { item, inventory });
    }

    const [outfit] = await db.select().from(beeOutfits).where(and(eq(beeOutfits.id, body.id), eq(beeOutfits.active, true))).limit(1);
    if (!outfit) throw notFound("Roupa da loja nao encontrada");
    assertCanPay(profile, outfit.pricePollen, outfit.priceHoney);
    await charge(req.userId!, outfit.pricePollen, outfit.priceHoney, "purchase_outfit", "bee_outfit", outfit.id);

    const [owned] = await db.insert(beeUserOutfits)
      .values({ userId: req.userId!, outfitId: outfit.id, source: "shop" })
      .onConflictDoUpdate({
        target: [beeUserOutfits.userId, beeUserOutfits.outfitId],
        set: { source: "shop" },
      })
      .returning();
    return sendOk(res, { outfit, owned });
  }));

  router.get("/api/bee-house/visits/:ownerUserId", requireAuth, asyncHandler(async (req, res) => {
    const ownerId = req.params.ownerUserId;
    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).limit(1);
    if (!owner) throw notFound("Usuario nao encontrado");
    const snapshot = await getBeeHouseSnapshot(ownerId);
    if (!snapshot.profile) throw notFound("Casa da Bee ainda nao criada");

    await db.insert(beeHouseVisits).values({
      houseOwnerUserId: ownerId,
      visitorUserId: req.userId!,
      snapshot: {
        profile: snapshot.profile,
        activeRoom: snapshot.activeRoom,
        layouts: snapshot.layouts,
      },
    }).catch(() => {});

    return sendOk(res, snapshot);
  }));

  return router;
}

async function seedBeeHouseCatalog() {
  if (catalogSeeded) return;

  for (const item of DEFAULT_BEE_HOUSE_ITEMS) {
    await db.insert(beeItems).values({
      id: item.id,
      name: item.name,
      itemType: item.itemType,
      rarity: item.rarity,
      pricePollen: item.pricePollen,
      priceHoney: item.priceHoney,
      assetKey: item.assetKey,
      gridWidth: item.gridWidth,
      gridHeight: item.gridHeight,
      allowedRooms: item.allowedRooms,
      interactive: item.interactive,
      interactionTarget: item.interactionTarget ?? null,
      metadata: item.metadata ?? {},
    }).onConflictDoUpdate({
      target: beeItems.id,
      set: {
        name: item.name,
        itemType: item.itemType,
        rarity: item.rarity,
        pricePollen: item.pricePollen,
        priceHoney: item.priceHoney,
        assetKey: item.assetKey,
        gridWidth: item.gridWidth,
        gridHeight: item.gridHeight,
        allowedRooms: item.allowedRooms,
        interactive: item.interactive,
        interactionTarget: item.interactionTarget ?? null,
        metadata: item.metadata ?? {},
        active: true,
        updatedAt: new Date(),
      },
    });
  }

  for (const outfit of DEFAULT_BEE_HOUSE_OUTFITS) {
    await db.insert(beeOutfits).values({
      id: outfit.id,
      name: outfit.name,
      category: outfit.category,
      rarity: outfit.rarity,
      pricePollen: outfit.pricePollen,
      priceHoney: outfit.priceHoney,
      assetKey: outfit.assetKey,
      metadata: outfit.metadata ?? {},
    }).onConflictDoUpdate({
      target: beeOutfits.id,
      set: {
        name: outfit.name,
        category: outfit.category,
        rarity: outfit.rarity,
        pricePollen: outfit.pricePollen,
        priceHoney: outfit.priceHoney,
        assetKey: outfit.assetKey,
        metadata: outfit.metadata ?? {},
        active: true,
        updatedAt: new Date(),
      },
    });
  }

  catalogSeeded = true;
}

async function ensureBeeHouse(userId: string) {
  await seedBeeHouseCatalog();

  let [room] = await db.select().from(beeRooms)
    .where(and(eq(beeRooms.userId, userId), eq(beeRooms.roomKey, "main_room")))
    .limit(1);
  if (!room) {
    [room] = await db.insert(beeRooms).values({
      userId,
      roomKey: "main_room",
      name: "Sala principal",
      roomKind: "main",
      width: 8,
      height: 8,
      wallpaperItemId: "honeycomb_wallpaper",
      floorItemId: "warm_wood_floor",
      isUnlocked: true,
      sortOrder: 0,
    }).returning();
  }

  let [profile] = await db.select().from(beeProfiles).where(eq(beeProfiles.userId, userId)).limit(1);
  if (!profile) {
    [profile] = await db.insert(beeProfiles).values({
      userId,
      activeRoomId: room.id,
      equippedOutfitId: "casual_honey",
      currentState: "idle",
    }).returning();
  } else if (!profile.activeRoomId) {
    [profile] = await db.update(beeProfiles)
      .set({ activeRoomId: room.id, lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(beeProfiles.userId, userId))
      .returning();
  } else {
    await db.update(beeProfiles).set({ lastSeenAt: new Date() }).where(eq(beeProfiles.userId, userId));
  }

  await ensureStarterInventory(userId, room.id);
  await ensureStarterOutfit(userId);

  return getBeeHouseSnapshot(userId);
}

async function ensureStarterInventory(userId: string, roomId: string) {
  const starterItemIds = [
    "starter_notebook",
    "honey_work_desk",
    "tiny_library",
    "calendar_board",
    "fitness_mat",
    "bee_bed",
    "honeycomb_wallpaper",
    "warm_wood_floor",
  ];

  const inventory = await db.select().from(beeUserInventory).where(eq(beeUserInventory.userId, userId));
  const owned = new Set(inventory.map((item) => item.itemId));
  for (const itemId of starterItemIds) {
    if (owned.has(itemId)) continue;
    await db.insert(beeUserInventory).values({ userId, itemId, quantity: 1, source: "starter" }).onConflictDoNothing();
  }

  const [existingLayout] = await db.select({ id: beeRoomLayouts.id }).from(beeRoomLayouts)
    .where(and(eq(beeRoomLayouts.userId, userId), eq(beeRoomLayouts.roomId, roomId)))
    .limit(1);
  if (existingLayout) return;

  const latestInventory = await db.select().from(beeUserInventory).where(eq(beeUserInventory.userId, userId));
  const byItemId = new Map(latestInventory.map((item) => [item.itemId, item]));
  const starterLayout = [
    { itemId: "honey_work_desk", gridX: 2, gridY: 2, layer: 1 },
    { itemId: "starter_notebook", gridX: 2, gridY: 1, layer: 2 },
    { itemId: "tiny_library", gridX: 5, gridY: 1, layer: 1 },
    { itemId: "calendar_board", gridX: 6, gridY: 3, layer: 1 },
    { itemId: "fitness_mat", gridX: 4, gridY: 5, layer: 1 },
    { itemId: "bee_bed", gridX: 1, gridY: 5, layer: 1 },
  ];

  for (const item of starterLayout) {
    const inventoryItem = byItemId.get(item.itemId);
    if (!inventoryItem) continue;
    await db.insert(beeRoomLayouts).values({
      userId,
      roomId,
      inventoryId: inventoryItem.id,
      itemId: item.itemId,
      gridX: item.gridX,
      gridY: item.gridY,
      layer: item.layer,
      metadata: { starter: true },
    });
  }
}

async function ensureStarterOutfit(userId: string) {
  await db.insert(beeUserOutfits)
    .values({ userId, outfitId: "casual_honey", equipped: true, source: "starter" })
    .onConflictDoNothing();
}

async function getBeeHouseSnapshot(userId: string) {
  await seedBeeHouseCatalog();
  const [profile] = await db.select().from(beeProfiles).where(eq(beeProfiles.userId, userId)).limit(1);
  const rooms = await db.select().from(beeRooms).where(eq(beeRooms.userId, userId)).orderBy(asc(beeRooms.sortOrder), asc(beeRooms.createdAt));
  const activeRoom = rooms.find((room) => room.id === profile?.activeRoomId) ?? rooms[0] ?? null;
  const layouts = activeRoom
    ? await db.select().from(beeRoomLayouts)
      .where(and(eq(beeRoomLayouts.userId, userId), eq(beeRoomLayouts.roomId, activeRoom.id)))
      .orderBy(asc(beeRoomLayouts.layer), asc(beeRoomLayouts.gridY), asc(beeRoomLayouts.gridX))
    : [];

  const [inventory, catalog, outfits, userOutfits, activeTask] = await Promise.all([
    db.select().from(beeUserInventory).where(eq(beeUserInventory.userId, userId)).orderBy(desc(beeUserInventory.acquiredAt)),
    db.select().from(beeItems).where(eq(beeItems.active, true)).orderBy(asc(beeItems.itemType), asc(beeItems.pricePollen), asc(beeItems.name)),
    db.select().from(beeOutfits).where(eq(beeOutfits.active, true)).orderBy(asc(beeOutfits.category), asc(beeOutfits.pricePollen)),
    db.select().from(beeUserOutfits).where(eq(beeUserOutfits.userId, userId)).orderBy(desc(beeUserOutfits.acquiredAt)),
    getActiveTask(userId),
  ]);

  return {
    profile,
    rooms,
    activeRoom,
    layouts,
    inventory,
    catalog,
    outfits,
    userOutfits,
    activeTask,
    bridge: {
      webViewGlobal: "beeBridge",
      receiveStateMethod: "setState",
      postMessageTarget: "ReactNativeWebView.postMessage",
    },
  };
}

async function getActiveTask(userId: string) {
  const [task] = await db.select().from(beeAiTasks)
    .where(and(
      eq(beeAiTasks.userId, userId),
      inArray(beeAiTasks.status, ["processing", "searching", "generating"]),
    ))
    .orderBy(desc(beeAiTasks.updatedAt))
    .limit(1);
  return task ?? null;
}

async function getOwnedTask(userId: string, taskId: string) {
  const [task] = await db.select().from(beeAiTasks)
    .where(and(eq(beeAiTasks.id, taskId), eq(beeAiTasks.userId, userId)))
    .limit(1);
  return task ?? null;
}

async function getOwnedRoom(userId: string, roomId: string) {
  const [room] = await db.select().from(beeRooms)
    .where(and(eq(beeRooms.id, roomId), eq(beeRooms.userId, userId)))
    .limit(1);
  return room ?? null;
}

async function getBeeProfile(userId: string) {
  const [profile] = await db.select().from(beeProfiles).where(eq(beeProfiles.userId, userId)).limit(1);
  return profile ?? null;
}

async function updateBeeProfileState(userId: string, state: string) {
  await db.update(beeProfiles)
    .set({ currentState: state, updatedAt: new Date() })
    .where(eq(beeProfiles.userId, userId));
}

async function claimTaskReward(
  userId: string,
  current: typeof beeAiTasks.$inferSelect,
  reward: z.infer<typeof taskRewardSchema>,
) {
  const payload = current.payload ?? {};
  const alreadyClaimed = Boolean(payload.bridgeRewardClaimedAt);
  if (alreadyClaimed) {
    return {
      task: current,
      profile: await getBeeProfile(userId),
      reward: { pollen: 0, xp: 0, alreadyClaimed: true },
    };
  }

  const profile = await getBeeProfile(userId);
  if (!profile) throw notFound("Perfil da Bee nao encontrado");

  const nextProgress = applyLevelProgress(profile.level, profile.xp, reward.rewardXp);
  const nextPayload = {
    ...payload,
    bridgeTarget: reward.bridgeTarget,
    bridgeRewardPollen: reward.rewardPollen,
    bridgeRewardXp: reward.rewardXp,
    bridgeRewardClaimedAt: new Date().toISOString(),
  };

  const [updatedProfile] = await db.update(beeProfiles)
    .set({
      pollen: profile.pollen + reward.rewardPollen,
      xp: nextProgress.xp,
      level: nextProgress.level,
      currentState: "happy",
      updatedAt: new Date(),
    })
    .where(eq(beeProfiles.userId, userId))
    .returning();

  const [task] = await db.update(beeAiTasks).set({
    status: "completed",
    beeState: "happy",
    speechText: speechForTaskStatus("completed", current.taskType as BeeHouseTaskType),
    progress: 100,
    payload: nextPayload,
    completedAt: current.completedAt ?? new Date(),
    updatedAt: new Date(),
  }).where(and(eq(beeAiTasks.id, current.id), eq(beeAiTasks.userId, userId))).returning();

  const transactions = [];
  if (reward.rewardPollen > 0) {
    transactions.push({
      userId,
      currency: "pollen",
      amount: reward.rewardPollen,
      reason: "ai_task_completed",
      referenceType: "bee_ai_task",
      referenceId: current.id,
      metadata: { bridgeTarget: reward.bridgeTarget },
    });
  }
  if (reward.rewardXp > 0) {
    transactions.push({
      userId,
      currency: "xp",
      amount: reward.rewardXp,
      reason: "ai_task_completed",
      referenceType: "bee_ai_task",
      referenceId: current.id,
      metadata: { bridgeTarget: reward.bridgeTarget },
    });
  }
  if (transactions.length > 0) await db.insert(beeCurrencyTransactions).values(transactions);

  return {
    task,
    profile: updatedProfile,
    reward: { pollen: reward.rewardPollen, xp: reward.rewardXp, alreadyClaimed: false },
  };
}

function applyLevelProgress(level: number, xp: number, rewardXp: number) {
  let nextLevel = Math.max(1, level);
  let nextXp = Math.max(0, xp) + rewardXp;
  while (nextXp >= nextLevel * 100) {
    nextXp -= nextLevel * 100;
    nextLevel += 1;
  }
  return { level: nextLevel, xp: nextXp };
}

function progressForStatus(status: BeeHouseTaskStatus) {
  if (status === "processing") return 20;
  if (status === "searching") return 45;
  if (status === "generating") return 75;
  if (status === "completed") return 100;
  if (status === "failed") return 100;
  return 0;
}

function assertCanPay(profile: { pollen: number; premiumHoney: number }, pricePollen: number, priceHoney: number) {
  if (profile.pollen < pricePollen) throw badRequest("Polen insuficiente para esta compra");
  if (profile.premiumHoney < priceHoney) throw badRequest("Mel Premium insuficiente para esta compra");
}

async function charge(userId: string, pollen: number, honey: number, reason: string, referenceType: string, referenceId: string) {
  const updates: Partial<typeof beeProfiles.$inferInsert> = { updatedAt: new Date() };
  if (pollen > 0) updates.pollen = sql`${beeProfiles.pollen} - ${pollen}` as any;
  if (honey > 0) updates.premiumHoney = sql`${beeProfiles.premiumHoney} - ${honey}` as any;
  if (pollen > 0 || honey > 0) {
    await db.update(beeProfiles).set(updates).where(eq(beeProfiles.userId, userId));
  }

  const transactions = [];
  if (pollen > 0) {
    transactions.push({ userId, currency: "pollen", amount: -pollen, reason, referenceType, referenceId });
  }
  if (honey > 0) {
    transactions.push({ userId, currency: "premium_honey", amount: -honey, reason, referenceType, referenceId });
  }
  if (transactions.length > 0) await db.insert(beeCurrencyTransactions).values(transactions);
}
