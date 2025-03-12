import { Game, PlayerInfo } from '../interfaces';
import {
    Container,
    Typography,
    Box,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Link as MuiLink,
} from '@mui/material';

interface GamePreviewProps {
    game: Game;
    top_players: PlayerInfo[][];
}

const GamePreview = ({ game, top_players }: GamePreviewProps) => {
    return (
        <Container>
            <Typography variant="h2" align="center" gutterBottom>
                {game.label}
            </Typography>
            <Typography variant="h5" align="center" gutterBottom>
                Week {game.weekPlayed} - {game.year}
            </Typography>

            <Grid container spacing={4} sx={{ mb: 4 }}>
                {/* Team A Card */}
                <Grid item xs={5}>
                    <Paper sx={{ p: 3, height: '100%', textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                            <Box
                                component="img"
                                src={`/logos/teams/${game.teamA.name}.png`}
                                sx={{ width: 60, height: 60 }}
                                alt={game.teamA.name}
                            />
                            <Typography variant="h4" component="span">#{game.rankATOG}</Typography>
                            <Typography variant="h4">{game.teamA.name}</Typography>
                        </Box>
                        <Typography>{game.teamA.conference}</Typography>
                    </Paper>
                </Grid>

                {/* VS */}
                <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="h3">VS</Typography>
                </Grid>

                {/* Team B Card */}
                <Grid item xs={5}>
                    <Paper sx={{ p: 3, height: '100%', textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                            <Box
                                component="img"
                                src={`/logos/teams/${game.teamB.name}.png`}
                                sx={{ width: 60, height: 60 }}
                                alt={game.teamB.name}
                            />
                            <Typography variant="h4" component="span">#{game.rankBTOG}</Typography>
                            <Typography variant="h4">{game.teamB.name}</Typography>
                        </Box>
                        <Typography>{game.teamB.conference}</Typography>
                    </Paper>
                </Grid>
            </Grid>

            <Grid container spacing={4}>
                {/* Odds and Predictions */}
                <Grid item xs={4}>
                    <Paper>
                        <Typography variant="h5" align="center" sx={{ p: 2 }}>
                            Odds and Predictions
                        </Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell></TableCell>
                                        <TableCell align="center">{game.teamA.abbreviation}</TableCell>
                                        <TableCell align="center">{game.teamB.abbreviation}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>Spread</TableCell>
                                        <TableCell align="center">{game.spreadA}</TableCell>
                                        <TableCell align="center">{game.spreadB}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Moneyline</TableCell>
                                        <TableCell align="center">{game.moneylineA}</TableCell>
                                        <TableCell align="center">{game.moneylineB}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* Key Players */}
                <Grid item xs={4}>
                    <Paper>
                        <Typography variant="h5" align="center" sx={{ p: 2 }}>
                            Key Players
                        </Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell align="center">
                                            <Box
                                                component="img"
                                                src={`/logos/teams/${game.teamA.name}.png`}
                                                sx={{ width: 30, height: 30 }}
                                                alt={game.teamA.name}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box
                                                component="img"
                                                src={`/logos/teams/${game.teamB.name}.png`}
                                                sx={{ width: 30, height: 30 }}
                                                alt={game.teamB.name}
                                            />
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                {top_players[0][index] && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <MuiLink href={`/players/${top_players[0][index].id}`}>
                                                            {top_players[0][index].first} {top_players[0][index].last} ({top_players[0][index].pos})
                                                        </MuiLink>
                                                        <Typography>{top_players[0][index].rating}</Typography>
                                                    </Box>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {top_players[1][index] && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <MuiLink href={`/players/${top_players[1][index].id}`}>
                                                            {top_players[1][index].first} {top_players[1][index].last} ({top_players[1][index].pos})
                                                        </MuiLink>
                                                        <Typography>{top_players[1][index].rating}</Typography>
                                                    </Box>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* Team Stats */}
                <Grid item xs={4}>
                    <Paper>
                        <Typography variant="h5" align="center" sx={{ p: 2 }}>
                            Team Stats
                        </Typography>
                        <Box sx={{ p: 2, textAlign: 'center' }}>
                            <Typography color="text.secondary">
                                Stats will be added later
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default GamePreview;