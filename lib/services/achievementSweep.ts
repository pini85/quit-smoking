import type { DataStore } from '@/lib/services/dataStore';
import { ACHIEVEMENT_DEFINITIONS } from '@/domain/achievements/definitions';
import { evaluateAchievements } from '@/domain/achievements/engine';
import { toLocalIso } from '@/lib/utils/iso';
import { showToast } from '@/components/ui/Toast';

/**
 * Re-evaluates every achievement against the CURRENT store snapshot and
 * persists whatever just became true.
 *
 * Must be called AFTER the write that could have unlocked something (the
 * `DataStore` write-throughs re-read persistence before resolving, so
 * `getSnapshot()` here is already the post-write truth — no manual list
 * splicing, no stale-by-one bugs).
 *
 * Only the first new unlock is announced. Backfilling a long-abandoned quit
 * can satisfy half a dozen definitions at once, and six stacked toasts on
 * the screen someone reached mid-craving would be noise at exactly the wrong
 * moment; the rest are still persisted and appear on the achievements screen.
 */
export async function sweepAchievements(store: DataStore): Promise<void> {
  const snapshot = store.getSnapshot();
  if (snapshot.profile === null) return;

  const newlyUnlocked = evaluateAchievements(ACHIEVEMENT_DEFINITIONS, {
    profile: snapshot.profile,
    cravings: snapshot.cravings,
    unlocked: new Set(snapshot.achievementUnlocks.map((u) => u.id)),
    now: new Date(),
  });
  if (newlyUnlocked.length === 0) return;

  const unlockedAt = toLocalIso(new Date());
  await store.addUnlocks(newlyUnlocked.map((def) => ({ id: def.id, unlockedAt })));
  showToast(`${newlyUnlocked[0].title} — ${newlyUnlocked[0].fact}`, { withRingPulse: true });
}

export default sweepAchievements;
