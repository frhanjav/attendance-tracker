import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
            <div className="w-full max-w-md">
                <div className="bg-white p-8 rounded-lg shadow-lg">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;