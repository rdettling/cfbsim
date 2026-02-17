# Simulation Overview

This document explains how the in‑browser simulation works end‑to‑end, focusing on the clock‑driven game engine, interactive/live sim, and the data it produces.

## Architecture and Flow

The app is a standalone Vite + React client. There is no backend; everything runs in the browser and persists to IndexedDB. The sim flow follows this pattern:

1. **Base data load**: JSON from `public/data/` is cached to IndexedDB.
2. **League init**: A league is created in IndexedDB with teams, settings, and counters.
3. **Game records**: `GameRecord` entries are created for the schedule.
4. **Sim execution**:
   - Full sim: batch‑simulates unplayed games in a week.
   - Live/interactive sim: simulates one game with play‑by‑play pacing.
5. **Persistence**: game, drive, play, and player logs are written to IndexedDB.

Core sim logic lives in `src/domain/sim/engine.ts`.

## Data Model (Sim‑Relevant)

### GameRecord (IndexedDB)
Stores the persisted state for a game (teams, scores, overtime, and clock metadata):
- `quarter`, `clockSecondsLeft`: clock state at save time
- `scoreA`, `scoreB`, `winnerId`, `resultA`, `resultB`, `overtime`

### DriveRecord
Represents a drive and its outcome:
- `offenseId`, `defenseId`, `startingFP`, `result`, `points`
- `scoreAAfter`, `scoreBAfter`

### PlayRecord
Represents a single play:
- `down`, `yardsLeft`, `startingFP`, `playType`, `yardsGained`, `result`
- `quarter`, `clockSecondsLeft`, `playSeconds`

### SimGame (In‑Memory)
In‑memory state used by the engine:
- Teams, odds, records, scores
- `quarter`, `clockSecondsLeft`, `clockRunning`

## Engine Entry Points

### Full Sim (batch)
- `simGame(league, game, starters)`
  - Resets scores and clock.
  - Runs a clock‑driven while‑loop until regulation ends.
  - If tied, runs possession‑based overtime.
  - Returns a list of simulated drives with plays.

### Interactive (live)
- `startInteractiveDrive(...)`
  - Creates a new `DriveRecord` with `points_needed` based on time/score.
- `stepInteractiveDrive(...)`
  - Executes one play and returns:
    - updated drive state
    - play record
    - whether the drive is complete
    - next field position
    - whether the game ended

The React hook `useGameSim` orchestrates interactive flow and writes results to IndexedDB once the game is complete.

## Clock Model

The sim is clock‑driven. Drives are outcomes of possession changes rather than fixed counts.

### Clock State
- `quarter`: 1–4
- `secondsLeft`: seconds remaining in the quarter
- `clockRunning`: whether the clock would run between snaps

### Play Duration
Each play consumes time based on type and tempo:
- Run: ~30–40s (scaled by tempo)
- Completed pass: ~20–30s
- Incomplete pass: ~5–10s
- Punt/Field goal: ~10–20s

Tempo modifiers:
- `fast`: ~0.7x time
- `chew`: ~1.2x time
- `normal`: 1x time

### Clock Stops (College Rules)
Clock stops on:
- Incomplete pass
- Turnovers
- Scores
- End of quarter
- 1st down **except** in the final 2 minutes of each half
- Out of bounds in final 2 minutes of 1st half, final 5 minutes of 2nd half

### Halftime and End of Game
- When Q2 ends, the next drive starts at the kickoff spot with possession flipped.
- When Q4 ends:
  - If tied, start overtime (possession‑based).
  - If not tied, game ends.

## Possession, Drives, and Kickoffs

### Opening Possession
Opening offense is determined by `isTeamAOpeningOffense(game)`.

### Kickoffs
Kickoffs are modeled as a starting field position:
- Touchback (~65%) -> 25
- Return -> random 15–35

Kickoffs occur:
- Start of game
- Start of second half
- After scores

### Drive End Conditions
A drive ends on:
- Touchdown / FG / safety
- Punt
- Turnover (interception, fumble, turnover on downs)
- End of half or end of game

Each drive produces a `DriveRecord` and a list of `PlayRecord`s.

## Play Selection and Outcomes

### Play Selection
Play choice is biased by:
- Down and distance
- Tempo
- Score + time (late‑game behavior)

Example biases:
- 3rd and long -> more pass
- Late and trailing -> more pass / faster tempo
- Late and leading -> more run / chew tempo

### Play Outcomes
Each play uses probabilistic outcomes based on team ratings:
- `simPass` / `simRun` use rating advantage and Gaussian yard distributions.
- Sacks, interceptions, and fumbles are modeled with base rates adjusted by advantage.
- Touchdowns occur when yardage reaches the goal line.

## Overtime
Overtime remains possession‑based:
- Alternating possessions
- Start at `OT_START_YARD_LINE`
- Continue until a winner emerges

Clock is not advanced in overtime (possession‑based rules).

## Persistence and UI

### Persistence
- Drives and plays are saved via `saveDrives` and `savePlays`.
- Game logs are created from plays and saved via `saveGameLogs`.
- GameRecord is updated with final scores, overtime, and headline metadata.

### UI Consumption
- `useGameSim` exposes current play, drive, clock, and score.
- `GameScoreStrip` displays `Qx mm:ss` or `OT` based on sim clock state.
- `DriveSummary` groups plays by drive.

## Notable Constraints

- IndexedDB is the source of truth.
- Home/away is a UI view model only; Team A/B remains internal to storage.
- The sim is intentionally lightweight and deterministic only by random seed.

## Key Files

- `src/domain/sim/engine.ts` — core engine + clock logic
- `src/domain/sim/orchestrator.ts` — sim lifecycle and persistence
- `src/components/sim/useGameSim.ts` — live sim orchestration
- `src/components/game/GameScoreStrip.tsx` — clock/score display
- `src/types/db.ts` / `src/types/sim.ts` — data types
