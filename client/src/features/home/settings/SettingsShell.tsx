import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface SettingsCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  tone?: "default" | "highlight" | "destructive" | "muted";
  contentClassName?: string;
}

export function SettingsCard({
  icon,
  title,
  description,
  action,
  children,
  tone = "default",
  contentClassName,
}: SettingsCardProps) {
  const toneClasses =
    tone === "highlight"
      ? "border-primary/30 bg-gradient-to-br from-primary/8 via-card to-card"
      : tone === "destructive"
      ? "border-destructive/25 bg-card"
      : tone === "muted"
      ? "border-border/60 bg-background/40"
      : "border-border/70 bg-card";

  return (
    <Card className={`overflow-hidden shadow-sm transition-shadow hover:shadow-md ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {icon ? (
            <span className="bee-hex flex h-9 w-9 shrink-0 items-center justify-center bg-primary/12 text-primary">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-tight">{title}</p>
            {description ? (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={`px-4 pb-4 space-y-3 ${contentClassName ?? ""}`}>{children}</div>
    </Card>
  );
}

interface SettingsRowProps {
  title: string;
  description?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function SettingsRow({ title, description, trailing, onClick, disabled }: SettingsRowProps) {
  const interactive = Boolean(onClick) && !disabled;
  const Comp: any = interactive ? "button" : "div";
  return (
    <Comp
      onClick={interactive ? onClick : undefined}
      disabled={disabled}
      className={`w-full text-left flex items-center justify-between gap-3 py-2.5 min-h-[44px] ${
        interactive
          ? "hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:bg-muted/40"
          : ""
      } ${disabled ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{title}</p>
        {description ? <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </Comp>
  );
}

interface SectionLabelProps {
  children: ReactNode;
  htmlFor?: string;
  rightSlot?: ReactNode;
}

export function SectionLabel({ children, htmlFor, rightSlot }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {children}
      </label>
      {rightSlot}
    </div>
  );
}

export function DirtyDot({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      aria-label="Alterações não salvas"
      title="Alterações não salvas"
      className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 ml-1.5 align-middle animate-pulse"
    />
  );
}
