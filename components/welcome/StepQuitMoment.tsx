'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useMessages } from '@/lib/i18n';

export type QuitMode = 'now' | 'already' | 'soon';

export type StepQuitMomentProps = {
  mode: QuitMode;
  /**
   * Rendered quietly under the option cards — the wizard passes
   * `<RestoreBackup>` here. Kept as a slot so this step stays
   * presentational and never touches the store itself.
   */
  footer?: ReactNode;
  alreadyQuitAt: string;
  soonQuitAt: string;
  soonMin: Date;
  soonMax: Date;
  onModeChange: (mode: QuitMode) => void;
  onAlreadyChange: (value: string) => void;
  onSoonChange: (value: string) => void;
  onContinue: (quitAt: Date) => void;
};

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function OptionRow({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex min-h-11 w-full items-center gap-3 text-left"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-primary' : 'border-border'
        }`}
      >
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </span>
      <span className="text-base font-medium text-ink">{label}</span>
    </button>
  );
}

/**
 * Step 1 of onboarding. Note: `Card` only becomes a `<button>` when given an
 * `onClick`, and options 2/3 reveal a nested `<input type="datetime-local">`
 * — a real `<input>` can never be a descendant of a `<button>` (invalid
 * HTML), so these cards are plain containers and `OptionRow` supplies its
 * own button for the tap target instead.
 */
export function StepQuitMoment({
  mode,
  footer,
  alreadyQuitAt,
  soonQuitAt,
  soonMin,
  soonMax,
  onModeChange,
  onAlreadyChange,
  onSoonChange,
  onContinue,
}: StepQuitMomentProps) {
  const m = useMessages();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (mode === 'now') {
      setError(null);
      onContinue(new Date());
      return;
    }

    if (mode === 'already') {
      if (!alreadyQuitAt) {
        setError(m.welcome.quitMoment.errors.pickDateTime);
        return;
      }
      const parsed = new Date(alreadyQuitAt);
      if (Number.isNaN(parsed.getTime())) {
        setError(m.welcome.quitMoment.errors.dateWrong);
        return;
      }
      if (parsed.getTime() > Date.now()) {
        setError(m.welcome.quitMoment.errors.inFuture);
        return;
      }
      setError(null);
      onContinue(parsed);
      return;
    }

    // mode === 'soon'
    if (!soonQuitAt) {
      setError(m.welcome.quitMoment.errors.pickDateTime);
      return;
    }
    const parsed = new Date(soonQuitAt);
    if (Number.isNaN(parsed.getTime())) {
      setError(m.welcome.quitMoment.errors.dateWrong);
      return;
    }
    if (parsed.getTime() < soonMin.getTime()) {
      setError(m.welcome.quitMoment.errors.fromNowOn);
      return;
    }
    if (parsed.getTime() > soonMax.getTime()) {
      setError(m.welcome.quitMoment.errors.within30Days);
      return;
    }
    setError(null);
    onContinue(parsed);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {m.welcome.quitMoment.headline}
      </h1>

      <div role="radiogroup" aria-label={m.welcome.quitMoment.radiogroupLabel} className="flex flex-col gap-3">
        <Card className={mode === 'now' ? '!border-primary' : ''}>
          <OptionRow
            selected={mode === 'now'}
            label={m.welcome.quitMoment.now}
            onSelect={() => onModeChange('now')}
          />
        </Card>

        <Card className={mode === 'already' ? '!border-primary' : ''}>
          <OptionRow
            selected={mode === 'already'}
            label={m.welcome.quitMoment.already}
            onSelect={() => onModeChange('already')}
          />
          {mode === 'already' ? (
            <div className="mt-4">
              <input
                type="datetime-local"
                value={alreadyQuitAt}
                max={toDatetimeLocalValue(new Date())}
                onChange={(event) => onAlreadyChange(event.target.value)}
                aria-label={m.welcome.quitMoment.lastSmokedLabel}
                className="h-12 w-full rounded-button border border-border bg-surface px-3 text-base text-ink"
              />
              <p className="mt-1.5 text-xs text-ink-faint">{m.welcome.quitMoment.roughlyFine}</p>
            </div>
          ) : null}
        </Card>

        <Card className={mode === 'soon' ? '!border-primary' : ''}>
          <OptionRow
            selected={mode === 'soon'}
            label={m.welcome.quitMoment.soon}
            onSelect={() => onModeChange('soon')}
          />
          {mode === 'soon' ? (
            <div className="mt-4">
              <input
                type="datetime-local"
                value={soonQuitAt}
                min={toDatetimeLocalValue(soonMin)}
                max={toDatetimeLocalValue(soonMax)}
                onChange={(event) => onSoonChange(event.target.value)}
                aria-label={m.welcome.quitMoment.planLabel}
                className="h-12 w-full rounded-button border border-border bg-surface px-3 text-base text-ink"
              />
            </div>
          ) : null}
        </Card>
      </div>

      {footer ? <div className="flex flex-col">{footer}</div> : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-auto pb-6">
        <Button fullWidth size="lg" onClick={handleContinue}>
          {m.welcome.quitMoment.continue}
        </Button>
      </div>
    </div>
  );
}

export default StepQuitMoment;
