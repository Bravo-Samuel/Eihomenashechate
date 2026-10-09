export function shouldResetProfileForUser(
  previousUserId: string | null,
  currentUserId: string,
): boolean {
  return previousUserId !== currentUserId;
}

export function isProfileSyncedForUser(
  syncedUserId: string | null,
  currentUserId: string | null | undefined,
): boolean {
  return Boolean(currentUserId) && syncedUserId === currentUserId;
}
