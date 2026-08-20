# System Overview

## Purpose

CFB Sim is a client-side college football simulation. IndexedDB is the
authoritative runtime state. React pages render projections returned by domain
loaders, while explicit commands and lifecycle orchestrators own writes.

## Runtime Layers

- `src/pages/` and `src/components/`: presentation and user interaction.
- `src/domain/league/loaders/`: read-only page projections.
- `src/domain/league/commands/`: user-triggered league lifecycle and
  configuration writes.
- `src/domain/sim/`: pure game mechanics and explicit simulation command
  orchestration.
- `src/domain/recruiting/`, `src/domain/news/`, and other domain modules: pure
  or narrowly scoped calculations.
- `src/db/`: IndexedDB schema, repositories, validation, and transactions.
- `src/types/`: persisted and public contracts.

Modules are imported directly. The application has no service container,
generalized transaction framework, or parallel persistence layer.

## Authoritative State

The current database stores one league, an optional recruiting aggregate,
current players, compact games, nested game details, durable news, historical
player seasons and identities, player origins, season memories, and cached base
data. [Data Model and Persistence](data-model-and-persistence.md) owns their
exact records, retention, and transaction boundaries.

Repository reads validate exact current shapes before returning authoritative
records. Commands validate final mutations before committing them. Roster- and
history-dependent operations also validate cross-record ownership and
references. Reads never repair, normalize, or replace invalid persisted state.

Application startup is the destructive recovery boundary. An integrity
failure deletes the database and recreates the current empty schema. A
`DB_VERSION` change likewise recreates the current stores rather than migrating
old records.

## Request and Command Flow

1. A page calls a loader.
2. The loader reads a validated IndexedDB snapshot.
3. It builds a typed, presentation-ready projection without writing.
4. A user action invokes an explicit command.
5. The command reads its guards inside the owning transaction, computes the
   current result, validates the complete mutation, and commits atomically.
6. Stale responses trigger a fresh authoritative read; pages never merge stale
   state into IndexedDB.

Pure indexes, maps, evaluation reports, editorial traces, and page projections
remain ephemeral. Offline audits may reuse production domain operations, but
their inputs and reports are not application state.

## Annual Lifecycle

The stage graph is:

`preseason → season → summary → realignment → progression → recruiting → recruiting_summary → roster_cuts → preseason`

Generic offseason advancement excludes recruiting and roster cuts; their
commands own those transitions. Summary advancement captures the completed
season while its game and player records are still available. The
[Season State Machine](season-state-machine.md) owns every transition and its
guards.

## Invariants

- Every read and write uses one current architecture and persisted schema.
- IndexedDB is the source of truth; pages and loaders do not synthesize it.
- Loaders are read-only and commands own persistence.
- Guards are checked inside the transaction that performs the write.
- Validation failure leaves participating stores unchanged; startup integrity
  failure discards the database.
- New-league creation is the only roster bootstrap entry point.
- Maps, evaluation artifacts, and view projections remain ephemeral.
- Domain calculations requiring randomness receive an explicit random source.

## Source Map

- `src/db/db.ts`: current schema and store creation.
- `src/db/databaseLifecycle.ts`: startup validation and destructive recovery.
- `src/db/leagueStateValidation.ts`: league and roster validation.
- `src/db/gameRecordValidation.ts`: compact game validation.
- `src/db/gameDetailValidation.ts`: nested simulation validation.
- `src/domain/league/leagueStore.ts`: required and optional league reads.
- `src/domain/league/commands/`: user commands and annual stage orchestration.
- `src/domain/league/loaders/`: page projections.
- `src/domain/sim/orchestrator.ts`: batch and interactive simulation commands.
- `src/constants/stages.ts`: exhaustive stage catalog.
