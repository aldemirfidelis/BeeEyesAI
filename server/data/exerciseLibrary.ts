// ── Biblioteca de exercícios da Bee ───────────────────────────────────────────
// Base estática usada para sugestões de treino e substituição de exercícios.

export type MuscleGroup =
  | "peito"
  | "costas"
  | "pernas"
  | "ombros"
  | "biceps"
  | "triceps"
  | "abdomen"
  | "gluteos"
  | "panturrilha"
  | "cardio"
  | "mobilidade"
  | "alongamento";

export type EquipmentType =
  | "aparelho"
  | "halter"
  | "barra"
  | "peso_corporal"
  | "cabo"
  | "esteira"
  | "bicicleta"
  | "eliptico"
  | "outro";

export type ExerciseLevel = "iniciante" | "intermediario" | "avancado";

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: EquipmentType;
  machine?: string;
  level: ExerciseLevel;
  description: string;
  defaultSets: number;
  defaultReps: string;
  defaultRestSeconds: number;
  safetyNote: string;
  alternatives?: string[]; // ids
}

export const EXERCISE_LIBRARY: ExerciseLibraryItem[] = [
  // ── Pernas ──
  {
    id: "leg_press",
    name: "Leg press 45°",
    muscleGroup: "pernas",
    equipment: "aparelho",
    machine: "Leg press 45°",
    level: "iniciante",
    description: "Exercício composto para quadríceps, glúteos e posteriores.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Não estender totalmente os joelhos. Controle a descida.",
    alternatives: ["agachamento_livre", "agachamento_smith", "afundo"],
  },
  {
    id: "cadeira_extensora",
    name: "Cadeira extensora",
    muscleGroup: "pernas",
    equipment: "aparelho",
    machine: "Cadeira extensora",
    level: "iniciante",
    description: "Isolamento para o quadríceps (parte frontal da coxa).",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Evitar cargas excessivas. Movimento controlado.",
    alternatives: ["agachamento_peso_corporal", "afundo"],
  },
  {
    id: "cadeira_flexora",
    name: "Cadeira flexora",
    muscleGroup: "pernas",
    equipment: "aparelho",
    machine: "Cadeira flexora",
    level: "iniciante",
    description: "Isolamento para posteriores de coxa.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Movimento controlado, sem impulso.",
    alternatives: ["stiff", "ponte_gluteos"],
  },
  {
    id: "agachamento_livre",
    name: "Agachamento livre",
    muscleGroup: "pernas",
    equipment: "barra",
    level: "intermediario",
    description: "Exercício composto fundamental para membros inferiores.",
    defaultSets: 3, defaultReps: "8 a 10", defaultRestSeconds: 90,
    safetyNote: "Manter coluna neutra. Iniciar com carga leve.",
    alternatives: ["leg_press", "agachamento_smith", "agachamento_peso_corporal"],
  },
  {
    id: "agachamento_smith",
    name: "Agachamento no Smith",
    muscleGroup: "pernas",
    equipment: "aparelho",
    machine: "Smith machine",
    level: "iniciante",
    description: "Variação guiada do agachamento, com mais estabilidade.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 75,
    safetyNote: "Pés ligeiramente à frente. Não travar joelhos.",
    alternatives: ["leg_press", "agachamento_livre"],
  },
  {
    id: "agachamento_peso_corporal",
    name: "Agachamento livre (peso corporal)",
    muscleGroup: "pernas",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Variante sem carga, ótimo para iniciantes ou em casa.",
    defaultSets: 3, defaultReps: "12 a 15", defaultRestSeconds: 45,
    safetyNote: "Cuide para os joelhos não passarem muito da linha dos pés.",
    alternatives: ["afundo"],
  },
  {
    id: "afundo",
    name: "Afundo (avanço)",
    muscleGroup: "pernas",
    equipment: "halter",
    level: "iniciante",
    description: "Trabalha quadríceps, glúteos e equilíbrio.",
    defaultSets: 3, defaultReps: "10 cada perna", defaultRestSeconds: 60,
    safetyNote: "Tronco ereto, joelho da frente alinhado com o pé.",
    alternatives: ["agachamento_peso_corporal"],
  },
  {
    id: "stiff",
    name: "Stiff com halteres",
    muscleGroup: "pernas",
    equipment: "halter",
    level: "intermediario",
    description: "Foca em posteriores de coxa e glúteos.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Manter leve flexão nos joelhos e coluna neutra.",
    alternatives: ["cadeira_flexora"],
  },

  // ── Glúteos ──
  {
    id: "ponte_gluteos",
    name: "Ponte de glúteos",
    muscleGroup: "gluteos",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Ativação e fortalecimento dos glúteos.",
    defaultSets: 3, defaultReps: "12 a 15", defaultRestSeconds: 45,
    safetyNote: "Apertar glúteos no topo, sem hiperextender a lombar.",
    alternatives: ["elevacao_pelvica"],
  },
  {
    id: "elevacao_pelvica",
    name: "Elevação pélvica (hip thrust)",
    muscleGroup: "gluteos",
    equipment: "barra",
    level: "intermediario",
    description: "Movimento principal para hipertrofia de glúteos.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 75,
    safetyNote: "Apoiar costas em banco firme. Não exagerar na carga inicial.",
    alternatives: ["ponte_gluteos"],
  },
  {
    id: "gluteo_cabo",
    name: "Glúteo no cabo",
    muscleGroup: "gluteos",
    equipment: "cabo",
    level: "iniciante",
    description: "Isolamento para glúteos usando polia.",
    defaultSets: 3, defaultReps: "12 cada lado", defaultRestSeconds: 45,
    safetyNote: "Movimento controlado, sem balanço de tronco.",
    alternatives: ["ponte_gluteos"],
  },

  // ── Panturrilha ──
  {
    id: "panturrilha_pe",
    name: "Panturrilha em pé",
    muscleGroup: "panturrilha",
    equipment: "aparelho",
    machine: "Máquina de panturrilha em pé",
    level: "iniciante",
    description: "Trabalha gastrocnêmio (panturrilha externa).",
    defaultSets: 4, defaultReps: "15 a 20", defaultRestSeconds: 45,
    safetyNote: "Amplitude completa: descer e subir lentamente.",
    alternatives: ["panturrilha_sentado"],
  },
  {
    id: "panturrilha_sentado",
    name: "Panturrilha sentado",
    muscleGroup: "panturrilha",
    equipment: "aparelho",
    machine: "Máquina de panturrilha sentado",
    level: "iniciante",
    description: "Foca no sóleo (parte interna).",
    defaultSets: 4, defaultReps: "15 a 20", defaultRestSeconds: 45,
    safetyNote: "Manter as costas apoiadas. Movimento controlado.",
    alternatives: ["panturrilha_pe"],
  },

  // ── Peito ──
  {
    id: "supino_reto",
    name: "Supino reto com barra",
    muscleGroup: "peito",
    equipment: "barra",
    level: "intermediario",
    description: "Exercício composto principal para peito.",
    defaultSets: 3, defaultReps: "8 a 10", defaultRestSeconds: 90,
    safetyNote: "Sempre com observador ou em rack de segurança.",
    alternatives: ["supino_halteres", "supino_maquina", "flexao"],
  },
  {
    id: "supino_halteres",
    name: "Supino com halteres",
    muscleGroup: "peito",
    equipment: "halter",
    level: "iniciante",
    description: "Variação com maior amplitude e estabilização.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 75,
    safetyNote: "Descer halteres até a linha do peito. Controle a descida.",
    alternatives: ["supino_reto", "flexao"],
  },
  {
    id: "supino_maquina",
    name: "Supino na máquina",
    muscleGroup: "peito",
    equipment: "aparelho",
    machine: "Máquina de supino",
    level: "iniciante",
    description: "Versão guiada do supino, ideal para iniciantes.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Ajustar altura do banco para o nível do peito.",
    alternatives: ["supino_halteres", "crucifixo"],
  },
  {
    id: "crucifixo",
    name: "Crucifixo com halteres",
    muscleGroup: "peito",
    equipment: "halter",
    level: "iniciante",
    description: "Isolamento para peito, foco em amplitude.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Cotovelos sempre semiflexionados. Não descer demais.",
    alternatives: ["voador_peito"],
  },
  {
    id: "voador_peito",
    name: "Voador (pec deck)",
    muscleGroup: "peito",
    equipment: "aparelho",
    machine: "Voador",
    level: "iniciante",
    description: "Isolamento de peito com excelente estabilidade.",
    defaultSets: 3, defaultReps: "12 a 15", defaultRestSeconds: 45,
    safetyNote: "Não hiperextender ombros para trás.",
    alternatives: ["crucifixo"],
  },
  {
    id: "flexao",
    name: "Flexão de braço",
    muscleGroup: "peito",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Variação clássica de peso corporal para peito e tríceps.",
    defaultSets: 3, defaultReps: "máximo confortável", defaultRestSeconds: 60,
    safetyNote: "Manter corpo alinhado. Para iniciantes, apoiar joelhos.",
    alternatives: ["supino_halteres"],
  },

  // ── Costas ──
  {
    id: "puxada_alta",
    name: "Puxada alta (pulley)",
    muscleGroup: "costas",
    equipment: "cabo",
    machine: "Puxador alto",
    level: "iniciante",
    description: "Exercício principal para dorsais (latíssimo).",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Puxar até a linha do queixo. Não usar impulso.",
    alternatives: ["barra_fixa", "remada_unilateral"],
  },
  {
    id: "remada_curvada",
    name: "Remada curvada com barra",
    muscleGroup: "costas",
    equipment: "barra",
    level: "intermediario",
    description: "Trabalha toda a região do dorso e parte média das costas.",
    defaultSets: 3, defaultReps: "8 a 10", defaultRestSeconds: 75,
    safetyNote: "Coluna neutra. Joelhos ligeiramente flexionados.",
    alternatives: ["remada_maquina", "remada_unilateral"],
  },
  {
    id: "remada_maquina",
    name: "Remada na máquina",
    muscleGroup: "costas",
    equipment: "aparelho",
    machine: "Remada sentada",
    level: "iniciante",
    description: "Versão guiada da remada.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Apertar escápulas no final do movimento.",
    alternatives: ["remada_curvada", "remada_unilateral"],
  },
  {
    id: "remada_unilateral",
    name: "Remada unilateral com halter",
    muscleGroup: "costas",
    equipment: "halter",
    level: "iniciante",
    description: "Trabalha as costas lado a lado, com boa amplitude.",
    defaultSets: 3, defaultReps: "10 cada lado", defaultRestSeconds: 60,
    safetyNote: "Apoiar joelho e mão oposta no banco para estabilidade.",
    alternatives: ["remada_maquina"],
  },
  {
    id: "barra_fixa",
    name: "Barra fixa",
    muscleGroup: "costas",
    equipment: "peso_corporal",
    level: "avancado",
    description: "Exercício composto avançado para costas.",
    defaultSets: 3, defaultReps: "máximo confortável", defaultRestSeconds: 90,
    safetyNote: "Para iniciantes, use elástico de auxílio ou variante assistida.",
    alternatives: ["puxada_alta"],
  },

  // ── Ombros ──
  {
    id: "desenvolvimento_halteres",
    name: "Desenvolvimento com halteres",
    muscleGroup: "ombros",
    equipment: "halter",
    level: "iniciante",
    description: "Exercício composto para deltoides.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Sentado com apoio nas costas. Não travar cotovelos.",
    alternatives: ["desenvolvimento_maquina", "elevacao_frontal"],
  },
  {
    id: "desenvolvimento_maquina",
    name: "Desenvolvimento na máquina",
    muscleGroup: "ombros",
    equipment: "aparelho",
    machine: "Máquina de desenvolvimento",
    level: "iniciante",
    description: "Variação guiada, ideal para iniciantes.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Ajustar banco para alinhar pegada com ombros.",
    alternatives: ["desenvolvimento_halteres"],
  },
  {
    id: "elevacao_lateral",
    name: "Elevação lateral",
    muscleGroup: "ombros",
    equipment: "halter",
    level: "iniciante",
    description: "Isolamento para deltoide lateral.",
    defaultSets: 3, defaultReps: "12 a 15", defaultRestSeconds: 45,
    safetyNote: "Não passar dos ombros. Movimento controlado.",
    alternatives: ["elevacao_frontal"],
  },
  {
    id: "elevacao_frontal",
    name: "Elevação frontal",
    muscleGroup: "ombros",
    equipment: "halter",
    level: "iniciante",
    description: "Isolamento para deltoide anterior.",
    defaultSets: 3, defaultReps: "12 a 15", defaultRestSeconds: 45,
    safetyNote: "Não balançar tronco. Manter braços levemente flexionados.",
    alternatives: ["elevacao_lateral"],
  },

  // ── Bíceps ──
  {
    id: "rosca_direta",
    name: "Rosca direta com barra",
    muscleGroup: "biceps",
    equipment: "barra",
    level: "iniciante",
    description: "Principal exercício para bíceps.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 45,
    safetyNote: "Não balançar o tronco. Cotovelos fixos.",
    alternatives: ["rosca_alternada", "rosca_martelo"],
  },
  {
    id: "rosca_alternada",
    name: "Rosca alternada com halteres",
    muscleGroup: "biceps",
    equipment: "halter",
    level: "iniciante",
    description: "Variação alternando os braços.",
    defaultSets: 3, defaultReps: "10 cada braço", defaultRestSeconds: 45,
    safetyNote: "Supinação completa no topo.",
    alternatives: ["rosca_direta"],
  },
  {
    id: "rosca_martelo",
    name: "Rosca martelo",
    muscleGroup: "biceps",
    equipment: "halter",
    level: "iniciante",
    description: "Trabalha bíceps e braquial.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 45,
    safetyNote: "Pegada neutra. Sem balanço.",
    alternatives: ["rosca_direta"],
  },

  // ── Tríceps ──
  {
    id: "triceps_pulley",
    name: "Tríceps no pulley",
    muscleGroup: "triceps",
    equipment: "cabo",
    machine: "Polia alta",
    level: "iniciante",
    description: "Isolamento para tríceps com corda ou barra.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 45,
    safetyNote: "Cotovelos colados ao corpo. Movimento na extensão.",
    alternatives: ["triceps_frances", "mergulho_banco"],
  },
  {
    id: "triceps_frances",
    name: "Tríceps francês",
    muscleGroup: "triceps",
    equipment: "halter",
    level: "intermediario",
    description: "Isolamento da cabeça longa do tríceps.",
    defaultSets: 3, defaultReps: "10 a 12", defaultRestSeconds: 60,
    safetyNote: "Cuidar com peso atrás da cabeça. Comece leve.",
    alternatives: ["triceps_pulley"],
  },
  {
    id: "mergulho_banco",
    name: "Mergulho no banco",
    muscleGroup: "triceps",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Trabalha tríceps com peso corporal.",
    defaultSets: 3, defaultReps: "10 a 15", defaultRestSeconds: 60,
    safetyNote: "Não descer demais para preservar ombros.",
    alternatives: ["triceps_pulley"],
  },

  // ── Abdômen ──
  {
    id: "prancha",
    name: "Prancha isométrica",
    muscleGroup: "abdomen",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Fortalecimento de core (abdômen profundo).",
    defaultSets: 3, defaultReps: "30 a 60 seg", defaultRestSeconds: 45,
    safetyNote: "Manter alinhamento entre cabeça, quadril e pés.",
    alternatives: ["abdominal_supra"],
  },
  {
    id: "abdominal_supra",
    name: "Abdominal supra (crunch)",
    muscleGroup: "abdomen",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Trabalha porção superior do abdômen.",
    defaultSets: 3, defaultReps: "15 a 20", defaultRestSeconds: 30,
    safetyNote: "Não puxar pescoço. Foco no abdômen.",
    alternatives: ["prancha", "abdominal_infra"],
  },
  {
    id: "abdominal_infra",
    name: "Abdominal infra",
    muscleGroup: "abdomen",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Trabalha porção inferior do abdômen.",
    defaultSets: 3, defaultReps: "15 a 20", defaultRestSeconds: 30,
    safetyNote: "Manter lombar apoiada no chão.",
    alternatives: ["prancha"],
  },

  // ── Cardio ──
  {
    id: "esteira",
    name: "Caminhada/Corrida na esteira",
    muscleGroup: "cardio",
    equipment: "esteira",
    level: "iniciante",
    description: "Trabalho aeróbio de baixo impacto (caminhada) a intenso (corrida).",
    defaultSets: 1, defaultReps: "20 a 30 min", defaultRestSeconds: 0,
    safetyNote: "Comece em ritmo confortável. Hidrate-se.",
    alternatives: ["bicicleta", "eliptico", "caminhada_externa"],
  },
  {
    id: "bicicleta",
    name: "Bicicleta ergométrica",
    muscleGroup: "cardio",
    equipment: "bicicleta",
    level: "iniciante",
    description: "Cardio de baixo impacto, bom para articulações.",
    defaultSets: 1, defaultReps: "20 a 30 min", defaultRestSeconds: 0,
    safetyNote: "Ajustar altura do banco. Postura ereta.",
    alternatives: ["esteira", "eliptico"],
  },
  {
    id: "eliptico",
    name: "Elíptico (transport)",
    muscleGroup: "cardio",
    equipment: "eliptico",
    level: "iniciante",
    description: "Cardio que envolve membros superiores e inferiores.",
    defaultSets: 1, defaultReps: "20 a 30 min", defaultRestSeconds: 0,
    safetyNote: "Mantenha tronco ereto. Use a alça para impulsionar.",
    alternatives: ["esteira", "bicicleta"],
  },
  {
    id: "caminhada_externa",
    name: "Caminhada ao ar livre",
    muscleGroup: "cardio",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Caminhada em parque, rua ou trilha leve.",
    defaultSets: 1, defaultReps: "30 a 45 min", defaultRestSeconds: 0,
    safetyNote: "Use calçado confortável e hidrate-se.",
    alternatives: ["esteira"],
  },
  {
    id: "polichinelo",
    name: "Polichinelo",
    muscleGroup: "cardio",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Aquecimento cardiovascular.",
    defaultSets: 3, defaultReps: "30 segundos", defaultRestSeconds: 30,
    safetyNote: "Aterrissagem leve para preservar articulações.",
    alternatives: ["burpee"],
  },
  {
    id: "burpee",
    name: "Burpee",
    muscleGroup: "cardio",
    equipment: "peso_corporal",
    level: "intermediario",
    description: "Exercício de corpo inteiro intenso.",
    defaultSets: 3, defaultReps: "8 a 10", defaultRestSeconds: 60,
    safetyNote: "Comece sem o salto se for iniciante.",
    alternatives: ["polichinelo"],
  },

  // ── Mobilidade / Alongamento ──
  {
    id: "alongamento_geral",
    name: "Alongamento geral",
    muscleGroup: "alongamento",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Sequência leve de alongamentos de pescoço, ombros, lombar e pernas.",
    defaultSets: 1, defaultReps: "10 a 15 min", defaultRestSeconds: 0,
    safetyNote: "Sem dor. Respire profundamente.",
  },
  {
    id: "mobilidade_quadril",
    name: "Mobilidade de quadril",
    muscleGroup: "mobilidade",
    equipment: "peso_corporal",
    level: "iniciante",
    description: "Rotações e flexões controladas para o quadril.",
    defaultSets: 2, defaultReps: "10 cada lado", defaultRestSeconds: 30,
    safetyNote: "Movimentos suaves e controlados.",
  },
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  peito: "Peito",
  costas: "Costas",
  pernas: "Pernas",
  ombros: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  abdomen: "Abdômen",
  gluteos: "Glúteos",
  panturrilha: "Panturrilha",
  cardio: "Cardio",
  mobilidade: "Mobilidade",
  alongamento: "Alongamento",
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  aparelho: "Aparelho",
  halter: "Halter",
  barra: "Barra",
  peso_corporal: "Peso corporal",
  cabo: "Cabo/polia",
  esteira: "Esteira",
  bicicleta: "Bicicleta",
  eliptico: "Elíptico",
  outro: "Outro",
};

export function getExerciseById(id: string): ExerciseLibraryItem | undefined {
  return EXERCISE_LIBRARY.find((e) => e.id === id);
}

export function getExercisesByMuscle(muscle: MuscleGroup, equipment?: EquipmentType): ExerciseLibraryItem[] {
  return EXERCISE_LIBRARY.filter((e) => {
    if (e.muscleGroup !== muscle) return false;
    if (equipment && e.equipment !== equipment) return false;
    return true;
  });
}

export function findAlternatives(exerciseId: string, equipmentPref?: EquipmentType): ExerciseLibraryItem[] {
  const base = getExerciseById(exerciseId);
  if (!base) return [];
  const ids = base.alternatives ?? [];
  const alts = ids.map((id) => getExerciseById(id)).filter((x): x is ExerciseLibraryItem => !!x);
  if (equipmentPref) {
    const filtered = alts.filter((a) => a.equipment === equipmentPref);
    if (filtered.length) return filtered;
  }
  return alts;
}
