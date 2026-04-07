export const ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL = 3;

export function hasAnonymousProfileVisitsUnlocked(user: { level?: number | null } | null | undefined) {
  return (user?.level ?? 0) >= ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL;
}

export function getAnonymousProfileVisitsUnlockMessage() {
  return `Desbloqueie no nível ${ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL} acumulando XP nas missões.`;
}
