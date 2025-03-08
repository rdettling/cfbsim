import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Conference, Team, Info, ScheduleGame } from "../interfaces";
import { TeamLink, TeamLogo } from '../components/TeamComponents';
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
import TeamInfoModal from "../components/TeamInfoModal";

// API endpoints
const NONCON_URL = `${API_BASE_URL}/api/noncon/`;
const SCHEDULE_NC_URL = `${API_BASE_URL}/api/schedulenc/`;
const FETCH_TEAMS_URL = `${API_BASE_URL}/api/fetchteams/`;

export const NonCon = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isFirstLoad, setIsFirstLoad] = useState(true);
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
    const [teamInfoModalOpen, setTeamInfoModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState("");

    // Check if we came from home page
    const isFromHome = location.state?.fromHome === true;

    const fetchData = async () => {
        try {
            const params = new URLSearchParams();
            if (isFromHome && isFirstLoad) {
                params.append('team', location.state?.team);
                params.append('year', location.state?.year);
            }

            const response = await axios.get(
                `${NONCON_URL}${params.toString() ? `?${params.toString()}` : ''}`
            );
            setData(response.data);
            
            if (isFirstLoad) {
                setIsFirstLoad(false);
                navigate('/noncon', { state: {} });
            }
        } catch (error) {
            console.error("Error fetching noncon data:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleScheduleGame = async () => {
        try {
            await axios.post(SCHEDULE_NC_URL, {
                opponent: selectedOpponent,
                week: selectedWeek,
            });
            handleCloseModal();
            fetchData();
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

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setTeamInfoModalOpen(true);
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
                                            <TeamLogo name={game.opponent.name} size={40} />
                                            <TeamLink 
                                                name={game.opponent.name} 
                                                onTeamClick={handleTeamClick}
                                            />
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

                <TeamInfoModal 
                    teamName={selectedTeam} 
                    open={teamInfoModalOpen} 
                    onClose={() => setTeamInfoModalOpen(false)} 
                />
            </Container>
        </>
    );
};
