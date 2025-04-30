import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Button } from '../components/ui/button'; // Use your button

const ErrorBoundary: React.FC = () => {
  // useRouteError provides the error that was thrown
  const error = useRouteError();
  let errorMessage: string;
  let errorStatus: number | undefined;

  console.error("Routing/Rendering Error Boundary Caught:", error); // Log the full error

  if (isRouteErrorResponse(error)) {
    // Error has status code and data (e.g., from loaders/actions)
    errorMessage = error.data?.message || error.statusText;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = 'An unknown error occurred during rendering.';
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-red-50">
      <h1 className="text-4xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h1>
       {errorStatus && <p className="text-xl text-red-500 mb-2">Error {errorStatus}</p>}
      <p className="text-lg text-gray-700 mb-6 max-w-md">
        {errorMessage || "Sorry, an unexpected error has occurred."}
      </p>
      <pre className="text-xs text-left bg-red-100 p-4 rounded overflow-auto max-w-xl mb-6 border border-red-200">
        {/* Displaying stack might be too much for users, good for dev */}
        {error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
      </pre>
      <Button asChild>
        <Link to="/">Go Back Home</Link>
      </Button>
    </div>
  );
};

export default ErrorBoundary;