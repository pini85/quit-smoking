'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Belief, BeliefAssessment, CravingSession } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import { BELIEF_META } from '@/data/beliefs';
import { FREEDOM_LESSONS } from '@/data/freedomLessons';
import { rankExercises } from '@/domain/freedom/lessonPicker';
import { toLocalIso } from '@/lib/utils/iso';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { showToast } from '@/components/ui/Toast';

export type ExerciseSheetProps = {
  /** `null` closes the sheet — one nullable piece of state for the caller. */
  beliefId: Belief | null;
  assessments: BeliefAssessment[];
  cravings: CravingSession[];
  store: DataStore;
  onClose: () => void;
};

/**
 * The five word anchors for the optional conviction question. Words, never
 * numbers: the reader is asked how a sentence sounds to them right now, and a
 * 0–4 scale would invite them to read it as a score of themselves. The
 * `strength` each one maps to is stored, never shown — here or anywhere.
 */
const ANCHORS: { strength: 0 | 1 | 2 | 3 | 4; label: string }[] = [
  { strength: 4, label: 'Still feels true' },
  { strength: 3, label: 'Mostly true' },
  { strength: 2, label: 'Starting to crack' },
  { strength: 1, label: 'Mostly seen through' },
  { strength: 0, label: 'Seen through' },
];

/**
 * One exercise, for one promise: the moment to catch, the question to put to
 * it, and what turns out to be true — in the Notice → Question → Reframe order
 * the exercises are written in.
 *
 * Persistence contract:
 *
 * - Either way out through the sheet's own actions writes exactly ONE
 *   `FreedomSession` (never two): "Done" writes it, and so does tapping a
 *   conviction anchor, because that tap is itself the end of the exercise —
 *   pressing Done first closes the sheet, so the two paths are mutually
 *   exclusive. `saving` guards a double tap.
 * - Abandoning the sheet (X, Escape, Android back) writes NOTHING, per the
 *   write-once contract on `FreedomSession` in `domain/types.ts`.
 * - `startedAt` is captured when the sheet opens, not when Done is pressed, so
 *   the row records how long the read actually took.
 *
 * The conviction row sits BELOW Done and never gates it (the `TriggerChips`
 * doctrine): the exercise is complete without it, and skipping it is just
 * closing the sheet.
 */
export function ExerciseSheet({
  beliefId,
  assessments,
  cravings,
  store,
  onClose,
}: ExerciseSheetProps) {
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (beliefId !== null) startedAtRef.current = toLocalIso(new Date());
  }, [beliefId]);

  const lesson = useMemo(() => {
    if (beliefId === null) return null;

    // Exercises that name this belief, best-first for this user's own data.
    const forBelief = FREEDOM_LESSONS.filter(
      (l) => l.kind === 'exercise' && l.beliefIds.includes(beliefId)
    );
    const ranked = rankExercises(forBelief, assessments, cravings, 1);
    if (ranked.length > 0) return ranked[0];

    // A few beliefs are covered by a booster rather than a dedicated exercise
    // (the catalog invariant is coverage by SOME lesson, not by an exercise),
    // so fall back to any lesson that takes this promise apart.
    return FREEDOM_LESSONS.find((l) => l.beliefIds.includes(beliefId)) ?? null;
  }, [beliefId, assessments, cravings]);

  async function finish(strength?: 0 | 1 | 2 | 3 | 4) {
    if (beliefId === null || lesson === null || saving) return;
    setSaving(true);
    try {
      await store.addFreedomSession({
        id: crypto.randomUUID(),
        startedAt: startedAtRef.current ?? toLocalIso(new Date()),
        endedAt: toLocalIso(new Date()),
        kind: 'exercise',
        beliefId,
        lessonId: lesson.id,
      });

      if (strength !== undefined) {
        await store.addBeliefAssessment({
          id: crypto.randomUUID(),
          beliefId,
          assessedAt: toLocalIso(new Date()),
          strength,
          context: 'exercise',
        });
        showToast('Noted.');
      }

      onClose();
    } catch (err) {
      console.error('Unsmoke: failed to save freedom session', err);
      showToast("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={beliefId !== null} onClose={onClose} title={lesson?.title}>
      {beliefId !== null && lesson !== null ? (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[13px] leading-relaxed text-ink-faint">
            The promise: &ldquo;{BELIEF_META[beliefId].promise}&rdquo;
          </p>

          {lesson.notice ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
                {lesson.kind === 'exercise' ? 'The moment to catch' : 'Worth noticing'}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{lesson.notice}</p>
            </div>
          ) : null}

          {lesson.reflect ? (
            <p className="rounded-card bg-primary-soft px-4 py-3 text-[15px] leading-relaxed text-ink">
              {lesson.reflect}
            </p>
          ) : null}

          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              {lesson.kind === 'exercise' ? 'What turns out to be true' : 'The idea'}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{lesson.idea}</p>
          </div>

          <SourceBadge kind={lesson.sourceKind} className="self-start" />

          <Button fullWidth disabled={saving} onClick={() => void finish()}>
            Done
          </Button>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-[13px] text-ink-muted">
              How convincing does it feel right now?
            </p>
            <div className="flex flex-wrap gap-2">
              {ANCHORS.map((anchor) => (
                <Chip
                  key={anchor.strength}
                  size="sm"
                  disabled={saving}
                  onClick={() => void finish(anchor.strength)}
                >
                  {anchor.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

export default ExerciseSheet;
