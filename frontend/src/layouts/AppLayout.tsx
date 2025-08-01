import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import CreateStreamModal from '../components/modals/CreateStreamModal';
import JoinStreamModal from '../components/modals/JoinStreamModal';
import useUIStore from '../stores/uiStore';

const AppLayout: React.FC = () => {
    const isCreateModalOpen = useUIStore((state) => state.isCreateStreamModalOpen);
    const closeCreateStreamModal = useUIStore((state) => state.closeCreateStreamModal);
    const isJoinModalOpen = useUIStore((state) => state.isJoinStreamModalOpen);
    const closeJoinStreamModal = useUIStore((state) => state.closeJoinStreamModal);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <Navbar />
            <div className="flex flex-1 overflow-hidden">

                {/* Sidebar */}
                <div className="hidden md:flex md:flex-shrink-0"><Sidebar /></div>
                
                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="container mx-auto max-w-7xl">
                         <Outlet />
                    </div>
                </main>
            </div>

            <CreateStreamModal
                isOpen={isCreateModalOpen}
                onClose={closeCreateStreamModal}
            />
             <JoinStreamModal
                isOpen={isJoinModalOpen}
                onClose={closeJoinStreamModal}
             />

        </div>
    );
};

export default AppLayout;