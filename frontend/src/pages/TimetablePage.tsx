import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TimetableViewer from '../components/TimetableViewer';
import CreateTimetableModal from '../components/CreateTimetableModal';
import { Button } from '../components/ui/button';
import { Plus, CalendarOff, Loader2 } from 'lucide-react';
import { timetableService, SetEndDateInput, TimetableOutput } from '../services/timetable.service';
import { streamService, StreamDetailed } from '../services/stream.service';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

// Type for the selected timetable to end
type TimetableToEnd = {
    id: string;
    name: string;
    validFrom: string; // ISO String
};

const TimetablePage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [isEndModalOpen, setIsEndModalOpen] = useState(false);
    const [timetableToEnd, setTimetableToEnd] = useState<TimetableToEnd | null>(null);
    const [endDate, setEndDate] = useState('');

    // Fetch stream details to check ownership/admin status
    const { data: streamDetails, isLoading: isLoadingStream } = useQuery<StreamDetailed, Error>({
        queryKey: ['stream', streamId], // Use the same key as other pages fetching stream details
        queryFn: () => streamService.getStreamDetails(streamId!),
        enabled: !!streamId && !!user,
        staleTime: 1000 * 60 * 5,
    });

    // Determine if the current user is the admin (owner) of this stream
    const isAdmin = useMemo(() => {
        if (!user || !streamDetails) return false;
        return streamDetails.ownerId === user.id ||
               streamDetails.members.some(m => m.userId === user.id && m.role === 'admin');
    }, [user, streamDetails]);

    // --- Query: Fetch the CURRENTLY ACTIVE Timetable ---
    const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    const { data: activeTimetable, isLoading: isLoadingActive } = useQuery<TimetableOutput | null, Error>({
        queryKey: ['activeTimetable', streamId, todayStr],
        queryFn: () => timetableService.getActiveTimetableForDate(streamId, todayStr),
        enabled: !!streamId && isAdmin, // Only admins need this functionality
        staleTime: 1000 * 60 * 5, // Cache for 5 mins
    });

    // --- Mutation for setting end date ---
    const setEndDateMutation = useMutation<TimetableOutput, Error, { timetableId: string, data: SetEndDateInput }>({
        mutationFn: (vars) => timetableService.setEndDate(vars.timetableId, vars.data),
        onSuccess: (updatedData) => {
            toast.success(`End date set for timetable "${updatedData.name}"`);
            // Invalidate all relevant queries to reflect the change everywhere
            queryClient.invalidateQueries({ queryKey: ['activeTimetable', streamId] });
            queryClient.invalidateQueries({ queryKey: ['timetableList', streamId] }); // For import modal
            queryClient.invalidateQueries({ queryKey: ['weeklySchedule', streamId] });
            queryClient.invalidateQueries({ queryKey: ['attendanceWeek', streamId] });
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
            handleCloseEndModal();
        },
        onError: (err: Error) => toast.error(`Error: ${err.message}`),
    });

    // --- Handlers for End Date Modal ---
    const openEndModal = (timetable: TimetableOutput) => {
        setTimetableToEnd({ id: timetable.id, name: timetable.name, validFrom: timetable.validFrom });
        setEndDate(''); // Clear previous date input
        setIsEndModalOpen(true);
    };
    const handleCloseEndModal = () => {
        setIsEndModalOpen(false);
        setTimetableToEnd(null);
        setEndDate('');
    };
    const handleConfirmEnd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!timetableToEnd || !endDate || setEndDateMutation.isPending) return;
        setEndDateMutation.mutate({ timetableId: timetableToEnd.id, data: { validUntil: endDate } });
    };

    // Handle loading state for admin check
    const isLoading = isLoadingStream;

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

            {/* Active Timetable Management Section (Admin Only) */}
            {isAdmin && (
                <Card className="shadow-md border border-gray-200 mt-8">
                    <CardHeader>
                        <CardTitle>Active Timetable Management</CardTitle>
                        <CardDescription>Manage the currently active, open-ended timetable.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingActive && <p className="text-sm text-gray-500">Checking for active timetable...</p>}
                        {activeTimetable ? (
                            <div className={`flex justify-between items-center p-3 rounded-md ${activeTimetable.validUntil ? 'bg-gray-100' : 'bg-green-50 border-green-200 border'}`}>
                                <div>
                                    <p className="font-medium">{activeTimetable.name}</p>
                                    <p className="text-xs text-gray-600">
                                        Active Since: {format(parseISO(activeTimetable.validFrom), 'MMM dd, yyyy')}
                                    </p>
                                </div>
                                {/* Show button ONLY for active timetable and ONLY if it has no end date */}
                                {!activeTimetable.validUntil ? (
                                    <Button variant="outline" size="sm" onClick={() => openEndModal(activeTimetable)}>
                                        <CalendarOff size={14} className="mr-1"/> Set End Date
                                    </Button>
                                ) : (
                                    <span className="text-sm text-gray-500 font-medium">
                                        Ends on: {format(parseISO(activeTimetable.validUntil), 'MMM dd, yyyy')}
                                    </span>
                                )}
                            </div>
                        ) : (
                            !isLoadingActive && <p className="text-sm text-gray-500 italic p-3">No timetable is currently active for this stream.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* --- REMOVED Historical Timetables List --- */}

            {/* End Date Modal */}
             <Dialog open={isEndModalOpen} onOpenChange={(open) => !open && handleCloseEndModal()}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle>Set End Date for Timetable</DialogTitle>
                         <DialogDescription>
                            End the timetable "{timetableToEnd?.name}". No more attendance will be tracked for this schedule after the selected date.
                         </DialogDescription>
                     </DialogHeader>
                     <form onSubmit={handleConfirmEnd} className="py-4 space-y-4">
                         <div>
                             <Label htmlFor="end-date">End Date <span className="text-red-500">*</span></Label>
                             <Input
                                 id="end-date"
                                 type="date"
                                 value={endDate}
                                 onChange={(e) => setEndDate(e.target.value)}
                                 // Set min date to be the timetable's start date
                                 min={timetableToEnd ? format(parseISO(timetableToEnd.validFrom), 'yyyy-MM-dd') : undefined}
                                 required
                                 disabled={setEndDateMutation.isPending}
                             />
                         </div>
                         <DialogFooter>
                             <Button type="button" variant="ghost" onClick={handleCloseEndModal} disabled={setEndDateMutation.isPending}>Cancel</Button>
                             <Button type="submit" disabled={setEndDateMutation.isPending}>
                                 {setEndDateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting Date...</> : 'Confirm End Date'}
                             </Button>
                         </DialogFooter>
                     </form>
                 </DialogContent>
             </Dialog>

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