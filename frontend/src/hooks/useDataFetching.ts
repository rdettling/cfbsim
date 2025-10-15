import { useState, useEffect } from 'react';

interface UseDataFetchingOptions<T> {
    fetchFunction: () => Promise<T>;
    dependencies?: any[];
    onDataChange?: (data: T) => void;
    autoRefreshOnGameChange?: boolean;
}

export const useDataFetching = <T>({
    fetchFunction,
    dependencies = [],
    onDataChange,
    autoRefreshOnGameChange = true
}: UseDataFetchingOptions<T>) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('🔄 useDataFetching: Starting fetch');
            const responseData = await fetchFunction();
            console.log('✅ useDataFetching: Fetch completed successfully');
            setData(responseData);
            if (onDataChange) {
                onDataChange(responseData);
            }
        } catch (err) {
            setError('Failed to load data');
            console.error('❌ useDataFetching: Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('🔄 useDataFetching: Initial fetch triggered by dependencies:', dependencies);
        fetchData();
    }, dependencies);

    // Listen for game state changes and refresh if enabled
    useEffect(() => {
        if (!autoRefreshOnGameChange) {
            console.log('🚫 useDataFetching: Auto-refresh disabled');
            return;
        }

        const handleGameChange = () => {
            console.log('🔄 useDataFetching: Auto-refresh triggered by pageDataRefresh event');
            fetchData();
        };

        console.log('📡 useDataFetching: Setting up pageDataRefresh listener');
        window.addEventListener('pageDataRefresh', handleGameChange);

        return () => {
            console.log('📡 useDataFetching: Removing pageDataRefresh listener');
            window.removeEventListener('pageDataRefresh', handleGameChange);
        };
    }, [autoRefreshOnGameChange]);

    return { data, loading, error, refetch: fetchData };
};
