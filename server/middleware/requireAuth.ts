import { type NextFunction, type Request, type Response } from "express";
import { unauthorized } from "../api/errors";
import { verifyToken } from "../auth";
import { readAuthCookie } from "../authCookie";
import { storage } from "../storage";

export interface AuthRequest extends Request {
  userId: string;
}

/**
 * Aceita o token JWT vindo de:
 *  1) Cookie httpOnly `bee_token` (web), preferido
 *  2) Header `Authorization: Bearer <token>` (mobile, integrações)
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const cookieToken = readAuthCookie(req);
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    return next(unauthorized("Token de acesso ausente"));
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    storage.updateLastActive(req.userId).catch(() => {});
    next();
  } catch {
    next(unauthorized("Token inválido ou expirado"));
  }
}
