import { Lock, X } from "lucide-react";

interface WhyThisAdModalProps {
  isPersonalized: boolean;
  advertiserName: string;
  onClose: () => void;
  onAdjustPreferences: () => void;
}

export function WhyThisAdModal({ isPersonalized, advertiserName, onClose, onAdjustPreferences }: WhyThisAdModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">Por que estou vendo este anúncio?</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground mb-4">
          {isPersonalized ? (
            <p>
              Este anúncio foi selecionado com base nos{" "}
              <strong className="text-foreground">interesses que você escolheu</strong> nas suas preferências.
              Nenhum dado sensível foi usado.
            </p>
          ) : (
            <p>
              Este anúncio foi selecionado com base no{" "}
              <strong className="text-foreground">contexto da conversa</strong> — temas gerais, sem análise
              de dados pessoais.
            </p>
          )}
          <p>
            Anunciante: <strong className="text-foreground">{advertiserName}</strong>
          </p>
        </div>

        <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Lock className="w-3.5 h-3.5 text-primary" />
            Compromissos da Bee com você
          </div>
          {[
            "Nunca usamos dados de saúde, localização ou emoções para publicidade",
            "Nunca rastreamos você fora do app",
            "Não compartilhamos seus dados com anunciantes",
            "Nenhum anúncio em momentos vulneráveis ou sensíveis",
            "Usuários premium não veem anúncios",
          ].map((item) => (
            <p key={item} className="text-xs text-muted-foreground pl-5">
              • {item}
            </p>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onAdjustPreferences}
            className="flex-1 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
          >
            Ajustar preferências
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
