import { chartLabel, type ChartA11yProps } from './chartLabel';

export type HourHeatStripProps = {
  /** 24 values, one per hour of the day starting at 00:00. */
  counts: number[];
  /** Inclusive hour range to outline in amber. Wraps across midnight when
   *  `start > end` (e.g. 22 → 2). */
  highlightRange?: { start: number; end: number };
  className?: string;
} & ChartA11yProps;

const HOURS = 24;
const CELL_W = 13;
const GAP = 2;
const CELL_H = 28;
const TOP = 4;
const VIEW_W = HOURS * (CELL_W + GAP) - GAP;
const VIEW_H = 50;
const LABEL_HOURS = [0, 6, 12, 18];

function inHighlight(hour: number, range?: { start: number; end: number }): boolean {
  if (!range) return false;
  const { start, end } = range;
  if (start <= end) return hour >= start && hour <= end;
  // Wraps past midnight.
  return hour >= start || hour <= end;
}

export function HourHeatStrip(props: HourHeatStripProps) {
  const { counts, highlightRange, className } = props;
  const label = chartLabel(props);

  const max = counts.reduce((acc, value) => Math.max(acc, value), 0);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label}
      className={`h-auto w-full ${className ?? ''}`}
    >
      <title>{label}</title>
      {Array.from({ length: HOURS }, (_, hour) => {
        const value = counts[hour] ?? 0;
        // Empty hours keep a faint wash so the strip still reads as a day.
        const intensity = max > 0 ? 0.1 + (value / max) * 0.9 : 0.1;
        const highlighted = inHighlight(hour, highlightRange);
        const x = hour * (CELL_W + GAP);

        return (
          <g key={hour}>
            <rect
              x={x}
              y={TOP}
              width={CELL_W}
              height={CELL_H}
              rx={4}
              opacity={intensity}
              className="fill-primary"
            />
            {highlighted ? (
              <rect
                x={x + 0.75}
                y={TOP + 0.75}
                width={CELL_W - 1.5}
                height={CELL_H - 1.5}
                rx={3.5}
                fill="none"
                strokeWidth={1.5}
                className="stroke-accent"
              />
            ) : null}
          </g>
        );
      })}

      {LABEL_HOURS.map((hour) => (
        <text
          key={hour}
          x={hour * (CELL_W + GAP) + CELL_W / 2}
          y={VIEW_H - 4}
          textAnchor="middle"
          fontSize={9}
          className="fill-ink-faint"
        >
          {hour}
        </text>
      ))}
    </svg>
  );
}

export default HourHeatStrip;
