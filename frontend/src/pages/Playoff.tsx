import { useState } from 'react';
import { apiService } from '../services/api';
import { Team, Info, Conference, PlayoffTeam, BubbleTeam, ConferenceChampion } from '../interfaces';
import { TeamInfoModal } from '../components/TeamComponents';
import { DataPage } from '../components/DataPage';
import ChampionshipPlayoff from '../components/ChampionshipPlayoff';
import FourTeamPlayoff from '../components/FourTeamPlayoff';
import TwelveTeamPlayoff from '../components/TwelveTeamPlayoff';



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

// Helper function to get playoff format name
const getPlayoffFormatName = (teams: number) => {
    switch (teams) {
        case 2: return 'Championship';
        case 4: return '4-Team Playoff';
        case 12: return '12-Team Playoff';
        default: return `${teams}-Team Playoff`;
    }
};

const Playoff = () => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    return (
        <>
            <DataPage
                fetchFunction={() => apiService.getPlayoff<PlayoffData>()}
                dependencies={[]}
            >
                {(data) => {
                    const playoffFormat = data.playoff.teams;
                    const formatName = getPlayoffFormatName(playoffFormat);
                    const title = `${formatName} ${data.info.stage === 'playoff' ? '' : 'Projection'}`;

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
                }}
            </DataPage>
            
            <TeamInfoModal 
                teamName={selectedTeam} 
                open={modalOpen} 
                onClose={() => setModalOpen(false)} 
            />
        </>
    );
};

export default Playoff;
