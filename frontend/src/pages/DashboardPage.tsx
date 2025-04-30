import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { streamService } from '../services/stream.service'; // Assuming streamService exists
import { Link } from 'react-router-dom';
import { Plus, LogIn, ArrowRight, Users, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '../components/ui/card';

const DashboardPage: React.FC = () => {
    // Fetch user's streams
    const {
        data: streams,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['myStreams'],
        queryFn: streamService.getMyStreams,
        staleTime: 1000 * 60 * 10,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            </div>

            {/* Stream Cards Grid */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">My Streams</h2>
                {isLoading && (
                    <div className="text-center py-10 text-gray-500 flex justify-center items-center">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading streams...
                    </div>
                )}
                {error && (
                    <p className="text-center text-red-500 py-10">
                        Error loading streams: {error.message}
                    </p>
                )}

                {!isLoading && !error && streams && streams.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {streams.map((stream) => (
                            <Card
                                key={stream.id}
                                className="shadow-md hover:shadow-lg transition-shadow flex flex-col"
                            >
                                <CardHeader className="pb-4">
                                    {/* TODO: Add placeholder image/icon? */}
                                    <CardTitle className="text-lg truncate" title={stream.name}>
                                        <Link
                                            to={`/streams/${stream.id}`}
                                            className="hover:text-blue-700"
                                        >
                                            {stream.name}
                                        </Link>
                                    </CardTitle>
                                    <CardDescription className="text-xs pt-1">
                                        Code:{' '}
                                        <span className="font-mono bg-gray-100 px-1 rounded">
                                            {stream.streamCode}
                                        </span>
                                        {/* TODO: Fetch member count or owner info if needed */}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    {/* Placeholder for quick info like member count or next class */}
                                    <p className="text-sm text-gray-500 italic">
                                        Quick info placeholder...
                                    </p>
                                </CardContent>
                                <CardFooter>
                                    <Button variant="outline" size="sm" className="w-full" asChild>
                                        <Link to={`/streams/${stream.id}`}>
                                            Open Stream <ArrowRight size={14} className="ml-1" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : null}

                {!isLoading && !error && (!streams || streams.length === 0) && (
                    <div className="text-center py-16 px-6 bg-white rounded-lg shadow border border-dashed border-gray-300">
                        <Users size={40} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-700 mb-2">No Streams Yet</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Create a new stream or join one using a code from the sidebar.
                        </p>
                        {/* Optional: Add buttons here again if sidebar ones aren't prominent enough */}
                        {/* <div className="flex justify-center space-x-3"> ... buttons ... </div> */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
