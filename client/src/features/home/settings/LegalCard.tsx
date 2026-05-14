import { ChevronRight, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "./SettingsShell";

interface LegalCardProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export function LegalCard({ onOpenPrivacy, onOpenTerms }: LegalCardProps) {
  return (
    <SettingsCard
      icon={<FileText className="w-4 h-4" />}
      title="Termos legais"
      description="Como tratamos seus dados"
    >
      <div className="grid sm:grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="justify-between min-h-[44px]"
          onClick={onOpenPrivacy}
          aria-label="Abrir Política de Privacidade"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Política de Privacidade
          </span>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className="justify-between min-h-[44px]"
          onClick={onOpenTerms}
          aria-label="Abrir Termos de Uso"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Termos de Uso
          </span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </SettingsCard>
  );
}
