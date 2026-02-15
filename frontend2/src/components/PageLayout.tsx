import { ReactNode } from 'react';
import { Box, Container, CircularProgress, Alert } from '@mui/material';
import { Team, Info, Conference } from '../interfaces';

interface PageLayoutProps {
    loading: boolean;
    error: string | null;
    navbarData?: {
        team: Team;
        currentStage: string;
        info: Info & { lastWeek?: number };
        conferences: Conference[];
    };
    containerMaxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
    children: ReactNode;
}

/**
 * PageLayout - A reusable layout component that handles:
 * - Loading states with centered spinner
 * - Error states with alert
 * - Optional navbar with consistent props
 * - Optional container with configurable maxWidth
 * 
 * This eliminates duplicated loading/error/navbar code across all pages.
 */
export const PageLayout = ({ 
    loading, 
    error, 
    navbarData, 
    containerMaxWidth = 'lg',
    children 
}: PageLayoutProps) => {
    // Loading state
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    // Error state
    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    // Main content
    return (
        <>
            {containerMaxWidth !== false ? (
                <Container maxWidth={containerMaxWidth} sx={{ py: 4 }}>
                    {children}
                </Container>
            ) : (
                children
            )}
        </>
    );
};

export default PageLayout;
