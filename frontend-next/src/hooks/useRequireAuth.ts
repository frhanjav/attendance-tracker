import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

export const useRequireAuth = (redirectTo = '/landing') => {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push(redirectTo);
        }
    }, [user, isLoading, router, redirectTo]);

    return { isLoading, user };
};
