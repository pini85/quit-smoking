import { chartLabel, type ChartA11yProps } from './chartLabel';

export type BarListItem = {
  label: string;
  value: number;
  sub?: string;
};

export type BarListProps = {
  items: BarListItem[];
  /** Bar scale ceiling. Defaults to the largest value in `items`. */
  max?: number;
  className?: string;
} & ChartA11yProps;

/**
 * Horizontal bars with real text labels. Unlike the svg charts this is laid
 * out in HTML so the labels stay crisp and never scale with the viewBox; the
 * whole block is `role="img"` with a single accessible name, matching the
 * other charts.
 */
export function BarList(props: BarListProps) {
  const { items, max, className } = props;
  const label = chartLabel(props);

  const ceiling =
    max !== undefined && max > 0
      ? max
      : items.reduce((acc, item) => Math.max(acc, item.value), 0) || 1;

  return (
    <div role="img" aria-label={label} className={`flex flex-col gap-3 ${className ?? ''}`}>
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, (item.value / ceiling) * 100));
        return (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-ink">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {item.value}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-soft">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            {item.sub ? (
              <span className="text-[11px] leading-tight text-ink-faint">{item.sub}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default BarList;
