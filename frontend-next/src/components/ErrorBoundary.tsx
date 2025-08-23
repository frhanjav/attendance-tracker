'use client';

import Link from 'next/link';
import React from 'react';
import { Button } from '../components/ui/button';

interface ErrorBoundaryProps {
    error?: Error;
    errorMessage?: string;
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({
    error,
    errorMessage = 'An unknown error occurred during rendering.',
}) => {
    console.error('Routing/Rendering Error Boundary Caught:', error);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-red-50">
            <h1 className="text-4xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h1>
            <p className="text-lg text-gray-700 mb-6 max-w-md">
                {errorMessage || 'Sorry, an unexpected error has occurred.'}
            </p>
            {error && (
                <pre className="text-xs text-left bg-red-100 p-4 rounded overflow-auto max-w-xl mb-6 border border-red-200">
                    {error.stack}
                </pre>
            )}
            <Button asChild>
                <Link href="/">Go Back Home</Link>
            </Button>
        </div>
    );
};

export default ErrorBoundary;
