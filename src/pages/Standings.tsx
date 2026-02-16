import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Box,
} from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { loadStandings } from '../domain/league';
import type { StandingsPageData } from '../types/pages';
import { TeamInfoModal, TeamLink, TeamLogo, ConfLogo } from '../components/team/TeamComponents';
import { InlineLastWeek, InlineThisWeek } from '../components/team/InlineGameComponents';
import { PageLayout } from '../components/layout/PageLayout';

const StandingsTable = ({
  data,
  conference_name,
  onTeamClick,
}: {
  data: StandingsPageData;
  conference_name: string | undefined;
  onTeamClick: (name: string) => void;
}) => (
  <TableContainer
    component={Paper}
    sx={{
      borderRadius: 3,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      minWidth: 1000,
    }}
  >
    <Table sx={{ minWidth: 1000 }}>
      <TableHead>
        <TableRow sx={{ backgroundColor: 'primary.main' }}>
          <TableCell
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              width: '80px',
              textAlign: 'center',
            }}
          >
            Rank
          </TableCell>
          <TableCell
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              minWidth: '250px',
            }}
          >
            Team
          </TableCell>
          {conference_name !== 'independent' && (
            <TableCell
              sx={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1rem',
                width: '100px',
                textAlign: 'center',
              }}
            >
              Conf
            </TableCell>
          )}
          <TableCell
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              width: '100px',
              textAlign: 'center',
            }}
          >
            Overall
          </TableCell>
          <TableCell
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              minWidth: '200px',
            }}
          >
            Last Week
          </TableCell>
          <TableCell
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              minWidth: '200px',
            }}
          >
            This Week
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.teams.map((team, index) => (
          <TableRow
            key={team.name}
            sx={{
              backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
              '&:hover': {
                backgroundColor: 'grey.100',
                transition: 'background-color 0.2s ease',
              },
              height: '72px',
            }}
          >
            <TableCell
              sx={{
                width: '80px',
                textAlign: 'center',
                py: 2,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  color: index < 3 ? 'primary.main' : 'text.primary',
                }}
              >
                {index + 1}
              </Typography>
            </TableCell>
            <TableCell sx={{ minWidth: '250px', py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TeamLogo name={team.name} size={40} />
                <Box>
                  <TeamLink name={team.name} onTeamClick={onTeamClick} />
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary', fontSize: '0.75rem' }}
                  >
                    {team.confName}
                  </Typography>
                </Box>
              </Box>
            </TableCell>
            {conference_name !== 'independent' && (
              <TableCell
                sx={{
                  width: '100px',
                  textAlign: 'center',
                  py: 2,
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {team.confWins}-{team.confLosses}
                </Typography>
              </TableCell>
            )}
            <TableCell
              sx={{
                width: '100px',
                textAlign: 'center',
                py: 2,
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {team.totalWins}-{team.totalLosses}
              </Typography>
            </TableCell>
            <TableCell sx={{ minWidth: '200px', py: 2 }}>
              <InlineLastWeek team={team as any} onTeamClick={onTeamClick} />
            </TableCell>
            <TableCell sx={{ minWidth: '200px', py: 2 }}>
              <InlineThisWeek team={team as any} onTeamClick={onTeamClick} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const Standings = () => {
  const { conference_name } = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const { data, loading, error } = useDomainData({
    fetcher: () => {
      if (!conference_name) throw new Error('No conference specified');
      return loadStandings(conference_name);
    },
    deps: [conference_name],
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
      containerMaxWidth="lg"
    >
      {data && (
        <>
          <Box
            sx={{
              textAlign: 'center',
              mb: 5,
              py: 4,
              background:
                'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%)',
              borderRadius: 3,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                background:
                  'linear-gradient(45deg, rgba(25, 118, 210, 0.1), rgba(25, 118, 210, 0.05))',
                borderRadius: '50%',
                zIndex: 0,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -30,
                left: -30,
                width: 150,
                height: 150,
                background:
                  'linear-gradient(45deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.03))',
                borderRadius: '50%',
                zIndex: 0,
              }}
            />

            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {conference_name !== 'independent' && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <ConfLogo name={data.conference} size={120} />
                </Box>
              )}
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1,
                  fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                }}
              >
                {conference_name === 'independent'
                  ? 'Independent Teams'
                  : `${data.conference} Standings`}
              </Typography>
              <Typography
                variant="h6"
                sx={{ color: 'text.secondary', fontWeight: 400, fontSize: '1.1rem' }}
              >
                Conference Rankings &amp; Team Performance
              </Typography>
            </Box>
          </Box>

          <StandingsTable
            data={data}
            conference_name={conference_name}
            onTeamClick={handleTeamClick}
          />

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

export default Standings;
