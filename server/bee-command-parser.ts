export type BeeCommandActionType = "calendar_event" | "alarm_reminder";

export type BeeCommandMissingField = "title" | "date" | "time";

export interface BeeCalendarAction {
  type: "calendar_event";
  title: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  description?: string | null;
  source: "bee_chat";
  confidence: number;
  rawText: string;
  missingFields: BeeCommandMissingField[];
}

export interface BeeAlarmAction {
  type: "alarm_reminder";
  title: string;
  message?: string | null;
  kind: "alarm" | "reminder";
  scheduledAt?: string;
  repeatType: "once" | "daily" | "weekly" | "interval";
  intervalMinutes?: number | null;
  repeatDays?: number[];
  linkedEvent?: boolean;
  reminderOffsetMinutes?: number | null;
  source: "bee_chat";
  confidence: number;
  rawText: string;
  missingFields: BeeCommandMissingField[];
}

export type BeeCommandAction = BeeCalendarAction | BeeAlarmAction;

export interface BeeCommandParseResult {
  originalMessage: string;
  actions: BeeCommandAction[];
  missingFields: BeeCommandMissingField[];
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface ParseBeeCommandOptions {
  now?: Date;
  defaultReminderTime?: string;
  defaultReminderOffsetMinutes?: number;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  "terca-feira": 2,
  terça: 2,
  "terça-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
  sábado: 6,
};

const WEEKDAY_PATTERNS = [
  "domingo",
  "segunda-feira",
  "segunda",
  "terca-feira",
  "terça-feira",
  "terca",
  "terça",
  "quarta-feira",
  "quarta",
  "quinta-feira",
  "quinta",
  "sexta-feira",
  "sexta",
  "sabado",
  "sábado",
];

const CALENDAR_WORDS =
  /\b(marque|marcar|agende|agendar|agenda|calend[aá]rio|compromisso|evento|consulta|reuni[aã]o|dentista|m[eé]dico|medico|anivers[aá]rio|tenho|coloque)\b/i;

const ALARM_WORDS =
  /\b(me\s+lembre|lembre-me|me\s+avise|avise-me|alarme|desperte|me\s+acorde|acorde-me|tocar\s+alarme|notifique)\b/i;

const ALSO_CALENDAR_WORDS = /\b(coloque|bot[e]?|adicione|inclua).{0,30}\b(calend[aá]rio|agenda)\b|\b(calend[aá]rio|agenda)\b/i;

const BEFORE_WORDS = /\b(antes|adiantad[oa]|anteced[eê]ncia)\b/i;

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalized(value: string): string {
  return stripDiacritics(value).toLowerCase();
}

function cleanSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function capitalizeTitle(value: string): string {
  const cleaned = cleanSpaces(value);
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function parseClockTime(text: string): { hour: number; minute: number; found: boolean } {
  const raw = text.toLowerCase();
  const norm = normalized(raw);

  if (/\bmeio[-\s]?dia\b/.test(norm)) {
    return { hour: 12, minute: 0, found: true };
  }
  if (/\bmeia[-\s]?noite\b/.test(norm)) {
    return { hour: 0, minute: 0, found: true };
  }

  const halfMatch = norm.match(/\b(?:as|a|às)?\s*(\d{1,2})\s+e\s+meia\b/);
  if (halfMatch) {
    const hour = Number(halfMatch[1]);
    return normalizeHour(hour, 30, raw);
  }

  const compactMatch = norm.match(/\b(?:as|a|às)?\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b/);
  if (compactMatch) {
    const hour = Number(compactMatch[1]);
    const minute = compactMatch[2] ? Number(compactMatch[2]) : 0;
    return normalizeHour(hour, minute, raw);
  }

  const periodMatch = norm.match(/\b(?:as|a|às)\s*(\d{1,2})\s*(?:da\s+manha|da\s+tarde|da\s+noite)\b/);
  if (periodMatch) {
    return normalizeHour(Number(periodMatch[1]), 0, raw);
  }

  return { hour: 0, minute: 0, found: false };
}

function normalizeHour(hour: number, minute: number, originalText: string): { hour: number; minute: number; found: boolean } {
  const norm = normalized(originalText);
  let normalizedHour = hour;
  if (/\b(da noite|da tarde)\b/.test(norm) && normalizedHour < 12) {
    normalizedHour += 12;
  }
  if (/\bda manha\b/.test(norm) && normalizedHour === 12) {
    normalizedHour = 0;
  }
  if (normalizedHour > 23 || minute > 59) {
    return { hour: 0, minute: 0, found: false };
  }
  return { hour: normalizedHour, minute, found: true };
}

function setTime(base: Date, hour: number, minute: number): Date {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseDefaultTime(defaultTime: string): { hour: number; minute: number } {
  const [hourText = "8", minuteText = "0"] = defaultTime.split(":");
  return {
    hour: Math.max(0, Math.min(23, Number(hourText) || 8)),
    minute: Math.max(0, Math.min(59, Number(minuteText) || 0)),
  };
}

function findWeekday(text: string): number | null {
  const norm = normalized(text);
  for (const pattern of WEEKDAY_PATTERNS) {
    const key = normalized(pattern);
    if (new RegExp(`\\b${key}\\b`).test(norm)) {
      return WEEKDAYS[pattern] ?? WEEKDAYS[key] ?? null;
    }
  }
  return null;
}

function nextWeekday(now: Date, weekday: number): Date {
  const diff = (weekday - now.getDay() + 7) % 7 || 7;
  return addDays(now, diff);
}

function parseRelativeFuture(text: string, now: Date): Date | null {
  const norm = normalized(text);
  const match = norm.match(/\bdaqui\s+(\d+)\s*(minuto|minutos|min|hora|horas|h)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const minutes = unit.startsWith("h") || unit.startsWith("hora") ? amount * 60 : amount;
  return new Date(now.getTime() + minutes * 60_000);
}

function parseBeforeOffset(text: string, defaultOffset: number): number | null {
  const norm = normalized(text);
  const match = norm.match(/\b(\d+)\s*(minuto|minutos|min|hora|horas|h)\s+antes\b/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    return unit.startsWith("h") || unit.startsWith("hora") ? amount * 60 : amount;
  }
  return BEFORE_WORDS.test(text) ? defaultOffset : null;
}

function parseDateTime(
  text: string,
  now: Date,
  options: { defaultTime?: string; requireTime?: boolean },
): { date?: Date; hasDate: boolean; hasTime: boolean } {
  const relative = parseRelativeFuture(text, now);
  if (relative) {
    return { date: relative, hasDate: true, hasTime: true };
  }

  const clock = parseClockTime(text);
  const defaultTime = options.defaultTime ? parseDefaultTime(options.defaultTime) : null;
  const hour = clock.found ? clock.hour : defaultTime?.hour;
  const minute = clock.found ? clock.minute : defaultTime?.minute;
  const norm = normalized(text);

  let date: Date | null = null;

  const explicitDate = norm.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const yearText = explicitDate[3];
    const year = yearText ? normalizeYear(Number(yearText)) : now.getFullYear();
    date = new Date(now);
    date.setFullYear(year, month, day);
  } else if (/\bdepois\s+de\s+amanha\b/.test(norm)) {
    date = addDays(now, 2);
  } else if (/\bamanha\b/.test(norm)) {
    date = addDays(now, 1);
  } else if (/\bhoje\b/.test(norm)) {
    date = new Date(now);
  } else {
    const dayOnly = norm.match(/\bdia\s+(\d{1,2})\b/);
    if (dayOnly) {
      const day = Number(dayOnly[1]);
      date = new Date(now);
      date.setDate(day);
      if (date <= now) {
        date = addMonths(date, 1);
      }
    } else {
      const weekday = findWeekday(text);
      if (weekday !== null) {
        date = nextWeekday(now, weekday);
      } else if (/\bsemana\s+que\s+vem\b/.test(norm)) {
        date = addDays(now, 7);
      }
    }
  }

  if (!date && clock.found) {
    date = new Date(now);
    const candidate = setTime(date, clock.hour, clock.minute);
    if (candidate <= now) {
      date = addDays(date, 1);
    }
  }

  if (!date) {
    return { hasDate: false, hasTime: clock.found };
  }

  if (hour !== undefined && minute !== undefined) {
    date = setTime(date, hour, minute);
  }

  return { date, hasDate: true, hasTime: clock.found || !!defaultTime };
}

function normalizeYear(year: number): number {
  if (year < 100) return 2000 + year;
  return year;
}

function parseRepeat(text: string): Pick<BeeAlarmAction, "repeatType" | "intervalMinutes" | "repeatDays"> {
  const norm = normalized(text);
  if (/\btod[oa]s?\s+os\s+dias\b|\btodo\s+dia\b|\bdiariamente\b/.test(norm)) {
    return { repeatType: "daily", intervalMinutes: null, repeatDays: [] };
  }

  const weekday = findWeekday(text);
  if (/\btod[ao]\b/.test(norm) && weekday !== null) {
    return { repeatType: "weekly", intervalMinutes: null, repeatDays: [weekday] };
  }

  const interval = norm.match(/\ba\s+cada\s+(\d+)\s*(minuto|minutos|min|hora|horas|h)\b/);
  if (interval) {
    const amount = Number(interval[1]);
    const unit = interval[2];
    return {
      repeatType: "interval",
      intervalMinutes: unit.startsWith("h") || unit.startsWith("hora") ? amount * 60 : amount,
      repeatDays: [],
    };
  }

  return { repeatType: "once", intervalMinutes: null, repeatDays: [] };
}

function removeDateTimeFragments(text: string): string {
  return cleanSpaces(
    text
      .replace(/\b(?:hoje|amanh[aã]|depois\s+de\s+amanh[aã]|semana\s+que\s+vem)\b/gi, " ")
      .replace(/\bpr[oó]xima?\s+(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?\b/gi, " ")
      .replace(/\b(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?\b/gi, " ")
      .replace(/\bdia\s+\d{1,2}\b/gi, " ")
      .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
      .replace(/\b(?:[aà]s|as|a)\s*\d{1,2}(?:\s*(?:h|:)\s*\d{0,2})?(?:\s+da\s+(?:manh[aã]|tarde|noite))?\b/gi, " ")
      .replace(/\b\d{1,2}\s*(?:h|:)\s*\d{0,2}\b/gi, " ")
      .replace(/(^|\s)(?:às|as)($|\s)/gi, " ")
      .replace(/\b\d{1,2}\s+e\s+meia\b/gi, " ")
      .replace(/\bmeio[-\s]?dia\b|\bmeia[-\s]?noite\b/gi, " ")
      .replace(/\bdaqui\s+\d+\s*(?:minuto|minutos|min|hora|horas|h)\b/gi, " ")
      .replace(/\btod[oa]s?\s+(?:os\s+)?(?:dias|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?\b/gi, " "),
  );
}

function removeCommandFragments(text: string): string {
  return cleanSpaces(
    text
      .replace(/\b(marque|marcar|agende|agendar|crie|criar|coloque|bot[e]?|adicione|inclua)\b/gi, " ")
      .replace(/\b(no|na|ao|a)\s+(calend[aá]rio|agenda)\b/gi, " ")
      .replace(/\b(um|uma|o|a)\s+(compromisso|evento|alarme|lembrete)\b/gi, " ")
      .replace(/\btenho\b/gi, " ")
      .replace(/\bme\s+(lembre|avise|acorde)\b/gi, " ")
      .replace(/\blembre-me\b|\bavise-me\b|\bacorde-me\b/gi, " ")
      .replace(/\bdesperte\b|\bnotifique\b/gi, " "),
  );
}

function extractEventTitle(message: string): string {
  const beforeReminder = message.split(/\s*,?\s+e\s+me\s+(?:lembre|avise|acorde)\b/i)[0] ?? message;
  const tenhoMatch = beforeReminder.match(/\btenho\s+(.+)$/i);
  const source = tenhoMatch?.[1] ?? beforeReminder;
  const cleaned = removeCommandFragments(removeDateTimeFragments(source))
    .replace(/\bpara\b$/i, "")
    .replace(/\bde\b$/i, "");
  return capitalizeTitle(cleaned || "Compromisso");
}

function extractReminderTitle(message: string, fallbackTitle?: string): string {
  const deMatch = message.match(/\b(?:me\s+lembre|lembre-me|me\s+avise|avise-me)\s+(?:de\s+)?(.+?)(?:\s+e\s+(?:coloque|adicione|inclua|bot[e]?)|\s*,|$)/i);
  const avisarDeMatch = message.match(/\bme\s+avise\b.+?\bde\s+(.+?)(?:\s+e\s+(?:coloque|adicione|inclua|bot[e]?)|$)/i);
  const alarmMatch = message.match(/\b(?:crie|criar|coloque)?\s*(?:um\s+)?alarme\s+(?:para\s+)?(.+)?$/i);
  const source = avisarDeMatch?.[1] ?? deMatch?.[1] ?? alarmMatch?.[1] ?? fallbackTitle ?? "Lembrete";
  const cleaned = removeCommandFragments(removeDateTimeFragments(source))
    .replace(/\bantes\b/gi, " ")
    .replace(/\b\d+\s*(?:minuto|minutos|min|hora|horas|h)\b/gi, " ")
    .replace(/\bpara\b/gi, " ");
  return capitalizeTitle(cleaned || fallbackTitle || "Lembrete");
}

function uniqueMissing(actions: BeeCommandAction[]): BeeCommandMissingField[] {
  return Array.from(new Set(actions.flatMap((action) => action.missingFields)));
}

function buildClarificationQuestion(actions: BeeCommandAction[]): string | undefined {
  const firstMissing = actions.find((action) => action.missingFields.length);
  if (!firstMissing) return undefined;

  const title = firstMissing.title || (firstMissing.type === "calendar_event" ? "compromisso" : "lembrete");
  if (firstMissing.missingFields.includes("date")) {
    return firstMissing.type === "calendar_event"
      ? `Combinado 🐝 Qual data devo colocar para ${title}?`
      : `Claro 🐝 Em qual data você quer que eu te lembre de ${title}?`;
  }
  if (firstMissing.missingFields.includes("time")) {
    return firstMissing.type === "calendar_event"
      ? `Combinado 🐝 Qual horário devo colocar para ${title}?`
      : `Claro 🐝 Qual horário você quer que eu te lembre de ${title}?`;
  }
  if (firstMissing.missingFields.includes("title")) {
    return firstMissing.type === "calendar_event"
      ? "Combinado 🐝 Qual título devo colocar no calendário?"
      : "Claro 🐝 Do que você quer que eu te lembre?";
  }
  return undefined;
}

export function parseBeeCommand(message: string, options: ParseBeeCommandOptions = {}): BeeCommandParseResult {
  const now = options.now ?? new Date();
  const defaultReminderTime = options.defaultReminderTime ?? "08:00";
  const defaultReminderOffsetMinutes = options.defaultReminderOffsetMinutes ?? 30;
  const raw = cleanSpaces(message);
  const norm = normalized(raw);
  const hasAlarmIntent = ALARM_WORDS.test(raw);
  const hasCalendarIntent = CALENDAR_WORDS.test(raw);
  const wantsCalendarToo = hasAlarmIntent && ALSO_CALENDAR_WORDS.test(raw) && /\b(tamb[eé]m|tambem|calend[aá]rio|agenda)\b/i.test(raw);
  const beforeOffset = parseBeforeOffset(raw, defaultReminderOffsetMinutes);
  const hasLinkedReminderIntent = hasCalendarIntent && hasAlarmIntent && beforeOffset !== null;
  const hasAnySchedulingSignal =
    hasAlarmIntent || hasCalendarIntent || /\b(daqui|amanh[aã]|hoje|dia\s+\d{1,2}|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b/i.test(raw);

  if (!hasAnySchedulingSignal) {
    return {
      originalMessage: message,
      actions: [],
      missingFields: [],
      needsClarification: false,
    };
  }

  const actions: BeeCommandAction[] = [];
  const shouldCreateCalendar = hasCalendarIntent || wantsCalendarToo;
  const eventDateTime = parseDateTime(raw, now, { requireTime: true });
  const eventTitle = wantsCalendarToo ? extractReminderTitle(raw) : extractEventTitle(raw);

  if (shouldCreateCalendar && !/\balarme\b/i.test(raw)) {
    const missingFields: BeeCommandMissingField[] = [];
    if (!eventTitle) missingFields.push("title");
    if (!eventDateTime.hasDate) missingFields.push("date");
    if (!eventDateTime.hasTime) missingFields.push("time");
    actions.push({
      type: "calendar_event",
      title: eventTitle,
      startAt: eventDateTime.date?.toISOString(),
      endAt: eventDateTime.date ? new Date(eventDateTime.date.getTime() + 60 * 60_000).toISOString() : undefined,
      allDay: false,
      description: hasLinkedReminderIntent ? `Criado pela Bee com lembrete ${beforeOffset} minutos antes.` : null,
      source: "bee_chat",
      confidence: hasLinkedReminderIntent || wantsCalendarToo ? 0.95 : 0.9,
      rawText: raw,
      missingFields,
    });
  }

  const shouldCreateReminder = hasAlarmIntent;
  if (shouldCreateReminder) {
    const linkedToEvent = !!actions.find((action) => action.type === "calendar_event") && beforeOffset !== null;
    const repeat = parseRepeat(raw);
    const fallbackTitle = linkedToEvent ? eventTitle : undefined;
    const title = extractReminderTitle(raw, fallbackTitle);
    const alarmDateTime = linkedToEvent && eventDateTime.date && beforeOffset !== null
      ? {
          date: new Date(eventDateTime.date.getTime() - beforeOffset * 60_000),
          hasDate: true,
          hasTime: true,
        }
      : parseDateTime(raw, now, { defaultTime: defaultReminderTime });
    const missingFields: BeeCommandMissingField[] = [];
    if (!title && !linkedToEvent) missingFields.push("title");
    if (!alarmDateTime.hasDate) missingFields.push("date");
    if (!alarmDateTime.hasTime) missingFields.push("time");

    const eventTime = eventDateTime.date
      ? `${String(eventDateTime.date.getHours()).padStart(2, "0")}:${String(eventDateTime.date.getMinutes()).padStart(2, "0")}`
      : undefined;

    actions.push({
      type: "alarm_reminder",
      title: linkedToEvent ? `Lembrete: ${eventTitle}` : title,
      message: linkedToEvent && eventTime ? `Você tem ${eventTitle} às ${eventTime} 🐝` : title,
      kind: /\b(alarme|desperte|acorde)\b/i.test(raw) ? "alarm" : "reminder",
      scheduledAt: alarmDateTime.date?.toISOString(),
      repeatType: repeat.repeatType,
      intervalMinutes: repeat.intervalMinutes,
      repeatDays: repeat.repeatDays,
      linkedEvent: linkedToEvent,
      reminderOffsetMinutes: linkedToEvent ? beforeOffset : null,
      source: "bee_chat",
      confidence: linkedToEvent ? 0.94 : 0.9,
      rawText: raw,
      missingFields,
    });
  }

  if (!actions.length && /\b(tomar|pagar|comprar|buscar|ligar|enviar)\b/.test(norm) && hasAlarmIntent) {
    const alarmDateTime = parseDateTime(raw, now, { defaultTime: defaultReminderTime });
    const title = extractReminderTitle(raw);
    actions.push({
      type: "alarm_reminder",
      title,
      message: title,
      kind: "reminder",
      scheduledAt: alarmDateTime.date?.toISOString(),
      repeatType: parseRepeat(raw).repeatType,
      intervalMinutes: parseRepeat(raw).intervalMinutes,
      repeatDays: parseRepeat(raw).repeatDays,
      source: "bee_chat",
      confidence: 0.82,
      rawText: raw,
      missingFields: [
        ...(title ? [] : (["title"] as BeeCommandMissingField[])),
        ...(alarmDateTime.hasDate ? [] : (["date"] as BeeCommandMissingField[])),
      ],
    });
  }

  const missingFields = uniqueMissing(actions);
  return {
    originalMessage: message,
    actions,
    missingFields,
    needsClarification: missingFields.length > 0,
    clarificationQuestion: buildClarificationQuestion(actions),
  };
}
