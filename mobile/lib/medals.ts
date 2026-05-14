export type MedalTier = "bronze" | "silver" | "gold" | "diamond" | "special";

export interface MedalSpec {
  type: string;
  title: string;
  description: string;
  icon: string;
  tier: MedalTier;
  hint: string;
}

export const TIER_COLORS: Record<MedalTier, { outer: string; body: string; shine: string; text: string }> = {
  bronze:  { outer: "#A0522D", body: "#CD7F32", shine: "#FFE4B5", text: "#6B3A1F" },
  silver:  { outer: "#757575", body: "#BDBDBD", shine: "#F5F5F5", text: "#424242" },
  gold:    { outer: "#B8860B", body: "#FFD700", shine: "#FFFDE7", text: "#7A5C00" },
  diamond: { outer: "#0277BD", body: "#29B6F6", shine: "#E1F5FE", text: "#01579B" },
  special: { outer: "#1A1A1A", body: "#F5C842", shine: "#FFFDE7", text: "#1A1A1A" },
};

export const MEDAL_CATALOG: MedalSpec[] = [
  // Primeiros passos
  {
    type: "early_adopter",
    title: "Pioneiro BeeEyes",
    description: "Faz parte da geração fundadora do app. Obrigado por estar aqui desde o início.",
    icon: "🐝",
    tier: "special",
    hint: "Crie sua conta no BeeEyes.",
  },
  {
    type: "first_message",
    title: "Primeira Conversa",
    description: "Conversou com a Bee pela primeira vez. O começo de uma parceria.",
    icon: "💬",
    tier: "bronze",
    hint: "Envie sua primeira mensagem para a Bee.",
  },
  {
    type: "first_post",
    title: "Voz Ativa",
    description: "Compartilhou o primeiro momento no feed da comunidade.",
    icon: "📢",
    tier: "bronze",
    hint: "Publique algo no Feed.",
  },
  {
    type: "mood_first_log",
    title: "Autoconsciência",
    description: "Registrou seu humor pela primeira vez. Conhecer-se é o primeiro passo.",
    icon: "🌡️",
    tier: "bronze",
    hint: "Registre seu humor no app.",
  },

  // ── Sequência ────────────────────────────────────────────────────────────
  {
    type: "streak_3",
    title: "3 Dias Seguidos",
    description: "Presença por 3 dias consecutivos. O hábito começa a se formar.",
    icon: "📅",
    tier: "bronze",
    hint: "Acesse o app por 3 dias seguidos.",
  },
  {
    type: "streak_7",
    title: "Semana Sólida",
    description: "7 dias de sequência. Hábito em formação acelerada.",
    icon: "🌟",
    tier: "silver",
    hint: "Mantenha uma sequência de 7 dias.",
  },
  {
    type: "streak_30",
    title: "Mês Imparável",
    description: "30 dias consecutivos. Você é uma lenda no app.",
    icon: "👑",
    tier: "diamond",
    hint: "Mantenha uma sequência de 30 dias.",
  },

  // Social
  {
    type: "first_friend",
    title: "Primeira Conexão",
    description: "Fez sua primeira conexão no BeeEyes. A rede começa aqui.",
    icon: "🤝",
    tier: "bronze",
    hint: "Conecte-se com alguém no app.",
  },
  {
    type: "five_friends",
    title: "Rede em Expansão",
    description: "5 conexões ativas. Sua rede social está crescendo.",
    icon: "👥",
    tier: "silver",
    hint: "Tenha 5 amigos conectados.",
  },
  {
    type: "first_testimonial_received",
    title: "Depoimento Recebido",
    description: "Um amigo deixou um depoimento no seu perfil. Isso é genuíno.",
    icon: "💝",
    tier: "bronze",
    hint: "Receba um depoimento de um amigo.",
  },
  {
    type: "community_joined",
    title: "Cidadão do App",
    description: "Entrou na sua primeira comunidade. Bem-vindo ao coletivo.",
    icon: "🌐",
    tier: "bronze",
    hint: "Participe de uma comunidade.",
  },
  {
    type: "first_community_post",
    title: "Voz na Comunidade",
    description: "Publicou pela primeira vez em uma comunidade. Sua voz importa.",
    icon: "📣",
    tier: "silver",
    hint: "Publique algo em uma comunidade.",
  },

  // ── Evolução / Nível ──────────────────────────────────────────────────────
  {
    type: "level_2",
    title: "Nível 2",
    description: "Subiu ao nível 2. A verdadeira jornada começa.",
    icon: "⬆️",
    tier: "bronze",
    hint: "Alcance o nível 2.",
  },
  {
    type: "level_5",
    title: "Nível 5",
    description: "Nível 5 conquistado. Presença real e reconhecida.",
    icon: "🌠",
    tier: "silver",
    hint: "Alcance o nível 5.",
  },
  {
    type: "level_10",
    title: "Veterano",
    description: "Nível 10. Entre os mais evoluídos do BeeEyes.",
    icon: "🏆",
    tier: "gold",
    hint: "Alcance o nível 10.",
  },
];

export const MEDAL_BY_TYPE: Record<string, MedalSpec> = Object.fromEntries(
  MEDAL_CATALOG.map((m) => [m.type, m])
);
