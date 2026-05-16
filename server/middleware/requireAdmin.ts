import { type NextFunction, type Request, type Response } from "express";
import { forbidden, unauthorized } from "../api/errors";
import { verifyToken } from "../auth";
import { readAuthCookie } from "../authCookie";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
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

    db.select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, req.userId))
      .then(([user]) => {
        if (!user?.isAdmin) return next(forbidden("Acesso restrito a administradores"));
        next();
      })
      .catch(() => next(unauthorized("Erro ao verificar permissões")));
  } catch {
    next(unauthorized("Token inválido ou expirado"));
  }
}
