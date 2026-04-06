import { type NextFunction, type Request, type Response } from "express";
import { unauthorized } from "../api/errors";
import { verifyToken } from "../auth";

export interface AuthRequest extends Request {
  userId: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(unauthorized("Token de acesso ausente"));
  }

  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized("Token inválido ou expirado"));
  }
}
