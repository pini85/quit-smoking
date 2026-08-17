import { describe, expect, it } from 'vitest';
import { HEALTH_MILESTONES } from '@/data/healthMilestones';
import { INTERVENTIONS, TRUTH_CARDS } from '@/data/interventions';
import { MILESTONE_CATEGORIES } from '@/domain/types';

// Hardcoded from the 80-entry research appendix
// (.superpowers/sdd/please-do-this-app-replicated-wilkes/appendix-a-dataset.md).
const APPENDIX_IDS = [
  'heart-rate-normalises',
  'blood-pressure-drops',
  'carbon-monoxide-halves',
  'carbon-monoxide-normal',
  'blood-oxygen-restored',
  'resting-heart-rate-persistent-drop',
  'nicotine-cleared',
  'heart-attack-risk-starts-falling',
  'nocturnal-erections-24h',
  'withdrawal-onset',
  'taste-and-smell-begin-returning',
  'withdrawal-peak-day-3',
  'bronchial-tubes-relax',
  'caffeine-hits-harder',
  'cotinine-clears',
  'taste-buds-regenerate',
  'cough-may-worsen-first',
  'platelets-endothelium-early',
  'circulation-improves',
  'lung-function-increases',
  'vo2max-improves',
  'withdrawal-resolves',
  'nicotine-receptors-normalise',
  'mao-recovery',
  'taste-recovery-by-region',
  'smell-improves-45-days',
  'wound-healing-surgery',
  'postop-complications-overall',
  'skin-collagen-recovery',
  'mucociliary-clearance-recovers',
  'sleep-disrupted-then-better',
  'snoring-airway-inflammation',
  'crp-inflammation-falls',
  'white-cell-count-normalises',
  'anxiety-depression-improve',
  'withdrawal-anxiety-cycle',
  'concentration-recovers',
  'erectile-function-improves',
  'breath-and-teeth',
  'secondhand-smoke-home',
  'pets-benefit',
  'smell-of-you',
  'cough-and-breathlessness-decrease',
  'sperm-quality-3-months',
  'female-fertility-ivf',
  'copd-symptoms-improve',
  'fev1-decline-slows',
  'gerd-improves-1-year',
  'oral-microbiome-recovers',
  'gum-healing-response-restored',
  'mucus-properties-12-months',
  'cravings-decline',
  'chd-risk-halved-1-year',
  'heart-attack-risk-halved-1-year',
  'stroke-risk-falls',
  'fibrinogen-normalises',
  'mouth-throat-larynx-cancer',
  'lung-cancer-10-years',
  'bladder-cancer-risk',
  'kidney-oesophagus-pancreas-cancer',
  'cervical-cancer-risk',
  'chd-risk-nonsmoker-15-years',
  'tooth-loss-risk',
  'fracture-risk-falls',
  'hearing-loss-risk',
  'macular-degeneration-risk',
  'cataract-risk',
  'dementia-risk',
  'brain-cortex-recovery',
  'crohns-disease-normalises',
  'rheumatoid-arthritis-risk',
  'infection-and-pneumonia-risk',
  'inflammatory-response-drops-fast',
  'type-2-diabetes-honest',
  'cancer-survival-after-diagnosis',
  'life-expectancy-by-quit-age',
  'quit-before-40',
  'hair-and-scalp',
  'dry-eye',
  'financial-and-autonomy',
];

const EVIDENCE_LEVELS = new Set(['strong', 'moderate', 'emerging']);

describe('HEALTH_MILESTONES dataset integrity', () => {
  it('has exactly 80 entries', () => {
    expect(HEALTH_MILESTONES).toHaveLength(80);
  });

  it('has exactly 80 unique ids', () => {
    const ids = HEALTH_MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(80);
  });

  it('contains every id from the appendix, exactly once', () => {
    expect(APPENDIX_IDS).toHaveLength(80);
    const ids = HEALTH_MILESTONES.map((m) => m.id).sort();
    expect(ids).toEqual([...APPENDIX_IDS].sort());
  });

  it.each(HEALTH_MILESTONES.map((m) => [m.id, m] as const))(
    '%s: has a nonempty title/description, valid category and evidenceLevel, and a valid source',
    (_id, milestone) => {
      expect(milestone.title.length).toBeGreaterThan(0);
      expect(milestone.description.length).toBeGreaterThan(0);
      expect(MILESTONE_CATEGORIES).toContain(milestone.category);
      expect(EVIDENCE_LEVELS.has(milestone.evidenceLevel)).toBe(true);
      expect(milestone.sources.length).toBeGreaterThanOrEqual(1);
      for (const source of milestone.sources) {
        expect(source.url).toMatch(/^https?:\/\//);
      }
    }
  );

  it.each(HEALTH_MILESTONES.map((m) => [m.id, m] as const))(
    '%s: has an honest timing shape',
    (_id, milestone) => {
      const { timing } = milestone;
      switch (timing.kind) {
        case 'window':
          expect(timing.earliestHours).toBeGreaterThanOrEqual(0);
          expect(timing.earliestHours).toBeLessThan(timing.typicalUntilHours);
          break;
        case 'point':
        case 'openEnded':
          expect(timing.earliestHours).toBeGreaterThanOrEqual(0);
          break;
        case 'noTimeline':
          expect(timing.phrase.length).toBeGreaterThan(0);
          break;
        default:
          throw new Error(`Unknown timing kind: ${JSON.stringify(timing)}`);
      }
    }
  );

  it('has exactly 12 entries with didYouKnow: true (verified against the appendix: only 12 of its 80 titles actually begin "Did you know?", not the 14 the brief stated — see task-3-report.md)', () => {
    const count = HEALTH_MILESTONES.filter((m) => m.didYouKnow).length;
    expect(count).toBe(12);
  });

  it('has at least one dated (non-noTimeline) milestone with earliestHours === 0', () => {
    // The milestones engine's `happeningNow` (domain/milestones/engine.ts) can
    // legitimately return an empty array when nothing has started yet — but
    // only when every dated milestone's earliest is still ahead of "now".
    // This dataset invariant guarantees that never happens in the real app:
    // as long as at least one dated milestone starts at hour 0, the Home
    // "in your body right now" carousel is non-empty from the very instant
    // of quitting. If a future dataset edit removes every hour-0 entry, this
    // test fails loudly rather than the carousel silently going blank.
    const hasZeroHourMilestone = HEALTH_MILESTONES.some(
      (m) => m.timing.kind !== 'noTimeline' && m.timing.earliestHours === 0
    );
    expect(hasZeroHourMilestone).toBe(true);
  });
});

describe('INTERVENTIONS', () => {
  it('has exactly 7 entries with unique ids', () => {
    expect(INTERVENTIONS).toHaveLength(7);
    expect(new Set(INTERVENTIONS.map((i) => i.id)).size).toBe(7);
  });

  it('gives timed interventions a positive durationMs, and leaves reasons/proof untimed', () => {
    for (const intervention of INTERVENTIONS) {
      if (intervention.id === 'reasons' || intervention.id === 'proof') {
        expect(intervention.durationMs).toBeNull();
      } else {
        expect(intervention.durationMs).not.toBeNull();
        expect(intervention.durationMs as number).toBeGreaterThan(0);
      }
    }
  });

  it('TRUTH_CARDS has exactly 10 messages', () => {
    expect(TRUTH_CARDS).toHaveLength(10);
  });
});
