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
  Chip,
  Grid
} from '@mui/material';
import { TeamLogo, ConfLogo } from '../components/TeamComponents';

interface PreviewData {
  conferences: Conference[];
  independents: Team[];
  playoff: {
    teams: number;
    conf_champ_autobids: number;
    conf_champ_top_4: boolean;
  };
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
  const [playoffTeams, setPlayoffTeams] = useState<number>(12);
  const [playoffAutobids, setPlayoffAutobids] = useState<number>(5);
  const [playoffConfChampTop4, setPlayoffConfChampTop4] = useState<boolean>(true);
  const navigate = useNavigate();
  const pendingFetch = useRef(false);



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
          
          // Set initial playoff defaults if preview data is available
          if (responseData.preview?.playoff) {
            setPlayoffTeams(responseData.preview.playoff.teams);
            setPlayoffAutobids(responseData.preview.playoff.conf_champ_autobids || 0);
            setPlayoffConfChampTop4(responseData.preview.playoff.conf_champ_top_4 || false);
          }
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
        
        // Set playoff defaults based on year data
        if (responseData.preview?.playoff) {
          setPlayoffTeams(responseData.preview.playoff.teams);
          setPlayoffAutobids(responseData.preview.playoff.conf_champ_autobids || 0);
          setPlayoffConfChampTop4(responseData.preview.playoff.conf_champ_top_4 || false);
        }
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

  const getLoadGameLink = (info: Info) => 
    STAGES.find(stage => stage.id === info.stage)?.path || '/';

  const filteredTeams = data.preview ? (() => {
    if (selectedConference === 'ALL') {
      return [...data.preview.conferences.flatMap(conf => conf.teams), ...data.preview.independents];
    }
    if (selectedConference === 'INDEPENDENTS') {
      return data.preview.independents;
    }
    return data.preview.conferences.find(c => c.confName === selectedConference)?.teams || [];
  })() : [];

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* Header */}
      <Typography variant="h3" align="center" sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
        Welcome to CFB Sim
      </Typography>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab label="New Game" />
          <Tab label="Load Game" />
        </Tabs>
      </Box>

      {/* New Game Flow */}
      {activeTab === 0 && (
        <Grid container spacing={2} sx={{ maxHeight: '80vh' }}>
          {/* Left Panel: Configuration */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 2, height: 'fit-content' }}>
              {/* Year Selection */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                1. Choose Season
              </Typography>
              <Select
                value={selectedYear}
                onChange={handleYearChange}
                fullWidth
                size="small"
                sx={{ mb: 3 }}
              >
                {data?.years?.map((year) => (
                  <MenuItem key={year} value={year}>{year} Season</MenuItem>
                ))}
              </Select>

              {/* Playoff Configuration */}
              {selectedYear && data.preview && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                    2. Playoff Format
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 1 }}>Playoff Teams</Typography>
                  <Select
                    value={playoffTeams}
                    onChange={(e) => {
                      const teams = Number(e.target.value);
                      setPlayoffTeams(teams);
                      const is12Team = teams === 12;
                      setPlayoffAutobids(is12Team ? 5 : 0);
                      setPlayoffConfChampTop4(is12Team);
                    }}
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
                      <Typography variant="body2" sx={{ mb: 1 }}>Conference Champion Autobids</Typography>
                      <Select
                        value={playoffAutobids}
                        onChange={(e) => setPlayoffAutobids(Number(e.target.value))}
                        fullWidth
                        size="small"
                        sx={{ mb: 2 }}
                      >
                        {Array.from({ length: (data.preview?.conferences.length || 0) + 1 }, (_, i) => (
                          <MenuItem key={i} value={i}>{i}</MenuItem>
                        ))}
                      </Select>

                      <Typography variant="body2" sx={{ mb: 1 }}>Conference Champions Top 4 Seeds</Typography>
                      <Select
                        value={playoffConfChampTop4 ? 'true' : 'false'}
                        onChange={(e) => setPlayoffConfChampTop4(e.target.value === 'true')}
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
          {selectedYear && data.preview && (
            <Grid item xs={12} lg={8}>
              <Paper sx={{ height: '75vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>3. Select Your Team</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2">Filter:</Typography>
                    <Select
                      value={selectedConference}
                      onChange={e => setSelectedConference(e.target.value)}
                      size="small"
                      sx={{ bgcolor: 'white', minWidth: 200 }}
                    >
                      <MenuItem value="ALL">All Conferences</MenuItem>
                      {data.conference_list?.sort((a, b) => a.confName.localeCompare(b.confName)).map(conf => (
                        <MenuItem key={conf.confName} value={conf.confName}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ConfLogo name={conf.confName} size={16} />
                            {conf.confName}
                          </Box>
                        </MenuItem>
                      ))}
                      <MenuItem value="INDEPENDENTS">Independents</MenuItem>
                    </Select>
                  </Box>
                </Box>

                {/* Team List */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                  {filteredTeams.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography color="text.secondary">No teams available</Typography>
                    </Box>
                  ) : (
                    filteredTeams
                      .sort((a, b) => b.prestige - a.prestige)
                      .map((team, index) => (
                        <Box
                          key={team.name}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            p: 1.5,
                            m: 0.5,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          {/* Rank */}
                          <Typography variant="h6" sx={{ minWidth: 40, color: 'primary.main', fontWeight: 'bold' }}>
                            #{index + 1}
                          </Typography>

                          {/* Team Logo */}
                          <TeamLogo name={team.name} size={40} />

                          {/* Team Info */}
                          <Box sx={{ flex: 1, ml: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {team.name} {team.mascot}
                              </Typography>
                              {team.confName && <ConfLogo name={team.confName} size={20} />}
                            </Box>
                            
                                                         {/* Ratings */}
                             <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                               {[
                                 { label: 'Current', value: team.prestige, color: 'primary.main', width: 45 },
                                 { label: 'Ceiling', value: team.ceiling, color: 'success.main', width: 35 },
                                 { label: 'Floor', value: team.floor, color: 'warning.main', width: 30 }
                               ].map(({ label, value, color, width }) => (
                                 <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                   <Typography variant="caption" sx={{ minWidth: width, color }}>
                                     {label}:
                                   </Typography>
                                   <Box sx={{ display: 'flex', gap: 0.25 }}>
                                     {Array.from({ length: 7 }, (_, i) => (
                                       <Box
                                         key={i}
                                         sx={{
                                           width: 6,
                                           height: 6,
                                           borderRadius: '50%',
                                           bgcolor: i < value ? color : 'grey.300'
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
                               button.textContent = 'Starting...';
                               
                               try {
                                 const response = await apiService.get(`/api/noncon/`, {
                                   team: team.name,
                                   year: selectedYear,
                                   playoff_teams: playoffTeams.toString(),
                                   playoff_autobids: playoffAutobids.toString(),
                                   playoff_conf_champ_top_4: playoffConfChampTop4.toString()
                                 });
                                 navigate('/noncon', { state: { fromHome: true, initialData: response } });
                               } catch (error) {
                                 console.error('Error starting new game:', error);
                                 button.disabled = false;
                                 button.textContent = 'Select';
                               }
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
      {activeTab === 1 && data.info && (
        <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
          <Typography variant="h5" sx={{ mb: 2, color: 'primary.main' }}>
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
                <TableCell>{data.info.currentYear}</TableCell>
                <TableCell>
                  <Chip 
                    label={data.info.stage === 'season'
                      ? `Season (Week ${data.info.currentWeek})`
                      : data.info.stage}
                    size="small"
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TeamLogo name={data.info.team.name} size={24} />
                    {data.info.team.name}
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          
          <Button 
            variant="contained" 
            size="large"
            href={getLoadGameLink(data.info)}
            fullWidth
          >
            Continue Game
          </Button>
        </Paper>
      )}
    </Container>
  );
};

export default Home;