# ARCHITECTURE.md

## Overview

The active architecture is a standalone Vite + React app under `frontend2/`. It runs the simulation entirely in the browser and persists state to IndexedDB. The legacy full‑stack app (Django API + old frontend) is preserved under `legacy/`.

## Frontend2 (Active)

Key modules:
- `frontend2/src/domain/` simulation logic, scheduling, rosters
- `frontend2/src/db/` IndexedDB schema + repositories
- `frontend2/src/pages/` UI screens
- `frontend2/src/components/` shared UI components
- `frontend2/public/data/` base JSON inputs

High-level flow:
1. Base data is loaded from `frontend2/public/data/` and cached in IndexedDB.
2. A new league is created in IndexedDB on start.
3. Schedules, games, plays, drives, game logs, and rosters are generated client‑side.
4. Pages load from domain functions and read/write IndexedDB.

## Domain Layout (Frontend2)

- `domain/league/` league lifecycle, rankings, postseason, offseason, awards
- `domain/league/loaders/` page data loaders (return plain JSON)
- `domain/league/utils/` shared helpers for league logic
- `domain/sim/` play-by-play engine + sim orchestration
- `domain/` (root) shared utilities (roster, schedule, odds)

## Legacy Backend (Optional)

Key modules:
- `legacy/backend/cfbsim/` project config, settings, URLs
- `legacy/backend/api/` API endpoints, serializers, view logic
- `legacy/backend/logic/` simulation engine, scheduling, progression
- `legacy/backend/logic/sim/` game simulation core
- `legacy/backend/recruit/` legacy Django app (kept for compatibility)
- `legacy/backend/data/` static data inputs

High-level flow:
1. API endpoints in `backend/api/` call into `backend/logic/`.
2. Simulation state is persisted via Django models in `backend/api/models.py`.
3. Frontend consumes API responses to render views.

## Season Lifecycle (Frontend2)

Core steps (see `frontend2/src/domain/sim/` and `frontend2/src/domain/league/`):
1. Initialize league state from base data.
2. Generate schedules and initialize sim records in IndexedDB.
3. Advance weeks, sim games, update rankings and records.
4. Persist games, drives, plays, and game logs in IndexedDB.

## Simulation Engine (Frontend2)

Gameplay is simulated at the drive/play level in `frontend2/src/domain/sim/`:
- Runs and passes are generated from rating-based distributions.
- 4th-down logic decides punt/FG/go-for-it.
- Overtime simulates alternating possessions.
- Plays and drives are optionally persisted for game logs.

## Scheduling (Frontend2)

`frontend2/src/domain/schedule.ts` builds:
- Regular season schedules and rivalry games.
- Week assignment and home/away balancing.

## Rosters (Frontend2)

`frontend2/src/domain/roster.ts` handles:
- Recruiting cycles and class assignment.
- Yearly progression and roster cuts.
- Team rating calculations from player ratings.

## Rankings, Stats, Awards (Frontend2)

Rankings, stats, and awards are updated during sim and persisted in IndexedDB.

## Data

Frontend2 relies on JSON files under `frontend2/public/data/` for teams, conferences, years, ratings, and generated history/odds.

## Docs Map

- `README.md` for high-level overview and pointers
- `DEV_SETUP.md` for setup and run commands
- `AGENTS.md` for Codex/agent context

## AI Contribution Guardrails

- Put new logic in the correct folder (domain, loaders, utils) before creating a new file.
- Reuse existing helpers; only create a new helper if it’s used in 2+ places.
- Keep types centralized under `src/types`.
- After structural changes, run `npm run typecheck`.
