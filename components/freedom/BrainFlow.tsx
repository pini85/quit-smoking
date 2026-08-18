'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Belief, Trigger } from '@/domain/types';
import { BELIEF_META, BELIEF_ORDER, TRIGGER_BELIEF_SUGGESTIONS } from '@/data/beliefs';
import { BRAIN_RESPONSES } from '@/data/brainResponses';
import { proofLine } from '@/domain/freedom/evidence';
import { perTriggerStats } from '@/domain/stats/cravingStats';
import { daysSinceEpoch } from '@/domain/time';
import { useAppData } from '@/lib/hooks/useAppData';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { toLocalIso } from '@/lib/utils/iso';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { ConvictionRow } from './ConvictionRow';

type Phase = 'promise' | 'response';

/** How many promises are offered before the "show the rest" disclosure. */
const VISIBLE_PROMISES = 6;

/**
 * The answer when the promise can't be named. `data/brainResponses.ts` is
 * keyed by belief and has nowhere to put this, so the copy lives here — the
 * one screen that can reach the "I don't know" branch. Rotated by the same
 * day rule as the belief responses, so it is stable within a day too.
 *
 * Exported for the tone scan only — `data/brainResponses.ts` is walked whole by
 * `tests/domain/freedomContent.test.ts`, and app voice living outside that file
 * would otherwise sit outside the guard.
 */
export const UNNAMED_RESPONSE = [
  'Not naming it changes nothing. The wanting turns up first and the reason gets written afterwards, to explain it.',
  'It does not need a name to pass. Whatever it was offering, it was offering it for a few minutes.',
];

/**
 * "My brain is convincing me" — the immersive /brain flow, meant to be over in
 * seconds: one promise, one answer to it, out.
 *
 * Persistence contract (the write-once rule on `FreedomSession` in
 * `domain/types.ts`, and the shape `ExerciseSheet` already follows):
 *
 * - Nothing at all is written until a terminal action. Backing out — the X,
 *   the browser's back button, a closed tab — writes NOTHING, so there is no
 *   finalizer here and no `beforeunload` to bolt on.
 * - Either terminal action writes exactly ONE `FreedomSession`: Done writes
 *   it, and so does tapping a conviction anchor, because that tap is itself
 *   the end of the flow. `saving` guards the double tap; `sessionWrittenRef`
 *   guards the partial failure — if the session lands and the assessment
 *   write then throws, the screen stays put for a retry, and that retry must
 *   not log the same visit twice.
 * - `startedAt` is captured at mount, not at Done, so the row records how
 *   long the user actually spent here.
 *
 * No `sweepAchievements`: no achievement reads freedom data yet.
 */
export function BrainFlow() {
  const { data, store } = useAppData();
  const { locale } = useLocale();
  const m = useMessages();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('promise');
  const [belief, setBelief] = useState<Belief | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const startedAtRef = useRef<string | null>(null);
  // Latches once the session row is committed — see the contract above.
  const sessionWrittenRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = toLocalIso(new Date());
  }, []);

  /**
   * Which variant everyone gets today. Deterministic on the local day rather
   * than random: a returning user reads a different sentence tomorrow, but the
   * same one if they come back an hour later — and the choice stays testable.
   */
  const [dayIndex] = useState(() => daysSinceEpoch(new Date()));

  const cravings = data.cravings;

  /**
   * The promises to offer, best guess first: the ones that go with the
   * contexts this user logs most often, then the rest of the house order.
   * Ties keep the order they were met in, so the list is stable between
   * visits rather than reshuffling under a finger.
   */
  const orderedBeliefs = useMemo(() => {
    const stats = perTriggerStats(cravings);
    const byFrequency = (Object.keys(stats) as Trigger[]).sort(
      (a, b) => (stats[b]?.total ?? 0) - (stats[a]?.total ?? 0)
    );
    const ordered: Belief[] = [];
    const seen = new Set<Belief>();
    for (const trigger of byFrequency) {
      for (const suggested of TRIGGER_BELIEF_SUGGESTIONS[trigger]) {
        if (seen.has(suggested)) continue;
        seen.add(suggested);
        ordered.push(suggested);
      }
    }
    for (const id of BELIEF_ORDER) {
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
    return ordered;
  }, [cravings]);

  const visibleBeliefs = showAll ? orderedBeliefs : orderedBeliefs.slice(0, VISIBLE_PROMISES);

  const response = belief === null ? null : BRAIN_RESPONSES[belief];
  const line =
    response === null
      ? UNNAMED_RESPONSE[dayIndex % UNNAMED_RESPONSE.length]
      : response.lines[dayIndex % response.lines.length];
  // Only the grounded form earns the proof box. `proofLine` still answers below
  // its >= 3 gate, but with a neutral placeholder line rather than evidence —
  // and a box saying nothing in particular reads as a claim that failed to
  // arrive. Below the gate the response line alone is the whole answer.
  const proof =
    belief !== null && response?.proofKind === 'trigger-history'
      ? proofLine(cravings, belief, locale)
      : null;
  const proofText = proof?.grounded === true ? proof.text : undefined;

  function leaveWithoutWriting(): void {
    router.replace('/');
  }

  /**
   * The one write path. Called by Done (no argument) and by a conviction
   * anchor (with one); both end the flow, so both land on '/'.
   */
  async function finish(strength?: 0 | 1 | 2 | 3 | 4): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      if (!sessionWrittenRef.current) {
        await store.addFreedomSession({
          id: crypto.randomUUID(),
          startedAt: startedAtRef.current ?? toLocalIso(new Date()),
          endedAt: toLocalIso(new Date()),
          kind: 'brain',
          // Omitted entirely when the promise wasn't named — an absent
          // `beliefId` is the honest record of "I don't know".
          ...(belief !== null ? { beliefId: belief } : {}),
        });
        sessionWrittenRef.current = true;
      }

      if (strength !== undefined && belief !== null) {
        await store.addBeliefAssessment({
          id: crypto.randomUUID(),
          beliefId: belief,
          assessedAt: toLocalIso(new Date()),
          strength,
          context: 'brain',
        });
        showToast(m.common.noted);
      }

      // Deliberately no `setSaving(false)` on the way out: the screen is
      // leaving, and a re-enabled button in the meantime is a second write.
      router.replace('/');
    } catch (err) {
      console.error('Unsmoke: failed to save brain session', err);
      showToast(m.common.saveFailed);
      setSaving(false);
    }
  }

  return (
    <>
      {/* Calm, full-bleed backdrop for the whole route — sits behind the
          shell's padded column rather than inside it. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-gradient-to-b from-primary-soft to-canvas"
      />

      <div className="animate-fade-in flex min-h-[80dvh] flex-col">
        <div className="pt-2">
          <button
            type="button"
            onClick={leaveWithoutWriting}
            aria-label={m.brain.close}
            className="-ml-3 flex h-11 w-11 items-center justify-center rounded-full text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.92]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {phase === 'promise' ? (
          <PromiseStep
            beliefs={visibleBeliefs}
            hiddenCount={orderedBeliefs.length - visibleBeliefs.length}
            loading={data.status !== 'ready'}
            onShowAll={() => setShowAll(true)}
            onPick={(id) => {
              setBelief(id);
              setPhase('response');
            }}
            onSkipNaming={() => {
              setBelief(null);
              setPhase('response');
            }}
          />
        ) : (
          <ResponseStep
            belief={belief}
            line={line}
            proofText={proofText}
            saving={saving}
            onDone={() => void finish()}
            onConviction={(strength) => void finish(strength)}
          />
        )}
      </div>
    </>
  );
}

type PromiseStepProps = {
  beliefs: Belief[];
  hiddenCount: number;
  loading: boolean;
  onShowAll: () => void;
  onPick: (belief: Belief) => void;
  /** "I don't know" — picks nothing and moves on anyway. */
  onSkipNaming: () => void;
};

/**
 * Phase 1. The question, the promises in the user's own likely order, and a
 * way through for someone who can't name it. Six at a time: the point is to
 * recognise a sentence in a second, not to read a catalogue.
 */
function PromiseStep({
  beliefs,
  hiddenCount,
  loading,
  onShowAll,
  onPick,
  onSkipNaming,
}: PromiseStepProps) {
  const m = useMessages();
  return (
    <div className="flex flex-1 flex-col gap-5 pt-6">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight text-ink">
          {m.brain.promise.headline}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          {m.brain.promise.subheading}
        </p>
      </div>

      {loading ? (
        <div aria-hidden="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {beliefs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className="min-h-14 rounded-card border border-border bg-surface px-4 py-3 text-left text-[15px] leading-relaxed text-ink transition-transform duration-[var(--dur-press)] active:scale-[0.99]"
            >
              &ldquo;{BELIEF_META[id].promise}&rdquo;
            </button>
          ))}

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={onShowAll}
              className="min-h-11 self-start px-1 text-[14px] font-medium text-primary-strong"
            >
              {m.brain.promise.somethingElseItSays}
            </button>
          ) : null}
        </div>
      )}

      {loading ? null : (
        <button
          type="button"
          onClick={onSkipNaming}
          className="mt-auto min-h-11 self-start px-1 pt-6 text-left text-[15px] text-ink-muted"
        >
          {m.brain.promise.dontKnow}
        </button>
      )}
    </div>
  );
}

type ResponseStepProps = {
  belief: Belief | null;
  line: string;
  proofText?: string;
  saving: boolean;
  onDone: () => void;
  onConviction: (strength: 0 | 1 | 2 | 3 | 4) => void;
};

/**
 * Phases 2 and 3, on one screen. Splitting them would put a tap between the
 * answer and the way out for no gain: the response is short enough to read
 * with Done already in view, and the conviction row sits below Done exactly
 * as it does in `ExerciseSheet`, where it never gates leaving.
 */
function ResponseStep({
  belief,
  line,
  proofText,
  saving,
  onDone,
  onConviction,
}: ResponseStepProps) {
  const m = useMessages();
  return (
    <div className="animate-fade-in flex flex-1 flex-col gap-5 pt-6">
      {belief !== null ? (
        <p className="text-[13px] leading-relaxed text-ink-faint">
          {interpolate(m.brain.response.promiseLabel, { promise: BELIEF_META[belief].promise })}
        </p>
      ) : null}

      <p className="text-[19px] leading-relaxed text-ink">{line}</p>

      {proofText ? (
        <p className="rounded-card bg-primary-soft px-4 py-3 text-[15px] leading-relaxed text-ink">
          {proofText}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-4 pt-8">
        <Button fullWidth disabled={saving} onClick={onDone}>
          {m.brain.response.done}
        </Button>

        {belief !== null ? (
          <ConvictionRow
            disabled={saving}
            onSelect={onConviction}
            hint={m.brain.response.convictionHint}
          />
        ) : null}
      </div>
    </div>
  );
}

export default BrainFlow;
