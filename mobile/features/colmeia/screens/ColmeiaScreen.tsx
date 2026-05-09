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
import { api } from "@mobile/lib/api";
import { CHANNEL, requestNotificationPermission } from "@mobile/lib/notifications";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

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

type ToolId = "calendar" | "finance" | "clock" | "notes";

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

interface ColmeiaTool { id: ToolId; label: string; img: number; color: string }

const COLMEIA_TOOLS: ColmeiaTool[] = [
  { id: "calendar", label: "Calendário", img: require("../../../assets/icons-colmeia/calendario.png"),  color: "#FFD940" },
  { id: "finance",  label: "Finanças",   img: require("../../../assets/icons-colmeia/financas.png"),    color: "#10B981" },
  { id: "notes",    label: "Notas",      img: require("../../../assets/icons-colmeia/notas.png"),       color: "#8B5CF6" },
  { id: "clock",    label: "Alarmes",    img: require("../../../assets/icons-colmeia/alarmes.png"),     color: "#F97316" },
];

// 6 positions around center (degrees, clockwise from top).
// null = "em breve" placeholder — replace with a ToolId when adding a new tool.
const HEX_ANGLES = [-90, -30, 30, 90, 150, 210] as const;
const HEX_LAYOUT: Array<ToolId | null> = [
  "calendar", // top
  "clock",    // top-right
  "finance",  // bottom-right
  null,       // bottom      — coming soon
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

function CalendarSection({ colors, styles }: { colors: any; styles: any }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
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

  const loadGoogleStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/colmeia/google/status");
      setGoogleConnected(res.data?.connected ?? false);
    } catch { /* ignore */ }
  }, []);

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

  const selectedDayEvents = useMemo(() => {
    if (selectedDay == null) return [];
    return events.filter((ev) => {
      const d = new Date(ev.startAt);
      return d.getDate() === selectedDay && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  }, [events, selectedDay, viewMonth, viewYear]);

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
                  {hasEvt && (
                    <View style={[calStyles.evtDot, { backgroundColor: isSelected ? "#1A1A1A" : colors.primaryDark }]} />
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

          {selectedDayEvents.length === 0 ? (
            <Text style={[calStyles.emptyDay, { color: colors.muted }]}>Nenhum evento neste dia</Text>
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
    </View>
  );
}

const calStyles = StyleSheet.create({
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

function alarmKindLabel(kind: AlarmReminder["kind"]) {
  if (kind === "medicine") return "Remedio";
  if (kind === "appointment") return "Compromisso";
  return "Despertador";
}

function alarmRepeatLabel(alarm: AlarmReminder) {
  if (alarm.repeatDays?.length) {
    return alarm.repeatDays
      .map((day) => ALARM_WEEK_DAYS.find((item) => item.value === day)?.label)
      .filter(Boolean)
      .join(", ");
  }
  if (alarm.repeatType === "daily") return "Diario";
  if (alarm.repeatType === "weekly") return "Semanal";
  if (alarm.repeatType === "interval") return `A cada ${alarm.intervalMinutes ?? 60} min`;
  return "Uma vez";
}

function alarmBody(alarm: Pick<AlarmReminder, "kind" | "title" | "message">) {
  if (alarm.message?.trim()) return alarm.message.trim();
  if (alarm.kind === "medicine") return `Hora de tomar: ${alarm.title}`;
  if (alarm.kind === "appointment") return `Compromisso agora: ${alarm.title}`;
  return alarm.title;
}

async function cancelNativeAlarmNotifications(localNotificationId?: string | null) {
  if (!localNotificationId) return;
  let ids = [localNotificationId];
  try {
    const parsed = JSON.parse(localNotificationId);
    if (Array.isArray(parsed)) ids = parsed.filter((id) => typeof id === "string");
  } catch {
    // Legacy single notification id.
  }
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

async function scheduleNativeAlarm(alarm: Pick<AlarmReminder, "id" | "title" | "message" | "kind" | "nextTriggerAt" | "repeatType" | "intervalMinutes" | "repeatDays">) {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const date = new Date(alarm.nextTriggerAt);
  if (date.getTime() <= Date.now()) return null;

  const content = {
    title: `BeeEyes · ${alarmKindLabel(alarm.kind)}`,
    body: alarmBody(alarm),
    data: { source: "bee-alarm", screen: "/(tabs)/colmeia", alarmId: alarm.id },
    sound: true,
    ...(Platform.OS === "android" && { channelId: CHANNEL.ALARMS }),
  };

  if (alarm.repeatDays?.length) {
    const ids = await Promise.all(alarm.repeatDays.map((day) =>
      Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1,
          hour: date.getHours(),
          minute: date.getMinutes(),
        },
      })
    ));
    return JSON.stringify(ids);
  }

  if (alarm.repeatType === "interval") {
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(60, (alarm.intervalMinutes ?? 60) * 60),
        repeats: true,
      },
    });
  }

  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

function ClockSection({ colors }: { colors: any }) {
  const [alarms, setAlarms] = useState<AlarmReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    kind: "alarm" as AlarmReminder["kind"],
    scheduledAt: "",
    repeatDays: [] as number[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/colmeia/alarms");
      const rows: AlarmReminder[] = res.data ?? [];
      setAlarms(rows);
      for (const alarm of rows) {
        if (!alarm.active || alarm.localNotificationId || new Date(alarm.nextTriggerAt).getTime() <= Date.now()) continue;
        const localId = await scheduleNativeAlarm(alarm);
        if (localId) {
          await api.patch(`/api/colmeia/alarms/${alarm.id}`, { localNotificationId: localId }).catch(() => {});
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAlarm = async () => {
    if (!form.title.trim() || !form.scheduledAt.trim()) {
      Alert.alert("Atenção", "Informe o nome e a data/hora do alarme.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim() || null,
        kind: form.kind,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        repeatType: form.repeatDays.length > 0 ? "weekly" : "once",
        repeatDays: form.repeatDays,
        intervalMinutes: null,
      };
      const res = await api.post("/api/colmeia/alarms", payload);
      const created: AlarmReminder = res.data;
      const localId = await scheduleNativeAlarm(created);
      if (localId) {
        await api.patch(`/api/colmeia/alarms/${created.id}`, { localNotificationId: localId }).catch(() => {});
        created.localNotificationId = localId;
      }
      Vibration.vibrate([0, 80, 80, 80]);
      setAlarms((prev) => [created, ...prev]);
      setForm({ title: "", message: "", kind: "alarm", scheduledAt: "", repeatDays: [] });
      setShowAdd(false);
    } catch {
      Alert.alert("Erro", "Não foi possível criar o alarme.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAlarm = async (alarm: AlarmReminder) => {
    const nextActive = !alarm.active;
    try {
      if (!nextActive && alarm.localNotificationId) {
        await cancelNativeAlarmNotifications(alarm.localNotificationId);
      }
      const res = await api.patch(`/api/colmeia/alarms/${alarm.id}`, { active: nextActive, localNotificationId: nextActive ? alarm.localNotificationId ?? null : null });
      const updated: AlarmReminder = res.data;
      if (nextActive && !updated.localNotificationId) {
        const localNotificationId = await scheduleNativeAlarm(updated);
        if (localNotificationId) {
          const withNotification = await api.patch(`/api/colmeia/alarms/${alarm.id}`, { localNotificationId });
          setAlarms((prev) => prev.map((item) => item.id === alarm.id ? withNotification.data : item));
          return;
        }
      }
      setAlarms((prev) => prev.map((item) => item.id === alarm.id ? updated : item));
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar o alarme.");
    }
  };

  const deleteAlarm = (alarm: AlarmReminder) => {
    Alert.alert("Excluir alarme", `Excluir "${alarm.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        await cancelNativeAlarmNotifications(alarm.localNotificationId);
        await api.delete(`/api/colmeia/alarms/${alarm.id}`).catch(() => {});
        setAlarms((prev) => prev.filter((item) => item.id !== alarm.id));
      }},
    ]);
  };

  return (
    <View>
      <View style={[alarmStyles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={localStyles.row}>
          <Feather name="clock" size={18} color={colors.primaryDark} />
          <Text style={[alarmStyles.heroTitle, { color: colors.foreground }]}>Relogio inteligente</Text>
        </View>
        <Text style={[alarmStyles.heroText, { color: colors.muted }]}>Despertadores locais com som e vibracao para remedios, periodos e compromissos.</Text>
        <TouchableOpacity style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark, marginBottom: 0 }]} onPress={() => setShowAdd((v) => !v)}>
          <Text style={localStyles.btnPrimaryText}>Novo alarme</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={[alarmStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={alarmStyles.kindRow}>
            {(["alarm", "medicine", "appointment"] as const).map((kind) => (
              <TouchableOpacity
                key={kind}
                style={[alarmStyles.kindBtn, { borderColor: form.kind === kind ? colors.primaryDark : colors.border, backgroundColor: form.kind === kind ? colors.primaryDark + "18" : colors.background }]}
                onPress={() => setForm((p) => ({ ...p, kind }))}
              >
                <Feather name={kind === "medicine" ? "activity" : kind === "appointment" ? "briefcase" : "bell"} size={13} color={form.kind === kind ? colors.primaryDark : colors.muted} />
                <Text style={[alarmStyles.kindText, { color: form.kind === kind ? colors.primaryDark : colors.muted }]}>{alarmKindLabel(kind)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Nome do aviso" placeholderTextColor={colors.muted} value={form.title} onChangeText={(v) => setForm((p) => ({ ...p, title: v }))} />
          <TextInput style={[localStyles.input, localStyles.inputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Mensagem opcional" placeholderTextColor={colors.muted} value={form.message} onChangeText={(v) => setForm((p) => ({ ...p, message: v }))} multiline />
          <TouchableOpacity
            style={[localStyles.input, localStyles.dateField, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={() => setShowAlarmPicker(true)}
          >
            {form.scheduledAt
              ? <Text style={{ color: colors.foreground, fontSize: 15 }}>{new Date(form.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
              : <Text style={{ color: colors.muted, fontSize: 15 }}>Data e hora *</Text>}
            <Feather name="calendar" size={16} color={colors.muted} />
          </TouchableOpacity>
          <Text style={[alarmStyles.sectionLabel, { color: colors.muted }]}>Repeticao</Text>
          <View style={alarmStyles.weekdayGrid}>
            {ALARM_WEEK_DAYS.map((day) => {
              const selected = form.repeatDays.includes(day.value);
              return (
                <TouchableOpacity
                  key={day.value}
                  style={[alarmStyles.weekdayBtn, {
                    borderColor: selected ? colors.primaryDark : colors.border,
                    backgroundColor: selected ? colors.primaryDark + "18" : colors.background,
                  }]}
                  onPress={() => setForm((p) => ({
                    ...p,
                    repeatDays: selected
                      ? p.repeatDays.filter((value) => value !== day.value)
                      : [...p.repeatDays, day.value].sort((a, b) => a - b),
                  }))}
                >
                  <Text style={[alarmStyles.kindText, { color: selected ? colors.primaryDark : colors.muted }]}>{day.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[alarmStyles.repeatHint, { color: colors.muted }]}>Sem dias marcados, toca apenas uma vez.</Text>
          <View style={noteStyles.formActions}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={[noteStyles.cancelText, { color: colors.muted }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[noteStyles.saveBtn, { backgroundColor: colors.primaryDark }]} onPress={createAlarm} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={noteStyles.saveBtnText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <DrumRollDatePicker
        visible={showAlarmPicker}
        value={form.scheduledAt ? new Date(form.scheduledAt) : null}
        title="Data e hora do alarme"
        onConfirm={(date) => {
          const pad = (n: number) => String(n).padStart(2, "0");
          const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
          setForm((p) => ({ ...p, scheduledAt: iso }));
          setShowAlarmPicker(false);
        }}
        onCancel={() => setShowAlarmPicker(false)}
        colors={colors}
      />

      {loading ? (
        <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 24 }} />
      ) : alarms.length === 0 ? (
        <View style={noteStyles.empty}>
          <Feather name="bell" size={32} color={colors.border} />
          <Text style={[noteStyles.emptyTitle, { color: colors.muted }]}>Nenhum alarme ainda</Text>
          <Text style={[noteStyles.emptyHint, { color: colors.muted }]}>Crie avisos para remedios, horarios e compromissos.</Text>
        </View>
      ) : alarms.map((alarm) => (
        <View key={alarm.id} style={[alarmStyles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: alarm.active ? 1 : 0.65 }]}>
          <View style={alarmStyles.alarmHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[alarmStyles.alarmTitle, { color: colors.foreground }]}>{alarm.title}</Text>
              <Text style={[alarmStyles.alarmBody, { color: colors.muted }]}>{alarmBody(alarm)}</Text>
              <Text style={[alarmStyles.alarmMeta, { color: colors.muted }]}>
                {alarm.active ? "Proximo: " : "Pausado - era: "}
                {new Date(alarm.nextTriggerAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {alarmRepeatLabel(alarm)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => toggleAlarm(alarm)} style={[alarmStyles.iconBtn, { borderColor: colors.border }]}>
              <Feather name={alarm.active ? "pause" : "play"} size={15} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteAlarm(alarm)} style={[alarmStyles.iconBtn, { borderColor: colors.border }]}>
              <Feather name="trash-2" size={15} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const alarmStyles = StyleSheet.create({
  hero: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  heroTitle: { fontSize: 15, fontFamily: FONTS.sans },
  heroText: { fontSize: 12, lineHeight: 17 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  kindRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  kindBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center", gap: 4 },
  repeatBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  sectionLabel: { fontSize: 11, marginBottom: 6 },
  weekdayGrid: { flexDirection: "row", gap: 5, marginBottom: 6 },
  weekdayBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  repeatHint: { fontSize: 11, marginBottom: 10 },
  kindText: { fontSize: 11, fontFamily: FONTS.sans },
  alarmHeader: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  alarmTitle: { fontSize: 15, fontFamily: FONTS.sans },
  alarmBody: { fontSize: 12, marginTop: 3 },
  alarmMeta: { fontSize: 11, marginTop: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
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
const HEX_SIZE    = 104;
const CENTER_SIZE = 124;
const HUB_RADIUS  = 108;
const HUB_HEIGHT  = 380;
const ICON_ZOOM   = 1.18;

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function hexPos(angle: number): { left: number; top: number } {
  const cx = HUB_SCREEN_W / 2;
  const cy = HUB_HEIGHT / 2;
  return {
    left: cx + HUB_RADIUS * Math.cos(toRad(angle)) - HEX_SIZE / 2,
    top:  cy + HUB_RADIUS * Math.sin(toRad(angle)) - HEX_SIZE / 2,
  };
}

function ColmeiaHub({ colors, onSelect }: { colors: any; onSelect: (id: ToolId) => void }) {
  const cx = HUB_SCREEN_W / 2;
  const cy = HUB_HEIGHT / 2;

  return (
    <View style={{ width: HUB_SCREEN_W, height: HUB_HEIGHT }}>
      {/* Center — Bee */}
      <View style={{
        position: "absolute",
        width: CENTER_SIZE, height: CENTER_SIZE,
        left: cx - CENTER_SIZE / 2, top: cy - CENTER_SIZE / 2,
        borderRadius: CENTER_SIZE * 0.24,
        backgroundColor: colors.card,
        borderWidth: 1, borderColor: "#FFD94066",
        overflow: "hidden",
        shadowColor: "#B98005", shadowOpacity: 0.28, shadowRadius: 24, elevation: 14,
      }}>
        <Image
          source={require("../../../assets/icons-colmeia/icone-central.png")}
          style={{ width: CENTER_SIZE, height: CENTER_SIZE, transform: [{ scale: ICON_ZOOM }] }}
          resizeMode="cover"
        />
      </View>

      {/* Tool cells */}
      {HEX_LAYOUT.map((toolId, idx) => {
        const pos = hexPos(HEX_ANGLES[idx]);
        const tool = toolId ? COLMEIA_TOOLS.find(t => t.id === toolId) : null;
        return (
          <TouchableOpacity
            key={idx}
            disabled={!tool}
            activeOpacity={0.72}
            onPress={() => tool && onSelect(tool.id)}
            style={{
              position: "absolute",
              width: HEX_SIZE, height: HEX_SIZE,
              left: pos.left, top: pos.top,
              borderRadius: HEX_SIZE * 0.23,
              backgroundColor: tool ? "transparent" : colors.secondary,
              borderWidth: 1,
              borderColor: tool ? "#FFFFFF66" : colors.border,
              overflow: "hidden",
              shadowColor: tool ? tool.color : "transparent",
              shadowOpacity: tool ? 0.22 : 0,
              shadowRadius: 14, elevation: tool ? 8 : 1,
              opacity: tool ? 1 : 0.3,
            }}
          >
            {tool ? (
              <Image
                source={tool.img}
                style={{ width: HEX_SIZE, height: HEX_SIZE, transform: [{ scale: ICON_ZOOM }] }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }} />
            )}
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24, alignItems: "center" }}>
          <ColmeiaHub colors={colors} onSelect={setActiveSection} />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: "center", fontFamily: FONTS.sans, fontWeight: "700" }}>
            Selecione uma ferramenta
          </Text>
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
      backgroundColor: colors.card,
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
