export type EvidenceLevel = 'strong' | 'moderate' | 'emerging';

export type EvidenceBadgeProps = {
  level: EvidenceLevel;
  className?: string;
};

const LEVELS: Record<EvidenceLevel, { label: string; tone: string }> = {
  strong: { label: 'Strong evidence', tone: 'bg-primary-soft text-primary-strong' },
  moderate: { label: 'Moderate evidence', tone: 'bg-surface-raised text-ink-muted border border-border' },
  emerging: { label: 'Early evidence', tone: 'bg-accent-soft text-ink-muted' },
};

export function EvidenceBadge({ level, className }: EvidenceBadgeProps) {
  const { label, tone } = LEVELS[level];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${tone} ${className ?? ''}`}
    >
      {label}
    </span>
  );
}

export default EvidenceBadge;
