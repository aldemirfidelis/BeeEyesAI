import { Loader2, MessageSquare, Quote, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Friend, Testimonial } from "@/features/home/types";
import { SettingsCard, SectionLabel } from "./SettingsShell";

interface TestimonialsCardProps {
  testimonials: Testimonial[];
  friends: Friend[];
  testimonialTarget: string;
  testimonialText: string;
  setTestimonialTarget: (v: string) => void;
  setTestimonialText: (v: string) => void;
  onSubmit: () => void;
  saving: boolean;
}

const TESTIMONIAL_MAX = 500;

export function TestimonialsCard(props: TestimonialsCardProps) {
  const {
    testimonials,
    friends,
    testimonialTarget,
    testimonialText,
    setTestimonialTarget,
    setTestimonialText,
    onSubmit,
    saving,
  } = props;

  const textLen = testimonialText.length;
  const overLimit = textLen > TESTIMONIAL_MAX;
  const canSubmit =
    !!testimonialTarget && testimonialText.trim().length > 0 && !overLimit && friends.length > 0;

  return (
    <SettingsCard
      icon={<Quote className="w-4 h-4" />}
      title="Depoimentos"
      description={`${testimonials.length} ${
        testimonials.length === 1 ? "depoimento recebido" : "depoimentos recebidos"
      }`}
    >
      {testimonials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-gradient-to-br from-primary/5 to-background/30 p-6 text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-bold">Nenhum depoimento ainda</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Seus amigos podem deixar mensagens carinhosas por aqui. Você também pode escrever para outros 🐝💛
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {testimonials.map((t) => (
            <article
              key={t.id}
              className="rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/30"
            >
              <header className="flex items-center gap-2 mb-1.5">
                {t.authorAvatarUrl ? (
                  <img
                    src={t.authorAvatarUrl}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-primary/30"
                  />
                ) : (
                  <div className="bee-hex w-7 h-7 bg-primary/40 flex items-center justify-center text-[10px] font-black text-primary-foreground">
                    {(t.authorDisplayName || t.authorUsername || "?")[0].toUpperCase()}
                  </div>
                )}
                <p className="text-xs font-bold flex-1 min-w-0 truncate">
                  {t.authorDisplayName || t.authorUsername || "Amigo"}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {t.createdAt
                    ? new Date(t.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })
                    : ""}
                </span>
              </header>
              <blockquote className="text-sm italic text-foreground leading-relaxed border-l-2 border-primary/40 pl-2.5">
                "{t.content}"
              </blockquote>
            </article>
          ))}
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2.5">
        <SectionLabel>Escrever para um amigo</SectionLabel>

        {friends.length === 0 ? (
          <div className="rounded-lg border border-amber-300/40 bg-amber-50/30 dark:bg-amber-500/5 dark:border-amber-500/30 p-3 flex items-start gap-2">
            <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              Conecte-se com amigos primeiro para poder escrever depoimentos.
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-[200px_1fr] gap-2">
              <div className="relative">
                <Users className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  value={testimonialTarget}
                  onChange={(e) => setTestimonialTarget(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label="Escolher amigo"
                >
                  <option value="">Escolher amigo...</option>
                  {friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.displayName || f.username}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                value={testimonialText}
                onChange={(e) => setTestimonialText(e.target.value)}
                maxLength={TESTIMONIAL_MAX + 50}
                rows={2}
                placeholder="Escreva uma mensagem carinhosa estilo Orkut 💛"
                aria-label="Texto do depoimento"
                className={`min-h-[64px] resize-none ${
                  overLimit ? "border-destructive focus-visible:ring-destructive/50" : ""
                }`}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-mono ${
                  overLimit ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {textLen}/{TESTIMONIAL_MAX}
              </span>
              <Button
                size="sm"
                disabled={saving || !canSubmit}
                onClick={onSubmit}
                aria-label="Publicar depoimento"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Publicar depoimento
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </SettingsCard>
  );
}
