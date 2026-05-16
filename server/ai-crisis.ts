/**
 * Detecção de sinais de crise emocional / risco psicológico nas mensagens
 * do usuário. Quando detectado, a Bee redireciona o usuário para canais
 * profissionais (CVV, SAMU, CAPS) ANTES de chamar a IA — evitando que o
 * modelo produza respostas inadequadas em situações de risco real.
 *
 * Padrões em PT-BR. Cobrem:
 *  - Ideação suicida explícita
 *  - Auto-agressão
 *  - Crise aguda de ansiedade/pânico
 *
 * Não é um diagnóstico nem substitui acompanhamento profissional. É uma
 * camada de segurança simples e auditável para reduzir risco de o modelo
 * dar conselhos perigosos em momentos críticos.
 *
 * Patterns são intencionalmente abrangentes (alguns falsos positivos é
 * preferível a falso negativo). Use word boundary `\b` para evitar
 * matches dentro de palavras maiores (ex: "morrer de rir" não dispara).
 */

const CRISIS_PATTERNS: RegExp[] = [
  // Ideação suicida explícita
  /\bsuic[ií]di(o|a|os|ar|aria|ar-me|ar-se)\b/i,
  /\b(me|nos)\s+matar\b/i,
  /\bquero\s+morrer\b/i,
  /\bp[oô]r\s+fim\s+(à\s+(minha\s+)?vida|nisso|em\s+tudo)\b/i,
  /\bacabar\s+com\s+(isso|tudo|a\s+minha\s+vida|minha\s+vida)\b/i,
  /\bn[aã]o\s+(consigo|aguento)\s+(mais|continuar|viver)\b/i,
  /\bvou\s+desistir\s+de\s+(tudo|viver|tudo\s+isso)\b/i,
  /\bn[aã]o\s+(quero|quiser)\s+(mais\s+)?(viver|existir)\b/i,
  /\bnada\s+(faz\s+)?sentido\b.*\b(viver|continuar)\b/i,

  // Auto-agressão
  /\b(me|nos)\s+(machucar|cortar|machuquei|machucando|cortando)\b/i,
  /\bauto.?agress[aã]o\b/i,
  /\boverdose\b/i,
  /\btomei\s+(rem[ée]dio|p[ií]lulas|comprimidos)\s+demais\b/i,

  // Crise aguda
  /\bcrise\s+de\s+p[aâ]nico\b/i,
  /\bn[aã]o\s+consigo\s+respirar\b/i,
  /\bsufocand(o|a)\b/i,
];

export function detectCrisisSignals(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = text.toLowerCase();
  return CRISIS_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Resposta padrão de redirecionamento. Mantém tom acolhedor (Bee) mas
 * coloca os canais de ajuda em destaque. Não pretende substituir a IA
 * num diálogo terapêutico — só garantir que o usuário em risco vê
 * recursos imediatos de ajuda profissional ANTES de qualquer resposta
 * gerada por modelo.
 */
export function buildCrisisResponse(_userCity?: string | null): string {
  return [
    "Estou aqui e percebi que você está passando por um momento muito difícil. Você não está sozinho.",
    "",
    "Por favor, procure ajuda agora mesmo:",
    "",
    "• CVV — Centro de Valorização da Vida: 188 (gratuito, 24h)",
    "• Chat CVV: https://www.cvv.org.br/chat/",
    "• SAMU: 192",
    "• Em emergência imediata: ligue 192 ou vá ao pronto-socorro mais próximo",
    "",
    "Se você puder, fale com alguém de confiança agora — uma pessoa próxima, um amigo, um familiar. Você merece esse cuidado.",
    "",
    "Quando estiver mais seguro, conte comigo aqui para ajudar a organizar próximos passos no seu dia.",
  ].join("\n");
}
