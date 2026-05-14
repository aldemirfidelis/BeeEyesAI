export const ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL = 3;

export function hasAnonymousProfileVisitsUnlocked(_user: { level?: number | null } | null | undefined) {
  return true;
}

export function getAnonymousProfileVisitsUnlockMessage() {
  return "";
}
