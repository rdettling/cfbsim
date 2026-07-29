import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { useDomainData } from '../domain/hooks';
import { loadRecruiting } from '../domain/league/loaders/loadRecruiting';
import type { RecruitingPageData } from '../types/pages';
import { ProspectDetailsDialog } from './recruiting/ProspectDetailsDialog';
import { ProspectMarket } from './recruiting/ProspectMarket';
import { RecruitingBoard } from './recruiting/RecruitingBoard';
import { RecruitingSummaryStrip } from './recruiting/RecruitingSummaryStrip';
import { useRecruitingWorkspace } from './recruiting/useRecruitingWorkspace';

const Recruiting = () => {
  const theme = useTheme();
  const fullScreenMarket = useMediaQuery(theme.breakpoints.down('sm'));
  const { data, loading, error, refetch } =
    useDomainData<RecruitingPageData>({
      fetcher: loadRecruiting,
    });
  const workspace = useRecruitingWorkspace(data, refetch);
  const {
    marketOpen,
    setMarketOpen,
    detailsOpen,
    setDetailsOpen,
    selectedProspectId,
    selectedProspect,
    boardProspects,
    draftAllocations,
    setDraftAllocations,
    draftPoints,
    allocationsValid,
    busy,
    notice,
    setNotice,
    confirmFinish,
    setConfirmFinish,
    changeBoard,
    advanceWeek,
    finishWithAi,
    resolveSigningDay,
    showProspect,
    clearPoints,
  } = workspace;

  const recruiting = data?.userRecruiting;
  const cursor = data?.cursor;
  const rules = data?.rules;
  const board = recruiting && rules ? (
    <RecruitingBoard
      prospects={boardProspects}
      allocations={draftAllocations}
      pointBudget={recruiting.pointBudget}
      perProspectCap={recruiting.perProspectCap}
      userTeamId={recruiting.teamId}
      meaningfulPursuitPoints={rules.meaningfulPursuitPoints}
      positionNeeds={recruiting.positions}
      busy={busy}
      editable={cursor?.status === 'active'}
      onSelect={showProspect}
      onAllocationChange={(id, points) =>
        setDraftAllocations(current => ({ ...current, [id]: points }))
      }
      onRemove={id => changeBoard(id, false)}
      onAddRecruits={() => setMarketOpen(true)}
      onClear={clearPoints}
    />
  ) : null;

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={
        data
          ? {
              team: data.team,
              currentStage: data.info.stage,
              info: data.info,
              conferences: data.conferences,
              advanceDisabled: busy || !allocationsValid,
            }
          : undefined
      }
      onAdvanceStage={
        cursor?.status === 'ready_for_signing_day'
          ? resolveSigningDay
          : undefined
      }
      advanceLabel={
        cursor?.status === 'active' ? 'Advance Recruiting' : undefined
      }
      advanceActions={
        cursor?.status === 'active'
          ? [
              {
                label:
                  cursor.round === 6 ? 'Complete Week 6' : 'Advance Week',
                onSelect: advanceWeek,
              },
              {
                label: 'Sim to End of Recruiting',
                onSelect: () => setConfirmFinish(true),
              },
            ]
          : undefined
      }
    >
      {data &&
        (data.info.stage !== 'recruiting' ||
        !cursor ||
        !recruiting ||
        !rules ? (
          <StageUnavailableState
            title="Recruiting unavailable"
            description="Interactive recruiting is available only during the Recruiting stage."
            currentStage={data.info.stage}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: { lg: 1 },
              minHeight: { lg: 0 },
            }}
          >
            <RecruitingSummaryStrip data={data} draftPoints={draftPoints} />

            {cursor.status === 'ready_for_signing_day' && (
              <Alert severity="info" sx={{ mb: 1.25 }}>
                Six recruiting weeks are complete. Review the final standings,
                then resolve Signing Day.
              </Alert>
            )}
            {!allocationsValid && (
              <Alert severity="error" sx={{ mb: 1.25 }}>
                Use whole, nonnegative point values within the weekly and
                per-recruit limits.
              </Alert>
            )}

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}
            >
              {board}
            </Box>
          </Box>
        ))}

      <Dialog
        open={marketOpen}
        onClose={() => setMarketOpen(false)}
        fullScreen={fullScreenMarket}
        fullWidth
        maxWidth="lg"
        slotProps={{ paper: { sx: { height: { sm: 'min(800px, 90vh)' } } } }}
      >
        <DialogTitle>Add Recruits</DialogTitle>
        <DialogContent sx={{ p: { xs: 1, sm: 2 }, minHeight: 0 }}>
          {data && cursor && (
            <ProspectMarket
              prospects={data.prospects}
              positions={data.positions}
              selectedProspectId={selectedProspectId}
              boardLocked={cursor.status !== 'active'}
              busy={busy}
              onSelect={showProspect}
              onAdd={id => changeBoard(id, true)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarketOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {data?.userRecruiting && data.rules && cursor && (
        <ProspectDetailsDialog
          open={detailsOpen}
          prospect={selectedProspect}
          commitmentThreshold={data.rules.commitmentThreshold}
          boardCount={data.userRecruiting.boardIds.length}
          boardLimit={data.userRecruiting.boardLimit}
          editable={cursor.status === 'active'}
          busy={busy}
          onClose={() => setDetailsOpen(false)}
          onChangeBoard={changeBoard}
        />
      )}

      <Dialog open={confirmFinish} onClose={() => setConfirmFinish(false)}>
        <DialogTitle>Sim to end of recruiting?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your current point choices will be honored this week. AI will
            complete every remaining recruiting week and Signing Day before
            opening Recruiting Summary. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFinish(false)}>Cancel</Button>
          <Button variant="contained" onClick={finishWithAi}>
            Sim to Recruiting Summary
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={8000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={() => setNotice(null)}
            role="status"
          >
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </PageLayout>
  );
};

export default Recruiting;
