import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

const ALLOWED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
// Limite decoded (não base64-string). 25mb de payload base64 → ~18.75mb decoded.
// Cap em 8MB decoded é suficiente para fotos comprimidas pelo cliente.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function saveBase64Image(base64DataUrl: string): Promise<string> {
  const match = base64DataUrl.match(/^data:image\/([A-Za-z0-9+.-]+);base64,(.+)$/s);
  if (!match) throw new Error("Formato de imagem inválido");

  const rawExt = match[1].toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    throw new Error(`Tipo de imagem não suportado: ${rawExt || "desconhecido"}`);
  }

  const data = Buffer.from(match[2], "base64");
  if (data.length === 0) {
    throw new Error("Imagem vazia");
  }
  if (data.length > MAX_IMAGE_BYTES) {
    const mb = (MAX_IMAGE_BYTES / 1024 / 1024).toFixed(1);
    throw new Error(`Imagem muito grande. Limite ${mb}MB.`);
  }

  const yearMonth = new Date().toISOString().slice(0, 7);
  const dir = join(UPLOADS_DIR, yearMonth);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(join(dir, filename), data);

  return `/uploads/${yearMonth}/${filename}`;
}

export function isBase64Image(value: string): boolean {
  return typeof value === "string" && value.startsWith("data:image/");
}
