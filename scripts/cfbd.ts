/// <reference types="node" />

const MAX_API_ATTEMPTS = 4;

export const fetchCfbdArray = async ({
  apiKey,
  fetchImpl = fetch,
  requestName,
  sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds)),
  url,
  year,
}: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  requestName: string;
  sleep?: (milliseconds: number) => Promise<void>;
  url: string;
  year: number;
}) => {
  let response: Response | null = null;
  for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt += 1) {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok || response.status !== 429 || attempt === MAX_API_ATTEMPTS) {
      break;
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfter)
      ? Math.min(Math.max(retryAfter * 1_000, 1_000), 30_000)
      : attempt * 2_000;
    await sleep(delayMs);
  }
  if (!response?.ok) {
    throw new Error(
      `CFBD ${year} ${requestName} request failed with ${response?.status ?? 'no response'}.`,
    );
  }

  const body = await response.text();
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new Error(`CFBD ${year} ${requestName} response is not valid JSON.`);
  }
  if (!Array.isArray(value)) {
    throw new Error(`CFBD ${year} ${requestName} response is not an array.`);
  }
  return { body, value };
};
