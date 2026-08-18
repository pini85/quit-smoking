'use client';

import { useState } from 'react';
import type { SleepSession } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import type { SleepSessionService } from '@/lib/services/sleepSessionService';
import { useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

export type AnalyzingCardProps = {
  service: SleepSessionService;
  store: DataStore;
  session: SleepSession;
};

/**
 * Quiet "still working on it" note for a night that's stopped recording but
 * hasn't finished analysis (house style has no spinners).
 *
 * Retry is offered ONLY for a `'recorded'` row: a `'recording'` row here is
 * a crash-orphaned session that `SleepRecovery`'s `recoverOnLaunch` hasn't
 * claimed yet — it has no `endedAt`, so `analyzeSession`'s duration
 * fallback would compute 0 and could persist a fabricated zero-percent
 * night before deleting the only audio that could ever be analyzed
 * correctly. Recovery is what legitimately claims and finalizes it.
 *
 * The retry itself re-reads the row by id from the CURRENT store snapshot
 * right before calling `analyzeSession`, rather than trusting the `session`
 * prop (captured whenever this component last rendered): a concurrent
 * `recoverOnLaunch`/resume-sync retry could have already finalized or
 * re-claimed the same row between this card's last render and the tap, and
 * retrying a row that is no longer `'recorded'` would repeat exactly the
 * fabricated-zero risk above.
 */
export function AnalyzingCard({ service, store, session }: AnalyzingCardProps) {
  const m = useMessages();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      const current = store.getSnapshot().sleepSessions.find((s) => s.id === session.id);
      if (current?.state !== 'recorded') return;
      await service.analyzeSession(current);
    } catch (err) {
      console.error('Unsmoke: failed to analyze last night’s recording', err);
      showToast(m.common.saveFailed);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.sleep.analyzing.title}</h2>
      <p className="text-[14px] leading-relaxed text-ink-muted">{m.sleep.analyzing.note}</p>
      {session.state === 'recorded' ? (
        <Button variant="secondary" fullWidth onClick={() => void handleRetry()} disabled={retrying}>
          {retrying ? m.sleep.analyzing.retrying : m.sleep.analyzing.retry}
        </Button>
      ) : null}
    </Card>
  );
}

export default AnalyzingCard;
