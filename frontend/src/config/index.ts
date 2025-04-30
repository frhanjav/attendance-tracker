export const config = {
  // Use import.meta.env for Vite environment variables
  // VITE_API_BASE_URL should be set in your .env file (e.g., VITE_API_BASE_URL=http://localhost:3001/api/v1)
  // Or VITE_API_BASE_URL=/api/v1 if using proxy/ingress
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
};

console.log('API Base URL:', config.apiBaseUrl); // Log for debugging