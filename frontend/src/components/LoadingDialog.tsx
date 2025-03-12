import { Dialog, DialogContent, CircularProgress, Typography } from '@mui/material';

interface LoadingDialogProps {
    open: boolean;
    message: string;
}

const LoadingDialog = ({ open, message }: LoadingDialogProps) => (
    <Dialog open={open} disableEscapeKeyDown disablePortal>
        <DialogContent sx={{ textAlign: 'center', p: 4 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>{message}</Typography>
        </DialogContent>
    </Dialog>
);

export default LoadingDialog;
