import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Download,
  ExternalLink,
  Eye,
  Heart,
  Info,
  MessageCircle,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { WISHLIST_CATEGORIES, WISHLIST_STATUS_LABELS, type WishlistStatus } from "@shared/wishlist";

interface WishlistSectionProps {
  authHeaders: () => Record<string, string>;
}

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
  purchasedAt: string | null;
}

interface UserInterest {
  id: string;
  interestName: string;
  category: string;
  score: number;
  active: boolean;
}

interface WishlistPreferences {
  allowPersonalizedRecommendations: boolean;
  allowPriceAlerts: boolean;
  allowBeeNotifications: boolean;
  showRecommendationReasons: boolean;
}

interface WishlistRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priceCents?: number;
  brand?: string;
  reason: string;
}

interface WishlistPayload {
  items: WishlistItem[];
  interests: UserInterest[];
  preferences: WishlistPreferences;
  recommendations: WishlistRecommendation[];
}

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recente" },
  { value: "oldest", label: "Mais antigo" },
  { value: "interest", label: "Maior interesse" },
  { value: "price_asc", label: "Menor preço" },
] as const;

function formatPrice(cents?: number | null, currency = "BRL") {
  if (typeof cents !== "number") return "Preço não informado";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `${days} dias atrás`;
}

function priorityLabel(value: string) {
  if (value === "high") return "Alta prioridade";
  if (value === "low") return "Pode esperar";
  if (value === "research") return "Pesquisar mais";
  return "Prioridade média";
}

export function WishlistSection({ authHeaders }: WishlistSectionProps) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [preferences, setPreferences] = useState<WishlistPreferences | null>(null);
  const [recommendations, setRecommendations] = useState<WishlistRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [beeMessage, setBeeMessage] = useState("A Bee usa somente itens salvos por você para personalizar esta área.");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("recent");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const stats = useMemo(() => {
    return {
      total: items.length,
      interested: items.filter((item) => item.status === "interested" || item.status === "buy_later").length,
      purchased: items.filter((item) => item.status === "purchased").length,
    };
  }, [items]);

  async function loadWishlist() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      if (minPrice.trim()) params.set("minPrice", minPrice.trim());
      if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
      const res = await fetch(`/api/wishlist?${params.toString()}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Não foi possível carregar sua Lista de Desejos.");
      const data = await res.json() as WishlistPayload;
      setItems(data.items ?? []);
      setInterests(data.interests ?? []);
      setPreferences(data.preferences);
      setRecommendations(data.recommendations ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Erro ao carregar Lista de Desejos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(loadWishlist, 180);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, status, sort, minPrice, maxPrice]);

  async function patchItem(id: string, body: Partial<WishlistItem>) {
    const res = await fetch(`/api/wishlist/items/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Não consegui atualizar esse item.");
    const updated = await res.json() as WishlistItem;
    setItems((prev) => prev.map((item) => item.id === id ? updated : item));
    setSelectedItem((current) => current?.id === id ? updated : current);
    return updated;
  }

  async function removeItem(id: string) {
    await fetch(`/api/wishlist/items/${id}`, { method: "DELETE", headers: authHeaders() });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setCompareIds((prev) => prev.filter((itemId) => itemId !== id));
    setSelectedItem(null);
    setBeeMessage("Removi da sua Lista de Desejos. Você continua no controle.");
  }

  async function addRecommendation(rec: WishlistRecommendation) {
    const res = await fetch("/api/wishlist/items", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        title: rec.title,
        description: rec.description,
        category: rec.category,
        priceCents: rec.priceCents,
        brand: rec.brand,
        sourceType: "recommendation",
        metadata: { recommendationId: rec.id, reason: rec.reason },
      }),
    });
    const data = await res.json();
    setBeeMessage(data.message ?? "Prontinho! Salvei isso na sua Lista de Desejos 🐝");
    await loadWishlist();
  }

  async function saveNote() {
    if (!selectedItem) return;
    await patchItem(selectedItem.id, { personalNote: noteDraft });
    setBeeMessage("Anotação salva. Vou lembrar desse contexto quando você voltar aqui.");
  }

  async function updateSettings(body: Partial<WishlistPreferences>) {
    const res = await fetch("/api/wishlist/settings", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json() as WishlistPreferences;
      setPreferences(updated);
      setBeeMessage(updated.allowPersonalizedRecommendations ? "Personalização ativada com base no que você salvar." : "Personalização desativada. Seus itens continuam salvos só para você consultar.");
    }
  }

  async function clearInterests() {
    await fetch("/api/wishlist/interests/clear", { method: "POST", headers: authHeaders() });
    setInterests([]);
    setBeeMessage("Limpei os interesses identificados. A Bee começa do zero a partir daqui.");
  }

  async function clearWishlist() {
    if (!window.confirm("Apagar toda a Lista de Desejos?")) return;
    await fetch("/api/wishlist/items", { method: "DELETE", headers: authHeaders() });
    setItems([]);
    setCompareIds([]);
    setSelectedItem(null);
    setBeeMessage("Lista apagada. Você pode recomeçar quando quiser.");
  }

  async function shareItem(item: WishlistItem) {
    const text = `${item.title} - ${item.originalUrl ?? "salvo na minha Lista de Desejos da Bee"}`;
    if (navigator.share) await navigator.share({ title: item.title, text, url: item.originalUrl ?? undefined }).catch(() => {});
    else await navigator.clipboard?.writeText(text).catch(() => {});
    setBeeMessage("Link preparado para compartilhar.");
  }

  async function exportData() {
    const res = await fetch("/api/wishlist/export", { headers: authHeaders() });
    if (!res.ok) {
      setBeeMessage("Não consegui exportar agora. Tente novamente em instantes.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bee-wishlist-export.json";
    link.click();
    URL.revokeObjectURL(url);
    setBeeMessage("Exportei seus dados da Lista de Desejos.");
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((itemId) => itemId !== id);
      return [...prev, id].slice(-4);
    });
  }

  const compareItems = items.filter((item) => compareIds.includes(item.id));

  if (loading && items.length === 0) {
    return (
      <div className="p-5 space-y-3">
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-44 rounded-2xl bg-muted animate-pulse" />
          <div className="h-44 rounded-2xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 via-card to-card p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-2xl bg-primary/20">
            <img src="/icons-colmeia/lista-desejos.png" alt="Lista de Desejos" className="h-full w-full object-contain" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black">Lista de Desejos</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Salve anúncios, produtos, cursos e ideias para ver depois. A personalização é opcional, explicável e pode ser apagada quando você quiser.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Salvos" value={stats.total} />
          <Stat label="Interesse" value={stats.interested} />
          <Stat label="Comprados" value={stats.purchased} />
        </div>
        <div className="mt-3 rounded-xl border border-border bg-background/70 p-3 text-xs text-foreground">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
          {beeMessage}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item, marca ou loja..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-xs">
            <option value="">Todas categorias</option>
            {WISHLIST_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-xs">
            <option value="">Todos status</option>
            {Object.entries(WISHLIST_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Preço mínimo"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none"
          />
          <input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Preço máximo"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-xs">
            {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p> : null}

      {items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <Heart className="mx-auto h-8 w-8 text-primary" />
          <h4 className="mt-3 font-black">Sua lista ainda está vazia</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Quando um anúncio ou recomendação aparecer, toque em “Adicionar à Lista de Desejos”.</p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onOpen={() => { setSelectedItem(item); setNoteDraft(item.personalNote ?? ""); }}
              onRemove={() => removeItem(item.id)}
              onShare={() => shareItem(item)}
              onStatus={(next) => patchItem(item.id, { status: next })}
              selectedForCompare={compareIds.includes(item.id)}
              onCompare={() => toggleCompare(item.id)}
            />
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <h4 className="font-black">Comparador e alertas</h4>
        </div>
        {compareItems.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Marque itens para comparar preço, marca, categoria, status, prioridade e observações. A Bee também pode avisar sobre promoção, estoque e itens parecidos quando os alertas estiverem ativos.
          </p>
        ) : (
          <div className="space-y-2">
            {compareItems.map((item) => (
              <div key={item.id} className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-3 text-xs">
                <strong className="col-span-2">{item.title}</strong>
                <span>{formatPrice(item.priceCents, item.currency)}</span>
                <span>{item.brand ?? item.storeName ?? "Sem marca"}</span>
                <span>{item.category}</span>
                <span>{priorityLabel(item.priority)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">
          <Bell className="mr-1 inline h-3.5 w-3.5 text-primary" />
          Alertas estruturados: queda de preço, promoção, estoque baixo, item similar mais barato, disponibilidade e lembrete de compra.
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="font-black">Meus interesses</h4>
            <p className="text-[11px] text-muted-foreground">Você pode editar, desativar ou limpar tudo.</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-wrap gap-2">
          {interests.length === 0 ? <span className="text-xs text-muted-foreground">Nenhum interesse ativo identificado.</span> : null}
          {interests.slice(0, 12).map((interest) => (
            <button
              key={interest.id}
              onClick={async () => {
                await fetch(`/api/wishlist/interests/${interest.id}`, { method: "DELETE", headers: authHeaders() });
                setInterests((prev) => prev.filter((item) => item.id !== interest.id));
              }}
              className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary"
            >
              {interest.interestName} · {interest.score} <X className="ml-1 inline h-3 w-3" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          A Bee usa os itens salvos na sua Lista de Desejos para entender melhor seus interesses e trazer recomendações mais úteis. Você pode editar ou apagar seus interesses quando quiser.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <ToggleRow
            label="Permitir recomendações personalizadas"
            active={preferences?.allowPersonalizedRecommendations ?? false}
            onClick={() => updateSettings({ allowPersonalizedRecommendations: !(preferences?.allowPersonalizedRecommendations ?? false) })}
          />
          <ToggleRow
            label="Permitir alertas de preço"
            active={preferences?.allowPriceAlerts ?? false}
            onClick={() => updateSettings({ allowPriceAlerts: !(preferences?.allowPriceAlerts ?? false) })}
          />
          <ToggleRow
            label="Notificações da Bee sobre itens salvos"
            active={preferences?.allowBeeNotifications ?? false}
            onClick={() => updateSettings({ allowBeeNotifications: !(preferences?.allowBeeNotifications ?? false) })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={clearInterests} className="rounded-xl border border-border px-3 py-2 text-xs font-bold">Limpar interesses</button>
          <button onClick={clearWishlist} className="rounded-xl border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive">Apagar lista</button>
          <button onClick={exportData} className="rounded-xl border border-border px-3 py-2 text-xs font-bold">
            <Download className="mr-1 inline h-3 w-3" /> Exportar
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="font-black">Talvez você também goste</h4>
        </div>
        <div className="space-y-2">
          {recommendations.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{rec.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                  <p className="mt-2 text-[11px] text-primary"><Info className="mr-1 inline h-3 w-3" />{rec.reason}</p>
                </div>
                <button onClick={() => addRecommendation(rec)} className="rounded-xl bg-primary px-3 py-2 text-[11px] font-black text-primary-foreground">
                  Salvar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h4 className="font-black">Pergunte para a Bee</h4>
        </div>
        <div className="mt-3 grid gap-2 text-xs">
          {["Qual desses produtos parece melhor?", "Organize minha lista por prioridade.", "O que pode esperar?", "Crie uma lista de compras com base nos itens salvos."].map((prompt) => (
            <button key={prompt} className="rounded-xl border border-border bg-background px-3 py-2 text-left hover:bg-muted">
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 md:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-primary">{selectedItem.category}</p>
                <h3 className="text-lg font-black">{selectedItem.title}</h3>
                <p className="text-xs text-muted-foreground">Salvo {timeAgo(selectedItem.createdAt)}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="rounded-xl border border-border p-2"><X className="h-4 w-4" /></button>
            </div>
            {selectedItem.imageUrl ? <img src={selectedItem.imageUrl} alt={selectedItem.title} className="mt-4 h-56 w-full rounded-2xl object-cover" /> : null}
            <p className="mt-4 text-sm leading-relaxed">{selectedItem.description ?? "Sem descrição."}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <InfoBox label="Preço" value={formatPrice(selectedItem.priceCents, selectedItem.currency)} />
              <InfoBox label="Loja/marca" value={selectedItem.storeName ?? selectedItem.brand ?? "Não informado"} />
              <InfoBox label="Status" value={WISHLIST_STATUS_LABELS[selectedItem.status]} />
              <InfoBox label="Prioridade Bee" value={priorityLabel(selectedItem.priority)} />
            </div>
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
              Motivo sugerido: combina com seus itens de {selectedItem.category.toLowerCase()} e com o status “{WISHLIST_STATUS_LABELS[selectedItem.status]}”.
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Adicionar observação pessoal..."
              className="mt-4 min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={saveNote} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Salvar observação</button>
              <button onClick={() => patchItem(selectedItem.id, { status: "purchased" })} className="rounded-xl border border-border px-3 py-2 text-xs font-bold">Marcar comprado</button>
              {selectedItem.originalUrl ? <button onClick={() => window.open(selectedItem.originalUrl!, "_blank")} className="rounded-xl border border-border px-3 py-2 text-xs font-bold"><ExternalLink className="mr-1 inline h-3 w-3" />Abrir anúncio</button> : null}
              <button onClick={() => shareItem(selectedItem)} className="rounded-xl border border-border px-3 py-2 text-xs font-bold"><Share2 className="mr-1 inline h-3 w-3" />Compartilhar</button>
              <button onClick={() => removeItem(selectedItem.id)} className="col-span-2 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive">Remover da lista</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-2 text-center">
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ToggleRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left text-xs">
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {active ? "Ativo" : "Desativado"}
      </span>
    </button>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function WishlistCard({
  item,
  onOpen,
  onRemove,
  onShare,
  onStatus,
  selectedForCompare,
  onCompare,
}: {
  item: WishlistItem;
  onOpen: () => void;
  onRemove: () => void;
  onShare: () => void;
  onStatus: (status: WishlistStatus) => void;
  selectedForCompare: boolean;
  onCompare: () => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
          {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : <Heart className="h-8 w-8 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-black">{item.title}</h4>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.storeName ?? item.brand ?? "Sem loja"} · {timeAgo(item.createdAt)}</p>
            </div>
            <button onClick={onRemove} className="rounded-lg p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{item.category}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{WISHLIST_STATUS_LABELS[item.status]}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{formatPrice(item.priceCents, item.currency)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onOpen} className="rounded-xl border border-border px-3 py-2 text-xs font-bold"><Eye className="mr-1 inline h-3 w-3" />Detalhes</button>
        <button onClick={onShare} className="rounded-xl border border-border px-3 py-2 text-xs font-bold"><Share2 className="mr-1 inline h-3 w-3" />Compartilhar</button>
        <button onClick={onCompare} className={`rounded-xl border px-3 py-2 text-xs font-bold ${selectedForCompare ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
          <SlidersHorizontal className="mr-1 inline h-3 w-3" />Comparar
        </button>
        <button onClick={() => onStatus("interested")} className="rounded-xl border border-primary/30 px-3 py-2 text-xs font-bold text-primary"><Heart className="mr-1 inline h-3 w-3" />Tenho interesse</button>
        <button onClick={() => onStatus("purchased")} className="rounded-xl border border-border px-3 py-2 text-xs font-bold"><Check className="mr-1 inline h-3 w-3" />Já comprei</button>
        <button onClick={() => onStatus("not_interested")} className="col-span-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
          Não tenho mais interesse
        </button>
      </div>
    </article>
  );
}
