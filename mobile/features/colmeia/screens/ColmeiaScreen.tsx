import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Linking, Modal, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const EXPENSE_CATEGORIES = ["alimentação", "transporte", "lazer", "saúde", "moradia", "educação", "outros"];
const INCOME_CATEGORIES = ["salário", "freelance", "investimento", "presente", "outros"];

// ── Calendar Section ──────────────────────────────────────────────────────────

function CalendarSection({ colors, styles }: { colors: any; styles: any }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    location: "",
    allDay: false,
  });

  const loadEvents = useCallback(async () => {
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
      const res = await api.get(`/api/colmeia/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setEvents(res.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGoogleStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/colmeia/google/status");
      setGoogleConnected(res.data?.connected ?? false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadGoogleStatus();
  }, [loadEvents, loadGoogleStatus]);

  const handleConnectGoogle = async () => {
    setGoogleConnecting(true);
    try {
      const res = await api.get("/api/colmeia/google/auth-url");
      if (res.data?.url) {
        await Linking.openURL(res.data.url);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a conexão com Google.");
    } finally {
      setGoogleConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    Alert.alert("Desconectar", "Deseja remover a integração com Google Calendar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desconectar",
        style: "destructive",
        onPress: async () => {
          await api.delete("/api/colmeia/google/disconnect").catch(() => {});
          setGoogleConnected(false);
        },
      },
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
        allDay: newEvent.allDay,
      });
      setEvents((prev) => [...prev, res.data].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
      setShowAddEvent(false);
      setNewEvent({ title: "", description: "", startAt: "", endAt: "", location: "", allDay: false });
    } catch {
      Alert.alert("Erro", "Não foi possível criar o evento.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = (id: string, title: string) => {
    Alert.alert("Apagar evento", `Apagar "${title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/api/colmeia/events/${id}`).catch(() => {});
          setEvents((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  };

  const upcoming = events.filter((e) => new Date(e.startAt) >= new Date()).slice(0, 10);
  const past = events.filter((e) => new Date(e.startAt) < new Date()).slice(-5);

  return (
    <View>
      {/* Google Calendar Integration */}
      <View style={[localStyles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={localStyles.row}>
          <Feather name="calendar" size={18} color={colors.primaryDark} />
          <Text style={[localStyles.sectionTitle, { color: colors.foreground, fontFamily: FONTS.semibold }]}>
            Google Calendar
          </Text>
        </View>
        {googleConnected ? (
          <View style={localStyles.row}>
            <View style={[localStyles.badge, { backgroundColor: "#10B98122" }]}>
              <Feather name="check-circle" size={13} color="#10B981" />
              <Text style={[localStyles.badgeText, { color: "#10B981" }]}>Conectado</Text>
            </View>
            <TouchableOpacity onPress={handleDisconnectGoogle} style={[localStyles.btnSm, { borderColor: colors.border }]}>
              <Text style={[localStyles.btnSmText, { color: colors.muted }]}>Desconectar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[localStyles.btnOutline, { borderColor: colors.primaryDark }]}
            onPress={handleConnectGoogle}
            disabled={googleConnecting}
          >
            {googleConnecting ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <>
                <Feather name="link" size={14} color={colors.primaryDark} />
                <Text style={[localStyles.btnOutlineText, { color: colors.primaryDark }]}>Conectar Google Calendar</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Add Event Button */}
      <TouchableOpacity
        style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark }]}
        onPress={() => setShowAddEvent(true)}
      >
        <Feather name="plus" size={16} color="#fff" />
        <Text style={localStyles.btnPrimaryText}>Novo Evento</Text>
      </TouchableOpacity>

      {/* Upcoming Events */}
      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryDark} style={{ marginTop: 20 }} />
      ) : upcoming.length === 0 ? (
        <Text style={[localStyles.emptyText, { color: colors.muted }]}>Nenhum evento próximo</Text>
      ) : (
        <View>
          <Text style={[localStyles.listHeader, { color: colors.muted }]}>PRÓXIMOS</Text>
          {upcoming.map((ev) => (
            <View key={ev.id} style={[localStyles.eventItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[localStyles.eventDot, { backgroundColor: EVENT_COLORS[ev.color ?? "primary"] ?? EVENT_COLORS.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[localStyles.eventTitle, { color: colors.foreground }]}>{ev.title}</Text>
                <Text style={[localStyles.eventMeta, { color: colors.muted }]}>
                  {ev.allDay ? formatDate(ev.startAt) : formatDateTime(ev.startAt)}
                  {ev.location ? ` · ${ev.location}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteEvent(ev.id, ev.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="trash-2" size={15} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {past.length > 0 && (
        <View>
          <Text style={[localStyles.listHeader, { color: colors.muted }]}>ANTERIORES</Text>
          {past.map((ev) => (
            <View key={ev.id} style={[localStyles.eventItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.6 }]}>
              <View style={[localStyles.eventDot, { backgroundColor: colors.muted }]} />
              <View style={{ flex: 1 }}>
                <Text style={[localStyles.eventTitle, { color: colors.foreground }]}>{ev.title}</Text>
                <Text style={[localStyles.eventMeta, { color: colors.muted }]}>
                  {ev.allDay ? formatDate(ev.startAt) : formatDateTime(ev.startAt)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteEvent(ev.id, ev.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="trash-2" size={15} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Add Event Modal */}
      <Modal visible={showAddEvent} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { backgroundColor: colors.card }]}>
            <View style={localStyles.modalHeader}>
              <Text style={[localStyles.modalTitle, { color: colors.foreground, fontFamily: FONTS.bold }]}>Novo Evento</Text>
              <TouchableOpacity onPress={() => setShowAddEvent(false)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Título *"
              placeholderTextColor={colors.muted}
              value={newEvent.title}
              onChangeText={(v) => setNewEvent((p) => ({ ...p, title: v }))}
            />
            <TextInput
              style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Início (AAAA-MM-DD HH:MM) *"
              placeholderTextColor={colors.muted}
              value={newEvent.startAt}
              onChangeText={(v) => setNewEvent((p) => ({ ...p, startAt: v }))}
            />
            <TextInput
              style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Fim (AAAA-MM-DD HH:MM)"
              placeholderTextColor={colors.muted}
              value={newEvent.endAt}
              onChangeText={(v) => setNewEvent((p) => ({ ...p, endAt: v }))}
            />
            <TextInput
              style={[localStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Local"
              placeholderTextColor={colors.muted}
              value={newEvent.location}
              onChangeText={(v) => setNewEvent((p) => ({ ...p, location: v }))}
            />
            <TextInput
              style={[localStyles.input, localStyles.inputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Descrição"
              placeholderTextColor={colors.muted}
              value={newEvent.description}
              onChangeText={(v) => setNewEvent((p) => ({ ...p, description: v }))}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark, marginTop: 4 }]}
              onPress={handleAddEvent}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={localStyles.btnPrimaryText}>Salvar Evento</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
        <Text style={[localStyles.monthText, { color: colors.foreground, fontFamily: FONTS.semibold }]}>
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
                <Text style={[localStyles.summaryValue, { color: "#10B981", fontFamily: FONTS.bold }]}>
                  {formatCurrency(summary.totalIncome)}
                </Text>
              </View>
              <View style={[localStyles.summaryCard, { backgroundColor: "#EF444415", borderColor: "#EF444433" }]}>
                <Feather name="arrow-down-circle" size={18} color="#EF4444" />
                <Text style={[localStyles.summaryLabel, { color: "#EF4444" }]}>Despesas</Text>
                <Text style={[localStyles.summaryValue, { color: "#EF4444", fontFamily: FONTS.bold }]}>
                  {formatCurrency(summary.totalExpense)}
                </Text>
              </View>
              <View style={[localStyles.summaryCard, {
                backgroundColor: summary.balance >= 0 ? "#3B82F615" : "#F9731615",
                borderColor: summary.balance >= 0 ? "#3B82F633" : "#F9731633",
              }]}>
                <Feather name="trending-up" size={18} color={summary.balance >= 0 ? "#3B82F6" : "#F97316"} />
                <Text style={[localStyles.summaryLabel, { color: summary.balance >= 0 ? "#3B82F6" : "#F97316" }]}>Saldo</Text>
                <Text style={[localStyles.summaryValue, { color: summary.balance >= 0 ? "#3B82F6" : "#F97316", fontFamily: FONTS.bold }]}>
                  {formatCurrency(Math.abs(summary.balance))}
                </Text>
              </View>
            </View>
          )}

          {/* Category Breakdown */}
          {summary && Object.keys(summary.byCategory).length > 0 && (
            <View style={[localStyles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[localStyles.sectionTitle, { color: colors.foreground, fontFamily: FONTS.semibold }]}>Por categoria</Text>
              {Object.entries(summary.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, cents]) => (
                  <View key={cat} style={localStyles.categoryRow}>
                    <Text style={[localStyles.categoryName, { color: colors.foreground }]}>{cat}</Text>
                    <View style={[localStyles.categoryBarBg, { backgroundColor: colors.border }]}>
                      <View style={[localStyles.categoryBar, {
                        backgroundColor: colors.primaryDark,
                        width: `${Math.min(100, Math.round((cents / summary.totalExpense) * 100))}%`,
                      }]} />
                    </View>
                    <Text style={[localStyles.categoryAmount, { color: colors.muted }]}>{formatCurrency(cents)}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Add Transaction */}
          <TouchableOpacity
            style={[localStyles.btnPrimary, { backgroundColor: colors.primaryDark }]}
            onPress={() => setShowAdd(true)}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={localStyles.btnPrimaryText}>Registrar Transação</Text>
          </TouchableOpacity>

          {/* Transactions List */}
          {transactions.length === 0 ? (
            <Text style={[localStyles.emptyText, { color: colors.muted }]}>Nenhuma transação neste mês</Text>
          ) : (
            <View>
              <Text style={[localStyles.listHeader, { color: colors.muted }]}>TRANSAÇÕES</Text>
              {transactions.map((tx) => (
                <View key={tx.id} style={[localStyles.txItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[localStyles.txDot, { backgroundColor: tx.type === "income" ? "#10B981" : "#EF4444" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.txDescription, { color: colors.foreground }]}>
                      {tx.description ?? tx.category}
                    </Text>
                    <Text style={[localStyles.txMeta, { color: colors.muted }]}>
                      {tx.category} · {formatDate(tx.date)}
                    </Text>
                  </View>
                  <Text style={[localStyles.txAmount, { color: tx.type === "income" ? "#10B981" : "#EF4444", fontFamily: FONTS.semibold }]}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amountCents)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteTransaction(tx.id, tx.description)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 8 }}
                  >
                    <Feather name="trash-2" size={14} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Add Transaction Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { backgroundColor: colors.card }]}>
            <View style={localStyles.modalHeader}>
              <Text style={[localStyles.modalTitle, { color: colors.foreground, fontFamily: FONTS.bold }]}>Nova Transação</Text>
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

// ── ColmeiaScreen ─────────────────────────────────────────────────────────────

export default function ColmeiaScreen() {
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<"calendar" | "finance">("calendar");

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🍯 Colmeia</Text>
        <Text style={styles.headerSubtitle}>Seus utilitários pessoais</Text>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabSwitcher, { backgroundColor: colors.secondary }]}>
        <TouchableOpacity
          style={[styles.tabSwitcherBtn, activeTab === "calendar" && { backgroundColor: colors.card }]}
          onPress={() => setActiveTab("calendar")}
        >
          <Feather name="calendar" size={14} color={activeTab === "calendar" ? colors.primaryDark : colors.muted} />
          <Text style={[styles.tabSwitcherText, { color: activeTab === "calendar" ? colors.primaryDark : colors.muted }]}>
            Calendário
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabSwitcherBtn, activeTab === "finance" && { backgroundColor: colors.card }]}
          onPress={() => setActiveTab("finance")}
        >
          <Feather name="dollar-sign" size={14} color={activeTab === "finance" ? colors.primaryDark : colors.muted} />
          <Text style={[styles.tabSwitcherText, { color: activeTab === "finance" ? colors.primaryDark : colors.muted }]}>
            Finanças
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "calendar" ? (
          <CalendarSection colors={colors} styles={styles} />
        ) : (
          <FinanceSection colors={colors} styles={styles} />
        )}
      </ScrollView>
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
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: FONTS.bold,
      color: colors.foreground,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    tabSwitcher: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      padding: 3,
    },
    tabSwitcherBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
    },
    tabSwitcherText: {
      fontSize: 13,
      fontFamily: FONTS.semibold,
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
  badgeText: { fontSize: 12, fontFamily: FONTS.semibold },
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
  btnOutlineText: { fontSize: 14, fontFamily: FONTS.semibold },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontFamily: FONTS.semibold },
  emptyText: { textAlign: "center", marginTop: 20, marginBottom: 20, fontSize: 14 },
  listHeader: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
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
  eventTitle: { fontSize: 14, fontFamily: FONTS.semibold },
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
  summaryLabel: { fontSize: 10, fontFamily: FONTS.semibold },
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
  typeBtnText: { fontSize: 14, fontFamily: FONTS.semibold },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
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
