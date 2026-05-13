import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek, subMonths, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, Calendar, ChevronDown, ChevronLeft, ChevronRight, DollarSign, ExternalLink,
  Heart, Loader2, MapPin, Trash2, X, Link, CheckCircle2, TrendingDown, TrendingUp,
  StickyNote, Pin, PinOff, Pencil, Check, Clock, BellRing, Pill, Briefcase, Pause, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  googleEventId?: string | null;
}

interface FinanceTransaction {
  id: string;
  type: "income" | "expense";
  amountCents: number;
  category: string;
  description?: string | null;
  date: string;
}

interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: Record<string, number>;
}

interface Note {
  id: string;
  title?: string | null;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AlarmReminder {
  id: string;
  title: string;
  message?: string | null;
  kind: "alarm" | "medicine" | "appointment";
  scheduledAt: string;
  nextTriggerAt: string;
  lastTriggeredAt?: string | null;
  repeatType: "once" | "daily" | "weekly" | "interval";
  intervalMinutes?: number | null;
  repeatDays: number[];
  active: boolean;
}

interface ColmeiaPanelProps {
  authHeaders: () => Record<string, string>;
}

const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Moradia", "Compras", "Outros"];
const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Outros"];
const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#F59E0B", Transporte: "#3B82F6", Saúde: "#10B981",
  Lazer: "#8B5CF6", Educação: "#06B6D4", Moradia: "#EF4444",
  Compras: "#EC4899", Outros: "#6B7280",
  Salário: "#22C55E", Freelance: "#84CC16", Investimentos: "#F97316",
};

function fmtCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Colmeia Hub config ────────────────────────────────────────────────────────
// To add a new tool: (1) add ToolId to the union, (2) push to COLMEIA_TOOLS,
// (3) place it in TOOL_POSITIONS.

type ToolId = "calendar" | "finance" | "clock" | "notes" | "health";

interface ColmeiaTool { id: ToolId; label: string; src?: string; icon?: ReactNode; color: string }

const COLMEIA_TOOLS: ColmeiaTool[] = [
  { id: "calendar", label: "Calendário", src: "/icons-colmeia/calendario.png",  color: "#FFD940" },
  { id: "finance",  label: "Finanças",   src: "/icons-colmeia/financas.png",    color: "#10B981" },
  { id: "notes",    label: "Notas",      src: "/icons-colmeia/notas.png",       color: "#8B5CF6" },
  { id: "clock",    label: "Alarmes",    src: "/icons-colmeia/alarmes.png",     color: "#F97316" },
  { id: "health",   label: "Saúde",      icon: <Heart className="w-9 h-9" />,   color: "#EF4444" },
];

// 6 slots around center — null = "em breve"
const HEX_LAYOUT: Array<ToolId | null> = [
  "calendar", // top
  "clock",    // top-right
  "finance",  // bottom-right
  null,       // bottom      — coming soon
  "notes",    // bottom-left
  null,       // top-left    — coming soon
];

// Hub geometry for full-bleed Colmeia artwork.
const HUB_W = 360;
const HUB_H = 426;
const CELL = 100;
const C_CELL = 118;
const ICON_ZOOM = 1.12;
const CENTER_ICON_ZOOM = 1;
const CENTER_POS = { left: 121, top: 150 };
const TOOL_POSITIONS: Partial<Record<ToolId, { left: number; top: number }>> = {
  calendar: { left: 130, top: 18 },
  notes: { left: 14, top: 166 },
  clock: { left: 246, top: 166 },
  finance: { left: 130, top: 306 },
};

function ColmeiaHub({ onSelect }: { onSelect: (id: ToolId) => void }) {
  return (
    <div className="relative mx-auto" style={{ width: HUB_W, height: HUB_H }}>
      {/* Center Bee */}
      <div
        className="absolute"
        style={{
          width: C_CELL, height: C_CELL,
          left: CENTER_POS.left, top: CENTER_POS.top,
          borderRadius: 28,
          border: "1px solid rgba(255,217,64,0.42)",
          boxShadow: "0 18px 38px -24px rgba(89,58,0,0.55), 0 0 24px 3px rgba(255,217,64,0.24)",
          overflow: "hidden",
        }}
      >
        <img
          src="/icons-colmeia/icone-central.png"
          alt="Bee"
          style={{ width: "100%", height: "100%", objectFit: "contain", transform: `scale(${CENTER_ICON_ZOOM})` }}
        />
      </div>

      {/* Tool cells — only tools that have a hub position */}
      {COLMEIA_TOOLS.filter((tool) => tool.id in TOOL_POSITIONS).map((tool) => {
        const pos = TOOL_POSITIONS[tool.id as keyof typeof TOOL_POSITIONS]!;
        return (
          <button
            key={tool.id}
            onClick={() => onSelect(tool.id)}
            className="absolute transition-transform hover:scale-105 active:scale-95"
            style={{
              width: CELL, height: CELL,
              left: pos.left, top: pos.top,
              borderRadius: 24,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.42)",
              boxShadow: `0 18px 34px -24px ${tool.color}, 0 0 16px 2px ${tool.color}24`,
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            {tool.src ? (
              <img
                src={tool.src}
                alt={tool.label}
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${ICON_ZOOM})` }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ color: tool.color }}>
                {tool.icon}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Calendar Section ──────────────────────────────────────────────────────────

function CalendarSection({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean } | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", startAt: "", endAt: "", location: "", allDay: false });
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfMonth(currentMonth).toISOString();
      const to = endOfMonth(currentMonth).toISOString();
      const res = await fetch(`/api/colmeia/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: authHeaders() });
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, [currentMonth, authHeaders]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    fetch("/api/colmeia/google/status", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setGoogleStatus(d))
      .catch(() => {});
  }, [authHeaders]);

  // Detect Google OAuth return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("colmeia") === "google_ok") {
      setGoogleStatus({ connected: true });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    try {
      const res = await fetch("/api/colmeia/google/auth-url", { headers: authHeaders() });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } finally {
      setConnectingGoogle(false);
    }
  }

  async function handleDisconnectGoogle() {
    await fetch("/api/colmeia/google/disconnect", { method: "DELETE", headers: authHeaders() });
    setGoogleStatus({ connected: false });
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startAt) return;
    setSaving(true);
    try {
      const res = await fetch("/api/colmeia/events", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ title: "", description: "", startAt: "", endAt: "", location: "", allDay: false });
        await fetchEvents();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    await fetch(`/api/colmeia/events/${id}`, { method: "DELETE", headers: authHeaders() });
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  const monthStart = startOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = addDays(endOfMonth(currentMonth), 6 - endOfMonth(currentMonth).getDay());
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const dayEvents = selectedDay ? events.filter(e => isSameDay(parseISO(e.startAt), selectedDay)) : [];
  const upcomingEvents = events.filter(e => new Date(e.startAt) >= new Date()).slice(0, 5);

  return (
    <div className="p-4 space-y-4">
      {/* Google Calendar connect */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2">
          <img src="https://www.gstatic.com/images/branding/product/2x/calendar_48dp.png" className="w-5 h-5" alt="Google Calendar" />
          <div>
            <p className="text-xs font-semibold">Google Calendar</p>
            <p className="text-[10px] text-muted-foreground">{googleStatus?.connected ? "Conectado — eventos sincronizados" : "Conecte para sincronizar"}</p>
          </div>
        </div>
        {googleStatus?.connected ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <button onClick={handleDisconnectGoogle} className="text-[10px] text-muted-foreground hover:text-destructive">Desconectar</button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleConnectGoogle} disabled={connectingGoogle}>
            {connectingGoogle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
            Conectar
          </Button>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1 rounded hover:bg-muted">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-sm capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1 rounded hover:bg-muted">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calDays.map(day => {
            const hasEvent = events.some(e => isSameDay(parseISO(e.startAt), day));
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isToday = isSameDay(day, new Date());
            const inMonth = isSameMonth(day, currentMonth);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(-1)) ? null : day)}
                className={`relative aspect-square flex flex-col items-center justify-center text-xs transition-colors
                  ${!inMonth ? "text-muted-foreground/30" : ""}
                  ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 font-bold" : "hover:bg-muted/50"}
                `}
              >
                {format(day, "d")}
                {hasEvent && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      {selectedDay && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}</h3>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
              setForm(f => ({ ...f, startAt: format(selectedDay, "yyyy-MM-dd") + "T09:00" }));
              setShowForm(true);
            }}>
              Evento
            </Button>
          </div>
          {dayEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum evento neste dia</p>
          ) : dayEvents.map(ev => (
            <div key={ev.id} className="flex items-start gap-2 p-3 rounded-xl border border-border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{ev.title}</p>
                  {ev.googleEventId && <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />}
                </div>
                {ev.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>}
                {ev.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{ev.location}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {ev.allDay ? "Dia inteiro" : format(parseISO(ev.startAt), "HH:mm") + (ev.endAt ? " – " + format(parseISO(ev.endAt), "HH:mm") : "")}
                </p>
              </div>
              <button onClick={() => handleDeleteEvent(ev.id)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming events */}
      {!selectedDay && upcomingEvents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Próximos eventos</h3>
          {upcomingEvents.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="text-center min-w-[36px]">
                <p className="text-xs font-bold text-primary">{format(parseISO(ev.startAt), "dd")}</p>
                <p className="text-[9px] text-muted-foreground uppercase">{format(parseISO(ev.startAt), "MMM", { locale: ptBR })}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ev.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ev.allDay ? "Dia inteiro" : format(parseISO(ev.startAt), "HH:mm")}
                  {ev.location ? ` · ${ev.location}` : ""}
                </p>
              </div>
              <button onClick={() => handleDeleteEvent(ev.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add event button */}
      {!selectedDay && !showForm && (
        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
          Novo evento
        </Button>
      )}

      {/* Event form */}
      {showForm && (
        <form onSubmit={handleSaveEvent} className="space-y-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Novo evento</h3>
            <button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <Input placeholder="Título do evento *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Início *</label>
              <Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
              <Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
            </div>
          </div>
          <Input placeholder="Local (opcional)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="min-h-[60px] resize-none text-sm" />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      )}

      {loading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
    </div>
  );
}

// ── Finance Section ───────────────────────────────────────────────────────────

function FinanceSection({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "expense" as "income" | "expense", amount: "", category: "Alimentação", description: "", date: format(new Date(), "yyyy-MM-dd") });

  const fetchFinance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/colmeia/finance?month=${month}&year=${year}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setSummary(data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [month, year, authHeaders]);

  useEffect(() => { fetchFinance(); }, [fetchFinance]);

  const monthName = format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: ptBR });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.category) return;
    setSaving(true);
    try {
      const res = await fetch("/api/colmeia/finance", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ type: "expense", amount: "", category: "Alimentação", description: "", date: format(new Date(), "yyyy-MM-dd") });
        await fetchFinance();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/colmeia/finance/${id}`, { method: "DELETE", headers: authHeaders() });
    await fetchFinance();
  }

  const categories = form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="p-4 space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => { const d = new Date(year, month - 2, 1); setMonth(d.getMonth() + 1); setYear(d.getFullYear()); }} className="p-1 rounded hover:bg-muted">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-sm capitalize">{monthName}</span>
        <button onClick={() => { const d = new Date(year, month, 1); setMonth(d.getMonth() + 1); setYear(d.getFullYear()); }} className="p-1 rounded hover:bg-muted">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl border border-border bg-card text-center">
            <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">Receitas</p>
            <p className="text-xs font-bold text-green-600">{fmtCents(summary.totalIncome)}</p>
          </div>
          <div className="p-3 rounded-xl border border-border bg-card text-center">
            <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">Despesas</p>
            <p className="text-xs font-bold text-red-600">{fmtCents(summary.totalExpense)}</p>
          </div>
          <div className={`p-3 rounded-xl border bg-card text-center ${summary.balance >= 0 ? "border-green-200" : "border-red-200"}`}>
            <DollarSign className={`w-4 h-4 mx-auto mb-1 ${summary.balance >= 0 ? "text-green-500" : "text-red-500"}`} />
            <p className="text-[10px] text-muted-foreground">Saldo</p>
            <p className={`text-xs font-bold ${summary.balance >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtCents(summary.balance)}</p>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {summary && Object.keys(summary.byCategory).length > 0 && (
        <div className="p-3 rounded-xl border border-border bg-card space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Despesas por categoria</h3>
          {Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, cents]) => {
            const pct = summary.totalExpense > 0 ? (cents / summary.totalExpense) * 100 : 0;
            return (
              <div key={cat} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span>{cat}</span>
                  <span className="font-medium">{fmtCents(cents)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] ?? "#6B7280" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add transaction button */}
      {!showForm && (
        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
          Nova transação
        </Button>
      )}

      {/* Transaction form */}
      {showForm && (
        <form onSubmit={handleSave} className="space-y-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Nova transação</h3>
            <button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="flex gap-2">
            {(["expense", "income"] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, type: t, category: t === "expense" ? "Alimentação" : "Salário" }))}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${form.type === t ? (t === "expense" ? "bg-red-500 text-white border-red-500" : "bg-green-500 text-white border-green-500") : "border-border text-muted-foreground"}`}>
                {t === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>
          <Input type="number" step="0.01" min="0.01" placeholder="Valor (R$) *" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <Input placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      )}

      {/* Transaction list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Nenhuma transação neste mês.<br />A Bee pode registrar automaticamente quando você mencionar no chat!</p>
        ) : transactions.map(tx => (
          <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: (CATEGORY_COLORS[tx.category] ?? "#6B7280") + "22" }}>
              <span className="text-xs" style={{ color: CATEGORY_COLORS[tx.category] ?? "#6B7280" }}>
                {tx.type === "income" ? "↑" : "↓"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{tx.description ?? tx.category}</p>
              <p className="text-[10px] text-muted-foreground">{tx.category} · {format(parseISO(tx.date), "dd/MM")}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                {tx.type === "income" ? "+" : "-"}{fmtCents(tx.amountCents)}
              </p>
            </div>
            <button onClick={() => handleDelete(tx.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notes Section ─────────────────────────────────────────────────────────────

const NOTE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  default: { bg: "",        border: "",        dot: "#94a3b8" },
  yellow:  { bg: "#fefce8", border: "#fde047", dot: "#fde047" },
  blue:    { bg: "#eff6ff", border: "#bfdbfe", dot: "#93c5fd" },
  green:   { bg: "#f0fdf4", border: "#bbf7d0", dot: "#86efac" },
  pink:    { bg: "#fdf2f8", border: "#fbcfe8", dot: "#f9a8d4" },
};

const COLOR_OPTIONS = Object.keys(NOTE_COLORS);

function NotesSection({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("default");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/colmeia/notes", { headers: authHeaders() });
      if (res.ok) setNotesList(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/colmeia/notes", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent.trim(), title: newTitle.trim() || null, color: newColor }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotesList((prev) => [note, ...prev]);
        setNewContent(""); setNewTitle(""); setNewColor("default"); setShowAdd(false);
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api/colmeia/notes/${id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim(), title: editTitle.trim() || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setNotesList((prev) => prev.map((n) => n.id === id ? updated : n));
        setEditingId(null);
      }
    } catch { /* ignore */ }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const res = await fetch(`/api/colmeia/notes/${note.id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      if (res.ok) {
        const updated = await res.json();
        setNotesList((prev) =>
          [...prev.map((n) => n.id === note.id ? updated : n)]
            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/colmeia/notes/${id}`, { method: "DELETE", headers: authHeaders() });
      setNotesList((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div className="p-4 space-y-3">
      {/* Add button */}
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-sm"
        >
          Nova nota
        </button>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2 shadow-sm">
          <Input
            placeholder="Título (opcional)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
          />
          <Textarea
            placeholder="Escreva sua nota..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="text-sm resize-none min-h-[80px]"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cor:</span>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{ backgroundColor: NOTE_COLORS[c].dot }}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${newColor === c ? "scale-125 border-foreground" : "border-transparent"}`}
              />
            ))}
            <div className="flex-1" />
            <button onClick={() => { setShowAdd(false); setNewContent(""); setNewTitle(""); setNewColor("default"); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            <button
              onClick={handleAdd}
              disabled={!newContent.trim() || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center pt-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : notesList.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-10">
          <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Nenhuma nota ainda</p>
          <p className="text-xs mt-1">Diga à Bee "anota isso" no chat ou crie manualmente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {notesList.map((note) => {
            const nc = NOTE_COLORS[note.color] ?? NOTE_COLORS.default;
            const isEditing = editingId === note.id;
            return (
              <div key={note.id} className="rounded-xl border p-3" style={nc.bg ? { backgroundColor: nc.bg, borderColor: nc.border } : undefined}>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título"
                      className="h-7 text-sm"
                    />
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="text-sm resize-none min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                      <button
                        onClick={() => handleSaveEdit(note.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                      >
                        <Check className="w-3 h-3" /> Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        {note.title && <p className="text-xs font-semibold truncate">{note.title}</p>}
                        <p className="text-sm whitespace-pre-wrap break-words">{note.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button onClick={() => handleTogglePin(note)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={note.pinned ? "Desafixar" : "Fixar"}>
                          {note.pinned ? <Pin className="w-3.5 h-3.5 text-primary" /> : <PinOff className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <button onClick={() => { setEditingId(note.id); setEditContent(note.content); setEditTitle(note.title ?? ""); }} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(note.id)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(note.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

function alarmKindLabel(kind: AlarmReminder["kind"]) {
  if (kind === "medicine") return "Remedio";
  if (kind === "appointment") return "Compromisso";
  return "Despertador";
}

function alarmRepeatLabel(alarm: AlarmReminder) {
  if (alarm.repeatDays?.length) {
    return alarm.repeatDays
      .map((day) => WEEK_DAYS.find((item) => item.value === day)?.label)
      .filter(Boolean)
      .join(", ");
  }
  if (alarm.repeatType === "daily") return "Diario";
  if (alarm.repeatType === "weekly") return "Semanal";
  if (alarm.repeatType === "interval") return `A cada ${alarm.intervalMinutes ?? 60} min`;
  return "Uma vez";
}

function alarmBody(alarm: AlarmReminder) {
  if (alarm.message?.trim()) return alarm.message.trim();
  if (alarm.kind === "medicine") return `Hora de tomar: ${alarm.title}`;
  if (alarm.kind === "appointment") return `Compromisso agora: ${alarm.title}`;
  return alarm.title;
}

function playWebAlarmFeedback(alarm: AlarmReminder) {
  try { navigator.vibrate?.([700, 200, 700, 200, 700]); } catch { /* ignore */ }
  try {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioCtor();
    [0, 0.85, 1.7].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.55);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.6);
    });
  } catch { /* ignore */ }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`BeeEyes - ${alarmKindLabel(alarm.kind)}`, {
      body: alarmBody(alarm),
      tag: `bee-alarm-${alarm.id}`,
      requireInteraction: true,
    });
  }
}

function ClockSection({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [alarms, setAlarms] = useState<AlarmReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [form, setForm] = useState({
    title: "",
    message: "",
    kind: "alarm" as AlarmReminder["kind"],
    scheduledAt: "",
    repeatDays: [] as number[],
  });

  const loadAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/colmeia/alarms", { headers: authHeaders() });
      if (res.ok) setAlarms(await res.json());
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadAlarms(); }, [loadAlarms]);

  useEffect(() => {
    const timers = alarms.flatMap((alarm) => {
      if (!alarm.active) return [];
      const delay = new Date(alarm.nextTriggerAt).getTime() - Date.now();
      if (delay < 0 || delay > 24 * 60 * 60 * 1000) return [];
      return [window.setTimeout(() => {
        playWebAlarmFeedback(alarm);
        fetch("/api/colmeia/alarms/due", { method: "POST", headers: authHeaders() })
          .then(() => loadAlarms())
          .catch(() => {});
      }, delay)];
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [alarms, authHeaders, loadAlarms]);

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const createAlarm = async () => {
    if (!form.title.trim() || !form.scheduledAt || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/colmeia/alarms", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          message: form.message.trim() || null,
          kind: form.kind,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          repeatType: form.repeatDays.length > 0 ? "weekly" : "once",
          repeatDays: form.repeatDays,
          intervalMinutes: null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ title: "", message: "", kind: "alarm", scheduledAt: "", repeatDays: [] });
        await loadAlarms();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleAlarm = async (alarm: AlarmReminder) => {
    await fetch(`/api/colmeia/alarms/${alarm.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ active: !alarm.active }),
    });
    await loadAlarms();
  };

  const deleteAlarm = async (id: string) => {
    await fetch(`/api/colmeia/alarms/${id}`, { method: "DELETE", headers: authHeaders() });
    setAlarms((prev) => prev.filter((alarm) => alarm.id !== id));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Relogio inteligente</p>
            <p className="text-xs text-muted-foreground mt-1">Alarmes, remedios e compromissos com aviso, som e vibracao.</p>
          </div>
          <Clock className="w-5 h-5 text-primary shrink-0" />
        </div>
        <div className="flex gap-2">
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <Button size="sm" variant="outline" className="text-xs flex-1" onClick={requestNotifications}>Ativar avisos</Button>
          )}
          <Button size="sm" className="text-xs flex-1" onClick={() => setShowForm((value) => !value)}>
            Novo alarme
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div className="grid grid-cols-3 gap-1">
            {(["alarm", "medicine", "appointment"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, kind }))}
                className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${form.kind === kind ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
              >
                {kind === "medicine" ? <Pill className="w-3.5 h-3.5" /> : kind === "appointment" ? <Briefcase className="w-3.5 h-3.5" /> : <BellRing className="w-3.5 h-3.5" />}
                {alarmKindLabel(kind)}
              </button>
            ))}
          </div>
          <Input placeholder="Nome do aviso" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          <Textarea placeholder="Mensagem opcional" value={form.message} onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))} className="min-h-[64px] resize-none text-sm" />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data e hora</label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Repeticao</label>
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day) => {
                const selected = form.repeatDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      repeatDays: selected
                        ? prev.repeatDays.filter((value) => value !== day.value)
                        : [...prev.repeatDays, day.value].sort((a, b) => a - b),
                    }))}
                    className={`h-9 rounded-lg border text-[11px] font-semibold transition-colors ${selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
                    aria-pressed={selected}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sem dias marcados, o alarme toca apenas uma vez.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="flex-1" disabled={!form.title.trim() || !form.scheduledAt || saving} onClick={createAlarm}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : alarms.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <BellRing className="w-9 h-9 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold">Nenhum alarme criado</p>
          <p className="text-xs mt-1">Crie avisos para remedios, horarios e compromissos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alarms.map((alarm) => (
            <div key={alarm.id} className={`rounded-xl border p-3 bg-card ${alarm.active ? "border-border" : "border-border/60 opacity-70"}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                  {alarm.kind === "medicine" ? <Pill className="w-4 h-4" /> : alarm.kind === "appointment" ? <Briefcase className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{alarm.title}</p>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{alarmRepeatLabel(alarm)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{alarmBody(alarm)}</p>
                  <p className="text-xs font-mono mt-2">
                    {alarm.active ? "Proximo: " : "Pausado - era: "}
                    {new Date(alarm.nextTriggerAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 rounded-lg hover:bg-muted" onClick={() => toggleAlarm(alarm)} aria-label={alarm.active ? "Pausar" : "Ativar"}>
                    {alarm.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button className="p-2 rounded-lg hover:bg-muted" onClick={() => deleteAlarm(alarm.id)} aria-label="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Health Coach Section ───────────────────────────────────────────────────────

type GoalType = "lose_weight" | "gain_muscle" | "maintain" | "improve_fitness";
type FitnessLevel = "beginner" | "intermediate" | "advanced";

interface HealthProfile { goal: GoalType; fitnessLevel: FitnessLevel; completedAt: string }
interface Exercise { name: string; sets?: number; reps?: string; durationMin?: number; notes?: string }
interface WorkoutDay { dayOfWeek: number; label: string; type: "rest" | "training"; focus?: string; exercises: Exercise[] }
interface DailyCheckin { date: string; sleepHours: number; mood: 1|2|3|4|5; energyLevel: 1|2|3|4|5 }
interface HealthyHabit { id: string; label: string; icon: string; completedDates: string[] }

const H = {
  profile: "bee_health_profile",
  plan: "bee_health_workout_plan",
  water: "bee_health_water_log",
  checkin: "bee_health_checkin",
  habits: "bee_health_habits",
};

const GOAL_OPTS: { value: GoalType; label: string; emoji: string; desc: string }[] = [
  { value: "lose_weight",      label: "Perder peso",               emoji: "🔥", desc: "Reduzir gordura corporal com saúde" },
  { value: "gain_muscle",      label: "Ganhar músculo",            emoji: "💪", desc: "Aumentar massa muscular e força" },
  { value: "maintain",         label: "Manter forma",              emoji: "⚖️", desc: "Manter peso e condicionamento" },
  { value: "improve_fitness",  label: "Melhorar condicionamento",  emoji: "🏃", desc: "Aumentar resistência e energia" },
];

const LEVEL_OPTS: { value: FitnessLevel; label: string; desc: string }[] = [
  { value: "beginner",     label: "Iniciante",      desc: "Pouca ou nenhuma experiência com exercícios" },
  { value: "intermediate", label: "Intermediário",  desc: "Pratica exercícios ocasionalmente" },
  { value: "advanced",     label: "Avançado",       desc: "Treina regularmente há mais de 1 ano" },
];

const DEFAULT_HABITS: HealthyHabit[] = [
  { id: "water",   label: "Hidratação (8 copos)",   icon: "💧", completedDates: [] },
  { id: "sleep",   label: "Dormir 7-9 horas",       icon: "😴", completedDates: [] },
  { id: "steps",   label: "10.000 passos",           icon: "👟", completedDates: [] },
  { id: "fruit",   label: "Comer frutas/legumes",    icon: "🥦", completedDates: [] },
  { id: "stretch", label: "Alongamento diário",      icon: "🧘", completedDates: [] },
];

// TODO: replace with POST /api/health/workout-plan
function generateWorkoutPlan(goal: GoalType, level: FitnessLevel): WorkoutDay[] {
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const rest = (d: number): WorkoutDay => ({ dayOfWeek: d, label: labels[d], type: "rest", exercises: [] });
  const train = (d: number, focus: string, exercises: Exercise[]): WorkoutDay => ({ dayOfWeek: d, label: labels[d], type: "training", focus, exercises });

  const ex = (name: string, opts?: Partial<Exercise>): Exercise => ({ name, ...opts });

  const plans: Record<GoalType, Record<FitnessLevel, WorkoutDay[]>> = {
    lose_weight: {
      beginner: [
        rest(0),
        train(1, "Cardio leve", [ex("Caminhada rápida", { durationMin: 30 }), ex("Agachamento", { sets: 3, reps: "12" })]),
        rest(2),
        train(3, "Full body", [ex("Flexão de joelho", { sets: 3, reps: "10" }), ex("Prancha", { durationMin: 1 })]),
        rest(4),
        train(5, "Cardio + Core", [ex("Polichinelo", { sets: 3, reps: "30" }), ex("Abdominal", { sets: 3, reps: "15" })]),
        rest(6),
      ],
      intermediate: [
        rest(0),
        train(1, "Cardio HIIT", [ex("Corrida intervalada", { durationMin: 25 }), ex("Burpee", { sets: 4, reps: "12" })]),
        train(2, "Membros inferiores", [ex("Agachamento", { sets: 4, reps: "15" }), ex("Avanço", { sets: 3, reps: "12 cada" })]),
        rest(3),
        train(4, "Membros superiores", [ex("Flexão", { sets: 4, reps: "15" }), ex("Remada com elástico", { sets: 3, reps: "15" })]),
        train(5, "Cardio + Core", [ex("Pular corda", { durationMin: 20 }), ex("Prancha lateral", { durationMin: 2 })]),
        rest(6),
      ],
      advanced: [
        train(0, "HIIT intenso", [ex("Sprint 400m", { sets: 6, reps: "1" }), ex("Burpee", { sets: 5, reps: "15" })]),
        train(1, "Membros inferiores", [ex("Agachamento profundo", { sets: 5, reps: "15" }), ex("Stiff", { sets: 4, reps: "12" })]),
        rest(2),
        train(3, "Membros superiores", [ex("Flexão com palma", { sets: 4, reps: "15" }), ex("Barra", { sets: 4, reps: "máximo" })]),
        train(4, "Core", [ex("Dragon flag", { sets: 3, reps: "8" }), ex("Prancha avançada", { durationMin: 3 })]),
        train(5, "Full body", [ex("Circuito 5 exercícios", { sets: 4, reps: "15 cada" })]),
        rest(6),
      ],
    },
    gain_muscle: {
      beginner: [
        rest(0),
        train(1, "Peito e Tríceps", [ex("Flexão", { sets: 3, reps: "8-10" }), ex("Mergulho entre cadeiras", { sets: 3, reps: "8" })]),
        rest(2),
        train(3, "Costas e Bíceps", [ex("Remada com mochila", { sets: 3, reps: "10" }), ex("Rosca com garrafa", { sets: 3, reps: "12" })]),
        rest(4),
        train(5, "Pernas", [ex("Agachamento", { sets: 3, reps: "12" }), ex("Ponte glúteo", { sets: 3, reps: "15" })]),
        rest(6),
      ],
      intermediate: [
        rest(0),
        train(1, "Peito", [ex("Flexão inclinada", { sets: 4, reps: "12" }), ex("Flexão declinada", { sets: 3, reps: "10" })]),
        train(2, "Costas", [ex("Barra", { sets: 4, reps: "8" }), ex("Remada curvada", { sets: 3, reps: "12" })]),
        rest(3),
        train(4, "Ombros + Braços", [ex("Desenvolvimento", { sets: 3, reps: "12" }), ex("Rosca direta", { sets: 3, reps: "12" })]),
        train(5, "Pernas", [ex("Agachamento", { sets: 4, reps: "12" }), ex("Leg press", { sets: 4, reps: "15" })]),
        rest(6),
      ],
      advanced: [
        train(0, "Peito", [ex("Supino reto", { sets: 5, reps: "8" }), ex("Cross-over", { sets: 4, reps: "12" })]),
        train(1, "Costas", [ex("Barra pronada", { sets: 5, reps: "6-8" }), ex("Remada baixa", { sets: 4, reps: "10" })]),
        rest(2),
        train(3, "Pernas", [ex("Agachamento frontal", { sets: 5, reps: "8" }), ex("Leg press", { sets: 4, reps: "12" })]),
        train(4, "Ombros", [ex("Desenvolvimento militar", { sets: 4, reps: "10" }), ex("Elevação lateral", { sets: 4, reps: "15" })]),
        train(5, "Braços", [ex("Rosca Scott", { sets: 4, reps: "10" }), ex("Tríceps coice", { sets: 4, reps: "12" })]),
        rest(6),
      ],
    },
    maintain: {
      beginner: [
        rest(0),
        train(1, "Cardio", [ex("Caminhada", { durationMin: 30 })]),
        rest(2),
        train(3, "Full body", [ex("Agachamento", { sets: 2, reps: "12" }), ex("Flexão", { sets: 2, reps: "10" })]),
        rest(4),
        train(5, "Cardio + Flex", [ex("Ciclismo leve", { durationMin: 30 }), ex("Yoga básica", { durationMin: 15 })]),
        rest(6),
      ],
      intermediate: [
        rest(0),
        train(1, "Full body", [ex("Agachamento", { sets: 3, reps: "12" }), ex("Flexão", { sets: 3, reps: "12" }), ex("Remada", { sets: 3, reps: "12" })]),
        train(2, "Cardio", [ex("Corrida leve", { durationMin: 30 })]),
        rest(3),
        train(4, "Full body", [ex("Agachamento sumo", { sets: 3, reps: "12" }), ex("Flexão larga", { sets: 3, reps: "12" })]),
        train(5, "Cardio + Core", [ex("Natação ou ciclismo", { durationMin: 40 }), ex("Prancha", { durationMin: 2 })]),
        rest(6),
      ],
      advanced: [
        train(0, "Full body", [ex("Agachamento", { sets: 4, reps: "15" }), ex("Flexão", { sets: 4, reps: "20" })]),
        train(1, "Cardio moderado", [ex("Corrida contínua", { durationMin: 45 })]),
        rest(2),
        train(3, "Força", [ex("Barra", { sets: 4, reps: "10" }), ex("Agachamento livre", { sets: 4, reps: "10" })]),
        train(4, "Cardio HIIT", [ex("Corrida intervalada", { durationMin: 30 })]),
        train(5, "Mobilidade", [ex("Yoga avançada", { durationMin: 45 })]),
        rest(6),
      ],
    },
    improve_fitness: {
      beginner: [
        rest(0),
        train(1, "Cardio", [ex("Caminhada rápida", { durationMin: 20 }), ex("Alongamento", { durationMin: 10 })]),
        rest(2),
        train(3, "Funcional", [ex("Agachamento", { sets: 3, reps: "10" }), ex("Mountain climber", { sets: 2, reps: "20" })]),
        rest(4),
        train(5, "Cardio", [ex("Dança ou aeróbica", { durationMin: 30 })]),
        rest(6),
      ],
      intermediate: [
        rest(0),
        train(1, "Cardio + Força", [ex("Corrida", { durationMin: 25 }), ex("Agachamento + Salto", { sets: 3, reps: "12" })]),
        train(2, "Funcional", [ex("Burpee", { sets: 3, reps: "10" }), ex("Prancha", { durationMin: 2 })]),
        rest(3),
        train(4, "Cardio", [ex("Ciclismo ou natação", { durationMin: 40 })]),
        train(5, "Full body", [ex("Flexão", { sets: 3, reps: "15" }), ex("Agachamento", { sets: 3, reps: "15" }), ex("Barra", { sets: 3, reps: "máximo" })]),
        rest(6),
      ],
      advanced: [
        train(0, "Resistência", [ex("Corrida longa", { durationMin: 60 })]),
        train(1, "HIIT", [ex("Tabata (8 rounds)", { durationMin: 20 })]),
        rest(2),
        train(3, "Força + Cardio", [ex("Barra", { sets: 4, reps: "8" }), ex("Corrida 5km", { durationMin: 30 })]),
        train(4, "HIIT", [ex("Sprint 200m", { sets: 8, reps: "1" })]),
        train(5, "Full body", [ex("Circuito avançado", { sets: 5, reps: "15" })]),
        rest(6),
      ],
    },
  };

  return plans[goal]?.[level] ?? plans.improve_fitness.beginner;
}

function HealthCoachSection() {
  const [profile, setProfile] = useState<HealthProfile | null>(() => {
    try { return JSON.parse(localStorage.getItem(H.profile) ?? "null"); } catch { return null; }
  });
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutDay[]>(() => {
    try { return JSON.parse(localStorage.getItem(H.plan) ?? "[]"); } catch { return []; }
  });
  const [waterMl, setWaterMl] = useState<number>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(H.water) ?? "null");
      return data?.date === new Date().toISOString().slice(0, 10) ? data.ml : 0;
    } catch { return 0; }
  });
  const [habits, setHabits] = useState<HealthyHabit[]>(() => {
    try { return JSON.parse(localStorage.getItem(H.habits) ?? "null") ?? DEFAULT_HABITS; } catch { return DEFAULT_HABITS; }
  });
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkin, setCheckin] = useState<DailyCheckin>({ date: new Date().toISOString().slice(0, 10), sleepHours: 7, mood: 3, energyLevel: 3 });
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [expandedWorkout, setExpandedWorkout] = useState(false);
  const [onboardStep, setOnboardStep] = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayWorkout = workoutPlan.find((d) => d.dayOfWeek === new Date().getDay());

  function saveProfile(goal: GoalType, level: FitnessLevel) {
    const p: HealthProfile = { goal, fitnessLevel: level, completedAt: new Date().toISOString() };
    const plan = generateWorkoutPlan(goal, level);
    localStorage.setItem(H.profile, JSON.stringify(p));
    localStorage.setItem(H.plan, JSON.stringify(plan));
    setProfile(p);
    setWorkoutPlan(plan);
  }

  function addWater(ml: number) {
    const next = Math.min(waterMl + ml, 2000);
    setWaterMl(next);
    localStorage.setItem(H.water, JSON.stringify({ date: today, ml: next }));
  }

  function resetWater() {
    setWaterMl(0);
    localStorage.setItem(H.water, JSON.stringify({ date: today, ml: 0 }));
  }

  function toggleHabit(id: string) {
    const updated = habits.map((h) =>
      h.id !== id ? h : {
        ...h,
        completedDates: h.completedDates.includes(today)
          ? h.completedDates.filter((d) => d !== today)
          : [...h.completedDates, today],
      }
    );
    setHabits(updated);
    localStorage.setItem(H.habits, JSON.stringify(updated));
  }

  function saveCheckin() {
    localStorage.setItem(H.checkin, JSON.stringify(checkin));
    setCheckinSaved(true);
    setTimeout(() => { setCheckinSaved(false); setShowCheckin(false); }, 1500);
  }

  // Onboarding — step 1: goal
  if (!profile) {
    if (onboardStep === 1) {
      return (
        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-lg font-black">Coach de Saúde 💚</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Qual é seu principal objetivo de saúde?
            </p>
          </div>
          <div className="space-y-2">
            {GOAL_OPTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSelectedGoal(opt.value); setOnboardStep(2); }}
                className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <span className="text-2xl">{opt.emoji}</span>
                <div>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }
    // Step 2: fitness level
    return (
      <div className="p-5 space-y-5">
        <div>
          <button onClick={() => setOnboardStep(1)} className="text-xs text-primary mb-3 hover:underline">← Voltar</button>
          <h3 className="text-lg font-black">Nível de condicionamento</h3>
          <p className="text-sm text-muted-foreground mt-1">Isso calibra a intensidade dos treinos.</p>
        </div>
        <div className="space-y-2">
          {LEVEL_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => saveProfile(selectedGoal!, opt.value)}
              className="w-full flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <p className="font-semibold text-sm">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const waterPct = (waterMl / 2000) * 100;
  const goalLabel = GOAL_OPTS.find((g) => g.value === profile.goal)?.label ?? "";
  const levelLabel = LEVEL_OPTS.find((l) => l.value === profile.fitnessLevel)?.label ?? "";

  return (
    <div className="p-5 space-y-4">
      {/* Profile badge */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-base">Coach de Saúde 💚</h3>
          <p className="text-xs text-muted-foreground">{goalLabel} · {levelLabel}</p>
        </div>
        <button
          onClick={() => { localStorage.removeItem(H.profile); setProfile(null); setOnboardStep(1); }}
          className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-full px-2 py-1 transition-colors"
        >
          Reconfigurar
        </button>
      </div>

      {/* Today's workout */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4"
          onClick={() => setExpandedWorkout((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{todayWorkout?.type === "rest" ? "😴" : "🏋️"}</span>
            <div className="text-left">
              <p className="font-semibold text-sm">
                {todayWorkout?.type === "rest" ? "Dia de descanso" : `Treino de hoje — ${todayWorkout?.focus}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {todayWorkout?.type === "rest" ? "Descanse e recupere" : `${todayWorkout?.exercises.length} exercício(s)`}
              </p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedWorkout ? "rotate-180" : ""}`} />
        </button>
        {expandedWorkout && (todayWorkout?.exercises.length ?? 0) > 0 && (
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            {todayWorkout!.exercises.map((ex, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{ex.name}</p>
                <p className="text-xs text-muted-foreground shrink-0">
                  {ex.durationMin ? `${ex.durationMin} min` : `${ex.sets}x${ex.reps}`}
                  {ex.notes ? ` (${ex.notes})` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Water tracker */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">💧 Hidratação</p>
          <p className="text-sm font-bold text-primary">{waterMl} / 2000 ml</p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${waterPct}%` }} />
        </div>
        <div className="flex gap-2">
          {[150, 250, 350].map((ml) => (
            <button
              key={ml}
              onClick={() => addWater(ml)}
              disabled={waterMl >= 2000}
              className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 transition-colors disabled:opacity-40"
            >
              +{ml}ml
            </button>
          ))}
          <button
            onClick={resetWater}
            className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
            title="Resetar"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Daily check-in */}
      <button
        onClick={() => setShowCheckin(true)}
        className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <p className="font-semibold text-sm">📊 Check-in diário</p>
        <p className="text-xs text-muted-foreground mt-0.5">Registre seu sono, humor e energia de hoje</p>
      </button>

      {/* Habits */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="font-semibold text-sm">✅ Hábitos saudáveis</p>
        <div className="space-y-2">
          {habits.map((h) => {
            const done = h.completedDates.includes(today);
            return (
              <button key={h.id} onClick={() => toggleHabit(h.id)} className="w-full flex items-center gap-3 text-left">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${done ? "bg-primary border-primary" : "border-border"}`}>
                  {done && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="text-sm">{h.icon} {h.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Safety disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Este plano é uma sugestão educativa geral. Consulte um profissional de saúde ou educador físico antes de
          iniciar qualquer rotina de exercícios, especialmente se tiver condições médicas preexistentes.
        </p>
      </div>

      {/* Check-in modal */}
      {showCheckin && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm p-0 md:p-4">
          <div className="w-full md:max-w-sm rounded-t-2xl md:rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Check-in de Hoje</h3>
              <button onClick={() => setShowCheckin(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">😴 Horas de sono: {checkin.sleepHours}h</p>
                <input type="range" min={4} max={12} step={0.5} value={checkin.sleepHours}
                  onChange={(e) => setCheckin((c) => ({ ...c, sleepHours: Number(e.target.value) }))} className="w-full" />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">😊 Humor: {["", "😢", "😕", "😐", "🙂", "😁"][checkin.mood]}</p>
                <input type="range" min={1} max={5} step={1} value={checkin.mood}
                  onChange={(e) => setCheckin((c) => ({ ...c, mood: Number(e.target.value) as 1|2|3|4|5 }))} className="w-full" />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">⚡ Energia: {["", "🪫", "😴", "⚡", "🔋", "🚀"][checkin.energyLevel]}</p>
                <input type="range" min={1} max={5} step={1} value={checkin.energyLevel}
                  onChange={(e) => setCheckin((c) => ({ ...c, energyLevel: Number(e.target.value) as 1|2|3|4|5 }))} className="w-full" />
              </div>
            </div>
            <button
              onClick={saveCheckin}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {checkinSaved ? "✓ Salvo!" : "Registrar check-in"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ColmeiaPanel({ authHeaders }: ColmeiaPanelProps) {
  const [activeSection, setActiveSection] = useState<ToolId | null>(null);
  const activeTool = activeSection ? COLMEIA_TOOLS.find(t => t.id === activeSection) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bee-honeycomb shrink-0 px-4 pt-4 pb-3 flex items-center gap-3 border-b border-border/50 bg-card/55">
        {activeSection ? (
          <button
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 hover:opacity-75 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: activeTool?.color }} />
            <span className="font-bold text-sm" style={{ color: activeTool?.color }}>
              {activeTool?.label}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl">🍯</span>
            <div>
              <h2 className="font-bold text-base leading-tight">Colmeia</h2>
              <p className="text-[11px] text-muted-foreground">Seus utilitários pessoais</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {activeSection === null ? (
          <div className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">Sua Colmeia</h3>
                <p className="text-xs text-muted-foreground">Ferramentas pessoais da Bee</p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                {COLMEIA_TOOLS.length} ativas
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {COLMEIA_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveSection(tool.id)}
                  className="beeyes-tool-card-light dark:beeyes-tool-card-dark group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl p-4 text-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center">
                    {tool.src ? (
                      <img src={tool.src} alt={tool.label} className="h-full w-full object-contain drop-shadow-md transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-2xl transition-transform group-hover:scale-105" style={{ backgroundColor: `${tool.color}22`, color: tool.color }}>
                        {tool.icon}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-bold text-foreground">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {activeSection === "calendar" && <CalendarSection authHeaders={authHeaders} />}
            {activeSection === "finance" && <FinanceSection authHeaders={authHeaders} />}
            {activeSection === "clock" && <ClockSection authHeaders={authHeaders} />}
            {activeSection === "notes" && <NotesSection authHeaders={authHeaders} />}
            {activeSection === "health" && <HealthCoachSection />}
          </>
        )}
      </div>
    </div>
  );
}
