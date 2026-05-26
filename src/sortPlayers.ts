/** 1 = הכי חזק, 6 = הכי חלש; ללא דירוג בסוף. */
export function strengthSortKey(strength: number | null | undefined): number {
  if (strength === null || strength === undefined) return 99;
  return strength;
}

export function comparePlayersByStrength<
  T extends { strength: number | null | undefined; name: string },
>(a: T, b: T): number {
  const byStrength = strengthSortKey(a.strength) - strengthSortKey(b.strength);
  if (byStrength !== 0) return byStrength;
  return a.name.localeCompare(b.name, "he");
}

export function sortPlayersByStrength<
  T extends { strength: number | null | undefined; name: string },
>(players: readonly T[]): T[] {
  return [...players].sort(comparePlayersByStrength);
}

export function sortPlayerIdsByStrength(
  ids: readonly string[],
  byId: ReadonlyMap<string, { strength: number | null | undefined; name: string }>
): string[] {
  return [...ids].sort((ida, idb) => {
    const a = byId.get(ida);
    const b = byId.get(idb);
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return comparePlayersByStrength(a, b);
  });
}
