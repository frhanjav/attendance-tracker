import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-6xl font-bold text-red-500 mb-4">404</h1>
            <h2 className="text-2xl font-semibold mb-3">Page Not Found</h2>
            <p className="text-gray-600 mb-6">
                Sorry, the page you are looking for does not exist or has been moved.
            </p>
            <Link
                to="/dashboard" // Link back to dashboard (or login if not authenticated)
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
                Go Back Home
            </Link>
        </div>
    );
};

export default NotFoundPage;