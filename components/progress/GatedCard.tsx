'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export type GatedCardProps = {
  title: string;
  /** When `false`, `children` is never rendered — only `emptyCopy` is. */
  gateMet: boolean;
  /**
   * Shown verbatim (per the brief, this exact copy is binding) whenever
   * `gateMet` is false, in place of `children`.
   */
  emptyCopy: string;
  children: ReactNode;
};

/**
 * Shared gate pattern for every stats card on the Progress screen.
 *
 * Binding ruling (deviates from an earlier plan that called for hiding
 * below-gate cards entirely): a card ALWAYS renders — title plus either its
 * real content or the exact empty copy — never nothing. Consistency beats
 * cleverness here: a feed whose shape changes unpredictably based on how
 * much data exists would be harder to reason about than one that always
 * shows all 5 gated cards, some of them still inviting more logging.
 */
export function GatedCard({ title, gateMet, emptyCopy, children }: GatedCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
      {gateMet ? children : <EmptyState>{emptyCopy}</EmptyState>}
    </Card>
  );
}

export default GatedCard;
