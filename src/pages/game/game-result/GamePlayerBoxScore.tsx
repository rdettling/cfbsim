import { useState } from 'react';
import { Box, Divider, Stack, Tab, Tabs, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLogo } from '../../../components/team/TeamLogo';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';

type ResultSummary = NonNullable<GamePageData['resultSummary']>;
type TeamBoxScore = ResultSummary['boxScore']['teamA'];
type BoxScoreEntry = TeamBoxScore['passing'][number];
type BoxScoreTeam = 'away' | 'home';

type GamePlayerBoxScoreProps = {
  awayTeam: Team;
  homeTeam: Team;
  awayBoxScore: TeamBoxScore | null;
  homeBoxScore: TeamBoxScore | null;
};

const SECTIONS = [
  { label: 'Passing', key: 'passing' },
  { label: 'Rushing', key: 'rushing' },
  { label: 'Receiving', key: 'receiving' },
  { label: 'Defensive', key: 'defense' },
  { label: 'Kicking', key: 'kicking' },
] as const;

const TAB_SX = {
  minHeight: 36,
  borderRadius: 1,
  color: 'text.secondary',
  '&.Mui-selected': {
    color: 'text.primary',
    bgcolor: 'action.hover',
  },
} as const;

const PlayerRow = ({ entry }: { entry: BoxScoreEntry }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: 1,
      py: 0.6,
    }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography
        component={RouterLink}
        to={`/players/${entry.playerId}`}
        variant="body2"
        noWrap
        sx={{
          color: 'text.primary',
          fontWeight: 600,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {entry.name}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
        }}
      >
        {entry.pos}
      </Typography>
    </Box>
    <Typography
      variant="body2"
      sx={{
        color: 'text.secondary',
        fontWeight: 600,
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}
    >
      {entry.statLine}
    </Typography>
  </Box>
);

export const GamePlayerBoxScore = ({
  awayTeam,
  homeTeam,
  awayBoxScore,
  homeBoxScore,
}: GamePlayerBoxScoreProps) => {
  const [selectedTeam, setSelectedTeam] = useState<BoxScoreTeam>('away');
  const selectedBoxScore = selectedTeam === 'away' ? awayBoxScore : homeBoxScore;

  return (
    <Box aria-label="Player box score">
      {!awayBoxScore || !homeBoxScore ? (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          Player statistics are unavailable for this game.
        </Typography>
      ) : (
        <>
          <Tabs
            value={selectedTeam}
            onChange={(_, value: BoxScoreTeam) => setSelectedTeam(value)}
            variant="fullWidth"
            selectionFollowsFocus
            aria-label="Box score team"
            sx={{
              minHeight: 36,
              p: 0.25,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            <Tab
              value="away"
              label={
                <Stack
                  direction="row"
                  spacing={0.6}
                  sx={{
                    alignItems: 'center',
                    minWidth: 0,
                  }}
                >
                  <TeamLogo name={awayTeam.name} size={18} />
                  <Typography variant="body2" noWrap>
                    {awayTeam.name}
                  </Typography>
                </Stack>
              }
              sx={TAB_SX}
            />
            <Tab
              value="home"
              label={
                <Stack
                  direction="row"
                  spacing={0.6}
                  sx={{
                    alignItems: 'center',
                    minWidth: 0,
                  }}
                >
                  <TeamLogo name={homeTeam.name} size={18} />
                  <Typography variant="body2" noWrap>
                    {homeTeam.name}
                  </Typography>
                </Stack>
              }
              sx={TAB_SX}
            />
          </Tabs>

          <Box sx={{ mt: 0.75 }}>
            {SECTIONS.map((section, sectionIndex) => {
              const entries = selectedBoxScore?.[section.key] ?? [];
              return (
                <Box key={section.key} sx={{ pt: sectionIndex === 0 ? 0 : 0.75 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: 'text.secondary',
                      display: 'block',
                      lineHeight: 1.8,
                    }}
                  >
                    {section.label}
                  </Typography>
                  {entries.length === 0 ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        py: 0.5,
                      }}
                    >
                      No {section.label.toLowerCase()} entries.
                    </Typography>
                  ) : (
                    <Stack divider={<Divider flexItem />}>
                      {entries.map((entry) => (
                        <PlayerRow key={entry.playerId} entry={entry} />
                      ))}
                    </Stack>
                  )}
                  {sectionIndex < SECTIONS.length - 1 && <Divider sx={{ mt: 0.75 }} />}
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
};
