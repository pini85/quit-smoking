'use client';

import { Chip } from '@/components/ui/Chip';
import { useMessages, type Messages } from '@/lib/i18n';

/**
 * The five word anchors for the optional conviction question. Words, never
 * numbers: the reader is asked how a sentence sounds to them right now, and a
 * 0–4 scale would invite them to read it as a score of themselves. The
 * `strength` each one maps to is stored, never shown — here or anywhere.
 */
const ANCHOR_KEYS: {
  strength: 0 | 1 | 2 | 3 | 4;
  labelKey: keyof Messages['freedom']['conviction']['anchors'];
}[] = [
  { strength: 4, labelKey: 'stillTrue' },
  { strength: 3, labelKey: 'mostlyTrue' },
  { strength: 2, labelKey: 'startingToCrack' },
  { strength: 1, labelKey: 'mostlySeenThrough' },
  { strength: 0, labelKey: 'seenThrough' },
];

export type ConvictionRowProps = {
  onSelect: (strength: 0 | 1 | 2 | 3 | 4) => void;
  disabled?: boolean;
  /** What a tap does, in the host screen's own terms. */
  hint?: string;
};

/**
 * The optional "how convincing does it feel right now?" row, shared by the
 * two places a belief gets re-measured: the exercise sheet and the /brain
 * flow. Extracted so the anchors, the "— optional" label and the placement
 * rule can only ever have one wording.
 *
 * Placement is part of the contract: this row sits BELOW the host's Done
 * action and never gates it (the `TriggerChips` doctrine). The reading is
 * complete without an answer, and skipping it is just leaving.
 */
export function ConvictionRow({ onSelect, disabled = false, hint }: ConvictionRowProps) {
  const m = useMessages();
  return (
    <div className="border-t border-border pt-4">
      <p className="mb-2 text-[13px] text-ink-muted">{m.freedom.conviction.question}</p>
      <div className="flex flex-wrap gap-2">
        {ANCHOR_KEYS.map((anchor) => (
          <Chip
            key={anchor.strength}
            size="sm"
            disabled={disabled}
            onClick={() => onSelect(anchor.strength)}
          >
            {m.freedom.conviction.anchors[anchor.labelKey]}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
        {hint ?? m.freedom.exercise.convictionHint}
      </p>
    </div>
  );
}

export default ConvictionRow;
