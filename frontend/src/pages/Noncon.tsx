import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Conference, Team, Info, Game } from "../interfaces";
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

export const NonCon = () => {
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<{
        info: Info;
        team: Team;
        schedule: Game[];
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
                `${API_BASE_URL}/api/noncon/?team=${team}&year=${year}&new_game=${new_game}`
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
            await axios.post(`${API_BASE_URL}/api/schedulenc/`, {
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
                `${API_BASE_URL}/api/fetchteams/?week=${week}`
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
                team={{
                    id: data.team.id,
                    name: data.team.name,
                }}
                currentStage={data.info.stage}
                info={{
                    currentYear: data.info.currentYear,
                    currentWeek: data.info.currentWeek,
                }}
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
                                            <Box sx={{ width: 40, height: 40 }}>
                                                <img
                                                    src={`/logos/teams/${game.opponent}.png`}
                                                    alt={`${game.opponent} logo`}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                    }}
                                                />
                                            </Box>
                                            <Typography>{game.opponent}</Typography>
                                        </Stack>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {game.opponent === null &&
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
