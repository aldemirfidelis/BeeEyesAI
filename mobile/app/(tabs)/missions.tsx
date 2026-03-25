import { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  FlatList, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useMissions } from "../../hooks/useMissions";
import MissionCard from "../../components/MissionCard";
import XPProgress from "../../components/XPProgress";
function xpForLevel(level: number) { return level * 100 + (level - 1) * 50; }
import { COLORS, FONTS } from "../../lib/theme";

export default function MissionsScreen() {
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const { missions, isLoading, createMission, completeMission, deleteMission } = useMissions();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
  });

  async function handleAddMission() {
    if (!newTitle.trim()) {
      Alert.alert("Atenção", "Título é obrigatório");
      return;
    }
    await createMission.mutateAsync({
      title: newTitle,
      description: newDescription || undefined,
      xpReward: 20,
    });
    setNewTitle("");
    setNewDescription("");
    setShowModal(false);
  }

  function handleComplete(id: string) {
    completeMission.mutate(id);
  }

  const pending = missions.filter((m: any) => !m.completed);
  const completed = missions.filter((m: any) => m.completed);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Missões</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
          <Text style={styles.addButtonText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {/* XP Progress */}
      {me && (
        <View style={styles.xpSection}>
          <XPProgress
            currentXP={me.xp}
            level={me.level}
            xpToNextLevel={xpForLevel(me.level)}
          />
        </View>
      )}

      {/* Missions list */}
      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.primary} />
      ) : (
        <FlatList
          data={[...pending, ...completed]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pending.length > 0 ? (
              <Text style={styles.sectionLabel}>
                {pending.length} missão{pending.length !== 1 ? "s" : ""} pendente{pending.length !== 1 ? "s" : ""}
              </Text>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🎉</Text>
                <Text style={styles.emptyText}>Tudo feito! Crie novas missões.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <MissionCard
              id={item.id}
              title={item.title}
              description={item.description}
              xpReward={item.xpReward}
              completed={item.completed}
              onToggle={handleComplete}
            />
          )}
        />
      )}

      {/* Add Mission Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Missão 🎯</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Título da missão"
              placeholderTextColor={COLORS.muted}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Descrição (opcional)"
              placeholderTextColor={COLORS.muted}
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleAddMission}
                disabled={createMission.isPending}
              >
                {createMission.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.foreground, fontWeight: "700" },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A", fontSize: 14 },
  xpSection: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  loader: { marginTop: 40 },
  list: { padding: 16 },
  sectionLabel: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginBottom: 12 },
  emptyContainer: { alignItems: "center", marginTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: FONTS.sans, fontSize: 16, color: COLORS.muted },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: "700", color: COLORS.foreground },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: FONTS.sans,
    color: COLORS.foreground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTextarea: { minHeight: 80, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  cancelBtn: { backgroundColor: COLORS.secondary },
  cancelBtnText: { fontFamily: FONTS.sans, fontWeight: "600", color: COLORS.foreground, fontSize: 15 },
  confirmBtn: { backgroundColor: COLORS.primary },
  confirmBtnText: { fontFamily: FONTS.sans, fontWeight: "700", color: "#1A1A1A", fontSize: 15 },
});
