import { describe, expect, it } from 'vitest';
import { LOCALES, isLocale } from '@/domain/types';
import { interpolate } from '@/lib/i18n/interpolate';

describe('Locale', () => {
  it('lists English first — it is the default and the schema locale', () => {
    expect(LOCALES[0]).toBe('en');
    expect(LOCALES).toContain('fi');
  });

  it('isLocale accepts exactly the supported locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fi')).toBe(true);
  });

  it('isLocale rejects unsupported or malformed values', () => {
    expect(isLocale('sv')).toBe(false);
    expect(isLocale('EN')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe('interpolate', () => {
  it('replaces a single {name} placeholder', () => {
    expect(interpolate('Hello {name}', { name: 'world' })).toBe('Hello world');
  });

  it('replaces repeated and multiple placeholders', () => {
    expect(interpolate('{a} and {b} and {a}', { a: '1', b: '2' })).toBe('1 and 2 and 1');
  });

  it('stringifies number values', () => {
    expect(interpolate('{count} cravings', { count: 3 })).toBe('3 cravings');
  });

  it('leaves unknown placeholders intact so a missing var is visible, not invisible', () => {
    expect(interpolate('Hi {name}', {})).toBe('Hi {name}');
  });

  it('returns templates without placeholders unchanged', () => {
    expect(interpolate('No vars here', { unused: 'x' })).toBe('No vars here');
  });
});
