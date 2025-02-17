import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from '../config';
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

interface Team {
    id: number;
    name: string;
    nonConfGames: number;
    nonConfLimit: number;
}

interface Game {
    id: number | null;
    weekPlayed: number;
    teamA: number | null;
    teamB: number | null;
    labelA: string;
    labelB: string;
}

interface NonConProps {
    info: {
        currentWeek: number;
        currentYear: number;
    };
    team: Team;
    schedule: Game[];
}

export const NonCon = () => {
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<NonConProps | null>(null);
    const [openModal, setOpenModal] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);
    const [selectedOpponent, setSelectedOpponent] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const team = searchParams.get("team");
                const year = searchParams.get("year");
                console.log("Requesting with params:", { team, year }); // Debug log
                
                const response = await axios.get(
                    `${API_BASE_URL}/api/noncon/?team=${team}&year=${year}`
                );

                console.log("Full URL:", `${API_BASE_URL}/api/noncon/?team=${team}&year=${year}`); // Debug log
                console.log("Response:", response.data);
                setData(response.data);
            } catch (error) {
                console.error("Error fetching noncon data:", error);
                if (axios.isAxiosError(error)) {
                    console.error("Response data:", error.response?.data);
                    console.error("Request URL:", error.config?.url); // Debug log
                }
            }
        };

        fetchData();
    }, [searchParams]);

    const handleCloseModal = () => {
        setOpenModal(false);
        setSelectedOpponent("");
        setSelectedWeek(null);
    };

    const handleOpenModal = async (week: number) => {
        try {
            const response = await axios.get<string[]>(
                `/api/fetchteams/?week=${week}`
            );
            setAvailableTeams(response.data);
            setSelectedWeek(week);
            setOpenModal(true);
        } catch (error) {
            console.error("Error fetching available teams:", error);
        }
    };

    const handleScheduleGame = async () => {
        try {
            const year = searchParams.get("year");
            await axios.post("/api/schedulenc/", {
                opponent: selectedOpponent,
                week: selectedWeek,
                year: year
            });
            setOpenModal(false);
            // Refresh data
            const response = await axios.get(
                `/api/noncon/?team=${searchParams.get("team_name")}&year=${searchParams.get("year")}`
            );
            setData(response.data);
        } catch (error) {
            console.error("Error scheduling game:", error);
        }
    };

    if (!data) return <Typography>Loading...</Typography>;

    return (
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
                                {game.teamB && (
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Box sx={{ width: 40, height: 40 }}>
                                            <img
                                                src={`/assets/logos/teams/${game.teamB}.png`}
                                                alt={`Team logo`}
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "contain",
                                                }}
                                            />
                                        </Box>
                                        <Typography>{game.labelB}</Typography>
                                    </Stack>
                                ) || "No Game"}
                            </TableCell>
                            <TableCell>
                                {!game.teamB &&
                                    data.team.nonConfGames < data.team.nonConfLimit && (
                                        <Button
                                            variant="contained"
                                            onClick={() => handleOpenModal(game.weekPlayed)}
                                        >
                                            Schedule Game
                                        </Button>
                                    )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={openModal} onClose={handleCloseModal}>
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
    );
};
