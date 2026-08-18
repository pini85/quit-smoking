'use client';

import { useState } from 'react';
import type { RecorderAvailability } from '@/lib/recorder/types';
import type { SleepSessionService } from '@/lib/services/sleepSessionService';
import { useNow } from '@/lib/hooks/useNow';
import { formatDurationDigital } from '@/domain/time';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { dateFmt } from '@/lib/i18n/fmt';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

export type ActiveMonitoringCardProps = {
  service: SleepSessionService;
  startedAtMs: number;
  availability: RecorderAvailability;
  onStopped: () => void;
};

/**
 * Live "monitoring in progress" card: started time, a ticking elapsed
 * clock, the lock-phone reassurance (or the dev-recorder tab-open note on
 * the web-dev adapter), and Stop — disabled while stopping and safe against
 * a double tap (the service's own `stopMonitoring` is idempotent).
 */
export function ActiveMonitoringCard({
  service,
  startedAtMs,
  availability,
  onStopped,
}: ActiveMonitoringCardProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const now = useNow(1000);
  const [stopping, setStopping] = useState(false);

  const startedTime = dateFmt(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(startedAtMs)
  );
  const elapsed = formatDurationDigital(now.getTime() - startedAtMs);

  async function handleStop() {
    if (stopping) return;
    setStopping(true);
    try {
      await service.stopMonitoring(new Date());
      onStopped();
    } catch (err) {
      console.error('Unsmoke: failed to stop snore monitoring', err);
      showToast(m.common.saveFailed);
    } finally {
      setStopping(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">
          {interpolate(m.sleep.active.startedAt, { time: startedTime })}
        </h2>
        <p className="mt-2 text-[32px] font-semibold tabular-nums text-ink">{elapsed}</p>
        <p className="text-[12px] uppercase tracking-[0.08em] text-ink-faint">{m.sleep.active.elapsed}</p>
      </div>

      <p className="text-[13px] leading-relaxed text-ink-muted">
        {availability === 'web-dev' ? m.sleep.webDevNote : m.sleep.active.lockPhoneNote}
      </p>

      <Button variant="secondary" fullWidth onClick={() => void handleStop()} disabled={stopping}>
        {stopping ? m.sleep.active.stopping : m.sleep.active.stop}
      </Button>
    </Card>
  );
}

export default ActiveMonitoringCard;
