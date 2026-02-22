import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  TableContainer,
  Paper,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
} from '@mui/material';
import TeamHeader from '../components/team/TeamHeader';
import { useDomainData } from '../domain/hooks';
import { loadTeamRoster } from '../domain/league';
import { PageLayout } from '../components/layout/PageLayout';
import type { PlayerRecord } from '../types/db';

const Roster = () => {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const [positionFilter, setPositionFilter] = useState('');

  const { data, loading, error } = useDomainData({
    fetcher: () => loadTeamRoster(teamName),
    deps: [teamName],
  });

  React.useEffect(() => {
    document.title = teamName ? `${teamName} Roster` : 'Roster';
    return () => {
      document.title = 'College Football';
    };
  }, [teamName]);

  const yearLabels = {
    fr: 'Freshman',
    so: 'Sophomore',
    jr: 'Junior',
    sr: 'Senior',
  } as const;

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
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
    >
      {data && (
        <>
          <TeamHeader
            team={data.team}
            teams={data.teams}
            onTeamChange={(newTeam) => navigate(`/${newTeam}/roster`)}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 2 }}>
            <Typography variant="h5">Team Roster</Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Position Filter</InputLabel>
              <Select
                value={positionFilter}
                onChange={(event) => setPositionFilter(event.target.value as string)}
                label="Position Filter"
              >
                <MenuItem value="">All Positions</MenuItem>
                {data.positions.map((pos: string) => (
                  <MenuItem key={pos} value={pos}>
                    {pos}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: data.team.colorPrimary || 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Year</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.positions
                  .filter((position: string) => positionFilter === '' || positionFilter === position)
                  .map((position: string) => {
                    const playersInPosition = data.roster
                      .filter((player: PlayerRecord) => player.pos === position)
                      .slice()
                      .sort((a: PlayerRecord, b: PlayerRecord) => {
                        if (b.rating !== a.rating) return b.rating - a.rating;
                        return `${a.last},${a.first}`.localeCompare(`${b.last},${b.first}`);
                      });
                    return playersInPosition.length > 0 ? (
                      <React.Fragment key={`pos-${position}`}>
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            sx={{
                              bgcolor: `${data.team.colorSecondary || 'grey.100'}20`,
                              fontWeight: 'bold',
                            }}
                          >
                            {position.toUpperCase()}
                          </TableCell>
                        </TableRow>
                        {playersInPosition.map((player: PlayerRecord) => (
                          <TableRow
                            key={`player-${player.id}`}
                            sx={{ '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}
                          >
                            <TableCell>
                              <Link
                                component="button"
                                onClick={() => navigate(`/players/${player.id}`)}
                                sx={{
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  fontWeight: player.starter ? 'bold' : 'normal',
                                }}
                              >
                                {player.first} {player.last}
                              </Link>
                            </TableCell>
                            <TableCell>{player.rating}</TableCell>
                            <TableCell>{yearLabels[player.year as keyof typeof yearLabels]}</TableCell>
                            <TableCell>
                              {player.starter ? (
                                <Chip label="Starter" size="small" color="success" variant="outlined" />
                              ) : (
                                <Chip label="Backup" size="small" color="default" variant="outlined" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ) : null;
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </PageLayout>
  );
};

export default Roster;
