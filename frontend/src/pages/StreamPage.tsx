import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { streamService } from '../services/stream.service'; // Assuming service exists
import { Users, Clock, BarChart3, Settings } from 'lucide-react'; // Icons

const StreamPage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    // TODO: Add check if streamId is missing

    const { data: streamData, isLoading, error } = useQuery({
        queryKey: ['stream', streamId], // Query key includes streamId
        queryFn: () => streamService.getStreamDetails(streamId!), // Fetch details for this stream
        enabled: !!streamId, // Only run query if streamId exists
    });

    if (isLoading) return <div className="text-center p-10">Loading stream details...</div>;
    // TODO: Handle error state more gracefully (e.g., check for 403/404)
    if (error) return <div className="text-center p-10 text-red-500">Error loading stream: {error.message}</div>;
    if (!streamData) return <div className="text-center p-10">Stream not found.</div>; // Handle case where data is null/undefined

    const stream = streamData; // Assuming streamData is the detailed stream object

    // TODO: Check if current user is admin based on streamData.ownerId or members list
    const isAdmin = false; // Placeholder

    return (
        <div>
            <h1 className="text-3xl font-bold mb-2">{stream.name}</h1>
            <p className="text-sm text-gray-500 mb-6">Stream Code: <span className="font-mono bg-gray-200 px-1 rounded">{stream.streamCode}</span> (Share this with members)</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Link Cards */}
                <Link to={`/streams/${streamId}/timetable`} className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <Clock className="w-8 h-8 text-indigo-500 mb-2" />
                    <h2 className="text-xl font-semibold mb-1">Timetables</h2>
                    <p className="text-sm text-gray-600">View and manage weekly schedules.</p>
                </Link>
                 <Link to={`/streams/${streamId}/attendance`} className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <Users className="w-8 h-8 text-emerald-500 mb-2" />
                    <h2 className="text-xl font-semibold mb-1">Attendance</h2>
                    <p className="text-sm text-gray-600">Track daily status and bulk entry.</p>
                </Link>
                 <Link to={`/streams/${streamId}/analytics`} className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <BarChart3 className="w-8 h-8 text-amber-500 mb-2" />
                    <h2 className="text-xl font-semibold mb-1">Analytics</h2>
                    <p className="text-sm text-gray-600">View stats and calculate projections.</p>
                </Link>
            </div>

            {/* <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4">Stream Details</h2>
                <p><strong>Owner:</strong> {stream.owner.name} ({stream.owner.email})</p>
            </div> */}

             <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4">Members ({stream.members.length})</h2>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {stream.members.map(member => (
                        <li key={member.userId} className="flex justify-between items-center text-sm border-b pb-1">
                            <span>{member.user.name || member.user.email}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${member.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                {member.role}
                            </span>
                        </li>
                    ))}
                </ul>
                 {isAdmin && (
                     <button className="mt-4 inline-flex items-center bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded text-xs">
                         <Settings size={14} className="mr-1" /> Manage Members
                     </button>
                 )}
            </div>

             {/* Add Admin actions section if user is admin */}
             {isAdmin && (
                 <div className="bg-white p-6 rounded-lg shadow border border-red-200">
                     <h2 className="text-xl font-semibold mb-4 text-red-700">Admin Actions</h2>
                     {/* Placeholder for Edit Stream, Delete Stream etc */}
                     <p className="text-gray-500">[Admin controls placeholder]</p>
                 </div>
             )}
        </div>
    );
};

export default StreamPage;