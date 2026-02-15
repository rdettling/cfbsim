import { useState } from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Box,
  Chip,
  Button,
  Typography,
} from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { loadRankings } from '../domain/league';
import type { Team, Info, Conference } from '../types/domain';
import { TeamInfoModal, TeamLink, TeamLogo } from '../components/team/TeamComponents';
import { InlineLastWeek, InlineThisWeek } from '../components/team/InlineGameComponents';
import { PageLayout } from '../components/layout/PageLayout';

interface RankingsData {
  info: Info;
  team: Team;
  rankings: Team[];
  conferences: Conference[];
}

const Rankings = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [showAllTeams, setShowAllTeams] = useState(false);

  const { data, loading, error } = useDomainData<RankingsData>({
    fetcher: () => loadRankings(),
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const displayedTeams = data
    ? showAllTeams
      ? data.rankings
      : data.rankings.slice(0, 25)
    : [];

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
          <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden', minWidth: 1200 }}>
            <Table sx={{ minWidth: 1200 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '80px' }}>
                    Rank
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '200px' }}>
                    Team
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '120px' }}>
                    Record
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '120px' }}>
                    Poll Score
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '150px' }}>
                    Strength of Record
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', minWidth: '250px' }}>
                    Last Week
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', minWidth: '250px' }}>
                    This Week
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedTeams.map((team, index) => (
                  <TableRow
                    key={team.name}
                    sx={{
                      backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                      '&:hover': { backgroundColor: 'grey.100' },
                    }}
                  >
                    <TableCell sx={{ width: '80px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {team.ranking}
                        </Typography>
                        {team.movement !== 0 && (
                          <Chip
                            label={`${team.movement > 0 ? '+' : ''}${team.movement}`}
                            size="small"
                            color={team.movement > 0 ? 'success' : 'error'}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '200px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TeamLogo name={team.name} />
                        <TeamLink name={team.name} onTeamClick={handleTeamClick} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '120px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', whiteSpace: 'nowrap' }}>
                        {team.record}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ width: '120px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {team.poll_score !== undefined ? team.poll_score.toFixed(1) : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ width: '150px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {team.strength_of_record !== undefined
                          ? team.strength_of_record.toFixed(1)
                          : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: '250px' }}>
                      <InlineLastWeek team={team as any} onTeamClick={handleTeamClick} />
                    </TableCell>
                    <TableCell sx={{ minWidth: '250px' }}>
                      <InlineThisWeek team={team as any} onTeamClick={handleTeamClick} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {!showAllTeams && data.rankings.length > 25 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setShowAllTeams(true)}
                sx={{ px: 4, py: 1.5, fontSize: '1rem', fontWeight: 600, borderRadius: 2, textTransform: 'none' }}
              >
                Show All {data.rankings.length} Teams
              </Button>
            </Box>
          )}

          {showAllTeams && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setShowAllTeams(false)}
                sx={{ px: 4, py: 1.5, fontSize: '1rem', fontWeight: 600, borderRadius: 2, textTransform: 'none' }}
              >
                Show Top 25 Only
              </Button>
            </Box>
          )}

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

export default Rankings;
