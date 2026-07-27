import { useCallback, useEffect, useState } from 'react';
import type { UseDomainDataOptions } from '../types/hooks';

export const useDomainData = <T>({ fetcher, deps = [], onData }: UseDomainDataOptions<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
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

  useEffect(() => {
    const handleRefresh = () => {
      void run(false);
    };
    window.addEventListener('pageDataRefresh', handleRefresh);
    return () => window.removeEventListener('pageDataRefresh', handleRefresh);
  }, [run]);

  const refetch = useCallback(() => run(), [run]);

  return { data, loading, error, refetch };
};
