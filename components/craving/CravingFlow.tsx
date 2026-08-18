'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Belief, CravingOutcome, CravingSession, Trigger } from '@/domain/types';
import type { InterventionKind } from '@/data/interventions';
import { cravingCounts } from '@/domain/stats/cravingStats';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { sweepAchievements } from '@/lib/services/achievementSweep';
import { buildCravingSession, withBelief, withTrigger } from '@/lib/services/cravingSession';
import { showToast } from '@/components/ui/Toast';
import { useMessages } from '@/lib/i18n';
import { toLocalIso } from '@/lib/utils/iso';
import { IntensityStep } from './IntensityStep';
import { InterrupterStep } from './InterrupterStep';
import { RecheckStep } from './RecheckStep';
import { CompletionScreen, type CompletionVariant } from './CompletionScreen';
import { SlipScreen } from './SlipScreen';
import { BreathingRunner } from './runners/BreathingRunner';
import { TimedRunner, type TimedRunnerKind } from './runners/TimedRunner';
import { ReasonsRunner } from './runners/ReasonsRunner';
import { ProofRunner } from './runners/ProofRunner';

type Phase = 'intensity' | 'chooser' | 'runner' | 'recheck' | 'complete' | 'slip';

const TIMED_KINDS: InterventionKind[] = ['urge-surf', 'delay', 'water', 'scene-change'];

/**
 * The craving session, end to end. This is the screen the whole app exists
 * for, so two properties are load-bearing above all others:
 *
 * 1. **Speed to help.** Two taps — an intensity, then Start — and something
 *    is happening. Every navigation below is applied to local state FIRST and
 *    persisted afterwards, so a slow IndexedDB write can never sit between
 *    the user and the next screen.
 * 2. **Nothing is lost.** The row is created the instant an intensity is
 *    tapped, and every subsequent step writes through. Whatever happens next
 *    — a phone call, a locked screen, a closed tab — the session is on disk,
 *    and `SessionRecovery` closes or resumes it later.
 */
export function CravingFlow() {
  const { data, store } = useAppData();
  const m = useMessages();
  const router = useRouter();
  const now = useNow(60_000);

  const [phase, setPhase] = useState<Phase>('intensity');
  const [session, setSession] = useState<CravingSession | null>(null);
  // Held locally until the intensity tap creates the row — nothing at all is
  // persisted before then.
  const [draftTrigger, setDraftTrigger] = useState<Trigger | undefined>(undefined);
  const [activeKind, setActiveKind] = useState<InterventionKind | null>(null);
  const [completionVariant, setCompletionVariant] = useState<CompletionVariant>('win');
  const [saving, setSaving] = useState(false);

  // Write-path mirrors of the two pieces of state a delayed callback could
  // otherwise read a stale copy of. Assigned only from event handlers (never
  // during render), always immediately before the matching setState — see
  // `commit` below for the full reasoning.
  const sessionRef = useRef<CravingSession | null>(null);
  const draftTriggerRef = useRef<Trigger | undefined>(undefined);

  const sessionId = session?.id ?? null;

  /** The store's list with our in-flight session's latest state folded in, so
   *  counts on the completion and slip screens are right on the first paint
   *  instead of ticking up a beat later when the write lands. */
  const mergedCravings = useMemo(() => {
    if (session === null) return data.cravings;
    return [...data.cravings.filter((c) => c.id !== session.id), session];
  }, [data.cravings, session]);

  /** History = everything except the session in progress. */
  const history = useMemo(
    () => data.cravings.filter((c) => c.id !== sessionId),
    [data.cravings, sessionId]
  );

  const reasons = useMemo(() => data.reasons.filter((r) => !r.archived), [data.reasons]);

  const sessionInterventionIds = session?.interventionIds;

  /**
   * Most-recently-used first. This session's own attempts come first, which
   * is what keeps the picker from re-offering the exercise the user just
   * finished when they come back for round two — no special-casing needed.
   */
  const recentInterventionIds = useMemo(() => {
    const ordered: string[] = [...(sessionInterventionIds ?? [])].reverse();
    const byRecency = [...history].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    for (const past of byRecency) {
      ordered.push(...[...(past.interventionIds ?? [])].reverse());
    }
    return [...new Set(ordered)];
  }, [sessionInterventionIds, history]);

  const passedCount = cravingCounts(mergedCravings).passedWithoutSmoking;

  /**
   * Commits a new version of the session: refs first (so the NEXT write reads
   * it, whatever React has rendered), then state, then persistence.
   *
   * The refs are the reason this exists. `IntensityScale` fires its `onSelect`
   * 250ms after the tap, and a trigger chip tapped inside that window
   * re-renders this component — so the callback that eventually runs is a
   * closure over the PREVIOUS render. Reading `session` / `draftTrigger` from
   * that closure would build a write out of stale data and, because
   * `updateCraving` is a whole-row put, silently erase the trigger the user
   * just chose. Every write path below therefore reads `sessionRef.current` /
   * `draftTriggerRef.current`, which are only ever assigned from event
   * handlers and so are always the latest committed values.
   */
  function commit(next: CravingSession): void {
    sessionRef.current = next;
    setSession(next);
    store.updateCraving(next).catch((error: unknown) => {
      // Mid-flow: log, but never interrupt the exercise with a toast. The
      // session is still open, so the finalizer closes it honestly later.
      console.error('Unsmoke: failed to update craving session', error);
    });
  }

  function handleStartSession(intensity: number): void {
    if (sessionRef.current !== null) return;
    const next = buildCravingSession({
      id: crypto.randomUUID(),
      startedAt: new Date(),
      initialIntensity: intensity,
      trigger: draftTriggerRef.current,
      quitAt: data.profile ? new Date(data.profile.quitAt) : null,
    });
    sessionRef.current = next;
    setSession(next);
    setPhase('chooser');
    store.addCraving(next).catch((error: unknown) => {
      console.error('Unsmoke: failed to create craving session', error);
    });
  }

  function handleTriggerChange(trigger: Trigger | undefined): void {
    const current = sessionRef.current;
    if (current === null) {
      draftTriggerRef.current = trigger;
      setDraftTrigger(trigger);
      return;
    }
    commit(withTrigger(current, trigger));
  }

  /**
   * Tags what the craving felt like it was promising. Only reachable from the
   * completion screen — i.e. after `handleOutcome` has already AWAITED the
   * terminal write — so the row being updated is a closed, saved session and
   * the fire-and-forget put is the right shape, exactly as it is for a trigger
   * edited on the way out.
   *
   * `sessionRef.current`, never `session`: the same stale-closure rule that
   * governs every other write here.
   *
   * This writes a tag on the craving and nothing else. Naming a promise is not
   * a claim about how strongly it is believed, so no `BeliefAssessment` is
   * recorded — that measurement belongs to the flows that actually ask for it.
   */
  function handleBeliefChange(beliefId: Belief | undefined): void {
    const current = sessionRef.current;
    if (current === null) return;
    commit(withBelief(current, beliefId));
  }

  function handleStartIntervention(kind: InterventionKind): void {
    const current = sessionRef.current;
    if (current === null) return;
    // 'proof' has nothing to say without a trigger. The picker's gate already
    // requires one, so this is unreachable — but a blank screen mid-craving
    // is the single worst thing this flow could do, so it cannot be one
    // refactor away either.
    const safeKind: InterventionKind =
      kind === 'proof' && current.trigger === undefined ? 'breathing' : kind;
    setActiveKind(safeKind);
    setPhase('runner');
    commit({
      ...current,
      interventionIds: [...(current.interventionIds ?? []), safeKind],
    });
  }

  function handleRecheckIntensity(intensity: number): void {
    const current = sessionRef.current;
    if (current === null) return;
    commit({ ...current, finalIntensity: intensity });
  }

  /**
   * Writes a terminal outcome and only then moves the user on. Unlike every
   * other step, this one waits: showing a completion screen for a session
   * that failed to save would be the app lying about the one number it exists
   * to keep. The write is a local IndexedDB put, so the wait is invisible in
   * the normal case, and the buttons disable while it is in flight.
   */
  async function handleOutcome(
    outcome: CravingOutcome,
    variant: CompletionVariant
  ): Promise<void> {
    const current = sessionRef.current;
    if (current === null || saving) return;
    setSaving(true);
    const next: CravingSession = {
      ...current,
      outcome,
      endedAt: toLocalIso(new Date()),
    };
    try {
      await store.updateCraving(next);
    } catch (error) {
      console.error('Unsmoke: failed to save craving outcome', error);
      showToast(m.common.saveFailed);
      setSaving(false);
      // Local state is deliberately untouched: the session stays open and the
      // user stays on the re-check step with their answer still on screen.
      return;
    }
    sessionRef.current = next;
    setSession(next);
    setCompletionVariant(variant);
    setPhase(outcome === 'smoked' ? 'slip' : 'complete');
    setSaving(false);
    // Achievements are a bonus on top of a write that already succeeded —
    // never a reason to hold up or fail the completion screen.
    sweepAchievements(store).catch((error: unknown) => {
      console.error('Unsmoke: failed to sweep achievements', error);
    });
  }

  function handleTryAnother(): void {
    const current = sessionRef.current;
    if (current === null) return;
    const next: CravingSession = { ...current, roundCount: (current.roundCount ?? 1) + 1 };
    // Round two gets a genuinely fresh measurement — carrying the previous
    // round's number forward would both pre-answer the question and leave a
    // stale `finalIntensity` on disk if the session were abandoned here.
    delete next.finalIntensity;
    commit(next);
    setActiveKind(null);
    setPhase('chooser');
  }

  function handleDone(): void {
    router.replace('/');
  }

  function renderRunner() {
    if (session === null || activeKind === null) return null;

    const onBack = () => setPhase('chooser');
    const onSkip = () => setPhase('recheck');
    const onComplete = () => setPhase('recheck');

    if (activeKind === 'breathing') {
      return <BreathingRunner onComplete={onComplete} onBack={onBack} onSkip={onSkip} />;
    }
    if (activeKind === 'reasons') {
      return (
        <ReasonsRunner
          reasons={reasons}
          onComplete={onComplete}
          onBack={onBack}
          onSkip={onSkip}
        />
      );
    }
    if (activeKind === 'proof' && session.trigger !== undefined) {
      return (
        <ProofRunner
          trigger={session.trigger}
          sessions={history}
          onComplete={onComplete}
          onBack={onBack}
          onSkip={onSkip}
        />
      );
    }
    if (TIMED_KINDS.includes(activeKind)) {
      return (
        <TimedRunner
          kind={activeKind as TimedRunnerKind}
          sessionId={session.id}
          onComplete={onComplete}
          onBack={onBack}
          onSkip={onSkip}
        />
      );
    }
    return null;
  }

  return (
    <>
      {/* Calm, full-bleed backdrop for the whole route — sits behind the
          shell's padded column rather than inside it. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-gradient-to-b from-primary-soft to-canvas"
      />

      {phase === 'intensity' ? (
        <IntensityStep
          trigger={draftTrigger}
          onTriggerChange={handleTriggerChange}
          onSelectIntensity={handleStartSession}
        />
      ) : null}

      {phase === 'chooser' && session !== null ? (
        <InterrupterStep
          intensity={session.initialIntensity}
          trigger={session.trigger}
          sessions={history}
          reasonsCount={reasons.length}
          recentInterventionIds={recentInterventionIds}
          roundCount={session.roundCount ?? 1}
          onStart={handleStartIntervention}
        />
      ) : null}

      {phase === 'runner' ? renderRunner() : null}

      {phase === 'recheck' && session !== null ? (
        <RecheckStep
          initialIntensity={session.initialIntensity}
          finalIntensity={session.finalIntensity}
          trigger={session.trigger}
          interventionsRun={session.interventionIds?.length ?? 0}
          busy={saving}
          onTriggerChange={handleTriggerChange}
          onSelectIntensity={handleRecheckIntensity}
          onPassed={() => void handleOutcome('passed', 'win')}
          onMuchWeaker={() => void handleOutcome('much-weaker', 'win')}
          onSmoked={() => void handleOutcome('smoked', 'win')}
          onTryAnother={handleTryAnother}
          onLogStillThere={() => void handleOutcome('still-there', 'logged')}
        />
      ) : null}

      {phase === 'complete' && session !== null ? (
        <CompletionScreen
          variant={completionVariant}
          initialIntensity={session.initialIntensity}
          finalIntensity={session.finalIntensity}
          passedCount={passedCount}
          trigger={session.trigger}
          beliefId={session.beliefId}
          onBeliefChange={handleBeliefChange}
          onDone={handleDone}
        />
      ) : null}

      {phase === 'slip' && session !== null && data.profile !== null ? (
        <SlipScreen
          profile={data.profile}
          cravings={mergedCravings}
          now={now}
          trigger={session.trigger}
          onTriggerChange={handleTriggerChange}
          onDone={handleDone}
        />
      ) : null}
    </>
  );
}

export default CravingFlow;
