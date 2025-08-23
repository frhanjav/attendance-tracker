import apiClient from '../lib/apiClient';
import { User } from '../contexts/AuthContext';

interface LoginInput {
    email: string;
    password: string;
}

interface SignupInput extends LoginInput {
    name?: string;
}

interface AuthResponse {
    status: string;
    data: {
        token: string;
        user: User;
    };
    message?: string;
}


export const authService = {
    login: async (credentials: LoginInput): Promise<AuthResponse['data']> => {
        try {
            const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
            return response.data.data;
        } catch (error: any) {
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
};