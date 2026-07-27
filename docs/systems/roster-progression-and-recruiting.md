# Roster Progression and Recruiting

## Scope

Explains how player pools are created, progressed, cut, and replenished across seasons, and how those roster changes feed team rating/ranking recalculation.

## System Model

Roster lifecycle is cyclical:

1. **Initialize baseline roster populations** by team/position.
2. **Set starters** from active players.
3. **Run season** with current roster.
4. **Progress classes** (`fr->so->jr->sr`, seniors exit).
5. **Recruit new freshmen** to refill team needs.
6. **Apply roster cuts** to enforce position caps.
7. **Recompute team offense/defense/overall ratings** and ranking order.

This cycle is executed both at initial league creation (multi-class bootstrap) and in each offseason progression pass.

## Execution Flow

1. **Roster presence guard**
- `ensureRosters(league)` checks whether current schema-valid players exist.
- If not, it clears players and runs `initializeRosters(league)`.

2. **Initial roster creation (`initializeRosters`)**
- Builds class targets from `ROSTER` positional totals.
- Executes recruiting cycle repeatedly to synthesize multi-year class stacks.
- Applies cuts, sets starters, computes team ratings, assigns team rankings.
- Persists `players` store.

3. **Offseason progression path**
- `projectPlayerProgression(player)` returns the typed progression outcome
  without mutation: inactive players are omitted, seniors depart, and
  returning classes receive their next class and existing year-specific
  rating.
- `loadRosterProgression()` uses that projection to present the user team's
  upcoming changes without applying them.
- `applyProgression(players)` consumes the same projection when the shell
  advances from `progression`, updating returning players and marking seniors
  inactive.

4. **Recruiting intake**
- `runRecruitingCycle(league, teams, players)` loads names/states distributions and generates recruit pool.
- Assignment process matches recruits to team positional needs and team context.
- Assigned recruits are converted to `PlayerRecord` freshmen using league player ID counter.
- `buildRecruitingResults(teams, players, userTeamId)` derives complete,
  deterministic team and player rankings from the persisted active freshmen
  without mutating them.
- `loadRecruitingSummary()` exposes those finalized results only during
  `recruiting_summary`.

5. **Roster enforcement + team recalculation**
- `selectTeamRosterCuts` deterministically identifies surplus players for one
  team.
- `buildRosterCutsPreview` shapes the user-team preview from that selection;
  `loadRosterCuts` exposes it without mutation.
- `applyRosterCuts` consumes the same selector for every team.
- `setStarters` chooses top rated active players per position starter count.
- `recalculateTeamRatings` recomputes team offense/defense/overall and resets rank ordering by rating.

```mermaid
flowchart TD
  A["ensureRosters()"] --> B{"Roster exists + schema valid?"}
  B -- yes --> C["Use existing players"]
  B -- no --> D["clearPlayers() + initializeRosters()"]
  D --> E["recruitingCycle() to build classes"]
  E --> F["applyRosterCuts()"]
  F --> G["setStarters()"]
  G --> H["recalculateTeamRatings()"]
  H --> I["savePlayers()"]
  C --> J["Offseason: applyProgression()"]
  J --> K["runRecruitingCycle()"]
  K --> L["applyRosterCuts() + setStarters() + recalculateTeamRatings()"]
```

## Key Mechanics

- **Position structure source of truth**: `rosterConfig.ts` defines
  `ROSTER` starter counts/total caps and `POSITION_ORDER`.
- **Player quality generation**:
  - Star-based rating priors (`STARS_BASE`, `STAR_STD_DEV`).
  - Gaussian noise and development trait shape year-by-year rating curve.
- **Recruit assignment model**:
  - Team need is derived from active roster deficits vs position totals.
  - Recruit pool contains position/star/state distribution; assignment uses weighted matching with prestige/randomness effects.
- **Cut ordering**:
  - Retention prioritizes long-term ceiling (`rating_sr`), current rating,
    class seniority, then ascending player ID.
- **Team rating model**:
  - Starter-only weighted offense/defense aggregates with per-position weights.
  - Overall rating is weighted blend of offense and defense plus noise.

## Invariants and Constraints

- `player.id` allocation must be monotonic via league player counter.
- Inactive players are excluded from starter selection and roster counts.
- Position totals are enforced after recruiting/progression through mandatory cut pass.
- Team ranking after recalculation is rating-sorted and rewritten for all teams.

## Failure/Edge Cases

- Missing states dataset falls back to a synthetic `Unknown` state weight.
- Missing name pools fall back to generic fallback names per generator logic.
- If a team has fewer players than starter requirements at a position, starter assignment fills as many as available.
- Preview and application consume the same `selectTeamRosterCuts` result.

## What You Can Observe in the App

- Roster Progression shows projected class/rating changes and senior
  departures; opening or reloading it does not apply those changes.
- Advancing from Roster Progression applies the previewed progression and then
  generates recruits atomically before Recruiting Summary opens.
- Recruiting Summary shows the resulting freshmen classes that reflect team
  need and quality profile. Its team and player rankings are complete rather
  than display-limited, and reloading the page does not regenerate recruits.
- Roster Cuts shows automatic changes before they are applied. Advancing cuts
  every team, reassigns starters, recalculates ratings, resets the season, and
  enters Preseason.
- Team rank/rating shifts after offseason are often driven by starter turnover and recruiting replacement quality.

## Source Map (file/function references)

- `src/domain/roster.ts`
  - progression decision: `projectPlayerProgression`
  - lifecycle: `ensureRosters`, `initializeRosters`, `applyProgression`, `runRecruitingCycle`, `setStarters`, `recalculateTeamRatings`
  - core recruiting and rating constants
- `src/domain/rosterConfig.ts`
  - position order, roster caps, and starter counts
- `src/domain/rosterCuts.ts`
  - `selectTeamRosterCuts`, `buildRosterCutsPreview`, and `applyRosterCuts`
- `src/domain/league/stages.ts`
  - stage integration: `advanceOffseasonStage`
- `src/domain/league/loaders/loadRosterProgression.ts`
  - progression preview integration
- `src/domain/league/recruitingResults.ts`
  - finalized recruiting result shaping and ranking
- `src/domain/league/loaders/loadRecruitingSummary.ts`
  - finalized recruiting summary integration
- `src/domain/league/loaders/loadRosterCuts.ts`
  - typed user-team roster-cuts preview integration
- `src/db/simRepo.ts`
  - player persistence: `getAllPlayers`, `savePlayers`, `getPlayersByTeam`, `clearPlayers`
