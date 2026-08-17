import type { ReactNode } from 'react';

export type StatTileProps = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Only pass from a client component; makes the tile a real button. */
  onPress?: () => void;
  className?: string;
};

function Body({ label, value, sub }: Pick<StatTileProps, 'label' | 'value' | 'sub'>) {
  return (
    <>
      <span className="text-[20px] font-semibold leading-tight tabular-nums text-ink">
        {value}
      </span>
      <span className="mt-1 text-[13px] leading-tight text-ink-muted">{label}</span>
      {sub ? (
        <span className="mt-0.5 text-[11px] leading-tight text-ink-faint">{sub}</span>
      ) : null}
    </>
  );
}

export function StatTile({ label, value, sub, onPress, className }: StatTileProps) {
  const shell = `flex min-h-11 flex-col items-start text-left ${className ?? ''}`;

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={`${shell} transition-transform duration-[var(--dur-press)] active:scale-[0.97]`}
      >
        <Body label={label} value={value} sub={sub} />
      </button>
    );
  }

  return (
    <div className={shell}>
      <Body label={label} value={value} sub={sub} />
    </div>
  );
}

export default StatTile;
