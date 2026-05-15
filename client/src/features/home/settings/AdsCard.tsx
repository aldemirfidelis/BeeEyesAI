import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronRight, ExternalLink, Lock, Megaphone, Shield, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AD_INTEREST_OPTIONS, type AdFrequency, type UserAdPreferences } from "@/lib/ads";
import { SettingsCard } from "./SettingsShell";

interface AdsCardProps {
  onOpenAdSettings: () => void;
  isPremium?: boolean;
}

export function AdsCard({ onOpenAdSettings, isPremium = false }: AdsCardProps) {
  return (
    <SettingsCard
      icon={<Megaphone className="w-4 h-4" />}
      title="Anúncios"
      description="Controle de privacidade e personalização"
    >
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
        {isPremium ? (
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        ) : (
          <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        )}
        <p className="text-xs leading-relaxed text-foreground">
          {isPremium
            ? "Como assinante premium, você não vê anúncios na Bee."
            : "Anúncios discretos ajudam a manter a Bee gratuita. Você decide a frequência, interesses e nível de personalização — sem rastreamento fora do app."}
        </p>
      </div>
      <Button
        variant="outline"
        className="w-full flex items-center justify-between min-h-[44px]"
        onClick={onOpenAdSettings}
        aria-label="Abrir preferências de anúncios"
        disabled={isPremium}
      >
        <span>Preferências de anúncios</span>
        <ChevronRight className="w-4 h-4" />
      </Button>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
        <FeatureTag>Frequência</FeatureTag>
        <FeatureTag>Interesses</FeatureTag>
        <FeatureTag>Ocultar anunciantes</FeatureTag>
      </div>
    </SettingsCard>
  );
}

function FeatureTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-center text-muted-foreground font-medium">
      {children}
    </span>
  );
}

// ── Ad Settings Modal ──────────────────────────────────────────────────────

const FREQUENCY_OPTIONS: { value: AdFrequency; label: string; desc: string }[] = [
  { value: "low", label: "Baixa", desc: "Máx. 1/dia" },
  { value: "normal", label: "Normal", desc: "Máx. 3/dia" },
  { value: "high", label: "Alta", desc: "Máx. 5/dia" },
];

interface AdSettingsModalProps {
  prefs: UserAdPreferences;
  saved: boolean;
  onPrefsChange: (prefs: UserAdPreferences) => void;
  onSave: () => void;
  onClose: () => void;
}

interface RecentAdImpression {
  id: string;
  title: string;
  description?: string | null;
  productUrl?: string | null;
  advertiserName?: string | null;
  price?: string | null;
  viewedAt: string;
  expiresAt: string;
}

export function AdSettingsModal({ prefs, saved, onPrefsChange, onSave, onClose }: AdSettingsModalProps) {
  const [recentAds, setRecentAds] = useState<RecentAdImpression[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("bee_token");
    fetch("/api/ad-impressions/recent", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.ok ? res.json() : [])
      .then((rows) => setRecentAds(Array.isArray(rows) ? rows : []))
      .catch(() => setRecentAds([]));
  }, []);

  function toggleInterest(interest: string) {
    onPrefsChange({
      ...prefs,
      selectedInterests: prefs.selectedInterests.includes(interest)
        ? prefs.selectedInterests.filter((i) => i !== interest)
        : [...prefs.selectedInterests, interest],
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Preferências de anúncios"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl border border-border bg-card max-h-[88vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-display font-bold text-base">Preferências de anúncios</h3>
            <p className="text-xs text-muted-foreground">Controle como os anúncios aparecem</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} aria-label="Fechar">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 p-3">
            <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">
              Os anúncios ajudam a manter a Bee funcionando. Você controla quais tipos quer ver. Nunca usamos dados
              sensíveis, localização ou conversas para publicidade.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">Anúncios personalizados</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  A Bee usa seus interesses escolhidos abaixo para anúncios mais relevantes. Sem rastreamento fora do
                  app.
                </p>
              </div>
              <Switch
                checked={prefs.allowPersonalizedAds}
                onCheckedChange={(v) => onPrefsChange({ ...prefs, allowPersonalizedAds: v })}
                aria-label="Anúncios personalizados"
              />
            </div>
          </div>

          {prefs.allowPersonalizedAds && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
              <p className="text-sm font-bold">Meus interesses</p>
              <p className="text-[11px] text-muted-foreground">Selecione os temas relevantes para você.</p>
              <div className="flex flex-wrap gap-2">
                {AD_INTEREST_OPTIONS.map((interest) => {
                  const selected = prefs.selectedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      aria-pressed={selected}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <p className="text-sm font-bold">Frequência</p>
            <p className="text-[11px] text-muted-foreground">Com que frequência você quer ver anúncios?</p>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => {
                const active = prefs.preferredAdFrequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onPrefsChange({ ...prefs, preferredAdFrequency: opt.value })}
                    aria-pressed={active}
                    className={`rounded-xl border p-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <p className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {prefs.hiddenAdvertisers.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-1.5">
              <p className="text-sm font-bold">Anunciantes ocultados</p>
              {prefs.hiddenAdvertisers.map((adv) => (
                <div key={adv} className="flex items-center justify-between py-1">
                  <span className="text-sm">{adv}</span>
                  <button
                    onClick={() =>
                      onPrefsChange({
                        ...prefs,
                        hiddenAdvertisers: prefs.hiddenAdvertisers.filter((a) => a !== adv),
                      })
                    }
                    className="p-1 rounded-lg hover:bg-muted transition-colors"
                    aria-label={`Remover ${adv} da lista de ocultos`}
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {recentAds.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
              <p className="text-sm font-bold">Anúncios vistos</p>
              <p className="text-[11px] text-muted-foreground">Disponíveis por até 2 dias, caso você não salve na Lista de Desejos.</p>
              <div className="space-y-2">
                {recentAds.slice(0, 5).map((ad) => {
                  const expiresAt = new Date(ad.expiresAt);
                  return (
                    <div key={ad.id} className="rounded-lg border border-border/50 bg-card/70 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-foreground">{ad.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{ad.advertiserName || "Anunciante"}</p>
                        </div>
                        {ad.productUrl ? (
                          <button
                            type="button"
                            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => window.open(ad.productUrl!, "_blank", "noopener,noreferrer")}
                            aria-label="Abrir anúncio"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Fica disponível até {expiresAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/40 p-3">
            <Lock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Suas preferências ficam neste dispositivo. A Bee não compartilha informações de anúncios com terceiros sem
              sua autorização. Assinantes premium não veem anúncios.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <Button className="w-full flex items-center gap-2" onClick={onSave}>
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Preferências salvas!
              </>
            ) : (
              "Salvar preferências"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
