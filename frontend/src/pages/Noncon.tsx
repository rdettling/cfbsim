import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Conference, Team, Info, ScheduleGame } from "../interfaces";
import axios from "axios";
import {
    Container,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    Select,
    MenuItem,
    Stack,
    Box,
} from "@mui/material";
import Navbar from "../components/Navbar";

// API endpoints
const NONCON_URL = `${API_BASE_URL}/api/noncon/`;
const SCHEDULE_NC_URL = `${API_BASE_URL}/api/schedulenc/`;
const FETCH_TEAMS_URL = `${API_BASE_URL}/api/fetchteams/`;

// Asset URLs
const TEAM_LOGO_URL = "/logos/teams/";

export const NonCon = () => {
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<{
        info: Info;
        team: Team;
        schedule: ScheduleGame[];
        conferences: Conference[];
    } | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);
    const [selectedOpponent, setSelectedOpponent] = useState("");

    const fetchData = async () => {
        try {
            const team = searchParams.get("team");
            const year = searchParams.get("year");
            const new_game = searchParams.get("new_game");

            const response = await axios.get(
                `${NONCON_URL}?team=${team}&year=${year}&new_game=${new_game}`
            );
            setData(response.data);
        } catch (error) {
            console.error("Error fetching noncon data:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [searchParams]);

    const handleScheduleGame = async () => {
        try {
            await axios.post(SCHEDULE_NC_URL, {
                opponent: selectedOpponent,
                week: selectedWeek,
            });
            handleCloseModal();
            fetchData(); // Refresh data after scheduling
        } catch (error) {
            console.error("Error scheduling game:", error);
        }
    };

    const handleOpenModal = async (week: number) => {
        try {
            const response = await axios.get<string[]>(
                `${FETCH_TEAMS_URL}?week=${week}`
            );
            setAvailableTeams(response.data);
            setSelectedWeek(week);
            setModalOpen(true);
        } catch (error) {
            console.error("Error fetching available teams:", error);
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedOpponent("");
        setSelectedWeek(null);
    };

    if (!data) return <Typography>Loading...</Typography>;

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container maxWidth="lg" sx={{ mt: 5 }}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 3 }}
                >
                    <Box>
                        <Typography variant="h4">{data.team.name}</Typography>
                        <Typography>
                            Non-Conference Games Scheduled: {data.team.nonConfGames} /{" "}
                            {data.team.nonConfLimit}
                        </Typography>
                    </Box>
                </Stack>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Week</TableCell>
                            <TableCell>Opponent</TableCell>
                            <TableCell>Label</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.schedule.map((game) => (
                            <TableRow key={game.weekPlayed}>
                                <TableCell>Week {game.weekPlayed}</TableCell>
                                <TableCell>
                                    {game.opponent && (
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            {game.opponent.ranking && (
                                                <Typography>#{game.opponent.ranking}</Typography>
                                            )}
                                            <Box sx={{ width: 40, height: 40 }}>
                                                <img
                                                    src={`${TEAM_LOGO_URL}${game.opponent.name}.png`}
                                                    alt={`${game.opponent.name} logo`}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                    }}
                                                />
                                            </Box>
                                            <Typography>{game.opponent.name}</Typography>
                                        </Stack>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {!game.opponent &&
                                        data.team.nonConfGames < data.team.nonConfLimit ? (
                                        <Button
                                            variant="contained"
                                            onClick={() => handleOpenModal(game.weekPlayed)}
                                        >
                                            Schedule Game
                                        </Button>
                                    ) : (
                                        game.label
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Dialog open={modalOpen} onClose={handleCloseModal}>
                    <DialogTitle>Schedule Non-Conference Game</DialogTitle>
                    <DialogContent>
                        <Select
                            value={selectedOpponent}
                            onChange={(e) => setSelectedOpponent(e.target.value)}
                            fullWidth
                        >
                            {availableTeams.map((team) => (
                                <MenuItem key={team} value={team}>
                                    {team}
                                </MenuItem>
                            ))}
                        </Select>
                        <Button
                            variant="contained"
                            onClick={handleScheduleGame}
                            disabled={!selectedOpponent}
                            sx={{ mt: 2 }}
                        >
                            Schedule
                        </Button>
                    </DialogContent>
                </Dialog>
            </Container>
        </>
    );
};
