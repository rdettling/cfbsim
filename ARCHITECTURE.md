# ARCHITECTURE.md

## Overview

The backend is a Django app that serves a REST API and runs a simulation engine for a college football season. The frontend is a Vite + React app that consumes the API.

## Backend

Key modules:
- `backend/cfbsim/` project config, settings, URLs
- `backend/api/` API endpoints, serializers, view logic
- `backend/logic/` simulation engine, scheduling, progression
- `backend/logic/sim/` game simulation core
- `backend/recruit/` legacy Django app (kept for compatibility)
- `backend/data/` static data inputs

High-level flow:
1. API endpoints in `backend/api/` call into `backend/logic/`.
2. Simulation state is persisted via Django models in `backend/api/models.py`.
3. Frontend consumes API responses to render views.

## Season Lifecycle (Backend)

Core steps (see `backend/logic/season.py`):
1. Initialize history and settings from `backend/data/`.
2. Reset counters, clear plays/drives, and initialize rankings.
3. Generate schedules and start the season.
4. Advance weeks, sim games, and update rankings.
5. Run conference championships and playoffs.
6. Apply roster progression, recruiting, realignment, and playoff format updates.

## Simulation Engine

Gameplay is simulated at the drive/play level in `backend/logic/sim/sim.py`:
- Runs and passes are generated from rating-based distributions.
- 4th-down logic decides punt/FG/go-for-it.
- Overtime simulates alternating possessions.
- Plays and drives are optionally persisted for game logs.

## Scheduling and Playoffs

`backend/logic/schedule.py` builds:
- Regular season schedules and rivalry games.
- Conference championships.
- Playoff brackets for 2-, 4-, and 12-team formats.

## Rosters, Recruiting, and Progression

`backend/logic/roster_management.py` handles:
- Recruiting cycles and class assignment.
- Yearly progression and roster cuts.
- Team rating calculations from player ratings.

## Rankings, Stats, Awards

- Rankings and prestige updates: `backend/logic/season.py`
- Stats aggregation: `backend/logic/stats.py`
- Awards pipeline: `backend/logic/awards.py`

## Frontend

Key modules:
- `frontend/src/pages/` page-level screens
- `frontend/src/components/` shared UI components
- `frontend/src/services/api.ts` API client

Tooling:
- Vite + React

## Data

Simulation relies on JSON files under `backend/data/` for teams, conferences, and ratings. These must exist for season initialization.

## API Surface (Backend)

Main endpoints live under `backend/api/urls.py`. Examples:
- `GET /api/home/`
- `GET /api/dashboard/`
- `GET /api/standings/:conference/`
- `GET /api/playoff/`
- `GET /api/game/:id/`
- `GET /api/summary/`

## Docs Map

- `README.md` for high-level overview and pointers
- `DEV_SETUP.md` for setup and run commands
- `AGENTS.md` for Codex/agent context
