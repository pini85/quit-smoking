'use client';

import type { Trigger } from '@/domain/types';
import { useMessages } from '@/lib/i18n';
import { IntensityScale } from './IntensityScale';
import { TriggerChips } from './TriggerChips';

export type IntensityStepProps = {
  trigger?: Trigger;
  onTriggerChange: (trigger: Trigger | undefined) => void;
  onSelectIntensity: (intensity: number) => void;
};

/**
 * Step 1. Nothing is persisted until a number is tapped — that tap is both
 * the measurement and the "start" button, which is why there isn't one.
 *
 * The headline lands before the question on purpose: the first thing someone
 * mid-craving reads should be that opening the app was already the win.
 */
export function IntensityStep({
  trigger,
  onTriggerChange,
  onSelectIntensity,
}: IntensityStepProps) {
  const m = useMessages();
  return (
    <div className="flex min-h-[80dvh] flex-col">
      <div className="pt-8">
        <h1 className="text-[28px] font-semibold leading-tight text-ink">
          {m.craving.intensity.headline}
        </h1>
      </div>

      {/* Everything actionable sits in the lower half, within one-handed reach. */}
      <div className="mt-auto flex flex-col gap-5 pt-10">
        <p className="text-[17px] text-ink-muted">{m.craving.intensity.question}</p>
        <IntensityScale onSelect={onSelectIntensity} />
        <TriggerChips
          label={m.craving.intensity.triggerLabel}
          value={trigger}
          onChange={onTriggerChange}
        />
      </div>
    </div>
  );
}

export default IntensityStep;
