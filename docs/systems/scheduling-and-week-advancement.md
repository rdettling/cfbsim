# Scheduling and Week Advancement

## Purpose

This document owns preseason schedule editing, regular-season schedule
construction, weekly simulation ordering, and the handoff to postseason game
creation. Postseason selection rules belong in
[Rankings, Playoff, and Awards](rankings-playoff-and-awards.md).

## Preseason Scheduling

New-league creation and annual reset enter `preseason` with the schedule and
simulation flags unset. `initializeNonConScheduling()` resolves rivalry
constraints, persists fixed-week rivalry games, and projects the user's open
non-conference slots.

The player may add or remove games only during `preseason` before the full
schedule exists. Candidate selection rejects:

- occupied or invalid weeks;
- the user team itself or a duplicate opponent;
- an opponent already playing that week;
- same-conference opponents;
- teams without remaining non-conference capacity;
- choices that make the remaining league schedule infeasible.

Accepted rivalry matchups use their configured name, site, and host rotation.
Other selected opponents are scheduled at the user's home field.

## Season Initialization

The explicit **Start Season** action calls `initializeSeason()`. It validates
the persisted `preseason` stage and year, then delegates to
`initializeSeasonSchedule()`.

`buildFullScheduleFromExisting()` treats preseason games and accepted
rivalries as fixed constraints, fills every team's 12-game schedule across 14
regular-season weeks, and assigns home and away teams. Custom alignments must
produce a complete schedule. The resulting `GameRecord`s, nested-detail reset,
and league state commit together; the command sets `scheduleBuilt` and
`simInitialized` and enters `season`.

Page loaders never initialize a season. `advanceWeeks()` retains a guarded
initialization path for callers that reach it without initialized simulation
data, but normal navigation uses the explicit command.

## Week Advancement

For each week before the requested destination, `advanceWeeks()`:

1. loads current-year games and simulates only unplayed games;
2. creates one nested `GameDetailRecord` per completed game;
3. updates team records and publishes fact-grounded game stories;
4. recalculates rankings;
5. refreshes rank and watchability snapshots on future games;
6. commits league, game, detail, and news records;
7. invokes `handleSpecialWeeks()` to create eligible postseason games;
8. increments the current week.

The ordering matters: postseason selection sees the latest records and
rankings, and future game cards display the latest ranking snapshots.

## Postseason Hooks

`handleSpecialWeeks()` uses the configured playoff size and postseason week
constants to create conference championships, bowls, and subsequent rounds:

- 2 teams: conference championships, bowls, national championship;
- 4 teams: conference championships, semifinals, bowls, championship;
- 12 teams: conference championships, first round, quarterfinals, semifinals,
  bowls, championship.

Round creation is idempotent and requires the preceding winners. Catch-up
checks create a missing eligible round when advancement has moved beyond its
normal creation week.

Conference championship creation is a single league-wide freeze point. It
does nothing until every current-year regular-season game through Week 14 is
complete and the Week 14 poll has been finalized. Before allocating a game ID,
it validates that every non-independent conference has at least two members.
It then atomically freezes every conference's ordered standings and creates
exactly one neutral-site Week 15 championship between positions 1 and 2. A
two-team conference deliberately receives a rematch. Participants never
change after creation, and a mathematically clinched berth never causes an
early persisted game.

## Invariants

- Every regular-season team receives 12 games across 14 weeks.
- Fixed preseason games and accepted rivalry constraints survive full schedule
  construction.
- A team cannot have duplicate opponents or two games in one week.
- Current-year filters prevent games from another season entering progression.
- Game IDs come from the league counter and remain unique.
- Completed games are never simulated twice.
- Postseason creators use persisted IDs to prevent duplicate rounds.
- Every non-independent conference has at least two members and receives one
  Week 15 championship; Independents receive none.
- A conference championship ID and its final-standings snapshot are both null
  before the freeze and both present afterward.
- The season enters `summary` only after the national championship and every
  other current-year game resolve.

## Source Map

- `src/domain/league/commands/preseasonScheduling.ts`
- `src/domain/league/commands/preseasonScheduleRemoval.ts`
- `src/domain/league/commands/scheduleNonConGame.ts`
- `src/domain/league/loaders/season/listAvailableOpponents.ts`
- `src/domain/league/seasonReset.ts`
- `src/domain/league/commands/season.ts`
- `src/domain/league/seasonInitialization.ts`
- `src/domain/schedule/preseasonCandidates.ts`
- `src/domain/schedule/feasibility.ts`
- `src/domain/schedule/planner.ts`
- `src/domain/schedule/projection.ts`
- `src/domain/rivalryScheduling.ts`
- `src/domain/sim/orchestrator.ts`
- `src/domain/sim/postseason.ts`
- `src/domain/sim/rankings.ts`
