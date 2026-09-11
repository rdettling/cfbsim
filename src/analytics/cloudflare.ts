export type CloudflareAnalyticsOptions = {
  document?: Document;
  isProduction: boolean;
  token?: string;
};

export type CloudflareAnalyticsLoader = {
  initialize: () => void;
};

const CLOUDFLARE_BEACON_ID = 'cfbsim-cloudflare-analytics';
const CLOUDFLARE_BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

export const createCloudflareAnalyticsLoader = ({
  document,
  isProduction,
  token,
}: CloudflareAnalyticsOptions): CloudflareAnalyticsLoader => {
  const siteToken = token?.trim();
  let initialized = false;

  return {
    initialize: () => {
      if (!isProduction || !document || !siteToken) return;
      if (initialized || document.getElementById(CLOUDFLARE_BEACON_ID)) return;

      try {
        const script = document.createElement('script');
        script.id = CLOUDFLARE_BEACON_ID;
        script.type = 'module';
        script.src = CLOUDFLARE_BEACON_URL;
        script.dataset.cfBeacon = JSON.stringify({ token: siteToken });
        document.body.append(script);
        initialized = true;
      } catch {
        // Analytics must never affect application behavior.
      }
    },
  };
};

const cloudflareAnalytics = createCloudflareAnalyticsLoader({
  document: typeof document === 'undefined' ? undefined : document,
  isProduction: import.meta.env.PROD,
  token: import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
});

export const initializeCloudflareAnalytics = () => {
  cloudflareAnalytics.initialize();
};
