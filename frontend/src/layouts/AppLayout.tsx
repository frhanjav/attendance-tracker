import React, { useState } from 'react'; // Import useState
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import CreateStreamModal from '../components/modals/CreateStreamModal';
import JoinStreamModal from '../components/modals/JoinStreamModal';

const AppLayout: React.FC = () => {
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isJoinModalOpen, setJoinModalOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100"> {/* Added bg color */}
            <Navbar />

            <div className="flex flex-1 overflow-hidden"> {/* Allow content to scroll */}
                {/* Sidebar */}
                <Sidebar
                    openCreateStreamModal={() => setCreateModalOpen(true)}
                    openJoinStreamModal={() => setJoinModalOpen(true)}
                />

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {/* Container to constrain content width */}
                    <div className="container mx-auto max-w-7xl">
                         <Outlet /> {/* Nested routes render here */}
                    </div>
                </main>
            </div>

            <CreateStreamModal
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                // streamId might not be needed if creating globally, adjust modal component
            />
             <JoinStreamModal
                isOpen={isJoinModalOpen}
                onClose={() => setJoinModalOpen(false)}
             />

        </div>
    );
};

export default AppLayout;