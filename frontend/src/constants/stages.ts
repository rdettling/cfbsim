// frontend/src/constants/stages.ts

export const STAGES = [
    { id: 'preseason', banner_label: 'Preseason', label: 'Non-Conference scheduling', path: '/noncon', next: 'season', season: false },
    { id: 'season', banner_label: 'Season', label: 'Season', path: '/dashboard', next: 'summary', season: true },
    { id: 'summary', banner_label: 'Season Summary', label: 'Season Summary', path: '/summary', next: 'realignment', season: false },
    { id: 'realignment', banner_label: 'Offseason', label: 'Realignment', path: '/realignment', next: 'progression', season: false },
    { id: 'progression', banner_label: 'Offseason', label: 'Roster Progression', path: '/roster_progression', next: 'recruiting_summary', season: false },
    { id: 'recruiting_summary', banner_label: 'Offseason', label: 'Recruiting Summary', path: '/recruiting_summary', next: 'preseason', season: false },
] as const;