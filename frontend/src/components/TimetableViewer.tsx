import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'; // Import UseMutationResult
import { timetableService, TimetableOutput } from '../services/timetable.service'; // Import types from timetable service
import {
    attendanceService,
    WeeklyAttendanceViewEntry, // Use the attendance view type
    AttendanceStatus,
    ReplaceClassInput,
    CancelClassInput,
    AttendanceRecordOutput, // Needed for mutation result type
    MarkAttendanceInput // Needed for mutation input type
} from '../services/attendance.service';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { ArrowLeft, ArrowRight, XCircle, Repeat, Loader2 , Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface TimetableViewerProps {
    streamId: string;
    isAdmin: boolean;
}

interface GroupedViewData { // Renamed from GroupedScheduleData
    [dayOfWeek: number]: { date: Date; entries: WeeklyAttendanceViewEntry[] }; // Use WeeklyAttendanceViewEntry
}


// Type for subject dropdown in replace modal
interface SubjectOption {
    name: string;
    code: string | null;
}

const TimetableViewer: React.FC<TimetableViewerProps> = ({ streamId, isAdmin }) => {
    const queryClient = useQueryClient();
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [mutatingEntryKey, setMutatingEntryKey] = useState<string | null>(null);

    const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    const [entryToReplace, setEntryToReplace] = useState<WeeklyAttendanceViewEntry | null>(null);
    const [replacementSubjectName, setReplacementSubjectName] = useState(''); // Store just the name

    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [entryToCancel, setEntryToCancel] = useState<WeeklyAttendanceViewEntry | null>(null);

    const currentWeekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 1 }), [currentWeekStart]);

    // --- Fetch Weekly ATTENDANCE View Data ---
    // This query now fetches the combined schedule + status + replacement info
    const queryKey = ['weeklyAttendanceView', streamId, format(currentWeekStart, 'yyyy-MM-dd')]; // Changed query key
    const { data: weekAttendance = [], isLoading, error, isFetching } = useQuery<WeeklyAttendanceViewEntry[], Error>({
        queryKey: queryKey,
        queryFn: async () => {
            const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endDateStr = format(currentWeekEnd, 'yyyy-MM-dd');
            // Call the attendance service function
            return await attendanceService.getWeeklyAttendanceView(streamId, startDateStr, endDateStr);
        },
        enabled: !!streamId && !!currentWeekStart && !!currentWeekEnd, // Enable when dates are ready
        staleTime: 1000 * 60 * 1, // Keep potentially shorter stale time
        refetchOnWindowFocus: true,
    });

    // --- Fetch Active Timetable for Subjects (only when replace modal opens) ---
    const { data: activeTimetable } = useQuery<TimetableOutput | null, Error>({
        queryKey: ['activeTimetable', streamId, format(currentWeekStart, 'yyyy-MM-dd')],
        queryFn: () => {
            if (!currentWeekStart) return null;
            return timetableService.getActiveTimetableForDate(streamId, format(currentWeekStart, 'yyyy-MM-dd'));
        },
        enabled: !!streamId && isReplaceModalOpen, // Use isReplaceModalOpen state variable
        staleTime: 1000 * 60 * 10, // Cache for 10 mins while modal might be open
        refetchOnWindowFocus: false, // Don't refetch just on focus
    });

    const availableReplacementSubjects = useMemo((): SubjectOption[] => {
        if (!activeTimetable?.entries || !entryToReplace) return [];
        const subjects = activeTimetable.entries
            .filter(entry => entry.subjectName !== entryToReplace.subjectName) // Exclude current subject
            .map(entry => ({ name: entry.subjectName, code: entry.courseCode || null }));
        return Array.from(new Map(subjects.map(s => [`${s.name}::${s.code}`, s])).values())
               .sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTimetable, entryToReplace]);

    // --- Mutations ---
    const cancelClassMutation = useMutation<unknown, Error, CancelClassInput>({ // Use correct input type
        mutationFn: attendanceService.cancelClassGlobally,
        onSuccess: (data: any) => { // Use 'any' or define specific success type if needed
            toast.success(data?.message || "Class cancelled for all students.");
            queryClient.invalidateQueries({ queryKey: queryKey });
            queryClient.invalidateQueries({ queryKey: ['attendanceWeek', streamId] });
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
        },
        onError: (err: Error) => toast.error(`Failed to cancel: ${err.message}`),
        onSettled: () => { setMutatingEntryKey(null); setIsCancelConfirmOpen(false); setEntryToCancel(null); } // Close confirm modal too
    });

    const replaceClassMutation = useMutation<unknown, Error, ReplaceClassInput>({ // Use correct input type
         mutationFn: attendanceService.replaceClassGlobally,
         onSuccess: (data: any) => {
            toast.success(data?.message || "Class replaced successfully.");
            queryClient.invalidateQueries({ queryKey: queryKey });
            queryClient.invalidateQueries({ queryKey: ['attendanceWeek', streamId] });
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
            handleCloseReplaceModal();
        },
        onError: (err: Error) => toast.error(`Failed to replace: ${err.message}`),
        onSettled: () => setMutatingEntryKey(null),
    });

    // --- Handlers ---
    const goToPreviousWeek = () => setCurrentWeekStart(prev => subDays(prev, 7));
    const goToNextWeek = () => setCurrentWeekStart(prev => addDays(prev, 7));

    const openCancelConfirm = (entry: WeeklyAttendanceViewEntry) => {
        if (!isAdmin) return;
        setEntryToCancel(entry);
        setIsCancelConfirmOpen(true);
    };

    const handleConfirmCancel = () => {
        if (!entryToCancel || !streamId || cancelClassMutation.isPending) return;
        const entryKey = `${entryToCancel.date}_${entryToCancel.subjectName}_${entryToCancel.startTime || 'nostart'}_${entryToCancel.isReplacement}`; // Make key more unique
        setMutatingEntryKey(entryKey);
        cancelClassMutation.mutate({
            streamId,
            classDate: entryToCancel.date,
            subjectName: entryToCancel.isReplacement ? entryToCancel.originalSubjectName! : entryToCancel.subjectName, // Use original name if cancelling a replacement's slot? Or current name? Let's use current.
            startTime: entryToCancel.startTime
        });
    };

    const openReplaceModal = (entry: WeeklyAttendanceViewEntry) => {
        if (!isAdmin || entry.isReplacement) return; // Don't allow replacing a replacement
        setEntryToReplace(entry);
        setReplacementSubjectName('');
        setIsReplaceModalOpen(true);
    };

    const handleCloseReplaceModal = () => {
        setIsReplaceModalOpen(false); setEntryToReplace(null); setReplacementSubjectName('');
    };

    const handleReplaceSubmit = (e: React.FormEvent) => {
        if (!entryToReplace || !replacementSubjectName || !streamId || replaceClassMutation.isPending) return;
        const selectedSubjectData = availableReplacementSubjects.find(s => s.name === replacementSubjectName);
        const entryKey = `${entryToReplace.date}_${entryToReplace.subjectName}_${entryToReplace.startTime || 'nostart'}_${entryToReplace.isReplacement}`;
        setMutatingEntryKey(entryKey);
        const payload: ReplaceClassInput = {
            streamId,
            classDate: entryToReplace.date,
            originalSubjectName: entryToReplace.subjectName, // Original is the one being replaced
            originalStartTime: entryToReplace.startTime,
            replacementSubjectName: replacementSubjectName,
            replacementCourseCode: selectedSubjectData?.code,
        };
        replaceClassMutation.mutate(payload);
    };

    // --- Group Data ---
    const groupedData = useMemo((): GroupedViewData => { // Use GroupedViewData type
        if (!weekAttendance) return {};
        const groups: GroupedViewData = {};
        const daysInWeek = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });
        daysInWeek.forEach((day: Date) => {
            const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
            // Filter entries from the fetched attendance view data
            const entriesForDay = weekAttendance.filter((entry: WeeklyAttendanceViewEntry) => isSameDay(parseISO(entry.date), day));
            // Add day only if it has entries
            if (entriesForDay.length > 0) {
                groups[dayOfWeek] = {
                    date: day,
                    entries: entriesForDay.sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99')),
                };
            }
        });
        return groups;
    }, [weekAttendance, currentWeekStart, currentWeekEnd]);

    const weekDaysMap = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const isDataLoading = isLoading || isFetching;

    return (
        <div className="space-y-4">
            {/* Week Navigation */}
            <div className="flex items-center justify-center space-x-2 mb-4">
                <Button onClick={goToPreviousWeek} variant="outline" size="sm" disabled={isDataLoading}> <ArrowLeft size={16} className="mr-1" /> Prev </Button>
                <span className="font-semibold text-center w-48 text-gray-700">
                    {format(currentWeekStart, 'MMM dd')} - {format(currentWeekEnd, 'MMM dd, yyyy')}
                </span>
                <Button onClick={goToNextWeek} variant="outline" size="sm" disabled={isDataLoading}> Next <ArrowRight size={16} className="ml-1" /> </Button>
            </div>

            {/* Loading/Error */}
            {isDataLoading && <div className="text-center py-10 text-gray-500 flex justify-center items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading schedule...</div>}
            {!isDataLoading && error && <p className="text-center text-red-500 py-10">Error loading schedule: {error.message}</p>}

            {/* Grid */}
            {!isLoading && !error && Object.keys(groupedData).length === 0 && ( <p className="text-center text-gray-500 py-10 italic">No classes scheduled or replaced for this week.</p> )}
            {!isLoading && !error && Object.keys(groupedData).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                     {Object.keys(groupedData).map(Number).sort().map(dayOfWeek => (
                        <Card key={dayOfWeek} className="shadow-sm text-sm flex flex-col">
                            <CardHeader className="pb-2 pt-3 px-3 bg-gray-100/80 rounded-t-lg border-b">
                                <CardTitle className="text-sm font-semibold text-gray-700">
                                    {weekDaysMap[dayOfWeek]}, {format(groupedData[dayOfWeek].date, 'MMM dd')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 space-y-2 flex-grow">
                                {groupedData[dayOfWeek].entries.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">No classes</p>}
                                {groupedData[dayOfWeek].entries.map((entry) => { // entry is WeeklyAttendanceViewEntry
                                    const entryKey = `${entry.date}_${entry.subjectName}_${entry.startTime || 'nostart'}_${entry.isReplacement}`;
                                    const isMutatingThis = mutatingEntryKey === entryKey;
                                    // Determine display status based on fetched data
                                    const isCancelled = entry.status === AttendanceStatus.CANCELLED;
                                    const isReplacement = entry.isReplacement;

                                    // Determine border color based on status/type
                                    let borderColor = 'border-blue-300'; // Default SCHEDULED
                                    if (isCancelled) borderColor = 'border-red-300';
                                    if (isReplacement) borderColor = 'border-green-400'; // Use different color for replacement

                                    return (
                                        <div key={entryKey} className={`border-l-4 ${borderColor} pl-2 py-1 transition-colors duration-200 ${isCancelled ? 'bg-red-50/50 opacity-70' : isReplacement ? 'bg-green-50/50' : ''}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    {/* Show Replacement Indicator */}
                                                    {isReplacement && (
                                                        <span className="block text-xs text-green-700 font-medium flex items-center">
                                                            <Repeat size={12} className="mr-1"/> Replacement
                                                        </span>
                                                    )}
                                                    {/* Show Subject Name */}
                                                    <p className={`font-medium text-sm ${isCancelled ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                        {entry.subjectName}
                                                    </p>
                                                    {entry.courseCode && <p className="text-xs text-gray-500">{entry.courseCode}</p>}
                                                    {/* Show Original Subject if Replacement */}
                                                    {isReplacement && entry.originalSubjectName && (
                                                        <p className="text-xs text-gray-500 italic">(Replaced: {entry.originalSubjectName})</p>
                                                    )}
                                                </div>
                                                {/* Show Time */}
                                                <p className={`text-xs font-mono whitespace-nowrap pl-1 ${isCancelled ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {entry.startTime || '--:--'} - {entry.endTime || '--:--'}
                                                </p>
                                            </div>
                                            {/* Admin Actions */}
                                            {isAdmin && (
                                                <div className="flex space-x-1 mt-1 h-6">
                                                    {/* Show Cancel/Replace only for non-cancelled, non-replacement entries */}
                                                    {!isCancelled && !isReplacement && (
                                                        <>
                                                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-100 h-full px-1" onClick={() => openCancelConfirm(entry)} title="Cancel Class" disabled={cancelClassMutation.isPending || replaceClassMutation.isPending || isMutatingThis}>
                                                                {(isMutatingThis && cancelClassMutation.isPending) ? <Loader2 className="h-3 w-3 animate-spin"/> : <XCircle size={14}/>}
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="text-yellow-600 hover:bg-yellow-100 h-full px-1" onClick={() => openReplaceModal(entry)} title="Replace Class" disabled={cancelClassMutation.isPending || replaceClassMutation.isPending || isMutatingThis}>
                                                                 {(isMutatingThis && replaceClassMutation.isPending) ? <Loader2 className="h-3 w-3 animate-spin"/> : <Repeat size={14}/>}
                                                            </Button>
                                                        </>
                                                    )}
                                                    {/* Show status text if not actionable */}
                                                    {isCancelled && <p className="text-xs text-red-600 italic">Cancelled</p>}
                                                    {isReplacement && <p className="text-xs text-green-700 italic">Replacement Added</p>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                     ))}
                </div>
             )}
             {/* Cancel Confirmation Dialog */}
             <Dialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle>Confirm Cancellation</DialogTitle>
                         <DialogDescription>
                            Are you sure you want to cancel the class "{entryToCancel?.subjectName}"
                            on {entryToCancel ? format(parseISO(entryToCancel.date), 'MMM dd, yyyy') : ''}
                            for all students? This action cannot be undone easily.
                         </DialogDescription>
                     </DialogHeader>
                     <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCancelConfirmOpen(false)} disabled={cancelClassMutation.isPending}>Back</Button>
                        <Button variant="destructive" onClick={handleConfirmCancel} disabled={cancelClassMutation.isPending}>
                            {cancelClassMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Cancelling...</> : 'Yes, Cancel Class'}
                        </Button>
                     </DialogFooter>
                 </DialogContent>
             </Dialog>

             {/* Replace Class Modal */}
             <Dialog open={isReplaceModalOpen} onOpenChange={handleCloseReplaceModal}> {/* Use correct handler */}
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Replace Class</DialogTitle>
                        <DialogDescription>
                            Replace "{entryToReplace?.subjectName}" on {entryToReplace ? format(parseISO(entryToReplace.date), 'MMM dd, yyyy') : ''}.
                            Original class will be marked cancelled. Attendance will be tracked for the replacement.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleReplaceSubmit} className="space-y-4 py-4">
                         <div>
                            <Label htmlFor="replacementSubject">Replacement Subject <span className="text-red-500">*</span></Label>
                            <Select
                                onValueChange={setReplacementSubjectName}
                                value={replacementSubjectName}
                                required
                                disabled={replaceClassMutation.isPending}
                            >
                                <SelectTrigger id="replacementSubject">
                                    <SelectValue placeholder="Select subject..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableReplacementSubjects.length === 0 && <SelectItem value="loading" disabled>No other subjects found in timetable</SelectItem>}
                                    {availableReplacementSubjects.map(sub => (
                                        <SelectItem key={`${sub.name}-${sub.code}`} value={sub.name}>
                                            {sub.name} {sub.code && `(${sub.code})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                         {/* Optional: Add inputs for replacement time if needed */}
                         <DialogFooter>
                            <Button type="button" variant="ghost" onClick={handleCloseReplaceModal} disabled={replaceClassMutation.isPending}>Cancel</Button>
                            <Button type="submit" disabled={!replacementSubjectName || replaceClassMutation.isPending}>
                                {replaceClassMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Replacing...</> : 'Confirm Replacement'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
             </Dialog>
        </div>
    );
};

export default TimetableViewer;