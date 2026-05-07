import { type NextFunction, type Request, type Response } from "express";
import { forbidden, unauthorized } from "../api/errors";
import { verifyToken } from "../auth";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(unauthorized("Token de acesso ausente"));
  }

  try {
    const payload = verifyToken(header.slice(7));
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
