import type { User } from "@/features/home/types";

export interface ProfileCompleteness {
  percent: number;
  missing: string[];
  total: number;
  done: number;
}

export function profileCompleteness(user: User | null, avatarUrl: string): ProfileCompleteness {
  if (!user) return { percent: 0, missing: [], total: 0, done: 0 };
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "Nome", ok: Boolean(user.displayName && user.displayName.trim().length > 0) },
    { label: "Foto", ok: Boolean(avatarUrl) },
    { label: "Bio", ok: Boolean(user.bio && user.bio.trim().length >= 12) },
    { label: "Idioma", ok: Boolean(user.language) },
    { label: "E-mail", ok: Boolean(user.email && user.email.length > 0) },
  ];
  const done = checks.filter((c) => c.ok).length;
  const percent = Math.round((done / checks.length) * 100);
  return {
    percent,
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
    total: checks.length,
    done,
  };
}
