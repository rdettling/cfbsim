import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DashboardPanel } from './DashboardPanel';
import type { DashboardTeam, DashboardTeamClickHandler } from './types';

type DashboardTeamIdentityProps = {
  team: DashboardTeam;
  currentTeamName: string;
  onTeamClick: DashboardTeamClickHandler;
};

const DashboardTeamIdentity = ({
  team,
  currentTeamName,
  onTeamClick,
}: DashboardTeamIdentityProps) => (
  <Stack
    direction="row"
    spacing={0.75}
    sx={{
      alignItems: 'center',
      minWidth: 0,
    }}
  >
    <TeamLogo name={team.name} size={26} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <TeamLink name={team.name} onTeamClick={onTeamClick} />
    </Box>
    {team.name === currentTeamName && <Chip label="You" size="small" variant="outlined" />}
  </Stack>
);

type DashboardTeamRowProps = {
  team: DashboardTeam;
  currentTeamName: string;
  teamColor: string;
  onTeamClick: DashboardTeamClickHandler;
  children: ReactNode;
  isLast: boolean;
};

const DashboardTeamRow = ({
  team,
  currentTeamName,
  teamColor,
  onTeamClick,
  children,
  isLast,
}: DashboardTeamRowProps) => {
  const isCurrentTeam = team.name === currentTeamName;

  return (
    <Box
      sx={{
        p: 1.25,
        borderBottom: isLast ? 0 : '1px solid',
        borderBottomColor: 'divider',
        borderLeft: isCurrentTeam ? '3px solid' : undefined,
        borderLeftColor: isCurrentTeam ? teamColor || 'primary.main' : undefined,
        bgcolor: isCurrentTeam ? 'action.selected' : undefined,
      }}
    >
      <DashboardTeamIdentity
        team={team}
        currentTeamName={currentTeamName}
        onTeamClick={onTeamClick}
      />
      {children}
    </Box>
  );
};

type DashboardStandingsPanelProps = {
  conferenceName: string;
  teams: DashboardTeam[];
  currentTeamName: string;
  teamColor: string;
  onTeamClick: DashboardTeamClickHandler;
};

export const DashboardStandingsPanel = ({
  conferenceName,
  teams,
  currentTeamName,
  teamColor,
  onTeamClick,
}: DashboardStandingsPanelProps) => (
  <DashboardPanel
    title={conferenceName === 'Independent' ? 'Independent Teams' : `${conferenceName} Standings`}
    ariaLabel={
      conferenceName === 'Independent' ? 'Independent teams' : `${conferenceName} standings`
    }
  >
    {teams.length > 0 ? (
      teams.map((team, index) => (
        <DashboardTeamRow
          key={team.name}
          team={team}
          currentTeamName={currentTeamName}
          teamColor={teamColor}
          onTeamClick={onTeamClick}
          isLast={index === teams.length - 1}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 0.75,
              mt: 0.75,
            }}
          >
            <TeamMetric label="Rating" value={team.rating} />
            <TeamMetric label="Conference" value={`${team.confWins}-${team.confLosses}`} />
            <TeamMetric label="Overall" value={`${team.totalWins}-${team.totalLosses}`} />
          </Box>
        </DashboardTeamRow>
      ))
    ) : (
      <PanelEmptyState message="No conference standings are available." />
    )}
  </DashboardPanel>
);

type DashboardRankingsPanelProps = {
  teams: DashboardTeam[];
  currentTeamName: string;
  teamColor: string;
  onTeamClick: DashboardTeamClickHandler;
};

export const DashboardRankingsPanel = ({
  teams,
  currentTeamName,
  teamColor,
  onTeamClick,
}: DashboardRankingsPanelProps) => (
  <DashboardPanel title="AP Top 10" ariaLabel="AP Top 10 rankings">
    {teams.length > 0 ? (
      teams.map((team, index) => (
        <DashboardTeamRow
          key={team.name}
          team={team}
          currentTeamName={currentTeamName}
          teamColor={teamColor}
          onTeamClick={onTeamClick}
          isLast={index === teams.length - 1}
        >
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 0.75,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              Rank{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {index + 1}
              </Box>
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {team.totalWins}-{team.totalLosses}
            </Typography>
          </Stack>
        </DashboardTeamRow>
      ))
    ) : (
      <PanelEmptyState message="No national rankings are available." />
    )}
  </DashboardPanel>
);

const TeamMetric = ({ label, value }: { label: string; value: number | string }) => (
  <Box>
    <Typography
      variant="caption"
      sx={{
        color: 'text.secondary',
      }}
    >
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {value}
    </Typography>
  </Box>
);

const PanelEmptyState = ({ message }: { message: string }) => (
  <Box sx={{ p: 2 }}>
    <Typography
      variant="body2"
      sx={{
        color: 'text.secondary',
      }}
    >
      {message}
    </Typography>
  </Box>
);
