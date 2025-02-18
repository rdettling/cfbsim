import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import axios from 'axios'

axios.defaults.withCredentials = true;  // Add this line

// Add client ID to all requests
axios.interceptors.request.use(config => {
    let userId = localStorage.getItem('user_id');
    
    if (!userId) {
        // Will be set by first response
        config.headers['X-User-ID'] = '';
    } else {
        config.headers['X-User-ID'] = userId;
    }
    
    return config;
});

// Store client ID from response if present
axios.interceptors.response.use(response => {
    if (response.data.replace) {
        localStorage.setItem('user_id', response.data.user_id);
    }
    return response;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
