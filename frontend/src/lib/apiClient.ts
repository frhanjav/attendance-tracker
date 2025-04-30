import axios from 'axios';
import { config } from '../config';

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true, // Important for cookies if used, otherwise optional
});

// Request Interceptor (add auth token)
apiClient.interceptors.request.use(
  (axiosConfig) => {
    const token = localStorage.getItem('authToken');
    if (token && axiosConfig.headers) {
      axiosConfig.headers.Authorization = `Bearer ${token}`;
    }
    return axiosConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor (handle 401 errors)
apiClient.interceptors.response.use(
  (response) => {
    return response; // Pass through successful responses
  },
  (error) => {
    if (error.response?.status === 401) {
      console.error('API Client: Unauthorized access (401). Logging out.');
      // Clear token and redirect to login
      // Avoid calling useAuth hook here (hooks only in components/hooks)
      localStorage.removeItem('authToken');
      // Force redirect - consider a more integrated approach with router context if possible
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
    }
    // Reject with the error response data or a generic message
    return Promise.reject(error.response?.data || error.message || 'An unknown API error occurred');
  }
);

export default apiClient;