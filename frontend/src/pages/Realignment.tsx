import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Chip,
  Card,
  CardContent,
} from "@mui/material";
import { apiService, ROUTES } from "../services/api";
import { Settings, Team, Info, Conference } from "../interfaces";
import { PageLayout } from "../components/PageLayout";
import { useDataFetching } from "../hooks/useDataFetching";
import { TeamLogo, TeamLink } from "../components/TeamComponents";

interface RealignmentData {
  [team: string]: {
    old: string;
    new: string;
  };
}

interface PlayoffChanges {
  teams?: { old: number; new: number };
  autobids?: { old: number; new: number };
  conf_champ_top_4?: { old: boolean; new: boolean };
}

interface RealignmentPageData {
  team: Team;
  info: Info;
  settings: Settings;
  realignment: RealignmentData;
  playoff_changes: PlayoffChanges;
  conferences: Conference[];
}

const Realignment = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, loading, error } = useDataFetching<RealignmentPageData>({
    fetchFunction: () => apiService.getRealignment<RealignmentPageData>(),
    autoRefreshOnGameChange: false,
  });

  useEffect(() => {
    if (data?.settings) {
      setSettings(data.settings);
    }
  }, [data]);

  const handlePlayoffTeamsChange = (teams: number) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      playoff_teams: teams,
    };
    if (teams !== 12) {
      updatedSettings.playoff_autobids = undefined;
      updatedSettings.playoff_conf_champ_top_4 = false;
    } else {
      updatedSettings.playoff_autobids = settings.playoff_autobids || 6;
    }
    setSettings(updatedSettings);
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await apiService.updateRealignmentSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = () => {
    navigate('/roster_progression');
  };

  if (loading) {
    return (
      <PageLayout>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  if (error || !data || !settings) {
    return (
      <PageLayout>
        <Alert severity="error">
          {error || "Failed to load realignment data"}
        </Alert>
      </PageLayout>
    );
  }

  const realignmentChanges = Object.entries(data.realignment);
  const playoffChanges = data.playoff_changes || {};

  return (
    <PageLayout
      loading={loading}
      error={error}
      navbarData={{
        team: data.team,
        currentStage: data.info.stage,
        info: data.info,
        conferences: data.conferences
      }}
    >
      <Box sx={{ maxWidth: 1000, mx: "auto", p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold", color: "primary.main" }}>
          Configure Next Season
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
            Season Transitions
          </Typography>

          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.auto_realignment}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      auto_realignment: e.target.checked,
                    })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Auto Realignment
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically update conference assignments from year data
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.auto_update_postseason_format}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      auto_update_postseason_format: e.target.checked,
                    })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Auto Update Postseason Format
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically update playoff format from year data
                  </Typography>
                </Box>
              }
            />
          </Box>

          {!settings.auto_update_postseason_format && (
            <>
              <Typography variant="h6" sx={{ mb: 2, mt: 3, color: "primary.main" }}>
                Playoff Format
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Playoff Teams
                </Typography>
                <Select
                  value={settings.playoff_teams}
                  onChange={(e) => handlePlayoffTeamsChange(Number(e.target.value))}
                  fullWidth
                  size="small"
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
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          playoff_autobids: Number(e.target.value),
                        })
                      }
                      fullWidth
                      size="small"
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
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              playoff_conf_champ_top_4: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Conference Champions in Top 4 Seeds"
                    />
                  </Box>
                </>
              )}
            </>
          )}
        </Paper>

        {/* Realignment Preview - Always show if there are changes */}
        {realignmentChanges.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 3 }}>
                Proposed Conference Realignment
                {!settings.auto_realignment && (
                  <Chip 
                    label="Will not apply (Auto Realignment is OFF)" 
                    size="small" 
                    color="warning"
                    sx={{ ml: 2 }}
                  />
                )}
              </Typography>
              
              <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Team</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Old Conference</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>New Conference</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {realignmentChanges.map(([team, confs]) => (
                      <TableRow key={team} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <TeamLogo name={team} size={30} />
                            <TeamLink name={team} onTeamClick={() => {}} />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={confs.old} 
                            variant="outlined" 
                            color="error"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={confs.new} 
                            variant="outlined" 
                            color="success"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Playoff Changes Preview - Always show if there are changes */}
        {Object.keys(playoffChanges).length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 3 }}>
                Proposed Playoff Format Changes
                {!settings.auto_update_postseason_format && (
                  <Chip 
                    label="Will not apply (Auto Update is OFF)" 
                    size="small" 
                    color="warning"
                    sx={{ ml: 2 }}
                  />
                )}
              </Typography>
              
              <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Setting</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Current</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Proposed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {playoffChanges.teams && (
                      <TableRow sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                        <TableCell sx={{ fontWeight: 500 }}>Playoff Teams</TableCell>
                        <TableCell>{playoffChanges.teams.old}</TableCell>
                        <TableCell>
                          <Chip 
                            label={playoffChanges.teams.new} 
                            variant="outlined" 
                            color="success"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    {playoffChanges.autobids && (
                      <TableRow sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                        <TableCell sx={{ fontWeight: 500 }}>Conference Champion Autobids</TableCell>
                        <TableCell>{playoffChanges.autobids.old}</TableCell>
                        <TableCell>
                          <Chip 
                            label={playoffChanges.autobids.new} 
                            variant="outlined" 
                            color="success"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    {playoffChanges.conf_champ_top_4 && (
                      <TableRow sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                        <TableCell sx={{ fontWeight: 500 }}>Conference Champions in Top 4 Seeds</TableCell>
                        <TableCell>{playoffChanges.conf_champ_top_4.old ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={playoffChanges.conf_champ_top_4.new ? 'Yes' : 'No'} 
                            variant="outlined" 
                            color="success"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Settings saved successfully!
          </Alert>
        )}

        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            size="large"
            onClick={handleSave}
            disabled={saving}
            sx={{ flex: 1 }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          <Button
            variant="contained"
            size="large"
            onClick={handleAdvance}
            sx={{ flex: 1 }}
          >
            Advance to Progression
          </Button>
        </Box>
      </Box>
    </PageLayout>
  );
};

export default Realignment;

