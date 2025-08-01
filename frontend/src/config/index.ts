export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
};

console.log('API Base URL:', config.apiBaseUrl);