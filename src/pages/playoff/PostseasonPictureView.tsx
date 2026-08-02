import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type {
  BubbleTeam,
  ConferenceChampion,
  PostseasonFormat,
  PostseasonTeam,
  TeamAction,
} from './types';
import { PostseasonTeamIdentity } from './PostseasonTeamIdentity';

type PostseasonPictureViewProps = {
  field: PostseasonTeam[];
  bubbleTeams: BubbleTeam[];
  conferenceChampions: ConferenceChampion[];
  format: PostseasonFormat;
  isProjection: boolean;
  onTeamClick: TeamAction;
};

const SectionHeading = ({ title, detail }: { title: string; detail?: string }) => (
  <Box sx={{ mb: 1.25 }}>
    <Typography component="h2" variant="h6">
      {title}
    </Typography>
    {detail && (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {detail}
      </Typography>
    )}
  </Box>
);

const FieldTeamRow = ({
  team,
  format,
  onTeamClick,
}: {
  team: PostseasonTeam;
  format: PostseasonFormat;
  onTeamClick: TeamAction;
}) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '42px minmax(0, 1fr) auto',
      gap: { xs: 1, sm: 1.5 },
      alignItems: 'center',
      py: 1.15,
      borderBottom: '1px solid',
      borderColor: 'divider',
      '&:last-child': { borderBottom: 0 },
    }}
  >
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1,
        bgcolor: 'action.hover',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Typography variant="body1" sx={{ fontWeight: 700 }}>
        {team.seed}
      </Typography>
    </Box>
    <PostseasonTeamIdentity
      name={team.name}
      secondary={`#${team.ranking} · ${team.record} · ${team.conference}`}
      logoSize={32}
      onTeamClick={onTeamClick}
    />
    <Stack
      direction="row"
      spacing={0.5}
      useFlexGap
      sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}
    >
      {format === 12 && team.seed <= 4 && (
        <Chip label="Bye" size="small" color="success" variant="outlined" />
      )}
      {team.is_autobid ? (
        <Chip label="Autobid" size="small" color="primary" variant="outlined" />
      ) : (
        <Chip
          label={format === 12 ? 'At-large' : 'Selected'}
          size="small"
          variant="outlined"
        />
      )}
    </Stack>
  </Box>
);

const FieldSection = ({
  title,
  detail,
  teams,
  format,
  onTeamClick,
}: {
  title: string;
  detail: string;
  teams: PostseasonTeam[];
  format: PostseasonFormat;
  onTeamClick: TeamAction;
}) => (
  <Box sx={{ '& + &': { mt: 2 } }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
      {title}
    </Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {detail}
    </Typography>
    <Box sx={{ mt: 0.5 }}>
      {teams.map(team => (
        <FieldTeamRow key={team.name} team={team} format={format} onTeamClick={onTeamClick} />
      ))}
    </Box>
  </Box>
);

const SupportingTeamRow = ({
  name,
  secondary,
  status,
  statusColor = 'default',
  onTeamClick,
}: {
  name: string;
  secondary: string;
  status?: string;
  statusColor?: 'default' | 'primary' | 'success';
  onTeamClick: TeamAction;
}) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: 1,
      alignItems: 'center',
      py: 0.9,
      borderBottom: '1px solid',
      borderColor: 'divider',
      '&:last-child': { borderBottom: 0 },
    }}
  >
    <PostseasonTeamIdentity
      name={name}
      secondary={secondary}
      onTeamClick={onTeamClick}
    />
    {status && (
      <Chip label={status} size="small" color={statusColor} variant="outlined" />
    )}
  </Box>
);

export const PostseasonPictureView = ({
  field,
  bubbleTeams,
  conferenceChampions,
  format,
  isProjection,
  onTeamClick,
}: PostseasonPictureViewProps) => {
  const fieldSections = format === 12
    ? [
        {
          title: 'First-round byes',
          detail: 'Seeds 1–4 advance directly to the quarterfinals',
          teams: field.slice(0, 4),
        },
        {
          title: 'First-round field',
          detail: 'Seeds 5–12 play in the opening round',
          teams: field.slice(4),
        },
      ]
    : [{
        title: format === 4 ? 'Semifinal field' : 'Championship field',
        detail: format === 4 ? 'Four teams advance to the semifinals' : 'Two teams advance to the championship',
        teams: field,
      }];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(320px, 0.85fr)' },
        gap: 1.5,
        flex: { lg: 1 },
        minHeight: { lg: 0 },
        overflow: { lg: 'hidden' },
      }}
    >
      <Paper
        component="section"
        aria-label={isProjection ? 'Projected playoff field' : 'Final playoff field'}
        variant="outlined"
        sx={{ p: { xs: 1.5, md: 2 }, minHeight: 0, overflow: { lg: 'auto' } }}
      >
        <SectionHeading
          title={isProjection ? 'Projected Field' : 'Final Field'}
          detail={`${format} teams ordered by postseason seed`}
        />
        {field.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No playoff field is available.
          </Typography>
        ) : (
          fieldSections.map(section => (
            <FieldSection
              key={section.title}
              {...section}
              format={format}
              onTeamClick={onTeamClick}
            />
          ))
        )}
      </Paper>

      <Stack spacing={1.5} sx={{ minHeight: 0, overflow: { lg: 'auto' } }}>
        <Paper component="section" aria-label="First five teams out" variant="outlined" sx={{ p: 1.5 }}>
          <SectionHeading title="First Five Out" detail="Highest-ranked teams outside the field" />
          {bubbleTeams.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No teams are outside the field.
            </Typography>
          ) : bubbleTeams.map(team => (
            <SupportingTeamRow
              key={team.name}
              name={team.name}
              secondary={`#${team.ranking} · ${team.record} · ${team.conference}`}
              onTeamClick={onTeamClick}
            />
          ))}
        </Paper>

        <Paper
          component="section"
          aria-label={isProjection ? 'Projected conference champions' : 'Conference champions'}
          variant="outlined"
          sx={{ p: 1.5 }}
        >
          <SectionHeading
            title={isProjection ? 'Projected Conference Champions' : 'Conference Champions'}
            detail={isProjection ? 'Current conference leaders used for projected autobids' : 'Conference title game winners'}
          />
          {conferenceChampions.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No conference champions are available.
            </Typography>
          ) : conferenceChampions.map(team => (
            <SupportingTeamRow
              key={`${team.conference}-${team.name}`}
              name={team.name}
              secondary={`#${team.ranking} · ${team.record} · ${team.conference}`}
              status={team.seed ? `Seed ${team.seed}` : 'Outside field'}
              statusColor={team.seed ? 'success' : 'default'}
              onTeamClick={onTeamClick}
            />
          ))}
        </Paper>
      </Stack>
    </Box>
  );
};
