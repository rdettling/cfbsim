# ARCHITECTURE.md

## Overview

The architecture is a standalone Vite + React app at the repo root. It runs the simulation entirely in the browser and persists state to IndexedDB.

## Frontend2 (Active)

Key modules:
- `src/domain/` simulation logic, scheduling, rosters
- `src/db/` IndexedDB schema + repositories
- `src/pages/` UI screens
- `src/components/` shared UI components
- `public/data/` base JSON inputs

High-level flow:
1. Base data is loaded from `public/data/` and cached in IndexedDB.
2. A new league is created in IndexedDB on start.
3. Schedules, games, plays, drives, game logs, and rosters are generated client‑side.
4. Pages load from domain functions and read/write IndexedDB.

## Domain Layout (Frontend2)

- `domain/league/` league lifecycle, rankings, postseason, offseason, awards
- `domain/league/loaders/` page data loaders (return plain JSON)
- `domain/league/utils/` shared helpers for league logic
- `domain/sim/` play-by-play engine + sim orchestration
- `domain/` (root) shared utilities (roster, schedule, odds)

## Season Lifecycle (Frontend2)

Core steps (see `src/domain/sim/` and `src/domain/league/`):
1. Initialize league state from base data.
2. Generate schedules and initialize sim records in IndexedDB.
3. Advance weeks, sim games, update rankings and records.
4. Persist games, drives, plays, and game logs in IndexedDB.

## Simulation Engine (Frontend2)

Gameplay is simulated at the drive/play level in `src/domain/sim/`:
- Runs and passes are generated from rating-based distributions.
- 4th-down logic decides punt/FG/go-for-it.
- Overtime simulates alternating possessions.
- Plays and drives are optionally persisted for game logs.

## Scheduling (Frontend2)

`src/domain/schedule.ts` builds:
- Regular season schedules and rivalry games.
- Week assignment and home/away balancing.

## Rosters (Frontend2)

`src/domain/roster.ts` handles:
- Recruiting cycles and class assignment.
- Yearly progression and roster cuts.
- Team rating calculations from player ratings.

## Rankings, Stats, Awards (Frontend2)

Rankings, stats, and awards are updated during sim and persisted in IndexedDB.

## Data

The app relies on JSON files under `public/data/` for teams, conferences, years, ratings, and generated history/odds.

## Docs Map

- `README.md` for high-level overview and pointers
- `DEV_SETUP.md` for setup and run commands
- `AGENTS.md` for Codex/agent context

## AI Contribution Guardrails

- Put new logic in the correct folder (domain, loaders, utils) before creating a new file.
- Reuse existing helpers; only create a new helper if it’s used in 2+ places.
- Keep types centralized under `src/types`.
- After structural changes, run `npm run typecheck`.
