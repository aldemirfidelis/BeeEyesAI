import { useState, useEffect, useCallback } from "react";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek, subMonths, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar, ChevronLeft, ChevronRight, DollarSign, ExternalLink,
  Loader2, MapPin, Plus, Trash2, X, Link, CheckCircle2, TrendingDown, TrendingUp,
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

interface ColmeiaPanelProps {
  authHeaders: () => Record<string, string>;
}

const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Moradia", "Compras", "Outros"];
const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Outros"];
const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#F59E0B", Transporte: "#3B82F6", Saúde: "#10B981",
  Lazer: "#8B5CF6", Educação: "#06B6D4", Moradia: "#EF4444",
  Compras: "#EC4899", Outros: "#6B7280",
  Salário: "#22C55E", Freelance: "#84CC16", Investimentos: "#F97316",
};

function fmtCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
              setForm(f => ({ ...f, startAt: format(selectedDay, "yyyy-MM-dd") + "T09:00" }));
              setShowForm(true);
            }}>
              <Plus className="w-3 h-3" /> Evento
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
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Novo evento
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
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nova transação
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

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ColmeiaPanel({ authHeaders }: ColmeiaPanelProps) {
  const [activeTab, setActiveTab] = useState<"calendar" | "finance">("calendar");

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🍯</span>
          <div>
            <h2 className="font-bold text-base leading-tight">Colmeia</h2>
            <p className="text-[11px] text-muted-foreground">Suas ferramentas integradas à Bee</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          <button onClick={() => setActiveTab("calendar")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${activeTab === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
            <Calendar className="w-3.5 h-3.5" /> Calendário
          </button>
          <button onClick={() => setActiveTab("finance")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${activeTab === "finance" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
            <DollarSign className="w-3.5 h-3.5" /> Finanças
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "calendar" ? <CalendarSection authHeaders={authHeaders} /> : <FinanceSection authHeaders={authHeaders} />}
      </div>
    </div>
  );
}
