'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

export type StepReasonsProps = {
  suggestions: string[];
  selectedSuggestions: string[];
  customReasons: string[];
  onToggleSuggestion: (label: string) => void;
  onAddCustomReason: (text: string) => void;
  onRemoveCustomReason: (text: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onStart: () => void;
};

export function StepReasons({
  suggestions,
  selectedSuggestions,
  customReasons,
  onToggleSuggestion,
  onAddCustomReason,
  onRemoveCustomReason,
  onBack,
  onSkip,
  onStart,
}: StepReasonsProps) {
  const [draft, setDraft] = useState('');

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddCustomReason(trimmed);
    setDraft('');
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="-ml-2 px-2">
          Back
        </Button>
        <Button variant="ghost" onClick={onSkip} className="-mr-2 px-2">
          Skip
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Why are you doing this?
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          You&apos;ll see these words again when it matters.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((label) => (
          <Chip
            key={label}
            selected={selectedSuggestions.includes(label)}
            onClick={() => onToggleSuggestion(label)}
          >
            {label}
          </Chip>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add your own"
          aria-label="Add your own reason"
          className="h-12 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-base text-ink"
        />
        <Button type="submit" variant="secondary" disabled={!draft.trim()}>
          Add
        </Button>
      </form>

      {customReasons.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {customReasons.map((text) => (
            <Chip key={text} selected onClick={() => onRemoveCustomReason(text)}>
              {text} ×
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pb-6">
        <Button fullWidth size="lg" onClick={onStart}>
          Start
        </Button>
      </div>
    </div>
  );
}

export default StepReasons;
