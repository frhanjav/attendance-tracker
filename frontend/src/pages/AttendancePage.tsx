import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import {
    attendanceService,
    WeeklyAttendanceViewEntry, // Use this type now
    AttendanceStatus,
    MarkAttendanceInput,
    BulkAttendanceInput,
    AttendanceRecordOutput
} from '../services/attendance.service';
import { streamService, StreamDetailed } from '../services/stream.service';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInWeeks, parseISO } from 'date-fns';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Check, X, AlertCircle, HelpCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'; // Keep icons needed for legend/buttons
import toast from 'react-hot-toast';

// --- Attendance Button Component (Simplified) ---
interface AttendanceButtonProps {
    eventResource: WeeklyAttendanceViewEntry | null; // Use the view entry type
    streamId: string;
    classDate: Date; // Keep passing Date object here
    currentStatus: AttendanceStatus;
    mutation: UseMutationResult<AttendanceRecordOutput, Error, MarkAttendanceInput>;
    setMutatingEntryKey: React.Dispatch<React.SetStateAction<string | null>>;
    mutatingEntryKey: string | null;
}

const AttendanceButton: React.FC<AttendanceButtonProps> = ({
    eventResource, streamId, classDate, currentStatus, mutation, setMutatingEntryKey, mutatingEntryKey
}) => {
    if (!eventResource || currentStatus === AttendanceStatus.CANCELLED) {
         return <span className="text-xs text-red-600 italic mt-2 block h-7">Cancelled</span>;
    }

    // Use subjectName and potentially startTime for uniqueness if needed
    const entryKey = `${format(classDate, 'yyyy-MM-dd')}_${eventResource.subjectName}_${eventResource.startTime || 'no-start'}`;
    const isMutatingThis = mutatingEntryKey === entryKey;
    const isAttended = currentStatus === AttendanceStatus.OCCURRED;

    const handleToggle = () => {
        const newStatus = isAttended ? AttendanceStatus.MISSED : AttendanceStatus.OCCURRED;
        setMutatingEntryKey(entryKey);
        mutation.mutate({
            streamId: streamId,
            subjectName: eventResource.subjectName,
            courseCode: eventResource.courseCode,
            classDate: format(classDate, 'yyyy-MM-dd'), // Send YYYY-MM-DD string
            status: newStatus,
        });
    };

    return (
        <Button
            onClick={handleToggle}
            disabled={isMutatingThis}
            variant={isAttended ? "default" : "outline"}
            size="sm"
            className={`w-full mt-1 text-xs h-7 ${isAttended ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
            {isMutatingThis ? <Loader2 className="h-3 w-3 animate-spin"/> : (isAttended ? <> <Check size={14} className="mr-1"/> Attended</> : 'Mark Attended')}
        </Button>
    );
};


// --- Main Attendance Page Component ---
const AttendancePage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const queryClient = useQueryClient();
    const [weekOffset, setWeekOffset] = useState<number>(0);
    const [mutatingEntryKey, setMutatingEntryKey] = useState<string | null>(null);

    // --- Fetch Stream Details (for start date) ---
    const { data: streamDetails, isLoading: isLoadingStream } = useQuery<StreamDetailed, Error>({
        queryKey: ['stream', streamId],
        queryFn: () => streamService.getStreamDetails(streamId!),
        enabled: !!streamId,
        staleTime: 1000 * 60 * 60,
    });
    const streamStartDate = useMemo(() => streamDetails?.streamStartDate ? startOfWeek(parseISO(streamDetails.streamStartDate), { weekStartsOn: 1 }) : null, [streamDetails]);

    // --- Effect to set initial week offset ---
    useEffect(() => {
        if (streamStartDate) {
            const offset = differenceInWeeks(
                startOfWeek(new Date(), { weekStartsOn: 1 }),
                streamStartDate
            );
            setWeekOffset(offset >= 0 ? offset : 0);
        }
    }, [streamStartDate]);

    // --- Calculate current week ---
    const currentWeekStart = useMemo(() => streamStartDate ? addDays(streamStartDate, weekOffset * 7) : null, [streamStartDate, weekOffset]);
    const currentWeekEnd = useMemo(() => currentWeekStart ? endOfWeek(currentWeekStart, { weekStartsOn: 1 }) : null, [currentWeekStart]);

    // --- Fetch Weekly Attendance View Data ---
    const queryKey = ['weeklyAttendanceView', streamId, currentWeekStart ? format(currentWeekStart, 'yyyy-MM-dd') : ''];
    const { data: weekAttendance = [], isLoading: isLoadingWeek, error } = useQuery<WeeklyAttendanceViewEntry[], Error>({
        queryKey: queryKey,
        queryFn: async () => {
            if (!streamId || !currentWeekStart || !currentWeekEnd) return [];
            const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endDateStr = format(currentWeekEnd, 'yyyy-MM-dd');
            return await attendanceService.getWeeklyAttendanceView(streamId, startDateStr, endDateStr);
        },
        enabled: !!streamId && !!currentWeekStart && !!currentWeekEnd && !isLoadingStream,
        staleTime: 1000 * 60 * 1,
    });

    // --- Derive Subjects for Bulk Entry ---
    const subjectsForBulk = useMemo(() => {
        const subjectMap = new Map<string, { name: string; code: string | null }>();
        weekAttendance.forEach(entry => {
            if (!subjectMap.has(entry.subjectName)) {
                subjectMap.set(entry.subjectName, { name: entry.subjectName, code: entry.courseCode || null });
            }
        });
        return Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [weekAttendance]);

    // --- Mutations ---
    const markAttendanceMutation = useMutation<AttendanceRecordOutput, Error, MarkAttendanceInput>({
        mutationFn: attendanceService.markAttendance,
        onSuccess: (data, variables) => {
            toast.success(`Attendance updated for ${variables.subjectName}`);
            queryClient.invalidateQueries({ queryKey: queryKey }); // Invalidate current week view
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
            queryClient.invalidateQueries({ queryKey: ['subjectStats', streamId] }); // Use actual keys if different
        },
        onError: (error) => { toast.error(`Update failed: ${error.message}`); },
        onSettled: () => { setMutatingEntryKey(null); }
    });



    // --- Handlers ---

    const goToPreviousWeek = () => { setWeekOffset(prev => Math.max(0, prev - 1)); };
    const goToNextWeek = () => setWeekOffset(prev => prev + 1);
    const goToCurrentWeek = () => {
         if (streamStartDate) {
             const offset = differenceInWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), streamStartDate);
             setWeekOffset(offset >= 0 ? offset : 0);
         } else { setWeekOffset(0); }
    };

    // --- Group Data ---
    const groupedData = useMemo((): { [key: number]: { date: Date; entries: WeeklyAttendanceViewEntry[] } } => {
        if (!weekAttendance || !currentWeekStart || !currentWeekEnd) return {};
        const groups: { [key: number]: { date: Date; entries: WeeklyAttendanceViewEntry[] } } = {};
        const daysInWeek = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });
        daysInWeek.forEach((day: Date) => {
            const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
            const entriesForDay = weekAttendance.filter((entry: WeeklyAttendanceViewEntry) => isSameDay(parseISO(entry.date), day));
            // Only add day if there are entries for it
            if (entriesForDay.length > 0) {
                groups[dayOfWeek] = {
                    date: day,
                    entries: entriesForDay.sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99')),
                };
            }
        });
        return groups;
    }, [weekAttendance, currentWeekStart, currentWeekEnd]);

    // --- Loading State ---
    const isLoading = isLoadingStream || (isLoadingWeek && !weekAttendance.length);

    // --- Render ---
    const weekDaysMap = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    return (
        <div className="space-y-8">
            {/* Header & Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Mark Weekly Attendance</h1>
                <div className="flex items-center space-x-2">
                    <Button onClick={goToPreviousWeek} variant="outline" size="sm" disabled={isLoading || !streamStartDate || weekOffset <= 0}> <ArrowLeft size={16} className="mr-1" /> Prev </Button>
                    <Button onClick={goToCurrentWeek} variant="outline" size="sm" disabled={isLoading || !streamStartDate}> Today's Week </Button>
                    <Button onClick={goToNextWeek} variant="outline" size="sm" disabled={isLoading || !streamStartDate}> Next <ArrowRight size={16} className="ml-1" /> </Button>
                </div>
            </div>

            {/* Week Info */}
            {currentWeekStart && currentWeekEnd && (
                 <div className="text-center text-lg font-semibold text-gray-700">
                    Week {weekOffset + 1}: {format(currentWeekStart, 'MMM dd')} - {format(currentWeekEnd, 'MMM dd, yyyy')}
                </div>
            )}

            {/* Loading / Error / Content */}
            {isLoading && <div className="text-center py-10 text-gray-500 flex justify-center items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading attendance data...</div>}
            {!isLoading && error && <p className="text-center text-red-500 py-10">Error loading data: {error.message}</p>}
            {!isLoading && !error && Object.keys(groupedData).length === 0 && (
                 <p className="text-center text-gray-500 py-10 italic">No classes scheduled for this week.</p>
            )}
            {!isLoading && !error && Object.keys(groupedData).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {Object.keys(groupedData).map(Number).sort().map(dayOfWeek => (
                        <Card key={dayOfWeek} className="shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            <CardHeader className="pb-3 pt-4 px-4 bg-gray-50 rounded-t-lg border-b">
                                <CardTitle className="text-base font-semibold text-gray-700">
                                    {weekDaysMap[dayOfWeek]}, {format(groupedData[dayOfWeek].date, 'MMM dd')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 flex-grow">
                                {groupedData[dayOfWeek].entries.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">No classes</p>}
                                {groupedData[dayOfWeek].entries.map((entry, index) => (
                                    <div key={`${entry.subjectName}-${entry.startTime || index}`} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <p className={`text-sm font-medium ${entry.status === AttendanceStatus.CANCELLED ? 'line-through text-gray-500' : 'text-gray-900'}`}>{entry.subjectName}</p>
                                                {entry.courseCode && <p className="text-xs text-gray-500">{entry.courseCode}</p>}
                                            </div>
                                            <p className={`text-xs font-mono whitespace-nowrap pl-1 ${entry.status === AttendanceStatus.CANCELLED ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {entry.startTime || '--:--'} - {entry.endTime || '--:--'}
                                            </p>
                                        </div>
                                        {/* Use simplified AttendanceButton */}
                                        <AttendanceButton
                                            eventResource={entry} // Pass the whole entry
                                            streamId={streamId!}
                                            classDate={parseISO(entry.date)} // Parse date string back to Date for key generation maybe? Or keep string? Let's use Date.
                                            currentStatus={entry.status}
                                            mutation={markAttendanceMutation}
                                            setMutatingEntryKey={setMutatingEntryKey}
                                            mutatingEntryKey={mutatingEntryKey}
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Legend */}
            <div className="mt-8 pt-4 border-t">
                 <h3 className="text-sm font-semibold mb-2 text-gray-600">Legend:</h3>
                 <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                     <span className="inline-flex items-center"><Check className="w-4 h-4 mr-1 text-green-600"/> Attended</span>
                     <span className="inline-flex items-center"><span className="w-4 h-4 mr-1 text-gray-400 flex items-center justify-center">-</span> Missed (Default)</span>
                     <span className="inline-flex items-center"><X className="w-4 h-4 mr-1 text-red-600"/> Cancelled (by Admin)</span>
                 </div>
            </div>

        </div>
    );
};

export default AttendancePage;