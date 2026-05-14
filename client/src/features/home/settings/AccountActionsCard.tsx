import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@/features/home/types";
import { SettingsCard } from "./SettingsShell";

interface AccountActionsCardProps {
  user: User | null;
  onLogout: () => void;
}

export function AccountActionsCard({ user, onLogout }: AccountActionsCardProps) {
  return (
    <SettingsCard
      icon={<UserRound className="w-4 h-4" />}
      title="Conta"
      description={
        user?.email ? `Conectado como ${user.email}` : user?.username ? `Conectado como @${user.username}` : undefined
      }
      tone="destructive"
    >
      <Button
        variant="outline"
        className="w-full flex items-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60 min-h-[44px]"
        onClick={onLogout}
        aria-label="Sair da conta"
      >
        <LogOut className="w-4 h-4" />
        Sair da conta
      </Button>
    </SettingsCard>
  );
}
