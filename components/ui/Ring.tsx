'use client';

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';

export type RingMode = 'countdown' | 'breathing';

export type RingBreathing = {
  inhaleMs: number;
  exhaleMs: number;
  running: boolean;
};

export type RingProps = {
  size?: number;
  stroke?: number;
  /** 0–1, countdown mode. Clamped; animates over `--dur-ring`. */
  progress?: number;
  mode: RingMode;
  breathing?: RingBreathing;
  children?: ReactNode;
  className?: string;
};

const DEFAULT_INHALE_MS = 4000;
const DEFAULT_EXHALE_MS = 6000;

/**
 * The signature element of the app: one calm circle that either drains
 * (countdown) or breathes (breathing).
 *
 * Breathing is driven by a phase timer rather than a single CSS keyframe
 * because inhale and exhale have *different* durations — a keyframe split
 * cannot be parameterised at runtime, but a transition duration can. Under
 * `prefers-reduced-motion` the `--ring-breathe-scale` token collapses to 1
 * and the transitions are removed in `globals.css`, so the timer keeps
 * ticking (phases still drive any consumer's copy) while the ring sits
 * perfectly still.
 */
export function Ring({
  size = 220,
  stroke = 12,
  progress = 0,
  mode,
  breathing,
  children,
  className,
}: RingProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  const inhaleMs = breathing?.inhaleMs ?? DEFAULT_INHALE_MS;
  const exhaleMs = breathing?.exhaleMs ?? DEFAULT_EXHALE_MS;
  const running = mode === 'breathing' && (breathing?.running ?? false);

  const [phase, setPhase] = useState<'inhale' | 'exhale'>('exhale');

  // The countdown arc draws itself in on mount: the first paint (and the
  // prerendered HTML) shows an empty track, then the real progress lands one
  // commit later so the CSS transition has something to animate from.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!running) {
      setPhase('exhale');
      return;
    }

    let current: 'inhale' | 'exhale' = 'inhale';
    setPhase(current);

    let timer = setTimeout(function next() {
      current = current === 'inhale' ? 'exhale' : 'inhale';
      setPhase(current);
      timer = setTimeout(next, current === 'inhale' ? inhaleMs : exhaleMs);
    }, inhaleMs);

    return () => clearTimeout(timer);
  }, [running, inhaleMs, exhaleMs]);

  const radius = Math.max(1, (size - stroke) / 2);
  const circumference = 2 * Math.PI * radius;
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const dashOffset =
    mode === 'countdown' ? circumference * (1 - (mounted ? clamped : 0)) : 0;

  const center = size / 2;
  const inhaling = phase === 'inhale';

  // `--ring-phase-duration` feeds the `.ring-breathe-scale` transition in
  // globals.css, so inhale and exhale can take different amounts of time.
  const breatheStyle =
    mode === 'breathing'
      ? ({
          transform: inhaling ? 'scale(var(--ring-breathe-scale))' : 'scale(1)',
          '--ring-phase-duration': `${inhaling ? inhaleMs : exhaleMs}ms`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={`relative shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <div
        className={
          mode === 'breathing' ? 'ring-breathe-scale absolute inset-0' : 'absolute inset-0'
        }
        style={breatheStyle}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
          className="overflow-visible"
        >
          {mode === 'breathing' ? (
            <>
              <defs>
                <filter
                  id={`ring-glow-${uid}`}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation={stroke} />
                </filter>
              </defs>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={stroke * 1.5}
                className="stroke-primary opacity-30"
                filter={`url(#ring-glow-${uid})`}
              />
            </>
          ) : null}

          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-ring-track"
          />

          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
            className={
              mode === 'countdown'
                ? 'ring-progress-arc stroke-primary'
                : 'stroke-primary'
            }
          />
        </svg>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

export default Ring;
