import { useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    Stack,
    Collapse,
    IconButton,
    Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { TeamLogo } from '../team/TeamComponents';
import type { Drive } from '../../types/game';
import type { DriveSummaryProps } from '../../types/components';

const DriveSummary = ({ 
    drives, 
    currentPlayIndex = 0, 
    totalPlays: _totalPlays = 0,
    isGameComplete = false,
    variant = 'page',
    includeCurrentDrive = false,
    matchup
}: DriveSummaryProps) => {
    const [expandedDrives, setExpandedDrives] = useState<Set<number>>(new Set());

    const toggleDriveExpansion = (driveNum: number) => {
        setExpandedDrives((prev: Set<number>) => {
            const newSet = new Set(prev);
            if (newSet.has(driveNum)) {
                newSet.delete(driveNum);
            } else {
                newSet.add(driveNum);
            }
            return newSet;
        });
    };

    // Helper function to get completed drives up to current play
    const getCompletedDrives = () => {
        const completed: Drive[] = [];
        let playCount = 0;
        
        for (const drive of drives) {
            const driveEndIndex = playCount + (drive.plays?.length || 0) - 1;
            // Include drive only if it's completely finished (all plays have been watched)
            if (driveEndIndex < currentPlayIndex) {
                completed.push(drive);
                playCount += drive.plays?.length || 0;
                continue;
            }
            if (includeCurrentDrive) {
                completed.push(drive);
            }
            break;
        }
        
        return completed;
    };

    const completedDrives = variant === 'modal' ? getCompletedDrives() : drives;
    const displayDrives = variant === 'modal' ? completedDrives : drives;

    const containerProps = variant === 'modal' 
        ? { 
            sx: { 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column' 
            } 
        }
        : { 
            elevation: 2, 
            sx: { height: '100%' } 
        };

    return (
        <Card {...containerProps}>
            <CardContent sx={variant === 'modal' ? { flex: 1, overflow: 'auto' } : {}}>
                <Typography 
                    variant="h5" 
                    gutterBottom 
                    sx={{ 
                        fontWeight: 'bold', 
                        color: 'primary.main',
                        ...(variant === 'modal' && { variant: 'h6' })
                    }}
                >
                    Drive Summary
                </Typography>
                <Box sx={{ 
                    maxHeight: variant === 'modal' ? 'none' : 400, 
                    overflowY: variant === 'modal' ? 'auto' : 'auto' 
                }}>
                    {displayDrives.length === 0 ? (
                        <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                                textAlign: 'center', 
                                mt: 2 
                            }}
                        >
                            {variant === 'modal' ? 'No completed drives yet' : 'No drives available'}
                        </Typography>
                    ) : (
                        displayDrives.map((drive, idx) => {
                            const isExpanded = expandedDrives.has(drive.driveNum);
                            const hasPlays = drive.plays && drive.plays.length > 0;
                            const isCurrentDrive = includeCurrentDrive
                                && !isGameComplete
                                && variant === 'modal'
                                && idx === displayDrives.length - 1;
                            const scoreA = isCurrentDrive && matchup ? matchup.currentScoreA : drive.scoreAAfter;
                            const scoreB = isCurrentDrive && matchup ? matchup.currentScoreB : drive.scoreBAfter;
                            const resolvedScore = matchup
                                ? (matchup.awayIsTeamA
                                    ? { awayScore: scoreA ?? 0, homeScore: scoreB ?? 0 }
                                    : { awayScore: scoreB ?? 0, homeScore: scoreA ?? 0 })
                                : { awayScore: scoreA ?? 0, homeScore: scoreB ?? 0 };
                            
                            return (
                                <Card 
                                    key={idx}
                                    elevation={1}
                                    sx={{ 
                                        mb: 2, 
                                        '&:hover': { 
                                            elevation: 2,
                                            transform: 'translateY(-1px)',
                                            transition: 'all 0.2s ease-in-out'
                                        },
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        {/* Header with drive number and points */}
                                        <Box sx={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            mb: 1.5 
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip 
                                                    label={`Drive #${drive.driveNum + 1}`}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                                {hasPlays && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => toggleDriveExpansion(drive.driveNum)}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    </IconButton>
                                                )}
                                            </Box>
                                            <Chip 
                                                label={drive.points > 0 ? `+${drive.points} pts` : 'No score'}
                                                size="small"
                                                color={drive.points > 0 ? 'success' : 'default'}
                                                variant={drive.points > 0 ? 'filled' : 'outlined'}
                                                sx={{ fontWeight: 'bold' }}
                                            />
                                        </Box>

                                        {/* Team info with logo */}
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1.5, 
                                            mb: 1 
                                        }}>
                                            <TeamLogo name={drive.offense} size={24} />
                                            <Typography variant="body2" fontWeight="medium">
                                                {drive.offense}
                                            </Typography>
                                        </Box>

                                        {/* Drive details */}
                                        <Stack spacing={0.5}>
                                            <Typography 
                                                variant="body2" 
                                                color="text.secondary"
                                                sx={{ fontWeight: 'medium' }}
                                            >
                                                {drive.result.split(' ').map((word: string) => 
                                                    word.charAt(0).toUpperCase() + word.slice(1)
                                                ).join(' ')}
                                            </Typography>
                                            
                                            <Box sx={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {drive.plays?.length || 0} plays{drive.yards !== undefined ? `, ${drive.yards} yards` : ''}
                                                </Typography>
                                                {scoreA !== undefined && scoreB !== undefined && (
                                                    <Typography 
                                                        variant="caption" 
                                                        color="text.secondary"
                                                        sx={{ fontWeight: 'medium' }}
                                                    >
                                                        {resolvedScore.awayScore}-{resolvedScore.homeScore}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Stack>

                                        {/* Expanded plays section */}
                                        {hasPlays && (
                                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                <Divider sx={{ my: 1.5 }} />
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                    Plays
                                                </Typography>
                                                <Stack spacing={0.5}>
                                                    {drive.plays?.map((play, playIdx) => (
                                                        <Box 
                                                            key={playIdx}
                                                            sx={{ 
                                                                p: 1, 
                                                                bgcolor: 'grey.50', 
                                                                borderRadius: 1,
                                                                border: '1px solid',
                                                                borderColor: 'grey.200'
                                                            }}
                                                        >
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                                                                {play.header}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                                {play.text}
                                                            </Typography>
                                                            <Box sx={{ 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between', 
                                                                mt: 0.5 
                                                            }}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {play.playType.charAt(0).toUpperCase() + play.playType.slice(1)}
                                                                </Typography>
                                                                <Typography 
                                                                    variant="caption" 
                                                                    color={play.yardsGained > 0 ? 'success.main' : play.yardsGained < 0 ? 'error.main' : 'text.secondary'}
                                                                    sx={{ fontWeight: 'medium' }}
                                                                >
                                                                    {play.yardsGained > 0 ? '+' : ''}{play.yardsGained} yards
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            </Collapse>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default DriveSummary;
