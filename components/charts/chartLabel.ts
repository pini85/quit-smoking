/**
 * Every chart is `role="img"`, so it MUST carry an accessible name — the
 * marks themselves say nothing to a screen reader. Callers may spell it
 * either `ariaLabel` or `aria-label`; the union makes exactly one of them
 * required, so a chart can never ship unlabelled.
 */
export type ChartA11yProps =
  | { ariaLabel: string; 'aria-label'?: string }
  | { ariaLabel?: string; 'aria-label': string };

export function chartLabel(props: {
  ariaLabel?: string;
  'aria-label'?: string;
}): string {
  return props['aria-label'] ?? props.ariaLabel ?? '';
}
