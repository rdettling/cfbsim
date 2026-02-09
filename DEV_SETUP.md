# DEV_SETUP.md

## Prereqs

- Python 3.13 (managed by `.python-version`)
- Node.js 18+
- `uv`

## Backend Setup

1. `uv sync`
2. `uv run python backend/manage.py migrate`
3. `uv run python backend/manage.py runserver`

Optional:
1. `uv run python backend/manage.py createsuperuser`

## Environment Variables

Loaded from `.env` at the repo root by `backend/cfbsim/settings.py`.
- `DJANGO_ENV` (default: `development`)
- `DJANGO_ALLOWED_HOSTS` (space-separated)
- `SECRET_KEY` (auto-generated for dev if missing)
- `HEROKU_POSTGRESQL_CYAN_URL` (production DB)
- `SSL_REQUIRE` (DB SSL)

## Frontend Setup

1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Data Requirements

The backend expects data in `backend/data/`:
- `teams.json`
- `conferences.json`
- `ratings/*.json`
- `years/*.json`

## Useful Scripts

- `uv run python backend/scripts/generate_betting_odds.py`
Writes `backend/data/betting_odds.json` used during season setup.
