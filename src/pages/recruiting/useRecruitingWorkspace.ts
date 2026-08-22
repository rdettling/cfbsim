import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStageRoute, STAGES } from '../../constants/stages';
import {
  advanceRecruitingRound,
  finalizeRecruiting,
  updateRecruitingBoard,
} from '../../domain/league/commands/recruiting';
import type { RecruitingPageData } from '../../types/pages';
import {
  RecruitingConflictError,
  type RecruitingCommandCursor,
  type RecruitingRoundCommandResult,
} from '../../types/recruiting';

export type RecruitingNotice = {
  severity: 'success' | 'error' | 'info';
  message: string;
};

export const normalizedAllocations = (allocations: Record<number, number>) =>
  Object.fromEntries(
    Object.entries(allocations)
      .filter(([, points]) => points > 0)
      .sort(([left], [right]) => Number(left) - Number(right)),
  );

const reconcileAllocations = (
  allocations: Record<number, number>,
  boardIds: number[],
  budget: number,
  cap: number,
) => {
  let remaining = budget;
  return Object.fromEntries(
    Object.entries(allocations)
      .sort(([left], [right]) => Number(left) - Number(right))
      .flatMap(([prospectId, points]) => {
        if (
          !boardIds.includes(Number(prospectId)) ||
          !Number.isInteger(points) ||
          points <= 0 ||
          points > cap ||
          points > remaining
        ) {
          return [];
        }
        remaining -= points;
        return [[prospectId, points]];
      }),
  );
};

type CommandResult =
  | RecruitingCommandCursor
  | RecruitingRoundCommandResult;

export const useRecruitingWorkspace = (
  data: RecruitingPageData | null,
  refetch: () => Promise<void>,
) => {
  const navigate = useNavigate();
  const [marketOpen, setMarketOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(
    null,
  );
  const [draftAllocations, setDraftAllocations] = useState<
    Record<number, number>
  >({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<RecruitingNotice | null>(null);
  const actionLock = useRef(false);
  const roundKey = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.cursor || !data.userRecruiting) return;
    const nextRoundKey = `${data.info.stage}:${data.cursor.year}:${data.cursor.round}`;
    if (roundKey.current !== nextRoundKey) {
      roundKey.current = nextRoundKey;
      setDraftAllocations({});
    } else {
      setDraftAllocations(current =>
        reconcileAllocations(
          current,
          data.userRecruiting!.boardIds,
          data.userRecruiting!.pointBudget,
          data.userRecruiting!.perProspectCap,
        ),
      );
    }
    if (
      selectedProspectId &&
      !data.prospects.some(prospect => prospect.id === selectedProspectId)
    ) {
      setDetailsOpen(false);
    }
    setSelectedProspectId(current => {
      if (current && data.prospects.some(prospect => prospect.id === current)) {
        return current;
      }
      return data.userRecruiting?.boardIds[0] ?? data.prospects[0]?.id ?? null;
    });
  }, [data]);

  const selectedProspect =
    data?.prospects.find(prospect => prospect.id === selectedProspectId) ??
    null;
  const boardProspects = useMemo(
    () =>
      data?.userRecruiting
        ? data.userRecruiting.boardIds
            .map(id => data.prospects.find(prospect => prospect.id === id))
            .filter(
              (
                prospect,
              ): prospect is RecruitingPageData['prospects'][number] =>
                Boolean(prospect),
            )
        : [],
    [data],
  );
  const draftPoints = Object.values(draftAllocations).reduce(
    (total, points) => total + points,
    0,
  );
  const allocationsValid = Boolean(
    data?.userRecruiting &&
      Object.entries(draftAllocations).every(
        ([prospectId, points]) =>
          data.userRecruiting!.boardIds.includes(Number(prospectId)) &&
          Number.isInteger(points) &&
          points >= 0 &&
          points <= data.userRecruiting!.perProspectCap,
      ) &&
      draftPoints <= data.userRecruiting.pointBudget,
  );

  const runCommand = async (
    command: () => Promise<CommandResult>,
    successMessage: (result: CommandResult) => string,
    options: {
      navigateOnSuccess?: boolean;
      onSuccess?: () => void;
    } = {},
  ) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const result = await command();
      options.onSuccess?.();
      setNotice({ severity: 'success', message: successMessage(result) });
      if (options.navigateOnSuccess && result.route) {
        navigate(result.route);
      } else {
        await refetch();
      }
    } catch (commandError) {
      const stale = commandError instanceof RecruitingConflictError;
      setNotice({
        severity: 'error',
        message: stale
          ? 'Recruiting changed in another view. Current league data was reloaded; review your choices.'
          : commandError instanceof Error
            ? commandError.message
            : 'The recruiting action failed.',
      });
      if (stale) {
        await refetch();
        if (
          commandError.code === 'STAGE_MISMATCH' &&
          typeof commandError.actual === 'string' &&
          STAGES.some(stage => stage.id === commandError.actual)
        ) {
          navigate(
            getStageRoute(
              commandError.actual as (typeof STAGES)[number]['id'],
            ),
          );
        }
      }
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  const guard = data?.cursor
    ? {
        expectedStage: 'recruiting' as const,
        expectedYear: data.cursor.year,
        expectedRound: data.cursor.round,
        expectedVersion: data.cursor.version,
      }
    : null;

  const changeBoard = (prospectId: number, add: boolean) => {
    if (!guard || !data?.userRecruiting) return;
    const board = add
      ? [...data.userRecruiting.boardIds, prospectId]
      : data.userRecruiting.boardIds.filter(id => id !== prospectId);
    void runCommand(
      () => updateRecruitingBoard({ ...guard, prospectIds: board }),
      () =>
        add
          ? 'Prospect added to your board.'
          : 'Prospect removed from your board.',
      {
        onSuccess: () => {
          if (add) {
            setSelectedProspectId(prospectId);
          } else {
            setDraftAllocations(current => {
              const next = { ...current };
              delete next[prospectId];
              return next;
            });
          }
        },
      },
    );
  };

  const advanceWeek = () => {
    if (!guard || !allocationsValid || !data?.userRecruiting) return;
    const userTeamId = data.userRecruiting.teamId;
    void runCommand(
      () =>
        advanceRecruitingRound({
          ...guard,
          allocations: normalizedAllocations(draftAllocations),
        }),
      result => {
        const advanced = result as RecruitingRoundCommandResult;
        const commitments = advanced.commitments.filter(
          commitment => commitment.teamId === userTeamId,
        ).length;
        return `Week completed. AI assigned ${advanced.assistance.pointsAdded} points and added ${advanced.assistance.prospectIdsAdded.length} target${advanced.assistance.prospectIdsAdded.length === 1 ? '' : 's'}; your team received ${commitments} commitment${commitments === 1 ? '' : 's'}.`;
      },
    );
  };

  const resolveSigningDay = () => {
    if (!guard || guard.expectedRound !== 6) return;
    void runCommand(
      () => finalizeRecruiting({ ...guard, expectedRound: 6 }),
      result =>
        `Signing Day completed with ${result.commitments.length} commitment${result.commitments.length === 1 ? '' : 's'}.`,
      { navigateOnSuccess: true },
    );
  };

  const showProspect = (prospectId: number) => {
    setSelectedProspectId(prospectId);
    setDetailsOpen(true);
  };

  return {
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
    changeBoard,
    advanceWeek,
    resolveSigningDay,
    showProspect,
    clearPoints: () => setDraftAllocations({}),
  };
};
