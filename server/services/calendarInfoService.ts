/**
 * calendarInfoService.ts
 *
 * Serviço central que combina:
 * - Feriados nacionais (server/holidays.ts)
 * - Feriados estaduais (server/data/stateHolidays.ts)
 * - Datas comemorativas (server/data/brazilianSpecialDates.ts)
 *
 * Retorna PublicCalendarEntry[] para qualquer intervalo de datas.
 * Usado em:
 *  - GET /api/calendar/public   (frontend)
 *  - runtimeContext do chat      (IA)
 *  - Scheduler de notificações   (push/notif)
 */

import { getBrazilNationalHoliday } from "../holidays";
import { getStateHolidaysForDay, STATE_NAMES, type StateHoliday } from "../data/stateHolidays";
import { getSpecialDatesForDay, type SpecialDate, type SpecialDateCategory } from "../data/brazilianSpecialDates";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PublicEntryType =
  | "national_holiday"
  | "state_holiday"
  | "special_date";

export interface PublicCalendarEntry {
  id: string;
  title: string;
  description: string;
  date: string;       // "YYYY-MM-DD"
  type: PublicEntryType;
  emoji: string;
  state?: string;     // only for state_holiday
  category?: SpecialDateCategory;
  notifyBefore: boolean;
  notifyOnDay: boolean;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, "0"); }

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns all public calendar entries in [from, to] (inclusive).
 *
 * @param from  - Start date (inclusive)
 * @param to    - End date (inclusive)
 * @param state - Optional Brazilian state code (e.g. "GO") for state holidays
 * @param enabledCategories - Filter special dates by category (null = all)
 */
export function getPublicCalendarEntries(
  from: Date,
  to: Date,
  state?: string | null,
  enabledCategories?: SpecialDateCategory[] | null,
): PublicCalendarEntry[] {
  const results: PublicCalendarEntry[] = [];
  const seenIds = new Set<string>();

  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1; // 1-12
    const day = current.getDate();
    const dateStr = ymd(year, month, day);

    // ── National holidays ─────────────────────────────────────────────────
    const nat = getBrazilNationalHoliday(current);
    if (nat) {
      const id = `nat-${dateStr}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        results.push({
          id,
          title: nat.name,
          description: `Feriado nacional no Brasil.`,
          date: dateStr,
          type: "national_holiday",
          emoji: NATIONAL_HOLIDAY_EMOJI[nat.name] ?? "🇧🇷",
          notifyBefore: true,
          notifyOnDay: true,
        });
      }
    }

    // ── State holidays ────────────────────────────────────────────────────
    if (state) {
      const stateHols = getStateHolidaysForDay(state, month, day);
      for (const sh of stateHols) {
        const id = `state-${sh.id}-${year}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({
            id,
            title: sh.title,
            description: sh.description + ` (${STATE_NAMES[sh.state] ?? sh.state})`,
            date: dateStr,
            type: "state_holiday",
            emoji: sh.emoji,
            state: sh.state,
            notifyBefore: true,
            notifyOnDay: true,
          });
        }
      }
    }

    // ── Special / commemorative dates ─────────────────────────────────────
    const specials = getSpecialDatesForDay(year, month, day);
    for (const sd of specials) {
      if (enabledCategories && !enabledCategories.includes(sd.category)) continue;
      const id = `special-${sd.id}-${year}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        results.push({
          id,
          title: sd.title,
          description: sd.description,
          date: dateStr,
          type: "special_date",
          emoji: sd.emoji,
          category: sd.category,
          notifyBefore: sd.notifyBefore,
          notifyOnDay: sd.notifyOnDay,
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Convenience: next N days ──────────────────────────────────────────────────

export function getUpcomingPublicEntries(
  days = 30,
  state?: string | null,
  enabledCategories?: SpecialDateCategory[] | null,
): PublicCalendarEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = addDays(today, days);
  return getPublicCalendarEntries(today, end, state, enabledCategories);
}

// ── Convenience: single month ─────────────────────────────────────────────────

export function getPublicEntriesForMonth(
  year: number,
  month: number,
  state?: string | null,
  enabledCategories?: SpecialDateCategory[] | null,
): PublicCalendarEntry[] {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0); // last day of month
  return getPublicCalendarEntries(from, to, state, enabledCategories);
}

// ── AI Context formatter ──────────────────────────────────────────────────────

/**
 * Returns a concise text block summarizing upcoming public calendar entries,
 * suitable for injection into the AI system prompt.
 *
 * @param daysAhead - How many days ahead to include (default 30)
 * @param state     - Optional state for state-specific holidays
 */
export function buildCalendarContextForAI(daysAhead = 30, state?: string | null): string {
  const entries = getUpcomingPublicEntries(daysAhead, state);
  if (entries.length === 0) return "";

  const lines: string[] = [];

  const natHols = entries.filter((e) => e.type === "national_holiday");
  const stateHols = entries.filter((e) => e.type === "state_holiday");
  const specials = entries.filter((e) => e.type === "special_date" && (e.notifyBefore || e.notifyOnDay));

  if (natHols.length > 0) {
    lines.push("Próximos feriados nacionais:");
    natHols.forEach((e) => lines.push(`  - ${formatDatePtBR(e.date)}: ${e.emoji} ${e.title}`));
  }
  if (stateHols.length > 0) {
    lines.push(`Próximos feriados estaduais (${state}):`);
    stateHols.forEach((e) => lines.push(`  - ${formatDatePtBR(e.date)}: ${e.emoji} ${e.title}`));
  }
  if (specials.length > 0) {
    lines.push("Datas comemorativas próximas:");
    specials.slice(0, 8).forEach((e) => lines.push(`  - ${formatDatePtBR(e.date)}: ${e.emoji} ${e.title}`));
  }

  return `\n## Calendário público – próximos ${daysAhead} dias:\n${lines.join("\n")}`;
}

// ── Notification helpers ──────────────────────────────────────────────────────

/**
 * Returns entries that should trigger a "one day before" notification today.
 * (i.e. entries whose date = tomorrow)
 */
export function getEntriesToNotifyTomorrow(state?: string | null): PublicCalendarEntry[] {
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(0, 0, 0, 0);
  const entries = getPublicCalendarEntries(tomorrow, tomorrow, state);
  return entries.filter((e) => e.notifyBefore);
}

/**
 * Returns entries that should trigger an "on the day" notification today.
 */
export function getEntriesToNotifyToday(state?: string | null): PublicCalendarEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entries = getPublicCalendarEntries(today, today, state);
  return entries.filter((e) => e.notifyOnDay);
}

// ── Emoji map for national holidays ──────────────────────────────────────────

const NATIONAL_HOLIDAY_EMOJI: Record<string, string> = {
  "Confraternizacao Universal": "🎆",
  "Carnaval": "🎭",
  "Sexta-feira Santa": "✝️",
  "Pascoa": "🐣",
  "Tiradentes": "⚔️",
  "Dia do Trabalhador": "👷",
  "Corpus Christi": "✝️",
  "Independencia do Brasil": "🇧🇷",
  "Nossa Senhora Aparecida": "⛪",
  "Finados": "🕯️",
  "Proclamacao da Republica": "🏛️",
  "Consciencia Negra": "✊",
  "Natal": "🎄",
};

// ── Date formatting ───────────────────────────────────────────────────────────

function formatDatePtBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${day}/${month} (${months[month - 1]}/${year})`;
}
