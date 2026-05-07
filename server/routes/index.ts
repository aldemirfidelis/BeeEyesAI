import type { Express } from "express";
import { createServer, type Server } from "http";
import { createAdminRouter } from "./admin";
import { createAuthRouter } from "./auth";
import { createColmeiaRouter } from "./colmeia";
import { createCommunitiesRouter } from "./communities";
import { createMissionActionTrigger } from "./mission-actions";
import { createMessagesRouter } from "./messages";
import { createMissionsRouter } from "./missions";
import { createMoodRouter } from "./mood";
import { createSocialRouter } from "./social";
import { createSystemRouter } from "./system";

export async function registerRoutes(app: Express): Promise<Server> {
  const triggerMissionAction = createMissionActionTrigger();

  app.use(createSystemRouter());
  app.use(createAdminRouter());
  app.use(createAuthRouter());
  app.use(createColmeiaRouter());
  app.use(createMessagesRouter(triggerMissionAction));
  app.use(createMissionsRouter(triggerMissionAction));
  app.use(createMoodRouter(triggerMissionAction));
  app.use(createSocialRouter(triggerMissionAction));
  app.use(createCommunitiesRouter(triggerMissionAction));

  const httpServer = createServer(app);
  return httpServer;
}
