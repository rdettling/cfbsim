import { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import type { PlayoffTeamCount } from '../../types/domain';
import type {
  FourTeamPlayoffBracket,
  PlayoffBracket,
  PlayoffMatchup,
  TwelveTeamPlayoffBracket,
} from '../../types/postseason';
import { PostseasonMatchup } from './PostseasonMatchup';

type PostseasonBracketViewProps = {
  bracket: PlayoffBracket;
  format: PlayoffTeamCount;
  hasTeams: boolean;
  onGameClick: (gameId: number) => void;
  onTeamClick: (teamName: string) => void;
};

type Round = {
  id: string;
  label: string;
  matchups: PlayoffMatchup[];
};

const isTwelveTeamBracket = (bracket: PlayoffBracket): bracket is TwelveTeamPlayoffBracket =>
  'left_bracket' in bracket;

const isFourTeamBracket = (bracket: PlayoffBracket): bracket is FourTeamPlayoffBracket =>
  'semifinals' in bracket;

const getRounds = (bracket: PlayoffBracket): Round[] => {
  if (isTwelveTeamBracket(bracket)) {
    return [
      {
        id: 'first-round',
        label: 'First Round',
        matchups: [...bracket.left_bracket.first_round, ...bracket.right_bracket.first_round],
      },
      {
        id: 'quarterfinals',
        label: 'Quarterfinals',
        matchups: [...bracket.left_bracket.quarterfinals, ...bracket.right_bracket.quarterfinals],
      },
      {
        id: 'semifinals',
        label: 'Semifinals',
        matchups: [bracket.left_bracket.semifinal, bracket.right_bracket.semifinal],
      },
      { id: 'championship', label: 'Championship', matchups: [bracket.championship] },
    ];
  }

  if (isFourTeamBracket(bracket)) {
    return [
      { id: 'semifinals', label: 'Semifinals', matchups: bracket.semifinals },
      { id: 'championship', label: 'Championship', matchups: [bracket.championship] },
    ];
  }

  return [{ id: 'championship', label: 'Championship', matchups: [bracket.championship] }];
};

const DesktopRound = ({
  label,
  matchups,
  onGameClick,
  onTeamClick,
}: {
  label: string;
  matchups: PlayoffMatchup[];
  onGameClick: (gameId: number) => void;
  onTeamClick: (teamName: string) => void;
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 2,
      minWidth: 0,
    }}
  >
    <Typography
      variant="overline"
      sx={{
        color: 'text.secondary',
        textAlign: 'center',
        letterSpacing: 1,
      }}
    >
      {label}
    </Typography>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around',
        gap: 2,
        flex: 1,
      }}
    >
      {matchups.map((matchup, index) => (
        <Box
          key={matchup.id ?? `${label}-${index}`}
          sx={{
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '50%',
              right: -12,
              width: 12,
              borderTop: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <PostseasonMatchup
            matchup={matchup}
            compact
            onGameClick={onGameClick}
            onTeamClick={onTeamClick}
          />
        </Box>
      ))}
    </Box>
  </Box>
);

const DesktopBracket = ({
  bracket,
  format,
  onGameClick,
  onTeamClick,
}: Omit<PostseasonBracketViewProps, 'hasTeams'>) => {
  if (format === 12 && isTwelveTeamBracket(bracket)) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(3, minmax(188px, 1fr)) minmax(210px, 1.1fr) repeat(3, minmax(188px, 1fr))',
          gap: 1.5,
          minWidth: 1390,
          minHeight: '100%',
        }}
      >
        <DesktopRound
          label="First Round"
          matchups={bracket.left_bracket.first_round}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="Quarterfinals"
          matchups={bracket.left_bracket.quarterfinals}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="Semifinal"
          matchups={[bracket.left_bracket.semifinal]}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="Championship"
          matchups={[bracket.championship]}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="Semifinal"
          matchups={[bracket.right_bracket.semifinal]}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="Quarterfinals"
          matchups={bracket.right_bracket.quarterfinals}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="First Round"
          matchups={bracket.right_bracket.first_round}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
      </Box>
    );
  }

  if (format === 4 && isFourTeamBracket(bracket)) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(230px, 1fr) minmax(250px, 1.1fr) minmax(230px, 1fr)',
          gap: 2,
          alignItems: 'center',
          minWidth: 780,
          minHeight: '100%',
        }}
      >
        <DesktopRound
          label="Semifinal"
          matchups={[bracket.semifinals[0]]}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="Championship"
          matchups={[bracket.championship]}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
        <DesktopRound
          label="Semifinal"
          matchups={[bracket.semifinals[1]]}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', py: 2 }}>
      <DesktopRound
        label="National Championship"
        matchups={[bracket.championship]}
        onGameClick={onGameClick}
        onTeamClick={onTeamClick}
      />
    </Box>
  );
};

export const PostseasonBracketView = (props: PostseasonBracketViewProps) => {
  const rounds = useMemo(() => getRounds(props.bracket), [props.bracket]);
  const [activeRound, setActiveRound] = useState(rounds[0]?.id ?? '');

  useEffect(() => {
    setActiveRound(rounds[0]?.id ?? '');
  }, [rounds]);

  const selectedRound = rounds.find((round) => round.id === activeRound) ?? rounds[0];

  if (!props.hasTeams || !selectedRound || selectedRound.matchups.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">No playoff bracket available</Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          The bracket will appear when postseason teams are available.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      component="section"
      aria-label={`${props.format}-team playoff bracket`}
      variant="outlined"
      sx={{
        flex: { lg: 1 },
        minHeight: { lg: 0 },
        overflow: { lg: 'hidden' },
      }}
    >
      <Box sx={{ display: { xs: 'none', lg: 'block' }, height: '100%', overflow: 'auto', p: 1.5 }}>
        <DesktopBracket
          bracket={props.bracket}
          format={props.format}
          onGameClick={props.onGameClick}
          onTeamClick={props.onTeamClick}
        />
      </Box>
      <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
        {rounds.length > 1 && (
          <Tabs
            value={selectedRound.id}
            onChange={(_, value: string) => setActiveRound(value)}
            variant="scrollable"
            scrollButtons="auto"
            selectionFollowsFocus
            aria-label="Playoff rounds"
            sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
          >
            {rounds.map((round) => (
              <Tab key={round.id} value={round.id} label={round.label} />
            ))}
          </Tabs>
        )}
        <Box
          role="tabpanel"
          aria-label={selectedRound.label}
          sx={{ display: 'grid', gap: 1.25, p: 1.5 }}
        >
          {selectedRound.matchups.map((matchup, index) => (
            <PostseasonMatchup
              key={matchup.id ?? `${selectedRound.id}-${index}`}
              matchup={matchup}
              onGameClick={props.onGameClick}
              onTeamClick={props.onTeamClick}
            />
          ))}
        </Box>
      </Box>
    </Paper>
  );
};
