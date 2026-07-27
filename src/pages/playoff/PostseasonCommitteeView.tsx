import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../components/team/TeamComponents';
import type {
  BubbleTeam,
  ConferenceChampion,
  PostseasonTeam,
  ResumeTeam,
  TeamAction,
} from './types';

type PostseasonCommitteeViewProps = {
  field: PostseasonTeam[];
  bubbleTeams: BubbleTeam[];
  conferenceChampions: ConferenceChampion[];
  resumeTeams: ResumeTeam[];
  format: number;
  isProjection: boolean;
  onTeamClick: TeamAction;
};

const SectionHeading = ({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) => (
  <Box sx={{ mb: 1 }}>
    <Typography component="h2" variant="h6">
      {title}
    </Typography>
    {detail && (
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    )}
  </Box>
);

const TeamIdentity = ({
  name,
  prefix,
  secondary,
  onTeamClick,
}: {
  name: string;
  prefix?: string;
  secondary: string;
  onTeamClick: TeamAction;
}) => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
    <TeamLogo name={name} size={24} />
    <Box sx={{ minWidth: 0 }}>
      <Button
        size="small"
        onClick={() => onTeamClick(name)}
        sx={{
          minWidth: 0,
          p: 0,
          color: 'text.primary',
          justifyContent: 'flex-start',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {prefix}{name}
      </Button>
      <Typography variant="caption" color="text.secondary" display="block">
        {secondary}
      </Typography>
    </Box>
  </Stack>
);

const EmptySection = ({ message }: { message: string }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
    {message}
  </Typography>
);

const SelectionContext = ({
  field,
  bubbleTeams,
  conferenceChampions,
  format,
  isProjection,
  onTeamClick,
}: Omit<PostseasonCommitteeViewProps, 'resumeTeams'>) => (
  <Paper
    component="section"
    aria-label="Selection field and conference champions"
    variant="outlined"
    sx={{ p: 1.5, minHeight: 0, overflow: { lg: 'auto' } }}
  >
    <SectionHeading
      title={isProjection ? 'Projected Field' : 'Selected Field'}
      detail={`${format} teams ordered by postseason seed`}
    />
    {field.length === 0 ? (
      <EmptySection message="No playoff field is available." />
    ) : (
      <Stack spacing={0.5}>
        {field.map((team) => (
          <Box
            key={team.name}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 1,
              alignItems: 'center',
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <TeamIdentity
              name={team.name}
              prefix={`${team.seed}. `}
              secondary={`${team.record} · ${team.conference} · Rank #${team.ranking}`}
              onTeamClick={onTeamClick}
            />
            <Stack direction="row" spacing={0.5}>
              {format === 12 && team.seed <= 4 && (
                <Chip label="Bye" size="small" variant="outlined" />
              )}
              {team.is_autobid && (
                <Chip label="Autobid" size="small" color="primary" variant="outlined" />
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    )}

    <Box sx={{ mt: 2 }}>
      <SectionHeading title="Bubble" detail="Next five teams by ranking" />
      {bubbleTeams.length === 0 ? (
        <EmptySection message="No bubble teams are available." />
      ) : (
        <Stack spacing={0.75}>
          {bubbleTeams.map((team) => (
            <TeamIdentity
              key={team.name}
              name={team.name}
              prefix={`#${team.ranking} `}
              secondary={`${team.record} · ${team.conference}`}
              onTeamClick={onTeamClick}
            />
          ))}
        </Stack>
      )}
    </Box>

    <Box sx={{ mt: 2 }}>
      <SectionHeading title="Conference Champions" />
      {conferenceChampions.length === 0 ? (
        <EmptySection message="No conference champions are available." />
      ) : (
        <Stack spacing={0.75}>
          {conferenceChampions.map((team) => (
            <Box
              key={`${team.conference}-${team.name}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <TeamIdentity
                name={team.name}
                prefix={`#${team.ranking} `}
                secondary={`${team.record} · ${team.conference}`}
                onTeamClick={onTeamClick}
              />
              <Chip
                label={team.seed ? `Seed ${team.seed}` : 'Outside field'}
                size="small"
                color={team.seed ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  </Paper>
);

const ResumeBoard = ({
  teams,
  selectedNames,
  onTeamClick,
}: {
  teams: ResumeTeam[];
  selectedNames: Set<string>;
  onTeamClick: TeamAction;
}) => (
  <Paper
    component="section"
    aria-label="Committee resume board"
    variant="outlined"
    sx={{ p: 1.5, minHeight: 0, overflow: { lg: 'auto' } }}
  >
    <SectionHeading title="Top 10 Résumé Board" detail="Current ranking and selection context" />
    {teams.length === 0 ? (
      <EmptySection message="No résumé data is available." />
    ) : (
      <Stack spacing={0}>
        {teams.map((team) => {
          const isSelected = selectedNames.has(team.name);
          return (
            <Box
              key={team.name}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px, 1.4fr) minmax(260px, 2fr) auto' },
                gap: 1,
                alignItems: 'center',
                py: 0.9,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <TeamIdentity
                name={team.name}
                prefix={`#${team.ranking} `}
                secondary={`${team.record} · ${team.conference}`}
                onTeamClick={onTeamClick}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(54px, 1fr))',
                  gap: 0.75,
                }}
              >
                {[
                  ['Rating', team.rating],
                  ['SOR', `#${team.sor_rank}`],
                  ['Ranked wins', team.ranked_wins],
                  ['Losses', team.losses],
                ].map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Stack direction="row" spacing={0.5}>
                {team.is_champ && (
                  <Chip label="Champion" size="small" color="success" variant="outlined" />
                )}
                <Chip
                  label={isSelected ? 'In' : 'Out'}
                  size="small"
                  color={isSelected ? 'primary' : 'default'}
                />
              </Stack>
            </Box>
          );
        })}
      </Stack>
    )}
  </Paper>
);

export const PostseasonCommitteeView = (props: PostseasonCommitteeViewProps) => {
  const selectedNames = new Set(props.field.map((team) => team.name));

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, 5fr) minmax(0, 7fr)' },
        gridTemplateRows: { lg: 'minmax(0, 1fr)' },
        gap: 1.25,
        flex: { lg: 1 },
        minHeight: { lg: 0 },
      }}
    >
      <SelectionContext
        field={props.field}
        bubbleTeams={props.bubbleTeams}
        conferenceChampions={props.conferenceChampions}
        format={props.format}
        isProjection={props.isProjection}
        onTeamClick={props.onTeamClick}
      />
      <ResumeBoard
        teams={props.resumeTeams}
        selectedNames={selectedNames}
        onTeamClick={props.onTeamClick}
      />
    </Box>
  );
};
