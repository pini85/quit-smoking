import { describe, expect, it } from 'vitest';
import { BELIEF_META } from '@/data/beliefs';
import { BRAIN_RESPONSES } from '@/data/brainResponses';
import { FREEDOM_LESSONS } from '@/data/freedomLessons';
import { proofLine } from '@/domain/freedom/evidence';
import { BELIEFS, isBelief, isTrigger } from '@/domain/types';
import type { CravingSession } from '@/domain/types';
import { UNNAMED_RESPONSE } from '@/components/freedom/BrainFlow';

// Source of truth for every `principleRefs` anchor below:
// docs/research/freedom-principles.md — A1–A17 (Carr principles), C1–C8
// (behavioural science), plus the unnumbered B/D/E sections.
const PRINCIPLE_ANCHOR = /^[A-E]\d*$/;
const KNOWN_ANCHORS = new Set([
  ...Array.from({ length: 17 }, (_, i) => `A${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `C${i + 1}`),
  'B',
  'D',
  'E',
]);

const SOURCE_KINDS = new Set(['carr', 'psych', 'med']);
const LESSON_KINDS = new Set(['booster', 'exercise']);

/**
 * Anchors whose dismantling argument rests on clinical evidence rather than on
 * Carr's framing: the withdrawal timeline (A1), the stress finding (A4, C8),
 * the honest concentration dip (A5), and the lapse literature (A10). A lesson
 * may only call itself `med` if it is actually standing on one of these, and a
 * lesson standing on the mental-health finding (C8) may not call itself
 * anything else — that is the "never present Carr framing as medical fact" rule
 * (research doc, classification key) made mechanical.
 */
const MED_BACKED_ANCHORS = new Set(['A1', 'A4', 'A5', 'A10', 'C8']);

/**
 * Beliefs whose brain response should splice in the user's own per-trigger
 * history. These are the ritual and context-bound promises: the ones the user
 * has already disproved, in that exact context, in their own craving log.
 */
const PROOF_BELIEFS = [
  'relaxation',
  'stress-relief',
  'coffee-ritual',
  'alcohol-pairing',
  'meal-completion',
  'boredom-relief',
  'break-permission',
  'social-ease',
] as const;

// ---------------------------------------------------------------------------
// Copy collection
// ---------------------------------------------------------------------------

/**
 * Every displayed string in a freedom content structure, with a path for
 * failure messages.
 *
 * Domain identifiers (belief ids, trigger ids) are skipped: they are fixed by
 * domain/types.ts, never rendered raw, and one of them — 'willpower-needed' —
 * necessarily contains a banned substring, because naming the promise is how
 * the app dismantles it. Object keys are skipped for the same reason.
 */
function collectCopy(
  node: unknown,
  path: string,
  out: Array<[string, string]>
): Array<[string, string]> {
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

/**
 * `domain/freedom/evidence.ts` speaks in app voice too — the neutral fallback
 * and both grounded templates are sentences a user reads, not data — but they
 * are string literals inside `proofLine` rather than an exported table. The
 * only way to scan them is to render them, so each branch is built from fixed
 * sessions: no clock, no randomness, stable numbers.
 */
function evidenceCopy(): Array<[string, string]> {
  const mk = (i: number, overrides: Partial<CravingSession>): CravingSession => ({
    id: `scan-${i}`,
    startedAt: '2026-01-01T12:00:00Z',
    initialIntensity: 5,
    outcome: 'passed',
    ...overrides,
  });
  const three = (overrides: Partial<CravingSession>) =>
    [0, 1, 2].map((i) => mk(i, overrides));
  return [
    // Nothing logged at all — the ungrounded fallback.
    ['proofLine.fallback', proofLine([], 'reward').text],
    // Three resolved cravings tagged with the belief — the belief-tag template.
    ['proofLine.byBelief', proofLine(three({ beliefId: 'reward' }), 'reward').text],
    // No belief tags, three resolved cravings in a related context — the
    // trigger-derived template, which also splices a TRIGGER_META label.
    [
      'proofLine.byTrigger',
      proofLine(three({ trigger: 'stress' }), 'stress-relief').text,
    ],
  ];
}

const EVIDENCE_COPY = evidenceCopy();

/**
 * Everything the feature authors in its own voice, with no exemptions: the two
 * content files walked whole, plus the two places freedom copy lives outside
 * them — `BrainFlow`'s unnamed-promise answer (which `data/brainResponses.ts`
 * has nowhere to hold) and the rendered `proofLine` sentences.
 */
const AUTHORED_COPY: Array<[string, string]> = [
  ...collectCopy(FREEDOM_LESSONS, 'FREEDOM_LESSONS', []),
  ...collectCopy(BRAIN_RESPONSES, 'BRAIN_RESPONSES', []),
  ...collectCopy(UNNAMED_RESPONSE, 'UNNAMED_RESPONSE', []),
  ...EVIDENCE_COPY,
];

/**
 * The scan surface: everything the freedom feature says in its own voice.
 *
 * `data/beliefs.ts` contributes its `label` values only. Its `promise` values
 * are first-person quotes of the belief being dismantled — the
 * 'willpower-needed' promise quotes the word on purpose — and quoting the trap
 * is not speaking in its voice. That file's own header records the exemption.
 *
 * Everything in `AUTHORED_COPY` is app voice, so it is scanned whole.
 */
const SCANNED_COPY: Array<[string, string]> = [
  ...BELIEFS.map(
    (id) =>
      [`BELIEF_META.${id}.label`, BELIEF_META[id].label] as [string, string]
  ),
  ...AUTHORED_COPY,
];

/** Typographic apostrophes normalised so "don’t give in" cannot slip through. */
const normalise = (s: string) => s.replace(/[‘’]/g, "'").toLowerCase();

describe('freedom copy: tone and safety scan', () => {
  // Binding list from the task brief. Two jobs in one scan:
  //  - tone (research doc section E): curiosity over combat, no deprivation
  //    vocabulary, no "be strong" cheerleading;
  //  - safety (section A14 + Decisions): the app must never carry Carr's
  //    anti-NRT stance, which contradicts medical consensus. The pharmacotherapy
  //    terms are banned in either direction — the app neither recommends nor
  //    argues against them.
  const BANNED = [
    'willpower',
    'resist',
    'fight the',
    'stay strong',
    "don't give in",
    'giving up smoking is hard',
    'nicotine replacement',
    'nrt',
    'patch',
    'nicotine gum',
  ];

  it('has copy to scan (guards against an empty or mis-shaped surface)', () => {
    expect(SCANNED_COPY.length).toBeGreaterThan(100);
    expect(UNNAMED_RESPONSE.length).toBeGreaterThanOrEqual(2);
    // The evidence lines are rendered rather than literal: were a gate change
    // to collapse them onto the same fallback, this scan would be guarding one
    // sentence three times instead of all three templates.
    expect(new Set(EVIDENCE_COPY.map(([, text]) => text)).size).toBe(
      EVIDENCE_COPY.length
    );
  });

  it.each(BANNED)('never says %j anywhere in freedom copy', (banned) => {
    const needle = normalise(banned);
    const offenders = SCANNED_COPY.filter(([, value]) =>
      normalise(value).includes(needle)
    ).map(([path, value]) => `${path}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it('keeps combat and deprivation vocabulary out of every authored line', () => {
    // The rest of research-doc section E, which the brief's list only half
    // covers. E bans "battle, fight, resist, strength, or beat" as well as
    // "giving up" and "sacrifice"; the brief's `fight the` only catches one
    // inflection ("fighting the urge" slips past it), so the stems are matched
    // here instead. Not on the brief's list, but the same doctrine — and
    // nothing in AUTHORED_COPY quotes anything, so there is nothing to exempt:
    // the quoting all happens in BELIEF_META.promise.
    //
    // 'beat' is matched as a whole word: 'heartbeat' and 'beaten track' are not
    // combat framing, and the app's health content legitimately says the first.
    const doctrine = [
      'giving up',
      'sacrifice',
      'battle',
      'fight',
      'strength',
      /\bbeat/,
    ];
    for (const word of doctrine) {
      const hits = (value: string) =>
        typeof word === 'string'
          ? normalise(value).includes(word)
          : word.test(normalise(value));
      const offenders = AUTHORED_COPY
        .filter(([, value]) => hits(value))
        .map(([path, value]) => `${path} (${String(word)}): ${value}`);
      expect(offenders).toEqual([]);
    }
  });

  it('uses no exclamation marks', () => {
    const offenders = SCANNED_COPY.filter(([, value]) =>
      value.includes('!')
    ).map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

describe('FREEDOM_LESSONS', () => {
  it('holds 12–20 lessons with both kinds well represented', () => {
    expect(FREEDOM_LESSONS.length).toBeGreaterThanOrEqual(12);
    expect(FREEDOM_LESSONS.length).toBeLessThanOrEqual(20);
    const boosters = FREEDOM_LESSONS.filter((l) => l.kind === 'booster');
    const exercises = FREEDOM_LESSONS.filter((l) => l.kind === 'exercise');
    expect(boosters.length).toBeGreaterThanOrEqual(5);
    expect(exercises.length).toBeGreaterThanOrEqual(5);
  });

  it('gives every lesson a unique, kebab-case id', () => {
    const ids = FREEDOM_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(FREEDOM_LESSONS.map((l) => [l.id, l] as const))(
    '%s: has a valid kind, sourceKind and nonempty title and idea',
    (_id, lesson) => {
      expect(LESSON_KINDS.has(lesson.kind)).toBe(true);
      expect(SOURCE_KINDS.has(lesson.sourceKind)).toBe(true);
      expect(lesson.title.trim().length).toBeGreaterThan(0);
      expect(lesson.idea.trim().length).toBeGreaterThan(0);
    }
  );

  it.each(FREEDOM_LESSONS.map((l) => [l.id, l] as const))(
    '%s: names real, distinct beliefs and real contexts',
    (_id, lesson) => {
      expect(lesson.beliefIds.length).toBeGreaterThanOrEqual(1);
      for (const belief of lesson.beliefIds) expect(isBelief(belief)).toBe(true);
      expect(new Set(lesson.beliefIds).size).toBe(lesson.beliefIds.length);
      for (const trigger of lesson.triggerIds) {
        expect(isTrigger(trigger)).toBe(true);
        // 'other' is a "none of the above" user selection, not a context a
        // lesson can be about — same rule the belief catalog follows.
        expect(trigger).not.toBe('other');
      }
      expect(new Set(lesson.triggerIds).size).toBe(lesson.triggerIds.length);
    }
  );

  it.each(FREEDOM_LESSONS.map((l) => [l.id, l] as const))(
    '%s: cites distinct research-doc anchors that exist',
    (_id, lesson) => {
      expect(lesson.principleRefs.length).toBeGreaterThanOrEqual(1);
      for (const ref of lesson.principleRefs) {
        expect(ref).toMatch(PRINCIPLE_ANCHOR);
        expect(KNOWN_ANCHORS.has(ref)).toBe(true);
      }
      expect(new Set(lesson.principleRefs).size).toBe(
        lesson.principleRefs.length
      );
    }
  );

  it.each(FREEDOM_LESSONS.map((l) => [l.id, l] as const))(
    '%s: labels its evidence honestly',
    (_id, lesson) => {
      const refs = lesson.principleRefs;
      if (lesson.sourceKind === 'med') {
        expect(refs.some((r) => MED_BACKED_ANCHORS.has(r))).toBe(true);
      }
      // The mental-health finding (Taylor 2014 / Cochrane 2021) is the one
      // place Carr's intuition is backed by clinical evidence. A lesson leaning
      // on it must say so.
      if (refs.includes('C8')) expect(lesson.sourceKind).toBe('med');
    }
  );

  it.each(FREEDOM_LESSONS.map((l) => [l.id, l] as const))(
    '%s: carries a "notice this" line and one reflection question',
    (_id, lesson) => {
      // Boosters are idea → notice today → reflect. Exercises map
      // Notice → Question → Reframe onto notice/reflect/idea. Either way all
      // three slots are filled, and the reflection slot is a question.
      expect(lesson.notice?.trim().length ?? 0).toBeGreaterThan(0);
      expect(lesson.reflect?.trim().length ?? 0).toBeGreaterThan(0);
      expect(lesson.reflect?.trim().endsWith('?')).toBe(true);
    }
  );

  it.each(FREEDOM_LESSONS.map((l) => [l.id, l] as const))(
    '%s: stays inside a 30–90 second read',
    (_id, lesson) => {
      expect(lesson.title.length).toBeLessThanOrEqual(48);
      expect(lesson.idea.length).toBeLessThanOrEqual(520);
      expect(lesson.notice?.length ?? 0).toBeLessThanOrEqual(280);
      expect(lesson.reflect?.length ?? 0).toBeLessThanOrEqual(200);
    }
  );

  it('teaches every belief in the catalog at least once', () => {
    const taught = new Set(FREEDOM_LESSONS.flatMap((l) => l.beliefIds));
    const untaught = BELIEFS.filter((id) => !taught.has(id));
    expect(untaught).toEqual([]);
  });

  it('uses every source kind at least once', () => {
    const used = new Set(FREEDOM_LESSONS.map((l) => l.sourceKind));
    expect([...used].sort()).toEqual(['carr', 'med', 'psych']);
  });
});

describe('BRAIN_RESPONSES', () => {
  it('answers exactly the beliefs in the catalog, and no others', () => {
    expect(Object.keys(BRAIN_RESPONSES).sort()).toEqual([...BELIEFS].sort());
  });

  it.each(BELIEFS.map((id) => [id, BRAIN_RESPONSES[id]] as const))(
    '%s: offers 2–3 distinct, nonempty, seconds-scale variants',
    (_id, response) => {
      expect(response.lines.length).toBeGreaterThanOrEqual(2);
      expect(response.lines.length).toBeLessThanOrEqual(3);
      expect(new Set(response.lines).size).toBe(response.lines.length);
      for (const line of response.lines) {
        expect(line.trim().length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(300);
      }
    }
  );

  it.each(BELIEFS.map((id) => [id, BRAIN_RESPONSES[id]] as const))(
    '%s: only claims a proof kind the app can actually fulfil',
    (_id, response) => {
      if (response.proofKind !== undefined) {
        expect(response.proofKind).toBe('trigger-history');
      }
    }
  );

  it('splices real history only into beliefs with meaningful contexts', () => {
    // A single related trigger would make for a thin splice — one context the
    // user may never have logged. History-backed promises are the ones that
    // recur across at least two of the app's recorded contexts.
    for (const id of BELIEFS) {
      if (BRAIN_RESPONSES[id].proofKind === 'trigger-history') {
        expect(BELIEF_META[id].relatedTriggers.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('marks the ritual and coping promises as history-backed', () => {
    const marked = BELIEFS.filter(
      (id) => BRAIN_RESPONSES[id].proofKind === 'trigger-history'
    );
    expect([...marked].sort()).toEqual([...PROOF_BELIEFS].sort());
  });
});
