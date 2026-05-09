import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function saveBase64Image(base64DataUrl: string): Promise<string> {
  const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
  if (!match) throw new Error("Formato de imagem inválido");

  const rawExt = match[1].toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  const data = Buffer.from(match[2], "base64");

  const yearMonth = new Date().toISOString().slice(0, 7);
  const dir = join(UPLOADS_DIR, yearMonth);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(join(dir, filename), data);

  return `/uploads/${yearMonth}/${filename}`;
}

export function isBase64Image(value: string): boolean {
  return value.startsWith("data:image/");
}
