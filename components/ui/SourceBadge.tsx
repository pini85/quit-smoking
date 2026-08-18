export type SourceKind = 'carr' | 'psych' | 'med';

export type SourceBadgeProps = {
  kind: SourceKind;
  className?: string;
};

/**
 * Says what a Freedom lesson is actually standing on: a persuasive way of
 * looking at it, a behavioural-science finding, or clinical evidence. The
 * labels are deliberately plain — `carr` reads "A way of seeing it" rather
 * than borrowing the authority of research it doesn't have.
 *
 * Distinct on purpose from `EvidenceBadge`, which grades the *strength* of a
 * health claim. Same quiet weight and pill shape, different visual language
 * (sentence case, always bordered) so the two never read as one scale — a
 * shared component would collapse two different meanings into one.
 */
const KINDS: Record<SourceKind, { label: string; tone: string }> = {
  carr: { label: 'A way of seeing it', tone: 'border-border bg-surface text-ink-faint' },
  psych: { label: 'Psychology', tone: 'border-border bg-surface-raised text-ink-muted' },
  med: { label: 'Medical evidence', tone: 'border-primary bg-primary-soft text-primary-strong' },
};

export function SourceBadge({ kind, className }: SourceBadgeProps) {
  const { label, tone } = KINDS[kind];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone} ${className ?? ''}`}
    >
      {label}
    </span>
  );
}

export default SourceBadge;
