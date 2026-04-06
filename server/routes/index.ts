import type { Express } from "express";
import { createServer, type Server } from "http";
import { createAuthRouter } from "./auth";
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
  app.use(createAuthRouter());
  app.use(createMessagesRouter(triggerMissionAction));
  app.use(createMissionsRouter(triggerMissionAction));
  app.use(createMoodRouter(triggerMissionAction));
  app.use(createSocialRouter(triggerMissionAction));
  app.use(createCommunitiesRouter(triggerMissionAction));

  const httpServer = createServer(app);
  return httpServer;
}
