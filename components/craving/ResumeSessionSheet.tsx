'use client';

import type { CravingOutcome, CravingSession } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

export type ResumeSessionSheetProps = {
  session: CravingSession;
  now: Date;
  onResolve: (outcome: CravingOutcome) => void;
  /** Overlay tap, Escape, hardware back and the X all land here too. */
  onDismiss: () => void;
};

/**
 * "You started a craving a few minutes ago — what happened?"
 *
 * Deliberately does NOT re-ask the intensity. A number recalled after the
 * fact is a worse number than no number, so the row is closed with
 * `finalIntensity` absent; the outcome alone is the part still worth having.
 * Dismissing is a real answer too — it closes the row as 'unresolved', which
 * is excluded from both sides of the pass rate.
 */
export function ResumeSessionSheet({
  session,
  now,
  onResolve,
  onDismiss,
}: ResumeSessionSheetProps) {
  const elapsedMs = now.getTime() - new Date(session.startedAt).getTime();
  // Never "0 minutes ago" — the sheet only appears once the user has left the
  // flow, so the smallest honest number here is one.
  const minutes = Math.max(1, Math.round(elapsedMs / 60_000));

  return (
    <Sheet open onClose={onDismiss}>
      <p className="mb-5 text-[19px] leading-relaxed text-ink">
        You logged a craving {minutes} minute{minutes === 1 ? '' : 's'} ago. How did it go?
      </p>
      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth onClick={() => onResolve('passed')}>
          Gone
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => onResolve('much-weaker')}
        >
          Much weaker
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => onResolve('still-there')}
        >
          Still there
        </Button>
        <Button
          variant="ghost"
          size="lg"
          fullWidth
          onClick={() => onResolve('smoked')}
        >
          I smoked
        </Button>
        <Button variant="ghost" fullWidth onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </Sheet>
  );
}

export default ResumeSessionSheet;
