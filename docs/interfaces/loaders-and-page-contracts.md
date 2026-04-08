# Loaders and Page Contracts

## Scope

Explains the data-contract boundary between domain loaders and UI pages: what triggers each loader, what it expects, what it returns, and which lifecycle side effects it can apply.

## System Model

The interface layer is built around a consistent pattern:

- Pages call `useDomainData({ fetcher })`.
- `fetcher` is a domain loader function (or service call) that returns a page contract object.
- Loader contracts include enough context for rendering (`info`, `team`, `conferences`) and page-specific payloads.
- Some loaders are read-only; others are read-plus-transition (they can mutate stage/state and persist).

`useDomainData` also listens for `pageDataRefresh`, creating a shared refresh channel after mutating actions like week advancement.

## Execution Flow

1. **Page trigger**
- A route component mounts and creates a `fetcher` closure.
- `useDomainData` invokes `fetcher`, sets loading/error/data states.

2. **Loader run**
- Loader resolves league context through `loadLeagueOrThrow`/`loadLeagueOptional`.
- Loader may enforce prerequisites (`ensureRosters`, `ensureSettings`, schedule bootstrap, stage transitions).
- Loader gathers and shapes DB/domain data for that page.

3. **Optional side effects**
- Some loaders mutate league stage/settings or initialize schedule/sim state and persist those changes.
- Read-heavy loaders still may normalize or ensure roster/settings before returning payloads.

4. **UI consume**
- Page renders based on returned contract, usually expecting `info`, `team`, `conferences`, and page-specific fields.

## Key Mechanics

- **Contract typing strategy**: page data types are centralized in `src/types/pages.ts` using `Awaited<ReturnType<loader>>`, so loader return shapes are the authoritative contract source.
- **Stage-aware loaders**: offseason loaders are both retrieval and transition points (for example, progression/recruiting/cuts advancement).
- **Bootstrap-on-read pattern**: some season loaders (`loadDashboard`, `loadTeamSchedule`) can initialize schedule/sim state if not yet built.
- **Shared envelope convention**: most contracts include `info`, selected `team`, and `conferences` for layout/nav consistency.

## Invariants and Constraints

- Loader return shape is the de facto API consumed by page components.
- Mutating loaders are expected to persist league/player/game changes before returning.
- Year-scoped pages should filter game data to `currentYear` unless intentionally historical.
- `useDomainData` expects thrown errors for failure paths and surfaces message text directly.

## Failure/Edge Cases

- Missing league in required loaders throws immediately with user-facing start-new-game guidance.
- Out-of-order stage access usually returns safe data while guarding transition helpers from illegal jumps.
- Bootstrap conditions can cause first load of a page to mutate state (intentional behavior).

## What You Can Observe in the App

- Loading a page can sometimes advance lifecycle stage (especially in offseason routes).
- Re-opening dashboard/team schedule after reset can trigger schedule/sim initialization behavior.
- `pageDataRefresh` events cause pages using `useDomainData` to refetch without full route navigation.

## Contract Matrix (Major Loaders)

| Loader | Trigger Context | Key Inputs | Key Outputs | Lifecycle / Side Effects |
|---|---|---|---|---|
| `loadHomeData` | Home page mount/year switch | optional year | years, preview, optional current league info | read-only |
| `startNewLeague` | Home/Noncon new league action | teamName, year, playoff settings | initialized non-con page payload | clears sim/base cache, initializes league/rosters/schedule, persists |
| `loadNonCon` | Non-con page load | none | schedule, pending rivalries, league envelope | can transition `roster_cuts -> preseason` via `advanceToPreseason` |
| `scheduleNonConGame` | Non-con schedule action | opponent, week | void mutation | creates/saves one non-con game + league update |
| `loadDashboard` | Dashboard route | none | team snapshot, conf standings slice, top games, schedule snippets | may bootstrap season schedule/sim and set stage to `season` |
| `loadWeekSchedule` | Weekly schedule route | week number | ordered week games + league envelope | ensures rosters + save |
| `loadTeamSchedule` | Team schedule route | team name, optional year | week-by-week team schedule, years list | may bootstrap season schedule/sim for current year |
| `loadGame` | Game route | gameId | game, preview, result summary, drives | read-only data shaping |
| `loadRankings` | Rankings route | none | ranked teams with last/next game cards | ensures rosters + save |
| `loadStandings` | Standings route | conference name | conference standings table + game cards | ensures rosters + save |
| `loadPlayoff` | Playoff route | none | bracket/projection + bubble/resume/bowls view | read-mostly, derives from current league+games |
| `loadAwards` | Awards route | none | favorites and (summary-stage) final awards | ensures rosters + save |
| `loadSeasonSummary` | Summary route | none | champion, awards, team summary context | can update history snapshot during summary stage |
| `loadRealignment` | Realignment route | none | settings + projected realignment/playoff changes | transitions `summary -> realignment` and applies prestige changes |
| `loadRosterProgression` | Offseason progression route | none | leaving/progressed players | invokes `advanceToProgression` |
| `loadRecruitingSummary` | Recruiting route | none | team rankings + recruiting stats | invokes recruiting stage transition and persists players |
| `loadRosterCuts` | Roster cuts route | none | projected cuts | invokes `advanceToRosterCuts` |
| `loadSettings` | Settings route | none | settings payload | ensures settings defaults + save when needed |

## Source Map (file/function references)

- `src/domain/hooks.ts`: `useDomainData`
- `src/types/pages.ts`: page contract type aliases
- season loaders:
  - `src/domain/league/loaders/season.ts`
  - `src/domain/league/loaders/season/loadDashboard.ts`
  - `src/domain/league/loaders/season/loadNonCon.ts`
  - `src/domain/league/loaders/season/loadWeekSchedule.ts`
  - `src/domain/league/loaders/season/loadTeamSchedule.ts`
  - `src/domain/league/loaders/season/loadGame.ts`
  - `src/domain/league/loaders/season/scheduleNonConGame.ts`
  - `src/domain/league/loaders/season/startNewLeague.ts`
- offseason loaders: `src/domain/league/loaders/offseason.ts`
- stats/team/playoff loaders:
  - `src/domain/league/loaders/index.ts`
  - `src/domain/league/loaders/stats.ts`
  - `src/domain/league/loaders/team.ts`
  - `src/domain/league/loaders/playoff.ts`
