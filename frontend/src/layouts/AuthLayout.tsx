import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
            <div className="w-full max-w-md">
                 {/* Optional: Add a logo or title above the form */}
                 {/* <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">TimeTable</h1> */}
                <div className="bg-white p-8 rounded-lg shadow-lg">
                    <Outlet /> {/* Login or Signup form will render here */}
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;