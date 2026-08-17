import { chartLabel, type ChartA11yProps } from './chartLabel';

export type SparklineProps = {
  data: number[];
  /** `width`/`height` set the viewBox, i.e. the aspect ratio; the svg itself
   *  renders at 100% of its container. */
  width?: number;
  height?: number;
  /** Index of the point to mark with an amber dot. */
  highlightIndex?: number;
  className?: string;
} & ChartA11yProps;

export function Sparkline(props: SparklineProps) {
  const { data, width = 240, height = 56, highlightIndex, className } = props;
  const label = chartLabel(props);

  const pad = 5;
  const count = data.length;

  const min = count > 0 ? Math.min(...data) : 0;
  const max = count > 0 ? Math.max(...data) : 0;
  const span = max - min || 1;

  const xAt = (index: number) =>
    count <= 1 ? width / 2 : pad + (index * (width - pad * 2)) / (count - 1);
  const yAt = (value: number) =>
    height - pad - ((value - min) / span) * (height - pad * 2);

  const points = data.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' ');

  const highlighted =
    highlightIndex !== undefined &&
    highlightIndex >= 0 &&
    highlightIndex < count &&
    data[highlightIndex] !== undefined
      ? { x: xAt(highlightIndex), y: yAt(data[highlightIndex]) }
      : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={`h-auto w-full ${className ?? ''}`}
    >
      <title>{label}</title>
      {count > 1 ? (
        <polyline
          points={points}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
        />
      ) : null}
      {count === 1 ? (
        <circle cx={xAt(0)} cy={yAt(data[0])} r={2.5} className="fill-primary" />
      ) : null}
      {highlighted ? (
        <circle cx={highlighted.x} cy={highlighted.y} r={3.5} className="fill-accent" />
      ) : null}
    </svg>
  );
}

export default Sparkline;
