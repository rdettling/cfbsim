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
import OffseasonNavBar from '../components/OffseasonNavBar';

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
        stage: string;
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
                const new_game = searchParams.get("new_game");
                
                const response = await axios.get(
                    `${API_BASE_URL}/api/noncon/?team=${team}&year=${year}&new_game=${new_game}`
                );
                setData(response.data);
            } catch (error) {
                // Simplified error handling
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
                `${API_BASE_URL}/api/fetchteams/?week=${week}`
            );
            setAvailableTeams(response.data);
            setSelectedWeek(week);
            setOpenModal(true);
        } catch (error) {
            // Simplified error handling
        }
    };

    const handleScheduleGame = async () => {
        try {
            const year = searchParams.get("year");
            const team = searchParams.get("team");
            
            await axios.post(`${API_BASE_URL}/api/schedulenc/`, {
                opponent: selectedOpponent,
                week: selectedWeek,
            });
            
            setOpenModal(false);
            
            // Refresh data 
            const response = await axios.get(
                `${API_BASE_URL}/api/noncon/?team=${team}&year=${year}`
            );
            setData(response.data);
        } catch (error) {
            // Simplified error handling
        }
    };

    if (!data) return <Typography>Loading...</Typography>;

    return (
        <>
            <OffseasonNavBar 
                team={{
                    id: data.team.id,
                    name: data.team.name
                }}
                currentStage={data.info.stage}
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
                                    {(game.teamA || game.teamB) && (
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <Box sx={{ width: 40, height: 40 }}>
                                                {game.teamA?.id === data.team.id ? (
                                                    <img
                                                        src={`/assets/logos/teams/${game.teamB?.name}.png`}
                                                        alt={`${game.teamB?.name} logo`}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit: "contain",
                                                        }}
                                                    />
                                                ) : (
                                                    <img
                                                        src={`/assets/logos/teams/${game.teamA?.name}.png`}
                                                        alt={`${game.teamA?.name} logo`}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit: "contain",
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                            <Stack>
                                                <Typography>
                                                    {game.teamA?.id === data.team.id ? game.teamB?.name : game.teamA?.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {game.teamA?.id === data.team.id ? game.labelA : game.labelB}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    ) || "No Game"}
                                </TableCell>
                                <TableCell>
                                    {!game.teamA && !game.teamB &&
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
        </>
    );
};
