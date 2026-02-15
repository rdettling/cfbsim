import { useState } from 'react';
import { Grid, Alert } from '@mui/material';
import { dataService } from '../services/data';
import { PlayoffTeam, BubbleTeam, ConferenceChampion, Team, Info, Conference } from '../interfaces';
import { TeamInfoModal } from '../components/TeamComponents';
import { useDataFetching } from '../hooks/useDataFetching';
import ChampionshipPlayoff from '../components/ChampionshipPlayoff';
import FourTeamPlayoff from '../components/FourTeamPlayoff';
import TwelveTeamPlayoff from '../components/TwelveTeamPlayoff';
import { PageLayout } from '../components/PageLayout';
import { PlayoffSettings, PlayoffTeamsList, BubbleTeamsList, ConferenceChampionsList } from '../components/PlayoffComponents';

interface PlayoffData {
    info: Info;
    team: Team;
    conferences: Conference[];
    playoff: {
        teams: number;
        autobids: number;
        conf_champ_top_4: boolean;
    };
    playoff_teams: PlayoffTeam[];
    bubble_teams: BubbleTeam[];
    conference_champions: ConferenceChampion[];
    bracket: any;
}


const Playoff = () => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => dataService.getPlayoff<PlayoffData>(),
        autoRefreshOnGameChange: true
    });
    
    // Log playoff data to help debug
    console.log('Playoff data:', data);
    console.log('Current week:', data?.info?.currentWeek);
    console.log('Bracket data:', data?.bracket);

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
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
            containerMaxWidth="xl"
        >
            {data && (
                <>
                    {/* Projection Warning */}
                    {data.info.currentWeek < 14 && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            This is a playoff projection based on current rankings. The actual playoff bracket will be determined after Week 13.
                        </Alert>
                    )}
                    
                    <PlayoffSettings settings={{
                        teams: data.playoff.teams,
                        autobids: data.playoff.autobids,
                        conf_champ_top_4: data.playoff.conf_champ_top_4
                    }} />
                    
                    {(() => {
                        return (
                            <>
                                {data.playoff.teams === 2 && (
                                    <ChampionshipPlayoff
                                        playoffTeams={data.playoff_teams}
                                        bracket={data.bracket}
                                        onTeamClick={handleTeamClick}
                                    />
                                )}

                                {data.playoff.teams === 4 && (
                                    <FourTeamPlayoff
                                        playoffTeams={data.playoff_teams}
                                        bracket={data.bracket}
                                        onTeamClick={handleTeamClick}
                                    />
                                )}

                                {data.playoff.teams === 12 && (
                                    <TwelveTeamPlayoff
                                        bracket={data.bracket}
                                        onTeamClick={handleTeamClick}
                                    />
                                )}
                            </>
                        );
                    })()}

                    {/* Information Panels */}
                    <Grid container spacing={3} sx={{ mt: 3 }}>
                        {data.playoff.teams === 12 && (
                            <Grid item xs={12} md={4}>
                                <PlayoffTeamsList 
                                    teams={data.playoff_teams} 
                                    onTeamClick={handleTeamClick} 
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} md={data.playoff.teams === 12 ? 4 : 6}>
                            <BubbleTeamsList 
                                teams={data.bubble_teams} 
                                onTeamClick={handleTeamClick} 
                            />
                        </Grid>
                        <Grid item xs={12} md={data.playoff.teams === 12 ? 4 : 6}>
                            <ConferenceChampionsList 
                                champions={data.conference_champions} 
                                onTeamClick={handleTeamClick} 
                            />
                        </Grid>
                    </Grid>
                    
                    <TeamInfoModal 
                        teamName={selectedTeam} 
                        open={modalOpen} 
                        onClose={() => setModalOpen(false)} 
                    />
                </>
            )}
        </PageLayout>
    );
};

export default Playoff;
