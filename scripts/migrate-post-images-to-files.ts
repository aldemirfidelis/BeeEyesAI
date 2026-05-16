/**
 * Migra imagens base64 inline (posts.image_url, community_posts.image_url) para
 * arquivos em /uploads/<yyyy-MM>/<uuid>.<ext>, atualizando a coluna para a URL
 * relativa. Idempotente: linhas que não começam com "data:image/" são puladas.
 *
 * Uso:
 *   tsx scripts/migrate-post-images-to-files.ts          # executa a migração
 *   tsx scripts/migrate-post-images-to-files.ts --dry    # só conta e estima
 *
 * Pré-requisito em produção (DigitalOcean Droplet + Docker Compose): o serviço
 * deve montar `uploads/` como bind-mount no host (ex:
 * `/opt/beeeyes/uploads:/app/uploads`). Sem o volume, esta migração ainda
 * funciona localmente, mas os arquivos somem no próximo `docker compose up --build`.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatório para rodar a migração");
}
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UPLOADS_DIR = join(process.cwd(), "uploads");
const DATA_URL_RX = /^data:image\/(\w+);base64,(.+)$/s;

type Row = { id: string; image_url: string };

async function fetchBase64Rows(table: "posts" | "community_posts", limit: number, offset: number): Promise<Row[]> {
  const { rows } = await pool.query<Row>(
    `SELECT id, image_url FROM ${table}
       WHERE image_url LIKE 'data:image/%'
       ORDER BY created_at ASC
       LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

async function countBase64(table: "posts" | "community_posts"): Promise<{ count: number; bytes: number }> {
  const { rows } = await pool.query<{ count: string; bytes: string | null }>(
    `SELECT COUNT(*)::text AS count, COALESCE(SUM(LENGTH(image_url)), 0)::text AS bytes
       FROM ${table}
       WHERE image_url LIKE 'data:image/%'`,
  );
  return { count: Number(rows[0]?.count ?? 0), bytes: Number(rows[0]?.bytes ?? 0) };
}

async function persistDataUrl(dataUrl: string): Promise<string> {
  const match = dataUrl.match(DATA_URL_RX);
  if (!match) throw new Error("not a data URL");
  const rawExt = match[1].toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  const buffer = Buffer.from(match[2], "base64");
  const yearMonth = new Date().toISOString().slice(0, 7);
  const dir = join(UPLOADS_DIR, yearMonth);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(join(dir, filename), buffer);
  return `/uploads/${yearMonth}/${filename}`;
}

async function migrateTable(table: "posts" | "community_posts", dryRun: boolean): Promise<{ migrated: number; failed: number }> {
  const summary = await countBase64(table);
  console.log(`[${table}] base64 inline: ${summary.count} linhas, ~${(summary.bytes / 1024 / 1024).toFixed(2)} MB no DB`);
  if (dryRun || summary.count === 0) return { migrated: 0, failed: 0 };

  let migrated = 0;
  let failed = 0;
  const batchSize = 25;

  // Reprocessa a cada iteração buscando do offset 0, pois cada UPDATE
  // remove a linha do match `image_url LIKE 'data:image/%'`.
  while (true) {
    const rows = await fetchBase64Rows(table, batchSize, 0);
    if (rows.length === 0) break;
    for (const row of rows) {
      try {
        const url = await persistDataUrl(row.image_url);
        await pool.query(`UPDATE ${table} SET image_url = $1 WHERE id = $2`, [url, row.id]);
        migrated += 1;
        if (migrated % 25 === 0) console.log(`  …${migrated} migrados`);
      } catch (err) {
        failed += 1;
        console.error(`  ! falha em ${table}.id=${row.id}:`, err instanceof Error ? err.message : err);
        // Marca como nulo para tirar do retry loop
        await pool.query(`UPDATE ${table} SET image_url = NULL WHERE id = $1`, [row.id]);
      }
    }
  }

  console.log(`[${table}] concluído: ${migrated} migrados, ${failed} falhas (image_url=NULL)`);
  return { migrated, failed };
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  console.log(dryRun ? "🔍 DRY-RUN — nada será alterado" : "🚀 Migração ativa");
  console.log(`Uploads dir: ${UPLOADS_DIR}`);

  const posts = await migrateTable("posts", dryRun);
  const communityPosts = await migrateTable("community_posts", dryRun);

  console.log("---");
  console.log(`Total migrado: ${posts.migrated + communityPosts.migrated}`);
  console.log(`Total falhou:  ${posts.failed + communityPosts.failed}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("Erro fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
