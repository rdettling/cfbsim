import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { apiService, usePageRefresh } from "../services/api";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Container,
} from "@mui/material";
import Navbar from "../components/Navbar";
import { TeamLogo, TeamLink, TeamInfoModal } from "../components/TeamComponents";
import { Team, Info, Conference, Player, GameLog } from "../interfaces";

// Simple PlayerData interface that builds on existing interfaces
interface PlayerData {
  player: Player;
  team: Team;
  info: Info;
  conferences: Conference[];
  years: number[];
  yearly_cumulative_stats: Record<string, {
    class: string;
    rating: number;
    games: number;
    [key: string]: string | number;
  }>;
  game_logs: GameLog[];
}

export default function PlayerPage() {
  const { playerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  // Format column title from snake_case to Title Case
  const formatColumnTitle = (key: string) => {
    return key.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Use the new usePageRefresh from api.ts
  usePageRefresh<PlayerData>(setData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const year = searchParams.get("year");
        const id = playerId?.split("/").pop();
        
        if (id) {
          const responseData = await apiService.getPlayer<PlayerData>(id, year || undefined);
          setData(responseData);
        }
      } catch (error) {
        console.error("Error fetching player data:", error);
        setError("Failed to load player data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [playerId, searchParams]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">No data available</Alert>;

  // Get stats columns excluding certain fields
  const getStatsColumns = (stats: Record<string, any>) => {
    return Object.keys(stats).filter(key => !["class", "rating", "games"].includes(key));
  };

  // Handle team click to open the team info modal
  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  return (
    <>
      {data && (
        <Navbar
          team={data.team}
          currentStage={data.info.stage}
          info={data.info}
          conferences={data.conferences}
        />
      )}
      <Container>
        <Box>
          <h1>{data.player.first} {data.player.last}</h1>

          <h2>Career Stats</h2>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Year</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Ovr</TableCell>
                <TableCell>G</TableCell>
                {getStatsColumns(Object.values(data.yearly_cumulative_stats)[0] || {})
                  .map(key => (
                    <TableCell key={key}>{formatColumnTitle(key)}</TableCell>
                  ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(data.yearly_cumulative_stats).map(([year, stats]) => (
                <TableRow key={year}>
                  <TableCell>{year}</TableCell>
                  <TableCell>{stats.class}</TableCell>
                  <TableCell>{stats.rating}</TableCell>
                  <TableCell>{stats.games}</TableCell>
                  {getStatsColumns(stats).map(key => (
                    <TableCell key={key}>{stats[key]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Box sx={{ my: 3 }}>
            <FormControl>
              <InputLabel>Year</InputLabel>
              <Select
                value={searchParams.get("year") || data.info.currentYear}
                onChange={(e: any) => setSearchParams({ year: e.target.value })}
                label="Year"
              >
                {data.years.map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <h2>Game Logs</h2>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Week</TableCell>
                <TableCell>Opponent</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Result</TableCell>
                {data.game_logs[0] && Object.keys(data.game_logs[0])
                  .filter(key => key !== "game")
                  .map(key => (
                    <TableCell key={key}>{formatColumnTitle(key)}</TableCell>
                  ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.game_logs.map(gameLog => (
                <TableRow key={gameLog.game.id}>
                  <TableCell>{gameLog.game.weekPlayed}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TeamLogo name={gameLog.game.opponent.name} size={20} />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        #{gameLog.game.opponent.ranking}{' '}
                        <TeamLink 
                          name={gameLog.game.opponent.name} 
                          onTeamClick={handleTeamClick} 
                        />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{gameLog.game.label}</TableCell>
                  <TableCell>
                    <Box
                      component="span"
                      onClick={() => navigate(`/game/${gameLog.game.id}`)}
                      sx={{ 
                        cursor: "pointer", 
                        color: "#1976d2", 
                        textDecoration: "underline" 
                      }}
                    >
                      {gameLog.game.result} {gameLog.game.score}
                    </Box>
                  </TableCell>
                  {Object.entries(gameLog)
                    .filter(([key]) => key !== "game")
                    .map(([key, value]) => (
                      <TableCell key={key}>{value}</TableCell>
                    ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Container>

      {/* Team Info Modal */}
      <TeamInfoModal 
        teamName={selectedTeam} 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </>
  );
}
