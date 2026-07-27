import { Box, Paper, Table, TableContainer } from '@mui/material';
import type { ReactNode } from 'react';

type DataTableProps = {
  ariaLabel: string;
  minWidth?: number;
  children: ReactNode;
};

export const DataTable = ({
  ariaLabel,
  minWidth,
  children,
}: DataTableProps) => (
  <Box
    sx={{
      display: { xs: 'none', md: 'block' },
      flex: { lg: 1 },
      minHeight: { lg: 0 },
    }}
  >
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ height: { lg: '100%' }, overflow: 'auto' }}
    >
      <Table
        stickyHeader
        size="small"
        aria-label={ariaLabel}
        sx={minWidth ? { minWidth } : undefined}
      >
        {children}
      </Table>
    </TableContainer>
  </Box>
);
