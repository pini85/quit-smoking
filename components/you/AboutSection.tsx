'use client';

import { useMemo, useState } from 'react';
import { HEALTH_MILESTONES } from '@/data/healthMilestones';
import { Card } from '@/components/ui/Card';

const VERSION = '1.0.0';

function dedupedSources(): { label: string; url: string }[] {
  const byUrl = new Map<string, { label: string; url: string }>();
  for (const milestone of HEALTH_MILESTONES) {
    for (const source of milestone.sources) {
      if (!byUrl.has(source.url)) byUrl.set(source.url, source);
    }
  }
  return Array.from(byUrl.values());
}

export function AboutSection() {
  const [expanded, setExpanded] = useState(false);
  const sources = useMemo(() => dedupedSources(), []);

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Unsmoke</h2>
        <p className="text-[12px] text-ink-faint">Version {VERSION}</p>
      </div>

      <p className="text-[13px] leading-relaxed text-ink-muted">
        Everything stays on this device. No account, no analytics, no tracking.
      </p>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Educational information from cited public-health sources — not medical advice.
      </p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[13px] font-medium text-ink">Sources ({sources.length})</span>
        <span aria-hidden="true" className="text-ink-faint">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          {sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center text-[13px] text-primary-strong underline underline-offset-4"
            >
              {source.label}
              <span className="ml-2 text-[11px] text-ink-faint no-underline">opens online ↗</span>
            </a>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export default AboutSection;
