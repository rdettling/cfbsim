import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { API_BASE_URL } from '../config';
import { Team, Conference, Info } from '../interfaces';
import { STAGES } from '../constants/stages';
import {
  Container,
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
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  TableContainer
} from '@mui/material';
import { TeamLogo } from '../components/TeamComponents';

interface Rivalry {
  0: string;  // Team 1
  1: string;  // Team 2
  2: string;  // Week
  3: string;  // Name
}

interface PreviewData {
  conferences: Conference[];
  independents: Team[];
  rivalries: Rivalry[];
  playoff: {
    teams: number;
    autobids: number;
  };
}

interface LaunchProps {
  years: string[];
  info: Info | null;
  preview: PreviewData | null;
}

// API URL constants
const HOME_URL = (year: string) => `${API_BASE_URL}/api/home/?year=${year}`;

const Home = () => {
  const [data, setData] = useState<LaunchProps>({ years: [], info: null, preview: null });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [previewTab, setPreviewTab] = useState('teams');
  const navigate = useNavigate();

  const fetchHomeData = async (year: string) => {
    try {
      const response = await axios.get(HOME_URL(year), { withCredentials: true });
      setData(response.data);
      if (!selectedYear && response.data.years.length > 0) {
        setSelectedYear(response.data.years[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchHomeData(selectedYear);
  }, [selectedYear]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleYearChange = (event: any) => {
    setSelectedYear(event.target.value);
  };

  const getLoadGameLink = (info: Info): string => {
    const currentStage = STAGES.find(stage => stage.id === info.stage);
    return currentStage ? currentStage.path : '/';
  };

  return (
    <Container maxWidth="xl" sx={{ my: 5, position: 'relative' }}>
      <Stack direction="row" spacing={3}>
        {/* Left Column */}
        <Box sx={{ width: activeTab === 0 ? '33%' : '100%', position: 'fixed', left: 20, top: '40px' }}>
          <Typography variant="h3" component="h1" gutterBottom>Welcome to CFB Sim</Typography>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="New Game" />
              <Tab label="Load Game" />
            </Tabs>
          </Box>

          {/* New Game Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>Start year:</Typography>
              <Select value={selectedYear} onChange={handleYearChange} sx={{ minWidth: 120, mb: 2 }}>
                {data.years.map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </Box>
          )}

          {/* Load Game Tab */}
          {activeTab === 1 && data.info && (
            <Box>
              <Typography variant="h6" gutterBottom>Current save</Typography>
              <Paper sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Year</TableCell>
                      <TableCell>Stage</TableCell>
                      <TableCell>Team</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>{data.info.currentYear}</TableCell>
                      <TableCell>
                        {data.info.stage === 'season'
                          ? `Season (Week ${data.info.currentWeek})`
                          : data.info.stage}
                      </TableCell>
                      <TableCell>{data.info.team.name}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
              <Button variant="contained" href={getLoadGameLink(data.info)}>Load Game</Button>
            </Box>
          )}
        </Box>

        {/* Middle and Right Columns - Only show if activeTab is 0 (New Game) */}
        {activeTab === 0 && (
          <>
            {/* Middle Column */}
            <Box sx={{ width: `calc(33% - 40px)`, position: 'fixed', left: '33%', top: '40px' }}>
              <Paper sx={{ p: 3, height: '80vh', overflow: 'auto', width: '100%' }}>
                <Typography variant="h4" gutterBottom align="center">Team Rankings</Typography>
                <Stack direction="column" spacing={1} sx={{ width: '100%' }}>
                  {data.preview && [...data.preview.conferences.flatMap(conf => conf.teams), ...data.preview.independents]
                    .sort((a, b) => b.prestige - a.prestige)
                    .map((team, index) => (
                      <Card key={team.name} sx={{ py: 1, width: '100%' }}>
                        <CardContent sx={{ py: 0, '&:last-child': { pb: 0 } }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Typography variant="body2" sx={{ width: 30 }}>#{index + 1}</Typography>
                            <TeamLogo name={team.name} size={40} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1">{team.name} {team.mascot}</Typography>
                              <Typography variant="body2">Prestige: {team.prestige}</Typography>
                            </Box>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => {
                                navigate('/noncon', {
                                  state: { 
                                    fromHome: true,
                                    team: team.name,
                                    year: selectedYear
                                  }
                                });
                              }}
                            >
                              Select
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                </Stack>
              </Paper>
            </Box>

            {/* Right Column */}
            <Box sx={{ width: '33%', position: 'fixed', right: 20, top: '40px' }}>
              <Paper sx={{ p: 3, height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h4" gutterBottom>Preview for {selectedYear}</Typography>
                <Tabs value={previewTab} onChange={(_, newValue) => setPreviewTab(newValue)}>
                  <Tab value="teams" label="Teams" />
                  <Tab value="rivalries" label="Rivalries" />
                  <Tab value="playoff" label="Playoff" />
                </Tabs>

                <Box sx={{ flex: 1, overflow: 'auto', mt: 2 }}>
                  {/* Preview content tabs */}
                  {previewTab === "teams" && data.preview && (
                    <Box>
                      {data.preview.conferences.map((conf) => (
                        <Accordion key={conf.confName}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <TeamLogo name={conf.confName} size={40} />
                              <Typography>{conf.confFullName} ({conf.confName})</Typography>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack direction="column" spacing={1}>
                              {conf.teams.map(team => (
                                <Box key={team.name}>
                                  <Card sx={{ py: 1 }}>
                                    <CardContent sx={{ py: 0, '&:last-child': { pb: 0 } }}>
                                      <Stack direction="row" spacing={2} alignItems="center">
                                        <TeamLogo name={team.name} size={40} />
                                        <Typography variant="subtitle1">{team.name} {team.mascot}</Typography>
                                        <Typography variant="body2">Prestige: {team.prestige}</Typography>
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                </Box>
                              ))}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                      {/* Independents */}
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography>Independents</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack direction="column" spacing={1}>
                            {data.preview.independents.map(team => (
                              <Box key={team.name}>
                                <Card sx={{ py: 1 }}>
                                  <CardContent sx={{ py: 0, '&:last-child': { pb: 0 } }}>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                      <TeamLogo name={team.name} size={40} />
                                      <Typography variant="subtitle1">{team.name} {team.mascot}</Typography>
                                      <Typography variant="body2">Prestige: {team.prestige}</Typography>
                                    </Stack>
                                  </CardContent>
                                </Card>
                              </Box>
                            ))}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    </Box>
                  )}

                  {previewTab === "rivalries" && data.preview && (
                    <Box>
                      <Typography sx={{ mb: 2 }} variant="subtitle1">
                        Rivalry games are guaranteed to happen every year
                      </Typography>
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Team 1</TableCell>
                              <TableCell>Team 2</TableCell>
                              <TableCell>Week</TableCell>
                              <TableCell>Name</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {data.preview.rivalries.map((rivalry, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <TeamLogo name={rivalry[0]} size={30} />
                                  <Typography>{rivalry[0]}</Typography>
                                </TableCell>
                                <TableCell>
                                  <TeamLogo name={rivalry[1]} size={30} />
                                  <Typography>{rivalry[1]}</Typography>
                                </TableCell>
                                <TableCell>{rivalry[2] === null ? 'Any' : rivalry[2]}</TableCell>
                                <TableCell>{rivalry[3]}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {previewTab === "playoff" && data.preview && (
                    <Box>
                      <Typography>Total Teams in Playoff: {data.preview.playoff.teams}</Typography>
                      <Typography>Autobids: {data.preview.playoff.autobids}</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Box>
          </>
        )}
      </Stack>
    </Container>
  );
};

export default Home;