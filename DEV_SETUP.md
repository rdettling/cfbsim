# DEV_SETUP.md

## Prereqs

- Node.js 18+

## Frontend2 Setup (Active App)

1. `cd frontend2`
2. `npm install`
3. `npm run dev`
4. Optional: `npm run typecheck`

## Data Requirements (Frontend2)

The active frontend loads data from `frontend2/public/data/` (cached to IndexedDB on first run):
- `teams.json`
- `conferences.json`
- `years/index.json` and `years/*.json`
- `rivalries.json`
- `ratings/index.json` and `ratings/*.json`
- `history.json` (generated)
- `betting_odds.json` (generated)

## Legacy Setup (Optional)

If you want to run the old Django API + legacy frontend, see `legacy/`:

### Legacy Backend

1. `cd legacy`
2. `uv sync`
3. `uv run python backend/manage.py migrate`
4. `uv run python backend/manage.py runserver`

Optional:
1. `uv run python backend/manage.py createsuperuser`

Environment variables are loaded from `legacy/.env` by `legacy/backend/cfbsim/settings.py`.

### Legacy Frontend

1. `cd legacy/frontend`
2. `npm install`
3. `npm run dev`
