/**
 * Small numeric helpers shared across `domain/snore/**` — kept here instead
 * of duplicated in `detect.ts`/`metrics.ts`/`burden.ts`. Pure, no domain
 * knowledge; safe to import from anywhere else in `domain/snore/`.
 */

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Population standard deviation (divides by n, not n-1) — matches "stddev/mean" as used for coefficient of variation here. */
export function populationStdDev(values: number[], knownMean?: number): number {
  if (values.length === 0) return 0;
  const m = knownMean ?? mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** 0 for an empty array — callers document what that means in their own context. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
