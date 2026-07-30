import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import { appTheme } from './theme/theme';
import { initializeDatabase } from './db/databaseLifecycle';
import { initializeBaseDataCache } from './db/baseData';

const startApplication = async () => {
  await initializeDatabase();
  await initializeBaseDataCache();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
};

void startApplication();
