/**
 * brazilianSpecialDates.ts
 *
 * Datas comemorativas e especiais brasileiras.
 * - Datas fixas: definidas por month + day
 * - Datas móveis: definidas por função moveable(year)
 *
 * Não inclui feriados nacionais (estão em server/holidays.ts).
 * Não inclui feriados estaduais (estão em server/data/stateHolidays.ts).
 */

export type SpecialDateCategory =
  | "familia"
  | "ambiente"
  | "saude"
  | "cultura"
  | "educacao"
  | "trabalho"
  | "social"
  | "civica"
  | "religiao"
  | "tecnologia"
  | "internacional";

export interface SpecialDate {
  id: string;
  title: string;
  description: string;
  category: SpecialDateCategory;
  emoji: string;
  /** Fixed date: month 1-12, day 1-31 */
  month?: number;
  day?: number;
  /** Moveable date: returns { month, day } for a given year */
  moveable?: (year: number) => { month: number; day: number } | null;
  /** Notify one day before? (true for high-relevance dates) */
  notifyBefore: boolean;
  /** Notify on the day itself? */
  notifyOnDay: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): { month: number; day: number } | null {
  // weekday: 0=Sun … 6=Sat, n: 1=first, 2=second, -1=last
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  let offset = (weekday - firstWeekday + 7) % 7;
  if (n === -1) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let day = daysInMonth;
    while (new Date(year, month - 1, day).getDay() !== weekday) day--;
    return { month, day };
  }
  const day = 1 + offset + (n - 1) * 7;
  if (day > new Date(year, month, 0).getDate()) return null;
  return { month, day };
}

// ── Fixed dates ───────────────────────────────────────────────────────────────

export const SPECIAL_DATES: SpecialDate[] = [
  // ── FAMÍLIA ──────────────────────────────────────────────────────────────────
  {
    id: "dia-das-maes",
    title: "Dia das Mães",
    description: "Celebração em homenagem às mães. Segundo domingo de maio.",
    category: "familia",
    emoji: "🌸",
    moveable: (year) => nthWeekdayOfMonth(year, 5, 0, 2),
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-dos-pais",
    title: "Dia dos Pais",
    description: "Celebração em homenagem aos pais. Segundo domingo de agosto.",
    category: "familia",
    emoji: "👨‍👧",
    moveable: (year) => nthWeekdayOfMonth(year, 8, 0, 2),
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-das-criancas",
    title: "Dia das Crianças",
    description: "Feriado nacional e data especial para celebrar as crianças.",
    category: "familia",
    emoji: "🧒",
    month: 10,
    day: 12,
    notifyBefore: false, // já é feriado nacional
    notifyOnDay: false,
  },
  {
    id: "dia-dos-avos",
    title: "Dia dos Avós",
    description: "Data em homenagem aos avós e sua importância na família.",
    category: "familia",
    emoji: "👴👵",
    month: 7,
    day: 26,
    notifyBefore: true,
    notifyOnDay: true,
  },

  // ── AMOR & RELACIONAMENTOS ────────────────────────────────────────────────
  {
    id: "dia-dos-namorados",
    title: "Dia dos Namorados",
    description: "Celebrado no Brasil em 12 de junho, véspera de Santo Antônio.",
    category: "familia",
    emoji: "❤️",
    month: 6,
    day: 12,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-do-beijo",
    title: "Dia Internacional do Beijo",
    description: "Comemorado mundialmente em 6 de julho.",
    category: "familia",
    emoji: "💋",
    month: 7,
    day: 6,
    notifyBefore: false,
    notifyOnDay: false,
  },

  // ── MEIO AMBIENTE ─────────────────────────────────────────────────────────
  {
    id: "dia-do-meio-ambiente",
    title: "Dia Mundial do Meio Ambiente",
    description: "Data para reflexão sobre a preservação ambiental.",
    category: "ambiente",
    emoji: "🌍",
    month: 6,
    day: 5,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-da-arvore",
    title: "Dia da Árvore",
    description: "Data que lembra a importância das árvores e do reflorestamento.",
    category: "ambiente",
    emoji: "🌳",
    month: 9,
    day: 21,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-da-agua",
    title: "Dia Mundial da Água",
    description: "Conscientização sobre a importância da água potável.",
    category: "ambiente",
    emoji: "💧",
    month: 3,
    day: 22,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-da-terra",
    title: "Dia da Terra",
    description: "Movimento global de conscientização ambiental.",
    category: "ambiente",
    emoji: "🌱",
    month: 4,
    day: 22,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-dos-animais",
    title: "Dia Mundial dos Animais",
    description: "Data de São Francisco de Assis, patrono dos animais.",
    category: "ambiente",
    emoji: "🐾",
    month: 10,
    day: 4,
    notifyBefore: false,
    notifyOnDay: true,
  },

  // ── SAÚDE ────────────────────────────────────────────────────────────────
  {
    id: "dia-da-saude",
    title: "Dia Mundial da Saúde",
    description: "Celebrado pela OMS com foco na saúde global.",
    category: "saude",
    emoji: "🏥",
    month: 4,
    day: 7,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "dia-do-combate-aids",
    title: "Dia Mundial de Combate à AIDS",
    description: "Data para conscientização sobre prevenção e tratamento.",
    category: "saude",
    emoji: "🎗️",
    month: 12,
    day: 1,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-da-saude-mental",
    title: "Dia Mundial da Saúde Mental",
    description: "Conscientização sobre saúde mental e bem-estar emocional.",
    category: "saude",
    emoji: "🧠",
    month: 10,
    day: 10,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "setembro-amarelo",
    title: "Setembro Amarelo",
    description: "Mês de prevenção ao suicídio e promoção da saúde mental.",
    category: "saude",
    emoji: "💛",
    month: 9,
    day: 1,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "outubro-rosa",
    title: "Outubro Rosa",
    description: "Mês de conscientização sobre o câncer de mama.",
    category: "saude",
    emoji: "🎀",
    month: 10,
    day: 1,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "novembro-azul",
    title: "Novembro Azul",
    description: "Mês de conscientização sobre a saúde masculina.",
    category: "saude",
    emoji: "💙",
    month: 11,
    day: 1,
    notifyBefore: false,
    notifyOnDay: true,
  },

  // ── CULTURA & SOCIAL ─────────────────────────────────────────────────────
  {
    id: "dia-da-mulher",
    title: "Dia Internacional da Mulher",
    description: "Data em homenagem às conquistas sociais, econômicas e políticas das mulheres.",
    category: "social",
    emoji: "👩",
    month: 3,
    day: 8,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-dos-povos-indigenas",
    title: "Dia dos Povos Indígenas",
    description: "Homenagem à cultura e tradições dos povos originários do Brasil.",
    category: "social",
    emoji: "🪶",
    month: 4,
    day: 19,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "dia-do-combate-discriminacao",
    title: "Dia Internacional Contra a Discriminação Racial",
    description: "Data para reflexão sobre igualdade e combate ao racismo.",
    category: "social",
    emoji: "✊",
    month: 3,
    day: 21,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "dia-do-imigrante",
    title: "Dia do Imigrante",
    description: "Celebração da contribuição dos imigrantes ao Brasil.",
    category: "social",
    emoji: "🌐",
    month: 6,
    day: 25,
    notifyBefore: false,
    notifyOnDay: false,
  },
  {
    id: "dia-da-consciencia-negra",
    title: "Dia da Consciência Negra",
    description: "Feriado nacional em homenagem a Zumbi dos Palmares.",
    category: "social",
    emoji: "✊",
    month: 11,
    day: 20,
    notifyBefore: false, // já é feriado nacional
    notifyOnDay: false,
  },

  // ── EDUCAÇÃO & CULTURA ───────────────────────────────────────────────────
  {
    id: "dia-dos-professores",
    title: "Dia dos Professores",
    description: "Homenagem à dedicação dos professores na educação.",
    category: "educacao",
    emoji: "📚",
    month: 10,
    day: 15,
    notifyBefore: true,
    notifyOnDay: true,
  },
  {
    id: "dia-do-livro",
    title: "Dia Nacional do Livro",
    description: "Celebração da leitura e da literatura brasileira.",
    category: "educacao",
    emoji: "📖",
    month: 10,
    day: 29,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "dia-mundial-livro",
    title: "Dia Mundial do Livro e dos Direitos Autorais",
    description: "UNESCO celebra a leitura e os autores ao redor do mundo.",
    category: "educacao",
    emoji: "📕",
    month: 4,
    day: 23,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "dia-do-estudante",
    title: "Dia do Estudante",
    description: "Homenagem a todos os estudantes do Brasil.",
    category: "educacao",
    emoji: "🎓",
    month: 8,
    day: 11,
    notifyBefore: false,
    notifyOnDay: true,
  },

  // ── CÍVICA ───────────────────────────────────────────────────────────────
  {
    id: "descobrimento-brasil",
    title: "Descobrimento do Brasil",
    description: "Data da chegada de Pedro Álvares Cabral ao Brasil em 1500.",
    category: "civica",
    emoji: "⛵",
    month: 4,
    day: 22,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "abolição-escravatura",
    title: "Abolição da Escravatura",
    description: "Lei Áurea assinada pela Princesa Isabel em 1888.",
    category: "civica",
    emoji: "⛓️",
    month: 5,
    day: 13,
    notifyBefore: false,
    notifyOnDay: true,
  },
  {
    id: "dia-da-bandeira",
    title: "Dia da Bandeira",
    description: "Homenagem ao símbolo maior da nação brasileira.",
    category: "civica",
    emoji: "🇧🇷",
    month: 11,
    day: 19,
    notifyBefore: false,
    notifyOnDay: true,
  },

  // ── TRABALHO ─────────────────────────────────────────────────────────────
  {
    id: "dia-do-empreendedor",
    title: "Dia do Empreendedor",
    description: "Data para valorizar empreendedores e inovadores.",
    category: "trabalho",
    emoji: "💼",
    month: 10,
    day: 5,
    notifyBefore: false,
    notifyOnDay: false,
  },
  {
    id: "dia-do-profissional-ti",
    title: "Dia do Profissional de TI",
    description: "Celebração dos profissionais de tecnologia da informação.",
    category: "tecnologia",
    emoji: "💻",
    month: 7,
    day: 24,
    notifyBefore: false,
    notifyOnDay: false,
  },

  // ── DATAS INTERNACIONAIS ──────────────────────────────────────────────────
  {
    id: "ano-novo",
    title: "Ano Novo",
    description: "Celebração da virada do ano. Feriado nacional.",
    category: "cultura",
    emoji: "🎆",
    month: 1,
    day: 1,
    notifyBefore: false, // já é feriado
    notifyOnDay: false,
  },
  {
    id: "natal",
    title: "Natal",
    description: "Comemoração religiosa e cultural do nascimento de Jesus. Feriado nacional.",
    category: "cultura",
    emoji: "🎄",
    month: 12,
    day: 25,
    notifyBefore: false, // já é feriado
    notifyOnDay: false,
  },
  {
    id: "dia-das-bruxas",
    title: "Halloween / Dia das Bruxas",
    description: "Celebrado em alguns contextos culturais no Brasil.",
    category: "cultura",
    emoji: "🎃",
    month: 10,
    day: 31,
    notifyBefore: false,
    notifyOnDay: false,
  },

  // ── ESTAÇÕES DO ANO ───────────────────────────────────────────────────────
  {
    id: "inicio-outono",
    title: "Início do Outono",
    description: "Chegada do outono no hemisfério sul.",
    category: "ambiente",
    emoji: "🍂",
    month: 3,
    day: 20,
    notifyBefore: false,
    notifyOnDay: false,
  },
  {
    id: "inicio-inverno",
    title: "Início do Inverno",
    description: "Chegada do inverno no hemisfério sul.",
    category: "ambiente",
    emoji: "❄️",
    month: 6,
    day: 21,
    notifyBefore: false,
    notifyOnDay: false,
  },
  {
    id: "inicio-primavera",
    title: "Início da Primavera",
    description: "Chegada da primavera no hemisfério sul. Também é Dia da Árvore.",
    category: "ambiente",
    emoji: "🌸",
    month: 9,
    day: 22,
    notifyBefore: false,
    notifyOnDay: false,
  },
  {
    id: "inicio-verao",
    title: "Início do Verão",
    description: "Chegada do verão no hemisfério sul.",
    category: "ambiente",
    emoji: "☀️",
    month: 12,
    day: 21,
    notifyBefore: false,
    notifyOnDay: false,
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Returns all special dates that fall on a specific date. */
export function getSpecialDatesForDay(year: number, month: number, day: number): SpecialDate[] {
  return SPECIAL_DATES.filter((sd) => {
    if (sd.month && sd.day) {
      return sd.month === month && sd.day === day;
    }
    if (sd.moveable) {
      const result = sd.moveable(year);
      return result?.month === month && result?.day === day;
    }
    return false;
  });
}

/** Returns all special dates in a given month. */
export function getSpecialDatesForMonth(year: number, month: number): Array<SpecialDate & { resolvedDay: number }> {
  const results: Array<SpecialDate & { resolvedDay: number }> = [];
  for (const sd of SPECIAL_DATES) {
    if (sd.month && sd.day && sd.month === month) {
      results.push({ ...sd, resolvedDay: sd.day });
    } else if (sd.moveable) {
      const result = sd.moveable(year);
      if (result?.month === month) {
        results.push({ ...sd, resolvedDay: result.day });
      }
    }
  }
  return results.sort((a, b) => a.resolvedDay - b.resolvedDay);
}
