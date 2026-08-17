import { describe, expect, it } from 'vitest';
import {
  BELIEF_CATEGORIES,
  BELIEF_META,
  BELIEF_ORDER,
  TRIGGER_BELIEF_SUGGESTIONS,
} from '@/data/beliefs';
import { BELIEFS, TRIGGERS, isBelief, isTrigger } from '@/domain/types';

// The research corpus this content library is authored from:
// docs/research/freedom-principles.md. Its section anchors are what
// `principleRefs` points at — A1–A17 (Carr principles), C1–C8 (behavioural
// science), and the unnumbered B/D/E sections.
const PRINCIPLE_ANCHOR = /^[A-E]\d*$/;
const KNOWN_ANCHORS = new Set([
  ...Array.from({ length: 17 }, (_, i) => `A${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `C${i + 1}`),
  'B',
  'D',
  'E',
]);

const SOURCE_KINDS = new Set(['carr', 'psych', 'med']);

describe('BELIEF_META', () => {
  it('has exactly one entry per BELIEFS id, and no extras', () => {
    expect(Object.keys(BELIEF_META).sort()).toEqual([...BELIEFS].sort());
  });

  it.each(BELIEFS.map((id) => [id, BELIEF_META[id]] as const))(
    '%s: has a nonempty label and first-person promise',
    (_id, meta) => {
      expect(meta.label.trim().length).toBeGreaterThan(0);
      expect(meta.promise.trim().length).toBeGreaterThan(0);
    }
  );

  it.each(BELIEFS.map((id) => [id, BELIEF_META[id]] as const))(
    '%s: has a valid category and sourceKind',
    (_id, meta) => {
      expect(BELIEF_CATEGORIES).toContain(meta.category);
      expect(SOURCE_KINDS.has(meta.sourceKind)).toBe(true);
    }
  );

  it.each(BELIEFS.map((id) => [id, BELIEF_META[id]] as const))(
    '%s: relates to at least one real trigger, without duplicates',
    (_id, meta) => {
      expect(meta.relatedTriggers.length).toBeGreaterThanOrEqual(1);
      for (const trigger of meta.relatedTriggers) {
        expect(isTrigger(trigger)).toBe(true);
      }
      expect(new Set(meta.relatedTriggers).size).toBe(
        meta.relatedTriggers.length
      );
    }
  );

  it.each(BELIEFS.map((id) => [id, BELIEF_META[id]] as const))(
    '%s: cites at least one research-doc section anchor that exists',
    (_id, meta) => {
      expect(meta.principleRefs.length).toBeGreaterThanOrEqual(1);
      for (const ref of meta.principleRefs) {
        expect(ref).toMatch(PRINCIPLE_ANCHOR);
        expect(KNOWN_ANCHORS.has(ref)).toBe(true);
      }
      expect(new Set(meta.principleRefs).size).toBe(meta.principleRefs.length);
    }
  );

  it.each(BELIEFS.map((id) => [id, BELIEF_META[id]] as const))(
    '%s: keeps labels free of exclamation marks (tone doctrine section E)',
    (_id, meta) => {
      expect(meta.label).not.toContain('!');
    }
  );

  it('uses every belief category at least once', () => {
    const used = new Set(BELIEFS.map((id) => BELIEF_META[id].category));
    for (const category of BELIEF_CATEGORIES) {
      expect(used.has(category)).toBe(true);
    }
  });
});

describe('BELIEF_ORDER', () => {
  it('is a permutation of BELIEFS — every id exactly once, no extras', () => {
    expect(BELIEF_ORDER).toHaveLength(BELIEFS.length);
    expect(new Set(BELIEF_ORDER).size).toBe(BELIEF_ORDER.length);
    expect([...BELIEF_ORDER].sort()).toEqual([...BELIEFS].sort());
  });

  it('contains only valid belief ids', () => {
    for (const id of BELIEF_ORDER) {
      expect(isBelief(id)).toBe(true);
    }
  });
});

describe('TRIGGER_BELIEF_SUGGESTIONS', () => {
  it('covers every trigger, including "other" and "seeing-smoking"', () => {
    expect(Object.keys(TRIGGER_BELIEF_SUGGESTIONS).sort()).toEqual(
      [...TRIGGERS].sort()
    );
  });

  it.each(TRIGGERS.map((t) => [t, TRIGGER_BELIEF_SUGGESTIONS[t]] as const))(
    '%s: suggests 2–4 distinct, real beliefs',
    (_trigger, suggestions) => {
      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.length).toBeLessThanOrEqual(4);
      for (const belief of suggestions) {
        expect(isBelief(belief)).toBe(true);
      }
      expect(new Set(suggestions).size).toBe(suggestions.length);
    }
  );

  it('leads each context list with a belief that genuinely belongs to it', () => {
    // Lists are ordered most-plausible-first, and the head is what the UI shows
    // in its most prominent chip slot. Later entries may legitimately be
    // context-free beliefs ("just one", "I miss smoking"), but the head must
    // name the trigger among its own relatedTriggers.
    //
    // 'other' is excluded by construction, not by convenience: it is the "none
    // of the above" selection rather than a context, so no belief lists it (see
    // the test below) and no belief could head it. Its own contents are
    // asserted separately.
    for (const trigger of TRIGGERS.filter((t) => t !== 'other')) {
      const [head] = TRIGGER_BELIEF_SUGGESTIONS[trigger];
      expect(BELIEF_META[head].relatedTriggers).toContain(trigger);
    }
  });

  it('treats "other" as a non-context: no belief claims it as a related trigger', () => {
    // 'other' means "none of the above" — a user saying they couldn't place the
    // craving. Tagging beliefs with it would encode it as a context they arise
    // in, which is what produced an early draft's implausible chip list.
    for (const id of BELIEFS) {
      expect(BELIEF_META[id].relatedTriggers).not.toContain('other');
    }
  });

  it('offers "other" the in-the-moment promises, not the long-run fears', () => {
    // An uncategorised craving was still a craving minutes ago, so its chips
    // must be answers to "what was it promising?" — relief, reward, a break —
    // rather than beliefs about how life will feel in a year. The 'fear'
    // category is exactly that long-run cluster, and belongs in the /brain
    // library instead.
    for (const belief of TRIGGER_BELIEF_SUGGESTIONS.other) {
      expect(BELIEF_META[belief].category).not.toBe('fear');
    }
  });
});
