import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import axios from 'axios'

axios.defaults.withCredentials = true;  // Add this line

// Add client ID to all requests
axios.interceptors.request.use(config => {
    let clientId = localStorage.getItem('clientId');
    
    if (!clientId) {
        // Will be set by first response
        config.headers['X-Client-ID'] = '';
    } else {
        config.headers['X-Client-ID'] = clientId;
    }
    
    return config;
});

// Store client ID from response if present
axios.interceptors.response.use(response => {
    if (response.data.client_id) {
        localStorage.setItem('clientId', response.data.client_id);
    }
    return response;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
