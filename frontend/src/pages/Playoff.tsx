import { useState } from 'react';
import { apiService } from '../services/api';
import { PlayoffTeam, BubbleTeam, ConferenceChampion, Team, Info, Conference } from '../interfaces';
import { TeamInfoModal } from '../components/TeamComponents';
import { useDataFetching } from '../hooks/useDataFetching';
import ChampionshipPlayoff from '../components/ChampionshipPlayoff';
import FourTeamPlayoff from '../components/FourTeamPlayoff';
import TwelveTeamPlayoff from '../components/TwelveTeamPlayoff';
import { PageLayout } from '../components/PageLayout';

interface PlayoffData {
    info: Info;
    team: Team;
    conferences: Conference[];
    playoff: {
        teams: number;
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
        fetchFunction: () => apiService.getPlayoff<PlayoffData>(),
        autoRefreshOnGameChange: true
    });

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
                    {(() => {
                        const playoffFormat = data.playoff.teams;

                        return (
                            <>
                                {playoffFormat === 2 && (
                                    <ChampionshipPlayoff
                                        playoffTeams={data.playoff_teams}
                                        bubbleTeams={data.bubble_teams}
                                        conferenceChampions={data.conference_champions}
                                        onTeamClick={handleTeamClick}
                                    />
                                )}

                                {playoffFormat === 4 && (
                                    <FourTeamPlayoff
                                        playoffTeams={data.playoff_teams}
                                        bubbleTeams={data.bubble_teams}
                                        conferenceChampions={data.conference_champions}
                                        onTeamClick={handleTeamClick}
                                    />
                                )}

                                {playoffFormat === 12 && (
                                    <TwelveTeamPlayoff
                                        playoffTeams={data.playoff_teams}
                                        bubbleTeams={data.bubble_teams}
                                        conferenceChampions={data.conference_champions}
                                        bracket={data.bracket}
                                        onTeamClick={handleTeamClick}
                                    />
                                )}
                            </>
                        );
                    })()}
                    
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
