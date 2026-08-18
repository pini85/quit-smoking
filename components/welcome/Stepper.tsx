'use client';

import { useState, type ChangeEvent } from 'react';
import { interpolate, useMessages } from '@/lib/i18n';

export type StepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Decimal places to round to and display (0 = whole numbers). */
  decimals?: number;
};

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function format(n: number, decimals: number): string {
  return decimals > 0 ? n.toFixed(decimals) : String(n);
}

/**
 * − / value / + stepper that also accepts direct numeric typing. The
 * displayed text is local state so a user can freely clear/retype the
 * field; only on blur (or ±button press) does a value get parsed, clamped
 * to [min, max], rounded to `decimals`, and committed via `onChange`.
 */
export function Stepper({ label, value, onChange, min, max, step = 1, decimals = 0 }: StepperProps) {
  const m = useMessages();
  const [text, setText] = useState(() => format(value, decimals));
  // Tracks the last `value` the field was synced to, so a prop change
  // (±buttons, or a parent reset) can be reflected in `text` by adjusting
  // state during render — the React-endorsed alternative to a
  // `useEffect(() => setText(...), [value])` that just mirrors a prop,
  // which only adds an extra render pass for the same result.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(format(value, decimals));
  }

  const clamp = (n: number) => round(Math.min(max, Math.max(min, n)), decimals);

  const dec = () => onChange(clamp(value - step));
  const inc = () => onChange(clamp(value + step));

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
  };

  const commit = () => {
    const parsed = Number(text);
    if (text.trim() === '' || Number.isNaN(parsed)) {
      setText(format(value, decimals));
      return;
    }
    onChange(clamp(parsed));
  };

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label={interpolate(m.common.stepper.decrease, { label })}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-button border border-border bg-surface text-lg font-medium text-ink transition-transform duration-[var(--dur-press)] active:scale-[0.95] disabled:pointer-events-none disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={text}
          onChange={onInputChange}
          onBlur={commit}
          aria-label={label}
          className="h-12 w-full min-w-0 rounded-button border border-border bg-surface text-center text-base tabular-nums text-ink"
        />
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          aria-label={interpolate(m.common.stepper.increase, { label })}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-button border border-border bg-surface text-lg font-medium text-ink transition-transform duration-[var(--dur-press)] active:scale-[0.95] disabled:pointer-events-none disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default Stepper;
