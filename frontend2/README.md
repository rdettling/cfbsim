# Frontend Page Standards

This document outlines the standardized format and patterns for all frontend pages in the CFB Sim project.

## 📋 Page Structure Template

Every page should follow this basic structure:

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import {
    Container,
    Typography,
    Box,
    CircularProgress,
    Alert,
    // ... other MUI components as needed
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useDataFetching } from '../hooks/useDataFetching';

// Define your data interface
interface PageData {
    info: Info;
    team: Team;
    // ... other data properties
    conferences: Conference[];
}

export default function PageName() {
    const { param1, param2 } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    // State for modals, filters, etc.
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<string>('');

    // Data fetching with auto-refresh
    const { data, loading, error } = useDataFetching({
        fetchFunction: () => {
            // Always read current URL parameters for closure safety
            const currentParam = window.location.pathname.split('/').pop();
            if (!currentParam) throw new Error('Required parameter missing');
            
            return apiService.getPageData<PageData>(currentParam);
        },
        dependencies: [param1, param2], // Include all URL parameters
        autoRefreshOnGameChange: true // Set to false if page shouldn't auto-refresh
    });

    // Page title management
    useEffect(() => {
        document.title = data ? `Page Title - ${data.info.season}` : 'College Football';
        return () => { document.title = 'College Football'; };
    }, [data]);

    // Event handlers
    const handleItemClick = (name: string) => {
        setSelectedItem(name);
        setModalOpen(true);
    };

    // Loading state
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    // Error state
    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    // No data state
    if (!data) {
        return <Alert severity="warning">No data available</Alert>;
    }

    return (
        <>
            {/* Navbar at top level - always full width */}
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            
            {/* Main content wrapped in Container */}
            <Container maxWidth="xl">
                {/* Page header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
                        Page Title
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                        Page subtitle or description
                    </Typography>
                </Box>

                {/* Main content */}
                <Box>
                    {/* Your page content here */}
                </Box>
            </Container>

            {/* Modals at bottom level */}
            <SomeModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                data={selectedItem}
            />
        </>
    );
}
```

## 🔧 Key Components

### 1. useDataFetching Hook

**Purpose**: Abstract data fetching, loading states, error handling, and auto-refresh functionality.

**Usage**:
```typescript
const { data, loading, error, refetch } = useDataFetching({
    fetchFunction: () => apiService.getData<DataType>(),
    dependencies: [param1, param2], // URL parameters that should trigger re-fetch
    autoRefreshOnGameChange: true, // Whether to auto-refresh on game simulation
    onDataChange: (data) => { /* optional callback */ }
});
```

**Important**: Always read URL parameters from `window.location.pathname` in `fetchFunction` to avoid closure issues.

### 2. Navbar Component

**Placement**: Always at the top level, outside any Container, to ensure full width.

**Props**:
```typescript
<Navbar
    team={data.team}
    currentStage={data.info.stage}
    info={data.info}
    conferences={data.conferences}
/>
```

### 3. Container Wrapper

**Purpose**: Wrap main content (not Navbar) to provide consistent max-width and padding.

**Usage**:
```typescript
<Container maxWidth="xl">
    {/* All page content except Navbar */}
</Container>
```

## 📁 File Organization

### Required Imports (in order)
1. **React hooks**: `useState`, `useEffect`
2. **React Router**: `useParams`, `useNavigate`, `useSearchParams`
3. **Services**: `apiService`
4. **Interfaces**: `Team`, `Info`, `Conference`, custom interfaces
5. **Material-UI**: All MUI components
6. **Components**: `Navbar`, custom components
7. **Hooks**: `useDataFetching`

### Interface Definitions
- Define data interfaces at the top of the file
- Use descriptive names: `PageData`, `GameData`, `TeamData`, etc.
- Always include `info: Info`, `team: Team`, `conferences: Conference[]`

## 🎨 Styling Guidelines

### Loading States
```typescript
if (loading) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress size={60} />
        </Box>
    );
}
```

### Error States
```typescript
if (error) {
    return <Alert severity="error">{error}</Alert>;
}
```

### No Data States
```typescript
if (!data) {
    return <Alert severity="warning">No data available</Alert>;
}
```

### Page Headers
```typescript
<Box sx={{ mb: 4 }}>
    <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
        Page Title
    </Typography>
    <Typography variant="h6" sx={{ color: 'text.secondary' }}>
        Page description
    </Typography>
</Box>
```

## 🔄 Auto-Refresh Configuration

### Navbar Auto-Refresh (Always Required)
**Important**: The Navbar should ALWAYS auto-refresh because it displays the current week number, which changes every simulation.

```typescript
// ✅ Always pass fresh data to Navbar
<Navbar
    team={data.team}
    currentStage={data.info.stage}
    info={data.info}  // This contains currentWeek which updates every sim
    conferences={data.conferences}
/>
```

### Page Content Auto-Refresh

#### Pages that should auto-refresh content (`autoRefreshOnGameChange: true`)
- **WeekSchedule**: Updates when games are simulated
- **Standings**: Updates when standings change
- **TeamStats**: Updates when team performance changes
- **IndividualStats**: Updates when player stats change
- **Roster**: Updates when roster changes
- **TeamSchedule**: Updates when games are played

#### Pages that should NOT auto-refresh content (`autoRefreshOnGameChange: false`)
- **Home**: Static dashboard data
- **TeamHistory**: Historical data doesn't change
- **Past weeks**: Historical game data
- **Future weeks**: Preview data

**Note**: Even when page content doesn't auto-refresh, the Navbar will still update to show the current week because it receives fresh `data.info` from the `useDataFetching` hook.

## 🐛 Common Issues & Solutions

### 1. Closure Issues with URL Parameters
**Problem**: Auto-refresh fetches wrong data after navigation
**Solution**: Read parameters from `window.location.pathname` in `fetchFunction`

```typescript
// ❌ Wrong - captures stale value
fetchFunction: () => apiService.getData(week)

// ✅ Correct - always reads current value
fetchFunction: () => {
    const currentWeek = window.location.pathname.split('/').pop();
    return apiService.getData(currentWeek);
}
```

### 2. Navbar Width Issues
**Problem**: Navbar constrained by Container width
**Solution**: Place Navbar outside Container at top level

```typescript
// ✅ Correct structure
<>
    <Navbar {...props} />
    <Container>
        {/* Content */}
    </Container>
</>
```

### 3. Missing Dependencies
**Problem**: Page doesn't re-fetch when URL changes
**Solution**: Include all URL parameters in dependencies array

```typescript
dependencies: [week, teamName, conferenceName] // All URL params
```

## 📝 Checklist for New Pages

- [ ] Follow the template structure
- [ ] Use `useDataFetching` hook
- [ ] Place Navbar at top level
- [ ] Wrap content in Container
- [ ] Handle loading, error, and no-data states
- [ ] Set appropriate `autoRefreshOnGameChange` value
- [ ] Read URL parameters from `window.location.pathname`
- [ ] Include all URL parameters in dependencies
- [ ] Set page title in useEffect
- [ ] Define proper TypeScript interfaces
- [ ] Add proper error handling
- [ ] Test auto-refresh functionality

## 🔍 Debug Logging

The `useDataFetching` hook includes debug logging to help troubleshoot issues:

- `🔍 PageName: Fetching data for week X` - Shows fetch operations
- `🔄 useDataFetching: Auto-refresh triggered` - Shows auto-refresh events
- `📡 useDataFetching: Setting up pageDataRefresh listener` - Shows event listener setup

Enable console logging to debug auto-refresh issues.

## 📚 Examples

See these files for complete examples:
- `WeekSchedule.tsx` - Complex page with navigation and auto-refresh
- `Standings.tsx` - Simple data display with auto-refresh
- `TeamHistory.tsx` - Historical data without auto-refresh
- `Home.tsx` - Dashboard without auto-refresh
