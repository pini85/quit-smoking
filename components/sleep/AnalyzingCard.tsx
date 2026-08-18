'use client';

import { useState } from 'react';
import type { SleepSession } from '@/domain/types';
import type { SleepSessionService } from '@/lib/services/sleepSessionService';
import { useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

export type AnalyzingCardProps = {
  service: SleepSessionService;
  session: SleepSession;
};

/**
 * Quiet "still working on it" note for a night that finished recording but
 * hasn't finished analysis (house style has no spinners). Also offers a
 * manual retry: `analyzeSession` is safe to call again even while a
 * recovery pass is independently retrying the same row, so this never needs
 * to tell "genuinely in progress" apart from "stuck, needs a retry".
 */
export function AnalyzingCard({ service, session }: AnalyzingCardProps) {
  const m = useMessages();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await service.analyzeSession(session);
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
      <Button variant="secondary" fullWidth onClick={() => void handleRetry()} disabled={retrying}>
        {retrying ? m.sleep.analyzing.retrying : m.sleep.analyzing.retry}
      </Button>
    </Card>
  );
}

export default AnalyzingCard;
