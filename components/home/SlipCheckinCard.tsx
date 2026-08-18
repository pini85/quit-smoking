'use client';

import type { CravingSession } from '@/domain/types';
import { useLocalPref } from '@/lib/hooks/useLocalPref';
import { Card } from '@/components/ui/Card';

const STORAGE_KEY = 'unsmoke.slipcheck.dismissed';
const HOUR_MS = 3_600_000;

export type SlipCheckinCardProps = {
  cravings: CravingSession[];
  now: Date;
};

const WITHIN_24H =
  'The day after a slip is when most quits are decided. One craving at a time — your button is right below.';
const WITHIN_96H =
  'Two days past a slip is the highest-risk window closing. Keep going.';

/**
 * Appears only in the days right after a logged cigarette, and says nothing
 * that sounds like a telling-off. Two windows, two sentences.
 *
 * The dismissal is keyed by the SESSION ID rather than by a date, so hiding
 * it now doesn't suppress the check-in after a future slip — a new slip is a
 * new id, and the card comes back. Same reasoning as `DiscoveryCard` for
 * using `localStorage` via `useLocalPref`: throwaway UI state, never read
 * during render.
 */
export function SlipCheckinCard({ cravings, now }: SlipCheckinCardProps) {
  const { value: dismissedId, set: setDismissedId } = useLocalPref(STORAGE_KEY);

  const nowMs = now.getTime();
  let latest: CravingSession | null = null;
  for (const session of cravings) {
    if (session.preQuit === true) continue;
    if (session.outcome !== 'smoked') continue;
    if (
      latest === null ||
      new Date(session.startedAt).getTime() > new Date(latest.startedAt).getTime()
    ) {
      latest = session;
    }
  }

  if (dismissedId === undefined || latest === null) return null;

  const ageMs = nowMs - new Date(latest.startedAt).getTime();
  if (ageMs < 0 || ageMs >= 96 * HOUR_MS) return null;
  if (dismissedId === latest.id) return null;

  const message = ageMs < 24 * HOUR_MS ? WITHIN_24H : WITHIN_96H;
  const slipId = latest.id;

  return (
    <Card className="flex items-start justify-between gap-3">
      <p className="text-[13px] leading-relaxed text-ink-muted">{message}</p>
      <button
        type="button"
        onClick={() => setDismissedId(slipId)}
        aria-label="Dismiss check-in"
        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.92]"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </Card>
  );
}

export default SlipCheckinCard;
