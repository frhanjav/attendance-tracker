import React, { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { streamService, StreamBasic } from '../services/stream.service';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '../components/ui/accordion';
import {
    LayoutDashboard,
    PlusCircle,
    LogIn,
    BookOpen,
    CheckSquare,
    BarChartHorizontal,
} from 'lucide-react';
import useUIStore from '../stores/uiStore';

const Sidebar: React.FC = () => {
    const openCreateStreamModal = useUIStore((state) => state.openCreateStreamModal);
    const openJoinStreamModal = useUIStore((state) => state.openJoinStreamModal);

    const { streamId: activeStreamId } = useParams<{ streamId?: string }>();
    const [openAccordionItem, setOpenAccordionItem] = useState<string | undefined>(activeStreamId);

    // Fetch user's streams
    const { data: streams, isLoading, error } = useQuery<StreamBasic[], Error>({
        queryKey: ['myStreams', false], // Key indicates active streams
        queryFn: () => streamService.getMyStreams(false), // Explicitly fetch non-archived
        staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    });

    // Update accordion when route changes
    React.useEffect(() => {
        setOpenAccordionItem(activeStreamId);
    }, [activeStreamId]);

    const handleAccordionChange = (value: string) => {
        setOpenAccordionItem(value === openAccordionItem ? undefined : value);
    };

    return (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-[calc(100vh-theme(space.16))]">
            {' '}
            {/* Adjust height based on Navbar */}
            {/* Top Links */}
            <div className="p-4 border-b">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`
                    }
                    end // Match only exact path
                >
                    <LayoutDashboard className="mr-3 h-5 w-5" />
                    Dashboard
                </NavLink>
                {/* Add other global links here if needed */}
            </div>
            {/* Stream List */}
            <ScrollArea className="flex-1 px-2 py-4">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        My Streams
                    </h2>
                {isLoading && <p className="px-2 text-xs text-gray-400">Loading streams...</p>}
                {error && <p className="px-2 text-xs text-red-500">Error loading.</p>}
                {!isLoading && !error && streams && streams.length > 0 && (
                    <Accordion
                        type="single"
                        collapsible
                        value={openAccordionItem}
                        onValueChange={handleAccordionChange}
                        className="w-full"
                    >
                        {streams.map((stream) => (
                            <AccordionItem value={stream.id} key={stream.id} className="border-b-0">
                                <AccordionTrigger
                                    className={`px-2 py-1.5 text-sm hover:bg-gray-100 rounded-md ${
                                        activeStreamId === stream.id
                                            ? 'font-semibold text-blue-700'
                                            : 'text-gray-700'
                                    }`}
                                >
                                    <Link
                                        to={`/streams/${stream.id}`}
                                        className="flex-1 text-left truncate"
                                        title={stream.name}
                                    >
                                        {stream.name}
                                    </Link>
                                </AccordionTrigger>
                                <AccordionContent className="pt-1 pb-2 pl-4 pr-1">
                                    <nav className="flex flex-col space-y-1">
                                        <NavLink
                                            to={`/streams/${stream.id}/timetable`}
                                            className={({ isActive }) =>
                                                `flex items-center px-2 py-1 rounded text-xs ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`
                                            }
                                        >
                                            <BookOpen className="mr-2 h-3.5 w-3.5" /> Timetable
                                        </NavLink>
                                        <NavLink
                                            to={`/streams/${stream.id}/attendance`}
                                            className={({ isActive }) =>
                                                `flex items-center px-2 py-1 rounded text-xs ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`
                                            }
                                        >
                                            <CheckSquare className="mr-2 h-3.5 w-3.5" /> Attendance
                                        </NavLink>
                                        <NavLink
                                            to={`/streams/${stream.id}/analytics`}
                                            className={({ isActive }) =>
                                                `flex items-center px-2 py-1 rounded text-xs ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`
                                            }
                                        >
                                            <BarChartHorizontal className="mr-2 h-3.5 w-3.5" />{' '}
                                            Analytics
                                        </NavLink>
                                    </nav>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
                {!isLoading && !error && (!streams || streams.length === 0) && (
                    <p className="px-2 text-xs text-gray-400 italic">No streams joined yet.</p>
                )}
            </ScrollArea>
            {/* Bottom Actions - Use passed-in handlers */}
            <div className="p-4 border-t mt-auto space-y-2">
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start text-xs"
                    onClick={openCreateStreamModal}
                >
                    {' '}
                    {/* Add onClick */}
                    <PlusCircle size={14} className="mr-2" /> Create Stream
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start text-xs"
                    onClick={openJoinStreamModal}
                >
                    {' '}
                    {/* Add onClick */}
                    <LogIn size={14} className="mr-2" /> Join Stream
                </Button>
            </div>
        </aside>
    );
};

export default Sidebar;
