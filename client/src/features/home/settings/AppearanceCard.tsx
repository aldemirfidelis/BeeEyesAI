import type { ReactNode } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "@/lib/theme";
import { SettingsCard } from "./SettingsShell";

interface AppearanceCardProps {
  preference: ThemePreference;
  onSelect: (pref: ThemePreference) => void;
}

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: ReactNode;
  desc: string;
  preview: ReactNode;
}

const OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Claro",
    icon: <Sun className="w-4 h-4" />,
    desc: "Mais luminoso",
    preview: (
      <div
        aria-hidden
        className="h-12 rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100 flex items-end p-1.5 gap-1"
      >
        <span className="h-2 flex-1 rounded-sm bg-amber-400" />
        <span className="h-3 flex-1 rounded-sm bg-amber-300" />
        <span className="h-1.5 flex-1 rounded-sm bg-amber-500" />
      </div>
    ),
  },
  {
    value: "dark",
    label: "Escuro",
    icon: <Moon className="w-4 h-4" />,
    desc: "Confortável à noite",
    preview: (
      <div
        aria-hidden
        className="h-12 rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-end p-1.5 gap-1"
      >
        <span className="h-2 flex-1 rounded-sm bg-amber-500" />
        <span className="h-3 flex-1 rounded-sm bg-amber-400" />
        <span className="h-1.5 flex-1 rounded-sm bg-amber-600" />
      </div>
    ),
  },
  {
    value: "system",
    label: "Automático",
    icon: <Monitor className="w-4 h-4" />,
    desc: "Segue o sistema",
    preview: (
      <div aria-hidden className="h-12 rounded-lg border border-border overflow-hidden flex">
        <div className="flex-1 bg-gradient-to-br from-amber-50 via-white to-amber-100 flex items-end p-1.5">
          <span className="h-2 w-full rounded-sm bg-amber-400" />
        </div>
        <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-end p-1.5">
          <span className="h-2 w-full rounded-sm bg-amber-500" />
        </div>
      </div>
    ),
  },
];

export function AppearanceCard({ preference, onSelect }: AppearanceCardProps) {
  const activeIcon = OPTIONS.find((o) => o.value === preference)?.icon ?? <Sun className="w-4 h-4" />;

  return (
    <SettingsCard
      icon={activeIcon}
      title="Aparência"
      description="Escolha como a Bee aparece para você"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              aria-pressed={active}
              aria-label={`Tema ${opt.label}: ${opt.desc}`}
              className={`group rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                active
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {opt.preview}
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`flex items-center gap-1.5 text-sm font-bold ${
                    active ? "text-primary" : "text-foreground"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </span>
                {active ? <Check className="w-4 h-4 text-primary" /> : null}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}
