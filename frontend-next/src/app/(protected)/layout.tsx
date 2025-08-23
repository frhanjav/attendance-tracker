'use client';

import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/layouts/AppLayout';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const dynamic = 'force-dynamic';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
);

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/landing');
        }
    }, [user, isLoading, router]);

    if (isLoading) return <LoadingSpinner />;
    if (!user) return null;

    return <AppLayout>{children}</AppLayout>;
}
