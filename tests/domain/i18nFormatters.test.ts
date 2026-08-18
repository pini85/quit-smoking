import { describe, expect, it } from 'vitest';
import type { CravingSession } from '@/domain/types';
import { formatCount } from '@/domain/i18n/units';
import { formatSmokeFreeDuration } from '@/domain/time';
import { fmt, timingPhrase } from '@/components/health/timingPhrase';
import { humanizeEta } from '@/components/home/humanizeEta';
import { recoveryStageLabel, RECOVERY_STAGE_LABELS } from '@/domain/stats/quitStats';
import { proofLine } from '@/domain/freedom/evidence';
import { INSIGHT_RULES } from '@/domain/stats/insights';

const HOUR = 3_600_000;
const DAY = 86_400_000;

// Finnish counts use the partitive after any numeral other than 1 — a real
// per-locale form table, not an English "+s" flag.
describe('formatCount', () => {
  it('English singular/plural', () => {
    expect(formatCount(1, 'minute', 'en')).toBe('1 minute');
    expect(formatCount(2, 'minute', 'en')).toBe('2 minutes');
    expect(formatCount(0, 'week', 'en')).toBe('0 weeks');
  });

  it('Finnish nominative at exactly 1, partitive otherwise', () => {
    expect(formatCount(1, 'week', 'fi')).toBe('1 viikko');
    expect(formatCount(3, 'week', 'fi')).toBe('3 viikkoa');
    expect(formatCount(0, 'minute', 'fi')).toBe('0 minuuttia');
    expect(formatCount(1, 'month', 'fi')).toBe('1 kuukausi');
    expect(formatCount(5, 'year', 'fi')).toBe('5 vuotta');
  });
});

describe('formatSmokeFreeDuration — Finnish', () => {
  const quit = new Date('2026-01-01T00:00:00Z');
  const at = (ms: number) => new Date(quit.getTime() + ms);

  it('minutes band uses the partitive', () => {
    expect(formatSmokeFreeDuration(quit, at(30 * 60_000), 'fi').primary).toBe('30 minuuttia');
  });

  it('compact hour band uses Finnish abbreviations with spaces', () => {
    expect(formatSmokeFreeDuration(quit, at(3 * HOUR + 12 * 60_000), 'fi').primary).toBe(
      '3 t 12 min'
    );
  });

  it('compact day band', () => {
    expect(
      formatSmokeFreeDuration(quit, at(2 * DAY + 3 * HOUR + 5 * 60_000), 'fi').primary
    ).toBe('2 pv 3 t 5 min');
  });

  it('weeks band: full-word primary, compact secondary', () => {
    const result = formatSmokeFreeDuration(quit, at(10 * DAY + 3 * HOUR), 'fi');
    expect(result.primary).toBe('1 viikko, 3 päivää');
    expect(result.secondary).toBe('10 pv 3 t');
  });

  it('English output is unchanged when no locale is passed (regression guard)', () => {
    const result = formatSmokeFreeDuration(quit, at(10 * DAY + 3 * HOUR));
    expect(result.primary).toBe('1 week, 3 days');
    expect(result.secondary).toBe('10d 3h');
  });
});

describe('timingPhrase — Finnish', () => {
  it('fmt uses Finnish unit forms', () => {
    expect(fmt(0.5, 'fi')).toBe('30 minuuttia');
    expect(fmt(2, 'fi')).toBe('2 tuntia');
    expect(fmt(168, 'fi')).toBe('7 päivää');
  });

  it('window phrasing', () => {
    expect(timingPhrase({ kind: 'window', earliestHours: 0.5, typicalUntilHours: 2 }, 'fi')).toBe(
      'tyypillisesti 30 minuuttia–2 tuntia lopettamisen jälkeen'
    );
  });

  it('point phrasing', () => {
    expect(timingPhrase({ kind: 'point', earliestHours: 168 }, 'fi')).toBe(
      'noin 7 päivää lopettamisen jälkeen'
    );
  });

  it('open-ended phrasing uses the elative ("2 viikosta eteenpäin")', () => {
    expect(timingPhrase({ kind: 'openEnded', earliestHours: 336 }, 'fi')).toBe(
      '2 viikosta eteenpäin — ja jatkuu'
    );
  });

  it('noTimeline stays verbatim in every locale — the phrase travels with the dataset', () => {
    const t = { kind: 'noTimeline', phrase: 'varies from person to person' } as const;
    expect(timingPhrase(t, 'fi')).toBe('varies from person to person');
    expect(timingPhrase(t)).toBe('varies from person to person');
  });
});

describe('humanizeEta — Finnish', () => {
  it('under an hour', () => {
    expect(humanizeEta(0, 'fi')).toBe('alle tunnin kuluttua');
  });

  it('hours use the genitive ("3 tunnin kuluttua")', () => {
    expect(humanizeEta(3.4 * HOUR, 'fi')).toBe('noin 3 tunnin kuluttua');
    expect(humanizeEta(HOUR, 'fi')).toBe('noin 1 tunnin kuluttua');
  });

  it('days use the genitive ("10 päivän kuluttua")', () => {
    expect(humanizeEta(9.6 * DAY, 'fi')).toBe('noin 10 päivän kuluttua');
  });
});

describe('recoveryStageLabel', () => {
  it('English matches the existing label table exactly', () => {
    expect(recoveryStageLabel('first-hours')).toBe(RECOVERY_STAGE_LABELS['first-hours']);
    expect(recoveryStageLabel('free', 'en')).toBe('Free');
  });

  it('Finnish labels', () => {
    expect(recoveryStageLabel('first-hours', 'fi')).toBe('Ensimmäiset tunnit');
    expect(recoveryStageLabel('withdrawal-peak', 'fi')).toBe('Vieroitusoireiden huippu');
    expect(recoveryStageLabel('free', 'fi')).toBe('Vapaa');
  });
});

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

describe('proofLine — Finnish', () => {
  it('belief-tag path', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'smoked' }),
    ];
    expect(proofLine(sessions, 'reward', 'fi')).toEqual({
      grounded: true,
      text: 'Olet ollut tässä 3 kertaa. 2 meni ohi ilman tupakkaa.',
    });
  });

  it('trigger path uses the inflected in-sentence trigger form', () => {
    const sessions = [
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
    ];
    expect(proofLine(sessions, 'stress-relief', 'fi').text).toBe(
      'Olet ollut stressaavissa hetkissä 3 kertaa. 2 meni ohi ilman tupakkaa.'
    );
  });

  it('neutral fallback', () => {
    expect(proofLine([], 'reward', 'fi').text).toBe(
      'Opettelemme vielä, miten tämä näyttäytyy sinulla.'
    );
  });

  it('English trigger path is unchanged when no locale is passed (regression guard)', () => {
    const sessions = [
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
    ];
    expect(proofLine(sessions, 'stress-relief').text).toBe(
      "You've been in stress moments like this 3 times. 2 passed without smoking."
    );
  });
});

describe('insights — Finnish', () => {
  const quitAt = new Date('2026-01-01T00:00:00Z');
  const now = new Date('2026-01-05T00:00:00Z');

  it('trigger-victory uses the inflected trigger form', () => {
    const rule = INSIGHT_RULES.find((r) => r.kind === 'trigger-victory');
    if (!rule) throw new Error('rule missing');
    const sessions = Array.from({ length: 5 }, () =>
      mkSession({ trigger: 'coffee', outcome: 'passed' })
    );
    const insight = rule.compute(sessions, quitAt, now, 'fi');
    expect(insight?.text).toBe(
      '5 mielitekoa kahvihetkissä on jo mennyt ohi. Se kierre on hiipumassa.'
    );
  });

  it('avg-duration', () => {
    const rule = INSIGHT_RULES.find((r) => r.kind === 'avg-duration');
    if (!rule) throw new Error('rule missing');
    const sessions = Array.from({ length: 5 }, () =>
      mkSession({
        startedAt: '2026-01-02T12:00:00Z',
        endedAt: '2026-01-02T12:04:00Z',
        outcome: 'passed',
      })
    );
    const insight = rule.compute(sessions, quitAt, now, 'fi');
    expect(insight?.text).toBe(
      'Kirjaamasi mieliteot kestävät keskimäärin noin 4 minuuttia — ja sinä kestät pidempään.'
    );
  });

  it('intensity numbers render with a Finnish decimal comma', () => {
    const rule = INSIGHT_RULES.find((r) => r.kind === 'intensity-decline');
    if (!rule) throw new Error('rule missing');
    // Week 1 (2026-W01): five sessions at intensity 8; a later ISO week: five at 4.
    const sessions = [
      ...Array.from({ length: 5 }, () =>
        mkSession({ startedAt: '2026-01-01T10:00:00Z', initialIntensity: 8 })
      ),
      ...Array.from({ length: 5 }, () =>
        mkSession({ startedAt: '2026-01-15T10:00:00Z', initialIntensity: 4 })
      ),
    ];
    const insight = rule.compute(sessions, quitAt, new Date('2026-01-16T00:00:00Z'), 'fi');
    expect(insight?.text).toBe(
      'Mielitekojesi keskimääräinen voimakkuus on laskenut: ensimmäisellä viikolla 8,0, tällä viikolla 4,0.'
    );
  });

  it('English rule text is unchanged when no locale is passed (regression guard)', () => {
    const rule = INSIGHT_RULES.find((r) => r.kind === 'trigger-victory');
    if (!rule) throw new Error('rule missing');
    const sessions = Array.from({ length: 5 }, () =>
      mkSession({ trigger: 'coffee', outcome: 'passed' })
    );
    expect(rule.compute(sessions, quitAt, now)?.text).toBe(
      "You've passed 5 coffee cravings. That loop is losing."
    );
  });
});
