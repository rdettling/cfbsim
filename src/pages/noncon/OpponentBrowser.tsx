import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import type {
  EligibleNonConOpponent,
  NonConScheduleSiteChoice,
} from '../../types/league';
import type { OpponentScheduleRequest } from './types';

type OpponentBrowserProps = {
  week: number | null;
  opponents: EligibleNonConOpponent[];
  query: string;
  loading: boolean;
  loadError: string | null;
  saveError: string | null;
  savingRequest: OpponentScheduleRequest | null;
  onQueryChange: (query: string) => void;
  onRetry: () => void;
  onSchedule: (request: OpponentScheduleRequest) => void;
};

const isSavingRequest = (
  savingRequest: OpponentScheduleRequest | null,
  opponentName: string,
  site: NonConScheduleSiteChoice,
) => {
  if (
    savingRequest?.opponentName !== opponentName ||
    savingRequest.site.kind !== site.kind
  ) return false;
  return site.kind === 'rivalry' || (
    savingRequest.site.kind === 'manual' &&
    savingRequest.site.location === site.location
  );
};

export const OpponentBrowser = ({
  week,
  opponents,
  query,
  loading,
  loadError,
  saveError,
  savingRequest,
  onQueryChange,
  onRetry,
  onSchedule,
}: OpponentBrowserProps) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOpponents = normalizedQuery
    ? opponents.filter(opponent =>
        opponent.name.toLocaleLowerCase().includes(normalizedQuery) ||
        opponent.conference.toLocaleLowerCase().includes(normalizedQuery)
      )
    : opponents;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {week !== null && (
        <Box sx={{ px: 1.25, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Search team or conference"
            size="small"
            fullWidth
            disabled={loading}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {week === null ? (
          <Box sx={{ p: 2.5, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Choose an open week</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Eligible opponents and their site details will appear here.
            </Typography>
          </Box>
        ) : loading ? (
          <Box sx={{ p: 2.5, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading opponents…</Typography>
          </Box>
        ) : loadError ? (
          <Box sx={{ p: 1.25 }}>
            <Alert
              severity="error"
              action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}
            >
              {loadError}
            </Alert>
          </Box>
        ) : opponents.length === 0 ? (
          <Box sx={{ p: 2.5, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>No eligible opponents</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No team can be added in Week {week} without breaking a scheduling constraint.
            </Typography>
          </Box>
        ) : filteredOpponents.length === 0 ? (
          <Box sx={{ p: 2.5, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>No search results</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Try a different team or conference.
            </Typography>
          </Box>
        ) : filteredOpponents.map(opponent => {
          const site = opponent.site.kind === 'fixed'
            ? opponent.site.venue
              ? `${opponent.site.location} · ${opponent.site.venue}`
              : opponent.site.location
            : null;
          const savingRivalry = isSavingRequest(
            savingRequest,
            opponent.name,
            { kind: 'rivalry' },
          );
          return (
            <Box
              component="article"
              key={opponent.name}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '32px minmax(0, 1fr)',
                  sm: '32px minmax(0, 1fr) auto',
                },
                gap: 0.75,
                alignItems: 'center',
                px: 1.25,
                py: 0.75,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <TeamLogo name={opponent.name} size={28} />
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'baseline', minWidth: 0 }}>
                  {opponent.ranking > 0 && (
                    <Typography variant="caption" sx={{ fontWeight: 700, flexShrink: 0 }}>
                      #{opponent.ranking}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opponent.name}
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {opponent.conference} · {opponent.record} · {opponent.rating} OVR
                </Typography>
                {opponent.site.kind === 'fixed' && (
                  <Typography variant="caption" sx={{ color: 'text.primary', display: 'block' }}>
                    {opponent.rivalry?.name ?? 'Rivalry'} · {site}
                  </Typography>
                )}
              </Box>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  gridColumn: { xs: '2', sm: 'auto' },
                  justifyContent: { sm: 'flex-end' },
                }}
              >
                {opponent.site.kind === 'fixed' ? (
                  <Button
                    variant="contained"
                    size="small"
                    disabled={savingRequest !== null}
                    aria-label={`Schedule ${opponent.name} at its fixed rivalry site`}
                    onClick={() => onSchedule({
                      opponentName: opponent.name,
                      site: { kind: 'rivalry' },
                    })}
                  >
                    {savingRivalry ? 'Scheduling…' : 'Schedule'}
                  </Button>
                ) : (['Home', 'Away'] as const).map(location => {
                  const siteChoice = { kind: 'manual', location } as const;
                  const saving = isSavingRequest(
                    savingRequest,
                    opponent.name,
                    siteChoice,
                  );
                  return (
                    <Button
                      key={location}
                      variant={location === 'Home' ? 'contained' : 'outlined'}
                      size="small"
                      disabled={savingRequest !== null}
                      aria-label={`Schedule ${opponent.name} ${location.toLocaleLowerCase()}`}
                      onClick={() => onSchedule({
                        opponentName: opponent.name,
                        site: siteChoice,
                      })}
                    >
                      {saving ? 'Scheduling…' : location}
                    </Button>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {saveError}
        </Alert>
      )}
    </Box>
  );
};
