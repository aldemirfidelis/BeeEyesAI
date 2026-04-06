import fs from "node:fs/promises";
import path from "node:path";

const observabilityDir = path.resolve(process.cwd(), ".local", "observability");
let writeQueue = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(observabilityDir, { recursive: true });
}

function queueWrite(task: () => Promise<void>) {
  writeQueue = writeQueue.then(task).catch(() => {});
}

export function appendJsonLine(filename: string, payload: unknown) {
  queueWrite(async () => {
    await ensureDir();
    await fs.appendFile(path.join(observabilityDir, filename), `${JSON.stringify(payload)}\n`, "utf8");
  });
}

export function writeJsonSnapshot(filename: string, payload: unknown) {
  queueWrite(async () => {
    await ensureDir();
    await fs.writeFile(path.join(observabilityDir, filename), JSON.stringify(payload, null, 2), "utf8");
  });
}

export async function readTextFile(filename: string) {
  try {
    await ensureDir();
    return await fs.readFile(path.join(observabilityDir, filename), "utf8");
  } catch {
    return "";
  }
}

export async function readJsonLines<T>(filename: string, limit = 100): Promise<T[]> {
  const raw = await readTextFile(filename);
  if (!raw.trim()) {
    return [];
  }

  return raw
    .trim()
    .split("\n")
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((value): value is T => value !== null);
}
