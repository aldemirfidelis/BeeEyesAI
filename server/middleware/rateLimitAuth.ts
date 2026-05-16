import type { NextFunction, Request, Response } from "express";
import { tooManyRequests } from "../api/errors";
import { checkLimit } from "../rateLimit";

function clientIp(req: Request): string {
  // trust proxy=1 em server/index.ts faz req.ip respeitar X-Forwarded-For
  return (req.ip || req.socket.remoteAddress || "unknown").toString();
}

/** Login: 5 tentativas a cada 15 minutos por IP. */
export function loginRateLimit(req: Request, _res: Response, next: NextFunction) {
  const result = checkLimit(`login:${clientIp(req)}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!result.allowed) {
    return next(tooManyRequests("Muitas tentativas de login. Tente novamente em alguns minutos."));
  }
  next();
}

/** Registro: 5 contas por IP a cada hora (mitiga spam). */
export function registerRateLimit(req: Request, _res: Response, next: NextFunction) {
  const result = checkLimit(`register:${clientIp(req)}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!result.allowed) {
    return next(tooManyRequests("Limite de cadastros excedido. Tente novamente mais tarde."));
  }
  next();
}

/** Reset de senha: 3 solicitações por IP por hora + 3 por e-mail por hora. */
export function passwordResetIpRateLimit(req: Request, _res: Response, next: NextFunction) {
  const result = checkLimit(`pwreset_ip:${clientIp(req)}`, { max: 3, windowMs: 60 * 60 * 1000 });
  if (!result.allowed) {
    return next(tooManyRequests("Muitas solicitações. Tente novamente em uma hora."));
  }
  next();
}

/** Login social: 10 por IP por 15 min (mais permissivo, mas previne abuso). */
export function socialRateLimit(req: Request, _res: Response, next: NextFunction) {
  const result = checkLimit(`social:${clientIp(req)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!result.allowed) {
    return next(tooManyRequests("Muitas tentativas. Aguarde um momento."));
  }
  next();
}

/** Para uso dentro de handler (ex: ratelimit por e-mail dentro do password-reset). */
export function checkEmailLimit(email: string): boolean {
  const result = checkLimit(`pwreset_email:${email}`, { max: 3, windowMs: 60 * 60 * 1000 });
  return result.allowed;
}
