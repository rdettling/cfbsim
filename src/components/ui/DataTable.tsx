import { Box, Paper, Table, TableContainer } from '@mui/material';
import type { ReactNode } from 'react';

type DataTableProps = {
  ariaLabel: string;
  minWidth?: number;
  embedded?: boolean;
  children: ReactNode;
};

export const DataTable = ({
  ariaLabel,
  minWidth,
  embedded = false,
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
      sx={{
        height: { lg: '100%' },
        overflow: 'auto',
        ...(embedded && {
          border: 0,
          borderRadius: 0,
        }),
      }}
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
