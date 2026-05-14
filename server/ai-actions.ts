export type CreateEventAction = {
  title: string;
  startAt: string;
  endAt?: string;
  description?: string;
  location?: string;
  allDay?: boolean;
};

export type LogFinanceAction = {
  type: "income" | "expense";
  amount: number;
  category: string;
  description?: string;
};

export type SaveNoteAction = {
  content: string;
  title?: string;
};

export type AlarmReminderAction = {
  title: string;
  message?: string;
  kind: "alarm" | "medicine" | "appointment";
  scheduledAt: string;
  repeatType: "once" | "daily" | "weekly" | "interval";
  intervalMinutes?: number | null;
};

export type ExplicitToolActions = {
  createEvent?: CreateEventAction;
  logFinance?: LogFinanceAction;
  saveNote?: SaveNoteAction;
  alarmReminder?: AlarmReminderAction;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(value: string): string {
  return stripDiacritics(value).toLowerCase();
}

function titleCaseFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function cleanSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const DAY_OF_WEEK: Record<string, number> = {
  domingo: 0, segunda: 1, "segunda-feira": 1, terca: 2, "terca-feira": 2,
  quarta: 3, "quarta-feira": 3, quinta: 4, "quinta-feira": 4,
  sexta: 5, "sexta-feira": 5, sabado: 6,
};

function parseTimeFromMessage(message: string): { hour: number; minute: number; hasTime: boolean } {
  const m =
    message.match(/\b(?:as|às|a|@)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?\b/i) ??
    message.match(/\b(\d{1,2})h(\d{2})?\b/i);
  if (!m) return { hour: 9, minute: 0, hasTime: false };
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (hour > 23 || minute > 59) return { hour: 9, minute: 0, hasTime: false };
  return { hour, minute, hasTime: true };
}

function parseDateTimeFromMessage(message: string): { startAt: Date; endAt?: Date; allDay: boolean } | null {
  const norm = stripDiacritics(message).toLowerCase();
  const now = new Date();
  const { hour, minute, hasTime } = parseTimeFromMessage(message);

  const durationMatch = message.match(/\b(?:por|durante)\s+(\d{1,2})\s*(h|hora|horas|min|minutos)\b/i);
  function buildResult(base: Date): { startAt: Date; endAt?: Date; allDay: boolean } {
    const startAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);
    let endAt: Date | undefined;
    if (durationMatch) {
      const amount = Number(durationMatch[1]);
      const millis = durationMatch[2].toLowerCase().startsWith("h") ? amount * 3_600_000 : amount * 60_000;
      endAt = new Date(startAt.getTime() + millis);
    } else if (hasTime) {
      endAt = new Date(startAt.getTime() + 3_600_000);
    }
    return { startAt, endAt, allDay: !hasTime };
  }

  // Explicit numeric date: DD/MM or DD/MM/YYYY
  const dateMatch = message.match(/\b(?:dia\s+)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/i);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    let year = dateMatch[3] ? Number(dateMatch[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const base = new Date(year, month - 1, day);
    if (Number.isNaN(base.getTime())) return null;
    return buildResult(base);
  }

  // "depois de amanha" / "depois de amanhã"
  if (/\bdepois de amanha\b/.test(norm)) {
    const base = new Date(now);
    base.setDate(base.getDate() + 2);
    return buildResult(base);
  }

  // "amanha" / "amanhã"
  if (/\bamanha\b/.test(norm)) {
    const base = new Date(now);
    base.setDate(base.getDate() + 1);
    return buildResult(base);
  }

  // "hoje"
  if (/\bhoje\b/.test(norm)) {
    return buildResult(now);
  }

  // "em X dias/semanas"
  const relMatch = norm.match(/\bem\s+(\d+)\s*(dia|dias|semana|semanas)\b/);
  if (relMatch) {
    const n = Number(relMatch[1]);
    const isWeeks = relMatch[2].startsWith("semana");
    const base = new Date(now);
    base.setDate(base.getDate() + (isWeeks ? n * 7 : n));
    return buildResult(base);
  }

  // Day-of-week names: "sexta", "quarta-feira", etc.
  for (const [name, target] of Object.entries(DAY_OF_WEEK)) {
    if (new RegExp(`\\b${name}\\b`).test(norm)) {
      const today = now.getDay();
      let diff = target - today;
      if (diff <= 0) diff += 7;
      const base = new Date(now);
      base.setDate(base.getDate() + diff);
      return buildResult(base);
    }
  }

  // Has a time but no recognisable date → default to today (if time is in the future) or tomorrow
  if (hasTime) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    const base = candidate > now ? candidate : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute, 0, 0);
    let endAt: Date | undefined;
    if (durationMatch) {
      const amount = Number(durationMatch[1]);
      const millis = durationMatch[2].toLowerCase().startsWith("h") ? amount * 3_600_000 : amount * 60_000;
      endAt = new Date(base.getTime() + millis);
    } else {
      endAt = new Date(base.getTime() + 3_600_000);
    }
    return { startAt: base, endAt, allDay: false };
  }

  return null;
}

function inferEventAction(message: string, normalized: string): CreateEventAction | undefined {
  const hasIntent = /\b(marc|marq|agend|crie|criar|adicione|adicionar|coloque|bote|registre|registrar)\w*\b/.test(normalized);
  const mentionsCalendar = /\b(calendario|agenda|compromisso|evento|reuniao|lembrete)\b/.test(normalized);
  if (!hasIntent || !mentionsCalendar) return undefined;

  const dateTime = parseDateTimeFromMessage(message);
  if (!dateTime) return undefined;

  let title = message
    .replace(/\b(?:marque|marca|agende|agenda|crie|criar|adicione|adicionar|coloque|bote|registre|registrar)\b/gi, " ")
    .replace(/\b(?:no|na|para|um|uma|meu|minha)\b/gi, " ")
    .replace(/\b(?:calend[aá]rio|agenda)\b/gi, " ")
    .replace(/\b(?:dia\s+)?\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/gi, " ")
    .replace(/(?:[aà]s|@)\s*\d{1,2}(?:[:h]\d{2})?\s*h?\b/gi, " ")
    .replace(/\ba\s*\d{1,2}(?:[:h]\d{2})?\s*h?\b/gi, " ")
    .replace(/\b(?:por|durante)\s+\d{1,2}\s*(?:h|hora|horas|min|minutos)\b/gi, " ");

  title = cleanSpaces(title.replace(/^[:,.-]+|[:,.-]+$/g, ""));
  if (!title) title = "Compromisso";

  return {
    title: titleCaseFirst(title),
    startAt: dateTime.startAt.toISOString(),
    endAt: dateTime.endAt?.toISOString(),
    allDay: dateTime.allDay,
  };
}

function parseAmount(message: string): number | null {
  const match = message.match(/(?:r\$\s*)?(\d+(?:\.\d{3})*)(?:,(\d{1,2}))?/i);
  if (!match) return null;
  const integerPart = match[1].replace(/\./g, "");
  const decimalPart = match[2] ?? "0";
  const amount = Number(`${integerPart}.${decimalPart.padEnd(2, "0")}`);
  return Number.isFinite(amount) ? amount : null;
}

function inferFinanceCategory(normalized: string, type: "income" | "expense"): string {
  if (type === "income") {
    if (/\b(salario|pagamento|ordenado)\b/.test(normalized)) return "Salário";
    if (/\b(freela|freelance|bico|servico)\b/.test(normalized)) return "Freelance";
    if (/\b(investimento|dividendo|rendimento)\b/.test(normalized)) return "Investimentos";
    return "Outros";
  }

  if (/\b(mercado|restaurante|lanche|comida|almoco|jantar|ifood|alimentacao)\b/.test(normalized)) return "Alimentação";
  if (/\b(uber|onibus|metro|gasolina|combustivel|transporte)\b/.test(normalized)) return "Transporte";
  if (/\b(remedio|medico|consulta|saude|farmacia)\b/.test(normalized)) return "Saúde";
  if (/\b(cinema|bar|show|jogo|lazer)\b/.test(normalized)) return "Lazer";
  if (/\b(curso|livro|faculdade|escola|educacao)\b/.test(normalized)) return "Educação";
  if (/\b(aluguel|condominio|luz|agua|internet|moradia)\b/.test(normalized)) return "Moradia";
  if (/\b(compra|comprei|roupa|shopping|loja)\b/.test(normalized)) return "Compras";
  return "Outros";
}

function inferFinanceAction(message: string, normalized: string): LogFinanceAction | undefined {
  const incomeIntent = /\b(recebi|ganhei|entrou|caiu|receita|renda|salario|pagamento)\b/.test(normalized);
  const expenseIntent = /\b(gastei|paguei|comprei|despesa|gasto|registre|registrar|lancar|lancei)\b/.test(normalized);
  const mentionsFinance = /\b(financa|financas|financeiro|gasto|despesa|receita|renda|salario|pagamento)\b/.test(normalized);
  if (!incomeIntent && !expenseIntent && !mentionsFinance) return undefined;

  const amount = parseAmount(message);
  if (!amount || amount <= 0) return undefined;

  const type: "income" | "expense" = incomeIntent && !expenseIntent ? "income" : "expense";
  const category = inferFinanceCategory(normalized, type);
  const description = cleanSpaces(
    message
      .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?/i, " ")
      .replace(/\b(?:registrar|registre|lancar|lance|gastei|paguei|comprei|recebi|ganhei|despesa|gasto|receita|financas?|financeiro|de|em|no|na|com)\b/gi, " ")
  );

  return {
    type,
    amount,
    category,
    description: description || category,
  };
}

function inferNoteAction(message: string, normalized: string): SaveNoteAction | undefined {
  const trigger = /\b(anota|anote|salva|salve|guarda|guarde|cria uma nota|criar nota|nota|recado|lembrete de texto)\b/.test(normalized);
  if (!trigger) return undefined;

  let content = message;
  const split = message.split(/[:：]/);
  if (split.length > 1) {
    content = split.slice(1).join(":");
  } else {
    content = message.replace(/\b(?:anota|anote|salva|salve|guarda|guarde|cria|criar|uma|nota|recado|isso|essa ideia|este lembrete|lembrete de texto)\b/gi, " ");
  }

  content = cleanSpaces(content.replace(/^[:,.-]+|[:,.-]+$/g, ""));
  if (!content || content.length < 3) return undefined;

  return {
    content,
    title: titleCaseFirst(content.slice(0, 40)),
  };
}

function inferAlarmAction(message: string, normalized: string): AlarmReminderAction | undefined {
  const hasAlarmIntent = /\b(despert|acord|alarme|avise|avisar|lembre|lembrar|notifiq|toque)\w*\b/.test(normalized);
  const mentionsMedicine = /\b(remedio|medicamento|comprimido|dose|tomar)\b/.test(normalized);
  const mentionsAppointment = /\b(compromisso|reuniao|consulta|evento)\b/.test(normalized);
  if (!hasAlarmIntent && !mentionsMedicine) return undefined;

  const dateTime = parseDateTimeFromMessage(message);
  if (!dateTime) return undefined;

  let repeatType: AlarmReminderAction["repeatType"] = "once";
  let intervalMinutes: number | null = null;

  const intervalMatch = normalized.match(/\b(?:a cada|de)\s+(\d{1,2})\s*(h|hora|horas|min|minutos)\b/);
  if (intervalMatch) {
    repeatType = "interval";
    const amount = Number(intervalMatch[1]);
    intervalMinutes = intervalMatch[2].startsWith("h") ? amount * 60 : amount;
  } else if (/\b(todo dia|todos os dias|diario|diaria|diariamente)\b/.test(normalized)) {
    repeatType = "daily";
  } else if (/\b(toda semana|semanal|semanalmente)\b/.test(normalized)) {
    repeatType = "weekly";
  }

  const kind: AlarmReminderAction["kind"] = mentionsMedicine ? "medicine" : mentionsAppointment ? "appointment" : "alarm";
  let title = message
    .replace(/\b(?:me|para|por favor)\b/gi, " ")
    .replace(/\b(?:desperte|despertar|acorde|acordar|alarme|avise|avisar|lembre|lembrar|notifique|toque)\b/gi, " ")
    .replace(/\b(?:dia\s+)?\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/gi, " ")
    .replace(/(?:[aà]s|@)\s*\d{1,2}(?:[:h]\d{2})?\s*h?\b/gi, " ")
    .replace(/\ba\s*\d{1,2}(?:[:h]\d{2})?\s*h?\b/gi, " ")
    .replace(/\b(?:a cada|de)\s+\d{1,2}\s*(?:h|hora|horas|min|minutos)\b/gi, " ")
    .replace(/\b(?:todo dia|todos os dias|diario|diaria|diariamente|toda semana|semanal|semanalmente)\b/gi, " ");

  title = cleanSpaces(title.replace(/^[:,.-]+|[:,.-]+$/g, ""));
  if (!title) {
    title = kind === "medicine" ? "Tomar remédio" : kind === "appointment" ? "Compromisso" : "Despertar";
  }

  return {
    title: titleCaseFirst(title),
    message: kind === "medicine" ? `Hora de tomar: ${titleCaseFirst(title)}` : undefined,
    kind,
    scheduledAt: dateTime.startAt.toISOString(),
    repeatType,
    intervalMinutes,
  };
}

export function inferExplicitToolActions(message: string): ExplicitToolActions {
  const normalized = normalize(message);

  return {
    createEvent: inferEventAction(message, normalized),
    logFinance: inferFinanceAction(message, normalized),
    saveNote: inferNoteAction(message, normalized),
    alarmReminder: inferAlarmAction(message, normalized),
  };
}
