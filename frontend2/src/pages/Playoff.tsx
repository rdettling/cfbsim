import { useState } from 'react';
import { Grid, Alert } from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { loadPlayoff } from '../domain/league';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamComponents';
import ChampionshipPlayoff from '../components/playoff/ChampionshipPlayoff';
import FourTeamPlayoff from '../components/playoff/FourTeamPlayoff';
import TwelveTeamPlayoff from '../components/playoff/TwelveTeamPlayoff';
import { PlayoffSettings, PlayoffTeamsList, BubbleTeamsList, ConferenceChampionsList } from '../components/playoff/PlayoffComponents';

const Playoff = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const { data, loading, error } = useDomainData({
    fetcher: loadPlayoff,
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      navbarData={
        data
          ? {
              team: data.team,
              currentStage: data.info.stage,
              info: data.info,
              conferences: data.conferences,
            }
          : undefined
      }
      containerMaxWidth="xl"
    >
      {data && (
        <>
          {data.is_projection && (
            <Alert severity="info" sx={{ mb: 3 }}>
              This is a playoff projection based on current rankings. The actual playoff bracket will be determined after Week {data.info.lastWeek - 1}.
            </Alert>
          )}

          <PlayoffSettings
            settings={{
              teams: data.playoff.teams,
              autobids: data.playoff.autobids,
              conf_champ_top_4: data.playoff.conf_champ_top_4,
            }}
          />

          {data.playoff.teams === 2 && (
            <ChampionshipPlayoff playoffTeams={data.playoff_teams} bracket={data.bracket} onTeamClick={handleTeamClick} />
          )}

          {data.playoff.teams === 4 && (
            <FourTeamPlayoff playoffTeams={data.playoff_teams} bracket={data.bracket} onTeamClick={handleTeamClick} />
          )}

          {data.playoff.teams === 12 && (
            <TwelveTeamPlayoff bracket={data.bracket} onTeamClick={handleTeamClick} />
          )}

          <Grid container spacing={3} sx={{ mt: 3 }}>
            {data.playoff.teams === 12 && (
              <Grid size={{ xs: 12, md: 4 }}>
                <PlayoffTeamsList teams={data.playoff_teams} onTeamClick={handleTeamClick} />
              </Grid>
            )}
            <Grid size={{ xs: 12, md: data.playoff.teams === 12 ? 4 : 6 }}>
              <BubbleTeamsList teams={data.bubble_teams} onTeamClick={handleTeamClick} />
            </Grid>
            <Grid size={{ xs: 12, md: data.playoff.teams === 12 ? 4 : 6 }}>
              <ConferenceChampionsList champions={data.conference_champions} onTeamClick={handleTeamClick} />
            </Grid>
          </Grid>

          <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}
    </PageLayout>
  );
};

export default Playoff;
