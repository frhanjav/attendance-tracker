import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css' // Import Tailwind CSS base

// --- Optional: Global Error Logging ---
window.addEventListener('error', (event) => {
  console.error('Global window error:', event.error, event.message);
  // Send error to Sentry or other monitoring service
  // Sentry.captureException(event.error || new Error(event.message));
});
window.addEventListener('unhandledrejection', (event) => {
   console.error('Global unhandled rejection:', event.reason);
   // Send error to Sentry or other monitoring service
   // Sentry.captureException(event.reason);
});
// --- End Global Error Logging ---

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)