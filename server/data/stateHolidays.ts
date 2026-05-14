/**
 * stateHolidays.ts
 *
 * Feriados estaduais do Brasil por UF.
 * Apenas feriados de abrangência estadual (não municipais).
 * Feriados nacionais NÃO estão aqui (estão em server/holidays.ts).
 *
 * Fontes: legislações estaduais públicas.
 */

export interface StateHoliday {
  id: string;
  state: string;  // UF — "SP", "RJ", etc.
  title: string;
  description: string;
  emoji: string;
  month: number;  // 1-12
  day: number;    // 1-31
}

export const STATE_HOLIDAYS: StateHoliday[] = [
  // ── São Paulo ─────────────────────────────────────────────────────────────
  {
    id: "sp-revolucao-constitucionalista",
    state: "SP",
    title: "Revolução Constitucionalista",
    description: "Aniversário da Revolução Constitucionalista de 1932.",
    emoji: "🏛️",
    month: 7,
    day: 9,
  },

  // ── Rio de Janeiro ────────────────────────────────────────────────────────
  {
    id: "rj-sao-jorge",
    state: "RJ",
    title: "Dia de São Jorge",
    description: "Feriado estadual no Rio de Janeiro em homenagem a São Jorge.",
    emoji: "⚔️",
    month: 4,
    day: 23,
  },

  // ── Bahia ────────────────────────────────────────────────────────────────
  {
    id: "ba-independencia-bahia",
    state: "BA",
    title: "Independência da Bahia",
    description: "Data em que a Bahia aderiu à Independência do Brasil.",
    emoji: "🇧🇷",
    month: 7,
    day: 2,
  },

  // ── Rio Grande do Sul ─────────────────────────────────────────────────────
  {
    id: "rs-farroupilha",
    state: "RS",
    title: "Revolução Farroupilha",
    description: "Feriado em homenagem à Guerra dos Farrapos.",
    emoji: "🐴",
    month: 9,
    day: 20,
  },

  // ── Paraná ────────────────────────────────────────────────────────────────
  {
    id: "pr-emancipacao",
    state: "PR",
    title: "Emancipação Política do Paraná",
    description: "Aniversário da separação do Paraná da Província de São Paulo.",
    emoji: "🌲",
    month: 12,
    day: 19,
  },

  // ── Ceará ────────────────────────────────────────────────────────────────
  {
    id: "ce-data-magna",
    state: "CE",
    title: "Data Magna do Ceará",
    description: "Aniversário da abolição da escravidão no Ceará.",
    emoji: "🌞",
    month: 3,
    day: 25,
  },

  // ── Pará ─────────────────────────────────────────────────────────────────
  {
    id: "pa-adesao-independencia",
    state: "PA",
    title: "Adesão do Pará à Independência",
    description: "Data em que o Pará aderiu à Independência do Brasil.",
    emoji: "🌿",
    month: 8,
    day: 15,
  },

  // ── Amazonas ─────────────────────────────────────────────────────────────
  {
    id: "am-elevacao-estado",
    state: "AM",
    title: "Elevação do Amazonas à Categoria de Estado",
    description: "Aniversário do Amazonas como estado da federação.",
    emoji: "🌊",
    month: 9,
    day: 5,
  },

  // ── Pernambuco ───────────────────────────────────────────────────────────
  {
    id: "pe-revolucao-pernambucana",
    state: "PE",
    title: "Revolução Pernambucana",
    description: "Homenagem à insurreição republicana de 1817.",
    emoji: "🏅",
    month: 3,
    day: 6,
  },

  // ── Minas Gerais ─────────────────────────────────────────────────────────
  {
    id: "mg-inconfidencia-mineira",
    state: "MG",
    title: "Mártires da Inconfidência",
    description: "Feriado estadual em homenagem aos heróis da Inconfidência Mineira.",
    emoji: "⚖️",
    month: 4,
    day: 21,
  },

  // ── Santa Catarina ────────────────────────────────────────────────────────
  {
    id: "sc-aniversario",
    state: "SC",
    title: "Dia de Santa Catarina de Alexandria",
    description: "Feriado estadual de Santa Catarina.",
    emoji: "🏔️",
    month: 11,
    day: 25,
  },

  // ── Goiás ─────────────────────────────────────────────────────────────────
  {
    id: "go-aniversario-goias",
    state: "GO",
    title: "Aniversário de Goiás",
    description: "Data de criação da Capitania de Goiás.",
    emoji: "🏞️",
    month: 7,
    day: 26,
  },

  // ── Mato Grosso ───────────────────────────────────────────────────────────
  {
    id: "mt-aniversario",
    state: "MT",
    title: "Aniversário do Mato Grosso",
    description: "Criação da Capitania de Mato Grosso.",
    emoji: "🦜",
    month: 1,
    day: 9,
  },

  // ── Mato Grosso do Sul ────────────────────────────────────────────────────
  {
    id: "ms-criacao-estado",
    state: "MS",
    title: "Criação do Estado de Mato Grosso do Sul",
    description: "Aniversário de criação do Estado.",
    emoji: "🌾",
    month: 10,
    day: 11,
  },

  // ── Distrito Federal ──────────────────────────────────────────────────────
  {
    id: "df-fundacao-brasilia",
    state: "DF",
    title: "Fundação de Brasília",
    description: "Aniversário da fundação da capital federal.",
    emoji: "🏛️",
    month: 4,
    day: 21,
  },

  // ── Espírito Santo ────────────────────────────────────────────────────────
  {
    id: "es-nossa-senhora-penha",
    state: "ES",
    title: "Nossa Senhora da Penha",
    description: "Feriado estadual em homenagem à padroeira do Espírito Santo.",
    emoji: "⛪",
    month: 4,
    day: 23,
  },

  // ── Sergipe ───────────────────────────────────────────────────────────────
  {
    id: "se-autonomia",
    state: "SE",
    title: "Autonomia Política de Sergipe",
    description: "Data de emancipação política de Sergipe.",
    emoji: "🌴",
    month: 7,
    day: 8,
  },

  // ── Piauí ────────────────────────────────────────────────────────────────
  {
    id: "pi-dia-estado",
    state: "PI",
    title: "Dia do Estado do Piauí",
    description: "Data magna do estado do Piauí.",
    emoji: "🌵",
    month: 10,
    day: 19,
  },

  // ── Rio Grande do Norte ───────────────────────────────────────────────────
  {
    id: "rn-mae-dos-brasileiros",
    state: "RN",
    title: "Mártires de Cunhaú e Uruaçu",
    description: "Feriado em homenagem aos mártires do Rio Grande do Norte.",
    emoji: "✝️",
    month: 10,
    day: 3,
  },

  // ── Maranhão ─────────────────────────────────────────────────────────────
  {
    id: "ma-adesao-independencia",
    state: "MA",
    title: "Adesão do Maranhão à Independência",
    description: "Data em que o Maranhão aderiu à Independência do Brasil.",
    emoji: "🌊",
    month: 7,
    day: 28,
  },

  // ── Alagoas ───────────────────────────────────────────────────────────────
  {
    id: "al-emancipacao-politica",
    state: "AL",
    title: "Emancipação Política de Alagoas",
    description: "Data de criação da Província de Alagoas.",
    emoji: "🌅",
    month: 9,
    day: 16,
  },

  // ── Tocantins ─────────────────────────────────────────────────────────────
  {
    id: "to-criacao-estado",
    state: "TO",
    title: "Criação do Estado do Tocantins",
    description: "Aniversário de criação do Tocantins.",
    emoji: "🦜",
    month: 10,
    day: 5,
  },

  // ── Rondônia ─────────────────────────────────────────────────────────────
  {
    id: "ro-criacao-estado",
    state: "RO",
    title: "Criação do Estado de Rondônia",
    description: "Aniversário de criação de Rondônia.",
    emoji: "🌳",
    month: 1,
    day: 4,
  },

  // ── Roraima ───────────────────────────────────────────────────────────────
  {
    id: "rr-criacao-estado",
    state: "RR",
    title: "Criação do Estado de Roraima",
    description: "Aniversário de criação de Roraima.",
    emoji: "🏔️",
    month: 10,
    day: 5,
  },

  // ── Acre ──────────────────────────────────────────────────────────────────
  {
    id: "ac-dia-do-acre",
    state: "AC",
    title: "Dia do Estado do Acre",
    description: "Aniversário da revolução acreana e criação do estado.",
    emoji: "🌿",
    month: 1,
    day: 20,
  },

  // ── Amapá ────────────────────────────────────────────────────────────────
  {
    id: "ap-criacao-estado",
    state: "AP",
    title: "Criação do Estado do Amapá",
    description: "Aniversário de criação do Amapá.",
    emoji: "🌊",
    month: 10,
    day: 5,
  },

  // ── Paraíba ───────────────────────────────────────────────────────────────
  {
    id: "pb-data-magna",
    state: "PB",
    title: "Homenagem a João Pessoa",
    description: "Data magna do estado da Paraíba.",
    emoji: "🏅",
    month: 8,
    day: 5,
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Returns all state holidays for a given state and day. */
export function getStateHolidaysForDay(state: string, month: number, day: number): StateHoliday[] {
  const uState = state.toUpperCase();
  return STATE_HOLIDAYS.filter((h) => h.state === uState && h.month === month && h.day === day);
}

/** Returns all state holidays for a given state in a month. */
export function getStateHolidaysForMonth(state: string, year: number, month: number): StateHoliday[] {
  const uState = state.toUpperCase();
  return STATE_HOLIDAYS.filter((h) => h.state === uState && h.month === month)
    .sort((a, b) => a.day - b.day);
}

/** All state codes that have holidays in this dataset. */
export const SUPPORTED_STATES = [...new Set(STATE_HOLIDAYS.map((h) => h.state))].sort();

/** Human-readable state names. */
export const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina",
  SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};
