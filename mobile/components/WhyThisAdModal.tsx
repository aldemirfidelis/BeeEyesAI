import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

interface WhyThisAdModalProps {
  visible: boolean;
  isPersonalized: boolean;
  advertiserName: string;
  onClose: () => void;
  onAdjustPreferences: () => void;
}

export function WhyThisAdModal({
  visible,
  isPersonalized,
  advertiserName,
  onClose,
  onAdjustPreferences,
}: WhyThisAdModalProps) {
  const themeMode = useUIStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  const explanation = isPersonalized
    ? "Este anúncio aparece com base nas preferências de anúncios que você configurou e nas categorias de uso do app. Não usamos dados sensíveis, localização precisa nem histórico fora do app."
    : "Este anúncio foi escolhido com base na ferramenta ou categoria que você está usando agora, não em rastreamento de comportamento.";

  const typeLabel = isPersonalized ? "Contextual + preferências" : "Contextual genérico";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Feather name="info" size={18} color={colors.primary} />
            <Text style={styles.title}>Por que estou vendo isso?</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeLabel}</Text>
            </View>

            <Text style={styles.body}>{explanation}</Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Anunciante</Text>
            <Text style={styles.body}>{advertiserName}</Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Nosso compromisso</Text>
            <View style={styles.commitList}>
              {[
                "Não usamos dados de saúde, religião, política ou conversas sensíveis para publicidade.",
                "Não rastreamos você fora do app.",
                "Não compartilhamos seus dados pessoais com anunciantes.",
                "Você sempre pode ocultar ou denunciar um anúncio.",
                "Usuários premium não veem anúncios.",
              ].map((item, i) => (
                <View key={i} style={styles.commitRow}>
                  <Feather name="check" size={13} color={colors.success} />
                  <Text style={styles.commitText}>{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.adjustBtn} onPress={onAdjustPreferences} activeOpacity={0.8}>
            <Feather name="sliders" size={14} color="#000" />
            <Text style={styles.adjustBtnText}>Ajustar preferências de anúncios</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeLink} onPress={onClose}>
            <Text style={styles.closeLinkText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 36,
      maxHeight: "80%",
      gap: 12,
    },
    handle: {
      width: 36, height: 4, backgroundColor: colors.border,
      borderRadius: 2, alignSelf: "center", marginBottom: 4,
    },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { fontFamily: FONTS.display, fontSize: 18, fontWeight: "800", color: colors.foreground },
    typeBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary + "22",
      borderRadius: 99,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    typeBadgeText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.primaryDark },
    body: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, lineHeight: 20 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
    sectionTitle: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
    commitList: { gap: 8 },
    commitRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    commitText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.foreground, flex: 1, lineHeight: 19 },
    adjustBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 13, justifyContent: "center", marginTop: 4,
    },
    adjustBtnText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "800", color: "#000" },
    closeLink: { alignSelf: "center", padding: 6 },
    closeLinkText: { fontFamily: FONTS.sans, fontSize: 13, color: colors.muted },
  });
}
