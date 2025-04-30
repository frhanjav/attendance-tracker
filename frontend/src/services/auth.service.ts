import apiClient from '../lib/apiClient';
import { User } from '../contexts/AuthContext'; // Or import from backend DTOs

// Define input types (can import from backend DTOs if setup allows)
interface LoginInput {
    email: string;
    password: string;
}

interface SignupInput extends LoginInput {
    name?: string;
}

// Define API response structure (adjust based on your backend)
interface AuthResponse {
    status: string;
    data: {
        token: string;
        user: User;
    };
    // Add 'message' if your backend sends error messages in the data field
    message?: string;
}


export const authService = {
    login: async (credentials: LoginInput): Promise<AuthResponse['data']> => {
        try {
            const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
            return response.data.data; // Return token and user
        } catch (error: any) {
             // Rethrow the error message from the interceptor or backend
            throw new Error(error.message || 'Login failed');
        }
    },

    signup: async (data: SignupInput): Promise<AuthResponse['data']> => {
         try {
            const response = await apiClient.post<AuthResponse>('/auth/signup', data);
            return response.data.data;
        } catch (error: any) {
            throw new Error(error.message || 'Signup failed');
        }
    },

    // Example: Fetch current user (used in AuthContext)
    // getMe: async (): Promise<User> => {
    //     try {
    //         const response = await apiClient.get<{ status: string; data: { user: User } }>('/users/me');
    //         if (response.data.status === 'success' && response.data.data.user) {
    //             return response.data.data.user;
    //         } else {
    //             throw new Error(response.data.message || 'Failed to fetch user profile');
    //         }
    //     } catch (error: any) {
    //          throw new Error(error.message || 'Failed to fetch user profile');
    //     }
    // }
};