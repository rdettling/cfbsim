# Data Model and Persistence

## IndexedDB Schema

`src/db/db.ts` defines the current database at version 2.

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

Store creation is idempotent. The runtime does not translate, normalize, or
repair persisted records.

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
`INVALID_LEAGUE_STATE` or `INVALID_ROSTER_STATE`. The bad records remain stored
for inspection; no write is attempted.

`loadRecruitingLifecycleSnapshot()` reads league, recruiting, and players in one
readonly transaction for Recruiting Summary and Roster Cuts.
`assertCurrentRecruitingState()` validates the singleton's exact current
top-level and nested shape on every repository read and before every repository
write. Missing fields, extra aliases, malformed nested records, and duplicate
persisted IDs throw `RecruitingDataIntegrityError`; no normalization is
attempted.

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
- `src/db/leagueRepo.ts`
- `src/db/recruitingRepo.ts`
- `src/db/newLeagueRepo.ts`
- `src/db/offseasonRepo.ts`
- `src/domain/league/rosterFinalization.ts`
