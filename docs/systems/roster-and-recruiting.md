# Roster and Recruiting Lifecycle

## Purpose

This document owns roster scale and the annual path from player progression
through recruiting, Signing Day, roster cuts, and preseason preparation. The
competitive formulas used to value and pursue prospects belong in the
[Recruiting Model](recruiting-model.md).

## Roster Contract

Every finalized roster contains 80 active players:

| Position | Players | Starters |
| --- | ---: | ---: |
| QB | 5 | 1 |
| RB | 6 | 2 |
| WR | 9 | 3 |
| TE | 6 | 1 |
| OL | 15 | 5 |
| DL | 11 | 4 |
| LB | 9 | 3 |
| CB | 8 | 2 |
| S | 7 | 2 |
| K | 2 | 1 |
| P | 2 | 1 |

`src/domain/rosterConfig.ts` derives the 80-player final size, four-player
oversign allowance, and 84-player maximum from this positional configuration.

New leagues begin with four exact 20-player classes. `prepareInitialRosters()`
creates those players, selects starters, and calculates team ratings before
`startNewLeague()` commits the save. Loaders and simulation readers never
create or repair rosters.

When historical realignment introduces a program, that transition creates the
same 80-player, four-class roster for the new team. Talent follows the normal
prestige-aware bootstrap model, while existing team ratings and rankings stay
unchanged. The league, entry players, and `program_entry` origins commit in one
transaction, so a new team is never persisted without a roster. Entry seniors
then depart during the normal progression step and recruiting supplies the
incoming freshman class.

## Annual Supply

Every recruiting year contains 3,372 prospects:

| Stars | Prospects |
| ---: | ---: |
| 5 | 32 |
| 4 | 340 |
| 3 | 2,800 |
| 2 | 200 |

The pool supplies national elite talent, ordinary three-star depth, and a
two-star buffer. Standard one-star walk-ons are generated only when a team
needs players to reach 80 after Signing Day. AI planning aims for two
oversignings, while the authoritative capacity rule permits four.

## Progression

Roster Progression is a read-only preview of departing seniors and returning
players' next class and rating. Advancing calls `initializeRecruiting()`, which
uses one transaction to:

1. progress returning players;
2. remove departing seniors from active rosters;
3. retain the required player identity and season history;
4. generate the seeded prospect pool and team recruiting state;
5. move the league from `progression` to `recruiting`.

## Recruiting Loop

Recruiting lasts six rounds. The player can:

1. add up to 25 prospects to the recruiting board;
2. assign any portion of the weekly point budget;
3. advance one round, allowing AI to spend the remaining feasible budget;
4. review new commitments and public interest standings;
5. continue through round six or use **Sim to End of Recruiting**.

The simulation action preserves the current round's submitted allocations,
gives AI control of later rounds, resolves Signing Day, creates freshmen, and
enters Recruiting Summary atomically.

The page exposes names, states, positions, stars, national ranks, preferences,
team fit, offers, lifetime points, standings, and commitments. Exact ratings,
future ratings, development traits, seeds, and AI scores remain private.
Roster Cuts is the first stage that reveals a freshman's exact current rating.

## Points and Commitments

Weekly budgets range from 90 to 120 by prestige. A team may spend at most 25%
of its budget on one prospect. Initial interest is 40% of team fit, and weekly
interest uses:

```text
interest gain = points × (0.75 + fit / 200)
```

A prospect commits after reaching 55 interest with a lead of at least 10.
Before Signing Day, a prospect who reaches the threshold without the required
lead remains available. Signing Day resolves all remaining prospects with at
least 55 interest; exact ties use the persisted recruiting seed.

## Persisted State and Commands

`RecruitingState` is a versioned singleton separate from `LeagueState`. It
contains the prospect pool, team boards and totals, round, status, seed,
version, and pending user cut IDs.

Commands in `src/domain/league/recruiting.ts` own initialization, board
updates, round advancement, AI completion, and Signing Day. Each command checks
the expected stage, year, round, status, and version inside its transaction.
Stale or invalid commands leave every store unchanged.

`loadRecruiting()` returns a read-only public projection. Weekly point edits
remain local until round advancement; board changes persist immediately.
Conflicts reload IndexedDB instead of merging assumptions into newer state.

## Signing Day and Roster Cuts

Signing Day requires round six and `ready_for_signing_day`. Finalization
resolves remaining commitments, converts each commitment into one freshman,
advances the player ID counter, marks recruiting finalized, and enters
`recruiting_summary` in one transaction.

`initializeRosterFinalization()` validates that aggregate, generates walk-ons
for shortages, and enters `roster_cuts`. Incoming freshmen are protected. User
selections persist immediately and must preserve positional starter minimums.

`finalizeRoster()` keeps the user's cuts, fills any remaining user and AI cuts
with the recommendation engine, validates every 80-player roster, selects
starters, recalculates ratings, prepares preseason, clears prior play-by-play,
deletes recruiting state, and enters `preseason` atomically.

## Invariants

- IndexedDB is authoritative; loaders are read-only.
- Initial bootstrap, program entry, and annual recruiting are distinct creation
  paths with shared roster rules.
- Freshmen and walk-ons are created exactly once within guarded transactions.
- Human and AI allocations resolve simultaneously under the same rules.
- Prospect generation and tie resolution are deterministic from persisted
  state and seed.
- Hidden prospect data never crosses the page or AI snapshot boundary.
- Recruiting Summary is read-only and preserves public national-rank order.
- Every finalized roster contains exactly 80 players and satisfies every
  starter minimum.

## Source Map

- `src/domain/rosterConfig.ts`
- `src/domain/rosterBootstrap.ts`
- `src/domain/league/loaders/loadRosterProgression.ts`
- `src/domain/league/recruiting.ts`
- `src/domain/league/loaders/loadRecruiting.ts`
- `src/domain/league/rosterFinalization.ts`
- `src/domain/recruiting/config.ts`
- `src/domain/recruiting/resolution.ts`
- `src/domain/recruiting/freshmen.ts`
- `src/domain/rosterCuts.ts`
- `src/domain/walkOns.ts`
- `src/db/recruitingRepo.ts`
