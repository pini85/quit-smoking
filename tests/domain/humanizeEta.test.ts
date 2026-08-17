import { describe, expect, it } from 'vitest';
import { humanizeEta } from '@/components/home/humanizeEta';

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('humanizeEta', () => {
  it('says "in under an hour" below one hour', () => {
    expect(humanizeEta(0)).toBe('in under an hour');
    expect(humanizeEta(59 * 60_000)).toBe('in under an hour');
  });

  it('rounds to hours below two days', () => {
    expect(humanizeEta(HOUR)).toBe('in about 1h');
    expect(humanizeEta(3.4 * HOUR)).toBe('in about 3h');
    expect(humanizeEta(47.9 * HOUR)).toBe('in about 48h');
  });

  it('rounds to days from two days on', () => {
    expect(humanizeEta(48 * HOUR)).toBe('in about 2 days');
    expect(humanizeEta(9.6 * DAY)).toBe('in about 10 days');
  });

  it('never renders a negative or non-finite eta', () => {
    expect(humanizeEta(-5000)).toBe('in under an hour');
    expect(humanizeEta(Number.NaN)).toBe('in under an hour');
  });
});
