# Frontend Overhaul

## Purpose

This document is the source of truth for the incremental CFB Sim frontend
overhaul. Update it as migration work lands so a future contributor can
understand the target, current status, and next step without relying on prior
conversation history.

## Project North Star

- **Clean, simple, and utilitarian:** CFB Sim should feel like a focused
  sports-management application. Prioritize information hierarchy, scanability,
  and predictable interaction over decorative styling.
- **No page scrolling on desktop:** At the `lg` desktop breakpoint and above,
  each migrated league page must fit inside the viewport. When content does not
  fit, the panel that owns the content must scroll internally; the document
  itself must not scroll vertically.
- **Lean, LLM-friendly code:** Keep the frontend explicit, local, and easy to
  trace. Prefer small components with clear responsibilities, direct imports,
  colocated prop types, and proven abstractions over extra layers or speculative
  reuse.

## Migration Strategy

The current migration phase is structural. Its primary goals are:

- explicit loader and display contracts;
- clear boundaries between domain loading, page state, configuration, and
  presentation;
- predictable responsive behavior, accessibility, and explicit page states;
- preserved simulation calculations, lifecycle behavior, and IndexedDB
  persistence.

Migrated pages should become cleaner and more consistent, but they do not need
to reach their final visual design during this phase. Complete the structural
migration before a cohesive application-wide visual-polish pass. Do not mix
calculation audits or simulation tuning into a frontend milestone unless the
milestone explicitly includes domain validation.

The offseason overhaul and Home/new-league migration are complete. The
offseason lifecycle uses one typed stage catalog, guarded shell-owned
transitions, exact stage-gated loader contracts, and a compatibility-only
`/settings` redirect. Home owns typed, retryable creation and commits a
replacement league atomically before navigating to `/noncon`. Current behavior
is documented in the season state machine, loader contracts, persistence,
configuration guidance, and validation strategy.

## Visual Direction

- Use a light, cool-neutral application foundation with a restrained blue
  application accent.
- Reserve team colors for identity accents such as a border, selection
  indicator, logo treatment, or compact badge. Do not use them as large page
  surfaces.
- Use IBM Plex Sans throughout the application.
- Prefer borders and surface contrast over shadows.
- Keep desktop layouts compact and information-dense.
- At desktop widths, keep the application shell and primary page regions
  within the viewport. Long content should scroll inside the panel that owns it
  instead of extending the document.
- Design intentional mobile adaptations that preserve important decisions and
  information. Stacking page regions is acceptable when their internal content
  and interactions are adapted for the narrower viewport; do not pass desktop
  tables or dense desktop cards through unchanged.
- Give each page one clear title and, when needed, one action or filter area.
- Use tables when cross-row and cross-column comparison is primary and
  sufficient width exists. Use compact structured rows in narrow dashboard
  panels and mobile presentations. Reserve cards for genuinely self-contained
  objects.
- Design loading, error, empty, disabled, and success states explicitly.

## Baseline Theme Tokens

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

## Frontend Code Conventions

- Pages own data loading, navigation, and page-level state.
- Shared UI and layout components do not read from IndexedDB, invoke domain
  loaders, or advance league state. They receive already-shaped display data.
- IndexedDB remains authoritative. Frontend migrations may move loaders, add
  explicit result types, and shape display records, but must preserve public
  loader names, returned behavior and values, calculations, persistence calls,
  and lifecycle side effects unless a separate domain milestone says otherwise.
- Keep page-specific components beside their page until a second use proves
  that they are shared.
- Do not create abstractions for hypothetical reuse.
- Keep shared domain records under `src/types/`. Colocate small component prop
  types with the component as it is migrated.
- Use direct imports. Do not add barrel export files.
- Prefer explicit names such as `ScheduleResultBadge` over generic names such
  as `StyledBadge`.
- Avoid `any` in migrated code.
- Treat roughly 250 lines as a soft file-size limit. Split files only along
  clear responsibilities, not to satisfy a number.
- Keep migration milestones independently reviewable. Prefer one route or one
  cohesive stateful workflow per milestone; split read-only route states from
  simulation or persistence-heavy interactions when they can be validated
  separately.
- Use the MUI `sx` prop for one-off layout. Repeated colors, typography,
  radii, shadows, component states, and density rules belong in the theme or a
  proven shared component.
- Do not introduce raw color values in migrated pages except for documented,
  dynamic team identity colors.

## Target Structure

The proven structure is intentionally modest. Keep route controllers small,
place route-specific presentation beside the route, and promote a component to
shared UI only after repeated use establishes a stable contract.

```text
src/
├── theme/
│   └── theme.ts
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── AppNavigation.tsx
│   │   └── PageLayout.tsx
│   ├── ui/
│   │   └── DataTable.tsx
│   ├── team/
│   └── game/
├── pages/
│   ├── RoutePage.tsx
│   └── route-page/
│       ├── RouteDesktopView.tsx
│       ├── RouteMobileView.tsx
│       ├── config.ts
│       └── types.ts
├── domain/
│   └── league/
│       └── loaders/
└── types/
```

Not every page needs separate desktop/mobile files, configuration, or local
types. Add only the files justified by that page. Do not scaffold candidate
primitives, add an atomic-design hierarchy or separate token package, or build
a generic component framework.

## Migration Inventory and Status

| Area | Status | Notes |
|---|---|---|
| Migration charter | Complete | This document is the durable handoff |
| Theme and reset | Complete | ThemeProvider, CssBaseline, and conservative defaults established |
| Application shell | Complete | Sticky two-tier desktop header and mobile drawer |
| Team Schedule | Complete | Pilot page; neutral desktop table and stacked mobile rows |
| Rankings | Complete | Typed compact game summaries, neutral desktop table, and mobile rows |
| Standings | Complete | Route-driven conference switching, neutral desktop table, and mobile rows |
| Weekly Schedule | Complete | Responsive scrolling game grid with route-driven week navigation |
| Team Statistics | Complete | Grouped desktop metrics and metric-driven mobile leaderboard |
| Individual Statistics | Complete | Category-specific typed columns and mobile leaderboard |
| Ratings Statistics | Complete | Independent desktop regions and compact mobile summaries |
| Team Roster | Complete | Position-grouped desktop table and mobile sections |
| Team History | Complete | Typed season history with responsive schedule navigation |
| Player Detail | Complete | Typed Career and Game Logs presentations by position category |
| Team Info dialog | Complete | Shared accessible responsive team preview and route actions |
| Dashboard | Complete | Compact team context with four equal-priority columns in a viewport-contained desktop grid |
| Game preview | Complete | Typed pregame panels, shared matchup identity, explicit empty states, and viewport-contained desktop layout |
| Game result | Complete | Final/OT matchup identity, weighted desktop panels, tabbed narrow layout, complete player box score, and accessible drive details |
| Live simulation | Complete | Unified watch/coaching session, guarded advancement controls, responsive field and drive layouts, and explicit discard/finalization states |
| Postseason hub | Complete | Tabbed bracket, committee selection board, and bowl slate with responsive round navigation |
| Awards | Complete | Typed live races and final results in a viewport-contained master-detail browser |
| Season summary | Complete | Viewport-contained champion and user-team overview with responsive awards and prestige details |
| Preseason scheduling | Complete | Typed 14-week scheduling workspace with searchable opponent selection and responsive rivalry context |
| Offseason lifecycle orchestration | Complete | Guarded shell-owned transitions, atomic persistence, read-only stage-gated loaders, and focused Vitest coverage |
| Next Season Setup (`/realignment`) | Complete | Truthful policies, immediate atomic persistence, shared historical resolution, and responsive previews |
| Roster progression | Complete | Typed projection/application parity, truthful preview language, weighted desktop panels, and narrow-layout tabs |
| Recruiting summary | Complete | User-first finalized results, complete typed rankings, desktop master-detail classes, and filtered responsive player rankings |
| Roster cuts | Complete | Typed preview/application parity, position-pressure overview, weighted desktop panels, and narrow-layout tabs |
| Settings | Complete | Navigation retired; `/settings` is a current-stage compatibility redirect |
| Offseason end-to-end hardening | Complete | One exhaustive stage catalog, exact off-stage contracts, authoritative redirect envelope, stale-action recovery, and full-cycle integration coverage |
| Home and new league | Complete | Typed responsive onboarding, Home-owned creation, explicit states, and atomic single-save replacement |

## Completed Milestone: Home and New League

This section records the durable implementation contract for Home and
new-league creation.

Current behavior:

- `/` loads the bundled historical-year index, one typed selected-year preview,
  optional existing-league information, conference/team browsing, search, and
  playoff controls.
- Home owns `startNewLeague`. It remains on `/` through validation,
  preparation, progress, and retry, then navigates to `/noncon` only after a
  successful commit. `/noncon` is a load-only preseason route.
- `startNewLeague` validates an exact supported year/team and a supported
  playoff configuration. Twelve-team automatic bids are limited to 0–10, and
  top-four conference-champion seeding requires at least four bids.
- Replacement remains immediate when a team is selected. Home warns when a
  save exists, disables duplicate actions during preparation, and keeps the
  attempted configuration available for retry.
- The base-data cache is cleared and repopulated before preparation. League,
  players, games, drives, plays, and logs are replaced in one IndexedDB
  transaction, so a failed preparation or commit leaves the previous save
  intact.
- Desktop uses a contained setup/team workspace with a scrolling team browser.
  Below `lg`, Setup and Team Selection are two local steps; the team browser
  owns overflow and uses compact rows without horizontal clipping.
- Existing saves resume through the authoritative stage catalog.

Source map:

- `src/pages/Home.tsx`
- `src/pages/home/`
- `src/pages/Noncon.tsx`
- `src/domain/league/loaders/season.ts`: `loadHomeData`
- `src/domain/league/loaders/season/startNewLeague.ts`
- `src/domain/league/loaders/season/loadNonCon.ts`
- `src/db/newLeagueRepo.ts`
- `src/domain/baseData.ts`
- `src/db/baseData.ts`
- `src/db/leagueRepo.ts`
- `src/db/simRepo.ts`
- `src/constants/stages.ts`
- `src/types/baseData.ts`
- `src/types/domain.ts`
- `src/types/league.ts`
- `src/types/pages.ts`
- `docs/architecture/data-model-and-persistence.md`
- `docs/interfaces/loaders-and-page-contracts.md`
- `docs/operations/configuration-and-tuning.md`
- `docs/operations/validation-and-test-strategy.md`

## Definition of a Migrated Page

A league-management page is complete only when all of the following are true:

- It uses the shared shell and standard page hierarchy.
- Repeated visual decisions use theme defaults or proven shared components.
- It contains no unexplained raw colors.
- Desktop, tablet, and mobile layouts have been inspected.
- Desktop document scrolling is eliminated; long content has an intentional
  internal scroll owner.
- Mobile and tablet presentations have no unintended horizontal overflow.
- Loading, error, empty, disabled, and success states are handled where
  applicable.
- Observable behavior, calculations, persistence, and lifecycle side effects
  remain intact unless the milestone explicitly changes them.
- Keyboard interaction, focus behavior, links, dialogs, tabs, and other
  applicable semantics have been checked.
- `npm run typecheck`, `npm run build`, and `git diff --check` pass.
- The migration inventory, durable decisions, and adopted patterns in this
  document are updated.

Home, onboarding, and other intentionally document-based flows may retain
desktop document scrolling when their milestone documents that exception.

## Durable Decisions

These are migration invariants. Changing one requires an explicit
application-level decision rather than an incidental page implementation.

| Decision | Rationale |
|---|---|
| Keep React and MUI | The problem is inconsistent use, not missing framework capability |
| Keep IndexedDB authoritative | Frontend work must preserve persistence and lifecycle behavior |
| Preserve calculations and simulation behavior during frontend milestones | Domain correctness and tuning require separate validation |
| Migrate incrementally in existing routes | Avoids a duplicate application and preserves domain integration |
| Complete structural migration before final visual polish | Keeps typing, behavior, responsive structure, and design refinement independently reviewable |
| Use the documented theme, IBM Plex Sans, and restrained blue accent | Gives migrated pages one stable application foundation |
| Limit team colors to identity accents | Preserves application coherence and predictable contrast |
| Prefer borders and surface contrast over shadows | Supports clear hierarchy without decorative elevation |
| Contain league-management pages within the desktop viewport | Keeps context visible while the owning panel manages overflow |
| Keep pages responsible for loaders, navigation, and page-level state | Shared presentation remains independent from IndexedDB and lifecycle actions |
| Add abstractions only after demonstrated reuse | Keeps the codebase explicit, lean, and easy to trace |
| Keep migration milestones narrowly scoped | One route or cohesive workflow improves reviewability and validation |

## Adopted Page Patterns

These patterns describe the current migrated application. They are preferred
starting points, but may be revised when a later route exposes a better
application-wide solution.

| Pattern | Rationale |
|---|---|
| Sticky two-tier shell at `lg`; compact context bar and drawer below `lg` | Keeps league actions visible while preserving content width |
| Shared compact `TeamHeader` for Schedule, Roster, and History | Reuses proven team identity and switching behavior |
| Shared neutral `DataTable` for full-width desktop datasets | Centralizes sticky-header and internal-scroll behavior |
| Page-specific compact rows in narrow panels and below the table breakpoint | Preserves each page’s information hierarchy without horizontal overflow |
| Typed compact game summaries in rankings and standings | Reuses structured previous/upcoming game context |
| Route-driven conference and week switching | Keeps navigation state addressable and predictable |
| Three-column weekly schedule grid on desktop, two on tablet, one on mobile | Preserves readable game-card width at each breakpoint |
| Metric selector plus one expanded row for mobile statistics | Keeps every metric accessible without reproducing wide tables |
| Sticky identity columns in wide desktop statistics tables | Preserves row context while numeric metrics scroll |
| Independent desktop regions for Ratings | Keeps summaries and the full leaderboard visible together |
| Position sections for mobile rosters | Preserves player, class, rating, and role in compact rows |
| Career and Game Logs tabs for Player Detail | Gives one statistics context ownership of the available viewport |
| One responsive Team Info dialog | Preserves accessible team context and Schedule, Roster, and History actions |
| Four equal Dashboard columns with stacked Previous and Current Game panels | Preserves equal information priority while keeping game states compact |
| Shared responsive matchup identity for game preview and result states | Keeps team, ranking, venue, and game context consistent while allowing state-specific score details |
| Fixed game-preview identity with one internally scrolling desktop detail region | Keeps the matchup visible while stats, odds, starters, and recent form own overflow |
| Weighted Drives, Team Stats, and Box Score columns for desktop game results | Gives narrative and player detail more room while each result panel manages its own overflow |
| Drives, Team Stats, and Box Score tabs below `lg` | Keeps one dense result context usable at a time without fixed desktop cards or horizontal overflow |
| One guarded live-simulation session with automatic coaching capability | Keeps watch and user-team games on the same engine while exposing play calls only during user offensive possessions |
| Fixed live score and controls with desktop field/drive columns and narrow Game/Drives tabs | Keeps game context and advancement actions available while the active detail region owns overflow |
| Bracket, Committee, and Bowls tabs with round navigation below `lg` | Keeps one dense postseason context in the viewport while adapting tournament progression for narrow screens |
| Award category rail on desktop and scrollable category tabs below `lg` | Keeps one three-player award race readable while all nine categories remain quickly accessible |
| Champion and user-team overview with Awards and Prestige detail tabs below `lg` | Keeps the season outcome visible while one dense recap region owns narrow-screen overflow |
| Split preseason schedule and rivalry workspace with local tabs below `lg` | Keeps all 14 weeks scannable while secondary rivalry context remains accessible without page overflow |
| Three-region Next Season Setup with Setup, Conferences, and Postseason tabs below `lg` | Keeps policy choices and historical previews distinct while immediate persistence remains visible |
| Weighted returning/departing progression panels with tabs below `lg` | Keeps the larger projected roster comparison prominent while departures remain visible and narrow layouts avoid table overflow |
| User recruiting summary with desktop team/class master-detail and complete filtered player rankings | Keeps the controlled team prominent while retaining full national results without hard display cutoffs |
| Weighted Position Limits and Projected Cuts panels with tabs below `lg` | Makes automatic cut pressure traceable while preserving a compact, overflow-safe narrow layout |
| Side-by-side desktop Home workspace with Setup and Team Selection steps below `lg` | Keeps desktop browsing dense while narrow onboarding has one decision and one intentional scroll owner at a time |

## Validation Baseline

Until automated UI coverage is introduced, every migration milestone must run:

```bash
npm run typecheck
npm run build
git diff --check
```

Inspect affected routes at approximately:

- 1440×900;
- 1280×720;
- 768×1024;
- 390×844.

At `lg`, confirm the document does not scroll vertically and the owning table,
panel, tab region, or column manages overflow. Below `lg`, confirm there is no
unintended horizontal overflow and all desktop information remains accessible.
Check applicable loading, error, empty, disabled, and populated states, plus
keyboard interaction, focus return, link semantics, dialogs, tabs, sorting,
selection, and expansion controls.

Domain or lifecycle changes require the broader scenario checks in
`docs/operations/validation-and-test-strategy.md`.
