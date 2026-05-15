import { useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, Lock, Share2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

export function SendToFeedModal({
  open,
  sourceMessageId,
  sourceContent,
  submitting,
  onCancel,
  onPublish,
}: SendToFeedModalProps) {
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

  if (!open) return null;

  const contentLen = content.length;
  const overLimit = contentLen > 500;
  const canPublish = content.trim().length > 0 && !overLimit && !submitting;

  return (
    <div
      className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Enviar para o Feed"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl border border-border bg-card max-h-[88vh] flex flex-col shadow-xl">
        <header className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bee-hex flex h-8 w-8 items-center justify-center bg-primary/15 text-primary shrink-0">
              <Share2 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base">Enviar para o Feed</h3>
              <p className="text-[11px] text-muted-foreground">Edite antes de publicar — você decide o que vai ao ar.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting} aria-label="Fechar">
            <X className="w-4 h-4" />
          </Button>
        </header>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {/* Título */}
          <div className="space-y-1.5">
            <label htmlFor="draft-title" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Título (sugerido)
            </label>
            <Input
              id="draft-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Um título curto para o seu post"
            />
          </div>

          {/* Conteúdo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="draft-content" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Conteúdo
              </label>
              <span className={`text-[10px] font-mono ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {contentLen}/500
              </span>
            </div>
            <Textarea
              id="draft-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Adapte o texto antes de publicar"
              className={`min-h-[120px] resize-none ${overLimit ? "border-destructive focus-visible:ring-destructive/50" : ""}`}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoria</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(active ? null : c)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hashtags */}
          <div className="space-y-1.5">
            <label htmlFor="draft-hashtags" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Hashtags (separadas por vírgula)
            </label>
            <Input
              id="draft-hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              maxLength={240}
              placeholder="produtividade, foco, rotina"
            />
          </div>

          {/* Privacidade */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quem vê este post?</label>
            <div className="grid grid-cols-3 gap-2">
              <PrivacyButton active={privacy === "public"} onClick={() => setPrivacy("public")} icon={<Globe2 className="w-3.5 h-3.5" />} label="Público" />
              <PrivacyButton active={privacy === "friends"} onClick={() => setPrivacy("friends")} icon={<Users className="w-3.5 h-3.5" />} label="Amigos" />
              <PrivacyButton active={privacy === "private"} onClick={() => setPrivacy("private")} icon={<Lock className="w-3.5 h-3.5" />} label="Só eu" />
            </div>
            {privacy !== "public" ? (
              <p className="text-[10px] text-muted-foreground">
                Privacidade granular está em rollout — por enquanto, salvamos no Feed público mas registramos sua preferência.
              </p>
            ) : null}
          </div>

          <p className="text-[10px] text-muted-foreground italic">
            Origem: criado com ajuda da Bee 🐝
          </p>
        </div>

        <footer className="p-3 border-t border-border shrink-0 flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              onPublish({ sourceMessageId, title, content, category, hashtags, privacy, publishNow: false })
            }
            disabled={!canPublish}
          >
            Salvar rascunho
          </Button>
          <Button
            className="flex-1"
            onClick={() =>
              onPublish({ sourceMessageId, title, content, category, hashtags, privacy, publishNow: true })
            }
            disabled={!canPublish}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Publicando...
              </>
            ) : (
              "Publicar no Feed"
            )}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function PrivacyButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
      }`}
    >
      {icon}
      {label}
    </button>
  );
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
