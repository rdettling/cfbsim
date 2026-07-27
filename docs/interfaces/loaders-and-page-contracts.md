# Loaders and Page Contracts

## Scope

Explains the data-contract boundary between domain loaders and UI pages: what triggers each loader, what it expects, what it returns, and which lifecycle side effects it can apply.

## System Model

The interface layer is built around a consistent pattern:

- Pages call `useDomainData({ fetcher })`.
- `fetcher` is a domain loader function (or service call) that returns a page contract object.
- Loader contracts include enough context for rendering (`info`, `team`, `conferences`) and page-specific payloads.
- Offseason loaders are lifecycle-read-only. Explicit commands own offseason
  transitions and persistence.

`useDomainData` also listens for `pageDataRefresh`, creating a shared refresh
channel after mutating actions like week advancement. Event-driven refreshes
keep the existing page and shell mounted while authoritative data reloads, so
recoverable advancement feedback is not discarded by a full loading state.

## Execution Flow

1. **Page trigger**
- A route component mounts and creates a `fetcher` closure.
- `useDomainData` invokes `fetcher`, sets loading/error/data states.

2. **Loader run**
- Loader resolves league context through `loadLeagueOrThrow`/`loadLeagueOptional`.
- Loader may enforce compatibility prerequisites (`ensureRosters`,
  `ensureSettings`) or documented season bootstrap behavior.
- Loader gathers and shapes DB/domain data for that page.

3. **Optional side effects**
- Season bootstrap loaders can still initialize schedule/sim state.
- Offseason loaders may normalize old records or initialize missing
  settings/rosters, but never change stage/year or apply offseason work.

4. **UI consume**
- Page renders based on returned contract, usually expecting `info`, `team`, `conferences`, and page-specific fields.

## Key Mechanics

- **Contract typing strategy**: page data types are centralized in `src/types/pages.ts` using `Awaited<ReturnType<loader>>`, so loader return shapes are the authoritative contract source.
- **Stage-gated offseason loaders**: on-stage calls return display data;
  off-stage calls return the shared envelope and empty page-specific payloads.
- **Explicit offseason command**: `advanceOffseasonStage` applies and persists
  one guarded transition, then returns the destination route.
- **Next-season configuration command**: `updateNextSeasonConfiguration`
  validates and merges a typed partial update atomically only during
  `realignment`.
- **Bootstrap-on-read pattern**: some season loaders (`loadDashboard`, `loadTeamSchedule`) can initialize schedule/sim state if not yet built.
- **Shared envelope convention**: affected offseason contracts and the
  compatibility redirect use one small helper returning `info`, selected
  `team`, and `conferences`.

## Invariants and Constraints

- Loader return shape is the de facto API consumed by page components.
- Offseason mutations must use the explicit atomic transition command.
- Year-scoped pages should filter game data to `currentYear` unless intentionally historical.
- `useDomainData` expects thrown errors for failure paths and surfaces message text directly.

## Failure/Edge Cases

- Missing league in required loaders throws immediately with user-facing start-new-game guidance.
- Out-of-order offseason access returns gated data and cannot jump stages.
- Bootstrap conditions can cause first load of a page to mutate state (intentional behavior).

## What You Can Observe in the App

- Loading an offseason page never advances lifecycle stage.
- Re-opening dashboard/team schedule after reset can trigger schedule/sim initialization behavior.
- `pageDataRefresh` events cause pages using `useDomainData` to refetch without full route navigation.

## Contract Matrix (Major Loaders)

| Loader | Trigger Context | Key Inputs | Key Outputs | Lifecycle / Side Effects |
|---|---|---|---|---|
| `loadHomeData` | Home page mount/year switch | optional year | years, preview, optional current league info | read-only |
| `startNewLeague` | Home team-selection action | typed exact year/team/playoff input | initialized non-con page payload | clears base cache, prepares league/rosters/schedule, atomically replaces league and sim stores |
| `loadNonCon` | Non-con page load | none | schedule, pending rivalries, league envelope | lifecycle-read-only; off-stage schedule and pending rivalries are empty |
| `scheduleNonConGame` | Non-con schedule action | opponent, week | void mutation | creates/saves one non-con game + league update |
| `loadDashboard` | Dashboard route | none | team snapshot, conf standings slice, top games, schedule snippets | may bootstrap season schedule/sim and set stage to `season` |
| `loadWeekSchedule` | Weekly schedule route | week number | ordered week games + league envelope | ensures rosters + save |
| `loadTeamSchedule` | Team schedule route | team name, optional year | week-by-week team schedule, years list | may bootstrap season schedule/sim for current year |
| `loadGame` | Game route | gameId | game, preview, result summary, drives | read-only data shaping |
| `loadRankings` | Rankings route | none | ranked teams with last/next game cards | ensures rosters + save |
| `loadStandings` | Standings route | conference name | conference standings table + game cards | ensures rosters + save |
| `loadPlayoff` | Playoff route | none | bracket/projection + bubble/resume/bowls view | read-mostly, derives from current league+games |
| `loadAwards` | Awards route | none | favorites and (summary-stage) final awards | ensures rosters + save |
| `loadSeasonSummary` | Summary route | none | champion, awards, teams, derived prestige preview | lifecycle-read-only; off-stage champion is null and awards/teams are empty |
| `loadRealignment` | Next Season Setup route | none | typed configuration, historical source metadata, conference/postseason preview | lifecycle-read-only; off-stage configuration/preview are null with no preview error |
| `loadRosterProgression` | Offseason progression route | none | typed returning/departing previews, ordered positions, summary metrics | lifecycle-read-only; user-team active players only; empty zeroed payload off-stage |
| `loadRecruitingSummary` | Recruiting route | none | typed team/player rankings, ordered positions, user class, national summary | reads finalized active freshmen; complete untruncated results; empty zeroed output off-stage |
| `loadRosterCuts` | Roster cuts route | none | typed projected cuts, ordered position limits, roster summary | lifecycle-read-only; user-team only; empty zeroed payload off-stage |
| `loadAuthoritativeStage` | `/settings` compatibility redirect | none | current-stage navigation envelope only | compatibility normalization may supply missing legacy settings; UI replace-redirects to the catalog route |

### Exact Off-Stage Offseason Payloads

All entries retain the navigation envelope.

| Loader | Off-stage page payload |
|---|---|
| `loadSeasonSummary` | `champion: null`, empty awards and teams |
| `loadRealignment` | `configuration: null`, `preview: null`, no preview error |
| `loadRosterProgression` | empty returning/departing/positions and zeroed summary |
| `loadRecruitingSummary` | empty rankings/positions, `userTeam: null`, and zeroed summary |
| `loadRosterCuts` | empty cuts/positions and zeroed summary |
| `loadNonCon` | empty schedule and pending rivalries |

## Source Map (file/function references)

- `src/domain/hooks.ts`: `useDomainData`
- `src/db/newLeagueRepo.ts`: atomic new-league commit
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
- offseason loaders:
  - `src/domain/league/loaders/navigationEnvelope.ts`
  - `src/domain/league/loaders/loadAuthoritativeStage.ts`
  - `src/domain/league/loaders/loadRealignment.ts`
  - `src/domain/league/loaders/loadRosterProgression.ts`
  - `src/domain/league/loaders/loadRecruitingSummary.ts`
  - `src/domain/league/loaders/loadRosterCuts.ts`
- Summary and awards loaders: `src/domain/league/loaders/offseason.ts`
- offseason command: `src/domain/league/stages.ts`
- authoritative stage catalog: `src/constants/stages.ts`
- stats/team/playoff loaders:
  - `src/domain/league/loaders/index.ts`
  - `src/domain/league/loaders/stats.ts`
  - `src/domain/league/loaders/team.ts`
  - `src/domain/league/loaders/playoff.ts`
