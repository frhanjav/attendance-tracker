import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar'; // Import the unified Navbar

const AppLayout: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col bg-gray-100"> {/* Added bg color */}
            <Navbar /> {/* Use the unified Navbar */}

            {/* Main Content Area - Added container and padding */}
            <main className="flex-grow container mx-auto px-4 py-8"> {/* Added padding */}
                <Outlet /> {/* Nested routes will render here */}
            </main>

            {/* Footer (Optional but recommended for consistency) */}
            <footer className="bg-gray-200 text-center py-4 text-sm text-gray-600 mt-auto"> {/* Added mt-auto */}
                © {new Date().getFullYear()} TimeTable
            </footer>
        </div>
    );
};

export default AppLayout;