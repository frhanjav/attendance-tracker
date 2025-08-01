import {
    createBrowserRouter,
    RouterProvider,
    Outlet,
    Navigate,
    useLocation,
} from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import DashboardPage from '../pages/DashboardPage';
import StreamPage from '../pages/StreamPage';
import TimetablePage from '../pages/TimetablePage';
import AttendancePage from '../pages/AttendancePage';
import AnalyticsPage from '../pages/AnalyticsPage';
import NotFoundPage from '../pages/NotFoundPage';
import AppLayout from '../layouts/AppLayout';
import { useAuth } from '../hooks/useAuth';
import React from 'react';
import ErrorBoundary from '../components/ErrorBoundary';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) return <LoadingSpinner />;
    if (!user) {
        return <Navigate to="/landing" state={{ from: location }} replace />;
    }
    return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isLoading } = useAuth();
    if (isLoading) return <LoadingSpinner />;
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
};

const router = createBrowserRouter([
    {
        path: '/',
        element: <Root />,
        errorElement: <ErrorBoundary />,
        children: [
            {
                element: (
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                ),
                children: [
                    { path: 'dashboard', element: <DashboardPage /> },
                    { path: 'streams/:streamId', element: <StreamPage /> },
                    { path: 'streams/:streamId/timetable', element: <TimetablePage /> },
                    { path: 'streams/:streamId/attendance', element: <AttendancePage /> },
                    { path: 'streams/:streamId/analytics', element: <AnalyticsPage /> },
                ],
            },
            {
                path: 'landing',
                element: (
                    <PublicOnlyRoute>
                        <LandingPage />
                    </PublicOnlyRoute>
                ),
            },
        ],
    },
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);

function Root() {
    const { user, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading) return <LoadingSpinner />;
    if (location.pathname === '/') {
        return <Navigate replace to={user ? '/dashboard' : '/landing'} />;
    }
    return <Outlet />;
}

export const AppRouter = () => <RouterProvider router={router} />;
