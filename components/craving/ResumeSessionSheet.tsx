'use client';

import type { CravingOutcome, CravingSession } from '@/domain/types';
import { formatCount } from '@/domain/i18n/units';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

export type ResumeSessionSheetProps = {
  session: CravingSession;
  now: Date;
  onResolve: (outcome: CravingOutcome) => void;
  /** Overlay tap, Escape, hardware back and the X all land here too. */
  onDismiss: () => void;
  /** Straight to `/craving`, writing nothing to the old session. */
  onNewCraving: () => void;
  /** True while an answer is being written. */
  busy?: boolean;
};

/**
 * "You started a craving a few minutes ago — what happened?"
 *
 * Deliberately does NOT re-ask the intensity. A number recalled after the
 * fact is a worse number than no number, so the row is closed with
 * `finalIntensity` absent; the outcome alone is the part still worth having.
 * Dismissing is a real answer too — it closes the row as 'unresolved', which
 * is excluded from both sides of the pass rate.
 *
 * The last action exists because this sheet covers the craving FAB. Someone
 * who opened the app mid-craving must not have to answer a question about
 * the PAST one first — that would make the worst case three taps to help
 * instead of two. It navigates straight into the flow and writes nothing:
 * the old row stays open and the 15-minute finalizer ages it out honestly.
 */
export function ResumeSessionSheet({
  session,
  now,
  onResolve,
  onDismiss,
  onNewCraving,
  busy = false,
}: ResumeSessionSheetProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const elapsedMs = now.getTime() - new Date(session.startedAt).getTime();
  // Never "0 minutes ago" — the sheet only appears once the user has left the
  // flow, so the smallest honest number here is one.
  const minutes = Math.max(1, Math.round(elapsedMs / 60_000));

  return (
    <Sheet open onClose={onDismiss}>
      <p className="mb-5 text-[19px] leading-relaxed text-ink">
        {interpolate(m.craving.resume.question, {
          minutes: formatCount(minutes, 'minute', locale),
        })}
      </p>
      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth disabled={busy} onClick={() => onResolve('passed')}>
          {m.craving.resume.gone}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          disabled={busy}
          onClick={() => onResolve('much-weaker')}
        >
          {m.craving.resume.muchWeaker}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          disabled={busy}
          onClick={() => onResolve('still-there')}
        >
          {m.craving.resume.stillThere}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          fullWidth
          disabled={busy}
          onClick={() => onResolve('smoked')}
        >
          {m.craving.resume.smoked}
        </Button>

        {/* Never disabled: help must stay reachable even mid-write. */}
        <Button variant="secondary" size="lg" fullWidth onClick={onNewCraving}>
          {m.craving.resume.newCraving}
        </Button>

        <Button variant="ghost" fullWidth disabled={busy} onClick={onDismiss}>
          {m.craving.resume.dismiss}
        </Button>
      </div>
    </Sheet>
  );
}

export default ResumeSessionSheet;
