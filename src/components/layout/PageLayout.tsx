import { Box, Container, CircularProgress, Alert } from '@mui/material';
import Navbar from './Navbar';
import type { PageLayoutProps } from '../../types/components';

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
            {navbarData && (
                <Navbar
                    team={navbarData.team}
                    currentStage={navbarData.currentStage}
                    info={navbarData.info}
                    conferences={navbarData.conferences}
                />
            )}
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
