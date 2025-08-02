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
  Typography,
  Paper,
  Divider,
  Stack,
} from "@mui/material";
import Navbar from "../components/Navbar";
import { TeamLogo, TeamLink, TeamInfoModal } from "../components/TeamComponents";
import { Team, Info, Conference, Player, GameLog } from "../interfaces";
import { getGameRoute } from "../utils/routes";

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

// Star Rating Component
const StarRating = ({ count, maxStars = 5 }: { count: number; maxStars?: number }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
    {Array.from({ length: maxStars }, (_, i) => (
      <img
        key={i}
        src="/logos/star.png"
        alt="star"
        style={{
          width: 18,
          height: 18,
          opacity: i < count ? 1 : 0.25,
        }}
      />
    ))}
  </Box>
);

// Stat Item Component
const StatItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 600 }}>
      {value}
    </Typography>
  </Box>
);

// Player Header Component
const PlayerHeader = ({ 
  player, 
  team, 
  onTeamClick 
}: { 
  player: Player; 
  team: Team; 
  onTeamClick: (name: string) => void; 
}) => (
  <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
      <Box>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          {player.first} {player.last}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TeamLogo name={team.name} size={32} />
          <Typography variant="h6" color="text.secondary">
            <TeamLink name={team.name} onTeamClick={onTeamClick} />
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Position
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {player.pos.toUpperCase()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Class
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {player.year.toUpperCase()}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Overall Rating
        </Typography>
        <Typography variant="h1" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {player.rating}
        </Typography>
      </Box>
    </Box>
    
    <Divider sx={{ my: 2 }} />
    
    <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', maxWidth: 600, mx: 'auto' }}>
      <StatItem 
        label="Starter" 
        value={
          <Typography variant="h6" sx={{ fontSize: '1.5rem' }}>
            {player.starter ? "✅" : "❌"}
          </Typography>
        } 
      />
      <StatItem label="Stars" value={<StarRating count={player.stars} />} />
      <StatItem label="Development" value={<StarRating count={player.development_trait} />} />
    </Box>
  </Paper>
);

// Career Stats Table Component
const CareerStatsTable = ({ yearlyStats }: { yearlyStats: PlayerData['yearly_cumulative_stats'] }) => {
  const formatColumnTitle = (key: string) => {
    return key.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatsColumns = (stats: Record<string, any>) => {
    return Object.keys(stats).filter(key => !["class", "rating", "games"].includes(key));
  };

  const statsEntries = Object.entries(yearlyStats);
  const columns = statsEntries.length > 0 ? getStatsColumns(statsEntries[0][1]) : [];

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
        Career Statistics
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>Year</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Ovr</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>G</TableCell>
              {columns.map(key => (
                <TableCell key={key} sx={{ fontWeight: 600 }}>
                  {formatColumnTitle(key)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {statsEntries.map(([year, stats]) => (
              <TableRow key={year} hover>
                <TableCell sx={{ fontWeight: 600 }}>{year}</TableCell>
                <TableCell>{stats.class}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{stats.rating}</TableCell>
                <TableCell>{stats.games}</TableCell>
                {columns.map(key => (
                  <TableCell key={key}>{stats[key]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

// Game Logs Table Component
const GameLogsTable = ({ 
  gameLogs, 
  years, 
  currentYear, 
  selectedYear, 
  onYearChange, 
  onTeamClick, 
  onGameClick 
}: {
  gameLogs: GameLog[];
  years: number[];
  currentYear: number;
  selectedYear: string;
  onYearChange: (year: string) => void;
  onTeamClick: (name: string) => void;
  onGameClick: (gameId: number) => void;
}) => {
  const formatColumnTitle = (key: string) => {
    return key.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const statColumns = gameLogs.length > 0 
    ? Object.keys(gameLogs[0]).filter(key => key !== "game")
    : [];

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 600 }}>
          Game Logs
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Year</InputLabel>
          <Select
            value={selectedYear}
            onChange={(e) => onYearChange(e.target.value)}
            label="Year"
          >
            {years.map(year => (
              <MenuItem key={year} value={year}>{year}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>Week</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Opponent</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
              {statColumns.map(key => (
                <TableCell key={key} sx={{ fontWeight: 600 }}>
                  {formatColumnTitle(key)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {gameLogs.map(gameLog => (
              <TableRow key={gameLog.game.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{gameLog.game.weekPlayed}</TableCell>
                <TableCell sx={{ minWidth: 200 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TeamLogo name={gameLog.game.opponent.name} size={28} />
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                          #{gameLog.game.opponent.ranking}
                        </Typography>
                        <TeamLink 
                          name={gameLog.game.opponent.name} 
                          onTeamClick={onTeamClick} 
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                        {gameLog.game.opponent.record}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {gameLog.game.label}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 60 }}>
                  <Box
                    component="span"
                    onClick={() => onGameClick(gameLog.game.id)}
                    sx={{ 
                      cursor: "pointer", 
                      color: "primary.main", 
                      textDecoration: "underline",
                      fontWeight: 600,
                      whiteSpace: "nowrap"
                    }}
                  >
                    {gameLog.game.result} {gameLog.game.score}
                  </Box>
                </TableCell>
                {statColumns.map(key => (
                  <TableCell key={key}>{gameLog[key as keyof GameLog]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

// Main Player Component
export default function PlayerPage() {
  const { playerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

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

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const handleYearChange = (year: string) => {
    setSearchParams({ year });
  };

  const handleGameClick = (gameId: number) => {
    navigate(getGameRoute(gameId.toString()));
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">No data available</Alert>;

  const selectedYear = searchParams.get("year") || data.info.currentYear.toString();

  return (
    <>
      <Navbar
        team={data.team}
        currentStage={data.info.stage}
        info={data.info}
        conferences={data.conferences}
      />
      
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <PlayerHeader 
          player={data.player} 
          team={data.team} 
          onTeamClick={handleTeamClick} 
        />
        
        <CareerStatsTable yearlyStats={data.yearly_cumulative_stats} />
        
        <GameLogsTable
          gameLogs={data.game_logs}
          years={data.years}
          currentYear={data.info.currentYear}
          selectedYear={selectedYear}
          onYearChange={handleYearChange}
          onTeamClick={handleTeamClick}
          onGameClick={handleGameClick}
        />
      </Container>

      <TeamInfoModal 
        teamName={selectedTeam} 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </>
  );
}
