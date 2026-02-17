# DEV_SETUP.md

## Prereqs

- Node.js 18+

## Frontend2 Setup (Active App)

1. `cd` to the repo root
2. `npm install`
3. `npm run dev`
4. Optional: `npm run typecheck`

## Data Requirements (Frontend2)

The active frontend loads data from `public/data/` (cached to IndexedDB on first run):
- `teams.json`
- `conferences.json`
- `years/index.json` and `years/*.json`
- `rivalries.json`
- `ratings/index.json` and `ratings/*.json`
- `history.json` (generated)
- `betting_odds.json` (generated)
- `prestige_config.json`
