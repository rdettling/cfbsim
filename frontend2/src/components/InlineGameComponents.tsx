import { Box, Typography } from '@mui/material';
import type { Team } from '../domain/types';
import { TeamLink, TeamLogo } from './TeamComponents';

interface BaseGameComponentProps {
  team: Team & {
    last_game?: any;
    next_game?: any;
  };
  onTeamClick: (name: string) => void;
}

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
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2">{team.last_game.result}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
        ({team.last_game.score})
      </Typography>
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
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <TeamInfo
        teamName={team.next_game.opponent.name}
        ranking={team.next_game.opponent.ranking}
        onTeamClick={onTeamClick}
      />
      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
        ({team.next_game.spread})
      </Typography>
    </Box>
  );
};
