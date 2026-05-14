import { useMemo, type ReactNode } from "react";
import { Award, Camera, Flame, Sparkles, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MEDAL_BY_TYPE } from "@/lib/medals";
import type { User } from "@/features/home/types";
import { profileCompleteness } from "./profileCompleteness";

interface ProfileHeaderCardProps {
  user: User | null;
  avatarUrl: string;
  totalAchievements: number;
  totalFriends?: number;
  totalActiveDays?: number;
  onSelectPhoto?: () => void;
}

export function ProfileHeaderCard({
  user,
  avatarUrl,
  totalAchievements,
  totalFriends,
  totalActiveDays,
  onSelectPhoto,
}: ProfileHeaderCardProps) {
  const initials = (user?.displayName || user?.username || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const completeness = useMemo(() => profileCompleteness(user, avatarUrl), [user, avatarUrl]);
  const streak = totalActiveDays ?? user?.currentStreak ?? 0;
  const totalMedals = Object.keys(MEDAL_BY_TYPE).length;

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/12 via-card to-card shadow-sm">
      {/* Decorative honeycomb backdrop */}
      <div aria-hidden className="relative">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/15 to-transparent pointer-events-none" />

        <div className="relative p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <button
              type="button"
              onClick={onSelectPhoto}
              aria-label="Trocar foto de perfil"
              className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.displayName || user?.username || "Foto de perfil"}
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-primary/30 ring-offset-2 ring-offset-background shadow-md transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="bee-hex h-24 w-24 bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground shadow-md">
                  {initials || "🐝"}
                </div>
              )}
              {onSelectPhoto ? (
                <span className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="rounded-full bg-background/90 text-foreground p-2 shadow-md">
                    <Camera className="w-4 h-4" />
                  </span>
                </span>
              ) : null}
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 rounded-full border-2 border-background bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5 shadow-sm"
                title={`Nível ${user?.level ?? 1}`}
              >
                Nv {user?.level ?? 1}
              </span>
            </button>

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="font-display text-xl font-black truncate max-w-full">
                  {user?.displayName || user?.username || "Sua conta"}
                </h2>
                <span className="rounded-full bg-primary/15 text-primary text-[10px] font-bold px-2 py-0.5 shrink-0">
                  {user?.xp ?? 0} XP
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
              {user?.bio ? (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{user.bio}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground/70 mt-2">
                  Conte um pouco sobre você ✨
                </p>
              )}
            </div>
          </div>

          {/* Progresso do perfil */}
          <div className="rounded-xl border border-border/60 bg-background/50 backdrop-blur-sm p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold text-foreground">
                Perfil {completeness.percent}% completo
              </p>
              {completeness.missing.length > 0 ? (
                <p
                  className="text-[10px] text-muted-foreground truncate max-w-[55%]"
                  title={`Faltando: ${completeness.missing.join(", ")}`}
                >
                  Faltando: {completeness.missing.slice(0, 2).join(", ")}
                  {completeness.missing.length > 2 ? "…" : ""}
                </p>
              ) : (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Tudo certo! 🐝
                </span>
              )}
            </div>
            <Progress value={completeness.percent} className="h-2" />
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile
              icon={<Award className="w-3.5 h-3.5" />}
              label="Medalhas"
              value={`${totalAchievements}/${totalMedals}`}
            />
            <StatTile icon={<Users className="w-3.5 h-3.5" />} label="Amigos" value={totalFriends ?? 0} />
            <StatTile icon={<Flame className="w-3.5 h-3.5" />} label="Dias seguidos" value={streak} />
            <StatTile
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="Nível"
              value={user?.level ?? 1}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="group rounded-xl border border-border/60 bg-background/50 backdrop-blur-sm px-2 py-2.5 text-center transition-all hover:border-primary/40 hover:bg-primary/5">
      <div className="flex items-center justify-center text-primary">{icon}</div>
      <p className="text-base font-black mt-0.5 leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{label}</p>
    </div>
  );
}
