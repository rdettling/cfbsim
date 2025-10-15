# CFBSim.net

A personal project that simulates a college football season. Inspired by [Basketball GM](https://play.basketball-gm.com/).

---

## Table of Contents

- [Introduction](#introduction)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Usage](#usage)
- [Key Components](#key-components)
- [API Endpoints](#api-endpoints)
- [Simulation System](#simulation-system)

---

## Introduction

Initially started as a school project, CFBSim.net evolved into a way for me to get better at Django and databases. The application simulates complete college football seasons with realistic team dynamics, player progression, and playoff scenarios.

---

## Tech Stack

### Backend
- **Framework**: Django (Python)
- **Database**: SQLite (development), PostgreSQL (production)
- **API**: Django REST Framework
- **Deployment**: Heroku

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI)
- **Routing**: React Router v6
- **Build Tool**: Vite
- **HTTP Client**: Axios

---

## Features

### Core Features
- **130+ Real Teams**: Includes logos for an authentic experience
- **Comprehensive Conferences**: Updated and accurate for the given year
- **Auto-Generated Players and Stats**: Fresh talent and stats that make each simulation unique
- **Flexible Playoff System**: Support for 2-team (BCS), 4-team, and 12-team playoff formats
- **Real-Life Rivalry Games**: Feel the intensity in matches that mirror real-life rivalries
- **Player Progression**: Players develop over time with realistic rating changes
- **Conference Realignment**: Dynamic conference changes between seasons
- **Recruiting System**: Comprehensive recruiting rankings and class tracking

### Game Mechanics
- **Realistic Game Simulation**: Based on team ratings, home-field advantage, and matchup factors
- **Watchability Scores**: Games ranked by excitement potential
- **Dynamic Rankings**: AP Poll-style rankings with strength of record
- **Betting Lines**: Spreads, moneylines, and win probabilities
- **Player Development**: Offseason progression system with development traits

### User Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Auto-Refresh**: Pages automatically update when games are simulated
- **Interactive Navigation**: Comprehensive navbar with dropdown menus
- **Team Modals**: Quick team information without page navigation
- **Week Navigation**: Easy navigation between weeks during season

---

## Architecture

### Backend Architecture
```
backend/
├── api/                    # Django REST API
│   ├── models.py          # Database models (Teams, Games, Players, etc.)
│   ├── serializers.py     # DRF serializers
│   ├── views/             # API view modules
│   │   ├── game_views.py
│   │   ├── season_views.py
│   │   ├── stats_views.py
│   │   └── team_views.py
│   └── urls.py            # URL routing
├── logic/                  # Core simulation logic
│   ├── sim/               # Game simulation engine
│   ├── schedule.py        # Schedule generation
│   ├── season.py          # Season management
│   ├── player_generation.py
│   └── roster_management.py
└── data/                   # Static data files
    ├── teams.json
    ├── conferences.json
    └── ratings/           # Historical team ratings
```

### Frontend Architecture
```
frontend/src/
├── pages/                  # 18 page components
│   ├── Home.tsx           # Game launcher
│   ├── Dashboard.tsx      # Main hub during season
│   ├── Game.tsx           # Individual game view
│   └── ...                # 15 more pages
├── components/             # Reusable components
│   ├── Navbar.tsx         # Primary navigation
│   ├── PageLayout.tsx     # Layout wrapper (NEW!)
│   ├── GamePreview.tsx
│   └── ...                # 10 more components
├── hooks/
│   └── useDataFetching.ts # Custom data fetching hook
├── services/
│   └── api.ts             # API client with axios
├── interfaces/
│   └── index.ts           # TypeScript type definitions
└── constants/
    └── stages.ts          # Game stage constants
```

---

## Project Structure

### Key Design Patterns

#### 1. **PageLayout Component** (NEW!)
All pages now use a centralized `PageLayout` component that handles:
- Loading states with consistent spinner
- Error states with alert display
- Optional navbar rendering
- Configurable container widths

**Benefits:**
- Eliminates ~300+ lines of duplicated code
- Ensures consistent UX across all pages
- Single source of truth for loading/error states

#### 2. **useDataFetching Hook**
Custom React hook for data fetching with:
- Generic type support
- Automatic refresh on game state changes
- Loading/error state management
- Configurable dependencies

#### 3. **Centralized API Service**
Single `api.ts` file with:
- Environment-aware base URLs (dev vs production)
- Axios interceptors for user ID management
- Typed API endpoints for all backend routes
- Helper functions for route generation

#### 4. **Type-Safe Interfaces**
Comprehensive TypeScript interfaces for:
- Core entities (Team, Player, Game, Conference)
- API responses
- Component props
- Filter options

---

## Development Setup

### Prerequisites
- Python 3.13+
- Node.js 18+
- npm or yarn

### Backend Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

### Data Setup
The application requires data files in `backend/data/`:
- `teams.json` - Team information
- `conferences.json` - Conference data
- `ratings/*.json` - Historical team ratings
- `years/*.json` - Season-specific configurations

---

## Usage

### Starting a New Game
1. Visit [CFBSim.net](https://cfbsim.net)
2. Select a year (2004-2024 available)
3. Choose playoff format:
   - **2 Teams**: BCS Championship
   - **4 Teams**: Standard playoff
   - **12 Teams**: Expanded playoff with autobids
4. Select your team to "control"
5. Schedule non-conference games (optional)
6. Advance to season

### During Season
- **Dashboard**: View your team's performance, upcoming games, and standings
- **Advance Weeks**: Simulate one or multiple weeks at a time
- **View Games**: Click any game for detailed preview/results
- **Track Rankings**: Monitor AP Poll rankings and playoff positioning

### Navigation
- **Team Menu**: Access team schedule, roster, and history
- **Conference Standings**: View all conference standings
- **Stats**: Team stats, individual player stats, and ratings
- **Schedule**: Browse games by week
- **Rankings**: See current AP Poll
- **Playoff**: View playoff bracket and bubble teams

---

## Key Components

### PageLayout Component
```typescript
<PageLayout 
  loading={loading} 
  error={error}
  navbarData={data ? {
    team: data.team,
    currentStage: data.info.stage,
    info: data.info,
    conferences: data.conferences
  } : undefined}
  containerMaxWidth="lg"
>
  {data && (
    <>
      {/* Page content */}
    </>
  )}
</PageLayout>
```

### useDataFetching Hook
```typescript
const { data, loading, error, refetch } = useDataFetching({
  fetchFunction: () => apiService.getDashboard<DashboardData>(),
  dependencies: [],
  autoRefreshOnGameChange: true
});
```

### API Service
```typescript
// Type-safe API calls
const data = await apiService.getDashboard<DashboardData>();
const rankings = await apiService.getRankings<RankingsData>(week);
```

---

## API Endpoints

### Season Management
- `GET /api/home/` - Home page data with available years
- `GET /api/dashboard/` - Dashboard data for current season
- `GET /api/noncon/` - Non-conference scheduling page
- `POST /api/schedulenc/` - Schedule non-conference game
- `GET /api/sim/:week/` - Simulate games up to specified week

### Team Data
- `GET /api/:teamName/schedule/` - Team schedule
- `GET /api/:teamName/roster/` - Team roster
- `GET /api/:teamName/history/` - Team history
- `GET /api/:teamName/stats/` - Team statistics

### Games & Players
- `GET /api/game/:id/` - Individual game details
- `GET /api/week/:week/` - Week schedule
- `GET /api/player/:id/` - Player details

### Rankings & Standings
- `GET /api/rankings/` - AP Poll rankings
- `GET /api/standings/:conference/` - Conference standings
- `GET /api/playoff/` - Playoff bracket

### Stats
- `GET /api/stats/team/` - Team statistics list
- `GET /api/stats/individual/` - Individual player stats
- `GET /api/stats/ratings/` - Ratings statistics

### Season Progression
- `GET /api/summary/` - Season summary
- `GET /api/roster_progression/` - Roster progression
- `GET /api/recruiting_summary/` - Recruiting summary

---

## Simulation System

### Game Simulation
The simulation engine (`backend/logic/sim/sim.py`) uses:
- **Team Ratings**: Overall team strength (offense + defense)
- **Home Field Advantage**: +3 rating boost for home team
- **Random Variance**: Adds unpredictability to outcomes
- **Watchability Score**: Calculates game excitement based on matchup

### Player Development
- **Development Traits**: Players have growth potential (Normal, Star, Superstar, Bust)
- **Yearly Progression**: Ratings increase/decrease based on trait
- **Offseason Changes**: Applied between seasons

### Playoff System
- **Autobids**: Conference champions automatically qualify
- **At-Large Bids**: Remaining spots filled by highest-ranked teams
- **Bracket Generation**: Automatic bracket creation based on format
- **Bubble Teams**: Teams just outside playoff contention

### Conference Realignment
- **Dynamic Changes**: Conferences can change between seasons
- **Prestige-Based**: Teams move based on performance
- **Historical Accuracy**: Reflects real conference realignment trends

---

## Contributing

This is a personal project, but suggestions and feedback are welcome!

---

## License

This project is for personal use only.

