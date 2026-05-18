import { useCallback, useEffect, useState } from "react";
import { SecureStore } from "./storage";
import { findItem, type CatalogItem, type ItemCategory } from "./catalog";

const STORAGE_KEY = "bee-house-inventory-v1";

const DEFAULT_OWNED = [
  "hat-none", "acc-none", "body-yellow",
  "bed-default", "desk-default", "rug-default",
  "wall-default", "floor-default",
];

const DEFAULT_EQUIPPED: Record<ItemCategory, string> = {
  hat: "hat-none",
  accessory: "acc-none",
  body: "body-yellow",
  "furniture-bed": "bed-default",
  "furniture-desk": "desk-default",
  "furniture-rug": "rug-default",
  wallpaper: "wall-default",
  floor: "floor-default",
};

interface StoredInventory {
  owned: string[];
  equipped: Record<ItemCategory, string>;
}

export interface InventoryApi {
  loaded: boolean;
  owned: Set<string>;
  equipped: Record<ItemCategory, string>;
  isOwned: (id: string) => boolean;
  isEquipped: (id: string) => boolean;
  buy: (item: CatalogItem, currentPollen: number) => { ok: boolean; remainingPollen?: number; reason?: string };
  equip: (id: string) => void;
  getEquippedItem: (category: ItemCategory) => CatalogItem | null;
}

export function useInventory(): InventoryApi {
  const [owned, setOwned] = useState<Set<string>>(new Set(DEFAULT_OWNED));
  const [equipped, setEquipped] = useState<Record<ItemCategory, string>>(DEFAULT_EQUIPPED);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredInventory;
          const merged = new Set<string>([...DEFAULT_OWNED, ...parsed.owned]);
          setOwned(merged);
          setEquipped({ ...DEFAULT_EQUIPPED, ...parsed.equipped });
        }
      } catch { /* ignora */ }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (nextOwned: Set<string>, nextEquipped: Record<ItemCategory, string>) => {
    try {
      const payload: StoredInventory = { owned: Array.from(nextOwned), equipped: nextEquipped };
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(payload));
    } catch { /* ignora */ }
  }, []);

  const buy = useCallback(
    (item: CatalogItem, currentPollen: number): { ok: boolean; remainingPollen?: number; reason?: string } => {
      if (owned.has(item.id)) return { ok: false, reason: "Voce ja tem esse item" };
      if (currentPollen < item.price) return { ok: false, reason: "Polen insuficiente" };
      const next = new Set(owned);
      next.add(item.id);
      setOwned(next);
      persist(next, equipped);
      return { ok: true, remainingPollen: currentPollen - item.price };
    },
    [equipped, owned, persist],
  );

  const equip = useCallback(
    (id: string) => {
      const item = findItem(id);
      if (!item) return;
      if (!owned.has(id)) return;
      const nextEq = { ...equipped, [item.category]: id };
      setEquipped(nextEq);
      persist(owned, nextEq);
    },
    [equipped, owned, persist],
  );

  const isOwned = useCallback((id: string) => owned.has(id), [owned]);
  const isEquipped = useCallback((id: string) => Object.values(equipped).includes(id), [equipped]);
  const getEquippedItem = useCallback((category: ItemCategory) => findItem(equipped[category] ?? ""), [equipped]);

  return { loaded, owned, equipped, isOwned, isEquipped, buy, equip, getEquippedItem };
}
