import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { spawnSync } from "node:child_process";

type Finding = {
  file: string;
  line: number;
  kind: string;
  text: string;
};

const ROOT = process.cwd();
const SCAN_DIRS = ["server", "shared", "client/src", "mobile"];
const FILE_EXT = /\.(ts|tsx|sql|md)$/;
const CONTEXT_RX = /(prompt|system|context|mem[oó]ria|memory|prefer[êe]ncia|preference|Bee|Colmeia|Dica:|Como posso ajudar|Prontinho|Não consegui|Nao consegui|Erro ao salvar|Informe)/i;
const PROMPT_RX = /(PROMPT|build.*Prompt|systemPrompt|runtimeContext|generate.*Message|briefing|proactive|welcome|chat_empty)/i;
const GENERIC_RESPONSE_RX = /\b(Como posso ajudar\??|Entendi\.?|Certo\.?|Aqui está\.?|Não tenho informações suficientes\.?)\b/i;

function listFiles() {
  const result = spawnSync("rg", ["--files", ...SCAN_DIRS], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "rg --files failed");
  }
  return result.stdout
    .split(/\r?\n/)
    .filter((file) => FILE_EXT.test(file));
}

function normalizeLiteral(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[`${}"'.,;:!?()[\]]/g, "")
    .trim()
    .toLowerCase();
}

function classify(line: string) {
  if (PROMPT_RX.test(line)) return "prompt/context builder";
  if (GENERIC_RESPONSE_RX.test(line) && !/evite respostas gen[eé]ricas|ajudam a bee/i.test(line)) return "generic response risk";
  if (/userPersonality|user_memories|userPreferences|beeConversationContexts|messageFeedback|wishlistPreferences|healthProfiles|calendarPreferences/i.test(line)) {
    return "context data";
  }
  if (/Dica:|Prontinho|Não consegui|Nao consegui|Erro|Informe/i.test(line)) return "automatic message";
  return "bee text";
}

function main() {
  const findings: Finding[] = [];
  const duplicateMap = new Map<string, Finding[]>();

  for (const file of listFiles()) {
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!CONTEXT_RX.test(line)) return;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("import ")) return;
      const finding = {
        file: relative(ROOT, file).replace(/\\/g, "/"),
        line: index + 1,
        kind: classify(trimmed),
        text: trimmed.slice(0, 220),
      };
      findings.push(finding);

      const literal = trimmed.match(/["'`]([^"'`]{18,})["'`]/)?.[1];
      if (literal) {
        const key = normalizeLiteral(literal);
        if (key.length >= 18) {
          const bucket = duplicateMap.get(key) ?? [];
          bucket.push(finding);
          duplicateMap.set(key, bucket);
        }
      }
    });
  }

  const duplicates = [...duplicateMap.values()].filter((items) => items.length > 1);
  const generic = findings.filter((finding) => finding.kind === "generic response risk");
  const prompts = findings.filter((finding) => finding.kind === "prompt/context builder");
  const dataContexts = findings.filter((finding) => finding.kind === "context data");

  console.log("# Bee Context Audit\n");
  console.log(`Scanned files: ${new Set(findings.map((finding) => finding.file)).size}`);
  console.log(`Context findings: ${findings.length}`);
  console.log(`Prompt/context builders: ${prompts.length}`);
  console.log(`Context data references: ${dataContexts.length}`);
  console.log(`Generic response risks: ${generic.length}`);
  console.log(`Duplicate literal groups: ${duplicates.length}\n`);

  console.log("## Prompt And Context Files");
  for (const finding of prompts.slice(0, 80)) {
    console.log(`- ${finding.file}:${finding.line} (${finding.kind}) ${finding.text}`);
  }

  console.log("\n## Generic Response Risks");
  for (const finding of generic) {
    console.log(`- ${finding.file}:${finding.line} ${finding.text}`);
  }

  console.log("\n## Duplicate Literals");
  for (const group of duplicates.slice(0, 40)) {
    console.log(`- ${group[0].text}`);
    for (const item of group) {
      console.log(`  - ${item.file}:${item.line}`);
    }
  }

  console.log("\n## Heuristic Notes");
  console.log("- Review context data references that are saved but not included in /api/chat runtimeContext.");
  console.log("- Review generic response risks and replace with contextual next steps.");
  console.log("- Duplicate literal groups are normalized exact-ish matches; nearby wording still needs manual review.");
}

main();
