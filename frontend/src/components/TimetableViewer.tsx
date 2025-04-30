// frontend/src/components/TimetableViewer.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Assume a timetable service exists with getWeeklySchedule
import { timetableService, WeeklyScheduleEntry } from '../services/timetable.service';
// Assume attendance service exists for cancel/replace actions
import { attendanceService, AttendanceStatus } from '../services/attendance.service';
import { format, addDays, subDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, ArrowRight, XCircle, Repeat, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
// Import Dialog components if using modal for replace action
// import { Dialog, DialogContent, DialogHeader, DialogTitle, ... } from "@/components/ui/dialog";

interface TimetableViewerProps {
    streamId: string;
    isAdmin: boolean; // Pass admin status to show/hide controls
}

// Define structure for grouped data
interface GroupedScheduleData {
    [dayOfWeek: number]: { date: Date; entries: WeeklyScheduleEntry[] };
}

const TimetableViewer: React.FC<TimetableViewerProps> = ({ streamId, isAdmin }) => {
    const queryClient = useQueryClient();
    const [currentWeekStart, setCurrentWeekStart] = useState(
        startOfWeek(new Date(), { weekStartsOn: 1 }),
    );
    const [mutatingEntryKey, setMutatingEntryKey] = useState<string | null>(null);
    // State for replace modal (optional)
    // const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    // const [entryToReplace, setEntryToReplace] = useState<WeeklyScheduleEntry | null>(null);
    // const [newSubjectName, setNewSubjectName] = useState('');
    // const [newCourseCode, setNewCourseCode] = useState('');

    const currentWeekEnd = useMemo(
        () => endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
        [currentWeekStart],
    );

    // --- Fetch Schedule Data for the Week ---
    const queryKey = ['weeklySchedule', streamId, format(currentWeekStart, 'yyyy-MM-dd')];
    const {
        data: weekSchedule = [],
        isLoading,
        error,
    } = useQuery<WeeklyScheduleEntry[], Error>({
        queryKey: queryKey,
        queryFn: async () => {
            const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endDateStr = format(currentWeekEnd, 'yyyy-MM-dd');
            // Ensure timetableService has getWeeklySchedule
            if (timetableService.getWeeklySchedule) {
                return await timetableService.getWeeklySchedule(streamId, startDateStr, endDateStr);
            } else {
                console.error('timetableService.getWeeklySchedule not found!');
                return []; // Return empty if function doesn't exist
            }
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    // --- Mutations for Cancel/Replace ---
    const cancelClassMutation = useMutation({
        mutationFn: attendanceService.cancelClassGlobally, // Ensure this exists in attendanceService
        onSuccess: () => {
            toast.success('Class cancelled for all students.');
            queryClient.invalidateQueries({ queryKey: queryKey }); // Invalidate current week's schedule
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] }); // Invalidate analytics
        },
        onError: (err: Error) => toast.error(`Failed to cancel: ${err.message}`),
        onSettled: () => setMutatingEntryKey(null),
    });

    // TODO: Implement Replace Mutation (more complex backend needed)
    // const replaceClassMutation = useMutation({ ... });

    // --- Group data by day ---
    const groupedData = useMemo((): GroupedScheduleData => {
        const groups: GroupedScheduleData = {};
        weekSchedule.forEach((entry) => {
            const entryDate = parseISO(entry.date); // Assuming date is string from API
            const dayOfWeek = entryDate.getDay() === 0 ? 7 : entryDate.getDay();
            if (!groups[dayOfWeek]) {
                groups[dayOfWeek] = { date: entryDate, entries: [] };
            }
            groups[dayOfWeek].entries.push(entry);
            // Sort entries within the day
            groups[dayOfWeek].entries.sort((a, b) =>
                (a.startTime || '99:99').localeCompare(b.startTime || '99:99'),
            );
        });
        return groups;
    }, [weekSchedule]);

    // --- Handlers ---
    const goToPreviousWeek = () => setCurrentWeekStart((prev) => subDays(prev, 7));
    const goToNextWeek = () => setCurrentWeekStart((prev) => addDays(prev, 7));

    const handleCancel = (entry: WeeklyScheduleEntry) => {
        if (!isAdmin || !streamId || cancelClassMutation.isPending) return;
        const entryKey = `${entry.date}_${entry.subjectName}_${entry.startTime || 'nostart'}`;
        if (
            window.confirm(
                `Cancel ${entry.subjectName} on ${format(parseISO(entry.date), 'MMM dd')} for everyone?`,
            )
        ) {
            setMutatingEntryKey(entryKey);
            cancelClassMutation.mutate({
                streamId,
                classDate: entry.date, // Send YYYY-MM-DD string
                subjectName: entry.subjectName,
                startTime: entry.startTime, // Include time if needed by backend
            });
        }
    };

    const handleReplace = (entry: WeeklyScheduleEntry) => {
        if (!isAdmin || !streamId) return;
        toast.error('Replace functionality not implemented yet.');
        // TODO: Open modal, get new details, call replaceClassMutation
        // setEntryToReplace(entry);
        // setIsReplaceModalOpen(true);
    };

    const weekDaysMap = [
        '',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
    ];

    return (
        <div className="space-y-4">
            {/* Week Navigation */}
            <div className="flex items-center justify-center space-x-2 mb-4">
                <Button onClick={goToPreviousWeek} variant="outline" size="sm" disabled={isLoading}>
                    {' '}
                    <ArrowLeft size={16} className="mr-1" /> Prev{' '}
                </Button>
                <span className="font-semibold text-center w-48 text-gray-700">
                    {format(currentWeekStart, 'MMM dd')} - {format(currentWeekEnd, 'MMM dd, yyyy')}
                </span>
                <Button onClick={goToNextWeek} variant="outline" size="sm" disabled={isLoading}>
                    {' '}
                    Next <ArrowRight size={16} className="ml-1" />{' '}
                </Button>
            </div>

            {/* Loading/Error */}
            {isLoading && (
                <div className="text-center py-10 text-gray-500 flex justify-center items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading schedule...
                </div>
            )}
            {error && (
                <p className="text-center text-red-500 py-10">
                    Error loading schedule: {error.message}
                </p>
            )}

            {/* Grid */}
            {!isLoading && !error && Object.keys(groupedData).length === 0 && (
                <p className="text-center text-gray-500 py-10 italic">
                    No classes scheduled for this week.
                </p>
            )}
            {!isLoading && !error && Object.keys(groupedData).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {Object.keys(groupedData)
                        .map(Number)
                        .sort()
                        .map((dayOfWeek) => (
                            <Card key={dayOfWeek} className="shadow-sm text-sm flex flex-col">
                                <CardHeader className="pb-2 pt-3 px-3 bg-gray-100 rounded-t-lg border-b">
                                    <CardTitle className="text-sm font-semibold text-gray-700">
                                        {weekDaysMap[dayOfWeek]},{' '}
                                        {format(groupedData[dayOfWeek].date, 'MMM dd')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 space-y-2 flex-grow">
                                    {groupedData[dayOfWeek].entries.length === 0 && (
                                        <p className="text-xs text-gray-400 italic text-center py-2">
                                            No classes
                                        </p>
                                    )}
                                    {groupedData[dayOfWeek].entries.map((entry, index) => {
                                        const entryKey = `${entry.date}_${entry.subjectName}_${entry.startTime || 'nostart'}`;
                                        const isMutatingThis = mutatingEntryKey === entryKey;
                                        const isCancelled = entry.status === 'CANCELLED'; // Check global status

                                        return (
                                            <div
                                                key={`${entry.subjectName}-${index}`}
                                                className={`border-l-4 pl-2 py-1 ${isCancelled ? 'border-red-300 bg-red-50/60' : entry.status === 'REPLACED' ? 'border-yellow-300 bg-yellow-50/60' : 'border-blue-300'}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p
                                                            className={`font-medium text-sm ${isCancelled ? 'line-through text-gray-500' : 'text-gray-800'}`}
                                                        >
                                                            {entry.subjectName}
                                                        </p>
                                                        {entry.courseCode && (
                                                            <p className="text-xs text-gray-500">
                                                                {entry.courseCode}
                                                            </p>
                                                        )}
                                                        {/* TODO: Display replaced info if implemented */}
                                                        {/* {entry.status === 'REPLACED' && <p className="text-xs text-yellow-700 italic">Replaced: {entry.originalSubjectName || 'Unknown'}</p>} */}
                                                    </div>
                                                    <p
                                                        className={`text-xs font-mono whitespace-nowrap pl-1 ${isCancelled ? 'text-gray-400' : 'text-gray-500'}`}
                                                    >
                                                        {entry.startTime || '--:--'} -{' '}
                                                        {entry.endTime || '--:--'}
                                                    </p>
                                                </div>
                                                {/* Admin Actions */}
                                                {isAdmin &&
                                                    !isCancelled && ( // Show actions only if admin and not already cancelled
                                                        <div className="flex space-x-1 mt-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-red-600 hover:bg-red-100 h-6 px-1"
                                                                onClick={() => handleCancel(entry)}
                                                                title="Cancel Class"
                                                                disabled={
                                                                    cancelClassMutation.isPending ||
                                                                    isMutatingThis
                                                                }
                                                            >
                                                                {isMutatingThis ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <XCircle size={14} />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-yellow-600 hover:bg-yellow-100 h-6 px-1"
                                                                onClick={() => handleReplace(entry)}
                                                                title="Replace Class (Not Implemented)"
                                                                disabled={true /*isMutatingThis*/}
                                                            >
                                                                <Repeat size={14} />
                                                            </Button>
                                                        </div>
                                                    )}
                                                {isCancelled && (
                                                    <p className="text-xs text-red-600 italic mt-1">
                                                        Cancelled
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        ))}
                </div>
            )}

            {/* TODO: Add Replace Class Modal */}
            {/* <Dialog open={isReplaceModalOpen} onOpenChange={setIsReplaceModalOpen}> ... </Dialog> */}
        </div>
    );
};

export default TimetableViewer;
