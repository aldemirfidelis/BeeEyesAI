import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Linking, Modal, Platform, Dimensions, Vibration,
  Image,
} from "react-native";
import { DrumRollDatePicker } from "@mobile/components/DrumRollDatePicker";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "@mobile/lib/api";
import { CHANNEL, requestNotificationPermission } from "@mobile/lib/notifications";
import {
  scheduleAlarm,
  cancelAlarmNotifications,
  validateAndRescheduleAlarms,
  alarmKindLabel,
  alarmBodyText,
  alarmRepeatLabel,
  type AlarmRecord,
} from "@mobile/services/alarmService";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { HealthCoachSection } from "./HealthCoachSection";
import { WishlistSection } from "./WishlistSection";

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
  localNotificationId?: string | null;
}

// ── Colmeia Hub types ─────────────────────────────────────────────────────────

type ToolId = "calendar" | "finance" | "clock" | "notes" | "health" | "wishlist" | "house";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALARM_WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const EVENT_COLORS: Record<string, string> = {
  primary: "#F5C842",
  blue: "#3B82F6",
  green: "#10B981",
  red: "#EF4444",
  purple: "#8B5CF6",
  orange: "#F97316",
};

const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Lazer", "Saúde", "Moradia", "Educação", "Compras", "Outros"];
const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Presente", "Outros"];

const CATEGORY_COLORS: Record<string, string> = {
  "alimentação": "#F59E0B",
  "transporte": "#3B82F6",
  "saúde": "#10B981",
  "lazer": "#8B5CF6",
  "educação": "#06B6D4",
  "moradia": "#EF4444",
  "compras": "#EC4899",
  "salário": "#10B981",
  "freelance": "#3B82F6",
  "investimentos": "#06B6D4",
  "presente": "#F97316",
  "outros": "#6B7280",
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat.toLowerCase()] ?? "#6B7280";
}

// ── Colmeia Hub config ────────────────────────────────────────────────────────
// To add a new tool: (1) add its ToolId to the union above, (2) push to COLMEIA_TOOLS,
// (3) place its id in HEX_LAYOUT (replace a null slot or extend).

interface ColmeiaTool { id: ToolId; label: string; img?: number; iconName?: string; color: string }

const COLMEIA_TOOLS: ColmeiaTool[] = [
  { id: "calendar", label: "Calendário", img: require("../../../assets/icons-colmeia/calendario.png"),  color: "#FFD940" },
  { id: "finance",  label: "Finanças",   img: require("../../../assets/icons-colmeia/financas.png"),    color: "#10B981" },
  { id: "notes",    label: "Notas",      img: require("../../../assets/icons-colmeia/notas.png"),       color: "#8B5CF6" },
  { id: "clock",    label: "Alarmes",    img: require("../../../assets/icons-colmeia/alarmes.png"),     color: "#F97316" },
  { id: "health",   label: "Saúde",      img: require("../../../assets/icons-colmeia/saude.png"),       color: "#EF4444" },
  { id: "wishlist", label: "Lista de Desejos", img: require("../../../assets/icons-colmeia/lista-desejos.png"), color: "#EC4899" },
  { id: "house",    label: "Casa da Bee", iconName: "home", color: "#F5A623" },
];

// 6 positions around center (degrees, clockwise from top).
// null = "em breve" placeholder — replace with a ToolId when adding a new tool.
const HEX_ANGLES = [-90, -30, 30, 90, 150, 210] as const;
const HEX_LAYOUT: Array<ToolId | null> = [
  "calendar", // top
  "clock",    // top-right
  "finance",  // bottom-right
  "health",   // bottom
  "notes",    // bottom-left
  null,       // top-left    — coming soon
];

// ── Calendar Section ──────────────────────────────────────────────────────────

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const { width: SCREEN_W } = Dimensions.get("window");
// Cell width: screen - scroll padding(32) - card padding(28) - card border(2) — divided by 7
const CAL_CELL_W = Math.floor((SCREEN_W - 62) / 7);

function padDate(n: number) {
  return String(n).padStart(2, "0");
}

// ── Public calendar entry types ───────────────────────────────────────────────

interface PublicCalendarEntry {
  id: string;
  title: string;
  description: string;
  date: string; // "YYYY-MM-DD"
  type: "national_holiday" | "state_holiday" | "special_date";
  emoji: string;
  state?: string;
  category?: string;
}

// Dot colors per entry type
const PUBLIC_ENTRY_COLORS: Record<PublicCalendarEntry["type"], string> = {
  national_holiday: "#EF4444",  // Red
  state_holiday: "#F97316",     // Orange
  special_date: "#10B981",      // Green
};

function CalendarSection({ colors, styles }: { colors: any; styles: any }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [publicEntries, setPublicEntries] = useState<PublicCalendarEntry[]>([]);
  const [userState, setUserState] = useState<string | null>(null);
  const [showStateModal, setShowStateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", startAt: "", endAt: "", location: "" });
  const [pickerTarget, setPickerTarget] = useState<"startAt" | "endAt" | null>(null);

  const startAtDate = newEvent.startAt ? new Date(newEvent.startAt) : null;
  const endAtDate = newEvent.endAt ? new Date(newEvent.endAt) : null;

  function formatEventDate(d: Date): string {
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function isoFromDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(viewYear, viewMonth, 1).toISOString();
      const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
      const res = await api.get(`/api/colmeia/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setEvents(res.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [viewMonth, viewYear]);

  const loadPublicEntries = useCallback(async (state?: string | null) => {
    try {
      const from = new Date(viewYear, viewMonth, 1).toISOString();
      const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
      const stateParam = (state ?? userState) ? `&state=${(state ?? userState)!.toUpperCase()}` : "";
      const res = await api.get(`/api/calendar/public?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${stateParam}`);
      setPublicEntries(res.data ?? []);
    } catch { /* ignore */ }
  }, [viewMonth, viewYear, userState]);

  const loadCalendarPreferences = useCallback(async () => {
    try {
      const res = await api.get("/api/calendar/preferences");
      const st = res.data?.state ?? null;
      setUserState(st);
      return st;
    } catch { return null; }
  }, []);

  const loadGoogleStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/colmeia/google/status");
      setGoogleConnected(res.data?.connected ?? false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadCalendarPreferences().then((st) => loadPublicEntries(st));
  }, [viewMonth, viewYear]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadGoogleStatus(); }, [loadGoogleStatus]);

  const navigateMonth = (dir: 1 | -1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDay(null);
  };

  // Build grid cells: pad prev month → current month → pad next month
  const cells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
    const result: Array<{ day: number; current: boolean }> = [];
    for (let i = firstWeekday - 1; i >= 0; i--) result.push({ day: daysInPrev - i, current: false });
    for (let d = 1; d <= daysInMonth; d++) result.push({ day: d, current: true });
    const tail = result.length % 7;
    if (tail > 0) for (let d = 1; d <= 7 - tail; d++) result.push({ day: d, current: false });
    return result;
  }, [viewMonth, viewYear]);

  const daysWithEvents = useMemo(() => {
    const s = new Set<number>();
    events.forEach((ev) => {
      const d = new Date(ev.startAt);
      if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) s.add(d.getDate());
    });
    return s;
  }, [events, viewMonth, viewYear]);

  // Map day → list of public entry types (for dot rendering)
  const publicDayMap = useMemo(() => {
    const m = new Map<number, PublicCalendarEntry[]>();
    publicEntries.forEach((entry) => {
      const [yr, mo, dy] = entry.date.split("-").map(Number);
      if (yr === viewYear && mo === viewMonth + 1) {
        const existing = m.get(dy) ?? [];
        m.set(dy, [...existing, entry]);
      }
    });
    return m;
  }, [publicEntries, viewMonth, viewYear]);

  const selectedDayEvents = useMemo(() => {
    if (selectedDay == null) return [];
    return events.filter((ev) => {
      const d = new Date(ev.startAt);
      return d.getDate() === selectedDay && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  }, [events, selectedDay, viewMonth, viewYear]);

  const selectedDayPublic = useMemo(() => {
    if (selectedDay == null) return [];
    return publicDayMap.get(selectedDay) ?? [];
  }, [publicDayMap, selectedDay]);

  const handleConnectGoogle = async () => {
    setGoogleConnecting(true);
    try {
      const res = await api.get("/api/colmeia/google/auth-url");
      if (res.data?.url) await Linking.openURL(res.data.url);
    } catch { Alert.alert("Erro", "Não foi possível conectar ao Google."); }
    finally { setGoogleConnecting(false); }
  };

  const handleDisconnectGoogle = () => {
    Alert.alert("Desconectar", "Remover integração com Google Calendar?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Desconectar", style: "destructive", onPress: async () => {
        await api.delete("/api/colmeia/google/disconnect").catch(() => {});
        setGoogleConnected(false);
      }},
    ]);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.startAt.trim()) {
      Alert.alert("Erro", "Título e data de início são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/api/colmeia/events", {
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || null,
        startAt: new Date(newEvent.startAt).toISOString(),
        endAt: newEvent.endAt.trim() ? new Date(newEvent.endAt).toISOString() : null,
        location: newEvent.location.trim() || null,
      });
      setEvents((prev) => [...prev, res.data].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
      setShowAddEvent(false);
      setNewEvent({ title: "", description: "", startAt: "", endAt: "", location: "" });
    } catch { Alert.alert("Erro", "Não foi possível criar o evento."); }
    finally { setSaving(false); }
  };

  const handleDeleteEvent = (id: string, title: string) => {
    Alert.alert("Apagar evento", `Apagar "${title}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => {
        await api.delete(`/api/colmeia/events/${id}`).catch(() => {});
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }},
    ]);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const isCurrentMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <View>
      {/* Google Calendar Integration */}
      <View style={[calStyles.googleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={localStyles.row}>
          <Feather name="calendar" size={16} color={colors.primaryDark} />
          <Text style={[calStyles.googleTitle, { color: colors.foreground }]}>Google Calendar</Text>
        </View>
        {googleConnected ? (
          <View style={localStyles.row}>
            <View style={[localStyles.badge, { backgroundColor: "#10B98118", flex: 1 }]}>
              <Feather name="check-circle" size={13} color="#10B981" />
              <Text style={[localStyles.badgeText, { color: "#10B981" }]}>Conectado</Text>
            </View>
            <TouchableOpacity onPress={handleDisconnectGoogle} style={[localStyles.btnSm, { borderColor: colors.border }]}>
              <Text style={[localStyles.btnSmText, { color: colors.muted }]}>Desconectar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[localStyles.btnOutline, { borderColor: colors.primaryDark }]} onPress={handleConnectGoogle} disabled={googleConnecting}>
            {googleConnecting
              ? <ActivityIndicator size="small" color={colors.primaryDark} />
              : <><Feather name="link" size={14} color={colors.primaryDark} /><Text style={[localStyles.btnOutlineText, { color: colors.primaryDark }]}>Conectar Google Calendar</Text></>}
          </TouchableOpacity>
        )}
      </View>

      {/* Calendar Card */}
      <View style={[calStyles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Month navigation */}
        <View style={calStyles.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[calStyles.monthLabel, { color: colors.foreground }]}>
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          </Text>
          <TouchableOpacity onPress={() => navigateMonth(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Week day headers */}
        <View style={calStyles.weekRow}>
          {WEEK_DAYS.map((d) => (
            <Text key={d} style={[calStyles.weekDay, { color: colors.muted, width: CAL_CELL_W }]}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        {loading ? (
          <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 20 }} />
        ) : (
          <View style={calStyles.grid}>
            {cells.map((cell, idx) => {
              const isToday = cell.current && isCurrentMonth && cell.day === today.getDate();
              const isSelected = cell.current && cell.day === selectedDay;
              const hasEvt = cell.current && daysWithEvents.has(cell.day);
              const publicForDay = cell.current ? (publicDayMap.get(cell.day) ?? []) : [];
              const hasPublic = publicForDay.length > 0;
              const bg = isSelected ? colors.primaryDark : isToday ? colors.primaryDark + "28" : "transparent";
              const numColor = isSelected ? "#1A1A1A" : cell.current ? colors.foreground : colors.muted;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[calStyles.dayCell, { width: CAL_CELL_W, backgroundColor: bg }]}
                  onPress={() => cell.current && setSelectedDay(isSelected ? null : cell.day)}
                  disabled={!cell.current}
                  activeOpacity={cell.current ? 0.7 : 1}
                >
                  <Text style={[calStyles.dayNum, { color: numColor, opacity: cell.current ? 1 : 0.3 }]}>
                    {cell.day}
                  </Text>
                  {/* Event and public entry dots */}
                  {(hasEvt || hasPublic) && (
                    <View style={{ flexDirection: "row", gap: 2, justifyContent: "center" }}>
                      {hasEvt && (
                        <View style={[calStyles.evtDot, { backgroundColor: isSelected ? "#1A1A1A" : colors.primaryDark }]} />
                      )}
                      {publicForDay.slice(0, 2).map((entry, ei) => (
                        <View
                          key={ei}
                          style={[calStyles.evtDot, { backgroundColor: isSelected ? "#1A1A1A" : PUBLIC_ENTRY_COLORS[entry.type] }]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Selected day panel */}
      {selectedDay != null && (
        <View style={[calStyles.dayPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={calStyles.dayPanelHeader}>
            <Text style={[calStyles.dayPanelTitle, { color: colors.foreground }]}>
              {padDate(selectedDay)} de {new Date(viewYear, viewMonth, 1).toLocaleDateString("pt-BR", { month: "long" })}
            </Text>
            <TouchableOpacity
              style={[calStyles.addDayBtn, { backgroundColor: colors.primaryDark }]}
              onPress={() => {
                setNewEvent((p) => ({ ...p, startAt: `${viewYear}-${padDate(viewMonth + 1)}-${padDate(selectedDay)} 09:00` }));
                setShowAddEvent(true);
              }}
            >
              <Text style={calStyles.addDayBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </View>

          {/* Public entries (holidays + special dates) */}
          {selectedDayPublic.map((entry) => (
            <View key={entry.id} style={[calStyles.evtItem, { borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: PUBLIC_ENTRY_COLORS[entry.type] }]}>
              <View style={[calStyles.evtBar, { backgroundColor: PUBLIC_ENTRY_COLORS[entry.type] }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 14 }}>{entry.emoji}</Text>
                  <Text style={[calStyles.evtTitle, { color: colors.foreground, flex: 1 }]}>{entry.title}</Text>
                  <View style={[calStyles.entryTypeBadge, { backgroundColor: PUBLIC_ENTRY_COLORS[entry.type] + "20" }]}>
                    <Text style={[calStyles.entryTypeBadgeText, { color: PUBLIC_ENTRY_COLORS[entry.type] }]}>
                      {entry.type === "national_holiday" ? "Feriado Nacional" : entry.type === "state_holiday" ? `Feriado ${entry.state ?? ""}` : "Data Especial"}
                    </Text>
                  </View>
                </View>
                <Text style={[calStyles.evtMeta, { color: colors.muted }]} numberOfLines={2}>{entry.description}</Text>
              </View>
            </View>
          ))}

          {/* User events */}
          {selectedDayEvents.length === 0 && selectedDayPublic.length === 0 ? (
            <Text style={[calStyles.emptyDay, { color: colors.muted }]}>Nenhum evento ou data especial neste dia</Text>
          ) : (
            selectedDayEvents.map((ev) => (
              <View key={ev.id} style={[calStyles.evtItem, { borderColor: colors.border }]}>
                <View style={[calStyles.evtBar, { backgroundColor: EVENT_COLORS[ev.color ?? "primary"] ?? EVENT_COLORS.primary }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[calStyles.evtTitle, { color: colors.foreground }]}>{ev.title}</Text>
                  {!ev.allDay && (
                    <Text style={[calStyles.evtMeta, { color: colors.muted }]}>
                      {new Date(ev.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {ev.endAt ? ` – ${new Date(ev.endAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </Text>
                  )}
                  {ev.location ? <Text style={[calStyles.evtMeta, { color: colors.muted }]}>📍 {ev.location}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDeleteEvent(ev.id, ev.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="trash-2" size={14} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* Legend + state selector */}
      <View style={[calStyles.legendRow, { borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, flex: 1 }}>
          <View style={calStyles.legendItem}>
            <View style={[calStyles.legendDot, { backgroundColor: colors.primaryDark }]} />
            <Text style={[calStyles.legendText, { color: colors.muted }]}>Compromisso</Text>
          </View>
          <View style={calStyles.legendItem}>
            <View style={[calStyles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={[calStyles.legendText, { color: colors.muted }]}>Feriado Nacional</Text>
          </View>
          <View style={calStyles.legendItem}>
            <View style={[calStyles.legendDot, { backgroundColor: "#F97316" }]} />
            <Text style={[calStyles.legendText, { color: colors.muted }]}>Feriado Estadual</Text>
          </View>
          <View style={calStyles.legendItem}>
            <View style={[calStyles.legendDot, { backgroundColor: "#10B981" }]} />
            <Text style={[calStyles.legendText, { color: colors.muted }]}>Data Especial</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowStateModal(true)}
          style={[calStyles.stateBtn, { borderColor: colors.border, backgroundColor: colors.inputBg ?? colors.background }]}
        >
          <Text style={[calStyles.stateBtnText, { color: userState ? colors.primaryDark : colors.muted }]}>
            {userState ?? "🏠 Estado"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add event button (when no day selected) */}
      {selectedDay == null && (
        <TouchableOpacity style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark }]} onPress={() => setShowAddEvent(true)}>
          <Text style={localStyles.btnPrimaryText}>Novo Evento</Text>
        </TouchableOpacity>
      )}

      {/* Upcoming events list when no day is selected */}
      {selectedDay == null && !loading && (() => {
        const upcoming = events.filter((e) => new Date(e.startAt) >= today).slice(0, 8);
        if (upcoming.length === 0) return (
          <Text style={[localStyles.emptyText, { color: colors.muted }]}>Nenhum evento próximo</Text>
        );
        return (
          <View>
            <Text style={[localStyles.listHeader, { color: colors.muted }]}>PRÓXIMOS</Text>
            {upcoming.map((ev) => (
              <View key={ev.id} style={[localStyles.eventItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[localStyles.eventDot, { backgroundColor: EVENT_COLORS[ev.color ?? "primary"] ?? EVENT_COLORS.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[localStyles.eventTitle, { color: colors.foreground }]}>{ev.title}</Text>
                  <Text style={[localStyles.eventMeta, { color: colors.muted }]}>
                    {ev.allDay ? formatDate(ev.startAt) : formatDateTime(ev.startAt)}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteEvent(ev.id, ev.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="trash-2" size={14} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      })()}

      {/* Add Event Modal */}
      <Modal visible={showAddEvent} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { backgroundColor: colors.card }]}>
            <View style={localStyles.modalHeader}>
              <Text style={[localStyles.modalTitle, { color: colors.foreground, fontWeight: "700" }]}>Novo Evento</Text>
              <TouchableOpacity onPress={() => setShowAddEvent(false)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <TextInput style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Título *" placeholderTextColor={colors.muted} value={newEvent.title} onChangeText={(v) => setNewEvent((p) => ({ ...p, title: v }))} />
            <TouchableOpacity style={[localStyles.input, localStyles.dateField, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setPickerTarget("startAt")}>
              {startAtDate
                ? <Text style={{ color: colors.foreground, fontSize: 15 }}>{formatEventDate(startAtDate)}</Text>
                : <Text style={{ color: colors.muted, fontSize: 15 }}>Início *</Text>}
              <Feather name="calendar" size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={[localStyles.input, localStyles.dateField, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setPickerTarget("endAt")}>
              {endAtDate
                ? <Text style={{ color: colors.foreground, fontSize: 15 }}>{formatEventDate(endAtDate)}</Text>
                : <Text style={{ color: colors.muted, fontSize: 15 }}>Fim (opcional)</Text>}
              <Feather name="clock" size={16} color={colors.muted} />
            </TouchableOpacity>
            <TextInput style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Local" placeholderTextColor={colors.muted} value={newEvent.location} onChangeText={(v) => setNewEvent((p) => ({ ...p, location: v }))} />
            <TextInput style={[localStyles.input, localStyles.inputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Descrição" placeholderTextColor={colors.muted} value={newEvent.description} onChangeText={(v) => setNewEvent((p) => ({ ...p, description: v }))} multiline numberOfLines={3} />
            <TouchableOpacity style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark, marginTop: 4 }]} onPress={handleAddEvent} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={localStyles.btnPrimaryText}>Salvar Evento</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DrumRollDatePicker
        visible={pickerTarget !== null}
        value={pickerTarget === "startAt" ? startAtDate : endAtDate}
        title={pickerTarget === "startAt" ? "Início do evento" : "Fim do evento"}
        onConfirm={(date) => {
          setNewEvent((p) => ({ ...p, [pickerTarget!]: isoFromDate(date) }));
          setPickerTarget(null);
        }}
        onCancel={() => setPickerTarget(null)}
        onClear={pickerTarget === "endAt" ? () => { setNewEvent((p) => ({ ...p, endAt: "" })); setPickerTarget(null); } : undefined}
        colors={colors}
      />

      {/* State selector modal */}
      <Modal visible={showStateModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { backgroundColor: colors.card, maxHeight: "70%" }]}>
            <View style={localStyles.modalHeader}>
              <Text style={[localStyles.modalTitle, { color: colors.foreground, fontWeight: "700" }]}>
                🏠 Selecionar Estado
              </Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[calStyles.stateHint, { color: colors.muted }]}>
              Escolha seu estado para ver feriados estaduais no calendário.
            </Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {/* Option: no state */}
              <TouchableOpacity
                style={[calStyles.stateOption, { borderColor: !userState ? colors.primaryDark : colors.border, backgroundColor: !userState ? colors.primaryDark + "12" : "transparent" }]}
                onPress={async () => {
                  setUserState(null);
                  setShowStateModal(false);
                  await api.patch("/api/calendar/preferences", { state: null }).catch(() => {});
                  loadPublicEntries(null);
                }}
              >
                <Text style={[calStyles.stateOptionText, { color: !userState ? colors.primaryDark : colors.foreground }]}>Não informar</Text>
              </TouchableOpacity>
              {[
                "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
                "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
              ].map((uf) => {
                const names: Record<string, string> = {
                  AC:"Acre",AL:"Alagoas",AM:"Amazonas",AP:"Amapá",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",
                  ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MG:"Minas Gerais",MS:"Mato Grosso do Sul",
                  MT:"Mato Grosso",PA:"Pará",PB:"Paraíba",PE:"Pernambuco",PI:"Piauí",PR:"Paraná",
                  RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RO:"Rondônia",RR:"Roraima",RS:"Rio Grande do Sul",
                  SC:"Santa Catarina",SE:"Sergipe",SP:"São Paulo",TO:"Tocantins",
                };
                const isSelected = userState === uf;
                return (
                  <TouchableOpacity
                    key={uf}
                    style={[calStyles.stateOption, { borderColor: isSelected ? colors.primaryDark : colors.border, backgroundColor: isSelected ? colors.primaryDark + "12" : "transparent" }]}
                    onPress={async () => {
                      setUserState(uf);
                      setShowStateModal(false);
                      await api.patch("/api/calendar/preferences", { state: uf }).catch(() => {});
                      loadPublicEntries(uf);
                    }}
                  >
                    <Text style={[calStyles.stateOptionText, { color: isSelected ? colors.primaryDark : colors.foreground }]}>{uf} — {names[uf]}</Text>
                    {isSelected && <Feather name="check" size={14} color={colors.primaryDark} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const calStyles = StyleSheet.create({
  entryTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  entryTypeBadgeText: { fontSize: 9, fontWeight: "700" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 2, marginTop: 4, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 10 },
  stateBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  stateBtnText: { fontSize: 11, fontWeight: "600" },
  stateHint: { fontSize: 12, marginBottom: 12, paddingHorizontal: 4 },
  stateOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 6 },
  stateOptionText: { fontSize: 14 },
  // below are the existing ones — don't change them
  googleCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  googleTitle: { fontSize: 14, fontWeight: "600", marginLeft: 8 },
  calCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12, overflow: "hidden" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  monthLabel: { fontSize: 15, fontWeight: "700" },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekDay: { textAlign: "center", fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, gap: 2 },
  dayNum: { fontSize: 13, fontWeight: "500" },
  evtDot: { width: 4, height: 4, borderRadius: 2 },
  dayPanel: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  dayPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayPanelTitle: { fontSize: 14, fontWeight: "700" },
  addDayBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addDayBtnText: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
  emptyDay: { fontSize: 13, textAlign: "center", paddingVertical: 8 },
  evtItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  evtBar: { width: 4, height: "100%" as any, borderRadius: 2, marginTop: 2, minHeight: 20 },
  evtTitle: { fontSize: 14, fontWeight: "600" },
  evtMeta: { fontSize: 12 },
});

// ── Finance Section ───────────────────────────────────────────────────────────

function FinanceSection({ colors, styles }: { colors: any; styles: any }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTx, setNewTx] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    category: "outros",
    description: "",
  });

  const loadFinance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/colmeia/finance?month=${month}&year=${year}`);
      setTransactions(res.data?.transactions ?? []);
      setSummary(res.data?.summary ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const navigateMonth = (dir: 1 | -1) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const handleAddTransaction = async () => {
    const amount = parseFloat(newTx.amount.replace(",", "."));
    if (!newTx.amount || isNaN(amount) || amount <= 0) {
      Alert.alert("Erro", "Valor inválido.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/api/colmeia/finance", {
        type: newTx.type,
        amount,
        category: newTx.category,
        description: newTx.description.trim() || null,
        date: new Date().toISOString(),
      });
      setTransactions((prev) => [res.data, ...prev]);
      setSummary((prev) => {
        if (!prev) return prev;
        const cents = Math.round(amount * 100);
        const byCategory = { ...prev.byCategory };
        if (newTx.type === "expense") byCategory[newTx.category] = (byCategory[newTx.category] ?? 0) + cents;
        return {
          ...prev,
          totalIncome: newTx.type === "income" ? prev.totalIncome + cents : prev.totalIncome,
          totalExpense: newTx.type === "expense" ? prev.totalExpense + cents : prev.totalExpense,
          balance: prev.balance + (newTx.type === "income" ? cents : -cents),
          byCategory,
        };
      });
      setShowAdd(false);
      setNewTx({ type: "expense", amount: "", category: "outros", description: "" });
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a transação.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = (id: string, description: string | null) => {
    Alert.alert("Apagar", `Apagar "${description ?? "transação"}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/api/colmeia/finance/${id}`).catch(() => {});
          setTransactions((prev) => prev.filter((t) => t.id !== id));
          loadFinance();
        },
      },
    ]);
  };

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const categories = newTx.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <View>
      {/* Month Navigation */}
      <View style={[localStyles.monthNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[localStyles.monthText, { color: colors.foreground, fontFamily: FONTS.sans }]}>
          {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        </Text>
        <TouchableOpacity onPress={() => navigateMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryDark} style={{ marginTop: 24 }} />
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <View style={localStyles.summaryRow}>
              <View style={[localStyles.summaryCard, { backgroundColor: "#10B98115", borderColor: "#10B98133" }]}>
                <Feather name="arrow-up-circle" size={18} color="#10B981" />
                <Text style={[localStyles.summaryLabel, { color: "#10B981" }]}>Receitas</Text>
                <Text style={[localStyles.summaryValue, { color: "#10B981", fontFamily: FONTS.display }]}>
                  {formatCurrency(summary.totalIncome)}
                </Text>
              </View>
              <View style={[localStyles.summaryCard, { backgroundColor: "#EF444415", borderColor: "#EF444433" }]}>
                <Feather name="arrow-down-circle" size={18} color="#EF4444" />
                <Text style={[localStyles.summaryLabel, { color: "#EF4444" }]}>Despesas</Text>
                <Text style={[localStyles.summaryValue, { color: "#EF4444", fontFamily: FONTS.display }]}>
                  {formatCurrency(summary.totalExpense)}
                </Text>
              </View>
              <View style={[localStyles.summaryCard, {
                backgroundColor: summary.balance >= 0 ? "#3B82F615" : "#F9731615",
                borderColor: summary.balance >= 0 ? "#3B82F633" : "#F9731633",
              }]}>
                <Feather name="trending-up" size={18} color={summary.balance >= 0 ? "#3B82F6" : "#F97316"} />
                <Text style={[localStyles.summaryLabel, { color: summary.balance >= 0 ? "#3B82F6" : "#F97316" }]}>Saldo</Text>
                <Text style={[localStyles.summaryValue, { color: summary.balance >= 0 ? "#3B82F6" : "#F97316", fontFamily: FONTS.display }]}>
                  {formatCurrency(Math.abs(summary.balance))}
                </Text>
              </View>
            </View>
          )}

          {/* Category Breakdown */}
          {summary && Object.keys(summary.byCategory).length > 0 && (
            <View style={[localStyles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[localStyles.sectionTitle, { color: colors.foreground, fontWeight: "600" }]}>Por categoria</Text>
              {Object.entries(summary.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, cents]) => {
                  const catColor = getCategoryColor(cat);
                  const pct = summary.totalExpense > 0 ? Math.min(100, Math.round((cents / summary.totalExpense) * 100)) : 0;
                  return (
                    <View key={cat} style={localStyles.categoryRow}>
                      <View style={[finStyles.catDot, { backgroundColor: catColor }]} />
                      <Text style={[finStyles.catName, { color: colors.foreground }]}>{cat}</Text>
                      <View style={[localStyles.categoryBarBg, { backgroundColor: colors.border }]}>
                        <View style={[localStyles.categoryBar, { backgroundColor: catColor, width: `${pct}%` }]} />
                      </View>
                      <Text style={[localStyles.categoryAmount, { color: colors.muted }]}>{formatCurrency(cents)}</Text>
                    </View>
                  );
                })}
            </View>
          )}

          {/* Add Transaction */}
          <TouchableOpacity
            style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark }]}
            onPress={() => setShowAdd(true)}
          >
            <Text style={localStyles.btnPrimaryText}>Registrar Transação</Text>
          </TouchableOpacity>

          {/* Transactions List */}
          {transactions.length === 0 ? (
            <View style={finStyles.emptyTx}>
              <Feather name="inbox" size={28} color={colors.border} />
              <Text style={[finStyles.emptyTxText, { color: colors.muted }]}>Nenhuma transação neste mês</Text>
              <Text style={[finStyles.emptyTxHint, { color: colors.muted }]}>Diga à Bee "registra gasto de R$50 em alimentação"</Text>
            </View>
          ) : (
            <View>
              <Text style={[localStyles.listHeader, { color: colors.muted }]}>TRANSAÇÕES</Text>
              {transactions.map((tx) => {
                const catColor = getCategoryColor(tx.category);
                const isIncome = tx.type === "income";
                return (
                  <View key={tx.id} style={[localStyles.txItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[finStyles.txIcon, { backgroundColor: (isIncome ? "#10B981" : catColor) + "1A" }]}>
                      <Feather name={isIncome ? "arrow-up" : "arrow-down"} size={13} color={isIncome ? "#10B981" : catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[localStyles.txDescription, { color: colors.foreground }]} numberOfLines={1}>
                        {tx.description ?? tx.category}
                      </Text>
                      <View style={finStyles.txMetaRow}>
                        <View style={[finStyles.txCatPill, { backgroundColor: catColor + "22" }]}>
                          <Text style={[finStyles.txCatText, { color: catColor }]}>{tx.category}</Text>
                        </View>
                        <Text style={[localStyles.txMeta, { color: colors.muted }]}>{formatDate(tx.date)}</Text>
                      </View>
                    </View>
                    <Text style={[localStyles.txAmount, { color: isIncome ? "#10B981" : "#EF4444", fontWeight: "600" }]}>
                      {isIncome ? "+" : "-"}{formatCurrency(tx.amountCents)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeleteTransaction(tx.id, tx.description ?? null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
                      <Feather name="trash-2" size={14} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* Add Transaction Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { backgroundColor: colors.card }]}>
            <View style={localStyles.modalHeader}>
              <Text style={[localStyles.modalTitle, { color: colors.foreground, fontFamily: FONTS.display }]}>Nova Transação</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Type Toggle */}
            <View style={localStyles.typeToggle}>
              <TouchableOpacity
                style={[localStyles.typeBtn, newTx.type === "expense" && { backgroundColor: "#EF444422", borderColor: "#EF4444" }]}
                onPress={() => setNewTx((p) => ({ ...p, type: "expense", category: "outros" }))}
              >
                <Text style={[localStyles.typeBtnText, { color: newTx.type === "expense" ? "#EF4444" : colors.muted }]}>Despesa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[localStyles.typeBtn, newTx.type === "income" && { backgroundColor: "#10B98122", borderColor: "#10B981" }]}
                onPress={() => setNewTx((p) => ({ ...p, type: "income", category: "outros" }))}
              >
                <Text style={[localStyles.typeBtnText, { color: newTx.type === "income" ? "#10B981" : colors.muted }]}>Receita</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Valor (ex: 50.00)"
              placeholderTextColor={colors.muted}
              value={newTx.amount}
              onChangeText={(v) => setNewTx((p) => ({ ...p, amount: v }))}
              keyboardType="decimal-pad"
            />

            <Text style={[localStyles.inputLabel, { color: colors.muted }]}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[localStyles.categoryChip, { borderColor: colors.border, backgroundColor: newTx.category === cat ? colors.primaryDark : colors.background }]}
                  onPress={() => setNewTx((p) => ({ ...p, category: cat }))}
                >
                  <Text style={[localStyles.categoryChipText, { color: newTx.category === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Descrição (opcional)"
              placeholderTextColor={colors.muted}
              value={newTx.description}
              onChangeText={(v) => setNewTx((p) => ({ ...p, description: v }))}
            />

            <TouchableOpacity
              style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark, marginTop: 4 }]}
              onPress={handleAddTransaction}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={localStyles.btnPrimaryText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Notes Section ────────────────────────────────────────────────────────────

const NOTE_BG: Record<string, string> = {
  yellow: "#FEFCE8",
  blue:   "#EFF6FF",
  green:  "#F0FDF4",
  pink:   "#FDF2F8",
};

function NotesSection({ colors }: { colors: any }) {
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/api/colmeia/notes");
      setNotesList(res.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await api.post("/api/colmeia/notes", {
        content: newContent.trim(),
        title: newTitle.trim() || null,
      });
      setNotesList((prev) => [res.data, ...prev]);
      setNewContent(""); setNewTitle(""); setShowAdd(false);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a nota.");
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await api.put(`/api/colmeia/notes/${id}`, {
        content: editContent.trim(),
        title: editTitle.trim() || null,
      });
      setNotesList((prev) => prev.map((n) => n.id === id ? res.data : n));
      setEditingId(null);
    } catch { Alert.alert("Erro", "Não foi possível editar a nota."); }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const res = await api.put(`/api/colmeia/notes/${note.id}`, { pinned: !note.pinned });
      setNotesList((prev) =>
        [...prev.map((n) => n.id === note.id ? res.data : n)]
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    } catch { /* ignore */ }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Apagar nota", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar", style: "destructive",
        onPress: async () => {
          await api.delete(`/api/colmeia/notes/${id}`).catch(() => {});
          setNotesList((prev) => prev.filter((n) => n.id !== id));
        },
      },
    ]);
  };

  return (
    <View>
      {/* Add button */}
      {!showAdd && (
        <TouchableOpacity
          style={[noteStyles.addBtn, { borderColor: colors.border }]}
          onPress={() => setShowAdd(true)}
        >
          <Text style={[noteStyles.addBtnText, { color: colors.muted }]}>Nova nota</Text>
        </TouchableOpacity>
      )}

      {/* Add form */}
      {showAdd && (
        <View style={[noteStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[noteStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Título (opcional)"
            placeholderTextColor={colors.muted}
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <TextInput
            style={[noteStyles.input, noteStyles.inputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Escreva sua nota..."
            placeholderTextColor={colors.muted}
            value={newContent}
            onChangeText={setNewContent}
            multiline
            numberOfLines={4}
            autoFocus
          />
          <View style={noteStyles.formActions}>
            <TouchableOpacity onPress={() => { setShowAdd(false); setNewContent(""); setNewTitle(""); }}>
              <Text style={[noteStyles.cancelText, { color: colors.muted }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[noteStyles.saveBtn, { backgroundColor: colors.primaryDark }]}
              onPress={handleAdd}
              disabled={!newContent.trim() || saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={noteStyles.saveBtnText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryDark} style={{ marginTop: 24 }} />
      ) : notesList.length === 0 ? (
        <View style={noteStyles.empty}>
          <Feather name="file-text" size={32} color={colors.border} />
          <Text style={[noteStyles.emptyTitle, { color: colors.muted }]}>Nenhuma nota ainda</Text>
          <Text style={[noteStyles.emptyHint, { color: colors.muted }]}>Diga à Bee "anota isso" no chat{"\n"}ou crie manualmente</Text>
        </View>
      ) : (
        notesList.map((note) => {
          const isEditing = editingId === note.id;
          return (
            <View key={note.id} style={[noteStyles.card, { backgroundColor: NOTE_BG[note.color] ?? colors.card, borderColor: note.pinned ? colors.primaryDark : colors.border }]}>
              {isEditing ? (
                <View>
                  <TextInput
                    style={[noteStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    placeholder="Título"
                    placeholderTextColor={colors.muted}
                    value={editTitle}
                    onChangeText={setEditTitle}
                  />
                  <TextInput
                    style={[noteStyles.input, noteStyles.inputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={editContent}
                    onChangeText={setEditContent}
                    multiline
                    numberOfLines={4}
                    autoFocus
                  />
                  <View style={noteStyles.formActions}>
                    <TouchableOpacity onPress={() => setEditingId(null)}>
                      <Text style={[noteStyles.cancelText, { color: colors.muted }]}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[noteStyles.saveBtn, { backgroundColor: colors.primaryDark }]}
                      onPress={() => handleSaveEdit(note.id)}
                    >
                      <Text style={noteStyles.saveBtnText}>Salvar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <View style={noteStyles.noteHeader}>
                    <View style={{ flex: 1 }}>
                      {note.title ? <Text style={[noteStyles.noteTitle, { color: colors.foreground }]}>{note.title}</Text> : null}
                      <Text style={[noteStyles.noteContent, { color: colors.foreground }]}>{note.content}</Text>
                    </View>
                    <View style={noteStyles.noteActions}>
                      <TouchableOpacity onPress={() => handleTogglePin(note)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Feather name={note.pinned ? "bookmark" : "bookmark"} size={15} color={note.pinned ? colors.primaryDark : colors.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditingId(note.id); setEditContent(note.content); setEditTitle(note.title ?? ""); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Feather name="edit-2" size={14} color={colors.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(note.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Feather name="trash-2" size={14} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[noteStyles.noteMeta, { color: colors.muted }]}>
                    {new Date(note.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

// ── Clock / Alarms Section ────────────────────────────────────────────────────

type RepeatMode = "once" | "daily" | "custom";

function ClockSection({ colors }: { colors: ReturnType<typeof getThemeColors> }) {
  const [alarms, setAlarms] = useState<AlarmReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    title: "",
    message: "",
    kind: "alarm" as AlarmReminder["kind"],
    scheduledAt: "",
    repeatMode: "once" as RepeatMode,
    repeatDays: [] as number[],
  });

  // ── Load + validate scheduled notifications ─────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/colmeia/alarms");
      const rows: AlarmReminder[] = res.data ?? [];
      setAlarms(rows);

      // Check notification permission
      const { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: "undetermined" }));
      setPermissionDenied(status === "denied");
      if (status === "denied") return;

      // Validate OS schedule and reschedule missing alarms
      await validateAndRescheduleAlarms(rows as AlarmRecord[], async (alarm, newLocalId) => {
        await api.patch(`/api/colmeia/alarms/${alarm.id}`, { localNotificationId: newLocalId }).catch(() => {});
        setAlarms((prev) => prev.map((a) => a.id === alarm.id ? { ...a, localNotificationId: newLocalId } : a));
      });
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Create alarm ─────────────────────────────────────────────────────────────
  const createAlarm = async () => {
    if (!form.title.trim() || !form.scheduledAt.trim()) {
      Alert.alert("Atenção", "Informe o nome e o horário do alarme.");
      return;
    }

    const scheduledDate = new Date(form.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      Alert.alert("Atenção", "Data ou hora inválida.");
      return;
    }

    setSaving(true);
    try {
      // Determine repeatType and repeatDays from form state
      let repeatType: AlarmReminder["repeatType"] = "once";
      let repeatDays: number[] = [];

      if (form.repeatMode === "daily") {
        repeatType = "daily";
        repeatDays = [];
      } else if (form.repeatMode === "custom" && form.repeatDays.length > 0) {
        repeatType = form.repeatDays.length === 7 ? "daily" : "weekly";
        repeatDays = form.repeatDays;
      }

      const payload = {
        title: form.title.trim(),
        message: form.message.trim() || null,
        kind: form.kind,
        scheduledAt: scheduledDate.toISOString(),
        repeatType,
        repeatDays,
        intervalMinutes: null,
      };

      const res = await api.post("/api/colmeia/alarms", payload);
      const created: AlarmReminder = res.data;

      // Schedule local notification
      const localId = await scheduleAlarm(created as AlarmRecord);
      if (localId) {
        await api.patch(`/api/colmeia/alarms/${created.id}`, { localNotificationId: localId }).catch(() => {});
        created.localNotificationId = localId;
      } else {
        // Could not schedule — check permission
        const { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: "undetermined" }));
        if (status === "denied") setPermissionDenied(true);
      }

      Vibration.vibrate([0, 80, 80, 80]);
      setAlarms((prev) => [created, ...prev]);
      setForm({ title: "", message: "", kind: "alarm", scheduledAt: "", repeatMode: "once", repeatDays: [] });
      setShowAdd(false);
      const timeStr = scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setSuccessMsg(`Seu alarme está prontinho! 🐝 Eu te aviso às ${timeStr}.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {
      Alert.alert("Erro", "Não foi possível criar o alarme. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────────────
  const toggleAlarm = async (alarm: AlarmReminder) => {
    const nextActive = !alarm.active;
    try {
      if (!nextActive) {
        await cancelAlarmNotifications(alarm.localNotificationId);
      }
      const res = await api.patch(`/api/colmeia/alarms/${alarm.id}`, {
        active: nextActive,
        localNotificationId: nextActive ? alarm.localNotificationId ?? null : null,
      });
      const updated: AlarmReminder = res.data;

      if (nextActive && !updated.localNotificationId) {
        const localNotificationId = await scheduleAlarm(updated as AlarmRecord);
        if (localNotificationId) {
          const withNotif = await api.patch(`/api/colmeia/alarms/${alarm.id}`, { localNotificationId });
          setAlarms((prev) => prev.map((a) => a.id === alarm.id ? withNotif.data : a));
          return;
        }
      }
      setAlarms((prev) => prev.map((a) => a.id === alarm.id ? updated : a));
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar o alarme.");
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const deleteAlarm = (alarm: AlarmReminder) => {
    Alert.alert("Excluir alarme", `Excluir "${alarm.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await cancelAlarmNotifications(alarm.localNotificationId);
          await api.delete(`/api/colmeia/alarms/${alarm.id}`).catch(() => {});
          setAlarms((prev) => prev.filter((a) => a.id !== alarm.id));
        },
      },
    ]);
  };

  // ── Request permission ───────────────────────────────────────────────────────
  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setPermissionDenied(false);
      load();
    } else {
      Alert.alert(
        "Permissão necessária",
        "Ative as notificações nas Configurações do dispositivo para que a Bee consiga te avisar no horário. 🐝",
        [{ text: "Abrir Configurações", onPress: () => Linking.openSettings() }, { text: "Agora não" }],
      );
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View>
      {/* Header */}
      <View style={[alarmStyles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 22 }}>🐝</Text>
          <View style={{ flex: 1 }}>
            <Text style={[alarmStyles.heroTitle, { color: colors.foreground }]}>Despertadores</Text>
            <Text style={[alarmStyles.heroText, { color: colors.muted }]}>Alarmes com som e vibração para remédios, compromissos e lembretes.</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[alarmStyles.addBtn, { backgroundColor: colors.primaryDark }]}
          onPress={() => setShowAdd((v) => !v)}
        >
          <Feather name={showAdd ? "x" : "plus"} size={15} color="#fff" />
          <Text style={alarmStyles.addBtnText}>{showAdd ? "Cancelar" : "Novo alarme"}</Text>
        </TouchableOpacity>
      </View>

      {/* Permission denied banner */}
      {permissionDenied && (
        <TouchableOpacity
          style={[alarmStyles.permBanner, { backgroundColor: "#FFF3CD", borderColor: "#FFC107" }]}
          onPress={handleRequestPermission}
        >
          <Feather name="alert-triangle" size={16} color="#856404" />
          <Text style={[alarmStyles.permText, { color: "#856404" }]}>
            Notificações bloqueadas. Toque aqui para ativar e eu consigo te avisar no horário. 🐝
          </Text>
        </TouchableOpacity>
      )}

      {/* Success feedback */}
      {!!successMsg && (
        <View style={[alarmStyles.successBanner, { backgroundColor: colors.primaryDark + "18", borderColor: colors.primaryDark + "40" }]}>
          <Text style={[alarmStyles.successText, { color: colors.primaryDark }]}>{successMsg}</Text>
        </View>
      )}

      {/* Add form */}
      {showAdd && (
        <View style={[alarmStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Kind selector */}
          <View style={alarmStyles.kindRow}>
            {(["alarm", "medicine", "appointment"] as const).map((kind) => (
              <TouchableOpacity
                key={kind}
                style={[
                  alarmStyles.kindBtn,
                  {
                    borderColor: form.kind === kind ? colors.primaryDark : colors.border,
                    backgroundColor: form.kind === kind ? colors.primaryDark + "18" : colors.inputBg,
                  },
                ]}
                onPress={() => setForm((p) => ({ ...p, kind }))}
              >
                <Feather
                  name={kind === "medicine" ? "activity" : kind === "appointment" ? "briefcase" : "bell"}
                  size={14}
                  color={form.kind === kind ? colors.primaryDark : colors.muted}
                />
                <Text style={[alarmStyles.kindText, { color: form.kind === kind ? colors.primaryDark : colors.muted }]}>
                  {alarmKindLabel(kind)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <TextInput
            style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            placeholder="Nome do alarme *"
            placeholderTextColor={colors.muted}
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
          />

          {/* Message */}
          <TextInput
            style={[localStyles.input, localStyles.inputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            placeholder="Mensagem da Bee (opcional)"
            placeholderTextColor={colors.muted}
            value={form.message}
            onChangeText={(v) => setForm((p) => ({ ...p, message: v }))}
            multiline
          />

          {/* Date/time picker */}
          <TouchableOpacity
            style={[localStyles.input, localStyles.dateField, { borderColor: form.scheduledAt ? colors.primaryDark : colors.border, backgroundColor: colors.inputBg }]}
            onPress={() => setShowAlarmPicker(true)}
          >
            {form.scheduledAt ? (
              <Text style={{ color: colors.foreground, fontSize: 15 }}>
                {new Date(form.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </Text>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 15 }}>Data e hora *</Text>
            )}
            <Feather name="clock" size={16} color={form.scheduledAt ? colors.primaryDark : colors.muted} />
          </TouchableOpacity>

          {/* Repeat mode */}
          <Text style={[alarmStyles.sectionLabel, { color: colors.muted }]}>Repetição</Text>
          <View style={alarmStyles.repeatModeRow}>
            {(["once", "daily", "custom"] as RepeatMode[]).map((mode) => {
              const labels: Record<RepeatMode, string> = { once: "Uma vez", daily: "Todo dia", custom: "Personalizar" };
              const selected = form.repeatMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    alarmStyles.repeatModeBtn,
                    { borderColor: selected ? colors.primaryDark : colors.border, backgroundColor: selected ? colors.primaryDark + "18" : colors.inputBg },
                  ]}
                  onPress={() => setForm((p) => ({ ...p, repeatMode: mode, repeatDays: mode === "custom" ? p.repeatDays : [] }))}
                >
                  <Text style={[alarmStyles.kindText, { color: selected ? colors.primaryDark : colors.muted }]}>{labels[mode]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Weekday picker (only for custom) */}
          {form.repeatMode === "custom" && (
            <>
              <View style={alarmStyles.weekdayGrid}>
                {ALARM_WEEK_DAYS.map((day) => {
                  const selected = form.repeatDays.includes(day.value);
                  return (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        alarmStyles.weekdayBtn,
                        { borderColor: selected ? colors.primaryDark : colors.border, backgroundColor: selected ? colors.primaryDark + "18" : colors.inputBg },
                      ]}
                      onPress={() =>
                        setForm((p) => ({
                          ...p,
                          repeatDays: selected
                            ? p.repeatDays.filter((v) => v !== day.value)
                            : [...p.repeatDays, day.value].sort((a, b) => a - b),
                        }))
                      }
                    >
                      <Text style={[alarmStyles.kindText, { color: selected ? colors.primaryDark : colors.muted }]}>{day.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[alarmStyles.repeatHint, { color: colors.muted }]}>
                {form.repeatDays.length === 0 ? "Nenhum dia selecionado — vai tocar só uma vez." : form.repeatDays.length === 7 ? "Todo dia." : `Repete às ${ALARM_WEEK_DAYS.filter((d) => form.repeatDays.includes(d.value)).map((d) => d.label).join(", ")}.`}
              </Text>
            </>
          )}

          {/* Actions */}
          <View style={noteStyles.formActions}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={[noteStyles.cancelText, { color: colors.muted }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[noteStyles.saveBtn, { backgroundColor: colors.primaryDark, opacity: saving ? 0.6 : 1 }]}
              onPress={createAlarm}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={noteStyles.saveBtnText}>Criar alarme</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <DrumRollDatePicker
        visible={showAlarmPicker}
        value={form.scheduledAt ? new Date(form.scheduledAt) : null}
        title="Horário do alarme"
        onConfirm={(date) => {
          const pad = (n: number) => String(n).padStart(2, "0");
          const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
          setForm((p) => ({ ...p, scheduledAt: iso }));
          setShowAlarmPicker(false);
        }}
        onCancel={() => setShowAlarmPicker(false)}
        colors={colors}
      />

      {/* Alarm list */}
      {loading ? (
        <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 24 }} />
      ) : alarms.length === 0 ? (
        <View style={noteStyles.empty}>
          <Text style={{ fontSize: 40, textAlign: "center" }}>🔔</Text>
          <Text style={[noteStyles.emptyTitle, { color: colors.muted }]}>Nenhum alarme ainda</Text>
          <Text style={[noteStyles.emptyHint, { color: colors.muted }]}>
            Crie alarmes para remédios, horários e compromissos. A Bee te avisa na hora certa. 🐝
          </Text>
        </View>
      ) : (
        alarms.map((alarm) => (
          <View
            key={alarm.id}
            style={[alarmStyles.card, { backgroundColor: colors.card, borderColor: alarm.active ? colors.primaryDark + "40" : colors.border, opacity: alarm.active ? 1 : 0.6 }]}
          >
            <View style={alarmStyles.alarmHeader}>
              {/* Kind icon */}
              <View style={[alarmStyles.kindIcon, { backgroundColor: alarm.active ? colors.primaryDark + "18" : colors.inputBg }]}>
                <Feather
                  name={alarm.kind === "medicine" ? "activity" : alarm.kind === "appointment" ? "briefcase" : "bell"}
                  size={16}
                  color={alarm.active ? colors.primaryDark : colors.muted}
                />
              </View>

              {/* Alarm info */}
              <View style={{ flex: 1 }}>
                <Text style={[alarmStyles.alarmTitle, { color: colors.foreground }]}>{alarm.title}</Text>
                {alarm.message ? (
                  <Text style={[alarmStyles.alarmBody, { color: colors.muted }]}>{alarm.message}</Text>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }}>
                  <Feather name="clock" size={11} color={colors.muted} />
                  <Text style={[alarmStyles.alarmMeta, { color: alarm.active ? colors.primaryDark : colors.muted }]}>
                    {new Date(alarm.nextTriggerAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <Text style={[alarmStyles.alarmMeta, { color: colors.muted }]}>·</Text>
                  <Text style={[alarmStyles.alarmMeta, { color: colors.muted }]}>{alarmRepeatLabel(alarm)}</Text>
                </View>
                {!alarm.active && (
                  <Text style={[alarmStyles.alarmMeta, { color: colors.muted, fontStyle: "italic" }]}>Pausado</Text>
                )}
              </View>

              {/* Toggle */}
              <TouchableOpacity
                onPress={() => toggleAlarm(alarm)}
                style={[alarmStyles.iconBtn, { borderColor: alarm.active ? colors.primaryDark + "60" : colors.border, backgroundColor: alarm.active ? colors.primaryDark + "12" : "transparent" }]}
              >
                <Feather name={alarm.active ? "pause" : "play"} size={14} color={alarm.active ? colors.primaryDark : colors.muted} />
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity onPress={() => deleteAlarm(alarm)} style={[alarmStyles.iconBtn, { borderColor: colors.border }]}>
                <Feather name="trash-2" size={14} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const alarmStyles = StyleSheet.create({
  hero: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10, marginBottom: 12 },
  heroTitle: { fontSize: 16, fontFamily: FONTS.sans, fontWeight: "700" },
  heroText: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  permBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  permText: { flex: 1, fontSize: 12, lineHeight: 17 },
  successBanner: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  successText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  kindRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  kindBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", gap: 5 },
  repeatModeRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  repeatModeBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  sectionLabel: { fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  weekdayGrid: { flexDirection: "row", gap: 5, marginBottom: 6 },
  weekdayBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  repeatHint: { fontSize: 11, marginBottom: 12, textAlign: "center" },
  kindText: { fontSize: 11, fontFamily: FONTS.sans, fontWeight: "600" },
  kindIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alarmHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  alarmTitle: { fontSize: 15, fontFamily: FONTS.sans, fontWeight: "700" },
  alarmBody: { fontSize: 12, marginTop: 2 },
  alarmMeta: { fontSize: 11 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

const finStyles = StyleSheet.create({
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 12, width: 80 },
  txIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  txMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  txCatPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  txCatText: { fontSize: 10, fontWeight: "600" },
  emptyTx: { alignItems: "center", paddingVertical: 28, gap: 6 },
  emptyTxText: { fontSize: 14, fontWeight: "600" },
  emptyTxHint: { fontSize: 12, textAlign: "center", lineHeight: 17 },
});

const noteStyles = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  addBtnText: { fontSize: 14 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 10,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  dateField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  cancelText: { fontSize: 13 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { color: "#fff", fontSize: 13, fontFamily: FONTS.sans },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.sans },
  emptyHint: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  noteHeader: { flexDirection: "row", gap: 10 },
  noteTitle: { fontSize: 14, fontFamily: FONTS.sans, marginBottom: 4 },
  noteContent: { fontSize: 14, lineHeight: 20 },
  noteActions: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  noteMeta: { fontSize: 11, marginTop: 8 },
});

// ── Bee SVG (sem fundo) ───────────────────────────────────────────────────────

const BEE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <ellipse cx="256" cy="420" rx="90" ry="20" fill="#000000" opacity="0.12"/>
  <path d="M 256 370 L 246 415 L 266 415 Z" fill="#141414" stroke="#141414" stroke-width="12" stroke-linejoin="round"/>
  <g opacity="0.95">
    <ellipse cx="160" cy="190" rx="60" ry="100" fill="#FFFFFF" transform="rotate(-35 160 190)" stroke="#141414" stroke-width="10"/>
    <ellipse cx="352" cy="190" rx="60" ry="100" fill="#FFFFFF" transform="rotate(35 352 190)" stroke="#141414" stroke-width="10"/>
  </g>
  <path d="M 210 180 Q 180 100 130 120" fill="none" stroke="#141414" stroke-width="14" stroke-linecap="round"/>
  <circle cx="130" cy="120" r="16" fill="#141414"/>
  <path d="M 302 180 Q 332 100 382 120" fill="none" stroke="#141414" stroke-width="14" stroke-linecap="round"/>
  <circle cx="382" cy="120" r="16" fill="#141414"/>
  <ellipse cx="256" cy="260" rx="130" ry="140" fill="#FFD940" stroke="#141414" stroke-width="14"/>
  <defs><clipPath id="bee-hub-clip"><ellipse cx="256" cy="260" rx="123" ry="133"/></clipPath></defs>
  <g clip-path="url(#bee-hub-clip)">
    <rect x="100" y="275" width="312" height="28" fill="#141414"/>
    <rect x="100" y="335" width="312" height="28" fill="#141414"/>
  </g>
  <ellipse cx="186" cy="246" rx="16" ry="10" fill="#EEB900" opacity="0.8"/>
  <ellipse cx="326" cy="246" rx="16" ry="10" fill="#EEB900" opacity="0.8"/>
  <circle cx="206" cy="226" r="20" fill="#141414"/>
  <circle cx="214" cy="218" r="7" fill="#FFFFFF"/>
  <circle cx="198" cy="232" r="3" fill="#FFFFFF"/>
  <circle cx="306" cy="226" r="20" fill="#141414"/>
  <circle cx="314" cy="218" r="7" fill="#FFFFFF"/>
  <circle cx="298" cy="232" r="3" fill="#FFFFFF"/>
  <path d="M 244 246 Q 256 260 268 246" fill="none" stroke="#141414" stroke-width="8" stroke-linecap="round"/>
</svg>`;

// ── Colmeia Hub ───────────────────────────────────────────────────────────────

const { width: HUB_SCREEN_W } = Dimensions.get("window");
const HEX_SIZE    = 96;
const CENTER_SIZE = 116;
const HUB_HEIGHT  = 420;
const ICON_ZOOM   = 1.12;
const CENTER_ICON_ZOOM = 1;

function ColmeiaHub({ colors, onSelect }: { colors: any; onSelect: (id: ToolId) => void }) {
  const hubWidth = Math.min(HUB_SCREEN_W, 390);
  const cx = hubWidth / 2;
  const centerLeft = cx - CENTER_SIZE / 2;
  const sideTop = 164;
  const toolPositions: Partial<Record<ToolId, { left: number; top: number }>> = {
    calendar: { left: cx - HEX_SIZE / 2, top: 20 },
    notes: { left: centerLeft - HEX_SIZE - 16, top: sideTop },
    clock: { left: centerLeft + CENTER_SIZE + 16, top: sideTop },
    finance: { left: cx - HEX_SIZE / 2, top: 306 },
  };

  return (
    <View style={{ width: hubWidth, height: HUB_HEIGHT }}>
      {/* Center — Bee */}
      <View style={{
        position: "absolute",
        width: CENTER_SIZE, height: CENTER_SIZE,
        left: centerLeft, top: 150,
        borderRadius: CENTER_SIZE * 0.24,
        backgroundColor: colors.card,
        borderWidth: 1, borderColor: "#FFD94066",
        overflow: "hidden",
        shadowColor: "#B98005", shadowOpacity: 0.28, shadowRadius: 24, elevation: 14,
      }}>
        <Image
          source={require("../../../assets/icons-colmeia/icone-central.png")}
          style={{ width: CENTER_SIZE, height: CENTER_SIZE, transform: [{ scale: CENTER_ICON_ZOOM }] }}
          resizeMode="contain"
        />
      </View>

      {/* Tool cells — only tools with a hub position */}
      {COLMEIA_TOOLS.filter((tool) => tool.id in toolPositions).map((tool) => {
        const pos = toolPositions[tool.id]!;
        return (
          <TouchableOpacity
            key={tool.id}
            activeOpacity={0.72}
            onPress={() => onSelect(tool.id)}
            style={{
              position: "absolute",
              width: HEX_SIZE, height: HEX_SIZE,
              left: pos.left, top: pos.top,
              borderRadius: HEX_SIZE * 0.23,
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: "#FFFFFF66",
              overflow: "hidden",
              shadowColor: tool.color,
              shadowOpacity: 0.18,
              shadowRadius: 14,
              elevation: 7,
            }}
          >
            <Image
              source={tool.img}
              style={{ width: HEX_SIZE, height: HEX_SIZE, transform: [{ scale: ICON_ZOOM }] }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── ColmeiaScreen ─────────────────────────────────────────────────────────────

export default function ColmeiaScreen() {
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeSection, setActiveSection] = useState<ToolId | null>(null);

  const activeTool = activeSection ? COLMEIA_TOOLS.find(t => t.id === activeSection) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {activeSection ? (
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            onPress={() => setActiveSection(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
          >
            <Feather name="arrow-left" size={20} color={activeTool?.color ?? colors.primaryDark} />
            <Text style={[styles.headerTitle, { color: activeTool?.color ?? colors.foreground, fontSize: 20 }]}>
              {activeTool?.label}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.headerTitle}>🍯 Colmeia</Text>
            <Text style={styles.headerSubtitle}>Seus utilitários pessoais</Text>
          </>
        )}
      </View>

      {activeSection === null ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.toolsContent, { paddingBottom: insets.bottom + 108 }]}>
          <View style={styles.toolsIntro}>
            <View>
              <Text style={styles.toolsTitle}>Sua Colmeia</Text>
              <Text style={styles.toolsSubtitle}>Ferramentas pessoais da Bee</Text>
            </View>
            <View style={styles.toolsBadge}>
              <Text style={styles.toolsBadgeText}>{COLMEIA_TOOLS.length} ativas</Text>
            </View>
          </View>
          <View style={styles.toolsGrid}>
            {COLMEIA_TOOLS.map((tool) => (
              <TouchableOpacity key={tool.id} activeOpacity={0.78} onPress={() => tool.id === "house" ? router.push("/casa-da-bee" as never) : setActiveSection(tool.id)} style={styles.toolCard}>
                {tool.img ? (
                  <Image source={tool.img} style={styles.toolCardImage} resizeMode="contain" />
                ) : (
                  <View style={[styles.toolCardIconBg, { backgroundColor: tool.color + "22" }]}>
                    <Feather name={tool.iconName as any} size={36} color={tool.color} />
                  </View>
                )}
                <Text style={styles.toolCardLabel}>{tool.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeSection === "calendar" && <CalendarSection colors={colors} styles={styles} />}
          {activeSection === "finance" && <FinanceSection colors={colors} styles={styles} />}
          {activeSection === "clock" && <ClockSection colors={colors} />}
          {activeSection === "notes" && <NotesSection colors={colors} />}
          {activeSection === "health" && <HealthCoachSection colors={colors} />}
          {activeSection === "wishlist" && <WishlistSection colors={colors} />}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: colors.card + "EE",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowColor: "#4B3508",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: FONTS.display,
      color: colors.foreground,
      fontWeight: "800",
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    toolsContent: { padding: 20 },
    toolsIntro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    toolsTitle: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "900", color: colors.foreground },
    toolsSubtitle: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
    toolsBadge: { borderWidth: 1, borderColor: colors.primary + "44", backgroundColor: colors.primary + "18", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    toolsBadgeText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "800", color: colors.primaryDark },
    toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    toolCard: { width: "47.8%", aspectRatio: 1, borderRadius: 22, borderWidth: 1, borderColor: colors.primary + "26", backgroundColor: colors.card + "F2", alignItems: "center", justifyContent: "center", gap: 12, shadowColor: "#4B3508", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 6 },
    toolCardImage: { width: 72, height: 72 },
    toolCardIconBg: { width: 72, height: 72, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    toolCardLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: colors.foreground },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16 },
  });
}

const localStyles = StyleSheet.create({
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    marginLeft: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flex: 1,
  },
  badgeText: { fontSize: 12, fontFamily: FONTS.sans },
  btnSm: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnSmText: { fontSize: 12 },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnOutlineText: { fontSize: 14, fontFamily: FONTS.sans },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontFamily: FONTS.sans },
  emptyText: { textAlign: "center", marginTop: 20, marginBottom: 20, fontSize: 14 },
  listHeader: {
    fontSize: 11,
    fontFamily: FONTS.sans,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  eventItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTitle: { fontSize: 14, fontFamily: FONTS.sans },
  eventMeta: { fontSize: 12, marginTop: 2 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  monthText: { fontSize: 15 },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  summaryLabel: { fontSize: 10, fontFamily: FONTS.sans },
  summaryValue: { fontSize: 12 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  categoryName: { fontSize: 12, width: 90 },
  categoryBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  categoryBar: { height: 6, borderRadius: 3 },
  categoryAmount: { fontSize: 11, width: 70, textAlign: "right" },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  txDot: { width: 10, height: 10, borderRadius: 5 },
  txDescription: { fontSize: 14 },
  txMeta: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 13 },
  typeToggle: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  typeBtnText: { fontSize: 14, fontFamily: FONTS.sans },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  dateField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  inputLabel: { fontSize: 12, marginBottom: 6 },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 6,
  },
  categoryChipText: { fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18 },
});
