import crypto from "node:crypto";

/**
 * AES-256-GCM para tokens sensíveis no banco (Google Calendar access/refresh).
 *
 * Formato encriptado: `enc:v1:<base64(iv || authTag || ciphertext)>`
 *   - iv: 12 bytes (recomendado para GCM)
 *   - authTag: 16 bytes
 *
 * Coexistência com plaintext legacy:
 *   - `decryptToken(s)` retorna `s` inalterado se não começar com `enc:v1:`.
 *   - `encryptToken(s)` sempre produz formato novo.
 *
 * Isso permite que o sistema continue funcionando enquanto tokens antigos
 * são gradualmente reencriptados pelo refresh natural OU pelo script de
 * backfill em `scripts/encrypt-legacy-google-tokens.ts`.
 *
 * Configuração:
 *   ENCRYPTION_KEY = 64 chars hex (32 bytes / 256 bits). Geração:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   Em produção é obrigatória; em dev usa fallback (com aviso) — NUNCA usar
 *   o fallback de dev em produção real.
 */

const ENC_PREFIX = "enc:v1:";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function resolveKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY?.trim();
  if (hex) {
    if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error("ENCRYPTION_KEY deve ser 64 chars hex (32 bytes).");
    }
    return Buffer.from(hex, "hex");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY é obrigatória em produção.");
  }
  // Dev fallback determinístico — facilita testes locais.
  // NUNCA use isso em produção; sem alarme, gera log de aviso.
  if (!devWarned) {
    console.warn("[encryption] ENCRYPTION_KEY ausente em dev — usando fallback determinístico. NÃO usar em produção.");
    devWarned = true;
  }
  return crypto.createHash("sha256").update("bee-eyes-dev-encryption-fallback-key").digest();
}

let devWarned = false;

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

export function encryptToken(plaintext: string): string {
  const key = resolveKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  return `${ENC_PREFIX}${blob}`;
}

export function decryptToken(value: string): string {
  // Coexistência: legacy plaintext segue funcionando.
  if (!isEncrypted(value)) return value;

  const key = resolveKey();
  const blob = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
  if (blob.length < IV_LEN + AUTH_TAG_LEN + 1) {
    throw new Error("Token encriptado malformado.");
  }
  const iv = blob.subarray(0, IV_LEN);
  const authTag = blob.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = blob.subarray(IV_LEN + AUTH_TAG_LEN);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Decripta se necessário, sem lançar quando o input é nulo/vazio. */
export function decryptTokenSafe(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptToken(value);
  } catch (err) {
    console.error("[encryption] decryptToken falhou:", err instanceof Error ? err.message : err);
    return null;
  }
}
