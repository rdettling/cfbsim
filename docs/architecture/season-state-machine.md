# Season State Machine

## Stage Graph

`preseason → season → summary → realignment → progression → recruiting → recruiting_summary → roster_cuts → preseason`

`src/constants/stages.ts` is the exhaustive stage catalog and owns each stage's
route metadata.

## Transition Ownership

| Source | Destination | Owner |
| --- | --- | --- |
| `preseason` | `season` | `initializeSeason` |
| `season` | `summary` | season completion |
| `summary` | `realignment` | `advanceOffseasonStage` |
| `realignment` | `progression` | `advanceOffseasonStage` |
| `progression` | `recruiting` | `initializeRecruiting` |
| `recruiting` | `recruiting_summary` | recruiting round and finalization commands |
| `recruiting_summary` | `roster_cuts` | `initializeRosterFinalization` through `advanceOffseasonStage` |
| `roster_cuts` | `preseason` | `finalizeRoster` |

`OffseasonAdvanceStage` excludes `recruiting` and `roster_cuts`, so the generic
advance command cannot skip either command-managed lifecycle at compile time.

## Transition Rules

- Every command validates the persisted source stage.
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
- `src/domain/league/stages.ts`
- `src/domain/league/season.ts`
- `src/domain/league/recruiting.ts`
- `src/domain/league/rosterFinalization.ts`
- `src/db/offseasonRepo.ts`
- `src/domain/league/loaders/loadRosterProgression.ts`
- `src/domain/league/loaders/loadRecruitingSummary.ts`
- `src/domain/league/loaders/loadRosterCuts.ts`
