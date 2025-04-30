import { createBrowserRouter, RouterProvider, Outlet, Navigate, useLocation } from 'react-router-dom';
import LandingPage from '../pages/LandingPage'; // Import LandingPage
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import DashboardPage from '../pages/DashboardPage';
import StreamPage from '../pages/StreamPage';
import TimetablePage from '../pages/TimetablePage';
import TimetableDetailPage from '../pages/TimetableDetailPage'; // Import the new page component
import AttendancePage from '../pages/AttendancePage';
import AnalyticsPage from '../pages/AnalyticsPage'; // Add AnalyticsPage
import NotFoundPage from '../pages/NotFoundPage';
import AppLayout from '../layouts/AppLayout';
import AuthLayout from '../layouts/AuthLayout';
// Landing page might not need a full layout, or use a specific one
// import LandingLayout from '../layouts/LandingLayout';
import { useAuth } from '../hooks/useAuth';
import React from 'react';
import ErrorBoundary from '../components/ErrorBoundary'; // Import the boundary

// Loading Spinner Component (Placeholder)
const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
);

// Component to protect routes
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (!user) {
        // Redirect to login, saving the intended location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>; // Render protected content
};

// Component for public routes (login/signup) that redirects if already logged in
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isLoading } = useAuth();

     if (isLoading) {
        return <LoadingSpinner />;
    }

    if (user) {
        // User is logged in, redirect away from login/signup
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>; // Render login/signup page
};

// Define the router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />, // Use Root to handle initial load and routing decisions
    errorElement: <ErrorBoundary />, // Catches errors in Root or its direct children if they don't have their own boundary
    children: [
        {
            // Authenticated routes use AppLayout
            element: (
                <ProtectedRoute>
                    <AppLayout />
                </ProtectedRoute>
            ),
            // You could add errorElement here too for errors specific to AppLayout or its children
            // errorElement: <ErrorBoundary />,
            children: [
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'streams/:streamId', element: <StreamPage /> },
              { path: 'streams/:streamId/timetable', element: <TimetablePage /> },
              { path: 'streams/:streamId/timetables/:timetableId', element: <TimetableDetailPage /> },
              { path: 'streams/:streamId/attendance', element: <AttendancePage /> },
              { path: 'streams/:streamId/analytics', element: <AnalyticsPage /> }, // Add analytics route
              // Add other authenticated routes here
            ],
        },
        {
            // Auth routes (Login, Signup) use AuthLayout and PublicOnlyRoute wrapper
             element: (
                <PublicOnlyRoute>
                    <AuthLayout />
                </PublicOnlyRoute>
            ),
             children: [
                { path: 'login', element: <LoginPage /> },
                { path: 'signup', element: <SignupPage /> },
            ]
        },
        {
            // Landing Page Route - accessible only when logged out
            path: 'landing', // Use a specific path like /landing
            element: (
                <PublicOnlyRoute>
                    {/* Landing page might have its own Navbar, so no specific layout */}
                    <LandingPage />
                    {/* <Index /> */}
                </PublicOnlyRoute>
            )
        }
    ]
  },
  {
    // Catch-all Not Found Route
    path: '*',
    element: <NotFoundPage />,
  },
]);

// Root component to handle the initial redirect logic for '/'
function Root() {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <LoadingSpinner />;
    }

    // If user lands on exactly '/', redirect based on auth state
    if (location.pathname === '/') {
        return <Navigate replace to={user ? '/dashboard' : '/landing'} />;
    }

    // For all other paths defined in children, Outlet renders the appropriate element
    // The wrappers (ProtectedRoute/PublicOnlyRoute) handle further logic
    return <Outlet />;
}

export const AppRouter = () => <RouterProvider router={router} />;