import { Box, CircularProgress, Typography } from '@mui/material';

type FullPageLoadingProps = {
  message?: string;
};

const FullPageLoading = ({
  message = 'Loading…',
}: FullPageLoadingProps) => (
  <Box
    role="status"
    aria-live="polite"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      minHeight: '100vh',
    }}
  >
    <CircularProgress size={60} />
    <Typography color="text.secondary">{message}</Typography>
  </Box>
);

export default FullPageLoading;
