import {
  Box,
  Paper,
  Typography,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { useDomainData } from '../domain/hooks';
import { loadSettings } from '../domain/league';

interface SettingsData {
  settings: {
    playoff_teams: number;
    playoff_autobids?: number;
    playoff_conf_champ_top_4?: boolean;
    auto_realignment: boolean;
    auto_update_postseason_format: boolean;
  };
  team: any;
  info: any;
  conferences: any[];
}

const SettingsPage = () => {
  const { data, loading, error } = useDomainData<SettingsData>({
    fetcher: loadSettings,
    deps: [],
  });

  if (loading) {
    return (
      <PageLayout loading={loading} error={null}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  if (error || !data) {
    return (
      <PageLayout
        loading={false}
        error={error || 'Failed to load settings'}
        navbarData={
          data
            ? {
                team: data.team,
                currentStage: data.info.stage,
                info: data.info,
                conferences: data.conferences,
              }
            : undefined
        }
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Alert severity="error">
            {error || 'Failed to load settings'}
          </Alert>
        </Box>
      </PageLayout>
    );
  }

  const { settings } = data;

  return (
    <PageLayout
      loading={false}
      error={null}
      containerMaxWidth={false}
      navbarData={{
        team: data.team,
        currentStage: data.info.stage,
        info: data.info,
        conferences: data.conferences,
      }}
    >
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
          Game Settings
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Playoff format and realignment settings can only be changed during the Realignment stage in the offseason.
          </Typography>
        </Alert>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
            Playoff Format
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              Playoff Teams
            </Typography>
            <Select
              value={settings.playoff_teams}
              disabled
              fullWidth
              size="small"
              sx={{ opacity: 0.6 }}
            >
              <MenuItem value={2}>2 Teams (BCS)</MenuItem>
              <MenuItem value={4}>4 Teams</MenuItem>
              <MenuItem value={12}>12 Teams</MenuItem>
            </Select>
          </Box>

          {settings.playoff_teams === 12 && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Conference Champion Autobids
                </Typography>
                <Select
                  value={settings.playoff_autobids || 6}
                  disabled
                  fullWidth
                  size="small"
                  sx={{ opacity: 0.6 }}
                >
                  {Array.from({ length: 11 }, (_, i) => (
                    <MenuItem key={i} value={i}>
                      {i}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.playoff_conf_champ_top_4 || false}
                      disabled
                      sx={{ opacity: 0.6 }}
                    />
                  }
                  label="Conference Champions in Top 4 Seeds"
                />
              </Box>
            </>
          )}
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
            Season Transitions
          </Typography>

          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.auto_realignment}
                  disabled
                  sx={{ opacity: 0.6 }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Auto Realignment
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically update conference assignments from year data during season transitions
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.auto_update_postseason_format}
                  disabled
                  sx={{ opacity: 0.6 }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Auto Update Postseason Format
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically update playoff format from year data during season transitions
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default SettingsPage;
