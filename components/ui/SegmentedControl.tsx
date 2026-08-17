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

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  label,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex w-full gap-1 rounded-button border border-border bg-surface p-1 ${className ?? ''}`}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
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
