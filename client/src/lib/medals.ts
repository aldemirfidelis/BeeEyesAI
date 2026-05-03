export type MedalTier = "bronze" | "silver" | "gold" | "diamond" | "special";

export interface MedalSpec {
  type: string;
  title: string;
  description: string;
  icon: string;
  tier: MedalTier;
  hint: string;
}

export const TIER_COLORS: Record<MedalTier, { body: string; ring: string; text: string; bg: string }> = {
  bronze: { body: "#CD7F32", ring: "#A0522D", text: "#7A3E18", bg: "#FFF3E4" },
  silver: { body: "#BDBDBD", ring: "#757575", text: "#525252", bg: "#F5F5F5" },
  gold: { body: "#FFD700", ring: "#B8860B", text: "#7A5C00", bg: "#FFF9D6" },
  diamond: { body: "#29B6F6", ring: "#0277BD", text: "#075985", bg: "#E1F5FE" },
  special: { body: "#F5C842", ring: "#1A1A1A", text: "#1A1A1A", bg: "#FFF8D7" },
};

export const MEDAL_CATALOG: MedalSpec[] = [
  { type: "early_adopter", title: "Pioneiro BeeEyes", description: "Faz parte da geracao fundadora do app.", icon: "🐝", tier: "special", hint: "Crie sua conta no BeeEyes." },
  { type: "first_message", title: "Primeira Conversa", description: "Conversou com a Bee pela primeira vez.", icon: "💬", tier: "bronze", hint: "Envie sua primeira mensagem para a Bee." },
  { type: "first_post", title: "Voz Ativa", description: "Compartilhou o primeiro momento no feed.", icon: "📢", tier: "bronze", hint: "Publique algo no Feed." },
  { type: "mood_first_log", title: "Autoconsciencia", description: "Registrou seu humor pela primeira vez.", icon: "🌡️", tier: "bronze", hint: "Registre seu humor." },
  { type: "first_mission", title: "Primeira Missao", description: "Completou a primeira missao.", icon: "⚡", tier: "bronze", hint: "Conclua sua primeira missao." },
  { type: "daily_complete", title: "Dia Perfeito", description: "Completou todas as missoes diarias.", icon: "✅", tier: "silver", hint: "Conclua as missoes diarias." },
  { type: "five_missions", title: "Em Ritmo", description: "Cinco missoes concluidas.", icon: "🎯", tier: "silver", hint: "Conclua 5 missoes." },
  { type: "ten_missions", title: "Disciplinado", description: "Dez missoes concluidas.", icon: "🏅", tier: "gold", hint: "Conclua 10 missoes." },
  { type: "twenty_missions", title: "Forca Total", description: "Vinte missoes concluidas.", icon: "💪", tier: "gold", hint: "Conclua 20 missoes." },
  { type: "fifty_missions", title: "Imparavel", description: "Cinquenta missoes concluidas.", icon: "🔥", tier: "diamond", hint: "Conclua 50 missoes." },
  { type: "streak_3", title: "3 Dias Seguidos", description: "Presenca por 3 dias consecutivos.", icon: "📅", tier: "bronze", hint: "Acesse por 3 dias seguidos." },
  { type: "streak_7", title: "Semana Solida", description: "Sete dias de sequencia.", icon: "🌟", tier: "silver", hint: "Mantenha 7 dias de streak." },
  { type: "streak_30", title: "Mes Imparavel", description: "Trinta dias consecutivos.", icon: "👑", tier: "diamond", hint: "Mantenha 30 dias de streak." },
  { type: "first_friend", title: "Primeira Conexao", description: "Fez sua primeira conexao.", icon: "🤝", tier: "bronze", hint: "Conecte-se com alguem." },
  { type: "five_friends", title: "Rede em Expansao", description: "Cinco conexoes ativas.", icon: "👥", tier: "silver", hint: "Tenha 5 amigos." },
  { type: "first_testimonial_received", title: "Depoimento Recebido", description: "Um amigo deixou um depoimento no seu perfil.", icon: "💝", tier: "bronze", hint: "Receba um depoimento." },
  { type: "community_joined", title: "Cidadao do App", description: "Entrou na primeira comunidade.", icon: "🌐", tier: "bronze", hint: "Participe de uma comunidade." },
  { type: "first_community_post", title: "Voz na Comunidade", description: "Publicou pela primeira vez em uma comunidade.", icon: "📣", tier: "silver", hint: "Publique em uma comunidade." },
  { type: "level_2", title: "Nivel 2", description: "Subiu ao nivel 2.", icon: "⬆️", tier: "bronze", hint: "Alcance o nivel 2." },
  { type: "level_5", title: "Nivel 5", description: "Nivel 5 conquistado.", icon: "🌠", tier: "silver", hint: "Alcance o nivel 5." },
  { type: "level_10", title: "Veterano", description: "Nivel 10 no BeeEyes.", icon: "🏆", tier: "gold", hint: "Alcance o nivel 10." },
];

export const MEDAL_BY_TYPE: Record<string, MedalSpec> = Object.fromEntries(MEDAL_CATALOG.map((medal) => [medal.type, medal]));
