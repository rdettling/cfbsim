# Data Model and Persistence

This document owns the persisted schema, integrity boundary, record retention,
and transaction ownership. IndexedDB is the runtime source of truth.

## IndexedDB Schema

`src/db/db.ts` defines the current database at version 21. It is the single
current destructive schema epoch for exact calls, participants, timing, clock
management, and touchdown tries.

| Store | Key | Value |
| --- | --- | --- |
| `baseData` | string | cached source dataset |
| `league` | `current` | required `LeagueState` |
| `recruiting` | `current` | optional versioned `RecruitingState` |
| `players` | player ID | current-roster `PlayerRecord` |
| `games` | game ID | `GameRecord` |
| `gameDetails` | game ID | nested `GameDetailRecord` |
| `newsItems` | deterministic news ID | durable `NewsItem` |
| `playerSeasons` | `[year, playerId]` | `PlayerSeasonStats` |
| `historicalPlayers` | player ID | immutable departed-player identity |
| `playerOrigins` | player ID | immutable recruiting, walk-on, initial-roster, or program-entry provenance |
| `seasonMemories` | year | `SeasonMemory` |

The IndexedDB version is a destructive schema epoch. Opening an older version
deletes every existing object store and recreates exactly the current schema.
There are no migrations, compatibility paths, or record-level repairs.

`newsItems` stores an explicit `GameNewsItem | RankingNewsItem |
PreviewNewsItem` union. The
`gameId` index is intentionally sparse for rankings releases; the `year` and
`[year, week]` indexes serve both story types. Ranking IDs use
`rankings:<year>:<week>`, allowing at most one poll or playoff-field release in
a week.

Season initialization atomically persists three Week 0 preview items with the
completed schedule: the preseason poll, national outlook, and highest-rated
opening-week matchup. Later seasons may ground the outlook in the prior
season's persisted national-championship result.

## Static Data Cache

Public JSON assets are cached in `baseData`. `STATIC_DATA_VERSION` is their
cache epoch and is independent of the IndexedDB schema version. Application
startup removes cached public assets when that value changes, so a data release
does not require deleting a valid save.

Historical games are immutable, exact-schema CollegeFootballData.com
projections stored as an index plus one file per available season under
`historical-games/`. The index and seasons are validated before being cached
independently under `historical-games:index` and `historical-games:<year>`.
They remain separate from simulated `GameRecord`s because they have no
simulation detail or clickable game identity.

The `history` entry is excluded because it becomes mutable save state after a
season completes. Starting a new league intentionally clears all base data,
including history, before loading and caching a fresh `history.json`
historical baseline. Runtime team history uses that single baseline; raw
season-result files are build-time inputs only.

Completed simulated seasons also write one exact-schema `SeasonMemory`. It
stores typed postseason game references and lean award-winner facts without
duplicating scores, identities, season totals, full player logs, or generated
prose. Award display joins identity and `playerSeasons` at load time.

Every completed game atomically publishes one `game:<gameId>` news item with
stable rendered copy, editorial classification, and newsworthiness. Game
details may later be pruned, but published stories remain available in the
dynasty news archive. Startup integrity requires exactly one story per
completed game and none for unplayed games.

Every persisted game-detail play contains one exact `PlayParticipants` object.
Its nullable role IDs distinguish non-applicable roles from required linked
starters. Historical integrity joins those IDs to the matching current player
or annual player identity and rejects dangling, wrong-team, or ineligible-role
references; there is no anonymous-play fallback.

Every play also contains one exact `PlayCall`: a scrimmage matchup containing
the offensive concept and defensive intent, a punt/field-goal special-teams
call, a contextual spike/kneel clock-management call, an extra-point try, or a
two-point concept/intent matchup. Historical integrity
rejects missing or extra fields, unknown concepts or intents, calls that
disagree with the coarse play type, clock management in overtime, defensive
intent on special teams, and special-teams calls outside fourth down.
`yardsLeft` always records the pre-snap distance; post-play distance remains
transient drive state.

Every play contains one exact `PlayTiming` union. Regulation timing stores
start/end clock snapshots, elapsed game-clock seconds, out-of-bounds status,
tempo, an optional charged-timeout side, and an optional two-minute or
period-boundary event. Overtime timing stores only the explicit untimed
overtime period. Untimed try timing stores either the regulation dead-ball
quarter/time or the explicit overtime period. Historical validation rejects
the removed flat timing fields,
malformed regulation/overtime combinations, more than three timeouts per team
per half, timeouts after natural stops, and incoherent spike/kneel artifacts.
Runtime timeout counts are not duplicated in game detail; historical use and
remaining counts are reconstructed from play timing.

A touchdown play and its try are separate persisted plays in one drive.
Historical integrity requires an immediate final try unless the terminal score
legally makes it unnecessary, rejects extra points in the second and later
overtimes, and requires third-and-later overtime drives to contain exactly one
two-point attempt. Extra points credit existing kicker fields; two-point
participants remain visible but are excluded from ordinary player and team
statistics.

Every current or historical player has exactly one `playerOrigins` record.
Recruit origins retain durable public recruiting facts; walk-ons, initial
roster members, and players created when a program enters the league use
explicit variants instead of inferred recruiting history. Origins are written
atomically with player creation, survive when an identity is archived, and are
deleted when an unused player is permanently discarded.

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
- game and player ID counters.

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

Before React renders, `initializeDatabase()` also validates historical
identities, annual player aggregates, nested game detail, memory references,
and the selected-detail retention policy. Orphaned or malformed authoritative
records delete the entire database and recreate an empty current schema.

## Write Ownership

- `startNewLeague()` prepares a complete league, roster, and initial games,
  then `commitNewLeague()` replaces all authoritative save stores atomically.
- Each completed-game simulation batch atomically writes its compact games,
  nested details, game/ranking news, and league state. Postseason scheduling
  runs afterward through its own explicit game-and-league transactions; live
  finalization therefore keeps the session open until all phases finish.
- Summary advancement atomically appends team history and the completed
  season's dynasty-memory and player-season records, prunes ordinary AI detail,
  and enters realignment.
- Summary advancement and historical realignment use
  `commitOffseasonTransition()`. Realignment atomically inserts any new
  programs, their complete entry rosters, their origins, and the updated league.
  Recruiting and simulation mutations belong to their dedicated commands.
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
- `src/db/seasonMemoryRepo.ts`
- `src/domain/league/rosterFinalization.ts`
