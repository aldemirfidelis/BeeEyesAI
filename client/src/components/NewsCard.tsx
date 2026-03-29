import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NewsCardProps {
  title: string;
  link: string;
  source: string;
  authHeaders: () => Record<string, string>;
}

export default function NewsCard({ title, link, source, authHeaders }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleToggle = async () => {
    if (!expanded && !summary && !error) {
      setLoading(true);
      try {
        const res = await fetch("/api/news/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ url: link, title }),
        });
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 overflow-hidden">
      {/* Header — clicável */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{source || "Google News"}</p>
        </div>
        <div className="shrink-0 mt-0.5 text-muted-foreground">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : expanded
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
          }
        </div>
      </button>

      {/* Resumo expansível */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-3">
              {loading && (
                <p className="text-xs text-muted-foreground">Gerando resumo...</p>
              )}
              {error && (
                <p className="text-xs text-muted-foreground">Não foi possível gerar o resumo. Leia o artigo completo.</p>
              )}
              {summary && (
                <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
              )}
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Saiba mais
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
