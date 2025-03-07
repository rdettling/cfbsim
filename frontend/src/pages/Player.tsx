import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config";
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

const PLAYER_URL = (playerId: string, year: string | null = null) => {
  const id = playerId.split("/").pop();
  return `${API_BASE_URL}/api/player/${id}${year ? `?year=${year}` : ""}`;
};

interface GameLog {
  game: {
    id: number;
    weekPlayed: number;
  };
  opponent: string;
  rank: number;
  label: string;
  result: string;
  [key: string]: any; // For dynamic stats
}

interface YearStats {
  class: string;
  rating: number;
  games: number;
  [key: string]: any; // For dynamic stats
}

interface PlayerData {
  player: {
    id: number;
    first: string;
    last: string;
    pos: string;
  };
  years: number[];
  yearly_cumulative_stats: Record<number, YearStats>;
  game_logs: GameLog[];
  info: {
    currentYear: number;
    currentWeek: number;
    stage: string;
  };
  team: {
    id: number;
    name: string;
    mascot: string;
    ranking: number;
  };
  conferences: any[]; // Update this with proper Conference type
}

export default function Player() {
  const { playerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const year = searchParams.get("year");
        const response = await axios.get(PLAYER_URL(playerId!, year));
        setData(response.data);
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

  const handleYearChange = (event: any) => {
    setSearchParams({ year: event.target.value });
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
          <h1>
            {data.player.first} {data.player.last}
          </h1>

          <h2>Career Stats</h2>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Year</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Ovr</TableCell>
                <TableCell>G</TableCell>
                {Object.keys(
                  Object.values(data.yearly_cumulative_stats)[0] || {}
                )
                  .filter((key) => !["class", "rating", "games"].includes(key))
                  .map((key) => (
                    <TableCell key={key}>
                      {key.replace(/_/g, " ").toUpperCase()}
                    </TableCell>
                  ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(data.yearly_cumulative_stats).map(
                ([year, stats]) => (
                  <TableRow key={year}>
                    <TableCell>{year}</TableCell>
                    <TableCell>{stats.class}</TableCell>
                    <TableCell>{stats.rating}</TableCell>
                    <TableCell>{stats.games}</TableCell>
                    {Object.entries(stats)
                      .filter(
                        ([key]) => !["class", "rating", "games"].includes(key)
                      )
                      .map(([key, value]) => (
                        <TableCell key={key}>{value}</TableCell>
                      ))}
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>

          <Box sx={{ my: 3 }}>
            <FormControl>
              <InputLabel>Year</InputLabel>
              <Select
                value={searchParams.get("year") || data.info.currentYear}
                onChange={handleYearChange}
                label="Year"
              >
                {data.years.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
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
                {Object.keys(data.game_logs[0] || {})
                  .filter(
                    (key) =>
                      !["game", "opponent", "rank", "label", "result"].includes(
                        key
                      )
                  )
                  .map((key) => (
                    <TableCell key={key}>
                      {key.replace(/_/g, " ").toUpperCase()}
                    </TableCell>
                  ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.game_logs.map((game) => (
                <TableRow key={game.game.id}>
                  <TableCell>{game.game.weekPlayed}</TableCell>
                  <TableCell>
                    <img
                      src={`/django-static/${game.opponent}.png`}
                      alt={game.opponent}
                      style={{ height: "20px", marginRight: "8px" }}
                    />
                    <span
                      onClick={() =>
                        navigate(`/teams/${game.opponent}/schedule`)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      #{game.rank} {game.opponent}
                    </span>
                  </TableCell>
                  <TableCell>{game.label}</TableCell>
                  <TableCell>
                    <span
                      onClick={() => navigate(`/game/${game.game.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      {game.result}
                    </span>
                  </TableCell>
                  {Object.entries(game)
                    .filter(
                      ([key]) =>
                        ![
                          "game",
                          "opponent",
                          "rank",
                          "label",
                          "result",
                        ].includes(key)
                    )
                    .map(([key, value]) => (
                      <TableCell key={key}>{value}</TableCell>
                    ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Container>
    </>
  );
}
