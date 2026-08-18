import type { MilestoneState } from '@/domain/milestones/engine';

/**
 * `preferences.showEmergingEvidence` gate, applied BEFORE any engine query
 * (happeningNow/upcomingSoon/recentlyAchieved/groupByTimeBand/
 * categoryProgress) so hiding early-evidence entries can never leave a
 * section with something the engine would otherwise have shown. Shared by
 * every health surface that respects the preference — Right Now, Timeline
 * (including the Discoveries found/total counts, which are consequently
 * also gated by this — currently moot, since no `didYouKnow` entry is
 * `emerging`), Body Explorer's per-category counts, and the home screen's
 * "right now" carousel. Category detail deliberately does NOT call this —
 * see `CategoryDetail`.
 */
export function filterEmerging(
  states: MilestoneState[],
  showEmergingEvidence: boolean
): MilestoneState[] {
  return showEmergingEvidence
    ? states
    : states.filter((s) => s.milestone.evidenceLevel !== 'emerging');
}

export default filterEmerging;
