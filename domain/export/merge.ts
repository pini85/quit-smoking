/**
 * Merge an imported snapshot into the current one. Pure — never mutates
 * either input.
 */

import type { ExportSnapshot } from '@/domain/export/format';

export interface MergeSummary {
  newCravings: number;
  newUnlocks: number;
  newReasons: number;
  totalCravingsAfter: number;
  profileAdopted: boolean;
}

/**
 * Union two id-keyed collections. On a colliding id, the CURRENT item wins.
 * Returns the merged array plus a count of genuinely new (imported-only) ids.
 * Never mutates `current` or `imported`.
 */
function unionKeepingCurrent<T extends { id: string }>(
  current: T[],
  imported: T[]
): { merged: T[]; newCount: number } {
  const byId = new Map<string, T>();
  for (const item of current) {
    byId.set(item.id, item);
  }
  let newCount = 0;
  for (const item of imported) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
      newCount++;
    }
  }
  return { merged: [...byId.values()], newCount };
}

function sortByIsoField<T>(items: T[], isoField: (item: T) => string): T[] {
  return [...items].sort(
    (a, b) => new Date(isoField(a)).getTime() - new Date(isoField(b)).getTime()
  );
}

export function mergeSnapshots(
  current: ExportSnapshot,
  imported: ExportSnapshot
): { merged: ExportSnapshot; summary: MergeSummary } {
  const { merged: mergedCravingsUnsorted, newCount: newCravings } = unionKeepingCurrent(
    current.cravings,
    imported.cravings
  );
  const { merged: mergedUnlocks, newCount: newUnlocks } = unionKeepingCurrent(
    current.achievementUnlocks,
    imported.achievementUnlocks
  );
  const { merged: mergedReasonsUnsorted, newCount: newReasons } = unionKeepingCurrent(
    current.reasons,
    imported.reasons
  );

  const mergedCravings = sortByIsoField(mergedCravingsUnsorted, (c) => c.startedAt);
  const mergedReasons = sortByIsoField(mergedReasonsUnsorted, (r) => r.createdAt);

  const profileAdopted = current.profile === null && imported.profile !== null;
  const mergedProfile = current.profile ?? (profileAdopted ? imported.profile : null);

  const merged: ExportSnapshot = {
    profile: mergedProfile,
    cravings: mergedCravings,
    achievementUnlocks: mergedUnlocks,
    reasons: mergedReasons,
    preferences: current.preferences,
  };

  const summary: MergeSummary = {
    newCravings,
    newUnlocks,
    newReasons,
    totalCravingsAfter: mergedCravings.length,
    profileAdopted,
  };

  return { merged, summary };
}
