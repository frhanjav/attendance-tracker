import axios, { AxiosError } from 'axios';
import { config } from '../config';
import toast from 'react-hot-toast';

export interface ApiError {
    message: string;
    status?: number;
    code?: string;
    originalError?: any;
}

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
  timeout: 15000,
});

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    console.error("API Error Interceptor:", error);
    if (error.response) {
        console.error("API Error Response Data:", error.response.data);
        console.error("API Error Response Status:", error.response.status);
    } else if (error.request) {
        console.error("API Error No Response:", error.request);
    } else {
        console.error("API Error Request Setup:", error.message);
    }

    const apiError: ApiError = {
        message: "An unexpected error occurred. Please try again.",
        status: error.response?.status,
        originalError: error,
    };

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
        apiError.message = error.message;
    }

    if (apiError.status === 401) {
        console.error('API Interceptor: Unauthorized (401).');
        return Promise.reject(apiError);

    } else if (apiError.status === 403) {
        toast.error("Permission Denied.", { id: 'forbidden-error' });
        apiError.message = "You do not have permission to perform this action.";
    } else if (apiError.status === 500) {
        toast.error("Server error. Please try again later.", { id: 'server-error' });
        apiError.message = "A server error occurred. Please try again later.";
    }
    
    return Promise.reject(apiError);
  }
);

export default apiClient;