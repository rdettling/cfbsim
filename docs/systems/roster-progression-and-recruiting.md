# Roster Progression and Recruiting

## Purpose

This document owns the implementation flow from roster bootstrap through
progression, recruiting, Signing Day, cuts, and preseason preparation. Product
rules belong in the recruiting design documents; this document defines state,
transaction, command, and loader ownership across the lifecycle.

## Roster Bootstrap

`prepareInitialRosters()` is the only roster bootstrap path. It is called by
`startNewLeague()` before the new save is committed.

The bootstrap:

1. loads recruiting name and state source data;
2. creates four exact 20-player classes whose combined positions match the
   configured 80-player roster;
3. selects starters;
4. calculates team ratings;
5. returns player records for the atomic new-league commit.

No loader or simulation reader creates a roster. Missing or malformed roster
data throws `INVALID_ROSTER_STATE`.

## Progression

Roster Progression is a read-only preview built from a league-plus-players
snapshot. It identifies:

- seniors who will depart;
- returning players' next class;
- their next persisted class rating;
- user-team position and summary totals.

The transition from `progression` to `recruiting` calls
`initializeRecruiting()`. Within one transaction it progresses returning
players, marks departing seniors inactive, generates the seeded recruiting
aggregate, and changes the stage.

## Persistent Recruiting

`RecruitingState` is a versioned singleton separate from `LeagueState`. It
contains prospects, team recruiting state, the round cursor, status, seed,
version, and pending cut IDs.

Commands in `src/domain/league/recruiting.ts` own:

- initialization;
- user-board changes;
- assisted round advancement with submitted user allocations;
- atomic completion of all remaining rounds with AI;
- signing-day finalization.

Each command checks expected stage, year, round, status, and version against
records read inside its transaction. Stale or invalid commands leave all stores
unchanged.

`RecruitingContext` is rebuilt after database reads from current league teams
and players. Its maps and indexes are never persisted.

`loadRecruiting()` reads the league, recruiting aggregate, and players in one
readonly snapshot. It returns the command cursor, user board, budget, capacity,
positional needs, and public prospect fit and interest standings. Hidden
ratings, development traits, the seed, persisted allocations, and AI planning
data never enter the page contract.

The Recruiting page persists board changes immediately and keeps weekly point
edits local. `advanceRecruitingRound()` validates those edits as minimums,
lets AI spend the feasible remainder, and resolves the week atomically.
`completeRecruitingWithAi()` repeats the same public-information strategy
through Signing Day in one transaction. Round six also supports separate
guarded Signing Day resolution. Conflicts reload the authoritative snapshot
instead of merging or repairing state.

## Finalization

Signing-day finalization:

1. requires round 6 and `ready_for_signing_day`;
2. resolves remaining signing decisions;
3. deterministically converts every commitment into one freshman;
4. advances the player ID counter;
5. marks recruiting finalized;
6. enters `recruiting_summary`.

These writes commit atomically. The finalized aggregate remains available
through Recruiting Summary and Roster Cuts, and is deleted only by successful
roster finalization. Recruiting Summary derives its public class results from
that aggregate, preserves public national rank, and withholds exact freshman
ratings. Roster Cuts is the first exact-rating reveal.

## Roster Finalization

The `recruiting_summary` transition calls
`initializeRosterFinalization()` inside a league, recruiting, player, and base
data transaction. It validates the finalized round-six aggregate, then gives
teams below 80 standard one-star walk-ons. Starter shortages are filled before
soft positional deficits. Team, slot, and position tie decisions use keyed
forks of the persisted recruiting seed.

Roster Cuts is command-managed. `selectRosterCut()` and `undoRosterCut()` read
and validate authoritative records inside their transactions, persist only
user cut IDs, and increment the recruiting version once. Active freshmen are
protected, and every partial selection must preserve positional starter
minimums.

`finalizeRoster()` requires the user to select exactly enough returning players
to reach 80. Non-user cuts are chosen iteratively from soft positional surplus,
then lowest senior/current value and older class. The command validates every
final roster, selects starters, recalculates ratings with team-keyed seed
forks, prepares preseason, clears prior play-by-play, deletes recruiting state,
and enters Preseason in one transaction.

The Roster Cuts loader remains read-only and returns the full active roster,
persisted selections, remaining recommendations, protected and blocked states,
positional constraints, the current version, and finalization readiness. The
page applies select and undo commands immediately and enables finalization only
when the authoritative projection is ready.

## Invariants

- IndexedDB is authoritative.
- Bootstrap and annual recruiting are separate paths.
- Loaders never generate or repair players.
- Freshmen are created exactly once.
- Recruiting formulas and tuning stay in pure recruiting modules.
- AI strategy receives a fresh public-only snapshot. Hidden prospect ratings,
  future ratings, and development traits never cross that boundary.

## AI Recruiting

Each round-advancement command builds one public snapshot for every team. The
pure strategy preserves submitted user allocations as minimums, fills the
remaining feasible user budget, ranks eligible candidates, admits distinct
new pursuits that can reach the meaningful threshold, and allocates the
remaining points across active pursuits. AI boards contain only meaningful
active pursuits; the user board retains unfunded player-selected targets. The
command applies every board through the normal transformation and passes all
allocations together to the round resolver.

AI boards persist as ordinary team recruiting state; current-round allocations
clear after resolution. Strategy scores, public projections, diagnostics, and
random cursors remain ephemeral. Keyed forks of the offseason seed break exact
ties without making team iteration order observable.

## Balance Evaluation

`eval:recruiting-balance` runs complete repeated recruiting years entirely in
memory. It starts from a seeded use of the existing four-class bootstrap, then
calls the production progression, all-AI recruiting, freshman conversion,
walk-on, cut, starter, rating, history, and prestige functions. Roster-rating
rank is the deterministic completed-season proxy.

The default command is a one-year smoke run. The representative validation run
uses three keyed seeds across four recruiting years with one seed replayed for
reproducibility. The report includes structural checks, reproducibility
checksums, class-score distribution and ties, class-size distribution,
top-25 composition by prestige, signed and unsigned supply by star and position,
commitments, meaningful and contested pursuits, admissions, unfilled fundable
openings, target loss and replacement, capacity, walk-ons, cuts, roster
ratings, and prestige mobility. It neither reads nor writes the application
database, and its report types are not persisted.

The evaluator reports structural failures separately from aggregate balance
gates. Normal commitments require 55 interest and a 10-point lead. AI planning
targets two oversignings even though authoritative capacity permits four.
Signing Day share and low-prestige elite share remain informational because
neither has a defensible universal threshold. Structural legality, completion,
walk-ons, oversigning, hierarchy correlation, and mobility retain explicit
gates. See [Recruiting Hierarchy](../design/recruiting-hierarchy.md)
and [Roster and Recruit Supply](../design/roster-and-recruit-supply.md).

## Source Map

- `src/domain/rosterBootstrap.ts`
- `src/domain/roster.ts`
- `src/db/leagueRepo.ts`
- `src/domain/league/loaders/loadRosterProgression.ts`
- `src/domain/league/recruiting.ts`
- `src/domain/league/rosterFinalization.ts`
- `src/domain/recruiting/`
- `src/domain/recruiting/classScoring.ts`
- `src/domain/rosterCuts.ts`
- `src/domain/walkOns.ts`
- `src/domain/recruiting/evaluation.ts`
- `scripts/eval_recruiting_balance.ts`
- `src/db/recruitingRepo.ts`
