import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  Paper
} from '@mui/material';

interface InfoType {
  currentYear: number;
  currentWeek: number;
  stage: string;
  team?: {
    name: string;
  };
}

interface LaunchProps {
  years: string[];
  info: InfoType | null;
}

const Launch = () => {
  const [data, setData] = useState<LaunchProps>({ years: [], info: null });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/launch/');
        setData(response.data);
        if (response.data.years.length > 0) {
          setSelectedYear(response.data.years[0]);
        }
      } catch (error) {
        console.error('Error fetching launch data:', error);
      }
    };

    fetchData();
  }, []);

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
    <Container maxWidth="md" sx={{ my: 5 }}>
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
            <Box>
              <Button 
                variant="contained" 
                onClick={handleBegin}
                sx={{ mt: 2 }}
              >
                Begin
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 1}>
        {activeTab === 1 && (
          <Box>
            {data.info?.team ? (
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
                        <TableCell>Team</TableCell>
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
                        <TableCell>{data.info.team.name}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Paper>
                <Button 
                  variant="contained"
                  href={getLoadGameLink(data.info)}
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
    </Container>
  );
};

export default Launch;