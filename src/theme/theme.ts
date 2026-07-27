import { createTheme } from '@mui/material/styles';

const colors = {
  primary: '#285f7f',
  background: '#f4f6f8',
  paper: '#ffffff',
  textPrimary: '#17212b',
  textSecondary: '#5c6975',
  divider: '#d8dee4',
  success: '#2f6f4e',
  error: '#a33a3a',
  warning: '#8a5a18',
} as const;

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary,
    },
    secondary: {
      main: colors.textSecondary,
    },
    background: {
      default: colors.background,
      paper: colors.paper,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
    divider: colors.divider,
    success: {
      main: colors.success,
    },
    error: {
      main: colors.error,
    },
    warning: {
      main: colors.warning,
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"IBM Plex Sans", Arial, sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    allVariants: {
      fontVariantNumeric: 'tabular-nums',
    },
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          minHeight: '100%',
        },
        body: {
          minHeight: '100%',
          backgroundColor: colors.background,
          color: colors.textPrimary,
          fontVariantNumeric: 'tabular-nums',
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: colors.divider,
        },
        head: {
          fontWeight: 600,
        },
      },
    },
  },
});
