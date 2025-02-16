import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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

interface InfoType {
  user_id: string;
  currentWeek: number;
  currentYear: number;
  startYear: number;
  stage: string;
  team: number;  // This is just the ID
  playoff: number;
}

interface Team {
  name: string;
  mascot: string;
  prestige: number;
}

interface Conference {
  confName: string;
  confFullName: string;
  confGames: number;
  teams: Team[];
}

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
  info: InfoType | null;
  preview: PreviewData | null;
}

const Launch = () => {
  const [data, setData] = useState<LaunchProps>({ years: [], info: null, preview: null });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [previewTab, setPreviewTab] = useState('teams');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8000/api/home/?year=${selectedYear}`);
        console.log('API Response:', response.data);
        setData(response.data);
        
        if (!selectedYear && response.data.years.length > 0) {
          setSelectedYear(response.data.years[0]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [selectedYear]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleYearChange = (event: any) => {
    setSelectedYear(event.target.value);
  };

  const handleBegin = () => {
    navigate(`/preview?year=${selectedYear}`);
  };

  const getLoadGameLink = (info: InfoType) => {
    console.log('Info received:', info);
    console.log('Stage:', info.stage);
    
    if (info.stage === 'season') {
      return '/dashboard';
    } else if (info.stage === 'end of season') {
      return '/season_summary';
    } else if (info.stage === 'roster progression') {
      return '/roster_progression';
    } else if (info.stage === 'schedule non conference') {
      return '/noncon';
    }
    return '/';
  };

  return (
    <Container maxWidth="xl" sx={{ my: 5, position: 'relative' }}>
      {(() => {
        const colSpacing = 20;  // Spacing in pixels between columns
        
        return (
          <Stack direction="row" spacing={3}>
            {/* Left Column */}
            <Box sx={{ 
              width: '33%',
              position: 'fixed',
              left: colSpacing,
              top: '40px'
            }}>
              <Typography variant="h3" component="h1" gutterBottom>
                Welcome to CFB Sim
              </Typography>

              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                  <Tab label="New Game" />
                  <Tab label="Load Game" />
                </Tabs>
              </Box>

              <Box role="tabpanel" hidden={activeTab !== 0}>
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Start year:
                    </Typography>
                    <Select
                      value={selectedYear}
                      onChange={handleYearChange}
                      sx={{ minWidth: 120, mb: 2 }}
                    >
                      {data.years.map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </Select>
                    
                  </Box>
                )}
              </Box>

              <Box role="tabpanel" hidden={activeTab !== 1}>
                {activeTab === 1 && (
                  <Box>
                    {data.info ? (
                      <>
                        <Typography variant="h6" gutterBottom>
                          Current save
                        </Typography>
                        <Paper sx={{ mb: 3 }}>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Year</TableCell>
                                <TableCell>
                                  {data.info.stage === 'season' ? 'Week' : 'Stage'}
                                </TableCell>
                                <TableCell>Team ID</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>{data.info.currentYear}</TableCell>
                                <TableCell>
                                  {data.info.stage === 'season' 
                                    ? data.info.currentWeek 
                                    : `Offseason (${data.info.stage})`}
                                </TableCell>
                                <TableCell>{data.info.team}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </Paper>
                        <Button 
                          variant="contained"
                          href={data.info ? getLoadGameLink(data.info) : undefined}
                          onClick={() => data.info && console.log('Button clicked, link:', getLoadGameLink(data.info))}
                        >
                          Load Game
                        </Button>
                      </>
                    ) : (
                      <Typography variant="h6">
                        No saves detected
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Middle Column */}
            <Box sx={{ 
              width: `calc(33% - ${colSpacing * 2}px)`,  // Adjust width for spacing
              position: 'fixed',
              left: '33%',
              transform: `translateX(${colSpacing}px)`,
              top: '40px'
            }}>
              <Paper sx={{ 
                p: 3, 
                height: '80vh', 
                overflow: 'auto',
                width: '100%'
              }}>
                <Typography variant="h4" gutterBottom align="center">
                  Team Rankings
                </Typography>
                <Stack direction="column" spacing={1} sx={{ width: '100%' }}>
                  {data.preview && [...data.preview.conferences.flatMap(conf => conf.teams), 
                    ...data.preview.independents]
                    .sort((a, b) => b.prestige - a.prestige)
                    .map((team, index) => (
                      <Card key={team.name} sx={{ py: 1, width: '100%' }}>
                        <CardContent sx={{ py: 0, '&:last-child': { pb: 0 } }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Typography variant="body2" sx={{ width: 30 }}>
                              #{index + 1}
                            </Typography>
                            <Box sx={{ width: 40, height: 40 }}>
                              <img 
                                src={`/assets/logos/teams/${team.name}.png`}
                                alt={`${team.name} logo`}
                                style={{ 
                                  width: '100%', 
                                  height: '100%',
                                  objectFit: 'contain'
                                }}
                              />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1">{team.name} {team.mascot}</Typography>
                              <Typography variant="body2">Prestige: {team.prestige}</Typography>
                            </Box>
                            <Button 
                              variant="contained" 
                              size="small"
                              href={`api/noncon?team=${team.name}`}
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
            <Box sx={{ 
              width: '33%', 
              position: 'fixed',
              right: colSpacing,
              top: '40px'
            }}>
              <Paper sx={{ 
                p: 3, 
                height: '80vh',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Typography variant="h4" gutterBottom>
                  Preview for {selectedYear}
                </Typography>

                <Tabs value={previewTab} onChange={(e, newValue) => setPreviewTab(newValue)}>
                  <Tab value="teams" label="Teams" />
                  <Tab value="rivalries" label="Rivalries" />
                  <Tab value="playoff" label="Playoff" />
                </Tabs>

                <Box sx={{ 
                  flex: 1,
                  overflow: 'auto',  // Enable scrolling
                  mt: 2 
                }}>
                  {/* Preview content tabs */}
                  {previewTab === 'teams' && data.preview && (
                    <Box>
                      {/* Conferences */}
                      {data.preview.conferences.map((conf) => (
                        <Accordion key={conf.confName}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Box sx={{ width: 40, height: 40 }}>
                                <img 
                                  src={`/assets/logos/conferences/${conf.confName}.png`}
                                  alt={`${conf.confName} logo`}
                                  style={{ 
                                    width: '100%', 
                                    height: '100%',
                                    objectFit: 'contain'
                                  }}
                                />
                              </Box>
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
                                        <Box sx={{ width: 40, height: 40 }}>
                                          <img 
                                            src={`/assets/logos/teams/${team.name}.png`}
                                            alt={`${team.name} logo`}
                                            style={{ 
                                              width: '100%', 
                                              height: '100%',
                                              objectFit: 'contain'
                                            }}
                                          />
                                        </Box>
                                        <Box>
                                          <Typography variant="subtitle1">{team.name} {team.mascot}</Typography>
                                          <Typography variant="body2">Prestige: {team.prestige}</Typography>
                                        </Box>
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
                                      <Box sx={{ width: 40, height: 40 }}>
                                        <img 
                                          src={`/assets/logos/teams/${team.name}.png`}
                                          alt={`${team.name} logo`}
                                          style={{ 
                                            width: '100%', 
                                            height: '100%',
                                            objectFit: 'contain'
                                          }}
                                        />
                                      </Box>
                                      <Box>
                                        <Typography variant="subtitle1">{team.name} {team.mascot}</Typography>
                                        <Typography variant="body2">Prestige: {team.prestige}</Typography>
                                      </Box>
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

                  {previewTab === 'rivalries' && data.preview && (
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
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Box sx={{ width: 30, height: 30 }}>
                                      <img 
                                        src={`/assets/logos/teams/${rivalry[0]}.png`}
                                        alt={`${rivalry[0]} logo`}
                                        style={{ 
                                          width: '100%', 
                                          height: '100%',
                                          objectFit: 'contain'
                                        }}
                                      />
                                    </Box>
                                    {rivalry[0]}
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Box sx={{ width: 30, height: 30 }}>
                                      <img 
                                        src={`/assets/logos/teams/${rivalry[1]}.png`}
                                        alt={`${rivalry[1]} logo`}
                                        style={{ 
                                          width: '100%', 
                                          height: '100%',
                                          objectFit: 'contain'
                                        }}
                                      />
                                    </Box>
                                    {rivalry[1]}
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  {rivalry[2] === null ? 'Any' : rivalry[2]}
                                </TableCell>
                                <TableCell>{rivalry[3]}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {previewTab === 'playoff' && data.preview && (
                    <Box>
                      <Typography>Total Teams in Playoff: {data.preview.playoff.teams}</Typography>
                      <Typography>Autobids: {data.preview.playoff.autobids}</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Box>
          </Stack>
        );
      })()}
    </Container>
  );
};

export default Launch;