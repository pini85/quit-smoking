import { describe, expect, it } from 'vitest';
import type { CravingSession, MoneyEquivalent, QuitProfile } from '@/domain/types';
import {
  smokeFreeDuration,
  currentStreakStart,
  cigarettesAvoided,
  packsAvoided,
  moneySaved,
  MINUTES_OF_LIFE_PER_CIGARETTE,
  lifeRegained,
  timeSaved,
  moneyEquivalentsFor,
  recoveryStage,
  RECOVERY_STAGE_LABELS,
} from '@/domain/stats/quitStats';

let idCounter = 0;
function mkSession(overrides: Partial<CravingSession> = {}): CravingSession {
  idCounter += 1;
  return {
    id: `session-${idCounter}`,
    startedAt: '2026-01-01T12:00:00Z',
    initialIntensity: 5,
    outcome: 'passed',
    ...overrides,
  };
}

function mkProfile(overrides: Partial<QuitProfile> = {}): QuitProfile {
  return {
    id: 'singleton',
    quitAt: '2026-01-01T00:00:00Z',
    cigarettesPerDay: 20,
    cigarettesPerPack: 20,
    packPrice: 10,
    currency: 'EUR',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('smokeFreeDuration', () => {
  it('returns the elapsed duration since quitAt', () => {
    const quitAt = new Date(2026, 0, 1, 0, 0, 0);
    const now = new Date(2026, 0, 2, 3, 0, 0);
    const d = smokeFreeDuration(quitAt, now);
    expect(d).toEqual({ totalMs: 27 * 3_600_000, days: 1, hours: 3, minutes: 0, seconds: 0 });
  });

  it('clamps to zero when now is before quitAt', () => {
    const quitAt = new Date(2026, 0, 2, 0, 0, 0);
    const now = new Date(2026, 0, 1, 0, 0, 0);
    expect(smokeFreeDuration(quitAt, now)).toEqual({
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});

describe('currentStreakStart', () => {
  const quitAt = new Date(2026, 0, 1, 0, 0, 0);

  it('returns quitAt when there are no cravings', () => {
    expect(currentStreakStart(quitAt, [])).toEqual(quitAt);
  });

  it('returns quitAt when no session has outcome smoked', () => {
    const sessions = [mkSession({ outcome: 'passed', startedAt: '2026-01-05T00:00:00Z' })];
    expect(currentStreakStart(quitAt, sessions)).toEqual(quitAt);
  });

  it('uses endedAt of a smoked session when later than quitAt', () => {
    const smokedAt = '2026-01-03T10:00:00Z';
    const sessions = [
      mkSession({ outcome: 'smoked', startedAt: '2026-01-03T09:30:00Z', endedAt: smokedAt }),
    ];
    expect(currentStreakStart(quitAt, sessions)).toEqual(new Date(smokedAt));
  });

  it('falls back to startedAt when a smoked session has no endedAt', () => {
    const startedAt = '2026-01-03T09:30:00Z';
    const sessions = [mkSession({ outcome: 'smoked', startedAt, endedAt: undefined })];
    expect(currentStreakStart(quitAt, sessions)).toEqual(new Date(startedAt));
  });

  it('ignores preQuit smoked sessions entirely', () => {
    const sessions = [
      mkSession({
        outcome: 'smoked',
        startedAt: '2026-01-03T09:30:00Z',
        endedAt: '2026-01-03T10:00:00Z',
        preQuit: true,
      }),
    ];
    expect(currentStreakStart(quitAt, sessions)).toEqual(quitAt);
  });

  it('picks the LATEST of multiple smoked sessions', () => {
    const sessions = [
      mkSession({ outcome: 'smoked', startedAt: '2026-01-02T00:00:00Z', endedAt: '2026-01-02T00:10:00Z' }),
      mkSession({ outcome: 'smoked', startedAt: '2026-01-05T00:00:00Z', endedAt: '2026-01-05T00:10:00Z' }),
      mkSession({ outcome: 'smoked', startedAt: '2026-01-03T00:00:00Z', endedAt: '2026-01-03T00:10:00Z' }),
    ];
    expect(currentStreakStart(quitAt, sessions)).toEqual(new Date('2026-01-05T00:10:00Z'));
  });
});

describe('cigarettesAvoided', () => {
  it('floors cigarettesPerDay times fractional days (12h at 20/day -> 10)', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const profile = mkProfile({ quitAt: '2026-01-01T00:00:00Z', cigarettesPerDay: 20 });
    expect(cigarettesAvoided(profile, now)).toBe(10);
  });

  it('floors a non-exact fractional-day result', () => {
    // 23 hours at 15/day => 15 * 23/24 = 14.375 -> floor 14
    const now = new Date('2026-01-01T23:00:00Z');
    const profile = mkProfile({ quitAt: '2026-01-01T00:00:00Z', cigarettesPerDay: 15 });
    expect(cigarettesAvoided(profile, now)).toBe(14);
  });

  it('clamps to zero when now is before quitAt', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const profile = mkProfile({ quitAt: '2026-01-02T00:00:00Z' });
    expect(cigarettesAvoided(profile, now)).toBe(0);
  });
});

describe('packsAvoided', () => {
  it('divides avoided cigarettes by pack size, 1 decimal', () => {
    // 18h at 20/day => avoided = floor(15) = 15; 15/20 = 0.75 -> 0.8
    const now = new Date('2026-01-01T18:00:00Z');
    const profile = mkProfile({ quitAt: '2026-01-01T00:00:00Z', cigarettesPerDay: 20, cigarettesPerPack: 20 });
    expect(packsAvoided(profile, now)).toBe(0.8);
  });

  it('returns 0 rather than NaN/Infinity when cigarettesPerPack is 0', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const profile = mkProfile({ cigarettesPerPack: 0 });
    expect(packsAvoided(profile, now)).toBe(0);
    expect(Number.isNaN(packsAvoided(profile, now))).toBe(false);
  });
});

describe('moneySaved', () => {
  it('computes (perDay/perPack) * packPrice * fractional days, rounded to 2 decimals', () => {
    const now = new Date('2026-01-01T12:00:00Z'); // 0.5 days
    const profile = mkProfile({
      quitAt: '2026-01-01T00:00:00Z',
      cigarettesPerDay: 20,
      cigarettesPerPack: 20,
      packPrice: 10,
    });
    expect(moneySaved(profile, now)).toBe(5);
  });

  it('rounds to 2 decimals for a non-exact result', () => {
    const now = new Date('2026-01-01T08:00:00Z'); // 1/3 day
    const profile = mkProfile({
      quitAt: '2026-01-01T00:00:00Z',
      cigarettesPerDay: 20,
      cigarettesPerPack: 20,
      packPrice: 9,
    });
    // (20/20) * 9 * (1/3) = 3.00
    expect(moneySaved(profile, now)).toBe(3);
  });

  it('returns 0 (never NaN) when cigarettesPerPack is 0', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const profile = mkProfile({ cigarettesPerPack: 0 });
    expect(moneySaved(profile, now)).toBe(0);
  });

  it('clamps to zero when now is before quitAt', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const profile = mkProfile({ quitAt: '2026-01-02T00:00:00Z' });
    expect(moneySaved(profile, now)).toBe(0);
  });
});

describe('MINUTES_OF_LIFE_PER_CIGARETTE', () => {
  it('is the UCL 2024 estimate of 20 minutes', () => {
    expect(MINUTES_OF_LIFE_PER_CIGARETTE).toBe(20);
  });
});

describe('lifeRegained', () => {
  it('converts avoided cigarette count into a Duration at 20 min/cigarette', () => {
    const d = lifeRegained(3); // 60 minutes
    expect(d).toEqual({ totalMs: 3_600_000, days: 0, hours: 1, minutes: 0, seconds: 0 });
  });

  it('returns a zero Duration for zero avoided cigarettes (no NaN)', () => {
    expect(lifeRegained(0)).toEqual({ totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('timeSaved', () => {
  it('defaults to 6 minutes per cigarette', () => {
    const d = timeSaved(10); // 60 minutes
    expect(d).toEqual({ totalMs: 3_600_000, days: 0, hours: 1, minutes: 0, seconds: 0 });
  });

  it('honors a custom minutesPerCigarette', () => {
    const d = timeSaved(12, 5); // 60 minutes
    expect(d).toEqual({ totalMs: 3_600_000, days: 0, hours: 1, minutes: 0, seconds: 0 });
  });
});

describe('moneyEquivalentsFor', () => {
  const eq: MoneyEquivalent[] = [
    { label: 'Coffee', unitPrice: 5 },
    { label: 'Movie ticket', unitPrice: 12 },
    { label: 'Yacht', unitPrice: 100_000 },
  ];

  it('computes floor(saved/unitPrice), drops zero-count entries, sorts by count desc', () => {
    expect(moneyEquivalentsFor(50, eq)).toEqual([
      { label: 'Coffee', count: 10 },
      { label: 'Movie ticket', count: 4 },
    ]);
  });

  it('returns [] for undefined equivalents', () => {
    expect(moneyEquivalentsFor(50, undefined)).toEqual([]);
  });

  it('returns [] for an empty equivalents list', () => {
    expect(moneyEquivalentsFor(50, [])).toEqual([]);
  });

  it('never divides by a zero/negative unitPrice (no NaN/Infinity)', () => {
    const withZero: MoneyEquivalent[] = [{ label: 'Free thing', unitPrice: 0 }];
    expect(moneyEquivalentsFor(50, withZero)).toEqual([]);
  });
});

describe('recoveryStage', () => {
  const quitAt = new Date('2026-01-01T00:00:00.000Z');
  const at = (hours: number) => new Date(quitAt.getTime() + hours * 3_600_000);

  it('< 24h is first-hours', () => {
    expect(recoveryStage(quitAt, at(23.99))).toBe('first-hours');
  });

  it('boundary: exactly 24h moves into first-days', () => {
    expect(recoveryStage(quitAt, at(24))).toBe('first-days');
  });

  it('< 48h is still first-days', () => {
    expect(recoveryStage(quitAt, at(47.99))).toBe('first-days');
  });

  it('boundary: exactly 48h moves into withdrawal-peak', () => {
    expect(recoveryStage(quitAt, at(48))).toBe('withdrawal-peak');
  });

  it('< 96h is still withdrawal-peak', () => {
    expect(recoveryStage(quitAt, at(95.99))).toBe('withdrawal-peak');
  });

  it('boundary: exactly 96h moves into early-recovery', () => {
    expect(recoveryStage(quitAt, at(96))).toBe('early-recovery');
  });

  it('boundary: just below 1 month (730h) is still early-recovery', () => {
    expect(recoveryStage(quitAt, at(729.99))).toBe('early-recovery');
  });

  it('boundary: exactly 1 month (730h) moves into consolidation', () => {
    expect(recoveryStage(quitAt, at(730))).toBe('consolidation');
  });

  it('boundary: just below 3 months (2190h) is still consolidation', () => {
    expect(recoveryStage(quitAt, at(2190 - 0.01))).toBe('consolidation');
  });

  it('boundary: exactly 3 months (2190h) moves into established', () => {
    expect(recoveryStage(quitAt, at(2190))).toBe('established');
  });

  it('boundary: just below 1 year (8766h) is still established', () => {
    expect(recoveryStage(quitAt, at(8766 - 0.01))).toBe('established');
  });

  it('boundary: exactly 1 year (8766h) moves into free', () => {
    expect(recoveryStage(quitAt, at(8766))).toBe('free');
  });
});

describe('RECOVERY_STAGE_LABELS', () => {
  it('has a human label for every stage', () => {
    expect(RECOVERY_STAGE_LABELS).toEqual({
      'first-hours': 'First hours',
      'first-days': 'First days',
      'withdrawal-peak': 'Withdrawal peak',
      'early-recovery': 'Early recovery',
      consolidation: 'Consolidation',
      established: 'Established',
      free: 'Free',
    });
  });
});
