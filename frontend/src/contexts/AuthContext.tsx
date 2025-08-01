import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../lib/apiClient';

export interface User {
    id: string;
    email: string;
    name: string | null;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (userData: User) => void;
    logout: () => Promise<void>;
    checkAuthStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const login = useCallback((userData: User) => {
        setUser(userData);
        console.log('AuthContext: User set after successful auth check/login', userData);
    }, []);

    const logout = useCallback(async () => {
        localStorage.removeItem('authToken');
        setUser(null);

        try {
            await apiClient.post('/auth/logout');
            console.log('AuthContext: Logout API call successful');
        } catch (error) {
            console.error('AuthContext: Logout API call failed:', error);
        }

    }, []);

    const checkAuthStatus = useCallback(async () => {
        setIsLoading(true); 

        try {
            const response = await apiClient.get<{ status: string; data: { user: User } }>(
                '/users/me',
            );
            if (response.data.status === 'success' && response.data.data.user) {
                login(response.data.data.user);
            } else {
                setUser(null);
            }
        } catch (error: any) {
            console.error('AuthContext: Auth check API call failed:', error.message);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, [login]);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    const value = useMemo(
        () => ({
            user,
            isLoading,
            login,
            logout,
            checkAuthStatus,
        }),
        [user, isLoading, login, logout, checkAuthStatus],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
