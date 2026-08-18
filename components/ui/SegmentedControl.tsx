import type { KeyboardEvent } from 'react';

export type SegmentedOption = {
  id: string;
  label: string;
};

export type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Accessible name for the group of segments. */
  label?: string;
};

/**
 * Radio group, not a tab list: the segments pick a value, they do not reveal
 * tabpanels — so `role="radiogroup"`/`role="radio"` is the contract that
 * actually matches the behaviour. Every segment stays individually tabbable,
 * and the arrow keys move the selection the way a radio group should.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  label,
}: SegmentedControlProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) return;

    onChange(next.id);

    // Move focus with the selection, as the radio-group pattern expects.
    const sibling = event.currentTarget.parentElement?.children[nextIndex];
    if (sibling instanceof HTMLElement) sibling.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex w-full gap-1 rounded-button border border-border bg-surface p-1 ${className ?? ''}`}
    >
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={[
              'h-11 flex-1 rounded-[12px] px-2 text-[13px] font-medium',
              'transition-colors duration-[var(--dur-press)]',
              selected
                ? 'bg-primary-soft text-primary-strong'
                : 'bg-transparent text-ink-muted',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
