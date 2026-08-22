import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ConferenceLogo, TeamLogo } from '../../components/team/TeamLogo';
import { TeamLink } from '../../components/team/TeamLink';
import type { StandingsPageData } from '../../types/pages';

type Championship = NonNullable<StandingsPageData['championship']>;

const formatSpread = (spread: string) => spread.startsWith('-')
  ? `−${spread.slice(1)}`
  : spread;

const spreadLabel = (teamName: string, spread: string) => {
  const value = Number(spread);
  const margin = Math.abs(value);
  const points = margin === 1 ? 'point' : 'points';
  if (value < 0) return `${teamName} favored by ${margin} ${points} on a neutral field`;
  if (value > 0) return `${teamName} is a ${value}-point underdog on a neutral field`;
  return `${teamName} is pick 'em on a neutral field`;
};

const TeamEntry = ({
  team,
  position,
  spread,
  score,
  winner,
  complete,
  onTeamClick,
}: {
  team: Championship['teamA'];
  position: 1 | 2;
  spread: string;
  score: number | null;
  winner: boolean;
  complete: boolean;
  onTeamClick: (name: string) => void;
}) => (
  <Stack
    direction="row"
    spacing={0.75}
    sx={{ alignItems: 'center', minWidth: 0 }}
  >
    <Typography
      variant="caption"
      aria-label={`Conference position ${position}`}
      sx={{ color: 'text.secondary', fontWeight: 700, flexShrink: 0 }}
    >
      {position}
    </Typography>
    <TeamLogo name={team.name} size={30} />
    <Box
      sx={{
        minWidth: 0,
        '& .MuiLink-root': {
          display: 'block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }}
    >
      <TeamLink name={team.name} onTeamClick={onTeamClick} />
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography
          variant="caption"
          aria-label={complete ? `${team.name} scored ${score}` : spreadLabel(team.name, spread)}
          sx={{ color: complete ? 'text.primary' : 'text.secondary', fontWeight: 700 }}
        >
          {complete ? score : formatSpread(spread)}
        </Typography>
        {winner && (
          <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>
            Champion
          </Typography>
        )}
      </Stack>
    </Box>
  </Stack>
);

const ChampionshipMatchup = ({
  championship,
  onTeamClick,
}: {
  championship: Championship;
  onTeamClick: (name: string) => void;
}) => {
  const complete = championship.status === 'complete';
  const title = championship.status === 'projected'
    ? 'Projected CCG'
    : championship.status === 'scheduled'
      ? 'Week 15 CCG'
      : 'CCG Final';
  const detail = championship.status === 'projected'
    ? 'Current standings · Neutral site'
    : championship.status === 'scheduled'
      ? 'Scheduled · Neutral site'
      : 'Final · Neutral site';

  return (
    <Box
      component="section"
      aria-label="Conference championship"
      sx={{
        gridArea: 'championship',
        minWidth: 0,
        borderTop: { xs: '1px solid', lg: 0 },
        borderLeft: { lg: '1px solid' },
        borderColor: 'divider',
        pt: { xs: 1, lg: 0 },
        pl: { lg: 1.5 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.75, sm: 1.25 }}
        sx={{ alignItems: { sm: 'center' }, minWidth: 0 }}
      >
        <Stack
          direction={{ xs: 'row', sm: 'column' }}
          spacing={{ xs: 0.75, sm: 0 }}
          sx={{
            minWidth: { sm: 112 },
            flexShrink: 0,
            alignItems: { xs: 'baseline', sm: 'flex-start' },
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: championship.status === 'projected' ? 'primary.main' : 'text.primary', fontWeight: 700, lineHeight: 1.3 }}
          >
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
            {detail}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            gap: { xs: 0.75, sm: 1.25 },
            alignItems: 'center',
            minWidth: 0,
            flex: 1,
          }}
        >
          <TeamEntry
            team={championship.teamA}
            position={1}
            spread={championship.spreadA}
            score={championship.scoreA}
            winner={championship.winnerId === championship.teamA.id}
            complete={complete}
            onTeamClick={onTeamClick}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            VS
          </Typography>
          <TeamEntry
            team={championship.teamB}
            position={2}
            spread={championship.spreadB}
            score={championship.scoreB}
            winner={championship.winnerId === championship.teamB.id}
            complete={complete}
            onTeamClick={onTeamClick}
          />
        </Box>

        {championship.gameId !== null && (
          <Button
            component={RouterLink}
            to={`/game/${championship.gameId}`}
            size="small"
            variant="text"
            sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, flexShrink: 0 }}
          >
            Game
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export const StandingsCommandBar = ({
  data,
  onConferenceChange,
  onTeamClick,
}: {
  data: StandingsPageData;
  onConferenceChange: (name: string) => void;
  onTeamClick: (name: string) => void;
}) => {
  const isIndependent = data.conference === 'Independent';
  const hasChampionship = data.championship !== null;

  return (
    <Paper
      component="header"
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateAreas: hasChampionship
          ? {
              xs: '"identity selector" "championship championship"',
              lg: '"identity championship selector"',
            }
          : '"identity selector"',
        gridTemplateColumns: hasChampionship
          ? {
              xs: 'minmax(0, 1fr) minmax(132px, 42%)',
              lg: 'minmax(260px, 0.9fr) minmax(440px, 1.6fr) minmax(190px, 240px)',
            }
          : 'minmax(0, 1fr) minmax(190px, 240px)',
        columnGap: { xs: 1, sm: 1.5 },
        rowGap: { xs: 1, lg: 0 },
        alignItems: 'center',
        p: { xs: 1, sm: 1.25 },
        mb: 1.25,
        minHeight: { lg: 74 },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ gridArea: 'identity', alignItems: 'center', minWidth: 0 }}
      >
        {!isIndependent && (
          <Box sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}>
            <ConferenceLogo name={data.conference} size={44} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            variant="h5"
            noWrap
            sx={{ fontSize: { xs: '1.15rem', sm: '1.5rem' }, fontWeight: 700 }}
          >
            {isIndependent ? 'Independent Standings' : `${data.conference} Standings`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {data.info.currentYear} · Week {data.info.currentWeek}
          </Typography>
        </Box>
      </Stack>

      {data.championship && (
        <ChampionshipMatchup championship={data.championship} onTeamClick={onTeamClick} />
      )}

      <FormControl size="small" sx={{ gridArea: 'selector', minWidth: 0 }}>
        <Select
          value={data.conference}
          onChange={(event) => onConferenceChange(event.target.value)}
          inputProps={{ 'aria-label': 'Select conference standings' }}
          sx={{
            height: 40,
            bgcolor: 'background.paper',
            '& .MuiSelect-select': { py: 1 },
          }}
        >
          {data.conferences
            .filter(conference => conference.confName.toLowerCase() !== 'independent')
            .map(conference => (
              <MenuItem key={conference.confName} value={conference.confName}>
                {conference.confName}
              </MenuItem>
            ))}
          <MenuItem value="Independent">Independent</MenuItem>
        </Select>
      </FormControl>
    </Paper>
  );
};
