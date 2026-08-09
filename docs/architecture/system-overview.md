# System Overview

## Purpose

The app is a client-side college football simulation. IndexedDB is the
authoritative runtime state. React pages render projections returned by domain
loaders, while commands and stage orchestrators own writes.

## Runtime Layers

- `src/pages/` and `src/components/`: presentation and user interaction.
- `src/domain/league/loaders/`: read-only page projections.
- `src/domain/league/`: league commands, lifecycle orchestration, and
  cross-store rules.
- `src/domain/recruiting/`, `src/domain/sim/`, `src/domain/news/`, and other domain modules: pure or
  narrowly scoped calculations.
- `src/db/`: IndexedDB schema, repositories, and explicit transactions.
- `src/types/`: persisted and public contracts.

Modules are imported directly. There is no generalized transaction framework
or service container.

## Authoritative State

The current database contains:

- `league`: one `current` `LeagueState`.
- `recruiting`: one optional `current` `RecruitingState`.
- `players`: current rosters only.
- `games`: compact permanent schedule and result facts.
- `gameDetails`: nested drive, play, and player-game detail keyed by game.
- `newsItems`: durable national news stories keyed by deterministic source ID.
- `playerSeasons` and `historicalPlayers`: compact permanent player history.
- `playerOrigins`: immutable dynasty-era acquisition provenance for every
  current or historical player.
- `seasonMemories`: compact typed postseason and award facts keyed by
  completed simulated year.
- `baseData`: cached source datasets.

`LeagueState` and `RecruitingState` are fully required current-schema objects.
Repository reads validate their exact shapes before returning them.
Roster-dependent reads also validate the complete player collection and its
team ownership. Invalid persisted data throws an integrity error; reads never
repair or replace it.

Application startup is the destructive recovery boundary. Before React
renders, it validates the authoritative save. An integrity failure deletes the
entire database and recreates the current empty schema. A database-version
change likewise recreates the current stores rather than migrating records
between schema epochs.

## Request and Command Flow

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

League-news generation returns a persisted story plus an ephemeral editorial
trace containing verified facts, selected template and deck-rule IDs, and the
newsworthiness breakdown. Runtime callers discard the trace after committing
the story. The offline `eval:news` workflow consumes it while running seeded
in-memory schedules; its corpus and reports never enter IndexedDB.

Reader-facing news uses top-25 poll identity even though simulation rankings
order the full league. Version 3 editorial traces keep raw and editorial ranks,
explicit odds/ranking upset evidence, and the qualifying fact behind any
featured player. They also record stable headline/deck template IDs, syntax
families, emphasized facts, and score placement. Championship, playoff, and
named bowl consequence remains the primary angle while compatible game context
selects the copy variant.

Newsworthiness uses a shared typed component registry with consequence,
national-relevance, and drama dimensions. Pregame top-25 participation adds a
graduated relevance bonus, while program prestige and the user-controlled team
do not affect national ordering. Game results and material weekly poll changes
share one explicit `NewsItem` union and feed. A separate rankings publisher
also announces the final 2-, 4-, or 12-team playoff field without introducing
a publisher registry or poll-history store. Season initialization also writes
three factual Week 0 previews for the preseason poll, national outlook, and
opening schedule spotlight. Database schema version 14
intentionally resets older saves so persisted feeds never mix publisher epochs.

News copy catalogs, generation, ordering, presentation metadata, and persisted
integrity checks have separate focused owners. Every mixed-feed operation uses
the explicit `NewsItem` discriminator; adding a future item type therefore
creates compiler-visible branches instead of silently inheriting game behavior.
Repository modules own reads and writes, while `newsIntegrity.ts` owns current-
schema and cross-record validation.

Editorial policy constants and qualifier IDs have one typed production owner.
Templates declare supported game types and required verified facts directly;
audit validation resolves those contracts by stable template ID instead of
inferring requirements from naming conventions. Audit scenarios reuse the
production identity derivation, while structural validation independently
recomputes expected identity from raw values. The offline audit also validates
each preseason package against its ranked teams, marquee opening game, template
catalog, deterministic replay, and independently reconstructed score components.

Home is the only normal no-save state: `loadLeagueOptional()` returns `null`
when `league/current` does not exist. Required league contexts use
`loadLeagueOrThrow()`.

## Annual Lifecycle

The stage graph is:

`preseason → season → summary → realignment → progression → recruiting → recruiting_summary → roster_cuts → preseason`

Generic offseason advancement accepts `OffseasonAdvanceStage`, which excludes
`recruiting` and `roster_cuts`. Recruiting commands and final roster completion
are command-managed.

The summary-to-realignment transition is also the dynasty-memory capture
boundary. It builds one record from the completed season while player game
logs are still available, then commits that record with team history and
league advancement.

## Invariants

- Every read and write uses one current architecture and persisted schema.
- Modules stay lean, explicit, directly imported, and easy for an LLM to
  navigate.
- IndexedDB is the source of truth.
- Loaders are read-only.
- Commands validate authoritative records inside their transaction.
- Command and repository validation failures leave every store unchanged;
  startup integrity failure discards the database.
- Maps, indexes, recruiting context, and page projections are ephemeral.
- New-league creation is the only roster bootstrap entry point.
- Persisted settings use `NextSeasonConfiguration` directly.
- Recruiting formulas and tuning remain isolated in pure recruiting modules.
- Roster previews require an explicit year, seed, and persisted selection set.
- Team-rating calculations require an explicit random source.

## Source Map

- `src/db/db.ts`: schema and store creation.
- `src/db/databaseLifecycle.ts`: startup validation and destructive recovery.
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
