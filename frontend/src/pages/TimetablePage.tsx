// frontend/src/pages/TimetablePage.tsx
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TimetableViewer from '../components/TimetableViewer'; // Import the viewer
import CreateTimetableModal from '../components/CreateTimetableModal'; // Import the modal form
import { Button } from '../components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { streamService, StreamDetailed } from '../services/stream.service'; // Import stream service for admin check
import { useAuth } from '../hooks/useAuth'; // Get current user

const TimetablePage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const { user } = useAuth(); // Get logged in user
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Fetch stream details to check ownership/admin status
    const { data: streamDetails, isLoading: isLoadingStream } = useQuery<StreamDetailed, Error>({
        queryKey: ['stream', streamId], // Use the same key as other pages fetching stream details
        queryFn: () => streamService.getStreamDetails(streamId!),
        enabled: !!streamId && !!user,
        staleTime: 1000 * 60 * 5,
    });

    // Determine if the current user is the admin (owner) of this stream
    const isAdmin = useMemo(() => {
        // Ensure user and streamDetails are loaded before checking
        if (!user || !streamDetails) return false;
        // Check if user is owner OR if user is in members list with role 'admin'
        return streamDetails.ownerId === user.id ||
               streamDetails.members.some(m => m.userId === user.id && m.role === 'admin');
    }, [user, streamDetails]);

    // Handle loading state for admin check
    const isLoading = isLoadingStream; // Base loading on stream details fetch

    if (!streamId) return <div className="text-center p-10 text-red-500">Invalid Stream ID provided.</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b pb-4">
                 <h1 className="text-3xl font-bold text-gray-800">Timetable Schedule</h1>
                 {/* Show Create button only if user is admin and not loading */}
                 {!isLoading && isAdmin && (
                     <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                         <Plus size={16} className="mr-1"/> Create New Timetable
                     </Button>
                 )}
                 {isLoading && ( // Show placeholder while loading admin status
                     <Button size="sm" disabled>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                     </Button>
                 )}
            </div>

            {/* Display the current weekly schedule viewer */}
            {/* Pass isAdmin status down to the viewer */}
            <TimetableViewer streamId={streamId} isAdmin={isAdmin} />

            {/* Modal for Creating Timetables (Rendered only if admin) */}
            {/* The modal itself handles its internal state and form */}
            {isAdmin && (
                <CreateTimetableModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    streamId={streamId}
                />
            )}

            {/* Optional: Historical Timetable List */}
            {/* Consider adding a separate component or section if needed */}
            {/* <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
                 <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-3">Timetable History</h2>
                 { ... list existingTimetables query results ... }
            </div> */}
        </div>
    );
};

export default TimetablePage;