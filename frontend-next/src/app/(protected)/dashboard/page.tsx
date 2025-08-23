'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StreamBasic, streamService } from '@/services/stream.service';
import useUIStore from '@/stores/uiStore';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArrowRight, Loader2, LogIn, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
    const openCreateStreamModal = useUIStore((state) => state.openCreateStreamModal);
    const openJoinStreamModal = useUIStore((state) => state.openJoinStreamModal);

    const [showArchived, setShowArchived] = useState(false);

    const {
        data: streams,
        isLoading,
        error,
    } = useQuery<StreamBasic[], Error>({
        queryKey: ['myStreamsDashboard', showArchived],
        queryFn: () => streamService.getMyStreams(showArchived),
        staleTime: 1000 * 60 * 10,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="flex items-center space-x-1.5 border p-1.5 rounded-md bg-gray-50 shadow-sm">
                        <Switch
                            id="dashboard-show-archived"
                            checked={showArchived}
                            onCheckedChange={setShowArchived}
                            className="h-4 w-7 data-[state=checked]:bg-blue-500"
                        />
                        <Label
                            htmlFor="dashboard-show-archived"
                            className="text-xs text-gray-600 cursor-pointer"
                        >
                            Show Archived
                        </Label>
                    </div>
                    <Button
                        size="sm"
                        onClick={openCreateStreamModal}
                        variant="default"
                        className="shadow-sm"
                    >
                        <Plus size={16} className="mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Create Stream</span>
                        <span className="sm:hidden">New</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={openJoinStreamModal}
                        variant="outline"
                        className="shadow-sm"
                    >
                        <LogIn size={16} className="mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Join Stream</span>
                        <span className="sm:hidden">Join</span>
                    </Button>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                    {showArchived ? 'Archived Streams' : 'My Active Streams'}
                </h2>
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
                        {streams.map((stream) => {
                            return (
                                <Card
                                    key={stream.id}
                                    className={`shadow-md hover:shadow-lg transition-shadow flex flex-col ${
                                        stream.isArchived ? 'opacity-70 bg-gray-50' : ''
                                    }`}
                                >
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg truncate" title={stream.name}>
                                            <Link
                                                href={`/streams/${stream.id}`}
                                                className="hover:text-blue-700"
                                            >
                                                {stream.name}
                                            </Link>
                                            {stream.isArchived && (
                                                <span className="ml-2 text-xs font-medium bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-sm">
                                                    Archived
                                                </span>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="text-xs pt-1">
                                            Code:{' '}
                                            <span className="font-mono bg-gray-100 px-1 rounded">
                                                {stream.streamCode}
                                            </span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <p className="text-sm text-gray-500 italic">
                                            Click "Open Stream" for details.
                                        </p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            asChild
                                        >
                                            <Link href={`/streams/${stream.id}`}>
                                                Open Stream{' '}
                                                <ArrowRight size={14} className="ml-1" />
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                ) : null}

                {!isLoading && !error && (!streams || streams.length === 0) && (
                    <div className="text-center py-16 px-6 bg-white rounded-lg shadow border border-dashed border-gray-300">
                        <Archive size={40} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-700 mb-2">
                            {showArchived ? 'No Archived Streams Found' : 'No Active Streams Found'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {showArchived
                                ? "You haven't archived any streams yet, or try toggling the switch above."
                                : 'Create a new stream or join one. Toggle "Show Archived" to view inactive streams.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
