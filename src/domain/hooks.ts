import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseDomainDataOptions } from '../types/hooks';

export const useDomainData = <T>({ fetcher, deps = [], onData }: UseDomainDataOptions<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  const run = useCallback(async (showLoading = true) => {
    const currentRequest = ++requestId.current;
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const result = await fetcher();
      if (!mounted.current || currentRequest !== requestId.current) return;
      setData(result);
      if (onData) onData(result);
    } catch (err) {
      if (!mounted.current || currentRequest !== requestId.current) return;
      setError((err as Error).message || 'Failed to load data');
    } finally {
      if (mounted.current && currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [fetcher, onData]);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
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
