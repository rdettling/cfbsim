# Live Interactive Sim Plan

## Goal
Add an interactive live sim mode for the user’s game only. All other games remain batch-sim. During the user’s offensive snaps, the sim pauses and prompts for play choice.

## User Requirements
- Interactive only for the user’s team game.
- Pause after every **user offensive snap**.
- Choices on user offense:
  - `Run`
  - `Pass`
  - On 4th down also allow: `Punt` and `Field Goal`
  - `Sim Drive` (auto-sim the rest of the current user drive)
- Defense is always auto-simmed (no prompts).
- Live sim still progresses through every play; the user only chooses run/pass/punt/FG when on offense.

## Proposed Architecture Changes
1. **Engine: step-based drive simulation**
   - Add functions in `src/domain/sim/engine.ts`:
     - `startInteractiveDrive(...)` → initialize drive state for manual stepping.
     - `stepInteractiveDrive(...)` → sim a **single play** given a play choice (`run`/`pass`/`punt`/`field_goal`/`auto`).
     - Return: updated drive state, play record, drive completion status, next field position.
   - Reuse existing logic (`simRun`, `simPass`, `decideFourthDown`, `fieldGoal`, `formatPlayText`).
   - Expose `DRIVES_PER_TEAM` and `OT_START_YARD_LINE` if needed by UI/orchestrator.

2. **Orchestrator changes**
   - Add an interactive preparation helper:
     - `prepareInteractiveLiveGame(gameId)` to load league, game, starters, players, etc.
   - Add a finalization helper:
     - `finalizeGameSimulation(...)` to persist drives/plays/logs, update records, headlines, rankings, and save league.
   - Keep `liveSimGame(...)` for non-interactive / already-finished games.

3. **LiveSimModal updates**
   - Pass `isUserGame` from `GameSelectionModal` → `Navbar` → `LiveSimModal`.
   - If **not** user game: keep current playback-only behavior.
   - If **user** game:
     - Create local state for current drive, field position, drive number, overtime.
     - When user offense: show prompt (Run/Pass; on 4th down also Punt/FG; Sim Drive).
     - When user defense: auto-sim full drive via `simDrive`.
     - Append each play to local `plays` and each finished drive to `drives` so playback UI stays intact.
     - Continue until game completion, then call `finalizeGameSimulation`.

4. **GameControls updates**
   - Reuse existing `decisionPrompt` UI, extend to include `punt` / `field_goal` and `sim_drive` where appropriate.

5. **Types & props**
   - Update `LiveSimModalProps` to include `isUserGame`.
   - Ensure `GameSelectionModalGame` uses `is_user_game` consistently.

## Edge Cases
- Overtime must still work; interactive logic should carry into OT.
- Turnovers, safeties, touchdowns should end drives and swap possession normally.
- If `Sim Drive` is chosen, control should only return when user offense occurs again on a later drive.

## UI Behavior Summary
- User offense: show decision buttons, pause every snap.
- User defense: “Simulating defense…” then auto-advance.
- Non-user games: unchanged (auto sim + playback).

## Cleanup
- Remove any dead code paths after interactive mode is complete.
- Keep sim logic in `engine.ts` authoritative; UI shouldn’t re-implement sim rules.
