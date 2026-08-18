/**
 * Deterministic insight-generation rules.
 *
 * Pure; explicit `now`/`quitAt`; never fabricates — every rule returns
 * `null` when the underlying data is below its exact threshold. Rules reuse
 * the math already implemented in `cravingStats.ts` (histogram, hardest
 * window, per-trigger stats, week stats, duration, gap) rather than
 * recomputing it.
 */

import type { CravingSession, Locale, Trigger } from '@/domain/types';
import { isoWeekKey } from '@/domain/time';
import { triggerLabel, triggerInSentence } from '@/data/triggers';
import {
  hardestWindow,
  perTriggerStats,
  avgInitialIntensity,
  avgDurationSec,
  longestCravingFreeGapMs,
  resolvedSessions,
  weeklyCounts,
} from '@/domain/stats/cravingStats';

export type InsightKind =
  | 'peak-hours'
  | 'trigger-share'
  | 'intensity-decline'
  | 'frequency-decline'
  | 'trigger-victory'
  | 'avg-duration'
  | 'craving-free-record';

export interface Insight {
  id: string; // kind + discriminator, e.g. 'trigger-share:coffee'
  kind: InsightKind;
  text: string; // full human sentence, deterministic from data
  priority: number; // lower = more important
}

export interface InsightRule {
  kind: InsightKind;
  minSessions: number;
  compute(
    sessions: CravingSession[],
    quitAt: Date,
    now: Date,
    locale?: Locale
  ): Insight | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Finnish writes decimals with a comma ("6,5"), never a point. */
function fiDecimal(formatted: string): string {
  return formatted.replace('.', ',');
}

/** Per-trigger stats as an array, for argmax scans below. */
function triggerEntries(
  sessions: CravingSession[]
): [Trigger, { total: number; passed: number; rate: number | null }][] {
  return Object.entries(perTriggerStats(sessions)) as [
    Trigger,
    { total: number; passed: number; rate: number | null },
  ][];
}

/**
 * Rule 1 — peak-hours (priority 1).
 * Gate: >= 10 sessions AND the densest 3h window (`hardestWindow`) holds
 * >= 40% of all sessions. `hardestWindow`'s `endHour` is EXCLUSIVE — the
 * window `[startHour, endHour)` already spans exactly 3 clock-hours, so the
 * display is `{startHour}:00–{endHour}:00` directly (no `+1`): e.g.
 * startHour=19, endHour=22 (exclusive, covering 19/20/21) reads as
 * "19:00–22:00", matching the brief's example text verbatim.
 * Per the controller's template amendment, the second sentence is
 * window-derived (not a hardcoded "9 pm"): `A {start}:00 craving is one you
 * saw coming.`, reusing the same zero-padded `startHour` as the first
 * sentence.
 */
const peakHoursRule: InsightRule = {
  kind: 'peak-hours',
  minSessions: 10,
  compute(sessions, _quitAt, _now, locale = 'en') {
    const total = sessions.length;
    if (total < 10) return null;
    const window = hardestWindow(sessions);
    if (window === null) return null;
    // 40% threshold via cross-multiplication to avoid float error: count/total >= 0.4 <=> count*5 >= total*2
    if (window.count * 5 < total * 2) return null;
    const start = pad2(window.startHour);
    const end = pad2(window.endHour);
    const text =
      locale === 'fi'
        ? `Mielitekosi keskittyvät kello ${start}:00–${end}:00 välille. ` +
          `Kello ${start}:00 mieliteko on sellainen, jonka näit tulevan.`
        : `Your cravings cluster between ${start}:00–${end}:00. ` +
          `A ${start}:00 craving is one you saw coming.`;
    return { id: 'peak-hours', kind: 'peak-hours', text, priority: 1 };
  },
};

/**
 * Rule 2 — trigger-share (priority 2).
 * Gate: >= 8 sessions WITH a trigger recorded, and some trigger's share of
 * THOSE (not all sessions) is >= 25%. Reuses `perTriggerStats` for totals;
 * ties broken by higher passed-count, then alphabetically by trigger key
 * (mirrors `strongestTrigger`'s tie-break in cravingStats.ts).
 */
const triggerShareRule: InsightRule = {
  kind: 'trigger-share',
  minSessions: 8,
  compute(sessions, _quitAt, _now, locale = 'en') {
    const entries = triggerEntries(sessions);
    if (entries.length === 0) return null;
    const totalWithTrigger = entries.reduce((sum, [, v]) => sum + v.total, 0);
    if (totalWithTrigger < 8) return null;

    let best = entries[0];
    for (const entry of entries.slice(1)) {
      const [trigger, stats] = entry;
      const [bestTrigger, bestStats] = best;
      if (stats.total > bestStats.total) {
        best = entry;
      } else if (stats.total === bestStats.total) {
        if (
          stats.passed > bestStats.passed ||
          (stats.passed === bestStats.passed && trigger < bestTrigger)
        ) {
          best = entry;
        }
      }
    }

    const [bestTrigger, bestStats] = best;
    // 25% threshold via cross-multiplication: total/totalWithTrigger >= 0.25 <=> total*4 >= totalWithTrigger
    if (bestStats.total * 4 < totalWithTrigger) return null;
    const pct = Math.round((bestStats.total / totalWithTrigger) * 100);
    const label = triggerLabel(bestTrigger, locale);
    const text =
      locale === 'fi'
        ? `${label} liittyy ${pct} prosenttiin kirjaamistasi mieliteoista.`
        : `${label} is linked to ${pct}% of your recorded cravings.`;
    return { id: `trigger-share:${bestTrigger}`, kind: 'trigger-share', text, priority: 2 };
  },
};

/**
 * Rule 3 — intensity-decline (priority 3).
 * Gate: >= 2 distinct ISO weeks (device-local calendar weeks, via
 * `isoWeekKey` — independent of `firstWeekVsThisWeek`'s rolling windows)
 * each with >= 5 sessions, and (earliest qualifying week avg - latest
 * qualifying week avg) >= 1.0. Reuses `avgInitialIntensity` (already
 * 1-decimal-rounded) for both the threshold check and the display value;
 * the delta comparison is done in tenths (integers) to avoid float noise
 * from subtracting two already-rounded decimals.
 */
const intensityDeclineRule: InsightRule = {
  kind: 'intensity-decline',
  minSessions: 10,
  compute(sessions, _quitAt, _now, locale = 'en') {
    const byWeek = new Map<string, CravingSession[]>();
    for (const s of sessions) {
      const key = isoWeekKey(new Date(s.startedAt));
      const arr = byWeek.get(key);
      if (arr) arr.push(s);
      else byWeek.set(key, [s]);
    }
    const qualifyingKeys = [...byWeek.keys()]
      .filter((key) => (byWeek.get(key) as CravingSession[]).length >= 5)
      .sort();
    if (qualifyingKeys.length < 2) return null;

    const firstKey = qualifyingKeys[0];
    const latestKey = qualifyingKeys[qualifyingKeys.length - 1];
    const firstAvg = avgInitialIntensity(byWeek.get(firstKey) as CravingSession[]) as number;
    const latestAvg = avgInitialIntensity(byWeek.get(latestKey) as CravingSession[]) as number;

    const deltaTenths = Math.round(firstAvg * 10) - Math.round(latestAvg * 10);
    if (deltaTenths < 10) return null;

    const text =
      locale === 'fi'
        ? `Mielitekojesi keskimääräinen voimakkuus on laskenut: ensimmäisellä viikolla ${fiDecimal(firstAvg.toFixed(1))}, tällä viikolla ${fiDecimal(latestAvg.toFixed(1))}.`
        : `Your average craving intensity dropped from ${firstAvg.toFixed(1)} in week one to ${latestAvg.toFixed(1)} this week.`;
    return { id: 'intensity-decline', kind: 'intensity-decline', text, priority: 3 };
  },
};

/**
 * Rule 4 — frequency-decline (priority 4).
 * Gate: >= 3 full (fully-elapsed) ISO weeks since `quitAt` — the week
 * containing `now` is excluded as partial — with >= 1 session total across
 * those full weeks. Reuses `weeklyCounts` (which zero-fills from quitAt's
 * week through now's week inclusive) and drops its last bucket, since a
 * week containing `now` is necessarily still in progress.
 * Fires if the last 3 full weeks are monotonically non-increasing, OR the
 * latest full week is <= 70% of the FIRST full week. "First full week" is
 * always `weeklyCounts`' first entry — i.e. the quit week itself, NOT the
 * first of the "last 3" window — matching the text's "at the start"; this
 * is disambiguated by a >= 4-elapsed-full-weeks test where the two
 * readings would otherwise diverge. The 70% comparison is done via
 * cross-multiplication (latest*10 <= first*7) to avoid float error.
 */
const frequencyDeclineRule: InsightRule = {
  kind: 'frequency-decline',
  minSessions: 1,
  compute(sessions, quitAt, now, locale = 'en') {
    // Reuse weeklyCounts's zero-filled per-ISO-week buckets (quitAt's week
    // through now's week inclusive) and drop the last entry — the week
    // containing `now` — since it is necessarily partial/still-elapsing.
    const fullWeeks = weeklyCounts(sessions, quitAt, now)
      .slice(0, -1)
      .map((w) => w.count);

    if (fullWeeks.length < 3) return null;
    const total = fullWeeks.reduce((a, b) => a + b, 0);
    if (total < 1) return null;

    const first = fullWeeks[0];
    const latest = fullWeeks[fullWeeks.length - 1];
    const last3 = fullWeeks.slice(-3);
    const monotonicNonIncreasing = last3[0] >= last3[1] && last3[1] >= last3[2];
    const percentDeclineOk = latest * 10 <= first * 7;

    if (!monotonicNonIncreasing && !percentDeclineOk) return null;

    const text =
      locale === 'fi'
        ? `Mieliteot harvenevat: alussa ${first}/viikko, nyt ${latest}/viikko.`
        : `Cravings are becoming less frequent: ${first}/week at the start, ${latest}/week now.`;
    return { id: 'frequency-decline', kind: 'frequency-decline', text, priority: 4 };
  },
};

/**
 * Rule 5 — trigger-victory (priority 5).
 * Gate: some trigger has >= 5 passed (resolved, non-smoked) sessions.
 * Reuses `perTriggerStats`'s `passed` field; ties broken alphabetically by
 * trigger key.
 */
const triggerVictoryRule: InsightRule = {
  kind: 'trigger-victory',
  minSessions: 5,
  compute(sessions, _quitAt, _now, locale = 'en') {
    const entries = triggerEntries(sessions);
    if (entries.length === 0) return null;

    let best = entries[0];
    for (const entry of entries.slice(1)) {
      const [trigger, stats] = entry;
      const [bestTrigger, bestStats] = best;
      if (
        stats.passed > bestStats.passed ||
        (stats.passed === bestStats.passed && trigger < bestTrigger)
      ) {
        best = entry;
      }
    }

    const [bestTrigger, bestStats] = best;
    if (bestStats.passed < 5) return null;
    const text =
      locale === 'fi'
        ? `${bestStats.passed} mielitekoa ${triggerInSentence(bestTrigger, 'fi')} on jo mennyt ohi. Se kierre on hiipumassa.`
        : `You've passed ${bestStats.passed} ${triggerInSentence(bestTrigger)} cravings. That loop is losing.`;
    return { id: `trigger-victory:${bestTrigger}`, kind: 'trigger-victory', text, priority: 5 };
  },
};

/**
 * Rule 6 — avg-duration (priority 6).
 * Gate: >= 5 resolved sessions with `endedAt`. Reuses `resolvedSessions`
 * for the eligibility count and `avgDurationSec` for the average (never
 * recomputes the duration math).
 */
const avgDurationRule: InsightRule = {
  kind: 'avg-duration',
  minSessions: 5,
  compute(sessions, _quitAt, _now, locale = 'en') {
    const eligibleCount = resolvedSessions(sessions).filter((s) => s.endedAt !== undefined).length;
    if (eligibleCount < 5) return null;
    const avgSec = avgDurationSec(sessions);
    if (avgSec === null) return null;
    const minutes = Math.max(1, Math.round(avgSec / 60));
    const text =
      locale === 'fi'
        ? `Kirjaamasi mieliteot kestävät keskimäärin noin ${minutes} minuuttia — ja sinä kestät pidempään.`
        : `Your recorded cravings last about ${minutes} minutes on average — and you outlast them.`;
    return { id: 'avg-duration', kind: 'avg-duration', text, priority: 6 };
  },
};

/**
 * Rule 7 — craving-free-record (priority 7).
 * Gate: >= 5 sessions total and longest craving-free gap (reused from
 * `longestCravingFreeGapMs`) >= 48h. Displayed as 1-decimal days below 3
 * days, whole (rounded) days at/above 3 days, per the brief.
 */
const cravingFreeRecordRule: InsightRule = {
  kind: 'craving-free-record',
  minSessions: 5,
  compute(sessions, quitAt, now, locale = 'en') {
    if (sessions.length < 5) return null;
    const gapMs = longestCravingFreeGapMs(sessions, quitAt, now);
    const FORTY_EIGHT_HOURS_MS = 48 * 3_600_000;
    if (gapMs < FORTY_EIGHT_HOURS_MS) return null;
    const days = gapMs / 86_400_000;
    const formatted = days >= 3 ? `${Math.round(days)}` : days.toFixed(1);
    const text =
      locale === 'fi'
        ? `Pisin mieliteoton jaksosi tähän mennessä: ${fiDecimal(formatted)} päivää.`
        : `Your longest craving-free stretch so far: ${formatted} days.`;
    return { id: 'craving-free-record', kind: 'craving-free-record', text, priority: 7 };
  },
};

export const INSIGHT_RULES: InsightRule[] = [
  peakHoursRule,
  triggerShareRule,
  intensityDeclineRule,
  frequencyDeclineRule,
  triggerVictoryRule,
  avgDurationRule,
  cravingFreeRecordRule,
];

/**
 * Runs all rules, filters nulls, dedupes to at most one insight per kind
 * (keeping the first — i.e. highest-priority-ordered — hit), sorts by
 * priority ascending, and returns the first `limit`. Deterministic: same
 * inputs -> same outputs. For day-rotation the CALLER slices differently;
 * this function does not rotate.
 */
export function generateInsights(
  sessions: CravingSession[],
  quitAt: Date,
  now: Date,
  limit = 3,
  locale: Locale = 'en'
): Insight[] {
  const seenKinds = new Set<InsightKind>();
  const results: Insight[] = [];
  for (const rule of INSIGHT_RULES) {
    if (seenKinds.has(rule.kind)) continue;
    if (sessions.length < rule.minSessions) continue;
    const insight = rule.compute(sessions, quitAt, now, locale);
    if (insight === null) continue;
    seenKinds.add(rule.kind);
    results.push(insight);
  }
  results.sort((a, b) => a.priority - b.priority);
  return results.slice(0, limit);
}
