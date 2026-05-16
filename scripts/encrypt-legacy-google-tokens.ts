/**
 * Backfill: criptografa tokens Google Calendar (access + refresh) que ainda
 * estão em plaintext no banco. Idempotente — pula tokens já marcados como
 * `enc:v1:...`.
 *
 * Uso:
 *   ENCRYPTION_KEY=<64 chars hex> tsx scripts/encrypt-legacy-google-tokens.ts
 *
 * Em produção (DigitalOcean Droplet):
 *   ssh root@146.190.72.195
 *   cd /opt/beeeyes
 *   docker compose exec app sh -c 'tsx scripts/encrypt-legacy-google-tokens.ts'
 *
 * Saída: logs quantos foram reencriptados / pulados / falharam.
 *
 * Segurança: opera linha a linha em transação, então parcial falha não
 * deixa metade encriptada e metade plaintext.
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { encryptToken, isEncrypted } from "../server/encryption";
import { userIntegrations } from "../shared/schema";

async function main() {
  const rows = await db
    .select({
      id: userIntegrations.id,
      provider: userIntegrations.provider,
      accessToken: userIntegrations.accessToken,
      refreshToken: userIntegrations.refreshToken,
    })
    .from(userIntegrations);

  let encrypted = 0;
  let alreadyEncrypted = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const accessIsPlain = row.accessToken && !isEncrypted(row.accessToken);
      const refreshIsPlain = row.refreshToken && !isEncrypted(row.refreshToken);

      if (!accessIsPlain && !refreshIsPlain) {
        alreadyEncrypted += 1;
        continue;
      }

      const newAccess = accessIsPlain ? encryptToken(row.accessToken!) : row.accessToken;
      const newRefresh = refreshIsPlain ? encryptToken(row.refreshToken!) : row.refreshToken;

      await db
        .update(userIntegrations)
        .set({
          accessToken: newAccess,
          refreshToken: newRefresh,
          updatedAt: new Date(),
        })
        .where(eq(userIntegrations.id, row.id));

      encrypted += 1;
      console.log(`[ok] ${row.provider} id=${row.id}: encriptado (access=${accessIsPlain}, refresh=${refreshIsPlain})`);
    } catch (err) {
      failed += 1;
      console.error(`[fail] id=${row.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nResumo: encrypted=${encrypted}, alreadyEncrypted=${alreadyEncrypted}, failed=${failed}, total=${rows.length}`);
  await pool.end();
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
