import { Box, Typography, Paper, Grid, List, ListItem, Chip, Link as MuiLink } from '@mui/material';
import { TeamLogo } from './TeamComponents';

interface PlayoffTeam {
    name: string;
    seed?: number;
    ranking: number;
    record: string;
    is_autobid: boolean;
}

interface TwelveTeamPlayoffProps {
    playoffTeams: PlayoffTeam[];
    bubbleTeams: any[];
    conferenceChampions: any[];
    bracket: any;
    onTeamClick: (name: string) => void;
}

// Team box component with logos and clickable names
const TeamBox = ({ team, seed, isTBD = false, onTeamClick }: {
    team?: string;
    seed?: number;
    isTBD?: boolean;
    onTeamClick: (name: string) => void;
}) => {
    const displayTeam = team?.startsWith('Winner of') ? 'TBD' : team;
    const shouldShowTBD = isTBD || team?.startsWith('Winner of');
    
    return (
        <Box
            sx={{
                p: 1.5,
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                backgroundColor: '#fafafa',
                minHeight: 45,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontWeight: 'bold',
                fontSize: '0.9rem',
                color: shouldShowTBD ? '#666' : '#333',
                '&:hover': {
                    backgroundColor: '#f0f0f0',
                    borderColor: '#1976d2'
                }
            }}
        >
            {seed && (
                <Typography 
                    variant="caption" 
                    sx={{ 
                        fontWeight: 'bold',
                        color: seed <= 4 ? '#1976d2' : '#666',
                        minWidth: 25
                    }}
                >
                    {seed}
                </Typography>
            )}
            {!shouldShowTBD && displayTeam && (
                <TeamLogo name={displayTeam} size={25} />
            )}
            {shouldShowTBD ? (
                <Typography sx={{ fontWeight: 'bold' }}>
                    {displayTeam || 'TBD'}
                </Typography>
            ) : (
                <MuiLink
                    component="button"
                    onClick={() => onTeamClick(displayTeam || '')}
                    sx={{ 
                        cursor: 'pointer', 
                        textDecoration: 'none', 
                        fontWeight: 'bold',
                        color: '#333',
                        '&:hover': { color: '#1976d2' }
                    }}
                >
                    {displayTeam || 'TBD'}
                </MuiLink>
            )}
        </Box>
    );
};

// Matchup component
const Matchup = ({ matchup, direction, onTeamClick }: {
    matchup: any;
    direction: 'left' | 'right';
    onTeamClick: (name: string) => void;
}) => (
    <Box sx={{ position: 'relative' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <TeamBox 
                team={matchup.team1} 
                seed={matchup.seed1} 
                isTBD={matchup.team1 === "TBD"} 
                onTeamClick={onTeamClick}
            />
            <TeamBox 
                team={matchup.team2} 
                seed={matchup.seed2} 
                isTBD={matchup.team2 === "TBD"} 
                onTeamClick={onTeamClick}
            />
        </Box>
        
        {/* Connector line */}
        <Box
            sx={{
                position: 'absolute',
                [direction === 'left' ? 'right' : 'left']: -20,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 20,
                height: 2,
                backgroundColor: '#e0e0e0',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    [direction === 'left' ? 'right' : 'left']: 0,
                    top: -8,
                    width: 2,
                    height: 16,
                    backgroundColor: '#e0e0e0'
                }
            }}
        />
    </Box>
);

// Bracket round component
const BracketRound = ({ title, matchups, direction = 'left', centerAlign = false, onTeamClick }: {
    title: string;
    matchups: any[];
    direction?: 'left' | 'right';
    centerAlign?: boolean;
    onTeamClick: (name: string) => void;
}) => (
    <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 3, 
        minWidth: 200,
        justifyContent: centerAlign ? 'center' : 'flex-start',
        alignItems: centerAlign ? 'center' : 'stretch'
    }}>
        <Typography 
            variant="h6" 
            sx={{ 
                fontWeight: 'bold', 
                textAlign: 'center', 
                mb: 2,
                color: '#1976d2',
                fontSize: '1rem'
            }}
        >
            {title}
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {matchups.map((matchup, idx) => (
                <Matchup key={idx} matchup={matchup} direction={direction} onTeamClick={onTeamClick} />
            ))}
        </Box>
    </Box>
);

// Championship component
const Championship = ({ championship, onTeamClick }: { 
    championship: any;
    onTeamClick: (name: string) => void;
}) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography 
            variant="h6" 
            sx={{ 
                fontWeight: 'bold', 
                textAlign: 'center',
                color: '#1976d2',
                fontSize: '1.1rem'
            }}
        >
            Championship
        </Typography>
        <Box sx={{ position: 'relative' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <TeamBox 
                    team={championship?.team1} 
                    seed={championship?.seed1} 
                    isTBD={championship?.team1 === "TBD"} 
                    onTeamClick={onTeamClick}
                />
                <TeamBox 
                    team={championship?.team2} 
                    seed={championship?.seed2} 
                    isTBD={championship?.team2 === "TBD"} 
                    onTeamClick={onTeamClick}
                />
            </Box>
            
            {/* Connector lines to semifinals */}
            <Box
                sx={{
                    position: 'absolute',
                    left: -20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 20,
                    height: 2,
                    backgroundColor: '#e0e0e0'
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    right: -20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 20,
                    height: 2,
                    backgroundColor: '#e0e0e0'
                }}
            />
        </Box>
    </Box>
);

// Information section component with clickable team names
const InfoSection = ({ title, items, renderItem, onTeamClick }: {
    title: string;
    items: any[];
    renderItem: (item: any, index: number) => React.ReactNode;
    onTeamClick: (name: string) => void;
}) => (
    <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
            {title}
        </Typography>
        <List dense sx={{ py: 0 }}>
            {items.map((item, index) => (
                <ListItem key={item.name || index} sx={{ py: 1, px: 0 }}>
                    {renderItem(item, index)}
                </ListItem>
            ))}
        </List>
    </Paper>
);

const TwelveTeamPlayoff = ({ playoffTeams, bubbleTeams, conferenceChampions, bracket, onTeamClick }: TwelveTeamPlayoffProps) => {
    return (
        <Box>
            {/* Playoff Bracket - Full Width */}
            <Paper sx={{ p: 4, borderRadius: 2, overflow: 'auto' }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4, textAlign: 'center' }}>
                    12-Team Playoff Bracket
                </Typography>
                
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minWidth: 1200,
                    gap: 8
                }}>
                    {/* Left Bracket */}
                    <Box sx={{ display: 'flex', gap: 6, flex: 1 }}>
                        <BracketRound 
                            title="First Round" 
                            matchups={bracket.left_bracket?.first_round || []}
                            direction="left"
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="Quarterfinals" 
                            matchups={bracket.left_bracket?.quarterfinals || []}
                            direction="left"
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="Semifinal" 
                            matchups={[bracket.left_bracket?.semifinal || {}]}
                            direction="left"
                            centerAlign={true}
                            onTeamClick={onTeamClick}
                        />
                    </Box>
                    
                    {/* Championship */}
                    <Championship championship={bracket.championship} onTeamClick={onTeamClick} />
                    
                    {/* Right Bracket */}
                    <Box sx={{ display: 'flex', gap: 6, flex: 1 }}>
                        <BracketRound 
                            title="Semifinal" 
                            matchups={[bracket.right_bracket?.semifinal || {}]}
                            direction="right"
                            centerAlign={true}
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="Quarterfinals" 
                            matchups={bracket.right_bracket?.quarterfinals || []}
                            direction="right"
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="First Round" 
                            matchups={bracket.right_bracket?.first_round || []}
                            direction="right"
                            onTeamClick={onTeamClick}
                        />
                    </Box>
                </Box>
            </Paper>

            {/* Playoff Information - Below the bracket */}
            <Grid container spacing={3} sx={{ mt: 3 }}>
                <Grid item xs={12} md={4}>
                    <InfoSection
                        title="Playoff Teams"
                        items={playoffTeams.slice(0, 12)}
                        onTeamClick={onTeamClick}
                        renderItem={(team, index) => (
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Typography 
                                    variant="body1" 
                                    sx={{ 
                                        fontWeight: 'bold', 
                                        minWidth: 35,
                                        color: index < 4 ? 'primary.main' : 'text.primary'
                                    }}
                                >
                                    #{team.seed}
                                </Typography>
                                <TeamLogo name={team.name} size={25} />
                                <Box sx={{ flexGrow: 1 }}>
                                    <MuiLink
                                        component="button"
                                        onClick={() => onTeamClick(team.name)}
                                        sx={{ 
                                            cursor: 'pointer', 
                                            textDecoration: 'none', 
                                            fontWeight: 'bold',
                                            color: 'text.primary',
                                            '&:hover': { color: 'primary.main' }
                                        }}
                                    >
                                        {team.name}
                                    </MuiLink>
                                    <Typography variant="body2" color="text.secondary">
                                        {team.record} • Rank #{team.ranking}
                                    </Typography>
                                </Box>
                                {team.is_autobid && (
                                    <Chip 
                                        label="Auto" 
                                        color="primary" 
                                        size="small"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                )}
                            </Box>
                        )}
                    />
                </Grid>

                <Grid item xs={12} md={4}>
                    <InfoSection
                        title="Bubble Teams"
                        items={bubbleTeams}
                        onTeamClick={onTeamClick}
                        renderItem={(team) => (
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Typography variant="body2" sx={{ minWidth: 35, fontWeight: 'bold' }}>
                                    #{team.ranking}
                                </Typography>
                                <TeamLogo name={team.name} size={20} />
                                <Box sx={{ flexGrow: 1 }}>
                                    <MuiLink
                                        component="button"
                                        onClick={() => onTeamClick(team.name)}
                                        sx={{ 
                                            cursor: 'pointer', 
                                            textDecoration: 'none', 
                                            fontWeight: 'bold',
                                            color: 'text.primary',
                                            '&:hover': { color: 'primary.main' }
                                        }}
                                    >
                                        {team.name}
                                    </MuiLink>
                                    <Typography variant="caption" color="text.secondary">
                                        {team.record} • {team.conference}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    />
                </Grid>

                <Grid item xs={12} md={4}>
                    <InfoSection
                        title="Conference Champions"
                        items={conferenceChampions}
                        onTeamClick={onTeamClick}
                        renderItem={(team) => (
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Typography variant="body2" sx={{ minWidth: 35, fontWeight: 'bold' }}>
                                    #{team.ranking}
                                </Typography>
                                <TeamLogo name={team.name} size={20} />
                                <Box sx={{ flexGrow: 1 }}>
                                    <MuiLink
                                        component="button"
                                        onClick={() => onTeamClick(team.name)}
                                        sx={{ 
                                            cursor: 'pointer', 
                                            textDecoration: 'none', 
                                            fontWeight: 'bold',
                                            color: 'text.primary',
                                            '&:hover': { color: 'primary.main' }
                                        }}
                                    >
                                        {team.name}
                                    </MuiLink>
                                    <Typography variant="caption" color="text.secondary">
                                        {team.record}
                                    </Typography>
                                </Box>
                                {team.seed && (
                                    <Chip 
                                        label={team.seed <= 4 
                                            ? `Seed #${team.seed}` 
                                            : 'Playoff'
                                        }
                                        color={team.seed <= 4 ? 'primary' : 'success'}
                                        size="small"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                )}
                            </Box>
                        )}
                    />
                </Grid>
            </Grid>
        </Box>
    );
};

export default TwelveTeamPlayoff; 