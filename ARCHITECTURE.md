# ARCHITECTURE.md

## Overview

The backend is a Django app that serves a REST API and runs a simulation engine. The frontend is a React app that consumes the API.

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
2. Simulation state is persisted via Django models.
3. Frontend consumes API responses to render views.

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
