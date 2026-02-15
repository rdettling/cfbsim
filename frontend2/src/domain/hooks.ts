import { useCallback, useEffect, useState } from 'react';

interface UseDomainDataOptions<T> {
  fetcher: () => Promise<T>;
  deps?: any[];
  onData?: (data: T) => void;
}

export const useDomainData = <T>({ fetcher, deps = [], onData }: UseDomainDataOptions<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
      if (onData) onData(result);
    } catch (err) {
      setError((err as Error).message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fetcher, onData]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run };
};
