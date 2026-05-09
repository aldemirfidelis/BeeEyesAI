export interface HolidayInfo {
  name: string;
  date: string;
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getBrazilNationalHoliday(date: Date): HolidayInfo | null {
  const year = date.getFullYear();
  const target = ymd(date);
  const easter = easterSunday(year);
  const holidays: HolidayInfo[] = [
    { date: `${year}-01-01`, name: "Confraternizacao Universal" },
    { date: ymd(addDays(easter, -48)), name: "Carnaval" },
    { date: ymd(addDays(easter, -47)), name: "Carnaval" },
    { date: ymd(addDays(easter, -2)), name: "Sexta-feira Santa" },
    { date: ymd(easter), name: "Pascoa" },
    { date: `${year}-04-21`, name: "Tiradentes" },
    { date: `${year}-05-01`, name: "Dia do Trabalhador" },
    { date: ymd(addDays(easter, 60)), name: "Corpus Christi" },
    { date: `${year}-09-07`, name: "Independencia do Brasil" },
    { date: `${year}-10-12`, name: "Nossa Senhora Aparecida" },
    { date: `${year}-11-02`, name: "Finados" },
    { date: `${year}-11-15`, name: "Proclamacao da Republica" },
    { date: `${year}-11-20`, name: "Consciencia Negra" },
    { date: `${year}-12-25`, name: "Natal" },
  ];

  return holidays.find((holiday) => holiday.date === target) ?? null;
}
