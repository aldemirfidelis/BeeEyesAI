// Categorização heurística simples do conteúdo de uma mensagem da Bee, usada
// para alimentar o histórico de feedback (Curtir / Não curti) com um rótulo
// agregado. Mantém-se intencionalmente simples — uma análise por LLM viria
// num segundo momento.

export type MessageCategory =
  | "saude"
  | "produtividade"
  | "carreira"
  | "financas"
  | "relacionamentos"
  | "estudos"
  | "tecnologia"
  | "humor"
  | "lifestyle"
  | "geral";

const RULES: Array<{ category: MessageCategory; rx: RegExp }> = [
  { category: "saude",         rx: /\b(treino|exerc[ií]cio|academia|musculac|caminh|corrid|alongament|nutric|alimentac|sono|medita|sa[úu]de|m[eé]dico|m[eé]dica|consult|exam[eo]|peso|h[aá]bit[oa]s? saud)/i },
  { category: "produtividade", rx: /\b(produtividad|foco|disciplin|rotin|h[aá]bit|tarefa|organizac|planejament|prioridad|meta|gerenciar tempo|pomodoro|to-?do|checklist)/i },
  { category: "carreira",      rx: /\b(carreira|currículo|curriculo|linkedin|emprego|trabalho|profissional|networking|entrevista|salário|salario|promoç|promoc|recrutador)/i },
  { category: "financas",      rx: /\b(financ|dinheiro|investiment|orçament|orcament|gast[oa]|economiz|poup|d[ií]vid|cart[ãa]o de cr[eé]dito|sal[aá]rio|imposto|reserva)/i },
  { category: "relacionamentos", rx: /\b(relacionament|namor|casament|fam[ií]lia|amig[oa]|conflit|conversa dif[ií]cil|terminar|conversa com|amizade|paix[ãa]o)/i },
  { category: "estudos",       rx: /\b(estud[oa]r|estud[oa]s|prov|concurs|enem|vestibular|faculdade|universidad|aprender|curso|livro|ler|leitura|memorizac)/i },
  { category: "tecnologia",    rx: /\b(programac|programar|c[oó]digo|api|backend|frontend|software|ia|inteligenc|machine learning|dev|tecnologia|app|aplicativ)/i },
  { category: "humor",         rx: /\b(ansied|ansios|tristez|triste|deprim|estress|burnout|cansad[ao]|emocional|sentimento|sentindo|emoc[ãa]o|sentir[- ]se)/i },
  { category: "lifestyle",     rx: /\b(viage|viagem|hobby|filme|s[eé]rie|m[uú]sica|passeio|amizade|fim de semana|lazer|cuidado pessoal)/i },
];

export function inferMessageCategory(text: string): MessageCategory {
  if (!text || typeof text !== "string") return "geral";
  for (const rule of RULES) {
    if (rule.rx.test(text)) return rule.category;
  }
  return "geral";
}

export const CATEGORY_LABELS_PT: Record<MessageCategory, string> = {
  saude: "Saúde e bem-estar",
  produtividade: "Produtividade",
  carreira: "Carreira",
  financas: "Finanças",
  relacionamentos: "Relacionamentos",
  estudos: "Estudos",
  tecnologia: "Tecnologia",
  humor: "Humor e emoções",
  lifestyle: "Lifestyle",
  geral: "Outros",
};
