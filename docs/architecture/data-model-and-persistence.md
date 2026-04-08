# Data Model and Persistence

## Scope

Defines persistent schema, core state types, ID generation, and ownership of reads/writes across the architecture runtime.

## Entry Points

- DB bootstrap/schema creation: `getDb()`.
- League persistence API: `loadLeague<T>()`, `saveLeague<T>()`, `clearLeague()`.
- Sim persistence API: `saveGames`, `saveDrives`, `savePlays`, `saveGameLogs`, `savePlayers` and corresponding reads.
- Counter management: `normalizeCounters()`, `nextId()` and `createNonConGameRecord()` internal counter increment path.

## Core Types and Stores

### IndexedDB Store Inventory

| Store | Key Path | Value Type | Indexes |
|---|---|---|---|
| `baseData` | `key` | `{ key: string; value: unknown }` | none |
| `league` | `key` | `{ key: string; value: unknown }` | none |
| `games` | `id` | `GameRecord` | `weekPlayed`, `teamAId`, `teamBId`, `winnerId` |
| `drives` | `id` | `DriveRecord` | `gameId` |
| `plays` | `id` | `PlayRecord` | `gameId`, `driveId` |
| `gameLogs` | `id` | `GameLogRecord` | `gameId`, `playerId` |
| `players` | `id` | `PlayerRecord` | `teamId`, `pos` |

### Core State Types

- `LeagueState`
  - Mutable runtime aggregate for stage and season orchestration.
  - Critical fields: `info`, `teams`, `conferences`, `settings`, `playoff`, `idCounters`, `scheduleBuilt`, `simInitialized`, `pending_rivalries`.
- `Info`
  - Stage and temporal cursor (`currentWeek`, `currentYear`, `stage`, `lastWeek`, user team/color context).
- `Settings`
  - Postseason topology and automation flags (`playoff_teams`, autobids, top-4 behavior, realignment toggles).
- `PlayoffState`
  - Persistent IDs of generated postseason games by round plus `seeds`.
- `idCounters`
  - Monotonic IDs for `game`, `drive`, `play`, `gameLog`, `player`.

### Record Types

- `GameRecord`: matchup metadata + odds snapshot + score/outcome/headline fields + clock metadata.
- `DriveRecord`: persisted per-drive scoring/field-position state.
- `PlayRecord`: persisted per-play down/distance/outcome text + optional clock/quarter/play duration.
- `GameLogRecord`: per-player game-stat line item.
- `PlayerRecord`: roster identity + class + ratings progression + active/starter flags.

## Execution Flow

1. **Schema initialization**
- `getDb()` opens DB `cfbsim` version `1`, creates stores/indexes if absent.

2. **League-level persistence boundary**
- League aggregate is stored as a single logical record under `league/current`.
- Every loader/orchestrator mutation path that changes `LeagueState` explicitly persists via `saveLeague()`.

3. **Simulation artifact persistence boundary**
- `initializeSimData()` writes game skeleton records for the year.
- `advanceWeeks()` batches writes for drives/plays/gameLogs and updates games records.
- Live sim finalization path writes updated game + artifacts via `finalizeGameSimulation()`.

4. **Roster persistence boundary**
- Roster setup/update writes use `savePlayers()` and read via `getAllPlayers()`/`getPlayersByTeam()`.
- Full reset paths may clear players (`clearAllSimData`, `clearPlayers`) depending on flow.

5. **ID counter progression**
- `nextId()` (postseason paths) and `createNonConGameRecord()` (non-con/rivalry paths) increment `league.idCounters.game`.
- Counter normalization initializes missing counters to `1`.

## Invariants and Constraints

- IndexedDB is authoritative for all persisted league and sim artifacts.
- `league` store is singleton by key `current`; no multi-slot league history in this schema.
- `idCounters` must remain monotonic within a league to avoid key collisions across generated records.
- `normalizeLeague()` must be run on loaded league state to enforce structural defaults (`startYear`, postseason state, rivalry host seeds).
- `clearNonGameArtifacts()` must preserve scheduled `games` while removing dependent sim artifacts.

## Failure/Edge Cases

- Missing league record returns `null` in repo API; higher-level loaders may throw if required.
- Backward compatibility for legacy league shapes handled through normalization and immediate save.
- Empty batch saves are short-circuited for drives/plays/gameLogs/players.
- Sim resets (`clearAllSimData`) clear `players` and all game artifacts; season resets (`clearNonGameArtifacts`) intentionally retain games.

## Source Map (file/function references)

- `src/db/db.ts`: `getDb`, `Frontend2DB` schema definitions
- `src/db/leagueRepo.ts`: `loadLeague`, `saveLeague`, `clearLeague`
- `src/db/simRepo.ts`: read/write/clear API for `games`, `drives`, `plays`, `gameLogs`, `players`
- `src/types/league.ts`: `LeagueState`, `PlayoffState`, `DEFAULT_SETTINGS`, `ensureSettings`
- `src/types/domain.ts`: `Info`, `Settings`, `Team`
- `src/types/db.ts`: `GameRecord`, `DriveRecord`, `PlayRecord`, `GameLogRecord`, `PlayerRecord`
- `src/domain/sim/ids.ts`: `normalizeCounters`, `nextId`
- `src/domain/league/seasonReset.ts`: `createNonConGameRecord`, `resetSeasonData`
- `src/domain/league/normalize.ts`: `normalizeLeague`
