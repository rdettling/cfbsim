import CloseIcon from '@mui/icons-material/Close';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { RecruitingTeamResult } from '../../types/recruiting';
import { RecruitingClassPanel } from './RecruitingClassPanel';

interface RecruitingClassDialogProps {
  open: boolean;
  team: RecruitingTeamResult | null;
  onClose: () => void;
}

export const RecruitingClassDialog = ({
  open,
  team,
  onClose,
}: RecruitingClassDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby="recruiting-class-dialog-title"
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Typography
          id="recruiting-class-dialog-title"
          component="span"
          variant="h6"
        >
          Recruiting Class
        </Typography>
        <IconButton
          aria-label="Close recruiting class"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
        <RecruitingClassPanel
          team={team}
          headingId="recruiting-dialog-class-title"
        />
      </DialogContent>
    </Dialog>
  );
};
