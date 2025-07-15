// frontend/src/constants/stages.ts

export const STAGES = [
    { id: 'preseason', banner_label: 'Preseason', label: 'Non-Conference scheduling', path: '/noncon', next: 'season', season: false },
    { id: 'season', banner_label: 'Season', label: 'Season', path: '/dashboard', next: 'summary', season: true },
    { id: 'summary', banner_label: 'Season Summary', label: 'Season Summary', path: '/summary', next: 'progression', season: false },
    { id: 'progression', banner_label: 'Offseason', label: 'Roster Progression', path: '/roster_progression', next: 'preseason', season: false },
] as const;