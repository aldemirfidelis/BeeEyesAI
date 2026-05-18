import { useState } from "react";
import {
  HATS, ACCESSORIES, BODY_COLORS, FURNITURE_BEDS, FURNITURE_DESKS, FURNITURE_RUGS, WALLPAPERS, FLOORS,
  RARITY_COLORS, type CatalogItem, type ItemCategory,
} from "../engine/catalog";
import type { InventoryApi } from "../engine/inventory";

interface ShopModalProps {
  pollen: number;
  level: number;
  inventory: InventoryApi;
  onClose: () => void;
  onBuy: (item: CatalogItem) => { ok: boolean; reason?: string };
}

const TABS: { id: ItemCategory; label: string; items: CatalogItem[] }[] = [
  { id: "hat", label: "Chapéus", items: HATS },
  { id: "accessory", label: "Acessórios", items: ACCESSORIES },
  { id: "body", label: "Cor", items: BODY_COLORS },
  { id: "furniture-bed", label: "Cama", items: FURNITURE_BEDS },
  { id: "furniture-desk", label: "Mesa", items: FURNITURE_DESKS },
  { id: "furniture-rug", label: "Tapete", items: FURNITURE_RUGS },
  { id: "wallpaper", label: "Parede", items: WALLPAPERS },
  { id: "floor", label: "Chão", items: FLOORS },
];

export function ShopModal({ pollen, level, inventory, onClose, onBuy }: ShopModalProps) {
  const [tab, setTab] = useState<ItemCategory>("hat");
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentTab = TABS.find((t) => t.id === tab)!;

  function handleClick(item: CatalogItem) {
    if (inventory.isOwned(item.id)) {
      inventory.equip(item.id);
      setFeedback(`Equipado: ${item.name}`);
      setTimeout(() => setFeedback(null), 1500);
      return;
    }
    if (item.unlockLevel && level < item.unlockLevel) {
      setFeedback(`Precisa nível ${item.unlockLevel}`);
      setTimeout(() => setFeedback(null), 1500);
      return;
    }
    const res = onBuy(item);
    if (res.ok) {
      inventory.equip(item.id);
      setFeedback(`Comprado: ${item.name}`);
    } else {
      setFeedback(res.reason ?? "Falhou");
    }
    setTimeout(() => setFeedback(null), 1500);
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>🛍️ Loja da Bee</div>
          <div style={styles.pollen}>🟡 {pollen}</div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              style={{ ...styles.tab, background: tab === t.id ? "#fbcb45" : "transparent", color: tab === t.id ? "#2c1a08" : "#fff8d6" }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={styles.grid}>
          {currentTab.items.map((item) => {
            const owned = inventory.isOwned(item.id);
            const equipped = inventory.isEquipped(item.id);
            const locked = !!item.unlockLevel && level < item.unlockLevel;
            const rar = RARITY_COLORS[item.rarity];
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                style={{
                  ...styles.card,
                  background: rar.bg,
                  borderColor: equipped ? "#5fc775" : rar.border,
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <div style={{ ...styles.rarity, color: rar.border }}>{rar.label}</div>
                <div style={styles.itemName}>{item.name}</div>
                <div style={styles.itemDesc}>{item.description}</div>
                <div style={styles.itemFooter}>
                  {equipped ? <span style={styles.tagEq}>Equipado</span>
                    : owned ? <span style={styles.tagOwn}>Equipar</span>
                    : locked ? <span style={styles.tagLock}>Lv {item.unlockLevel}</span>
                    : <span style={styles.tagPrice}>🟡 {item.price}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {feedback && <div style={styles.feedback}>{feedback}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  modal: {
    width: "100%", maxWidth: 520, maxHeight: "90vh", background: "#22150b", color: "#fff8d6", borderRadius: 16, border: "3px solid #5a4731",
    overflow: "hidden", display: "flex", flexDirection: "column",
  },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "2px solid #5a4731", background: "rgba(0,0,0,0.3)" },
  title: { fontWeight: 900, fontSize: 16 },
  pollen: { marginLeft: "auto", background: "rgba(251,203,69,0.2)", padding: "4px 10px", borderRadius: 12, fontWeight: 800, fontSize: 13 },
  closeBtn: { background: "transparent", border: "none", color: "#fff8d6", fontSize: 18, cursor: "pointer", padding: 4 },
  tabs: { display: "flex", gap: 4, padding: 8, overflowX: "auto", borderBottom: "2px solid #5a4731" },
  tab: { padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,248,214,0.3)", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, padding: 12, overflowY: "auto", flex: 1 },
  card: { padding: 10, borderRadius: 10, border: "2px solid", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, textAlign: "left", color: "#fff8d6" },
  rarity: { fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 },
  itemName: { fontSize: 13, fontWeight: 900, color: "#fff8d6" },
  itemDesc: { fontSize: 10, color: "rgba(255,248,214,0.7)", flex: 1 },
  itemFooter: { marginTop: 4 },
  tagPrice: { fontSize: 12, fontWeight: 900, background: "rgba(251,203,69,0.25)", padding: "3px 8px", borderRadius: 8, color: "#fbcb45" },
  tagOwn: { fontSize: 11, fontWeight: 800, background: "rgba(91,155,213,0.25)", padding: "3px 8px", borderRadius: 8, color: "#5b9bd5" },
  tagEq: { fontSize: 11, fontWeight: 900, background: "rgba(95,199,117,0.25)", padding: "3px 8px", borderRadius: 8, color: "#5fc775" },
  tagLock: { fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,0.1)", padding: "3px 8px", borderRadius: 8, color: "#999" },
  feedback: { position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", background: "#fbcb45", color: "#2c1a08", padding: "6px 12px", borderRadius: 10, fontWeight: 900, fontSize: 12 },
};
