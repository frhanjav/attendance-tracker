import axios, { AxiosError } from 'axios';
import { config } from '../config';
import toast from 'react-hot-toast'; // Keep for potential global error messages

// Define a standard error shape for consistent handling
export interface ApiError {
    message: string;
    status?: number;
    code?: string;
    originalError?: any;
}

// Create Axios instance
const apiClient = axios.create({
  baseURL: config.apiBaseUrl, // e.g., http://localhost:3001/api/v1
  withCredentials: true,      // IMPORTANT: Allows browser to send cookies
  timeout: 30000,             // Increased timeout (e.g., 15 seconds)
});

// --- Enhanced Response Interceptor (Keep this) ---
apiClient.interceptors.response.use(
  (response) => {
    // Pass through successful responses (2xx status codes)
    return response;
  },
  (error: AxiosError) => {
    // Centralized Error Logging
    console.error("API Error Interceptor:", error);
    if (error.response) {
        console.error("API Error Response Data:", error.response.data);
        console.error("API Error Response Status:", error.response.status);
    } else if (error.request) {
        console.error("API Error No Response:", error.request);
    } else {
        console.error("API Error Request Setup:", error.message);
    }

    // Standardize Error Object
    const apiError: ApiError = {
        message: "An unexpected error occurred. Please try again.",
        status: error.response?.status,
        originalError: error,
    };

    // Extract user-friendly message from backend response
    if (error.response?.data && typeof error.response.data === 'object') {
        const responseData = error.response.data as { message?: string; status?: string; code?: string };
        if (responseData.message) {
            apiError.message = responseData.message;
        }
        if (responseData.code) {
            apiError.code = responseData.code;
        }
    } else if (error.code === 'ECONNABORTED') {
         apiError.message = `Request timed out after ${apiClient.defaults.timeout}ms. Please check your connection or try again later.`;
    } else if (!error.response && error.request) {
         apiError.message = "Network error: Could not connect to the server. Please check your connection.";
    } else if (error.message) {
        apiError.message = error.message; // Fallback (e.g., setup errors)
    }

    // Handle Specific Status Codes
    if (apiError.status === 401) {
        // Unauthorized
        console.error('API Interceptor: Unauthorized (401).');
        
        // --- MODIFIED LOGIC ---
        // Instead of immediately redirecting, we just reject with the error.
        // The AuthContext's checkAuthStatus catch block will handle setting user to null.
        // ProtectedRoute/PublicOnlyRoute components will then handle redirection based on the user state
        // for the specific page being accessed.
        // This prevents the interceptor from forcing a redirect to /login when maybe
        // the user was trying to reach the public /landing page.

        // Optional: Clear local storage just in case, though not strictly needed for HttpOnly cookies
        // localStorage.removeItem('authToken');

        // We still reject the promise so the calling code (e.g., checkAuthStatus) knows it failed.
        // The calling code (or components reacting to auth state) should handle UI changes/redirects.
        return Promise.reject(apiError);
        // --- END MODIFICATION ---

    } else if (apiError.status === 403) {
        // Forbidden
        toast.error("Permission Denied.", { id: 'forbidden-error' });
        apiError.message = "You do not have permission to perform this action.";
    } else if (apiError.status === 500) {
        // Internal Server Error
        toast.error("Server error. Please try again later.", { id: 'server-error' });
        apiError.message = "A server error occurred. Please try again later.";
    }
    // Add other status code handling (404, 429, etc.) if desired

    // Reject with the standardized ApiError object
    return Promise.reject(apiError);
  }
);

export default apiClient;