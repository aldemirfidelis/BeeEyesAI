import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { BeePreview } from "./BeePreview";
import {
  itemsByCategory,
  RARITY_COLORS,
  type CatalogItem,
  type ItemCategory,
} from "../engine/catalog";
import type { InventoryApi } from "../engine/inventory";

interface Tab {
  id: ItemCategory;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const TABS: Tab[] = [
  { id: "hat", label: "Chapéus", icon: "shield" },
  { id: "accessory", label: "Acessórios", icon: "eye" },
  { id: "body", label: "Cor", icon: "droplet" },
  { id: "furniture-bed", label: "Cama", icon: "moon" },
  { id: "furniture-desk", label: "Mesa", icon: "monitor" },
  { id: "furniture-rug", label: "Tapete", icon: "grid" },
  { id: "wallpaper", label: "Parede", icon: "image" },
  { id: "floor", label: "Piso", icon: "layout" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  pollen: number;
  level: number;
  inventory: InventoryApi;
  onBuy: (item: CatalogItem) => void; // chamado quando compra OK, callback p atualizar polen externo
}

export function ShopModal({ visible, onClose, pollen, level, inventory, onBuy }: Props) {
  const [tab, setTab] = useState<ItemCategory>("hat");

  const items = useMemo(() => itemsByCategory(tab), [tab]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={20} color="#2a2014" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Loja da Bee</Text>
          </View>
          <View style={styles.balance}>
            <Feather name="zap" size={14} color="#f5b400" />
            <Text style={styles.balanceText}>{pollen}</Text>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <FlatList
            data={TABS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.tabsRow}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTab(item.id);
                }}
                style={[styles.tab, tab === item.id && styles.tabActive]}
              >
                <Feather name={item.icon} size={14} color={tab === item.id ? "#2a2014" : "#7a4f18"} />
                <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <ShopCard
              item={item}
              owned={inventory.isOwned(item.id)}
              equipped={inventory.isEquipped(item.id)}
              canAfford={pollen >= item.price}
              canUnlock={!item.unlockLevel || level >= item.unlockLevel}
              level={level}
              onBuy={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                onBuy(item);
              }}
              onEquip={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                inventory.equip(item.id);
              }}
            />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

function ShopCard({
  item,
  owned,
  equipped,
  canAfford,
  canUnlock,
  level,
  onBuy,
  onEquip,
}: {
  item: CatalogItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  canUnlock: boolean;
  level: number;
  onBuy: () => void;
  onEquip: () => void;
}) {
  const rarity = RARITY_COLORS[item.rarity];

  return (
    <View style={[styles.card, { borderColor: rarity.border, backgroundColor: rarity.bg }]}>
      {/* Preview */}
      <View style={styles.preview}>
        {item.category === "body" || item.category === "hat" || item.category === "accessory" ? (
          <BeePreview
            size={86}
            hat={item.category === "hat" ? item : null}
            accessory={item.category === "accessory" ? item : null}
            body={item.category === "body" ? item : null}
          />
        ) : (
          <View style={styles.furniturePreview}>
            <Feather name={iconForFurniture(item.category)} size={36} color={(item.data.color as string) ?? "#7a4f18"} />
          </View>
        )}
      </View>

      <View style={[styles.rarityBadge, { backgroundColor: rarity.border }]}>
        <Text style={styles.rarityText}>{rarity.label}</Text>
      </View>

      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>

      {/* Footer: preço / botão */}
      {equipped ? (
        <View style={[styles.actionBtn, styles.actionEquipped]}>
          <Feather name="check" size={12} color="#5fc775" />
          <Text style={[styles.actionText, { color: "#3e8437" }]}>Equipado</Text>
        </View>
      ) : owned ? (
        <Pressable onPress={onEquip} style={({ pressed }) => [styles.actionBtn, styles.actionOwn, pressed && styles.pressed]}>
          <Text style={[styles.actionText, { color: "#2a2014" }]}>Equipar</Text>
        </Pressable>
      ) : !canUnlock ? (
        <View style={[styles.actionBtn, styles.actionLocked]}>
          <Feather name="lock" size={12} color="#9c9c9c" />
          <Text style={[styles.actionText, { color: "#5e4520" }]}>Nível {item.unlockLevel}</Text>
        </View>
      ) : !canAfford ? (
        <View style={[styles.actionBtn, styles.actionLocked]}>
          <Feather name="zap" size={12} color="#7a4f18" />
          <Text style={[styles.actionText, { color: "#5e4520" }]}>{item.price}</Text>
        </View>
      ) : (
        <Pressable onPress={onBuy} style={({ pressed }) => [styles.actionBtn, styles.actionBuy, pressed && styles.pressed]}>
          <Feather name="zap" size={12} color="#2a2014" />
          <Text style={[styles.actionText, { color: "#2a2014" }]}>{item.price}</Text>
        </Pressable>
      )}
    </View>
  );
}

function iconForFurniture(category: ItemCategory): keyof typeof Feather.glyphMap {
  if (category === "furniture-bed") return "moon";
  if (category === "furniture-desk") return "monitor";
  if (category === "furniture-rug") return "grid";
  return "package";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff8d6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(87, 61, 28, 0.18)",
    gap: 10,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(87, 61, 28, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { color: "#2c2114", fontSize: 18, fontWeight: "900" },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(245, 180, 0, 0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(245, 180, 0, 0.7)",
  },
  balanceText: { color: "#7a4f18", fontSize: 14, fontWeight: "900" },
  tabsWrap: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(87, 61, 28, 0.12)" },
  tabsRow: { gap: 6, paddingHorizontal: 14 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(87, 61, 28, 0.06)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  tabActive: { backgroundColor: "#ffd95b", borderColor: "rgba(78, 52, 24, 0.72)" },
  tabText: { color: "#7a4f18", fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: "#2a2014" },
  grid: { padding: 12, gap: 10 },
  gridRow: { gap: 10 },
  card: {
    flex: 1,
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "stretch",
    gap: 4,
    marginBottom: 10,
  },
  preview: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  furniturePreview: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: "rgba(255, 248, 214, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  rarityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rarityText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  itemName: { color: "#2c2114", fontSize: 13, fontWeight: "900", marginTop: 2 },
  itemDesc: { color: "#5e4520", fontSize: 10, fontWeight: "600", minHeight: 24, lineHeight: 13 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 6,
  },
  actionBuy: { backgroundColor: "#ffd95b", borderColor: "rgba(78, 52, 24, 0.72)" },
  actionOwn: { backgroundColor: "rgba(91, 155, 213, 0.18)", borderColor: "#5b9bd5" },
  actionEquipped: { backgroundColor: "rgba(95, 199, 117, 0.18)", borderColor: "#5fc775" },
  actionLocked: { backgroundColor: "rgba(87, 61, 28, 0.12)", borderColor: "rgba(87, 61, 28, 0.18)" },
  actionText: { fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
