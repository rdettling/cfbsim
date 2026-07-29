# System Overview

## Scope

The app is a client-side college football simulation. IndexedDB is the
authoritative runtime state. React pages render projections returned by domain
loaders, while commands and stage orchestrators own writes.

## Runtime Layers

- `src/pages/` and `src/components/`: presentation and user interaction.
- `src/domain/league/loaders/`: read-only page projections.
- `src/domain/league/`: league commands, lifecycle orchestration, and
  cross-store rules.
- `src/domain/recruiting/`, `src/domain/sim/`, and other domain modules: pure or
  narrowly scoped calculations.
- `src/db/`: IndexedDB schema, repositories, and explicit transactions.
- `src/types/`: persisted and public contracts.

Modules are imported directly. There is no generalized transaction framework
or service container.

## Authoritative State

The current database contains:

- `league`: one `current` `LeagueState`.
- `recruiting`: one optional `current` `RecruitingState`.
- `players`, `games`, `drives`, `plays`, and `gameLogs`: normalized simulation
  records.
- `baseData`: cached source datasets.

`LeagueState` and `RecruitingState` are fully required current-schema objects.
Repository reads validate their exact shapes before returning them.
Roster-dependent reads also validate the complete player collection and its
team ownership. Invalid persisted data throws an integrity error; reads never
repair or replace it.

## Execution Flow

1. A page calls a loader.
2. The loader reads a validated snapshot from IndexedDB.
3. It builds a view-specific projection without writing.
4. A user action invokes a command.
5. The command opens an explicit read-write transaction, validates persisted
   guards, calculates the result, and commits all authoritative writes
   atomically.

Recruiting round advancement additionally builds one public-only AI snapshot
from the guarded aggregate and rebuilt roster context. Submitted user
allocations are minimums; the same AI strategy fills the feasible remainder
and may expand the user board while all team decisions are planned and
resolved simultaneously. Full AI completion repeats that pure flow through
Signing Day and freshman creation inside one transaction.

The Recruiting and Roster Cuts pages load public, presentation-ready readonly
projections. Recruiting keeps weekly allocation edits local until guarded
advancement, while board and cut choices persist immediately. Stale command
responses trigger a fresh authoritative read; pages never merge stale state
into IndexedDB.

Roster finalization reads league, recruiting, players, rivalries, and odds
inside its command transaction. Walk-ons and cut recommendations are pure
seeded calculations. Only standard player records, pending user cut IDs,
league results, and reset artifacts persist.

Offline recruiting balance evaluation reuses these pure domain operations in
memory. Evaluation inputs, histories, projections, diagnostics, reports, and
checksums are not application state and never enter IndexedDB.

Home is the only normal no-save state: `loadLeagueOptional()` returns `null`
when `league/current` does not exist. Required league contexts use
`loadLeagueOrThrow()`.

## Annual Lifecycle

The stage graph is:

`preseason → season → summary → realignment → progression → recruiting → recruiting_summary → roster_cuts → preseason`

Generic offseason advancement accepts `OffseasonAdvanceStage`, which excludes
`recruiting` and `roster_cuts`. Recruiting commands and final roster completion
are command-managed.

## Invariants

- The codebase supports one current architecture and persisted schema; obsolete
  paths are removed rather than retained as compatibility layers.
- Modules stay lean, explicit, directly imported, and easy for an LLM to
  navigate.
- IndexedDB is the source of truth.
- Loaders are read-only.
- Commands validate authoritative records inside their transaction.
- Validation failure leaves every store unchanged.
- Maps, indexes, recruiting context, and page projections are ephemeral.
- New-league creation is the only roster bootstrap entry point.
- Persisted settings use `NextSeasonConfiguration` directly.
- Recruiting formulas and tuning remain isolated in pure recruiting modules.
- Roster previews require an explicit year, seed, and persisted selection set.
- Team-rating calculations require an explicit random source.

## Source Map

- `src/db/db.ts`: schema and store creation.
- `src/db/leagueRepo.ts`: current league and roster integrity boundaries.
- `src/db/recruitingRepo.ts`: recruiting singleton and readonly lifecycle
  snapshot.
- `src/domain/league/leagueStore.ts`: required and optional league readers.
- `src/domain/league/stages.ts`: annual stage transitions.
- `src/domain/league/season.ts`: preseason-to-season initialization command.
- `src/domain/league/recruiting.ts`: recruiting commands.
- `src/domain/league/rosterFinalization.ts`: roster-cut and preseason
  finalization commands.
- `src/domain/league/loaders/`: page projections.
- `src/constants/stages.ts`: exhaustive stage catalog.
