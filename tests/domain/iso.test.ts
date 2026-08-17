import { afterEach, describe, expect, it, vi } from 'vitest';
import { toLocalIso } from '@/lib/utils/iso';

// `toLocalIso`'s offset digits depend on `Date.prototype.getTimezoneOffset`,
// which in turn depends on the machine/CI runner's configured timezone —
// so every test pins it explicitly rather than trusting the environment.
describe('toLocalIso', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a date with a positive (ahead-of-UTC) offset', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-120); // UTC+2
    const d = new Date(2026, 7, 17, 9, 5, 3);
    expect(toLocalIso(d)).toBe('2026-08-17T09:05:03+02:00');
  });

  it('formats a date with a negative (behind-UTC) offset', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300); // UTC-5
    const d = new Date(2026, 7, 17, 9, 5, 3);
    expect(toLocalIso(d)).toBe('2026-08-17T09:05:03-05:00');
  });

  it('formats a zero offset as +00:00 (never "Z")', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    const d = new Date(2026, 7, 17, 9, 5, 3);
    expect(toLocalIso(d)).toBe('2026-08-17T09:05:03+00:00');
  });

  it('formats a half-hour offset (e.g. India, UTC+5:30)', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330);
    const d = new Date(2026, 7, 17, 9, 5, 3);
    expect(toLocalIso(d)).toBe('2026-08-17T09:05:03+05:30');
  });

  it('pads single-digit month/day/hour/minute/second components', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    const d = new Date(2026, 0, 5, 3, 4, 5);
    expect(toLocalIso(d)).toBe('2026-01-05T03:04:05+00:00');
  });
});
