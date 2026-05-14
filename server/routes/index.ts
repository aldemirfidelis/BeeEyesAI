import type { Express } from "express";
import { createServer, type Server } from "http";
import { createAdminRouter } from "./admin";
import { createAuthRouter } from "./auth";
import { createColmeiaRouter, startAlarmReminderScheduler } from "./colmeia";
import { createCommunitiesRouter } from "./communities";
import { createDailyBriefingRouter } from "./daily-briefing";
import { createMessagesRouter } from "./messages";
import { createMoodRouter } from "./mood";
import { createSocialRouter } from "./social";
import { createSystemRouter } from "./system";
import { createWishlistRouter } from "./wishlist";
import { createResearchRouter } from "./research";
import { createCalendarRouter, startCalendarNotificationScheduler } from "./calendar";
import { createHealthRouter } from "./health";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(createSystemRouter());
  app.use(createAdminRouter());
  app.use(createAuthRouter());
  app.use(createColmeiaRouter());
  app.use(createDailyBriefingRouter());
  app.use(createMessagesRouter());
  app.use(createMoodRouter());
  app.use(createSocialRouter());
  app.use(createCommunitiesRouter());
  app.use(createWishlistRouter());
  app.use(createResearchRouter());
  app.use(createCalendarRouter());
  app.use(createHealthRouter());

  const httpServer = createServer(app);
  startAlarmReminderScheduler();
  startCalendarNotificationScheduler();
  return httpServer;
}
