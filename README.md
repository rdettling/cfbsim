# CFBSim.net

College football season simulator. The active frontend is a standalone Vite + React app backed by IndexedDB (no backend API). The legacy full‑stack app is preserved under `legacy/`.

## Read This First

- Project setup: `DEV_SETUP.md`
- System design: `ARCHITECTURE.md`
- Codex/agent context: `AGENTS.md`

## What It Does

- Simulates full college football seasons (scheduling, games, rankings, rosters).
- Runs entirely in the browser in the new architecture.
- Legacy Django API remains available under `legacy/` if needed.

## Tech Stack

- Frontend (active): React + Vite + IndexedDB (`frontend2/`)
- Legacy backend: Django + Django REST Framework (`legacy/backend/`)
- Legacy frontend: React + Vite (`legacy/frontend/`)

## License

This project is for personal use only.
