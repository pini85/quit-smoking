'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CravingOutcome, CravingSession, Trigger } from '@/domain/types';
import type { InterventionKind } from '@/data/interventions';
import { cravingCounts } from '@/domain/stats/cravingStats';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { sweepAchievements } from '@/lib/services/achievementSweep';
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

/** Strips a cleared trigger's key entirely rather than storing `undefined`. */
function withTrigger(session: CravingSession, trigger: Trigger | undefined): CravingSession {
  const next = { ...session };
  if (trigger === undefined) {
    delete next.trigger;
  } else {
    next.trigger = trigger;
  }
  return next;
}

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
  const router = useRouter();
  const now = useNow(60_000);

  const [phase, setPhase] = useState<Phase>('intensity');
  const [session, setSession] = useState<CravingSession | null>(null);
  // Held locally until the intensity tap creates the row — nothing at all is
  // persisted before then.
  const [draftTrigger, setDraftTrigger] = useState<Trigger | undefined>(undefined);
  const [activeKind, setActiveKind] = useState<InterventionKind | null>(null);
  const [completionVariant, setCompletionVariant] = useState<CompletionVariant>('win');

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

  function persist(next: CravingSession): void {
    setSession(next);
    void store.updateCraving(next);
  }

  function handleStartSession(intensity: number): void {
    const startedAt = new Date();
    const quitAt = data.profile ? new Date(data.profile.quitAt).getTime() : 0;
    const next: CravingSession = {
      id: crypto.randomUUID(),
      startedAt: toLocalIso(startedAt),
      initialIntensity: intensity,
      outcome: null,
      preQuit: quitAt > startedAt.getTime(),
      ...(draftTrigger === undefined ? {} : { trigger: draftTrigger }),
    };
    setSession(next);
    setPhase('chooser');
    void store.addCraving(next);
  }

  function handleTriggerChange(trigger: Trigger | undefined): void {
    if (session === null) {
      setDraftTrigger(trigger);
      return;
    }
    persist(withTrigger(session, trigger));
  }

  function handleStartIntervention(kind: InterventionKind): void {
    if (session === null) return;
    // 'proof' has nothing to say without a trigger. The picker's gate already
    // requires one, so this is unreachable — but a blank screen mid-craving
    // is the single worst thing this flow could do, so it cannot be one
    // refactor away either.
    const safeKind: InterventionKind =
      kind === 'proof' && session.trigger === undefined ? 'breathing' : kind;
    setActiveKind(safeKind);
    setPhase('runner');
    persist({
      ...session,
      interventionIds: [...(session.interventionIds ?? []), safeKind],
    });
  }

  function handleRecheckIntensity(intensity: number): void {
    if (session === null) return;
    persist({ ...session, finalIntensity: intensity });
  }

  /** Writes a terminal outcome, then re-checks every achievement. */
  async function resolve(outcome: CravingOutcome): Promise<void> {
    if (session === null) return;
    const next: CravingSession = {
      ...session,
      outcome,
      endedAt: toLocalIso(new Date()),
    };
    setSession(next);
    await store.updateCraving(next);
    await sweepAchievements(store);
  }

  function handleOutcome(outcome: CravingOutcome, variant: CompletionVariant): void {
    // Screen first, write second — the user should never watch a spinner to
    // find out that their craving passed.
    setCompletionVariant(variant);
    setPhase(outcome === 'smoked' ? 'slip' : 'complete');
    void resolve(outcome);
  }

  function handleTryAnother(): void {
    if (session === null) return;
    const next: CravingSession = { ...session, roundCount: (session.roundCount ?? 1) + 1 };
    // Round two gets a genuinely fresh measurement — carrying the previous
    // round's number forward would both pre-answer the question and leave a
    // stale `finalIntensity` on disk if the session were abandoned here.
    delete next.finalIntensity;
    persist(next);
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
          roundCount={session.roundCount ?? 1}
          onTriggerChange={handleTriggerChange}
          onSelectIntensity={handleRecheckIntensity}
          onPassed={() => handleOutcome('passed', 'win')}
          onMuchWeaker={() => handleOutcome('much-weaker', 'win')}
          onSmoked={() => handleOutcome('smoked', 'win')}
          onTryAnother={handleTryAnother}
          onLogStillThere={() => handleOutcome('still-there', 'logged')}
        />
      ) : null}

      {phase === 'complete' && session !== null ? (
        <CompletionScreen
          variant={completionVariant}
          initialIntensity={session.initialIntensity}
          finalIntensity={session.finalIntensity}
          passedCount={passedCount}
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
