import { describe, expect, it } from 'vitest';
import { BELIEF_META, beliefLabel, beliefPromise } from '@/data/beliefs';
import { FI_BELIEF_TEXT } from '@/data/fi/beliefs';
import { BRAIN_RESPONSES, brainResponseLines } from '@/data/brainResponses';
import { FI_BRAIN_RESPONSES } from '@/data/fi/brainResponses';
import { FI_UNNAMED_RESPONSE } from '@/data/fi/unnamedResponse';
import { UNNAMED_RESPONSE } from '@/components/freedom/BrainFlow';
import { FREEDOM_LESSONS, localizedLesson } from '@/data/freedomLessons';
import { FI_FREEDOM_LESSON_TEXT } from '@/data/fi/freedomLessons';
import { ACHIEVEMENT_DEFINITIONS } from '@/domain/achievements/definitions';
import { FI_ACHIEVEMENT_TEXT } from '@/data/fi/achievements';
import { CATEGORY_META } from '@/components/health/categoryMeta';
import { FI_CATEGORY_LABELS } from '@/data/fi/categoryMeta';
import { INTERVENTIONS, TRUTH_CARDS, localizedIntervention } from '@/data/interventions';
import { FI_INTERVENTIONS, FI_TRUTH_CARDS } from '@/data/fi/interventions';
import { TRIGGER_META, TRIGGER_ORDER } from '@/data/triggers';
import { FI_TRIGGER_TEXT } from '@/data/fi/triggers';
import { BELIEFS, isBelief, isTrigger } from '@/domain/types';
import { proofLine } from '@/domain/freedom/evidence';
import type { CravingSession } from '@/domain/types';

// ---------------------------------------------------------------------------
// Key/id/length parity: the Finnish overlay must cover exactly the same ids
// as its English source, and any rotation array must keep the same length so
// `dayIndex % lines.length` lands on the same index in both locales.
// ---------------------------------------------------------------------------

describe('Finnish overlay parity', () => {
  it('beliefs: same id set as BELIEF_META', () => {
    expect(Object.keys(FI_BELIEF_TEXT).sort()).toEqual([...BELIEFS].sort());
  });

  it('brain responses: same id set, same line count per belief as BRAIN_RESPONSES', () => {
    expect(Object.keys(FI_BRAIN_RESPONSES).sort()).toEqual([...BELIEFS].sort());
    for (const id of BELIEFS) {
      expect(FI_BRAIN_RESPONSES[id].length).toBe(BRAIN_RESPONSES[id].lines.length);
    }
  });

  it('unnamed response: same length as the English array', () => {
    expect(FI_UNNAMED_RESPONSE.length).toBe(UNNAMED_RESPONSE.length);
  });

  it('freedom lessons: every id has a Finnish entry', () => {
    const ids = FREEDOM_LESSONS.map((l) => l.id).sort();
    expect(Object.keys(FI_FREEDOM_LESSON_TEXT).sort()).toEqual(ids);
  });

  it('achievements: every id has a Finnish entry', () => {
    const ids = ACHIEVEMENT_DEFINITIONS.map((d) => d.id).sort();
    expect(Object.keys(FI_ACHIEVEMENT_TEXT).sort()).toEqual(ids);
  });

  it('category labels: same id set as CATEGORY_META', () => {
    expect(Object.keys(FI_CATEGORY_LABELS).sort()).toEqual(
      Object.keys(CATEGORY_META).sort()
    );
  });

  it('triggers: same id set as TRIGGER_META', () => {
    expect(Object.keys(FI_TRIGGER_TEXT).sort()).toEqual(
      Object.keys(TRIGGER_META).sort()
    );
  });

  it('interventions: same id set, and per-kind prompt arrays match English length', () => {
    expect(Object.keys(FI_INTERVENTIONS).sort()).toEqual(
      INTERVENTIONS.map((i) => i.id).sort()
    );
    for (const intervention of INTERVENTIONS) {
      expect(FI_INTERVENTIONS[intervention.id].prompts.length).toBe(
        intervention.prompts.length
      );
    }
  });

  it('truth cards: same length as the English array (delay reuses this list in both locales)', () => {
    expect(FI_TRUTH_CARDS.length).toBe(TRUTH_CARDS.length);
  });
});

// ---------------------------------------------------------------------------
// Finnish tone/safety doctrine — mirrors
// tests/domain/freedomContent.test.ts's English scan, over the same content
// domains (freedom lessons, brain responses, the unnamed response, belief
// labels, and the localized proofLine sentences) with a Finnish banned list.
// `BELIEF_META.promise` / `FI_BELIEF_TEXT.promise` are exempted exactly as in
// the English test — they are first-person quotes of the belief being
// dismantled, not the app's own voice.
// ---------------------------------------------------------------------------

function collectCopy(node: unknown, path: string, out: Array<[string, string]>): Array<[string, string]> {
  if (typeof node === 'string') {
    if (!isBelief(node) && !isTrigger(node)) out.push([path, node]);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectCopy(item, `${path}[${i}]`, out));
    return out;
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectCopy(value, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

function fiEvidenceCopy(): Array<[string, string]> {
  const mk = (i: number, overrides: Partial<CravingSession>): CravingSession => ({
    id: `scan-fi-${i}`,
    startedAt: '2026-01-01T12:00:00Z',
    initialIntensity: 5,
    outcome: 'passed',
    ...overrides,
  });
  const three = (overrides: Partial<CravingSession>) => [0, 1, 2].map((i) => mk(i, overrides));
  return [
    ['proofLine.fallback', proofLine([], 'reward', 'fi').text],
    ['proofLine.byBelief', proofLine(three({ beliefId: 'reward' }), 'reward', 'fi').text],
    ['proofLine.byTrigger', proofLine(three({ trigger: 'stress' }), 'stress-relief', 'fi').text],
  ];
}

const FI_LESSON_TEXTS = FREEDOM_LESSONS.map((l) => localizedLesson(l, 'fi'));
const FI_BRAIN_LINES = BELIEFS.flatMap((id) => brainResponseLines(id, 'fi'));

const FI_AUTHORED_COPY: Array<[string, string]> = [
  ...collectCopy(FI_LESSON_TEXTS, 'FI_FREEDOM_LESSON_TEXT', []),
  ...collectCopy(FI_BRAIN_LINES, 'FI_BRAIN_RESPONSES', []),
  ...collectCopy(FI_UNNAMED_RESPONSE, 'FI_UNNAMED_RESPONSE', []),
  ...fiEvidenceCopy(),
];

const FI_SCANNED_COPY: Array<[string, string]> = [
  ...BELIEFS.map((id) => [`FI_BELIEF_TEXT.${id}.label`, beliefLabel(id, 'fi')] as [string, string]),
  ...FI_AUTHORED_COPY,
];

describe('Finnish freedom copy: tone and safety scan', () => {
  // Mirrors the English brief list. Finnish equivalents of the banned
  // English terms, plus the NRT terms untranslated/transliterated since
  // they'd appear in either form in Finnish health writing.
  const BANNED = [
    'vastusta',
    'pysy vahvana',
    'älä anna periksi',
    'nikotiinikorvaus',
    'nikotiinilaastari',
    'nikotiinipurukumi',
    ' nrt ',
  ];

  it('has copy to scan', () => {
    expect(FI_SCANNED_COPY.length).toBeGreaterThan(50);
    expect(FI_UNNAMED_RESPONSE.length).toBeGreaterThanOrEqual(2);
  });

  it.each(BANNED)('never says %j anywhere in Finnish freedom copy', (banned) => {
    const offenders = FI_SCANNED_COPY.filter(([, value]) =>
      value.toLowerCase().includes(banned)
    ).map(([path, value]) => `${path}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it('keeps combat and deprivation vocabulary out of every authored Finnish line', () => {
    // Finnish stems for the English doctrine list: luopu- (giving up —
    // 'willpower-needed'/'deprivation' PROMISE quotes are exempt, same as
    // English exempts BELIEF_META.promise), uhraus/uhrata (sacrifice),
    // taistel- (battle/fight).
    const doctrine = ['luopu', 'uhraus', 'uhrata', 'taistel'];
    for (const stem of doctrine) {
      const offenders = FI_AUTHORED_COPY.filter(([, value]) =>
        value.toLowerCase().includes(stem)
      ).map(([path, value]) => `${path} (${stem}): ${value}`);
      expect(offenders).toEqual([]);
    }
  });

  it('uses no exclamation marks', () => {
    const offenders = FI_SCANNED_COPY.filter(([, value]) => value.includes('!')).map(
      ([path]) => path
    );
    expect(offenders).toEqual([]);
  });
});

describe('Finnish freedom lessons: reflect ends in a question mark', () => {
  it.each(FREEDOM_LESSONS.map((l) => [l.id, l] as const))('%s', (_id, lesson) => {
    const fi = localizedLesson(lesson, 'fi');
    if (fi.reflect) expect(fi.reflect.trim().endsWith('?')).toBe(true);
  });
});
