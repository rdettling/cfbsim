# Data Model and Persistence

## IndexedDB Schema

`src/db/db.ts` defines the current database at version 3.

| Store | Key | Value |
| --- | --- | --- |
| `baseData` | string | cached source dataset |
| `league` | `current` | required `LeagueState` |
| `recruiting` | `current` | optional versioned `RecruitingState` |
| `players` | player ID | `PlayerRecord` |
| `games` | game ID | `GameRecord` |
| `drives` | drive ID | `DriveRecord` |
| `plays` | play ID | `PlayRecord` |
| `gameLogs` | log ID | `GameLogRecord` |

The IndexedDB version is a destructive schema epoch. Opening an older version
deletes every existing object store and recreates exactly the current schema.
There are no migrations, compatibility paths, or record-level repairs.

## Static Data Cache

Public JSON assets are cached in `baseData`. `STATIC_DATA_VERSION` is their
cache epoch and is independent of the IndexedDB schema version. Application
startup removes cached public assets when that value changes, so a data release
does not require deleting a valid save.

The `history` entry is excluded because it becomes mutable save state after a
season completes. Starting a new league intentionally clears all base data,
including history, before loading and caching a fresh `history.json`
historical baseline. Runtime team history uses that single baseline; raw
season-result files are build-time inputs only.

Increment `STATIC_DATA_VERSION` whenever a release changes a public data asset
that existing installations may already have cached.

Starting-year JSON is validated at the `getYearData()` boundary by the shared
current-schema validator. Home preview, new-league creation, and historical
realignment therefore use the same exact `YearData` contract. Offline tooling
imports that validator directly through `npm run check:data`.

Balance evaluation has no store. Its repeated-season state and reports remain
in memory and are emitted to stdout only.

## League State

`LeagueState` requires:

- current stage, week, year, start year, user team, and season horizon;
- teams, conferences, pending rivalries, and rivalry host seeds;
- schedule and simulation initialization flags;
- `NextSeasonConfiguration`;
- playoff state;
- complete game, drive, play, game-log, and player ID counters.

`NextSeasonConfiguration` is persisted directly with:

- `conferencePolicy`;
- `postseasonPolicy`;
- `playoffTeams`;
- `playoffAutobids`;
- `conferenceChampionsReceiveTopSeeds`.

## Integrity Boundary

`loadLeague()` validates `league/current` before returning it.
`loadLeaguePlayersSnapshot()` reads league and players in one readonly
transaction and then verifies:

- the league matches the required current schema;
- the player collection is nonempty;
- every player has the required current fields;
- every player belongs to a persisted team;
- every persisted team is represented in the roster.

Failures throw `LeagueDataIntegrityError` with
`INVALID_LEAGUE_STATE` or `INVALID_ROSTER_STATE`. Repository reads themselves
never write or repair data.

`loadRecruitingLifecycleSnapshot()` reads league, recruiting, and players in one
readonly transaction for Recruiting Summary and Roster Cuts.
`assertCurrentRecruitingState()` validates the singleton's exact current
top-level and nested shape on every repository read and before every repository
write. Missing fields, extra aliases, malformed nested records, and duplicate
persisted IDs throw `RecruitingDataIntegrityError`; no normalization is
attempted.

Before React renders, `initializeDatabase()` validates the current league,
roster, and stage-dependent recruiting aggregate. Orphaned authoritative
records without a league are also invalid. Any of these integrity failures
deletes the entire database and recreates an empty current schema. A fresh
database is the recovery state; malformed saves are not retained.

## Write Ownership

- `startNewLeague()` prepares a complete league, roster, and initial games,
  then `commitNewLeague()` replaces all authoritative save stores atomically.
- Simulation commands own simulation records and ID counter increments.
- Generic offseason transitions use `commitOffseasonTransition()` only for
  `baseData` and `league`. Recruiting, roster, and simulation mutations belong
  to their dedicated commands.
- Recruiting commands declare their transaction stores locally and write the
  singleton through `recruitingRepo`.
- Roster-finalization commands declare their stores locally, validate the
  finalized recruiting cursor, and own walk-ons, cut selections, and preseason
  reset.

All command guards are checked against records read inside the same transaction
that performs the writes.

## Recruiting Retention

Signing-day finalization atomically writes freshmen, the finalized recruiting
aggregate, the player counter, and `recruiting_summary`. The aggregate remains
through `roster_cuts`.

The summary-to-cuts transaction adds required walk-ons, advances the player
counter, increments the recruiting version, and changes stage exactly once.
Selection commands update only `pendingUserCutIds` and the version. Final
roster completion writes cuts, starters, ratings, games, and league state,
clears prior play-by-play, and deletes recruiting state in one transaction.

## Source Map

- `src/types/league.ts`
- `src/types/recruiting.ts`
- `src/types/roster.ts`
- `src/types/db.ts`
- `src/db/db.ts`
- `src/db/baseData.ts`
- `src/db/databaseLifecycle.ts`
- `src/db/leagueRepo.ts`
- `src/db/recruitingRepo.ts`
- `src/db/newLeagueRepo.ts`
- `src/db/offseasonRepo.ts`
- `src/domain/league/rosterFinalization.ts`
