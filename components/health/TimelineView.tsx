'use client';

import { useState } from 'react';
import type { HealthMilestone, Locale } from '@/domain/types';
import type { MilestoneState } from '@/domain/milestones/engine';
import { TIME_BANDS, bandOf, currentBandId, groupByTimeBand, timeBandLabel } from '@/domain/milestones/engine';
import { hoursBetween } from '@/domain/time';
import { humanizeEta } from '@/components/home/humanizeEta';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { filterEmerging } from './filterEmerging';
import { TimelineRow } from './MilestoneRows';
import { localizedMilestone } from '@/data/healthMilestones';

const HOUR_MS = 3_600_000;

export type TimelineViewProps = {
  states: MilestoneState[];
  showEmergingEvidence: boolean;
  quitAt: Date;
  now: Date;
  onOpenMilestone: (milestone: HealthMilestone) => void;
};

/** Delegates to the engine's own band assignment rather than reimplementing
 *  the boundary walk, so this never drifts if TIME_BANDS changes. */
function bandLabelOf(m: HealthMilestone, locale: Locale, noFixedTiming: string): string {
  const id = bandOf(m);
  if (id === null) return noFixedTiming;
  return timeBandLabel(id, locale);
}

/**
 * Honest, light collection — no points, no streaks, nothing gamified. Just a
 * running tally of the "did you know" facts that have started applying to
 * you, with the rest left as an unlabelled '???' until their time comes.
 *
 * `states` is expected pre-filtered by `filterEmerging` (see `TimelineView`
 * below), so both `total` and `found` are implicitly gated by
 * `showEmergingEvidence` too — an emerging didYouKnow entry would count
 * toward neither denominator nor numerator when the preference is off.
 * Currently moot: no `didYouKnow` entry in the dataset is `emerging`.
 */
function DiscoveriesCard({
  states,
  onOpenMilestone,
}: {
  states: MilestoneState[];
  onOpenMilestone: (milestone: HealthMilestone) => void;
}) {
  const { locale } = useLocale();
  const m = useMessages();
  const [expanded, setExpanded] = useState(false);
  const pool = states.filter((s) => s.milestone.didYouKnow === true);
  const total = pool.length;
  const found = pool.filter(
    (s) => s.status === 'achieved' || s.status === 'happening-now'
  );
  const locked = pool.filter(
    (s) => s.status !== 'achieved' && s.status !== 'happening-now'
  );

  if (total === 0) return null;

  return (
    <Card className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[15px] font-semibold text-ink">
          {interpolate(m.health.discoveries.foundOf, { found: found.length, total })}
        </span>
        <span aria-hidden="true" className="text-ink-faint">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          {found.map((s) => (
            <button
              key={s.milestone.id}
              type="button"
              onClick={() => onOpenMilestone(s.milestone)}
              className="min-h-11 w-full text-left text-[13px] leading-snug text-ink"
            >
              {localizedMilestone(s.milestone, locale).title}
            </button>
          ))}
          {locked.map((s) => (
            <p key={s.milestone.id} className="py-2 text-[13px] text-ink-muted">
              ??? · {bandLabelOf(s.milestone, locale, m.health.discoveries.noFixedTiming)}
            </p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

type BandKind = 'past' | 'current' | 'future';

function TimeBandSection({
  group,
  kind,
  elapsedH,
  onOpenMilestone,
}: {
  group: ReturnType<typeof groupByTimeBand>[number];
  kind: BandKind;
  elapsedH: number;
  onOpenMilestone: (milestone: HealthMilestone) => void;
}) {
  const [expanded, setExpanded] = useState(kind === 'current');
  const { locale } = useLocale();
  const m = useMessages();
  const { band, states } = group;

  let summary: string | null = null;
  if (kind === 'past') {
    const achievedCount = states.filter((s) => s.status === 'achieved').length;
    summary = interpolate(
      achievedCount === 1 ? m.health.timeBand.changesComplete : m.health.timeBand.changesCompletePlural,
      { count: achievedCount }
    );
  } else if (kind === 'future') {
    const idx = TIME_BANDS.findIndex((b) => b.id === band.id);
    const startHours = idx <= 0 ? 0 : TIME_BANDS[idx - 1].untilHours;
    const startsInMs = Math.max(0, (startHours - elapsedH) * HOUR_MS);
    summary = interpolate(m.health.timeBand.aheadStarts, {
      count: states.length,
      eta: humanizeEta(startsInMs, locale),
    });
  }

  // "You are here" sits right before the first item that isn't achieved yet
  // — the honest boundary between what's already happened and what hasn't.
  // Falls back to the end of the list when everything in the current band
  // (rare: the band was just entered) is already achieved.
  const markerIndex =
    kind === 'current' ? states.findIndex((s) => s.status !== 'achieved') : -1;
  const markerAt = markerIndex === -1 && kind === 'current' ? states.length : markerIndex;

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[15px] font-semibold text-ink">{timeBandLabel(band.id, locale)}</span>
        {summary ? <span className="text-[12px] text-ink-faint">{summary}</span> : null}
      </button>

      {expanded ? (
        <div className="flex flex-col gap-1">
          {states.map((state, index) => (
            <div key={state.milestone.id}>
              {kind === 'current' && index === markerAt ? (
                <p className="py-2 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">
                  {m.health.timeBand.youAreHere}
                </p>
              ) : null}
              <TimelineRow state={state} onOpen={() => onOpenMilestone(state.milestone)} />
            </div>
          ))}
          {kind === 'current' && markerAt === states.length ? (
            <p className="py-2 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">
              {m.health.timeBand.youAreHere}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The full recovery timeline, grouped into the same time bands used
 * throughout the app. Only the current band auto-expands; past and future
 * bands start collapsed to a one-line summary so the page doesn't dump 80
 * rows on first paint.
 */
export function TimelineView({
  states,
  showEmergingEvidence,
  quitAt,
  now,
  onOpenMilestone,
}: TimelineViewProps) {
  const visible = filterEmerging(states, showEmergingEvidence);

  const elapsedH = hoursBetween(quitAt, now);
  const current = currentBandId(quitAt, now);
  const grouped = groupByTimeBand(visible);
  const currentIdx = TIME_BANDS.findIndex((b) => b.id === current);

  return (
    <div className="flex flex-col gap-4">
      <DiscoveriesCard states={visible} onOpenMilestone={onOpenMilestone} />

      <Card className="flex flex-col gap-0 !p-5">
        {grouped.map((group) => {
          const idx = TIME_BANDS.findIndex((b) => b.id === group.band.id);
          const kind: BandKind =
            idx === currentIdx ? 'current' : idx < currentIdx ? 'past' : 'future';
          return (
            <TimeBandSection
              key={group.band.id}
              group={group}
              kind={kind}
              elapsedH={elapsedH}
              onOpenMilestone={onOpenMilestone}
            />
          );
        })}
      </Card>
    </div>
  );
}

export default TimelineView;
