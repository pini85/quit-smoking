'use client';

import { useMemo, useState } from 'react';
import type { CravingOutcome, CravingSession, Locale } from '@/domain/types';
import { dateFmt } from '@/lib/i18n/fmt';
import { interpolate, useLocale, useMessages, type Messages } from '@/lib/i18n';
import { BELIEF_META } from '@/data/beliefs';
import { triggerLabel } from '@/data/triggers';
import { INTERVENTIONS } from '@/data/interventions';
import { formatDurationDigital } from '@/domain/time';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';

export type HistoryListProps = {
  sessions: CravingSession[];
  now: Date;
};

const VISIBLE_COUNT = 10;

/** Locale-local 24-hour clock, e.g. '09:05' — matches the brief's `{HH:mm}`. */
function hhmm(iso: string, locale: Locale): string {
  return dateFmt(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso)
  );
}

/** Short date, year omitted when it's the current year. */
function shortDate(iso: string, now: Date, locale: Locale): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return dateFmt(locale, opts).format(d);
}

function fullDateTime(iso: string, locale: Locale): string {
  return dateFmt(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/**
 * Matches Task 13's WinsStrip wording for passed/much-weaker/still-there,
 * with two additions specific to this row-level history view: 'smoked' gets
 * the fuller, deliberately-neutral "Smoked — and logged honestly" (rendered
 * muted, not hidden — this app never pretends a slip didn't happen), and
 * 'unresolved' (or the theoretically-possible still-open `null`) reads as
 * plain 'Logged'.
 */
function outcomeWord(
  outcome: CravingOutcome | null,
  m: Messages['progress']['history']['outcomes']
): { text: string; muted: boolean } {
  if (outcome === 'passed') return { text: m.passed, muted: false };
  if (outcome === 'much-weaker') return { text: m.muchWeaker, muted: false };
  if (outcome === 'still-there') return { text: m.stillThere, muted: false };
  if (outcome === 'smoked') return { text: m.smoked, muted: true };
  return { text: m.logged, muted: false }; // null | 'unresolved'
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </p>
      <p className="text-[15px] leading-relaxed text-ink">{value}</p>
    </div>
  );
}

/**
 * Craving history: newest-first log of every session (including preQuit —
 * they're real cravings), 10 shown by default with a "Show all N" expander,
 * each row opening a detail sheet. Omitted entirely at 0 sessions (per the
 * brief) rather than gated with empty copy — the Today screen's WinsStrip
 * already teaches the empty case.
 */
export function HistoryList({ sessions, now }: HistoryListProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<CravingSession | null>(null);

  const sorted = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      ),
    [sessions]
  );

  if (sorted.length === 0) return null;

  const displayed = showAll ? sorted : sorted.slice(0, VISIBLE_COUNT);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">
        {m.progress.history.title}
      </h2>

      <div className="flex flex-col gap-2">
        {displayed.map((session) => {
          const trigger = session.trigger
            ? triggerLabel(session.trigger, locale)
            : m.progress.history.untagged;
          const outcome = outcomeWord(session.outcome, m.progress.history.outcomes);
          return (
            <Card key={session.id} onClick={() => setSelected(session)} className="!p-4">
              <p className="text-[13px] leading-relaxed tabular-nums text-ink">
                {hhmm(session.startedAt, locale)} · {shortDate(session.startedAt, now, locale)} · {trigger} ·{' '}
                {session.initialIntensity} → {session.finalIntensity ?? '—'} ·{' '}
                <span className={outcome.muted ? 'text-ink-faint' : undefined}>
                  {outcome.text}
                </span>
              </p>
            </Card>
          );
        })}
      </div>

      {!showAll && sorted.length > VISIBLE_COUNT ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="min-h-11 self-start text-[14px] font-medium text-primary-strong"
        >
          {interpolate(m.progress.history.showAll, { count: sorted.length })}
        </button>
      ) : null}

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={m.progress.history.sheetTitle}
      >
        {selected ? (
          <div className="flex flex-col gap-4 pb-2">
            <DetailRow label={m.progress.history.started} value={fullDateTime(selected.startedAt, locale)} />
            {selected.endedAt ? (
              <DetailRow
                label={m.progress.history.duration}
                value={formatDurationDigital(
                  new Date(selected.endedAt).getTime() - new Date(selected.startedAt).getTime()
                )}
              />
            ) : null}
            <DetailRow
              label={m.progress.history.intensity}
              value={`${selected.initialIntensity} → ${selected.finalIntensity ?? '—'}`}
            />
            <DetailRow
              label={m.progress.history.trigger}
              value={
                selected.trigger ? triggerLabel(selected.trigger, locale) : m.progress.history.untagged
              }
            />
            <DetailRow
              label={m.progress.history.interventionsUsed}
              value={
                selected.interventionIds && selected.interventionIds.length > 0
                  ? selected.interventionIds
                      .map((id) => INTERVENTIONS.find((i) => i.id === id)?.title ?? id)
                      .join(', ')
                  : m.progress.history.none
              }
            />
            {selected.beliefId ? (
              <DetailRow
                label={m.progress.history.itPromised}
                value={BELIEF_META[selected.beliefId].label}
              />
            ) : null}
            <DetailRow
              label={m.progress.history.outcome}
              value={outcomeWord(selected.outcome, m.progress.history.outcomes).text}
            />
            {selected.notes ? (
              <DetailRow label={m.progress.history.notes} value={selected.notes} />
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}

export default HistoryList;
