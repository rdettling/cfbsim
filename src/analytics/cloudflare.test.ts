import { describe, expect, it, vi } from 'vitest';
import { createCloudflareAnalyticsLoader } from './cloudflare';

const createDocument = (existingScript = false) => {
  const script = {
    dataset: {},
    id: '',
    src: '',
    type: '',
  } as unknown as HTMLScriptElement;
  const body = { append: vi.fn() } as unknown as HTMLBodyElement;
  return {
    body,
    document: {
      body,
      createElement: vi.fn(() => script),
      getElementById: vi.fn(() => existingScript ? script : null),
    } as unknown as Document,
    script,
  };
};

describe('Cloudflare Web Analytics loader', () => {
  it('does nothing outside production or without a token', () => {
    const fixture = createDocument();
    const developmentLoader = createCloudflareAnalyticsLoader({
      document: fixture.document,
      isProduction: false,
      token: 'site-token',
    });
    const missingTokenLoader = createCloudflareAnalyticsLoader({
      document: fixture.document,
      isProduction: true,
    });

    developmentLoader.initialize();
    missingTokenLoader.initialize();

    expect(fixture.document.createElement).not.toHaveBeenCalled();
    expect(fixture.body.append).not.toHaveBeenCalled();
  });

  it('adds the official module beacon with the configured token', () => {
    const fixture = createDocument();
    const loader = createCloudflareAnalyticsLoader({
      document: fixture.document,
      isProduction: true,
      token: ' site-token ',
    });

    loader.initialize();

    expect(fixture.script.id).toBe('cfbsim-cloudflare-analytics');
    expect(fixture.script.type).toBe('module');
    expect(fixture.script.src).toBe(
      'https://static.cloudflareinsights.com/beacon.min.js',
    );
    expect(fixture.script.dataset.cfBeacon).toBe('{"token":"site-token"}');
    expect(fixture.body.append).toHaveBeenCalledWith(fixture.script);
  });

  it('does not add a second beacon after initialization or when one is present', () => {
    const fixture = createDocument();
    const loader = createCloudflareAnalyticsLoader({
      document: fixture.document,
      isProduction: true,
      token: 'site-token',
    });

    loader.initialize();
    loader.initialize();

    expect(fixture.body.append).toHaveBeenCalledTimes(1);

    const existingFixture = createDocument(true);
    const existingLoader = createCloudflareAnalyticsLoader({
      document: existingFixture.document,
      isProduction: true,
      token: 'site-token',
    });
    existingLoader.initialize();

    expect(existingFixture.document.createElement).not.toHaveBeenCalled();
    expect(existingFixture.body.append).not.toHaveBeenCalled();
  });
});
