'use client';

/**
 * A sine that slides sideways forever while getting flatter — the shape of
 * the claim the screen is making ("it crests, then it recedes"). It is drawn
 * two periods wide and translated by exactly one, so the loop is seamless.
 *
 * Purely decorative: `aria-hidden`, and under reduced motion it neither
 * slides nor changes height.
 */
export function UrgeWave({ progress, reducedMotion }: { progress: number; reducedMotion: boolean }) {
  const clamped = Math.min(1, Math.max(0, progress));
  // Ends at 15% of the starting amplitude: flatter, never flat — the craving
  // fades, and pretending it hits exactly zero on a timer would be a lie.
  const amplitude = reducedMotion ? 0.6 : 1 - clamped * 0.85;

  return (
    <svg
      viewBox="0 0 200 80"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 h-full w-full text-primary opacity-25"
    >
      <g
        className="craving-wave-amplitude"
        style={{ transform: `scaleY(${amplitude})`, transformOrigin: '100px 40px' }}
      >
        <g className={reducedMotion ? undefined : 'animate-craving-wave'}>
          <path
            d="M0 40 q 12.5 -18 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
    </svg>
  );
}

export default UrgeWave;
