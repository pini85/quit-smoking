'use client';

import { Chip } from '@/components/ui/Chip';

/**
 * The five word anchors for the optional conviction question. Words, never
 * numbers: the reader is asked how a sentence sounds to them right now, and a
 * 0–4 scale would invite them to read it as a score of themselves. The
 * `strength` each one maps to is stored, never shown — here or anywhere.
 */
export const CONVICTION_ANCHORS: { strength: 0 | 1 | 2 | 3 | 4; label: string }[] = [
  { strength: 4, label: 'Still feels true' },
  { strength: 3, label: 'Mostly true' },
  { strength: 2, label: 'Starting to crack' },
  { strength: 1, label: 'Mostly seen through' },
  { strength: 0, label: 'Seen through' },
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
export function ConvictionRow({
  onSelect,
  disabled = false,
  hint = 'Whichever you tap closes this.',
}: ConvictionRowProps) {
  return (
    <div className="border-t border-border pt-4">
      <p className="mb-2 text-[13px] text-ink-muted">
        How convincing does it feel right now? &mdash; optional
      </p>
      <div className="flex flex-wrap gap-2">
        {CONVICTION_ANCHORS.map((anchor) => (
          <Chip
            key={anchor.strength}
            size="sm"
            disabled={disabled}
            onClick={() => onSelect(anchor.strength)}
          >
            {anchor.label}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{hint}</p>
    </div>
  );
}

export default ConvictionRow;
