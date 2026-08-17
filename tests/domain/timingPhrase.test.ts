import { describe, expect, it } from 'vitest';
import { fmt, timingPhrase } from '@/components/health/timingPhrase';

describe('fmt', () => {
  it('formats sub-hour durations as minutes', () => {
    expect(fmt(0)).toBe('0 minutes');
    expect(fmt(1 / 3)).toBe('20 minutes');
    expect(fmt(1 / 60)).toBe('1 minute');
  });

  it('formats up to 48h as hours', () => {
    expect(fmt(1)).toBe('1 hour');
    expect(fmt(8)).toBe('8 hours');
    expect(fmt(47.9)).toBe('48 hours');
  });

  it('formats up to 14 days as days', () => {
    expect(fmt(48)).toBe('2 days');
    expect(fmt(72)).toBe('3 days');
    expect(fmt(13.9 * 24)).toBe('14 days');
  });

  it('formats up to 9 weeks as weeks', () => {
    expect(fmt(14 * 24)).toBe('2 weeks');
    expect(fmt(336)).toBe('2 weeks');
    expect(fmt(8.9 * 168)).toBe('9 weeks');
  });

  it('formats up to 24 months as months', () => {
    expect(fmt(9 * 168)).toBe('2 months');
    expect(fmt(2190)).toBe('3 months');
    expect(fmt(23.9 * 730)).toBe('24 months');
  });

  it('formats beyond 24 months as years', () => {
    expect(fmt(24 * 730)).toBe('2 years');
    expect(fmt(43830)).toBe('5 years');
  });

  it('never reaches a "1 year" reading — the months bucket covers up to 24 months', () => {
    expect(fmt(8766)).toBe('12 months');
  });

  it('never renders a negative duration', () => {
    expect(fmt(-10)).toBe('0 minutes');
  });
});

describe('timingPhrase', () => {
  it('phrases a window as a typically-between range', () => {
    expect(timingPhrase({ kind: 'window', earliestHours: 0.33, typicalUntilHours: 72 })).toBe(
      'typically 20 minutes–3 days after quitting'
    );
  });

  it('phrases a point as an around-X moment', () => {
    expect(timingPhrase({ kind: 'point', earliestHours: 8 })).toBe(
      'around 8 hours after quitting'
    );
  });

  it('phrases an openEnded timing as ongoing from a start', () => {
    expect(timingPhrase({ kind: 'openEnded', earliestHours: 48 })).toBe(
      'from 2 days on — and continuing'
    );
  });

  it('returns a noTimeline phrase verbatim, untouched', () => {
    const phrase = 'Recovers over weeks to months; no precise figure is reported.';
    expect(timingPhrase({ kind: 'noTimeline', phrase })).toBe(phrase);
  });
});
