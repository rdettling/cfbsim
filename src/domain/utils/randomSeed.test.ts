import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateRandomSeed } from './randomSeed';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('generateRandomSeed', () => {
  it('uses a cryptographically generated unsigned 32-bit value when available', () => {
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values[0] = 0xdeadbeef;
      return values;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    expect(generateRandomSeed()).toBe(0xdeadbeef);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it('falls back to Math.random when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);

    expect(generateRandomSeed()).toBe(0x40000000);
  });
});
