import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONTS, getThemeColors } from "@mobile/lib/theme";

export type DraftPrivacy = "public" | "friends" | "private";

const CATEGORIES = [
  "Produtividade",
  "Saúde e bem-estar",
  "Carreira",
  "Finanças",
  "Estudos",
  "Tecnologia",
  "Lifestyle",
  "Outros",
];

interface SendToFeedModalProps {
  open: boolean;
  sourceMessageId: string | null;
  sourceContent: string;
  submitting: boolean;
  colors: ReturnType<typeof getThemeColors>;
  onCancel: () => void;
  onPublish: (data: {
    sourceMessageId: string | null;
    title: string;
    content: string;
    category: string | null;
    hashtags: string;
    privacy: DraftPrivacy;
    publishNow: boolean;
  }) => Promise<void>;
}

export function SendToFeedModal({ open, sourceMessageId, sourceContent, submitting, colors, onCancel, onPublish }: SendToFeedModalProps) {
  const styles = makeStyles(colors);

  const suggestedTitle = useMemo(() => deriveTitle(sourceContent), [sourceContent]);
  const suggestedContent = useMemo(() => sourceContent.trim(), [sourceContent]);
  const suggestedCategory = useMemo(() => deriveCategory(sourceContent), [sourceContent]);
  const suggestedHashtags = useMemo(() => deriveHashtags(sourceContent), [sourceContent]);

  const [title, setTitle] = useState(suggestedTitle);
  const [content, setContent] = useState(suggestedContent);
  const [category, setCategory] = useState<string | null>(suggestedCategory);
  const [hashtags, setHashtags] = useState(suggestedHashtags);
  const [privacy, setPrivacy] = useState<DraftPrivacy>("public");

  useEffect(() => {
    if (open) {
      setTitle(suggestedTitle);
      setContent(suggestedContent);
      setCategory(suggestedCategory);
      setHashtags(suggestedHashtags);
      setPrivacy("public");
    }
  }, [open, suggestedTitle, suggestedContent, suggestedCategory, suggestedHashtags]);

  const contentLen = content.length;
  const overLimit = contentLen > 500;
  const canPublish = content.trim().length > 0 && !overLimit && !submitting;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !submitting && onCancel()} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={styles.iconBadge}>
                <Feather name="share-2" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Enviar para o Feed</Text>
                <Text style={styles.subtitle}>Edite antes de publicar — você decide o que vai ao ar.</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCancel} disabled={submitting} style={styles.closeBtn} accessibilityLabel="Fechar">
              <Feather name="x" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: "75%" }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <FieldLabel styles={styles}>Título (sugerido)</FieldLabel>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="Um título curto"
              placeholderTextColor={colors.muted}
            />

            <View style={styles.headerRow}>
              <FieldLabel styles={styles}>Conteúdo</FieldLabel>
              <Text style={[styles.counter, overLimit && { color: colors.destructive }]}>{contentLen}/500</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, overLimit && styles.inputError]}
              value={content}
              onChangeText={setContent}
              multiline
              placeholder="Adapte o texto antes de publicar"
              placeholderTextColor={colors.muted}
            />

            <FieldLabel styles={styles}>Categoria</FieldLabel>
            <View style={styles.chipsRow}>
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(active ? null : c)}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FieldLabel styles={styles}>Hashtags (separadas por vírgula)</FieldLabel>
            <TextInput
              style={styles.input}
              value={hashtags}
              onChangeText={setHashtags}
              maxLength={240}
              placeholder="produtividade, foco, rotina"
              placeholderTextColor={colors.muted}
            />

            <FieldLabel styles={styles}>Quem vê este post?</FieldLabel>
            <View style={styles.privacyRow}>
              <PrivacyChip styles={styles} icon="globe" label="Público" active={privacy === "public"} onPress={() => setPrivacy("public")} />
              <PrivacyChip styles={styles} icon="users" label="Amigos" active={privacy === "friends"} onPress={() => setPrivacy("friends")} />
              <PrivacyChip styles={styles} icon="lock" label="Só eu" active={privacy === "private"} onPress={() => setPrivacy("private")} />
            </View>
            {privacy !== "public" ? (
              <Text style={styles.hintMuted}>
                Privacidade granular em rollout — por enquanto, publicamos no Feed público mas guardamos sua preferência.
              </Text>
            ) : null}

            <Text style={styles.origin}>Origem: criado com ajuda da Bee 🐝</Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.secondaryBtn, !canPublish && styles.btnDisabled]}
              onPress={() => onPublish({ sourceMessageId, title, content, category, hashtags, privacy, publishNow: false })}
              disabled={!canPublish}
            >
              <Text style={styles.secondaryBtnText}>Salvar rascunho</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, !canPublish && styles.btnDisabled]}
              onPress={() => onPublish({ sourceMessageId, title, content, category, hashtags, privacy, publishNow: true })}
              disabled={!canPublish}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <Text style={styles.primaryBtnText}>Publicar no Feed</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ children, styles }: { children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={styles.label}>{children}</Text>;
}

function PrivacyChip({ icon, label, active, onPress, styles }: { icon: any; label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <TouchableOpacity style={[styles.privacyChip, active && styles.privacyChipActive]} onPress={onPress} accessibilityState={{ selected: active }}>
      <Feather name={icon} size={13} color={active ? "#1A1A1A" : styles.privacyChipText.color as string} />
      <Text style={[styles.privacyChipText, active && styles.privacyChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, maxHeight: "92%" },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 10 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
    iconBadge: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "20" },
    title: { fontFamily: FONTS.display, fontSize: 16, fontWeight: "800", color: colors.foreground },
    subtitle: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, marginTop: 1 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    body: { gap: 8, paddingTop: 8, paddingBottom: 8 },
    label: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: "800", color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 4 },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      backgroundColor: colors.background, color: colors.foreground,
      paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.sans, fontSize: 14,
    },
    inputError: { borderColor: colors.destructive },
    textArea: { minHeight: 110, textAlignVertical: "top" },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    counter: { fontFamily: FONTS.mono, fontSize: 11, color: colors.muted },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    chipText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
    chipTextActive: { color: colors.primaryDark ?? colors.foreground },
    privacyRow: { flexDirection: "row", gap: 8 },
    privacyChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
    privacyChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    privacyChipText: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "800", color: colors.foreground },
    privacyChipTextActive: { color: "#1A1A1A" },
    hintMuted: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, fontStyle: "italic" },
    origin: { fontFamily: FONTS.sans, fontSize: 11, color: colors.muted, fontStyle: "italic", marginTop: 8 },
    footer: { flexDirection: "row", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
    secondaryBtn: { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    secondaryBtnText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "700", color: colors.foreground },
    primaryBtn: { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primary },
    primaryBtnText: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: "800", color: "#1A1A1A" },
    btnDisabled: { opacity: 0.4 },
  });
}

function deriveTitle(content: string): string {
  const firstLine = content.split(/\n+/)[0] || "";
  const cleaned = firstLine.replace(/^[#*\-•]+\s*/, "").trim();
  if (!cleaned) return "Uma ideia da Bee 🐝";
  return cleaned.length > 80 ? cleaned.slice(0, 77).trim() + "..." : cleaned;
}

function deriveCategory(content: string): string | null {
  const t = content.toLowerCase();
  if (/treino|saúde|saude|exerc|nutric|sono/.test(t)) return "Saúde e bem-estar";
  if (/produtiv|foco|disciplin|rotin|hábit|habit/.test(t)) return "Produtividade";
  if (/carreira|currículo|curriculo|linkedin|emprego/.test(t)) return "Carreira";
  if (/financ|dinheiro|investiment|orçament|orcament/.test(t)) return "Finanças";
  if (/estud|prova|aprender|leitura/.test(t)) return "Estudos";
  if (/program|código|codigo|tecnologia|app|software/.test(t)) return "Tecnologia";
  return null;
}

function deriveHashtags(content: string): string {
  const cat = deriveCategory(content);
  if (!cat) return "bee";
  const map: Record<string, string> = {
    "Saúde e bem-estar": "saude, bemestar, treino",
    "Produtividade": "produtividade, foco, rotina",
    "Carreira": "carreira, trabalho, networking",
    "Finanças": "financas, dinheiro, investimentos",
    "Estudos": "estudos, aprendizado",
    "Tecnologia": "tecnologia, dev",
  };
  return map[cat] ?? "bee";
}
