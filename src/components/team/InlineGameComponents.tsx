import { Box, Typography, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLink, TeamLogo } from './TeamComponents';
import type { BaseGameComponentProps } from '../../types/components';

const TeamInfo = ({
  teamName,
  ranking,
  onTeamClick,
}: {
  teamName: string;
  ranking: string | number;
  onTeamClick: (name: string) => void;
}) => (
  <>
    <TeamLogo name={teamName} size={20} />
    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
      #{ranking}
    </Typography>
    <TeamLink name={teamName} onTeamClick={onTeamClick} />
  </>
);

export const InlineLastWeek = ({ team, onTeamClick }: BaseGameComponentProps) => {
  if (!team.last_game) return null;
  const gameId = team.last_game.id;
  const scoreText = `(${team.last_game.score})`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2">{team.last_game.result}</Typography>
      {gameId ? (
        <MuiLink component={RouterLink} to={`/game/${gameId}`} underline="hover" sx={{ fontWeight: 700 }}>
          {scoreText}
        </MuiLink>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {scoreText}
        </Typography>
      )}
      <Typography variant="body2">vs</Typography>
      <TeamInfo
        teamName={team.last_game.opponent.name}
        ranking={team.last_game.opponent.ranking}
        onTeamClick={onTeamClick}
      />
    </Box>
  );
};

export const InlineThisWeek = ({ team, onTeamClick }: BaseGameComponentProps) => {
  if (!team.next_game) return null;
  const gameId = team.next_game.id;
  const spreadText = `(${team.next_game.spread})`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <TeamInfo
        teamName={team.next_game.opponent.name}
        ranking={team.next_game.opponent.ranking}
        onTeamClick={onTeamClick}
      />
      {gameId ? (
        <MuiLink component={RouterLink} to={`/game/${gameId}`} underline="hover" sx={{ fontWeight: 700 }}>
          {spreadText}
        </MuiLink>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {spreadText}
        </Typography>
      )}
    </Box>
  );
};
