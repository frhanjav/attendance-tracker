import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { streamService } from '../services/stream.service'; // Assuming streamService exists
import { Link } from 'react-router-dom';
import { Plus, LogIn } from 'lucide-react'; // Icons
import { Button } from '../components/ui/button';

// Basic Modal Component (Placeholder - use a library like Headless UI or Radix for production)
const Modal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        ×
                    </button>
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isJoinModalOpen, setJoinModalOpen] = useState(false);
    const [createStreamName, setCreateStreamName] = useState('');
    const [joinStreamCode, setJoinStreamCode] = useState('');

    // Fetch user's streams
    const {
        data: streams,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['myStreams'], // Unique key for this query
        queryFn: streamService.getMyStreams, // Function from stream.service.ts
    });

    // Mutation for creating a stream
    const createMutation = useMutation({
        mutationFn: streamService.createStream,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myStreams'] }); // Refetch streams list
            setCreateModalOpen(false); // Close modal
            setCreateStreamName(''); // Reset form
            // TODO: Add success notification
        },
        onError: (err) => {
            console.error('Create stream error:', err);
            // TODO: Show error in modal
            alert(`Error creating stream: ${err.message}`);
        },
    });

    // Mutation for joining a stream
    const joinMutation = useMutation({
        mutationFn: streamService.joinStream,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myStreams'] }); // Refetch streams list
            setJoinModalOpen(false); // Close modal
            setJoinStreamCode(''); // Reset form
            // TODO: Add success notification
        },
        onError: (err) => {
            console.error('Join stream error:', err);
            // TODO: Show error in modal
            alert(`Error joining stream: ${err.message}`);
        },
    });

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!createStreamName.trim()) return;
        createMutation.mutate({ name: createStreamName.trim() });
    };

    const handleJoinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinStreamCode.trim()) return;
        joinMutation.mutate({ streamCode: joinStreamCode.trim() });
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

            <div className="mb-6 flex space-x-4">
                <Button
                    onClick={() => setCreateModalOpen(true)}
                    className="inline-flex items-center bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium shadow"
                >
                    <Plus size={18} className="mr-1" /> Create Stream
                </Button>
                <Button
                    onClick={() => setJoinModalOpen(true)}
                    className="inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium shadow"
                >
                    <LogIn size={18} className="mr-1" /> Join Stream
                </Button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">My Streams</h2>
                {isLoading && <p className="text-gray-500">Loading streams...</p>}
                {error && <p className="text-red-500">Error loading streams: {error.message}</p>}
                {!isLoading && !error && streams && streams.length > 0 ? (
                    <ul className="space-y-3">
                        {streams.map((stream) => (
                            <li key={stream.id} className="border p-3 rounded hover:bg-gray-50">
                                <Link
                                    to={`/streams/${stream.id}`}
                                    className="text-blue-700 hover:underline font-medium block"
                                >
                                    {stream.name}
                                </Link>
                                <span className="text-xs text-gray-500 block mt-1">
                                    Code: {stream.streamCode}
                                </span>
                                {/* Add more details or actions per stream if needed */}
                            </li>
                        ))}
                    </ul>
                ) : null}
                {!isLoading && !error && (!streams || streams.length === 0) && (
                    <p className="text-gray-500 text-center py-4">
                        You haven't joined or created any streams yet. Use the buttons above to
                        start!
                    </p>
                )}
            </div>

            {/* Create Stream Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                title="Create New Stream"
            >
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="streamName"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Stream Name
                        </label>
                        <input
                            id="streamName"
                            type="text"
                            value={createStreamName}
                            onChange={(e) => setCreateStreamName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., B.Tech CSE Sem 4"
                            required
                            disabled={createMutation.isPending}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Join Stream Modal */}
            <Modal
                isOpen={isJoinModalOpen}
                onClose={() => setJoinModalOpen(false)}
                title="Join Existing Stream"
            >
                <form onSubmit={handleJoinSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="streamCode"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Stream Code
                        </label>
                        <input
                            id="streamCode"
                            type="text"
                            value={joinStreamCode}
                            onChange={(e) => setJoinStreamCode(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter the code shared by the admin"
                            required
                            disabled={joinMutation.isPending}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                            disabled={joinMutation.isPending}
                        >
                            {joinMutation.isPending ? 'Joining...' : 'Join'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DashboardPage;
