import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "@mobile/lib/api";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";
import { WISHLIST_CATEGORIES, WISHLIST_STATUS_LABELS, type WishlistStatus } from "@shared/wishlist";

interface WishlistItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  originalUrl: string | null;
  category: string;
  priceCents: number | null;
  currency: string;
  brand: string | null;
  storeName: string | null;
  status: WishlistStatus;
  personalNote: string | null;
  interestScore: number;
  priority: string;
  createdAt: string;
}

interface UserInterest {
  id: string;
  interestName: string;
  score: number;
}

interface WishlistPreferences {
  allowPersonalizedRecommendations: boolean;
  allowPriceAlerts: boolean;
  allowBeeNotifications: boolean;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priceCents?: number;
  brand?: string;
  reason: string;
}

function money(cents?: number | null, currency = "BRL") {
  if (typeof cents !== "number") return "Preço não informado";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function savedAt(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `${days} dias atrás`;
}

export function WishlistSection({ colors }: { colors: ReturnType<typeof getThemeColors> }) {
  const themeMode = useUIStore((s) => s.themeMode);
  const liveColors = getThemeColors(themeMode);
  const c = colors ?? liveColors;
  const styles = makeStyles(c);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [preferences, setPreferences] = useState<WishlistPreferences | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selected, setSelected] = useState<WishlistItem | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [beeMessage, setBeeMessage] = useState("A Bee só usa itens que você salvou voluntariamente.");

  const stats = useMemo(() => ({
    total: items.length,
    interested: items.filter((item) => ["interested", "buy_later", "comparing"].includes(item.status)).length,
    purchased: items.filter((item) => item.status === "purchased").length,
  }), [items]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      const { data } = await api.get(`/api/wishlist?${params.toString()}`);
      setItems(data.items ?? []);
      setInterests(data.interests ?? []);
      setPreferences(data.preferences ?? null);
      setRecommendations(data.recommendations ?? []);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar sua Lista de Desejos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [search, category, status, sort]);

  async function patchItem(id: string, body: Partial<WishlistItem>) {
    const { data } = await api.patch(`/api/wishlist/items/${id}`, body);
    setItems((prev) => prev.map((item) => item.id === id ? data : item));
    setSelected((current) => current?.id === id ? data : current);
    return data as WishlistItem;
  }

  async function removeItem(id: string) {
    await api.delete(`/api/wishlist/items/${id}`);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelected(null);
    setBeeMessage("Removi da lista. Você está no controle.");
  }

  async function addRecommendation(rec: Recommendation) {
    const { data } = await api.post("/api/wishlist/items", {
      title: rec.title,
      description: rec.description,
      category: rec.category,
      priceCents: rec.priceCents,
      brand: rec.brand,
      sourceType: "recommendation",
      metadata: { recommendationId: rec.id, reason: rec.reason },
    });
    setBeeMessage(data.message ?? "Prontinho! Salvei isso na sua Lista de Desejos 🐝");
    await load();
  }

  async function updatePreferences(body: Partial<WishlistPreferences>) {
    const { data } = await api.patch("/api/wishlist/settings", body);
    setPreferences(data);
    setBeeMessage(data.allowPersonalizedRecommendations ? "Personalização ativada com transparência." : "Personalização desativada.");
  }

  async function clearInterests() {
    await api.post("/api/wishlist/interests/clear");
    setInterests([]);
    setBeeMessage("Interesses limpos. A Bee recomeça daqui.");
  }

  async function clearWishlist() {
    Alert.alert("Apagar lista", "Deseja apagar toda a Lista de Desejos?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => {
        await api.delete("/api/wishlist/items");
        setItems([]);
      }},
    ]);
  }

  async function shareItem(item: WishlistItem) {
    await Share.share({ message: `${item.title}${item.originalUrl ? `\n${item.originalUrl}` : ""}` });
  }

  async function saveNote() {
    if (!selected) return;
    await patchItem(selected.id, { personalNote: note });
    setBeeMessage("Observação salva.");
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={require("../../../assets/icons-colmeia/lista-desejos.png")} style={styles.heroIcon} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Lista de Desejos</Text>
          <Text style={styles.subtitle}>Salve produtos, cursos, serviços e anúncios para ver depois.</Text>
        </View>
      </View>
      <View style={styles.beeNote}>
        <Feather name="shield" size={14} color={c.primaryDark} />
        <Text style={styles.beeNoteText}>{beeMessage}</Text>
      </View>
      <View style={styles.statsRow}>
        <Stat styles={styles} label="Salvos" value={stats.total} />
        <Stat styles={styles} label="Interesse" value={stats.interested} />
        <Stat styles={styles} label="Comprados" value={stats.purchased} />
      </View>

      <View style={styles.filtersCard}>
        <View style={styles.searchRow}>
          <Feather name="search" size={15} color={c.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Buscar..." placeholderTextColor={c.muted} style={styles.searchInput} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip active={!category} label="Todas" onPress={() => setCategory("")} styles={styles} />
          {WISHLIST_CATEGORIES.map((cat) => <Chip key={cat} active={category === cat} label={cat} onPress={() => setCategory(cat)} styles={styles} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip active={!status} label="Todos status" onPress={() => setStatus("")} styles={styles} />
          {Object.entries(WISHLIST_STATUS_LABELS).map(([key, label]) => <Chip key={key} active={status === key} label={label} onPress={() => setStatus(key)} styles={styles} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {[
            ["recent", "Mais recente"],
            ["oldest", "Mais antigo"],
            ["interest", "Maior interesse"],
            ["price_asc", "Menor preço"],
          ].map(([value, label]) => <Chip key={value} active={sort === value} label={label} onPress={() => setSort(value)} styles={styles} />)}
        </ScrollView>
      </View>

      {items.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <Feather name="heart" size={28} color={c.primaryDark} />
          <Text style={styles.emptyTitle}>Sua lista ainda está vazia</Text>
          <Text style={styles.emptyText}>Quando aparecer um anúncio ou recomendação, toque em “Adicionar à Lista de Desejos”.</Text>
        </View>
      ) : null}

      {items.map((item) => (
        <WishlistCard
          key={item.id}
          item={item}
          styles={styles}
          colors={c}
          onOpen={() => { setSelected(item); setNote(item.personalNote ?? ""); }}
          onRemove={() => removeItem(item.id)}
          onShare={() => shareItem(item)}
          onStatus={(next) => patchItem(item.id, { status: next })}
        />
      ))}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Meus interesses</Text>
        <Text style={styles.privacyText}>A Bee usa os itens salvos para recomendações úteis. Você pode apagar ou desativar isso quando quiser.</Text>
        <View style={styles.interestWrap}>
          {interests.length === 0 ? <Text style={styles.mutedText}>Nenhum interesse ativo ainda.</Text> : null}
          {interests.slice(0, 12).map((interest) => (
            <TouchableOpacity
              key={interest.id}
              style={styles.interestChip}
              onPress={async () => {
                await api.delete(`/api/wishlist/interests/${interest.id}`);
                setInterests((prev) => prev.filter((item) => item.id !== interest.id));
              }}
            >
              <Text style={styles.interestText}>{interest.interestName} · {interest.score}</Text>
              <Feather name="x" size={12} color={c.primaryDark} />
            </TouchableOpacity>
          ))}
        </View>
        <Toggle styles={styles} label="Recomendações personalizadas" active={preferences?.allowPersonalizedRecommendations ?? false} onPress={() => updatePreferences({ allowPersonalizedRecommendations: !(preferences?.allowPersonalizedRecommendations ?? false) })} />
        <Toggle styles={styles} label="Alertas de preço" active={preferences?.allowPriceAlerts ?? false} onPress={() => updatePreferences({ allowPriceAlerts: !(preferences?.allowPriceAlerts ?? false) })} />
        <Toggle styles={styles} label="Notificações da Bee" active={preferences?.allowBeeNotifications ?? false} onPress={() => updatePreferences({ allowBeeNotifications: !(preferences?.allowBeeNotifications ?? false) })} />
        <View style={styles.dangerRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={clearInterests}><Text style={styles.secondaryBtnText}>Limpar interesses</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dangerBtn} onPress={clearWishlist}><Text style={styles.dangerBtnText}>Apagar lista</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Talvez você também goste</Text>
        {recommendations.map((rec) => (
          <View key={rec.id} style={styles.recCard}>
            <Text style={styles.recTitle}>{rec.title}</Text>
            <Text style={styles.recText}>{rec.description}</Text>
            <Text style={styles.reasonText}>{rec.reason}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => addRecommendation(rec)}>
              <Text style={styles.primaryBtnText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Pergunte para a Bee</Text>
        {["Qual desses produtos parece melhor?", "Organize minha lista por prioridade.", "O que posso deixar para depois?"].map((prompt) => (
          <View key={prompt} style={styles.promptPill}><Text style={styles.promptText}>{prompt}</Text></View>
        ))}
      </View>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalCategory}>{selected?.category}</Text>
                <Text style={styles.modalTitle}>{selected?.title}</Text>
                <Text style={styles.modalMeta}>Salvo {selected ? savedAt(selected.createdAt) : ""}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.iconBtn}><Feather name="x" size={18} color={c.foreground} /></TouchableOpacity>
            </View>
            {selected?.imageUrl ? <Image source={{ uri: selected.imageUrl }} style={styles.modalImage} /> : null}
            <Text style={styles.modalDescription}>{selected?.description ?? "Sem descrição."}</Text>
            <View style={styles.infoGrid}>
              <Info styles={styles} label="Preço" value={money(selected?.priceCents, selected?.currency)} />
              <Info styles={styles} label="Status" value={selected ? WISHLIST_STATUS_LABELS[selected.status] : ""} />
              <Info styles={styles} label="Loja" value={selected?.storeName ?? selected?.brand ?? "Não informado"} />
              <Info styles={styles} label="Prioridade" value={selected?.priority === "low" ? "Pode esperar" : selected?.priority === "high" ? "Alta" : "Média"} />
            </View>
            <Text style={styles.reasonBox}>Motivo sugerido: combina com itens de {selected?.category?.toLowerCase()} que você salvou.</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="Adicionar observação pessoal..." placeholderTextColor={c.muted} multiline style={styles.noteInput} />
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveNote}><Text style={styles.primaryBtnText}>Salvar nota</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => selected && patchItem(selected.id, { status: "purchased" })}><Text style={styles.secondaryBtnText}>Já comprei</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => selected?.originalUrl && Linking.openURL(selected.originalUrl)}><Text style={styles.secondaryBtnText}>Abrir anúncio</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => selected && shareItem(selected)}><Text style={styles.secondaryBtnText}>Compartilhar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtnFull} onPress={() => selected && removeItem(selected.id)}><Text style={styles.dangerBtnText}>Remover da lista</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ styles, label, value }: { styles: ReturnType<typeof makeStyles>; label: string; value: number }) {
  return <View style={styles.statBox}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Chip({ styles, active, label, onPress }: { styles: ReturnType<typeof makeStyles>; active: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></TouchableOpacity>;
}

function Toggle({ styles, label, active, onPress }: { styles: ReturnType<typeof makeStyles>; label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={styles.toggleRow}><Text style={styles.toggleLabel}>{label}</Text><Text style={[styles.toggleBadge, active && styles.toggleBadgeActive]}>{active ? "Ativo" : "Off"}</Text></TouchableOpacity>;
}

function Info({ styles, label, value }: { styles: ReturnType<typeof makeStyles>; label: string; value: string }) {
  return <View style={styles.infoBox}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function WishlistCard({ item, styles, colors, onOpen, onRemove, onShare, onStatus }: {
  item: WishlistItem;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof getThemeColors>;
  onOpen: () => void;
  onRemove: () => void;
  onShare: () => void;
  onStatus: (status: WishlistStatus) => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={styles.itemImageWrap}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.itemImage} /> : <Feather name="heart" size={30} color={colors.primaryDark} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.itemTop}>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            <TouchableOpacity onPress={onRemove}><Feather name="trash-2" size={16} color={colors.muted} /></TouchableOpacity>
          </View>
          <Text style={styles.itemMeta}>{item.storeName ?? item.brand ?? "Sem loja"} · {savedAt(item.createdAt)}</Text>
          <View style={styles.tagRow}>
            <Text style={styles.tag}>{item.category}</Text>
            <Text style={styles.tagMuted}>{WISHLIST_STATUS_LABELS[item.status]}</Text>
            <Text style={styles.tagMuted}>{money(item.priceCents, item.currency)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.smallBtn} onPress={onOpen}><Text style={styles.smallBtnText}>Detalhes</Text></TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={onShare}><Text style={styles.smallBtnText}>Compartilhar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.smallBtnPrimary} onPress={() => onStatus("interested")}><Text style={styles.smallBtnPrimaryText}>Tenho interesse</Text></TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={() => onStatus("purchased")}><Text style={styles.smallBtnText}>Já comprei</Text></TouchableOpacity>
        <TouchableOpacity style={styles.smallBtnMuted} onPress={() => onStatus("not_interested")}><Text style={styles.smallBtnMutedText}>Não tenho mais interesse</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    root: { gap: 14, paddingBottom: 24 },
    hero: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.primary + "44", backgroundColor: colors.card, padding: 14 },
    heroIcon: { width: 70, height: 70 },
    title: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "900", color: colors.foreground },
    subtitle: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 2 },
    beeNote: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "33", padding: 12 },
    beeNoteText: { flex: 1, fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, lineHeight: 17 },
    statsRow: { flexDirection: "row", gap: 8 },
    statBox: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 10, alignItems: "center" },
    statValue: { fontFamily: FONTS.display, fontSize: 19, fontWeight: "900", color: colors.foreground },
    statLabel: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted },
    filtersCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 12, gap: 10 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
    searchInput: { flex: 1, minHeight: 42, color: colors.foreground, fontFamily: FONTS.sans, fontSize: 13 },
    chipRow: { gap: 8, paddingRight: 8 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.background },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    chipText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, fontWeight: "700" },
    chipTextActive: { color: "#1A1A1A" },
    emptyCard: { alignItems: "center", borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary + "55", backgroundColor: colors.primary + "10", padding: 24 },
    emptyTitle: { fontFamily: FONTS.sans, fontSize: 16, fontWeight: "900", color: colors.foreground, marginTop: 10 },
    emptyText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 },
    itemCard: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 12, gap: 12 },
    itemRow: { flexDirection: "row", gap: 12 },
    itemImageWrap: { width: 78, height: 78, borderRadius: 18, backgroundColor: colors.primary + "14", alignItems: "center", justifyContent: "center", overflow: "hidden" },
    itemImage: { width: "100%", height: "100%" },
    itemTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemTitle: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, fontWeight: "900", color: colors.foreground },
    itemMeta: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 4 },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
    tag: { backgroundColor: colors.primary + "20", color: colors.primaryDark, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: "800" },
    tagMuted: { backgroundColor: colors.background, color: colors.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: "800" },
    cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    smallBtn: { borderRadius: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8 },
    smallBtnText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "800", color: colors.foreground },
    smallBtnPrimary: { borderRadius: 11, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 8 },
    smallBtnPrimaryText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "900", color: "#1A1A1A" },
    smallBtnMuted: { borderRadius: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8 },
    smallBtnMutedText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "800", color: colors.muted },
    sectionCard: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 10 },
    sectionTitle: { fontFamily: FONTS.display, fontSize: 16, fontWeight: "900", color: colors.foreground },
    privacyText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 17 },
    mutedText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted },
    interestWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    interestChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: colors.primary + "16", borderWidth: 1, borderColor: colors.primary + "33", paddingHorizontal: 10, paddingVertical: 6 },
    interestText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "800", color: colors.primaryDark },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 11 },
    toggleLabel: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, fontWeight: "700" },
    toggleBadge: { borderRadius: 999, backgroundColor: colors.muted + "22", color: colors.muted, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden", fontSize: 10, fontWeight: "900" },
    toggleBadgeActive: { backgroundColor: colors.primary, color: "#1A1A1A" },
    dangerRow: { flexDirection: "row", gap: 8 },
    secondaryBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 11, alignItems: "center" },
    secondaryBtnText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, fontWeight: "900" },
    dangerBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.destructive + "55", padding: 11, alignItems: "center" },
    dangerBtnFull: { borderRadius: 12, borderWidth: 1, borderColor: colors.destructive + "55", padding: 11, alignItems: "center", width: "100%" },
    dangerBtnText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.destructive, fontWeight: "900" },
    recCard: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 6 },
    recTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "900", color: colors.foreground },
    recText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, lineHeight: 17 },
    reasonText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.primaryDark },
    primaryBtn: { borderRadius: 12, backgroundColor: colors.primary, padding: 11, alignItems: "center" },
    primaryBtnText: { fontFamily: FONTS.sans, fontSize: 12, color: "#1A1A1A", fontWeight: "900" },
    promptPill: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 11 },
    promptText: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, fontWeight: "700" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalCard: { maxHeight: "90%", backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 12 },
    modalHeader: { flexDirection: "row", gap: 12 },
    modalCategory: { fontFamily: FONTS.sans, fontSize: 11, color: colors.primaryDark, fontWeight: "900", textTransform: "uppercase" },
    modalTitle: { fontFamily: FONTS.display, fontSize: 18, color: colors.foreground, fontWeight: "900" },
    modalMeta: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted },
    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    modalImage: { width: "100%", height: 190, borderRadius: 18 },
    modalDescription: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 19 },
    infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    infoBox: { width: "48%", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 10 },
    infoLabel: { fontFamily: FONTS.sans, fontSize: 10, color: colors.muted, textTransform: "uppercase" },
    infoValue: { fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, fontWeight: "800", marginTop: 3 },
    reasonBox: { borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "33", backgroundColor: colors.primary + "12", padding: 11, fontFamily: FONTS.sans, fontSize: 12, color: colors.foreground, lineHeight: 17 },
    noteInput: { minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, color: colors.foreground, fontFamily: FONTS.sans, fontSize: 13, textAlignVertical: "top" },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  });
}
