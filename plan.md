# Clock-Based Simulation Plan (Option C)

## Goal
Replace the fixed-drive sim model with a clock-driven model where the game is governed by time (quarters and clock), and drives emerge naturally from possession changes.

## Principles
- Clock is primary; drives are consequences.
- One shared engine for live sim + interactive sim.
- Home/away is the UI view model only; Team A/B remain internal to storage.
- Keep changes incremental and testable.

## Phase 1: Audit & Design
1. **Audit current flow**
   - Identify where `DRIVES_PER_TEAM` and fixed drive loops are used.
   - Map sim entry points:
     - `simGame` (full sim)
     - `startInteractiveDrive` / `stepInteractiveDrive`
     - `useGameSim` orchestration
2. **Define clock model**
   - `quarter: 1-4`, `secondsLeft`, `clockRunning`
   - End-of-quarter / halftime transitions
   - Overtime rules (keep existing OT logic unless explicitly changing)
3. **Define timing rules (initial pass)**
   - Run: 30–40 seconds
   - Completed pass: 20–30 seconds
   - Incomplete pass: 5–10 seconds
   - Special teams (punt/FG): 10–20 seconds
   - Clock stops: incomplete, out of bounds, turnover, score, end of quarter

## Phase 2: Data Model Changes
1. **DB**
   - Add to `PlayRecord`: `quarter`, `clockSecondsLeft`, `playSeconds`
   - Add to `GameRecord`: `quarter`, `clockSecondsLeft` (for in-progress state)
2. **Types**
   - Update `src/types/db.ts`, `src/types/game.ts`, `src/types/sim.ts` to carry clock fields.

## Phase 3: Engine Refactor (Clock-Driven)
1. **Clock utilities**
   - `applyPlayClock(playResult, clockState) -> clockState`
   - `shouldStopClock(playResult) -> boolean`
2. **Drive execution**
   - Replace fixed-drive loop in `simGame` with a `while clock > 0` loop.
   - Drives can span quarters.
3. **Interactive stepping**
   - `stepInteractiveDrive` returns updated clock info.
   - `useGameSim` updates display using clock state.

## Phase 4: UI Updates
1. **Score strip**
   - Display `quarter` and `time` (e.g., `Q2 3:12`)
2. **Drive summary**
   - Optional timestamps per play (later phase).
3. **Controls**
   - No structural changes; time advances on each play/step.

## Phase 5: Edge Cases & Validation
- End of half during drive: decide if drive continues (college rules allow final play if clock hits 0).
- Overtime remains possession-based unless explicitly changed.
- Verify score/possession alignment with home/away UI.

## Deliverables
- Clock-aware sim engine (full + interactive).
- UI showing quarter/time.
- Play/drive records include time metadata.
- Typecheck passing.

## Phase 6: Immersion Enhancements (Planned)
### 6A. Situational Playcalling + Tempo
- Add a simple tempo model (normal/fast/chew) to influence play duration and run/pass mix.
- Use down/distance, score margin, and time remaining to bias play selection.
- Late-half behavior: more hurry-up, higher pass rate, shorter play clock.

### 6B. College Clock Rules (Lightweight)
- Stop clock for first downs until ball is set (except final 2 minutes, optional toggle).
- Stop clock for out-of-bounds plays (especially late).
- Preserve existing stop rules (incomplete, turnover, score, end of quarter).

### 6C. Kickoffs / Returns (Simple Model)
- Add kickoff events that set starting field position:
  - Touchback vs. return split.
  - Return yardage in a small random band (e.g., to ~25–30 average).
- Apply after scores and start of halves.

### Notes
- Keep changes incremental and testable.
- Avoid deep stats refactors; focus on feel and flow.
