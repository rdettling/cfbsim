import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiService, ROUTES } from "../services/api";
import { Conference, Team, Info, ScheduleGame } from "../interfaces";
import { TeamLink, TeamLogo, TeamInfoModal } from '../components/TeamComponents';
import { useDataFetching } from '../hooks/useDataFetching';
import {
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
    Box
} from "@mui/material";
import { PageLayout } from '../components/PageLayout';

interface NonConData {
    info: Info;
    team: Team;
    schedule: ScheduleGame[];
    pending_rivalries: PendingRivalry[];
    conferences: Conference[];
}

interface PendingRivalry {
    id: number;
    teamA: string;
    teamB: string;
    name: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
}

export const NonCon = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);
    const [selectedOpponent, setSelectedOpponent] = useState("");
    const [teamInfoModalOpen, setTeamInfoModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState("");

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
                
                // Clear location state after first load to prevent reusing parameters on refresh
                setIsFirstLoad(false);
                navigate(ROUTES.NONCON, { state: {}, replace: true });
                
                return responseData;
            } else {
                // Regular fetch without parameters
                console.log("Fetching existing game data");
                const responseData = await apiService.getNonCon<NonConData>();
                console.log("Received data:", responseData);
                return responseData;
            }
        } catch (error) {
            console.error("Error fetching noncon data:", error);
            throw error;
        }
    };

    const { data, loading, error } = useDataFetching({
        fetchFunction: fetchData,
        autoRefreshOnGameChange: true
    });

    // Mark initial load as complete after first render

    const handleScheduleGame = async () => {
        try {
            await apiService.post('/api/schedulenc/', {
                opponent: selectedOpponent,
                week: selectedWeek,
            });
            handleCloseModal();
            // Trigger page data refresh to update the schedule
            window.dispatchEvent(new Event('pageDataRefresh'));
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

    return (
        <PageLayout 
            loading={loading} 
            error={error}
            navbarData={data ? {
                team: data.team,
                currentStage: data.info.stage,
                info: data.info,
                conferences: data.conferences
            } : undefined}
            containerMaxWidth="lg"
        >
            {data && (
                <>
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
                            Schedule your non-conference games here. If you advance to the
                            season, the remaining slots will be filled automatically.
                            Rivalry games are guaranteed and may be fixed to specific weeks.
                        </Typography>
                    </Box>
                </Stack>

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        gap: 3,
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    </Box>

                    <Box
                        sx={{
                            width: { xs: "100%", md: 320 },
                            flexShrink: 0,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            p: 2,
                            height: "fit-content",
                            backgroundColor: "background.paper",
                        }}
                    >
                        <Typography variant="h6" sx={{ mb: 1 }}>
                            Pending Rivalries
                        </Typography>
                        {data.pending_rivalries.length === 0 ? (
                            <Typography color="text.secondary">
                                All rivalry games are placed in the schedule.
                            </Typography>
                        ) : (
                            <Stack spacing={1.5}>
                                {data.pending_rivalries.map((rivalry) => (
                                    <Box key={rivalry.id}>
                                        <Typography variant="subtitle2">
                                            {rivalry.teamA} vs {rivalry.teamB}
                                        </Typography>
                                        <Typography color="text.secondary" variant="body2">
                                            {rivalry.name || "Rivalry game"} •{" "}
                                            {rivalry.homeTeam && rivalry.awayTeam
                                                ? `${rivalry.homeTeam} home`
                                                : "Home/away TBD"}
                                        </Typography>
                                    </Box>
                                ))}
                            </Stack>
                        )}
                    </Box>
                </Box>

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
                </>
            )}
        </PageLayout>
    );
};
