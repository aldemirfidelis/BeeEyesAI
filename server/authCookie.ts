import type { Request, Response } from "express";

/**
 * Helpers para gerenciar JWT em cookie httpOnly. Coexiste com Authorization
 * header (mobile usa Bearer com SecureStore; web migra para cookie).
 *
 * Cookie config:
 * - httpOnly: true → não acessível via JS (mitiga XSS)
 * - secure: true em prod → só envia em HTTPS
 * - sameSite: strict → não enviado em cross-site (mitiga CSRF)
 * - path=/ → válido para toda a API
 * - maxAge: 30 dias (alinhado com JWT TTL)
 */

export const AUTH_COOKIE_NAME = "bee_token";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export function setAuthCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === "production";
  const parts: string[] = [
    `${AUTH_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${Math.floor(COOKIE_MAX_AGE_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearAuthCookie(res: Response): void {
  const secure = process.env.NODE_ENV === "production";
  const parts: string[] = [
    `${AUTH_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/** Parser minimalista de cookies — evita dep adicional para um único cookie usado. */
export function readAuthCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (name !== AUTH_COOKIE_NAME) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}
