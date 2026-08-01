import { Button, Stack } from '@mui/material';

export const StepActions = ({
  back,
  next,
  nextLabel = 'Continue',
  disabled = false,
}: {
  back?: () => void;
  next: () => void;
  nextLabel?: string;
  disabled?: boolean;
}) => (
  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', mt: 3 }}>
    <Button onClick={back} disabled={!back}>Back</Button>
    <Button variant="contained" onClick={next} disabled={disabled}>{nextLabel}</Button>
  </Stack>
);
