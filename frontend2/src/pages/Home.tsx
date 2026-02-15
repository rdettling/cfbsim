import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import type { PreviewData, Info } from "../types/domain";
import { STAGES } from "../constants/stages";
import {
  Typography,
  Tabs,
  Tab,
  Box,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
} from "@mui/material";
import { TeamLogo, ConfLogo } from "../components/team/TeamComponents";
import { useDomainData } from "../domain/hooks";
import { PageLayout } from "../components/layout/PageLayout";
import { loadHomeData, type LaunchProps } from "../domain/league";

const Home = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedConference, setSelectedConference] = useState<string>("ALL");
  const [playoffTeams, setPlayoffTeams] = useState<number>(12);
  const [playoffAutobids, setPlayoffAutobids] = useState<number>(5);
  const [playoffConfChampTop4, setPlayoffConfChampTop4] = useState<boolean>(true);
  const [launchData, setLaunchData] = useState<LaunchProps | null>(null);
  const navigate = useNavigate();
  const pendingFetch = useRef(false);

  const { data, loading, error } = useDomainData({
    fetcher: () => loadHomeData(),
    onData: (response) => setLaunchData(response),
  });

  // Initialize data when it loads
  if (launchData && !selectedYear && launchData.selected_year) {
    setSelectedYear(launchData.selected_year);
    if (launchData.preview?.playoff) {
      setPlayoffTeams(launchData.preview.playoff.teams);
      setPlayoffAutobids(launchData.preview.playoff.conf_champ_autobids || 0);
      setPlayoffConfChampTop4(launchData.preview.playoff.conf_champ_top_4 || false);
    }
  }

  // Helper function to get filtered teams
  const getFilteredTeams = (data: LaunchProps) => {
    if (!data?.preview) return [];

    if (selectedConference === "ALL") {
      const conferenceTeams = Object.entries(data.preview.conferences).flatMap(
        ([confName, confData]: [string, any]) =>
          confData.teams.map((team: any) => ({ ...team, confName }))
      );
      const independentTeams = data.preview.independents.map((team: any) => ({
        ...team,
        confName: null,
      }));
      return [...conferenceTeams, ...independentTeams];
    }

    if (selectedConference === "INDEPENDENTS") {
      return data.preview.independents.map((team: any) => ({
        ...team,
        confName: null,
      }));
    }

    const confData = data.preview.conferences[selectedConference as keyof typeof data.preview.conferences] as PreviewData['conferences'][string];
    return confData
      ? confData.teams.map((team: any) => ({ ...team, confName: selectedConference }))
      : [];
  };

  // Helper function to get conference options
  const getConferenceOptions = (data: LaunchProps) => {
    if (!data?.preview?.conferences) return [];
    return Object.entries(data.preview.conferences)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([confName, confData]) => ({
        confName,
        confData,
      }));
  };

  // Helper function to handle playoff team change
  const handlePlayoffTeamsChange = (teams: number) => {
    setPlayoffTeams(teams);
    const is12Team = teams === 12;
    setPlayoffAutobids(is12Team ? 5 : 0);
    setPlayoffConfChampTop4(is12Team);
  };

  // Helper function to handle autobids change
  const handleAutobidsChange = (autobids: number) => {
    setPlayoffAutobids(autobids);
  };

  // Helper function to handle conf champ top 4 change
  const handleConfChampTop4Change = (value: boolean) => {
    setPlayoffConfChampTop4(value);
    // If setting to true, ensure autobids is at least 4
    if (value && playoffAutobids < 4) {
      setPlayoffAutobids(4);
    }
  };

  // Helper function to start new game
  const handleStartGame = async (team: any) => {
    try {
      navigate(ROUTES.NONCON, {
        state: {
          fromHome: true,
          team: team.name,
          year: selectedYear,
        },
      });
    } catch (error) {
      console.error("Error starting new game:", error);
    }
  };

  // Handle year selection change
  const handleYearChange = async (event: any) => {
    const newYear = event.target.value;
    setSelectedYear(newYear);

    if (pendingFetch.current) return;
    pendingFetch.current = true;

    try {
      const responseData = await loadHomeData(newYear);
      setLaunchData(responseData);
      // Update the data manually since we're not using DataPage for this specific fetch
      if (responseData.preview?.playoff) {
        setPlayoffTeams(responseData.preview.playoff.teams);
        setPlayoffAutobids(responseData.preview.playoff.conf_champ_autobids || 0);
        setPlayoffConfChampTop4(responseData.preview.playoff.conf_champ_top_4 || false);
      }
      setSelectedConference("ALL");
    } catch (error) {
      console.error("Error fetching year data:", error);
    } finally {
      pendingFetch.current = false;
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getLoadGameLink = (info: Info) =>
    STAGES.find((stage) => stage.id === info.stage)?.path || "/";

  const filteredTeams = launchData ? getFilteredTeams(launchData) : [];
  const conferenceOptions = launchData ? getConferenceOptions(launchData) : [];

  return (
    <PageLayout 
      loading={loading} 
      error={error}
      containerMaxWidth={false}
    >
      {/* Header */}
      <Typography
        variant="h3"
        align="center"
        sx={{ mb: 3, fontWeight: "bold", color: "primary.main" }}
      >
        Welcome to CFB Sim
      </Typography>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab label="New Game" />
          <Tab label="Load Game" />
        </Tabs>
      </Box>

      {/* New Game Flow */}
      {activeTab === 0 && (
        <Grid container spacing={2} sx={{ maxHeight: "80vh" }}>
          {/* Left Panel: Configuration */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 2, height: "fit-content" }}>
              {/* Year Selection */}
              <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                1. Choose Season
              </Typography>
              <Select
                value={selectedYear}
                onChange={handleYearChange}
                fullWidth
                size="small"
                sx={{ mb: 3 }}
              >
                {launchData?.years?.map((year: string) => (
                  <MenuItem key={year} value={year}>
                    {year} Season
                  </MenuItem>
                ))}
              </Select>

              {/* Playoff Configuration */}
              {selectedYear && launchData?.preview && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                    2. Playoff Format
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Playoff Teams
                  </Typography>
                  <Select
                    value={playoffTeams}
                    onChange={(e) => handlePlayoffTeamsChange(Number(e.target.value))}
                    fullWidth
                    size="small"
                    sx={{ mb: 2 }}
                  >
                    <MenuItem value={2}>2 Teams (BCS)</MenuItem>
                    <MenuItem value={4}>4 Teams</MenuItem>
                    <MenuItem value={12}>12 Teams</MenuItem>
                  </Select>

                  {playoffTeams === 12 && (
                    <>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Conference Champion Autobids
                      </Typography>
                      <Select
                        value={playoffAutobids}
                        onChange={(e) => handleAutobidsChange(Number(e.target.value))}
                        fullWidth
                        size="small"
                        sx={{ mb: 2 }}
                      >
                        {Array.from(
                          { length: Object.keys(launchData.preview?.conferences || {}).length + 1 },
                          (_, i) => (
                            <MenuItem 
                              key={i} 
                              value={i}
                              disabled={playoffConfChampTop4 && i < 4}
                            >
                              {i}
                            </MenuItem>
                          )
                        )}
                      </Select>

                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Conference Champions Top 4 Seeds
                      </Typography>
                      <Select
                        value={playoffConfChampTop4 ? "true" : "false"}
                        onChange={(e) => handleConfChampTop4Change(e.target.value === "true")}
                        fullWidth
                        size="small"
                        sx={{ mb: 2 }}
                      >
                        <MenuItem value="true">Yes</MenuItem>
                        <MenuItem value="false">No</MenuItem>
                      </Select>
                    </>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          {/* Right Panel: Team Selection */}
          {selectedYear && launchData?.preview && (
            <Grid item xs={12} lg={8}>
              <Paper sx={{ height: "75vh", display: "flex", flexDirection: "column" }}>
                {/* Header */}
                <Box sx={{ p: 2, bgcolor: "primary.main", color: "white" }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    3. Select Your Team
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="body2">Filter:</Typography>
                    <Select
                      value={selectedConference}
                      onChange={(e) => setSelectedConference(e.target.value)}
                      size="small"
                      sx={{ bgcolor: "white", minWidth: 200 }}
                    >
                      <MenuItem value="ALL">All Conferences</MenuItem>
                      {conferenceOptions.map(({ confName }) => (
                        <MenuItem key={confName} value={confName}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <ConfLogo name={confName} size={16} />
                            {confName}
                          </Box>
                        </MenuItem>
                      ))}
                      <MenuItem value="INDEPENDENTS">Independents</MenuItem>
                    </Select>
                  </Box>
                </Box>

                {/* Team List */}
                <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
                  {filteredTeams.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                      <Typography color="text.secondary">No teams available</Typography>
                    </Box>
                  ) : (
                    filteredTeams
                      .sort((a: any, b: any) => b.prestige - a.prestige)
                      .map((team: any, index: number) => (
                        <Box
                          key={team.name}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            p: 1.5,
                            m: 0.5,
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 1,
                            "&:hover": { bgcolor: "action.hover" },
                          }}
                        >
                          {/* Rank */}
                          <Typography
                            variant="h6"
                            sx={{
                              minWidth: 40,
                              color: "primary.main",
                              fontWeight: "bold",
                            }}
                          >
                            #{index + 1}
                          </Typography>

                          {/* Team Logo */}
                          <TeamLogo name={team.name} size={40} />

                          {/* Team Info */}
                          <Box sx={{ flex: 1, ml: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {team.name} {team.mascot}
                              </Typography>
                              {team.confName && <ConfLogo name={team.confName} size={20} />}
                            </Box>

                            {/* Ratings */}
                            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                              {[
                                {
                                  label: "Current",
                                  value: team.prestige,
                                  color: "primary.main",
                                  width: 45,
                                },
                                {
                                  label: "Ceiling",
                                  value: team.ceiling,
                                  color: "success.main",
                                  width: 35,
                                },
                                {
                                  label: "Floor",
                                  value: team.floor,
                                  color: "warning.main",
                                  width: 30,
                                },
                              ].map(({ label, value, color, width }) => (
                                <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <Typography variant="caption" sx={{ minWidth: width, color }}>
                                    {label}:
                                  </Typography>
                                  <Box sx={{ display: "flex", gap: 0.25 }}>
                                    {Array.from({ length: 7 }, (_, i) => (
                                      <Box
                                        key={i}
                                        sx={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: "50%",
                                          bgcolor: i < value ? color : "grey.300",
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          </Box>

                          {/* Select Button */}
                          <Button
                            variant="contained"
                            size="small"
                            onClick={async (e) => {
                              const button = e.target as HTMLButtonElement;
                              button.disabled = true;
                              button.textContent = "Starting...";
                              await handleStartGame(team);
                            }}
                          >
                            Select
                          </Button>
                        </Box>
                      ))
                  )}
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Load Game Tab */}
      {activeTab === 1 && launchData?.info && (
        <Paper sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
          <Typography variant="h5" sx={{ mb: 2, color: "primary.main" }}>
            Continue Your Journey
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Resume your saved game and continue building your dynasty
          </Typography>

          <Table sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>Year</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Team</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{launchData.info.currentYear}</TableCell>
                <TableCell>
                  <Chip
                    label={
                      launchData.info.stage === "season"
                        ? `Season (Week ${launchData.info.currentWeek})`
                        : launchData.info.stage
                    }
                    size="small"
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TeamLogo name={launchData.info.team} size={24} />
                    {launchData.info.team}
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Button variant="contained" size="large" href={getLoadGameLink(launchData.info)} fullWidth>
            Continue Game
          </Button>
        </Paper>
      )}
    </PageLayout>
  );
};

export default Home;
