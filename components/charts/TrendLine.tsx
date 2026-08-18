import { chartLabel, type ChartA11yProps } from './chartLabel';

export type TrendPoint = {
  x: string;
  y: number;
};

export type TrendLineProps = {
  series: TrendPoint[];
  /** viewBox height; the svg renders at 100% width, keeping this ratio. */
  height?: number;
  className?: string;
} & ChartA11yProps;

const VIEW_W = 360;
const PAD_X = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 18;

export function TrendLine(props: TrendLineProps) {
  const { series, height = 140, className } = props;
  const label = chartLabel(props);

  const count = series.length;
  const values = series.map((point) => point.y);
  const rawMin = count > 0 ? Math.min(...values) : 0;
  const rawMax = count > 0 ? Math.max(...values) : 0;

  // Auto y-axis with a little breathing room, so the line never touches the
  // edges and a flat series still sits mid-height.
  const rawSpan = rawMax - rawMin;
  const padding = rawSpan === 0 ? Math.max(1, Math.abs(rawMax) * 0.1 || 1) : rawSpan * 0.12;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const plotTop = PAD_TOP;
  const plotBottom = height - PAD_BOTTOM;

  const xAt = (index: number) =>
    count <= 1 ? VIEW_W / 2 : PAD_X + (index * (VIEW_W - PAD_X * 2)) / (count - 1);
  const yAt = (value: number) =>
    plotBottom - ((value - min) / span) * (plotBottom - plotTop);

  const linePath = series
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index)},${yAt(point.y)}`)
    .join(' ');
  const areaPath =
    count > 1
      ? `${linePath} L${xAt(count - 1)},${plotBottom} L${xAt(0)},${plotBottom} Z`
      : '';

  const firstLabel = series[0]?.x;
  const lastLabel = count > 1 ? series[count - 1]?.x : undefined;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      role="img"
      aria-label={label}
      className={`h-auto w-full ${className ?? ''}`}
    >
      <title>{label}</title>

      <line
        x1={PAD_X}
        y1={plotBottom}
        x2={VIEW_W - PAD_X}
        y2={plotBottom}
        strokeWidth={1}
        className="stroke-border"
      />

      {count > 1 ? (
        <>
          <path d={areaPath} className="fill-primary/12" />
          <path
            d={linePath}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-primary"
          />
        </>
      ) : null}

      {count === 1 ? (
        <circle cx={xAt(0)} cy={yAt(values[0])} r={3} className="fill-primary" />
      ) : null}

      {firstLabel ? (
        <text
          x={PAD_X}
          y={height - 4}
          fontSize={9}
          textAnchor="start"
          className="fill-ink-faint"
        >
          {firstLabel}
        </text>
      ) : null}
      {lastLabel ? (
        <text
          x={VIEW_W - PAD_X}
          y={height - 4}
          fontSize={9}
          textAnchor="end"
          className="fill-ink-faint"
        >
          {lastLabel}
        </text>
      ) : null}
    </svg>
  );
}

export default TrendLine;
