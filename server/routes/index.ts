import type { Express } from "express";
import { createServer, type Server } from "http";
import { createAdminRouter } from "./admin";
import { createAdImpressionsRouter } from "./ad-impressions";
import { createAuthRouter } from "./auth";
import { createBeeContextRouter } from "./bee-context";
import { createBeeHouseRouter } from "./bee-house";
import { createColmeiaRouter, startAlarmReminderScheduler } from "./colmeia";
import { createCommunitiesRouter } from "./communities";
import { createDailyBriefingRouter } from "./daily-briefing";
import { createFeedbackRouter } from "./feedback";
import { createMessagesRouter } from "./messages";
import { createMoodRouter } from "./mood";
import { createSocialRouter } from "./social";
import { createSystemRouter } from "./system";
import { createWishlistRouter } from "./wishlist";
import { createResearchRouter } from "./research";
import { createCalendarRouter, startCalendarNotificationScheduler } from "./calendar";
import { createHealthRouter } from "./health";
import { createLegalRouter } from "./legal";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(createSystemRouter());
  app.use(createAdminRouter());
  app.use(createAdImpressionsRouter());
  app.use(createAuthRouter());
  app.use(createBeeContextRouter());
  app.use(createBeeHouseRouter());
  app.use(createColmeiaRouter());
  app.use(createDailyBriefingRouter());
  app.use(createMessagesRouter());
  app.use(createFeedbackRouter());
  app.use(createMoodRouter());
  app.use(createSocialRouter());
  app.use(createCommunitiesRouter());
  app.use(createWishlistRouter());
  app.use(createResearchRouter());
  app.use(createCalendarRouter());
  app.use(createHealthRouter());
  app.use(createLegalRouter());

  const httpServer = createServer(app);
  startAlarmReminderScheduler();
  startCalendarNotificationScheduler();
  return httpServer;
}
