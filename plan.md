# Frontend2 Migration Context (2026-02-15)

## Goal
Rebuild frontend from scratch in `frontend2/` with clean architecture:
- No backend API calls.
- IndexedDB-first persistence.
- UI copied page-by-page from old `frontend/` and then adapted.
- Start with Home + Non-Con + Dashboard flow; expand iteratively.

## Current State (Implemented)
- `frontend2/` is a minimal Vite React TS app (hand-rolled, no `npm create`).
- Pages implemented: `Home`, `Noncon`, `Dashboard`.
- Domain/data architecture:
  - `src/db/`: IndexedDB + base data caching
  - `src/domain/`: domain logic + types + hooks
  - `src/pages/`: UI screens
  - `src/components/`: shared UI copied from old app (Navbar + banners + live sim UI etc.)
  - `src/constants/`: routes + stages

### Core Flow
1. Home loads base data from `frontend2/public/data` (years, teams, conferences) via IndexedDB caching.
2. Clicking Start Game creates a new league in IndexedDB.
3. Rivalry games are placed for the user team before Non-Con page (using `rivalries.json`).
4. Non-Con page lets you schedule non-conference games (now implemented).
5. Dashboard builds the rest of the schedule on first load (simple filler for now) and flips stage to `season`.

## Key Files
### Domain
- `frontend2/src/domain/league.ts`
  - Public API used by pages: `loadHomeData`, `startNewLeague`, `loadNonCon`, `loadDashboard`, `listAvailableTeams`, `scheduleNonConGame`, `getTeamInfo`.
- `frontend2/src/domain/baseData.ts`
  - Builds preview data; builds teams/conferences from base JSON.
- `frontend2/src/domain/schedule.ts`
  - `buildSchedule`, `applyRivalriesToSchedule`, `fillUserSchedule`, `listAvailableTeams`, `scheduleNonConGame`.
- `frontend2/src/domain/types.ts` (minimal domain types used by pages/components).
- `frontend2/src/domain/hooks.ts` (`useDomainData`).

### Data (IndexedDB)
- `frontend2/src/db/db.ts` (IDB setup)
- `frontend2/src/db/baseData.ts` (cache base JSON in IDB; `getRivalriesData` added)
- `frontend2/src/db/leagueRepo.ts` (save/load league blob)

### Pages
- `frontend2/src/pages/Home.tsx`
  - Uses `loadHomeData`.
- `frontend2/src/pages/Noncon.tsx`
  - Uses `startNewLeague`, `loadNonCon`, `listAvailableTeams`, `scheduleNonConGame`.
- `frontend2/src/pages/Dashboard.tsx`
  - Copied from old app, refactored to use `loadDashboard`.

### Components (copied from old app)
- `Navbar.tsx`, `SeasonBanner.tsx`, `NonSeasonBanner.tsx`, `GameSelectionModal.tsx`, `LiveSimModal.tsx`, `LoadingDialog.tsx`
- `DriveSummary.tsx`, `FootballField.tsx`, `GameHeader.tsx`, `GameControls.tsx`
- `TeamComponents.tsx`, `PageLayout.tsx`

Notes:
- Navbar is the full old UI; backend calls removed or stubbed.
- LiveSim and Season sim actions are stubbed (no backend).
- `PageLayout` expects `navbarData` with `team`, `info`, `conferences`, `currentStage`.

## Public Data (copied into frontend2/public/data)
- `teams.json`, `conferences.json`, `years/*.json`, `years/index.json`, `rivalries.json`.
- (Other base files can be added later as needed.)

## How to Run
```
cd frontend2
npm install
npm run dev
```

## Known Simplifications
- All teams are 90 overall (rating/offense/defense).
- Schedule filling on Dashboard is minimal (non-conference only, no full backend scheduling).
- Rivalries only placed for user team (not all teams).
- No real sim, no stats, no backend endpoints.

## Next Steps (Suggested)
1. Expand schedule generation to match backend `fillSchedules` (conference games, home/away balancing, etc.).
2. Implement remaining pages one-by-one by copying UI and wiring to domain functions.
3. Decide whether to store schedule per-team or full league schedule.
4. Expand domain types to match eventual IDB schema (1:1).

## Important Preferences / Constraints
- Always copy old UI file first, then adapt for new architecture.
- Keep code clean, minimal, and modular.
- No backend calls; use IDB.
- Navbar should look identical to old app, even if actions are stubbed.
