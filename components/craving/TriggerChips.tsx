'use client';

import type { Trigger } from '@/domain/types';
import { TRIGGER_META, TRIGGER_ORDER, triggerLabel } from '@/data/triggers';
import { useLocale } from '@/lib/i18n';
import { Chip } from '@/components/ui/Chip';

export type TriggerChipsProps = {
  label: string;
  value?: Trigger;
  /** `undefined` means "deselected" — tapping the selected chip clears it. */
  onChange: (trigger: Trigger | undefined) => void;
};

/**
 * One horizontally-scrollable row of triggers. Deliberately optional
 * everywhere it appears: it must never sit between someone and help, so it is
 * always rendered BELOW the action it accompanies and never gates it.
 *
 * Default (`md`) chips, not the dense `sm` pill: these are tapped one-handed
 * mid-craving, so they have to clear the 44px touch target.
 */
export function TriggerChips({ label, value, onChange }: TriggerChipsProps) {
  const { locale } = useLocale();
  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-muted">{label}</p>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TRIGGER_ORDER.map((trigger) => {
          const meta = TRIGGER_META[trigger];
          const selected = value === trigger;
          return (
            <Chip
              key={trigger}
              selected={selected}
              onClick={() => onChange(selected ? undefined : trigger)}
              className="shrink-0 gap-1.5 whitespace-nowrap"
            >
              <span aria-hidden="true">{meta.emoji}</span>
              <span>{triggerLabel(trigger, locale)}</span>
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

export default TriggerChips;
