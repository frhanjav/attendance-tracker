import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../lib/apiClient';
// Define User type - can import from backend DTOs if setup allows, or redefine here
// Example type (adjust based on your actual UserOutput DTO)
export interface User {
    id: string;
    email: string;
    name: string | null;
    // Add other relevant fields
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean; // Crucial for initial load/redirect logic
    login: (userData: User) => void;
    logout: () => Promise<void>; // Keep async if calling API
    checkAuthStatus: () => Promise<void>; // Renamed for clarity
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    // const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken')); // Initialize from localStorage
    const [isLoading, setIsLoading] = useState(true); // Start loading

    const login = useCallback((userData: User) => {
        setUser(userData);
        console.log('AuthContext: User set after successful auth check/login', userData);
    }, []);

    const logout = useCallback(async () => {
        // Make logout async if calling API
        console.log('AuthContext: Logging out');
        // Remove token from localStorage if it was ever stored there (cleanup)
        localStorage.removeItem('authToken');
        // setToken(null); // Remove token state update
        setUser(null);

        // --- Optional: Call backend logout endpoint to clear cookie ---
        try {
            // Assume you create a POST /api/v1/auth/logout endpoint on backend
            // that clears the 'authToken' cookie
            await apiClient.post('/auth/logout');
            console.log('AuthContext: Logout API call successful');
        } catch (error) {
            console.error('AuthContext: Logout API call failed:', error);
            // Proceed with frontend logout anyway
        }
        // --- End Optional Backend Logout ---

        // Navigation should happen in components/router based on context change
        // Or force redirect if needed: window.location.href = '/login';
    }, []);

    const checkAuthStatus = useCallback(async () => {
        console.log('AuthContext: Checking auth status via /users/me...');
        setIsLoading(true); // Ensure loading is true at the start

        try {
            // Use the apiClient which has the interceptor to add the token
            // Adjust endpoint and response structure as needed
            const response = await apiClient.get<{ status: string; data: { user: User } }>(
                '/users/me',
            );
            if (response.data.status === 'success' && response.data.data.user) {
                // Call the corrected login function just to set the user state
                login(response.data.data.user);
                // console.log('AuthContext: Auth check successful via API', response.data.data.user); // Log is inside login now
            } else {
                // This case might not be hit if API returns 401, which is caught below
                console.log('AuthContext: Auth check failed (API success but no user data).');
                setUser(null);
            }
        } catch (error: any) {
            // The apiClient interceptor should handle 401 by redirecting.
            // If any other error occurs (e.g., network error, 500), treat as logged out.
            console.error('AuthContext: Auth check API call failed:', error.message);
            setUser(null); // Clear user state on any error during check
        } finally {
            // CRITICAL: Always set loading to false after check completes
            console.log('AuthContext: Auth check finished.');
            setIsLoading(false);
        }
          // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [login]);

    // Run checkAuthStatus on initial mount
    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]); // checkAuthStatus is memoized by useCallback

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
