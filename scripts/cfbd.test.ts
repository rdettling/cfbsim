import { describe, expect, it, vi } from 'vitest';
import { fetchCfbdArray } from './cfbd';

describe('CFBD requests', () => {
  it('authenticates and retries a 429 response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('busy', {
        status: 429,
        headers: { 'retry-after': '1' },
      }))
      .mockResolvedValueOnce(new Response('[{"team":"Alpha"}]'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(fetchCfbdArray({
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      requestName: 'SRS',
      sleep,
      url: 'https://example.test/ratings/srs?year=2025',
      year: 2025,
    })).resolves.toMatchObject({ value: [{ team: 'Alpha' }] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1]).toEqual({
      headers: { Authorization: 'Bearer secret' },
    });
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it.each([
    ['malformed JSON', 'not-json', 'not valid JSON'],
    ['a non-array payload', '{"team":"Alpha"}', 'not an array'],
  ])('rejects %s with endpoint context', async (_label, body, message) => {
    await expect(fetchCfbdArray({
      apiKey: 'secret',
      fetchImpl: vi.fn(async () => new Response(body)) as unknown as typeof fetch,
      requestName: 'records',
      url: 'https://example.test/records?year=2025',
      year: 2025,
    })).rejects.toThrow(`CFBD 2025 records response is ${message}`);
  });

  it('reports the endpoint when retries are exhausted', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('busy', { status: 429 }));
    await expect(fetchCfbdArray({
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      requestName: 'rankings',
      sleep: vi.fn().mockResolvedValue(undefined),
      url: 'https://example.test/rankings?year=2025',
      year: 2025,
    })).rejects.toThrow('CFBD 2025 rankings request failed with 429');
  });
});
