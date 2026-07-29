import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { RecruitingPageData } from '../../types/pages';

type Prospect = RecruitingPageData['prospects'][number];

interface ProspectMarketProps {
  prospects: Prospect[];
  positions: string[];
  selectedProspectId: number | null;
  boardLocked: boolean;
  busy: boolean;
  onSelect: (prospectId: number) => void;
  onAdd: (prospectId: number) => void;
}

export const ProspectMarket = ({
  prospects,
  positions,
  selectedProspectId,
  boardLocked,
  busy,
  onSelect,
  onAdd,
}: ProspectMarketProps) => {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('');
  const [stars, setStars] = useState<number | ''>('');
  const [availability, setAvailability] = useState<
    'available' | 'board' | 'committed' | ''
  >('available');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return prospects.filter(prospect => {
      const matchesQuery =
        !normalizedQuery ||
        `${prospect.first} ${prospect.last}`
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(prospect.nationalRank) === normalizedQuery;
      const matchesAvailability =
        !availability ||
        (availability === 'available' &&
          prospect.commitment === null &&
          !prospect.onUserBoard) ||
        (availability === 'board' && prospect.onUserBoard) ||
        (availability === 'committed' && prospect.commitment !== null);
      return (
        matchesQuery &&
        (!position || prospect.position === position) &&
        (!stars || prospect.stars === stars) &&
        matchesAvailability
      );
    });
  }, [availability, position, prospects, query, stars]);
  const visible = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const resetPage = () => setPage(0);

  return (
    <Paper
      component="section"
      aria-labelledby="prospect-market-title"
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography id="prospect-market-title" component="h2" variant="h6">
          Prospect Market
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Public rankings and fit for {prospects.length.toLocaleString()} prospects
        </Typography>
      </Box>
      <Stack spacing={1} sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <TextField
          size="small"
          label="Search name or rank"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            resetPage();
          }}
        />
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <InputLabel id="market-position-label">Position</InputLabel>
            <Select
              labelId="market-position-label"
              value={position}
              label="Position"
              onChange={event => {
                setPosition(event.target.value);
                resetPage();
              }}
            >
              <MenuItem value="">All</MenuItem>
              {positions.map(value => (
                <MenuItem key={value} value={value}>
                  {value.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <InputLabel id="market-stars-label">Stars</InputLabel>
            <Select
              labelId="market-stars-label"
              value={stars}
              label="Stars"
              onChange={event => {
                setStars(event.target.value as number | '');
                resetPage();
              }}
            >
              <MenuItem value="">All</MenuItem>
              {[5, 4, 3, 2, 1].map(value => (
                <MenuItem key={value} value={value}>
                  {value}★
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: 1.3, minWidth: 0 }}>
            <InputLabel id="market-status-label">Status</InputLabel>
            <Select
              labelId="market-status-label"
              value={availability}
              label="Status"
              onChange={event => {
                setAvailability(
                  event.target.value as typeof availability,
                );
                resetPage();
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="board">My Board</MenuItem>
              <MenuItem value="committed">Committed</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
      <TableContainer sx={{ flex: 1, minHeight: 220, overflow: 'auto' }}>
        <Table stickyHeader size="small" aria-label="Recruiting prospect market">
          <TableHead>
            <TableRow>
              <TableCell>Prospect</TableCell>
              <TableCell>Pos</TableCell>
              <TableCell align="right">Fit</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map(prospect => (
              <TableRow
                key={prospect.id}
                hover
                selected={selectedProspectId === prospect.id}
              >
                <TableCell>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => onSelect(prospect.id)}
                    aria-label={`View details for ${prospect.first} ${prospect.last}`}
                    sx={{
                      display: 'block',
                      minWidth: 0,
                      p: 0,
                      color: 'text.primary',
                      fontWeight: 700,
                      textAlign: 'left',
                      textTransform: 'none',
                    }}
                  >
                    #{prospect.nationalRank} {prospect.first} {prospect.last}
                  </Button>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {prospect.stars}★ · {prospect.state}
                  </Typography>
                </TableCell>
                <TableCell>{prospect.position.toUpperCase()}</TableCell>
                <TableCell align="right">{Math.round(prospect.userFit)}</TableCell>
                <TableCell align="right">
                  {prospect.onUserBoard ? (
                    <Chip size="small" label="On Board" color="primary" variant="outlined" />
                  ) : prospect.commitment ? (
                    <Chip size="small" label={prospect.commitment.teamName} variant="outlined" />
                  ) : (
                    <Button
                      size="small"
                      onClick={event => {
                        event.stopPropagation();
                        onAdd(prospect.id);
                      }}
                      disabled={boardLocked || busy || !prospect.canAdd}
                      aria-label={`Add ${prospect.first} ${prospect.last} to board`}
                    >
                      Add
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {filtered.length === 0 && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2">No prospects match these filters.</Typography>
        </Box>
      )}
      <TablePagination
        component="div"
        count={filtered.length}
        page={Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1))}
        onPageChange={(_, value) => setPage(value)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={event => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Paper>
  );
};
