import { Dialog, DialogContent, CircularProgress, Typography } from '@mui/material';

import type { LoadingDialogProps } from '../../types/components';

const LoadingDialog = ({ open, message }: LoadingDialogProps) => {
    return (
        <Dialog 
            open={open} 
            disableEscapeKeyDown 
            disablePortal
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    p: 1
                }
            }}
        >
            <DialogContent sx={{ textAlign: 'center', p: 4, minWidth: 200 }}>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body1">{message}</Typography>
            </DialogContent>
        </Dialog>
    );
};

export default LoadingDialog;
