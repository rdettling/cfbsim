import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiService, ROUTES } from "../services/api";
import { Conference, Team, Info, ScheduleGame } from "../interfaces";
import { TeamLink, TeamLogo, TeamInfoModal } from '../components/TeamComponents';
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

interface NonConData {
    info: Info;
    team: Team;
    schedule: ScheduleGame[];
    conferences: Conference[];
}

export const NonCon = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [data, setData] = useState<NonConData | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);
    const [selectedOpponent, setSelectedOpponent] = useState("");
    const [teamInfoModalOpen, setTeamInfoModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState("");
    const initialLoadComplete = useRef(false);

    // Check if we came from home page
    const isFromHome = location.state?.fromHome === true;
    const teamFromHome = location.state?.team;
    const yearFromHome = location.state?.year;

    const fetchData = async () => {
        try {
            console.log("Fetching noncon data, isFromHome:", isFromHome, "teamFromHome:", teamFromHome);
            
            // Only pass team and year parameters on first load from home page
            if (isFirstLoad && isFromHome && teamFromHome && yearFromHome) {
                console.log("Fetching with team and year:", teamFromHome, yearFromHome);
                const responseData = await apiService.get<NonConData>('/api/noncon', {
                    team: teamFromHome,
                    year: yearFromHome
                });
                setData(responseData);
            } else {
                // Regular fetch without parameters
                console.log("Fetching existing game data");
                const responseData = await apiService.getNonCon<NonConData>();
                console.log("Received data:", responseData);
                setData(responseData);
            }

            // Clear location state after first load to prevent reusing parameters on refresh
            if (isFirstLoad) {
                setIsFirstLoad(false);
                navigate(ROUTES.NONCON, { state: {}, replace: true });
            }
        } catch (error) {
            console.error("Error fetching noncon data:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);



    // Note: usePageRefresh was removed, manual refresh handling would need to be implemented if needed

    // Mark initial load as complete after first render
    useEffect(() => {
        if (!isFirstLoad) {
            initialLoadComplete.current = true;
        }
    }, [isFirstLoad]);

    // Force a refresh when the component mounts to ensure we get the latest data
    // after any season transitions that might have happened
    useEffect(() => {
        if (!isFromHome) {
            // If not from home, we might be coming from a previous season
            // Force a refresh to get the latest data after season transition
            const timer = setTimeout(() => {
                console.log("Forcing refresh for season transition");
                fetchData();
            }, 500); // Increased timeout to ensure backend has processed the transition
            return () => clearTimeout(timer);
        }
    }, []);

    const handleScheduleGame = async () => {
        try {
            await apiService.post('/api/schedulenc/', {
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
            const teams = await apiService.get<string[]>(`/api/fetchteams/`, { week });
            setAvailableTeams(teams);
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
                        <Typography>
                            Here is where you can schedule non-conference games. If you advance to season, the remaining non-conference games will be scheduled automatically. 
                            Your team's rivalry games are already scheduled. These games are guaranteed to happen every year.
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
                                            <TeamLink name={game.opponent.name} onTeamClick={handleTeamClick} />
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
