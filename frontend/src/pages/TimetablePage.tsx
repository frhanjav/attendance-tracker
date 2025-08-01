import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TimetableViewer from '../components/TimetableViewer';
import CreateTimetableModal from '../components/CreateTimetableModal';
import { Button } from '../components/ui/button';
import { Plus, CalendarOff, Loader2 } from 'lucide-react';
import { timetableService, SetEndDateInput, TimetableOutput, TimetableBasicInfo } from '../services/timetable.service';
import { streamService, StreamDetailed } from '../services/stream.service';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

type TimetableToEnd = Pick<TimetableBasicInfo, 'id' | 'name' | 'validFrom'>;

const TimetablePage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    if (!streamId) return <div className="text-center p-10 text-red-500">Invalid Stream ID provided.</div>;

    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEndModalOpen, setIsEndModalOpen] = useState(false);
    const [timetableToEnd, setTimetableToEnd] = useState<TimetableToEnd | null>(null);
    const [endDate, setEndDate] = useState('');

    const { data: streamDetails, isLoading: isLoadingStream } = useQuery<StreamDetailed, Error>({
        queryKey: ['stream', streamId],
        queryFn: () => streamService.getStreamDetails(streamId!),
        enabled: !!streamId && !!user,
    });

    const isAdmin = useMemo(() => {
        if (!user || !streamDetails) return false;
        return streamDetails.ownerId === user.id ||
               streamDetails.members.some(m => m.userId === user.id && m.role === 'admin');
    }, [user, streamDetails]);

    const { data: allTimetables = [], isLoading: isLoadingList } = useQuery<TimetableBasicInfo[], Error>({
        queryKey: ['timetableList', streamId],
        queryFn: () => timetableService.getTimetableListForImport(streamId!),
        enabled: !!streamId && isAdmin,
    });

    const mostRecentTimetable = useMemo(() => {
        return allTimetables.length > 0 ? allTimetables[0] : null;
    }, [allTimetables]);

    const setEndDateMutation = useMutation<TimetableOutput, Error, { timetableId: string, data: SetEndDateInput }>({
        mutationFn: (vars) => timetableService.setEndDate(vars.timetableId, vars.data),
        onSuccess: (updatedData) => {
            toast.success(`End date set for timetable "${updatedData.name}"`);
            queryClient.invalidateQueries({ queryKey: ['activeTimetable', streamId] });
            queryClient.invalidateQueries({ queryKey: ['timetableList', streamId] });
            queryClient.invalidateQueries({ queryKey: ['weeklySchedule', streamId] });
            queryClient.invalidateQueries({ queryKey: ['attendanceWeek', streamId] });
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
            handleCloseEndModal();
        },
        onError: (err: Error) => toast.error(`Error: ${err.message}`),
    });

    const openEndModal = (timetable: TimetableBasicInfo) => {
        setTimetableToEnd({ id: timetable.id, name: timetable.name, validFrom: timetable.validFrom });
        setEndDate('');
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

    const isLoading = isLoadingStream;    

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b pb-4">
                 <h1 className="text-3xl font-bold text-gray-800">Timetable Schedule</h1>
                 {!isLoading && isAdmin && (
                     <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                         <Plus size={16} className="mr-1"/> Create New Timetable
                     </Button>
                 )}
                 {isLoading && (
                     <Button size="sm" disabled>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                     </Button>
                 )}
            </div>

            <TimetableViewer streamId={streamId} isAdmin={isAdmin} />

            {isAdmin && (
                <CreateTimetableModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    streamId={streamId}
                />
            )}

            {/* Timetable Management Section (Admin Only) */}
            {isAdmin && (
                <Card className="shadow-md border border-gray-200 mt-8">
                    <CardHeader>
                        <CardTitle>Timetable Management</CardTitle>
                        <CardDescription>Manage the most recently created timetable, which overrides all previous ones.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingList && <p className="text-sm text-gray-500">Loading timetable details...</p>}
                        {mostRecentTimetable ? (
                            <div className={`flex justify-between items-center p-3 rounded-md ${mostRecentTimetable.validUntil ? 'bg-gray-100' : 'bg-green-50 border-green-200 border'}`}>
                                <div>
                                    <p className="font-medium">{mostRecentTimetable.name}</p>
                                    <p className="text-xs text-gray-600">
                                        Active From: {format(parseISO(mostRecentTimetable.validFrom), 'MMM dd, yyyy')} | Ends: {mostRecentTimetable.validUntil ? format(parseISO(mostRecentTimetable.validUntil), 'MMM dd, yyyy') : 'Present'}
                                    </p>
                                </div>
                                {!mostRecentTimetable.validUntil && (
                                    <Button variant="outline" size="sm" onClick={() => openEndModal(mostRecentTimetable)}>
                                        <CalendarOff size={14} className="mr-1"/> Set End Date
                                    </Button>
                                )}
                            </div>
                        ) : (
                            !isLoadingList && <p className="text-sm text-gray-500 italic p-3">No timetables have been created for this stream yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}


             <Dialog open={isEndModalOpen} onOpenChange={(open) => !open && handleCloseEndModal()}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle>Set End Date for Timetable</DialogTitle>
                         <DialogDescription>
                            End the timetable "{timetableToEnd?.name}". No more classes will be scheduled by this timetable after the selected date.
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
        </div>
    );
};

export default TimetablePage;