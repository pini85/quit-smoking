'use client';

import { useMessages } from '@/lib/i18n';

export type EvidenceLevel = 'strong' | 'moderate' | 'emerging';

export type EvidenceBadgeProps = {
  level: EvidenceLevel;
  className?: string;
};

const TONES: Record<EvidenceLevel, string> = {
  strong: 'bg-primary-soft text-primary-strong',
  moderate: 'bg-surface-raised text-ink-muted border border-border',
  emerging: 'bg-accent-soft text-ink-muted',
};

export function EvidenceBadge({ level, className }: EvidenceBadgeProps) {
  const m = useMessages();

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${TONES[level]} ${className ?? ''}`}
    >
      {m.chrome.evidence[level]}
    </span>
  );
}

export default EvidenceBadge;
