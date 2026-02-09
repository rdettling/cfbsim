# AGENTS.md

Single source of truth for working in this repo.

## Quick Commands

Backend:
1. `uv sync`
2. `uv run python backend/manage.py migrate`
3. `uv run python backend/manage.py runserver`

Frontend:
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Repo Map

Backend Django project:
- `backend/cfbsim/` Django settings and URL config
- `backend/api/` REST API app
- `backend/logic/` simulation logic
- `backend/recruit/` legacy Django app (kept for compatibility)
- `backend/data/` static JSON data
- `backend/scripts/` one-off scripts

Frontend React app:
- `frontend/` Vite + React app
- `frontend/src/` pages, components, services

## What This App Does

College football season simulator with an API-backed web UI. Core loop:
1. Initialize year data, teams, conferences, and rosters.
2. Generate schedules, simulate games, track standings and rankings.
3. Advance weeks through regular season, conference championships, and playoffs.
4. Apply offseason progression, recruiting, and realignment between seasons.

## Key Flows (Backend)

- Season lifecycle: `backend/logic/season.py`
  - Initializes history and settings.
  - Refreshes season data and rankings.
  - Applies realignment and playoff format changes between years.
- Scheduling and playoffs: `backend/logic/schedule.py`
  - Builds schedules, rivalries, and playoff brackets (2/4/12 team formats).
- Game simulation: `backend/logic/sim/sim.py`
  - Drive/play simulation, overtime, scoring, and play text generation.
- Rosters and recruiting: `backend/logic/roster_management.py`
  - Recruiting cycles, progression, roster cuts, team rating calculation.
- Stats and awards: `backend/logic/stats.py`, `backend/logic/awards.py`

## API Entry Points

- Routes are defined in `backend/api/urls.py`.
- Views in `backend/api/views/` call into `backend/logic/`.

## Environment

- Python: `.python-version` (3.13)
- Package manager: `uv`
- Lockfile: `uv.lock`
Key env vars (from `backend/cfbsim/settings.py`):
- `DJANGO_ENV` (development/production toggle)
- `DJANGO_ALLOWED_HOSTS`
- `SECRET_KEY`
- `HEROKU_POSTGRESQL_CYAN_URL` (production DB)
- `SSL_REQUIRE` (DB SSL)

## Conventions

- Backend code lives under `backend/`
- Run Python commands with `uv run`
- Keep `uv.lock` in sync with `pyproject.toml`

## Gotchas

- SQLite has a variable limit; large bulk updates should be batched
- Data files in `backend/data/` are required for simulations
