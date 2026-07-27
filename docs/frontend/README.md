# Frontend Principles and Patterns

## Purpose

This document is the living frontend standard for CFB Sim. Use it when adding
or changing a page so the application remains visually consistent and the code
remains lean, explicit, and easy for an LLM or human contributor to navigate.

## Core Principles

### Clean, Simple, and Utilitarian

- Prioritize information hierarchy, scanability, and predictable interaction.
- Keep surfaces neutral and reserve emphasis for information or actions that
  need it.
- Prefer compact, structured layouts over decorative cards and empty space.
- Use borders and surface contrast instead of ornamental shadows.
- Give each page one clear title and one focused action or filter area when
  needed.
- Show the information required to make a decision without adding decorative
  explanation.

### Lean and LLM-Friendly

- Keep data flow direct: route page -> loader or command -> local presentation.
- Prefer small components with one clear responsibility and explicit props.
- Keep route-specific components beside their page.
- Promote code to a shared component or helper only after repeated use proves
  a stable contract.
- Use direct imports; do not add barrel files.
- Prefer descriptive names such as `ScheduleResultBadge` over generic names
  such as `StyledBadge`.
- Avoid `any`, hidden side effects, speculative abstractions, and framework
  layers that obscure where behavior lives.
- Treat roughly 250 lines as a soft file-size signal. Split only at a real
  responsibility boundary.

### Preserve Domain Behavior

- IndexedDB is authoritative.
- Frontend work must preserve calculations, supported years, playoff behavior,
  stage routes, lifecycle transitions, and persistence semantics unless a
  feature explicitly changes them.
- Pages may shape loader results into display records, but shared presentation
  components must not read IndexedDB or invoke domain commands.
- Keep simulation tuning and calculation audits separate from presentation
  work unless they are part of the feature.

## Current Stack

- Node 24 LTS
- React 19
- React Router 7 with `BrowserRouter`
- MUI 9 with Emotion
- Vite 8
- TypeScript 7

Direct dependencies are pinned exactly, and `package-lock.json` is the
reproducible install contract. Dependency maintenance is documented in
`docs/operations/validation-and-test-strategy.md`.

## Ownership and Data Flow

- Route pages own loading, navigation, command execution, and page-level state.
- Loaders under `src/domain/league/loaders/` return typed, presentation-ready
  contracts.
- Domain commands own calculations and persistence changes.
- Shared layout and UI components receive data and callbacks through props.
- Page-specific display types stay beside the page. Shared domain records live
  under `src/types/`.
- Loading, error, empty, disabled, progress, and success states are explicit.
- Retriable failures retain the user’s attempted input when practical.
- Stale async requests must not replace newer page state.

## Visual Foundation

| Role | Value |
|---|---|
| Primary accent | `#285f7f` |
| Application background | `#f4f6f8` |
| Paper | `#ffffff` |
| Primary text | `#17212b` |
| Secondary text and palette | `#5c6975` |
| Divider | `#d8dee4` |
| Success | `#2f6f4e` |
| Error | `#a33a3a` |
| Warning | `#8a5a18` |
| Base radius | `8px` |

- Use IBM Plex Sans throughout the application.
- Reserve team colors for identity accents such as borders, logos, badges, or
  selection indicators. Do not use them as large page surfaces.
- Put repeated colors, typography, radii, component states, and density rules
  in the theme or a proven shared component.
- Use MUI `sx` for one-off layout. Do not introduce unexplained raw colors in
  page components.

## Layout and Responsive Behavior

- At `lg` and above, league-management pages fit within the viewport. The
  document must not scroll vertically.
- Long desktop content scrolls inside the table, panel, column, or tab region
  that owns it.
- Home and other intentionally document-based onboarding flows may scroll when
  their structure requires it.
- Below `lg`, adapt the information hierarchy instead of shrinking the desktop
  layout.
- Use compact structured rows when a desktop table would overflow.
- Use tabs or local steps when only one dense context can remain usable on a
  narrow screen.
- Avoid unintended horizontal overflow at every breakpoint.
- Keep controls associated with scrolling content visible when the workflow
  depends on them.

Inspect affected routes at approximately:

- 1440×900
- 1280×720
- 768×1024
- 390×844

## Established UI Patterns

| Need | Preferred Pattern |
|---|---|
| Application navigation | Sticky two-tier shell at `lg`; compact context bar and drawer below `lg` |
| Full-width comparable data | Shared neutral `DataTable` with a sticky header and intentional scroll owner |
| Narrow comparable data | Page-specific compact rows that preserve the important desktop fields |
| Team identity and switching | Shared compact `TeamHeader` |
| Matchup identity | Shared responsive team, ranking, venue, score, and status presentation |
| Dense desktop detail | Stable identity or summary region plus internally scrolling detail panels |
| Dense narrow detail | Tabs that expose one complete context at a time |
| Route selection | Route-driven conference, week, team, and season state when addressability matters |
| Mobile metric browsing | Metric selector with one focused leaderboard or expanded row |
| Mobile roster browsing | Position-grouped sections |
| Onboarding | Side-by-side desktop workspace; explicit local steps below `lg` |
| Offseason actions | Stage-gated loader contract, guarded command, and authoritative route recovery |

Use tables when cross-row and cross-column comparison is primary and sufficient
width exists. Use compact rows for narrow layouts and constrained dashboard
panels. Use cards only for genuinely self-contained objects.

## Accessibility and Interaction

- Tabs, steps, buttons, menus, links, dialogs, and expandable controls must be
  keyboard operable.
- Label controls by purpose rather than relying on surrounding text.
- Move focus intentionally after step changes and recoverable errors.
- Use live announcements for meaningful loading progress and action failures.
- Preserve focus return when dialogs and menus close.
- Do not use disabled styling as the only explanation for an unavailable
  action.
- Use client-side routing for application navigation.

## Suggested File Shape

Keep the structure proportional to the page:

```text
src/pages/
├── RoutePage.tsx
└── route-page/
    ├── RouteDesktopView.tsx
    ├── RouteMobileView.tsx
    ├── config.ts
    └── types.ts
```

Not every page needs separate desktop and mobile views, configuration, or local
types. Add only files that give a responsibility an obvious home. Do not add a
generic form, wizard, state-management, or component framework for a single
workflow.

## Completion Checklist

- The route page has clear loading, failure, empty, and populated states.
- Data and command boundaries are typed and preserve domain behavior.
- Desktop content has one intentional scroll owner.
- Tablet and mobile layouts preserve important information without horizontal
  overflow.
- Keyboard behavior, focus movement, labels, and announcements are correct.
- Repeated visual decisions use the theme or an established shared component.
- Page-specific logic remains local and shared abstractions have demonstrated
  reuse.
- Relevant lifecycle, persistence, and reload behavior has been exercised.
- The following commands pass:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

## Related References

- `docs/architecture/system-overview.md`
- `docs/architecture/data-model-and-persistence.md`
- `docs/architecture/season-state-machine.md`
- `docs/interfaces/loaders-and-page-contracts.md`
- `docs/interfaces/ui-sim-integration.md`
- `docs/operations/validation-and-test-strategy.md`
