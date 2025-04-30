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
  token: string | null;
  isLoading: boolean; // Crucial for initial load/redirect logic
  login: (token: string, userData: User) => void;
  logout: () => void;
  checkAuthStatus: () => Promise<void>; // Renamed for clarity
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken')); // Initialize from localStorage
  const [isLoading, setIsLoading] = useState(true); // Start loading

  const login = useCallback((newToken: string, userData: User) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(userData);
    console.log('AuthContext: User logged in', userData);
  }, []);

  const logout = useCallback(() => {
    console.log('AuthContext: Logging out');
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    // Navigation should happen in components/router based on context change
  }, []);

  const checkAuthStatus = useCallback(async () => {
    console.log('AuthContext: Checking auth status...');
    setIsLoading(true); // Ensure loading is true at the start
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) {
        console.log('AuthContext: No token found.');
        setUser(null);
        setToken(null); // Ensure token state is also null
        setIsLoading(false);
        return;
    }

    // Ensure token state matches localStorage if it exists
    if (token !== currentToken) {
        setToken(currentToken);
    }

    try {
        // Use the apiClient which has the interceptor to add the token
        // Adjust endpoint and response structure as needed
        const response = await apiClient.get<{ status: string; data: { user: User } }>('/users/me');
        if (response.data.status === 'success' && response.data.data.user) {
            setUser(response.data.data.user);
            console.log('AuthContext: Auth check successful', response.data.data.user);
        } else {
            console.log('AuthContext: Auth check failed (API success but no user data). Logging out.');
            logout(); // Token might be invalid or user deleted
        }
    } catch (error) {
        console.error('AuthContext: Auth check API call failed:', error);
        logout(); // Clear state on error (like 401 handled by interceptor, or other errors)
    } finally {
        // CRITICAL: Always set loading to false after check completes
        console.log('AuthContext: Auth check finished.');
        setIsLoading(false);
    }
  }, [logout, token]); // Depend on logout and token

  // Run checkAuthStatus on initial mount
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    login,
    logout,
    checkAuthStatus
  }), [user, token, isLoading, login, logout, checkAuthStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};