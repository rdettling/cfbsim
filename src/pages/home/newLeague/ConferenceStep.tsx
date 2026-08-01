import { useState } from 'react';
import { Alert, Box, Button, Chip, FormControl, FormControlLabel, FormLabel, InputLabel, MenuItem, Paper, Radio, RadioGroup, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { TeamLogo } from '../../../components/team/TeamLogo';
import type { CustomConferencePlan, PreviewData, RivalryPlanWarning } from '../../../types/domain';
import type { NewLeagueAlignmentMode } from '../newLeagueDraft';
import { StepActions } from './StepActions';

type AlignmentMode = NewLeagueAlignmentMode;
const conferenceName = (value: string | null) => value ?? 'Independent';

export const ConferenceStep = ({
  preview,
  mode,
  plan,
  issues,
  warnings,
  resolvedGames,
  advanced,
  canUndo,
  onModeChange,
  onPlanChange,
  onUndo,
  onReset,
  onAdvancedChange,
  onBack,
  onContinue,
  canContinue,
  validating,
  selectedTeam,
}: {
  preview: PreviewData;
  mode: AlignmentMode;
  plan: CustomConferencePlan;
  issues: string[];
  warnings: RivalryPlanWarning[];
  resolvedGames: Record<string, number>;
  advanced: boolean;
  canUndo: boolean;
  onModeChange: (mode: AlignmentMode) => void;
  onPlanChange: (plan: CustomConferencePlan) => void;
  onUndo: () => void;
  onReset: () => void;
  onAdvancedChange: (value: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  validating: boolean;
  selectedTeam: string | null;
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const normalized = search.trim().toLocaleLowerCase();
  const filteredTeams = preview.teams.filter(team => {
    const assignment = plan.assignments[team.name] ?? null;
    return (
      (!normalized ||
        `${team.name} ${team.mascot}`.toLocaleLowerCase().includes(normalized)) &&
      (filter === 'ALL' || conferenceName(assignment) === filter)
    );
  });
  const memberCount = (name: string) =>
    Object.values(plan.assignments).filter(value => conferenceName(value) === name).length;

  return (
    <Box>
      <Typography variant="h4">Conference structure</Typography>
      <FormControl sx={{ mt: 1.5 }}>
        <FormLabel>Alignment</FormLabel>
        <RadioGroup
          row
          value={mode}
          onChange={event => onModeChange(event.target.value as AlignmentMode)}
        >
          <FormControlLabel value="historical" control={<Radio />} label="Era-accurate" />
          <FormControlLabel value="custom" control={<Radio />} label="Custom" />
        </RadioGroup>
      </FormControl>
      {mode === 'historical' ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          The save will use the conference membership from this starting season.
        </Alert>
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ mt: 1.5, alignItems: { md: 'center' } }}
          >
            <TextField
              size="small"
              label="Search teams"
              value={search}
              onChange={event => setSearch(event.target.value)}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="alignment-filter-label">Current group</InputLabel>
              <Select
                labelId="alignment-filter-label"
                value={filter}
                label="Current group"
                onChange={event => setFilter(event.target.value)}
              >
                <MenuItem value="ALL">All teams</MenuItem>
                {preview.conferences.map(conference => (
                  <MenuItem key={conference.name} value={conference.name}>
                    {conference.name}
                  </MenuItem>
                ))}
                <MenuItem value="Independent">Independent</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
              <Button startIcon={<UndoIcon />} disabled={!canUndo} onClick={onUndo}>Undo</Button>
              <Button startIcon={<RestartAltIcon />} onClick={onReset}>Reset</Button>
            </Stack>
          </Stack>
          <Stack
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}
          >
            {preview.conferences.map(conference => (
              <Chip
                key={conference.name}
                label={`${conference.name}: ${memberCount(conference.name)}`}
                color={memberCount(conference.name) === 1 ? 'error' : 'default'}
              />
            ))}
            <Chip label={`Independent: ${memberCount('Independent')}`} />
          </Stack>
          <Box sx={{ maxHeight: 360, overflowY: 'auto', mt: 1.5 }}>
            <Stack spacing={0.75}>
              {filteredTeams.map(team => {
                const assignment = plan.assignments[team.name] ?? null;
                return (
                  <Box
                    key={team.name}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '36px minmax(0, 1fr)',
                        sm: '36px minmax(130px, 1fr) minmax(150px, 220px)',
                      },
                      gap: 1,
                      alignItems: 'center',
                      p: 1,
                      border: '1px solid',
                      borderColor: team.name === selectedTeam ? 'primary.main' : 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <TeamLogo name={team.name} size={32} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 600 }}>{team.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {conferenceName(assignment)}
                      </Typography>
                    </Box>
                    <FormControl
                      size="small"
                      sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                    >
                      <InputLabel id={`move-${team.name}`}>Move to</InputLabel>
                      <Select
                        labelId={`move-${team.name}`}
                        value={assignment ?? 'Independent'}
                        label="Move to"
                        onChange={event => {
                          const value = event.target.value;
                          onPlanChange({
                            ...plan,
                            assignments: {
                              ...plan.assignments,
                              [team.name]: value === 'Independent' ? null : value,
                            },
                          });
                        }}
                      >
                        {preview.conferences.map(conference => (
                          <MenuItem key={conference.name} value={conference.name}>
                            {conference.name}
                          </MenuItem>
                        ))}
                        <MenuItem value="Independent">Independent</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                );
              })}
            </Stack>
          </Box>
          <FormControlLabel
            sx={{ mt: 1.5 }}
            control={
              <Switch
                checked={advanced}
                onChange={event => onAdvancedChange(event.target.checked)}
              />
            }
            label="Advanced conference-game targets"
          />
          {advanced && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 1,
                mt: 1,
              }}
            >
              {preview.conferences.map(conference => {
                const count = memberCount(conference.name);
                const setting = plan.conferenceGames[conference.name] ?? { mode: 'automatic' };
                return (
                  <Paper key={conference.name} variant="outlined" sx={{ p: 1.25, opacity: count ? 1 : 0.55 }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {conference.name} · {count} teams
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Select
                        size="small"
                        value={setting.mode}
                        disabled={count === 0}
                        onChange={event => {
                          const mode = event.target.value;
                          onPlanChange({
                            ...plan,
                            conferenceGames: {
                              ...plan.conferenceGames,
                              [conference.name]:
                                mode === 'automatic'
                                  ? { mode: 'automatic' }
                                  : {
                                      mode: 'manual',
                                      target: resolvedGames[conference.name] ?? conference.games,
                                    },
                            },
                          });
                        }}
                      >
                        <MenuItem value="automatic">Automatic</MenuItem>
                        <MenuItem value="manual">Manual</MenuItem>
                      </Select>
                      {setting.mode === 'manual' ? (
                        <Select
                          size="small"
                          value={setting.target}
                          onChange={event => onPlanChange({
                            ...plan,
                            conferenceGames: {
                              ...plan.conferenceGames,
                              [conference.name]: {
                                mode: 'manual',
                                target: Number(event.target.value),
                              },
                            },
                          })}
                        >
                          {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
                            <MenuItem key={value} value={value}>{value}</MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Chip size="small" label={`${resolvedGames[conference.name] ?? '—'} games`} />
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          )}
          {issues.length > 0 && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {issues.map(message => <Typography key={message} variant="body2">{message}</Typography>)}
            </Alert>
          )}
          {warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {warnings.map(warning => (
                <Typography key={`${warning.teamA}-${warning.teamB}`} variant="body2">
                  {warning.message}
                </Typography>
              ))}
            </Alert>
          )}
        </>
      )}
      <StepActions
        back={onBack}
        next={onContinue}
        nextLabel={
          validating
            ? 'Checking schedule…'
            : warnings.length
              ? 'Continue with warnings'
              : 'Continue'
        }
        disabled={!canContinue || validating}
      />
    </Box>
  );
};
