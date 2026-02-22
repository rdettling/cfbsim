import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLogo } from '../team/TeamComponents';
import type { GameResultProps } from '../../types/components';

const CARD_SX = { height: '100%', border: '1px solid', borderColor: 'divider' } as const;
const CARD_CONTENT_SX = { p: 1.5 } as const;

type BoxScoreTeam = 'away' | 'home';
type BoxScoreEntry = NonNullable<
  NonNullable<GameResultProps['data']['resultSummary']>['boxScore']['teamA']['passing'][number]
>;

interface PlayerBoxScoreCardProps {
  resultSummary: GameResultProps['data']['resultSummary'];
  game: GameResultProps['data']['game'];
  away: { id: number; name: string };
  home: { id: number; name: string };
  panelHeight?: number;
}

const TAB_SX = {
  minHeight: 34,
  textTransform: 'none',
  fontWeight: 700,
  borderRadius: 0.9,
  color: 'text.secondary',
  '&.Mui-selected': {
    color: 'text.primary',
    bgcolor: 'action.hover',
  },
} as const;

const PlayerBoxScoreCard = ({
  resultSummary,
  game,
  away,
  home,
  panelHeight,
}: PlayerBoxScoreCardProps) => {
  const [boxScoreTeam, setBoxScoreTeam] = useState<BoxScoreTeam>('away');

  const boxScoreSections = [
    { label: 'Passing', key: 'passing' as const },
    { label: 'Rushing', key: 'rushing' as const },
    { label: 'Receiving', key: 'receiving' as const },
    { label: 'Defensive', key: 'defense' as const },
    { label: 'Kicking', key: 'kicking' as const },
  ];

  const selectedBoxScore =
    !resultSummary
      ? null
      : boxScoreTeam === 'away'
        ? away.id === game.teamA.id
          ? resultSummary.boxScore.teamA
          : resultSummary.boxScore.teamB
        : home.id === game.teamA.id
          ? resultSummary.boxScore.teamA
          : resultSummary.boxScore.teamB;

  const renderRow = (entry: BoxScoreEntry, isLast: boolean) => (
    <Box
      key={entry.playerId}
      sx={{
        py: 0.58,
        borderBottom: isLast ? 'none' : '1px solid',
        borderColor: 'grey.200',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        columnGap: 1,
        alignItems: 'center',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          component={RouterLink}
          to={`/players/${entry.playerId}`}
          sx={{
            color: 'text.primary',
            textDecoration: 'none',
            fontWeight: 600,
            lineHeight: 1.2,
            '&:hover': { color: 'primary.main' },
          }}
          noWrap
        >
          {entry.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, display: 'block', mt: 0.2 }}
        >
          {entry.pos}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}
      >
        {entry.statLine}
      </Typography>
    </Box>
  );

  return (
    <Card elevation={1} sx={{ ...CARD_SX, height: panelHeight ?? '100%' }}>
      <CardContent
        sx={{
          ...CARD_CONTENT_SX,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          Box Score
        </Typography>
        {!resultSummary ? (
          <Typography variant="body2" color="text.secondary">
            Player stats are not available.
          </Typography>
        ) : (
          <Stack
            spacing={0.85}
            sx={{
              minHeight: 0,
              overflowY: 'auto',
              pr: 0.4,
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { width: 7 },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.18)',
                borderRadius: 8,
              },
              '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
            }}
          >
            <Tabs
              value={boxScoreTeam}
              onChange={(_, value: BoxScoreTeam) => setBoxScoreTeam(value)}
              variant="fullWidth"
              sx={{
                minHeight: 34,
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 1,
                bgcolor: 'background.paper',
                p: 0.25,
                borderRadius: 1.2,
                border: '1px solid',
                borderColor: 'divider',
                '& .MuiTabs-indicator': { display: 'none' },
              }}
            >
              <Tab
                value="away"
                label={(
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <TeamLogo name={away.name} size={16} />
                    <span>{away.name}</span>
                  </Stack>
                )}
                sx={TAB_SX}
              />
              <Tab
                value="home"
                label={(
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <TeamLogo name={home.name} size={16} />
                    <span>{home.name}</span>
                  </Stack>
                )}
                sx={TAB_SX}
              />
            </Tabs>
            {boxScoreSections.map((section, sectionIndex) => (
              <Box key={section.key} sx={{ pt: sectionIndex === 0 ? 0.2 : 0.45 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                    pb: 0.25,
                    mb: 0.2,
                    borderBottom: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary' }}
                  >
                    {section.label}
                  </Typography>
                </Box>
                {!selectedBoxScore || selectedBoxScore[section.key].length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    No entries
                  </Typography>
                ) : (
                  <Box>
                    {selectedBoxScore[section.key]
                      .slice(0, 5)
                      .map((entry, index, array) => renderRow(entry, index === array.length - 1))}
                  </Box>
                )}
                {sectionIndex !== boxScoreSections.length - 1 && (
                  <Divider sx={{ mt: 0.7, borderColor: 'grey.100' }} />
                )}
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerBoxScoreCard;
