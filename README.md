# Frontend – Page Pattern

## Goals
- No backend endpoints.
- IndexedDB-first persistence.
- Pages are thin; domain layer owns logic.

## Architecture
- `src/db/`: IndexedDB + base data caching
- `src/domain/`: business logic, domain types, and hooks
- `src/pages/`: UI screens
- `src/components/`: shared UI pieces
- `src/constants/`: shared constants (routes, stages)

### Shared UI Patterns
- Team identity is centralized in `src/components/team/TeamHeader.tsx` and reused across schedule/roster/history pages.
- Top navigation is centralized in `src/components/layout/Navbar.tsx` with a consistent three-zone layout (team identity, primary nav, context/actions).

## Page Pattern
1. Fetch domain data with `useDomainData`.
2. Keep page state local (UI-only state).
3. Call domain functions for mutations.

### Example
```tsx
const { data, loading, error } = useDomainData({
  fetcher: () => loadHomeData(),
});

return (
  <PageLayout loading={loading} error={error}>
    {/* render UI */}
  </PageLayout>
);
```

## Domain Functions
- `loadHomeData()`
- `startNewLeague(team, year)`
- `loadNonCon()`
- `getTeamInfo(teamName)`

Add new pages by first copying the old page UI, then replacing any API calls
with domain functions.

## Live Game Sim (UI)
- Unified sim modal: `GameSimModal`
- Unified sim hook: `useGameSim`
- UI is home/away first (Team A/B are internal only)
- Live/interactive behave the same; user offense enables decision buttons
