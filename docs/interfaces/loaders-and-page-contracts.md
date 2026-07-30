# Loaders and Page Contracts

## Contract

Page loaders are read-only application queries. They:

1. read current authoritative records;
2. validate required league and roster state at the repository boundary;
3. build a page-specific projection;
4. return typed data without persisting defaults, repairs, or projections.

Commands are the only mutation entry points.

## League Readers

- `loadLeagueOptional()` returns `null` only when `league/current` is absent.
  Home uses this to represent the no-save state.
- `loadLeagueOrThrow()` requires a current valid league.
- `loadLeaguePlayersSnapshot()` reads and validates league plus players in one
  readonly transaction.
- `loadRecruitingLifecycleSnapshot()` reads and validates league, recruiting,
  and players in one readonly transaction.

Invalid records throw `LeagueDataIntegrityError`; they are never treated as an
absent save by a loader. The application startup boundary runs before page
loaders and discards an invalid authoritative save as a whole.

## Lifecycle Loaders

| Loader | On-stage projection | Off-stage projection | Snapshot |
| --- | --- | --- | --- |
| `loadSeasonSummary` | champion, awards, prestige summary | empty summary | league + players |
| `loadRealignment` | current configuration and next-season preview | gated empty setup | league |
| `loadRosterProgression` | returning/departing player preview | empty progression | league + players |
| `loadRecruiting` | public prospect market, board, standings, capacity, budget, rules, cursor | empty recruiting workspace | league + recruiting + players |
| `loadRecruitingSummary` | finalized public class rankings | empty recruiting results | league + recruiting + players |
| `loadRosterCuts` | full active roster, protected/selectable states, persisted selections, recommendations, constraints, cursor | empty cuts | league + recruiting + players |
| `loadNonCon` | preseason schedule editor | empty schedule outside preseason | league |

Interactive Recruiting requires an active or signing-day-ready same-year
aggregate. Recruiting Summary and Roster Cuts require a finalized same-year
aggregate when their stage is active.

## Roster-Dependent Readers

Readers that project player data use `loadLeaguePlayersSnapshot()` and consume
the returned player array. Readers that do not use roster data do not perform a
roster read merely as a side effect.

## Invariants

- Repeated loads return stable projections for unchanged IndexedDB state.
- Loaders never clear, create, or rewrite players.
- The recruiting projection exposes stars, national rank, preferences, fit,
  offers, points, and interest standings. Rating ranges, true/future ratings,
  development traits, seeds, and AI decision data remain private.
- Recruiting Summary projects finalized prospects in public national-rank
  order. It exposes stars and the absolute class score, but not exact freshman
  ratings or links into rating-bearing player pages.
- Roster-cut recommendations are rebuilt on every read from standard player
  records, persisted selections, and the recruiting seed; loaders never
  persist them.
- Stale routes do not mutate the authoritative stage.
- Dashboard and Team Schedule reads do not initialize the season;
  `initializeSeason()` owns that write.
- Navigation envelope construction is in-memory only.

## Source Map

- `src/domain/league/leagueStore.ts`
- `src/db/leagueRepo.ts`
- `src/db/recruitingRepo.ts`
- `src/domain/league/loaders/navigationEnvelope.ts`
- `src/domain/league/loaders/`
- `src/types/pages.ts`
