import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import type { NonConData } from "../types/league";
import { TeamLink, TeamLogo, TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadNonCon, startNewLeague, listAvailableTeams, scheduleNonConGame } from "../domain/league";
import {
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    Select,
    MenuItem,
    Stack,
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    GlobalStyles
} from "@mui/material";
import { PageLayout } from '../components/layout/PageLayout';

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
                console.log("Creating league with team and year:", teamFromHome, yearFromHome);
                const responseData = await startNewLeague(teamFromHome, yearFromHome);
                
                // Clear location state after first load to prevent reusing parameters on refresh
                setIsFirstLoad(false);
                navigate(ROUTES.NONCON, { state: {}, replace: true });
                
                return responseData;
            } else {
                // Regular fetch without parameters
                console.log("Fetching existing game data");
                const responseData = await loadNonCon();
                console.log("Received data:", responseData);
                return responseData;
            }
        } catch (error) {
            console.error("Error fetching noncon data:", error);
            throw error;
        }
    };

    const { data, loading, error, refetch } = useDomainData({
        fetcher: fetchData,
    });

    // Mark initial load as complete after first render

    const handleScheduleGame = async () => {
        try {
            if (selectedWeek == null) return;
            await scheduleNonConGame(selectedOpponent, selectedWeek);
            handleCloseModal();
            refetch();
        } catch (error) {
            console.error("Error scheduling game:", error);
        }
    };

    const handleOpenModal = async (week: number) => {
        try {
            const teams = await listAvailableTeams(week);
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

    const scheduledWeeks = data?.schedule.filter((game) => game.opponent).length || 0;
    const totalWeeks = data?.schedule.length || 0;
    const byeWeeks = totalWeeks - scheduledWeeks;

    return (
        <PageLayout 
            loading={loading} 
            error={error}
            navbarData={data ? { team: data.team, currentStage: data.info.stage, info: data.info, conferences: data.conferences } : undefined}
            containerMaxWidth="lg"
        >
            {data && (
                <>
                <GlobalStyles
                    styles={{
                        "@import":
                            "url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap')",
                    }}
                />
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 3 }}
                >
                    <Box
                        sx={{
                            flex: 1,
                            p: 3,
                            borderRadius: 3,
                            background:
                                "linear-gradient(135deg, #f4efe6 0%, #dbe8f7 100%)",
                            border: "1px solid",
                            borderColor: "divider",
                            fontFamily: "'Space Grotesk', sans-serif",
                        }}
                    >
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {data.team.name}
                        </Typography>
                        <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                            Build your non-conference slate. The remaining slots will
                            auto-fill when you advance the season.
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                            <Chip
                                label={`Non-Conf: ${data.team.nonConfGames}/${data.team.nonConfLimit}`}
                                color="primary"
                                sx={{ fontWeight: 600 }}
                            />
                            <Chip
                                label={`Weeks Scheduled: ${scheduledWeeks}/${totalWeeks}`}
                                sx={{ fontWeight: 600 }}
                            />
                            <Chip
                                label={`Bye Weeks: ${byeWeeks}`}
                                color="success"
                                sx={{ fontWeight: 600 }}
                            />
                        </Stack>
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
                        <Stack spacing={2}>
                            {data.schedule.map((game) => (
                                <Card
                                    key={game.weekPlayed}
                                    sx={{
                                        borderRadius: 3,
                                        border: "1px solid",
                                        borderColor: "divider",
                                    }}
                                >
                                    <CardContent>
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={2}
                                            alignItems={{ xs: "flex-start", sm: "center" }}
                                            justifyContent="space-between"
                                        >
                                            <Stack spacing={1} sx={{ minWidth: 220 }}>
                                                <Typography
                                                    variant="overline"
                                                    sx={{ letterSpacing: 1.5 }}
                                                >
                                                    Week {game.weekPlayed}
                                                </Typography>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                        {game.opponent ? "Game Scheduled" : "Open Week"}
                                                    </Typography>
                                                    {game.opponent && game.location && (
                                                        <Chip
                                                            label={game.location}
                                                            size="small"
                                                            color={
                                                                game.location === "Home"
                                                                    ? "success"
                                                                    : game.location === "Away"
                                                                    ? "warning"
                                                                    : "default"
                                                            }
                                                            sx={{ fontWeight: 600 }}
                                                        />
                                                    )}
                                                </Stack>
                                                {game.label && (
                                                    <Typography color="text.secondary" variant="body2">
                                                        {game.label}
                                                    </Typography>
                                                )}
                                            </Stack>

                                            <Box sx={{ flex: 1 }}>
                                                {game.opponent ? (
                                                    <Stack
                                                        direction="row"
                                                        spacing={2}
                                                        alignItems="center"
                                                    >
                                                        {game.opponent.ranking && (
                                                            <Chip
                                                                label={`#${game.opponent.ranking}`}
                                                                size="small"
                                                                sx={{ fontWeight: 600 }}
                                                            />
                                                        )}
                                                        <TeamLogo name={game.opponent.name} size={42} />
                                                        <TeamLink
                                                            name={game.opponent.name}
                                                            onTeamClick={handleTeamClick}
                                                        />
                                                    </Stack>
                                                ) : (
                                                    <Typography color="text.secondary">
                                                        Slot available for non-conference scheduling.
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Box>
                                                {!game.opponent &&
                                                data.team.nonConfGames < data.team.nonConfLimit ? (
                                                    <Button
                                                        variant="contained"
                                                        onClick={() => handleOpenModal(game.weekPlayed)}
                                                    >
                                                        Schedule Game
                                                    </Button>
                                                ) : (
                                                    <Chip
                                                        label={game.opponent ? "Locked" : "Auto-fill"}
                                                        variant="outlined"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                )}
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
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
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                            Your Pending Rivalries
                        </Typography>
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                            These rivalry games will be placed once the full schedule
                            is generated.
                        </Typography>
                        {data.pending_rivalries.length === 0 ? (
                            <Typography color="text.secondary">
                                All rivalry games are already placed.
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
                                        <Divider sx={{ mt: 1.5 }} />
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
