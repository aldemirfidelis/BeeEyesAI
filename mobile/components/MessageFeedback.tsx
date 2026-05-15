import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONTS, getThemeColors } from "@mobile/lib/theme";

export type FeedbackType = "like" | "dislike";

export const DISLIKE_REASONS: Array<{ value: string; label: string }> = [
  { value: "too_long", label: "Resposta muito longa" },
  { value: "confusing", label: "Resposta confusa" },
  { value: "not_what_i_wanted", label: "Não era o que eu queria" },
  { value: "inappropriate_tone", label: "Tom inadequado" },
  { value: "incomplete", label: "Informação incompleta" },
  { value: "other", label: "Outro motivo" },
];

interface MessageFeedbackProps {
  current: FeedbackType | null;
  busy?: boolean;
  colors: ReturnType<typeof getThemeColors>;
  onLike: () => void;
  onDislike: (reason?: string) => void;
  onUndo: () => void;
  onSendToFeed: () => void;
}

export function MessageFeedback({ current, busy, colors, onLike, onDislike, onUndo, onSendToFeed }: MessageFeedbackProps) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const styles = makeStyles(colors);

  const liked = current === "like";
  const disliked = current === "dislike";

  function handleLikeClick() {
    if (busy) return;
    if (liked) onUndo();
    else onLike();
  }

  function handleDislikeClick() {
    if (busy) return;
    if (disliked) {
      onUndo();
    } else {
      setReasonOpen(true);
    }
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={handleLikeClick}
        disabled={busy}
        style={[styles.btn, liked && styles.btnLike]}
        accessibilityRole="button"
        accessibilityLabel={liked ? "Desfazer curtida" : "Curtir resposta"}
        accessibilityState={{ selected: liked }}
      >
        {busy && !disliked ? (
          <ActivityIndicator size="small" color={liked ? "#047857" : colors.muted} />
        ) : (
          <Feather name={liked ? "check" : "thumbs-up"} size={13} color={liked ? "#047857" : colors.muted} />
        )}
        <Text style={[styles.btnText, liked && styles.btnTextLike]}>{liked ? "Curtido" : "Curtir"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleDislikeClick}
        disabled={busy}
        style={[styles.btn, disliked && styles.btnDislike]}
        accessibilityRole="button"
        accessibilityLabel={disliked ? "Desfazer não curti" : "Não curti resposta"}
        accessibilityState={{ selected: disliked }}
      >
        {busy && disliked ? (
          <ActivityIndicator size="small" color={disliked ? colors.destructive : colors.muted} />
        ) : (
          <Feather name="thumbs-down" size={13} color={disliked ? colors.destructive : colors.muted} />
        )}
        <Text style={[styles.btnText, disliked && styles.btnTextDislike]}>Não curti</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSendToFeed}
        disabled={busy}
        style={[styles.btn, styles.btnFeed]}
        accessibilityRole="button"
        accessibilityLabel="Enviar para o Feed"
      >
        <Feather name="share-2" size={13} color={colors.primaryDark ?? colors.foreground} />
        <Text style={[styles.btnText, styles.btnTextFeed]}>Enviar para o Feed</Text>
      </TouchableOpacity>

      {/* Modal de motivos para "Não curti" */}
      <Modal visible={reasonOpen} animationType="fade" transparent onRequestClose={() => setReasonOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setReasonOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>O que faltou?</Text>
            <Text style={styles.modalSub}>Esse feedback ajuda a Bee a melhorar.</Text>
            {DISLIKE_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.reasonRow}
                onPress={() => { onDislike(r.value); setReasonOpen(false); }}
              >
                <Text style={styles.reasonLabel}>{r.label}</Text>
                <Feather name="chevron-right" size={16} color={colors.muted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setReasonOpen(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    btn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 9, paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card + "DD",
    },
    btnText: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: "700", color: colors.muted },
    btnLike: { borderColor: "#10b98166", backgroundColor: "#10b98122" },
    btnTextLike: { color: "#047857" },
    btnDislike: { borderColor: colors.destructive + "66", backgroundColor: colors.destructive + "22" },
    btnTextDislike: { color: colors.destructive },
    btnFeed: { borderColor: colors.primary + "55", backgroundColor: colors.primary + "1F" },
    btnTextFeed: { color: colors.primaryDark ?? colors.foreground },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalCard: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      padding: 18, paddingBottom: 28, gap: 4,
    },
    modalTitle: { fontFamily: FONTS.display, fontSize: 17, fontWeight: "800", color: colors.foreground, marginBottom: 2 },
    modalSub: { fontFamily: FONTS.sans, fontSize: 12, color: colors.muted, marginBottom: 10 },
    reasonRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 12, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    reasonLabel: { fontFamily: FONTS.sans, fontSize: 14, color: colors.foreground },
    cancelBtn: { marginTop: 14, paddingVertical: 12, alignItems: "center", borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: "700", color: colors.foreground },
  });
}
