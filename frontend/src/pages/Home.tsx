import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
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
  Card,
  CardContent,
  Divider,
  Chip
} from '@mui/material';
import { TeamLogo, ConfLogo } from '../components/TeamComponents';

interface PreviewData {
  conferences: Conference[];
  independents: Team[];
}

interface ConferenceListItem {
  confName: string;
  confFullName: string;
}

interface LaunchProps {
  years: string[];
  info: Info | null;
  preview: PreviewData | null;
  selected_year?: string;
  conference_list?: ConferenceListItem[];
}

const Home = () => {
  const [data, setData] = useState<LaunchProps>({ years: [], info: null, preview: null });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedConference, setSelectedConference] = useState<string>('ALL');
  const navigate = useNavigate();
  const pendingFetch = useRef(false);

  // Padding variables for easy adjustment
  const edgePadding = '10%'; // Adjust this value to change spacing from screen edges
  const bottomPadding = '100px'; // Adjust this value to prevent overlap with footer

  // Load initial data when component mounts
  useEffect(() => {
    const fetchInitialData = async () => {
      if (pendingFetch.current) return;
      pendingFetch.current = true;
      
      try {
        const responseData = await apiService.getHome<LaunchProps>('');
        setData(responseData);
        
        if (responseData.selected_year) {
          setSelectedYear(responseData.selected_year);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        pendingFetch.current = false;
      }
    };

    fetchInitialData();
  }, []);

  // Handle year selection change
  const handleYearChange = (event: any) => {
    const newYear = event.target.value;
    setSelectedYear(newYear);
    
    // Fetch preview data for the selected year
    (async () => {
      if (pendingFetch.current) return;
      pendingFetch.current = true;
      
      try {
        const responseData = await apiService.getHome<LaunchProps>(newYear);
        setData(prevData => ({ ...prevData, preview: responseData.preview, conference_list: responseData.conference_list }));
        setSelectedConference('ALL'); // Reset filter on year change
      } catch (error) {
        console.error('Error fetching year data:', error);
      } finally {
        pendingFetch.current = false;
      }
    })();
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getLoadGameLink = (info: Info): string => {
    const currentStage = STAGES.find(stage => stage.id === info.stage);
    return currentStage ? currentStage.path : '/';
  };

  // Filter teams by selected conference
  let filteredTeams: Team[] = [];
  if (data.preview) {
    if (selectedConference === 'ALL') {
      filteredTeams = [
        ...data.preview.conferences.flatMap(conf => conf.teams),
        ...data.preview.independents
      ];
    } else if (selectedConference === 'INDEPENDENTS') {
      filteredTeams = data.preview.independents;
    } else {
      const conf = data.preview.conferences.find(c => c.confName === selectedConference);
      filteredTeams = conf ? conf.teams : [];
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 6, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography 
          variant="h2" 
          component="h1" 
          sx={{ 
            fontWeight: 700, 
            mb: 2,
            background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Welcome to CFB Sim
        </Typography>
      
      </Box>

      {/* Main Content */}
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Tabs */}
        <Paper elevation={2} sx={{ mb: 4, borderRadius: 3, overflow: 'hidden' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{ 
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: 1.5
              }
            }}
          >
            <Tab 
              label="New Game" 
              sx={{ 
                textTransform: 'none',
                fontSize: '1.1rem',
                fontWeight: 600,
                flex: 1
              }}
            />
            <Tab 
              label="Load Game" 
              sx={{ 
                textTransform: 'none',
                fontSize: '1.1rem',
                fontWeight: 600,
                flex: 1
              }}
            />
          </Tabs>
        </Paper>

        {/* New Game Flow */}
        {activeTab === 0 && (
          <Stack spacing={4}>
            {/* Step 1: Year Selection */}
            <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                Step 1: Choose Your Season
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Select the year you want to start your coaching career
              </Typography>
              
              <Select 
                value={selectedYear} 
                onChange={handleYearChange} 
                sx={{ 
                  minWidth: 200,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
                size="medium"
              >
                {data?.years?.map((year) => (
                  <MenuItem key={year} value={year}>
                    <Typography variant="h6">{year} Season</Typography>
                  </MenuItem>
                ))}
              </Select>
            </Paper>

            {/* Step 2: Conference Filter (only show if year is selected) */}
            {selectedYear && data.preview && (
              <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  Step 2: Filter by Conference
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Choose a conference to narrow down your options, or view all teams
                </Typography>
                
                <Select
                  value={selectedConference}
                  onChange={e => setSelectedConference(e.target.value)}
                  sx={{ 
                    minWidth: 300,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  size="medium"
                >
                  <MenuItem value="ALL">
                    <Typography variant="h6">All Conferences</Typography>
                  </MenuItem>
                  {data.conference_list?.sort((a, b) => a.confName.localeCompare(b.confName)).map(conf => (
                    <MenuItem key={conf.confName} value={conf.confName}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ConfLogo name={conf.confName} size={24} />
                        <Typography variant="h6">{conf.confName}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  <MenuItem value="INDEPENDENTS">
                    <Typography variant="h6">Independents</Typography>
                  </MenuItem>
                </Select>
              </Paper>
            )}

            {/* Step 3: Team Selection (only show if conference is selected) */}
            {selectedYear && data.preview && (
              <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ 
                  p: 4, 
                  backgroundColor: 'primary.main',
                  color: 'white'
                }}>
                  <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                    Step 3: Select Your Team
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Choose the team you want to coach - ranked by current prestige
                  </Typography>
                </Box>

                <Box sx={{ 
                  maxHeight: '60vh', 
                  overflow: 'auto',
                  '&::-webkit-scrollbar': {
                    width: '8px'
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: '#f1f1f1'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: '#c1c1c1',
                    borderRadius: '4px'
                  }
                }}>
                  {filteredTeams.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="h6" color="text.secondary">
                        No teams available for the selected filters
                      </Typography>
                    </Box>
                  ) : (
                    filteredTeams
                      .sort((a, b) => b.prestige - a.prestige)
                      .map((team, index) => (
                        <Box key={team.name}>
                          <Box sx={{ 
                            p: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(25, 118, 210, 0.04)',
                              transform: 'translateX(4px)'
                            }
                          }}>
                            <Typography 
                              variant="h5" 
                              sx={{ 
                                minWidth: 50,
                                fontWeight: 700,
                                color: 'primary.main'
                              }}
                            >
                              #{index + 1}
                            </Typography>
                            
                            <TeamLogo name={team.name} size={56} />
                            
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                  {team.name} {team.mascot}
                                </Typography>
                                {/* Conference Logo - smaller and positioned after team name */}
                                {team.confName && (
                                  <ConfLogo name={team.confName} size={24} />
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                {/* Current Prestige - Blue dots */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', minWidth: 60 }}>
                                    Current:
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                                    {Array.from({ length: 7 }, (_, i) => (
                                      <Box
                                        key={i}
                                        sx={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: '50%',
                                          backgroundColor: i < team.prestige ? 'primary.main' : 'grey.300',
                                          transition: 'all 0.2s ease'
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>

                                {/* Ceiling - Green dots */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main', minWidth: 50 }}>
                                    Ceiling:
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                                    {Array.from({ length: 7 }, (_, i) => (
                                      <Box
                                        key={i}
                                        sx={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: '50%',
                                          backgroundColor: i < team.ceiling ? 'success.main' : 'grey.300',
                                          transition: 'all 0.2s ease'
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>

                                {/* Floor - Orange dots */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main', minWidth: 35 }}>
                                    Floor:
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                                    {Array.from({ length: 7 }, (_, i) => (
                                      <Box
                                        key={i}
                                        sx={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: '50%',
                                          backgroundColor: i < team.floor ? 'warning.main' : 'grey.300',
                                          transition: 'all 0.2s ease'
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              </Box>
                            </Box>
                            
                            <Button
                              variant="contained"
                              size="large"
                              sx={{ 
                                minWidth: 120,
                                height: 48,
                                borderRadius: 3,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '1.1rem',
                                boxShadow: 3,
                                '&:hover': {
                                  boxShadow: 6
                                }
                              }}
                              onClick={() => {
                                const buttonElement = document.activeElement as HTMLButtonElement;
                                if (buttonElement) {
                                  buttonElement.disabled = true;
                                  buttonElement.innerHTML = 'Starting...';
                                }
                                
                                apiService.get(`/api/noncon/`, {
                                  team: team.name,
                                  year: selectedYear
                                })
                                  .then(response => {
                                    navigate('/noncon', {
                                      state: { 
                                        fromHome: true,
                                        initialData: response 
                                      }
                                    });
                                  })
                                  .catch(error => {
                                    console.error('Error starting new game:', error);
                                    if (buttonElement) {
                                      buttonElement.disabled = false;
                                      buttonElement.innerHTML = 'Select Team';
                                    }
                                  });
                              }}
                            >
                              Select Team
                            </Button>
                          </Box>
                          {index < filteredTeams.length - 1 && <Divider />}
                        </Box>
                      ))
                  )}
                </Box>
              </Paper>
            )}
          </Stack>
        )}

        {/* Load Game Tab */}
        {activeTab === 1 && data.info && (
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, color: 'primary.main' }}>
              Continue Your Journey
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Resume your saved game and continue building your dynasty
            </Typography>
            
            <Paper elevation={1} sx={{ mb: 4, overflow: 'hidden' }}>
              <Table>
                <TableHead sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '1.1rem' }}>Year</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '1.1rem' }}>Stage</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '1.1rem' }}>Team</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontSize: '1.1rem' }}>{data.info.currentYear}</TableCell>
                    <TableCell>
                      <Chip 
                        label={data.info.stage === 'season'
                          ? `Season (Week ${data.info.currentWeek})`
                          : data.info.stage}
                        size="medium"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TeamLogo name={data.info.team.name} size={32} />
                        <Typography variant="h6">{data.info.team.name}</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
            
            <Button 
              variant="contained" 
              size="large"
              href={getLoadGameLink(data.info)}
              sx={{ 
                borderRadius: 3,
                textTransform: 'none',
                fontSize: '1.2rem',
                fontWeight: 600,
                px: 6,
                py: 2,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 6
                }
              }}
            >
              Continue Game
            </Button>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default Home;