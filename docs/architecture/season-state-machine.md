# Season State Machine

This document owns the legal annual stage graph and the command responsible
for each transition. System documents define the work performed inside those
commands.

## Stage Graph

`preseason → season → summary → realignment → progression → recruiting → recruiting_summary → roster_cuts → preseason`

`src/constants/stages.ts` is the exhaustive stage catalog and owns each stage's
route metadata.

## Transition Ownership

| Source | Destination | Owner |
| --- | --- | --- |
| `preseason` | `season` | `initializeSeason` |
| `season` | `summary` | guarded completion after the national championship and every current-year game resolve; final rankings, memory, and player-season totals commit atomically |
| `summary` | `realignment` | `advanceOffseasonStage` |
| `realignment` | `progression` | `advanceOffseasonStage` |
| `progression` | `recruiting` | `initializeRecruiting` |
| `recruiting` | `recruiting_summary` | recruiting round and finalization commands |
| `recruiting_summary` | `roster_cuts` | `initializeRosterFinalization` through `advanceOffseasonStage` |
| `roster_cuts` | `preseason` | `finalizeRoster` |

`OffseasonAdvanceStage` excludes `recruiting` and `roster_cuts`, so the generic
advance command cannot skip either command-managed lifecycle at compile time.

`advanceOffseasonToStage` is the user-facing forward orchestrator. It accepts a
later offseason destination or the active season, invokes the owning guarded
command for every intervening transition, and stops at the selected stage. Each
transition remains its own atomic commit, so a failed multi-stage request
resumes from the last successfully committed authoritative stage.

The application navigation presents the same annual state as a league calendar:
season weeks use the existing `advanceWeeks` simulator, while offseason nodes
use `advanceOffseasonToStage`. Navigation serializes those actions with live
simulation and refreshes page loaders after season advancement.

## Transition Rules

- Every command validates the persisted source stage.
- Season completion returns without mutation while any current-year game is
  unfinished, and its atomic commit revalidates that invariant.
- `initializeSeason` builds and persists season simulation data; Dashboard and
  Team Schedule loaders never initialize it.
- Realignment commits guard the exact persisted next-season configuration.
- Progression and recruiting initialization are one transaction: player
  progression, recruiting generation, and the stage update commit together.
- Recruiting Summary to Roster Cuts requires a finalized same-year round-six
  aggregate, creates walk-ons inside the transaction, increments its version,
  and retains it.
- User cut selections use stage, year, round, status, and version guards.
- Roster Cuts to Preseason validates exact user selections, resolves non-user
  cuts, and resets the season atomically. Success deletes recruiting state;
  failure retains every prior record.
- Stage loaders may return an empty off-stage projection, but never advance or
  repair the lifecycle.

## Read Behavior

Lifecycle loaders are projections:

- Roster Progression reads league and players in one readonly snapshot.
- Recruiting reads league, recruiting, and players in one readonly snapshot.
- Recruiting Summary and Roster Cuts read league, recruiting, and players in
  one readonly snapshot.
- Repeated, off-stage, and stale-route reads leave IndexedDB unchanged.

Malformed league or roster data throws `LeagueDataIntegrityError`.

## Source Map

- `src/constants/stages.ts`
- `src/constants/routes.ts`
- `src/domain/league/commands/stages.ts`
- `src/domain/league/commands/offseasonFlow.ts`
- `src/domain/league/commands/season.ts`
- `src/domain/league/commands/recruiting.ts`
- `src/domain/league/commands/rosterFinalization.ts`
- `src/db/offseasonRepo.ts`
- `src/domain/league/loaders/loadRosterProgression.ts`
- `src/domain/league/loaders/loadRecruitingSummary.ts`
- `src/domain/league/loaders/loadRosterCuts.ts`
