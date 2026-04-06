import type { createLogger } from "../observability/logger";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: string;
      logger: ReturnType<typeof createLogger>;
    }
  }
}

export {};
