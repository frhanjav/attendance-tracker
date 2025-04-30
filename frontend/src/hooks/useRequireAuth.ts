import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export const useRequireAuth = (redirectTo = '/login') => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect once loading is complete and user is confirmed null
    if (!isLoading && !user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, navigate, redirectTo]);

  // Optionally return loading state or user if needed by the component
  return { isLoading, user };
};