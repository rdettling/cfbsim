import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { apiService } from "../services/api";
import { Settings, Team, Info, Conference } from "../interfaces";
import { PageLayout } from "../components/PageLayout";
import { useDataFetching } from "../hooks/useDataFetching";

interface DashboardData {
  team: Team;
  info: Info;
  conferences: Conference[];
}

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: settingsData, loading: settingsLoading, error: settingsError } = useDataFetching<Settings>({
    fetchFunction: () => apiService.getSettings<Settings>(),
    autoRefreshOnGameChange: false,
  });

  const { data: navbarData, loading: navbarLoading, error: navbarError } = useDataFetching<DashboardData>({
    fetchFunction: () => apiService.getDashboard<DashboardData>(),
    autoRefreshOnGameChange: false,
  });

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  const loading = settingsLoading || navbarLoading;
  const error = settingsError || navbarError;

  if (loading) {
    return (
      <PageLayout loading={loading} error={null}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  if (error || !settings) {
    return (
      <PageLayout 
        loading={false} 
        error={error || "Failed to load settings"}
        navbarData={navbarData ? {
          team: navbarData.team,
          currentStage: navbarData.info.stage,
          info: navbarData.info,
          conferences: navbarData.conferences
        } : undefined}
      >
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <Alert severity="error">
            {error || "Failed to load settings"}
          </Alert>
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      loading={false}
      error={null}
      containerMaxWidth={false}
      navbarData={navbarData ? {
        team: navbarData.team,
        currentStage: navbarData.info.stage,
        info: navbarData.info,
        conferences: navbarData.conferences
      } : undefined}
    >
      <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold", color: "primary.main" }}>
          Game Settings
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Playoff format and realignment settings can only be changed during the Realignment stage in the offseason.
          </Typography>
        </Alert>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
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
          <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
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

