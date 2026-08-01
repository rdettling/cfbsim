# CFB Sim

CFB Sim is a browser-based college football dynasty simulator where you run a program across repeated seasons.

## Documentation

All docs are under [`docs/`](docs/README.md).

## Development

Use Node 24 LTS, as recorded in `.nvmrc` and `package.json`.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Before committing a change, run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

## What The App Does

- Simulates games and full weeks
- Advances leagues through a full seasonal lifecycle
- Tracks rosters, players, stats, rankings, standings, playoff, and awards
- Runs offseason systems including realignment, progression, recruiting, and cuts
- Persists league state in browser storage
