import { useState, useEffect } from 'react';
import { Container, Box, CircularProgress, Alert } from '@mui/material';
import Navbar from './Navbar';

interface DataPageProps<T> {
    fetchFunction: () => Promise<T>;
    dependencies?: any[];
    children: (data: T) => React.ReactNode;
    showNavbar?: boolean;
    onDataChange?: (data: T) => void;
    autoRefreshOnGameChange?: boolean; // Automatically refresh when game state changes
}

const LoadingState = ({ 
    loading, 
    error, 
    children 
}: { 
    loading: boolean; 
    error: string | null; 
    children: React.ReactNode; 
}) => {
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return <>{children}</>;
};

export const DataPage = <T,>({ 
    fetchFunction,
    dependencies = [],
    children,
    showNavbar = true,
    onDataChange,
    autoRefreshOnGameChange = true
}: DataPageProps<T>) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const responseData = await fetchFunction();
            setData(responseData);
            if (onDataChange) {
                onDataChange(responseData);
            }
        } catch (err) {
            setError('Failed to load data');
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, dependencies);

    // Listen for game state changes and refresh if enabled
    useEffect(() => {
        if (!autoRefreshOnGameChange) return;

        const handleGameChange = () => {
            fetchData();
        };

        window.addEventListener('pageDataRefresh', handleGameChange);

        return () => {
            window.removeEventListener('pageDataRefresh', handleGameChange);
        };
    }, [autoRefreshOnGameChange]);

    // Extract Navbar data from fetched data
    const navbarData = data && typeof data === 'object' && data !== null
        ? (data as any).team && (data as any).info && (data as any).conferences
            ? { team: (data as any).team, info: (data as any).info, conferences: (data as any).conferences }
            : null
        : null;

    return (
        <>
            {showNavbar && navbarData && (
                <Navbar 
                    team={navbarData.team} 
                    currentStage={navbarData.info.stage} 
                    info={navbarData.info} 
                    conferences={navbarData.conferences} 
                />
            )}
            
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <LoadingState 
                    loading={loading} 
                    error={error} 
                >
                    {data && children(data)}
                </LoadingState>
            </Container>
        </>
    );
};
