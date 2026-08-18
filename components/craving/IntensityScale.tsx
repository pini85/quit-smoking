'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type IntensityScaleProps = {
  /** The currently chosen value, if any. */
  value?: number;
  /** Rendered as a ghost outline — used on re-check to show where you started. */
  previous?: number;
  onSelect: (value: number) => void;
};

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Long enough for the bloom to read as an acknowledgement, short enough to feel instant. */
const BLOOM_MS = 250;

/**
 * Two rows of five. The whole point of this control is that it is the first
 * thing a stressed person touches, one-handed, and that touching ANY cell
 * moves them forward — there is no confirm step and nothing to get wrong.
 *
 * The background ramps from calm (primary-soft at 1) to warm (accent-soft at
 * 10) via `color-mix`, so the grid itself reads as a gradient without
 * hard-coding ten colours or ever reaching for a danger/red hue: a 10 is
 * intense, not an emergency.
 */
export function IntensityScale({ value, previous, onSelect }: IntensityScaleProps) {
  const [blooming, setBlooming] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The 250ms bloom means `onSelect` fires from a LATER render than the tap,
  // and anything the user does in between (tapping a trigger chip, most
  // obviously) re-renders the parent with a fresh callback. Firing the
  // callback captured at tap time would run a closure over pre-tap state.
  // Callers are expected to be robust to this too, but a control that
  // deliberately delays its own callback should not be the thing that
  // requires it.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  function handleSelect(n: number) {
    // A second tap while the bloom is playing would fire `onSelect` twice and
    // create two sessions — the one bug this screen absolutely cannot have.
    if (blooming !== null) return;
    setBlooming(n);
    navigator.vibrate?.(10);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // Released so the scale stays re-tappable: on the re-check step someone
      // may well want to correct the number they just chose.
      setBlooming(null);
      onSelectRef.current(n);
    }, BLOOM_MS);
  }

  return (
    <div className="grid grid-cols-5 gap-2" role="group" aria-label="Craving intensity, 1 to 10">
      {VALUES.map((n) => {
        const mix = ((n - 1) / 9) * 100;
        const style: CSSProperties = {
          background: `color-mix(in oklab, var(--accent-soft) ${mix}%, var(--primary-soft))`,
          transform: blooming === n ? 'scale(1.08)' : undefined,
          // 150ms, via a token so `prefers-reduced-motion` zeroes it with
          // everything else rather than leaving one stray hard-coded easing.
          transitionDuration: 'var(--dur-bloom)',
        };
        const selected = value === n;
        const isPrevious = previous === n;

        return (
          <button
            key={n}
            type="button"
            onClick={() => handleSelect(n)}
            aria-label={`Intensity ${n}`}
            aria-pressed={selected}
            style={style}
            className={[
              'relative flex h-14 min-h-14 items-center justify-center rounded-2xl',
              'text-[20px] font-semibold tabular-nums text-ink',
              'transition-transform ease-out',
              selected ? 'ring-2 ring-primary' : '',
              isPrevious && !selected
                ? 'outline-2 outline-offset-[-2px] outline-dashed outline-ink-faint/60'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {n}
            {isPrevious ? <span className="sr-only"> (where you started)</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default IntensityScale;
