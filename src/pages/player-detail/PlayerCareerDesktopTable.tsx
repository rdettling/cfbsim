import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { DataTable } from '../../components/ui/DataTable';
import type { PlayerCareerSeason, PlayerStatCategory } from '../../types/player';
import { formatPlayerStat, getCareerColumns } from './config';

type PlayerCareerDesktopTableProps = {
  seasons: Array<{ year: number; season: PlayerCareerSeason }>;
  category: PlayerStatCategory;
};

const yearCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  width: 90,
  minWidth: 90,
  bgcolor: 'background.paper',
};

const classCellSx = {
  position: 'sticky',
  left: 90,
  zIndex: 2,
  width: 110,
  minWidth: 110,
  bgcolor: 'background.paper',
};

const ratingCellSx = {
  position: 'sticky',
  left: 200,
  zIndex: 2,
  width: 90,
  minWidth: 90,
  bgcolor: 'background.paper',
};

export const PlayerCareerDesktopTable = ({
  seasons,
  category,
}: PlayerCareerDesktopTableProps) => {
  const columns = getCareerColumns(category);

  return (
    <DataTable ariaLabel="Career statistics" minWidth={760 + columns.length * 36}>
      <TableHead>
        <TableRow sx={{ bgcolor: 'background.default' }}>
          <TableCell sx={{ ...yearCellSx, zIndex: 4, bgcolor: 'background.default' }}>Year</TableCell>
          <TableCell sx={{ ...classCellSx, zIndex: 4, bgcolor: 'background.default' }}>Class</TableCell>
          <TableCell align="right" sx={{ ...ratingCellSx, zIndex: 4, bgcolor: 'background.default' }}>Rating</TableCell>
          <TableCell align="right" sx={{ width: 80 }}>Games</TableCell>
          {columns.map(column => (
            <TableCell key={column.key} align="right" sx={{ minWidth: 84, whiteSpace: 'nowrap' }}>
              {column.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {seasons.map(({ year, season }) => (
          <TableRow key={year} hover>
            <TableCell sx={{ ...yearCellSx, fontWeight: 600 }}>{year}</TableCell>
            <TableCell sx={{ ...classCellSx, textTransform: 'uppercase' }}>{season.classYear}</TableCell>
            <TableCell align="right" sx={{ ...ratingCellSx, fontWeight: 600 }}>{season.rating}</TableCell>
            <TableCell align="right">{season.games}</TableCell>
            {columns.map(column => (
              <TableCell key={column.key} align="right">
                {formatPlayerStat(season.stats, column)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </DataTable>
  );
};
