import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'; // Import UseMutationResult
import { attendanceService, CalendarEvent, AttendanceStatus, MarkAttendanceInput, BulkAttendanceInput, AttendanceRecordOutput } from '../services/attendance.service'; // Import types
import { streamService, StreamDetailed } from '../services/stream.service'; // Import stream service for start date
import { Calendar, Views, NavigateAction, View } from 'react-big-calendar'; // Import Views and View type
import localizer from '../lib/calendarLocalizer'; // Import your localizer
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, differenceInWeeks, parseISO, isSameDay, eachDayOfInterval } from 'date-fns'; // Import necessary date-fns functions
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Check, X, AlertCircle, HelpCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import 'react-big-calendar/lib/css/react-big-calendar.css'; // Import calendar CSS

// Define the structure for grouped data
interface DayData {
    date: Date;
    events: CalendarEvent[];
}
interface GroupedWeekData {
    [dayOfWeek: number]: DayData; // 1 (Mon) - 7 (Sun)
}

// --- Attendance Buttons Component ---
interface AttendanceButtonsProps {
    eventResource: CalendarEvent['resource'];
    streamId: string;
    classDate: Date;
    currentStatus: AttendanceStatus;
    // Use specific types for the mutation prop
    mutation: UseMutationResult<AttendanceRecordOutput, Error, MarkAttendanceInput>;
    setMutatingEntryKey: React.Dispatch<React.SetStateAction<string | null>>;
    mutatingEntryKey: string | null;
}

const AttendanceButtons: React.FC<AttendanceButtonsProps> = ({
    eventResource, streamId, classDate, currentStatus, mutation, setMutatingEntryKey, mutatingEntryKey
}) => {
    if (!eventResource) return null;

    const entryKey = `${format(classDate, 'yyyy-MM-dd')}_${eventResource.subjectName}`;
    const isMutatingThis = mutatingEntryKey === entryKey;

    const handleMark = (newStatus: AttendanceStatus) => {
        setMutatingEntryKey(entryKey);
        mutation.mutate({
            streamId: streamId,
            subjectName: eventResource.subjectName,
            courseCode: eventResource.courseCode,
            classDate: format(classDate, 'yyyy-MM-dd'),
            status: newStatus,
        });
    };

    const getButtonClass = (buttonStatus: AttendanceStatus) => {
        const isActive = currentStatus === buttonStatus;
        let base = 'p-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150';
        let colors = '';
        switch (buttonStatus) {
            case AttendanceStatus.OCCURRED:
                colors = isActive ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600';
                break;
            case AttendanceStatus.CANCELLED:
                colors = isActive ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600';
                break;
            case AttendanceStatus.REPLACED:
                colors = isActive ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300' : 'bg-gray-100 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600';
                break;
            case AttendanceStatus.PENDING:
                 colors = isActive ? 'bg-gray-200 text-gray-800 ring-1 ring-gray-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700';
                 break;
        }
        return `${base} ${colors}`;
    };

    return (
        <div className="flex space-x-1.5 mt-1">
            <button onClick={() => handleMark(AttendanceStatus.OCCURRED)} disabled={isMutatingThis} className={getButtonClass(AttendanceStatus.OCCURRED)} title="Occurred / Attended"> <Check className="w-4 h-4" /> </button>
            <button onClick={() => handleMark(AttendanceStatus.CANCELLED)} disabled={isMutatingThis} className={getButtonClass(AttendanceStatus.CANCELLED)} title="Cancelled"> <X className="w-4 h-4" /> </button>
            <button onClick={() => handleMark(AttendanceStatus.REPLACED)} disabled={isMutatingThis} className={getButtonClass(AttendanceStatus.REPLACED)} title="Replaced"> <AlertCircle className="w-4 h-4" /> </button>
            <button onClick={() => handleMark(AttendanceStatus.PENDING)} disabled={isMutatingThis} className={getButtonClass(AttendanceStatus.PENDING)} title="Reset to Pending"> <HelpCircle className="w-4 h-4" /> </button>
        </div>
    );
};


// --- Main Attendance Page Component ---
const AttendancePage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const queryClient = useQueryClient();

    // State
    const [weekOffset, setWeekOffset] = useState<number>(0); // Offset from stream start week
    const [mutatingEntryKey, setMutatingEntryKey] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null); // For marking status modal
    const [isMarkingModalOpen, setIsMarkingModalOpen] = useState(false);

    // State for Bulk Form
    const [bulkStartDate, setBulkStartDate] = useState('');
    const [bulkEndDate, setBulkEndDate] = useState('');
    const [bulkAttendanceValues, setBulkAttendanceValues] = useState<Record<string, string>>({});

    // --- Query 1: Fetch Stream Details (for start date) ---
    const { data: streamDetails, isLoading: isLoadingStream } = useQuery({
        queryKey: ['stream', streamId],
        queryFn: () => streamService.getStreamDetails(streamId!),
        enabled: !!streamId,
        staleTime: 1000 * 60 * 60, // Cache stream details for an hour
    });

    // Derive streamStartDate (start of the week) from the fetched details
    const streamStartDate = useMemo(() => {
        return streamDetails?.streamStartDate ? startOfWeek(parseISO(streamDetails.streamStartDate), { weekStartsOn: 1 }) : null;
    }, [streamDetails]);

    // --- Effect to set initial week offset ---
    useEffect(() => {
        if (streamStartDate) {
            const offset = differenceInWeeks(
                startOfWeek(new Date(), { weekStartsOn: 1 }),
                streamStartDate // Already start of week
                // Removed options object here as it caused error
            );
            setWeekOffset(offset >= 0 ? offset : 0);
        }
    }, [streamStartDate]);

    // --- Calculate current week based on derived start date and offset ---
    const currentWeekStart = useMemo(() => {
        if (!streamStartDate) return null;
        return addDays(streamStartDate, weekOffset * 7);
    }, [streamStartDate, weekOffset]);

    const currentWeekEnd = useMemo(() => currentWeekStart ? endOfWeek(currentWeekStart, { weekStartsOn: 1 }) : null, [currentWeekStart]);

    // --- Query 2: Fetch Attendance Data for the Current Week ---
    const { data: weekEvents = [], isLoading: isLoadingWeek, error } = useQuery({
        queryKey: ['attendanceWeek', streamId, currentWeekStart ? format(currentWeekStart, 'yyyy-MM-dd') : ''],
        queryFn: async (): Promise<CalendarEvent[]> => {
            if (!streamId || !currentWeekStart || !currentWeekEnd) return [];
            const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endDateStr = format(currentWeekEnd, 'yyyy-MM-dd');
            return attendanceService.getCalendarData(streamId, startDateStr, endDateStr);
        },
        enabled: !!streamId && !!currentWeekStart && !!currentWeekEnd && !isLoadingStream, // Enable only when dates are ready and stream isn't loading
        staleTime: 1000 * 60 * 1, // Cache week data for 1 minute
    });

    // --- Derive Subjects for Bulk Entry ---
    const subjectsForBulk = useMemo(() => {
        // TODO: Replace with a more robust method (e.g., fetch from backend based on active timetable)
        const subjectMap = new Map<string, { name: string; code: string | null }>();
        weekEvents.forEach(event => {
            if (event.resource && !subjectMap.has(event.resource.subjectName)) {
                subjectMap.set(event.resource.subjectName, {
                    name: event.resource.subjectName,
                    code: event.resource.courseCode || null,
                });
            }
        });
        return Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [weekEvents]);


    // --- React Query Mutations ---
    const markAttendanceMutation = useMutation<AttendanceRecordOutput, Error, MarkAttendanceInput>({
        mutationFn: attendanceService.markAttendance,
        onSuccess: (data, variables) => {
            toast.success(`Marked ${variables.subjectName} as ${variables.status}`);
            queryClient.invalidateQueries({ queryKey: ['attendanceWeek', streamId, currentWeekStart ? format(currentWeekStart, 'yyyy-MM-dd') : ''] });
            // Invalidate analytics queries
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
            queryClient.invalidateQueries({ queryKey: ['subjectStats', streamId] });
            setIsMarkingModalOpen(false);
            setSelectedEvent(null);
        },
        onError: (error) => { toast.error(`Update failed: ${error.message}`); },
        onSettled: () => { setMutatingEntryKey(null); }
    });

    const bulkAttendanceMutation = useMutation({
        mutationFn: attendanceService.recordBulkAttendance,
        onSuccess: (data) => {
            toast.success(data.message || "Bulk attendance recorded!");
             // Invalidate analytics queries
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
            queryClient.invalidateQueries({ queryKey: ['subjectStats', streamId] });
            setBulkAttendanceValues({});
            setBulkStartDate('');
            setBulkEndDate('');
        },
        onError: (error) => { toast.error(`Bulk entry failed: ${error.message}`); }
    });

    // --- Event Handlers ---
    const handleSelectEvent = useCallback((event: CalendarEvent) => {
        if (event.resource) {
            setSelectedEvent(event);
            setIsMarkingModalOpen(true);
        }
    }, []);

    const handleMarkStatus = (status: AttendanceStatus) => { /* ... as before ... */ };
    const handleBulkInputChange = (subjectName: string, value: string) => { /* ... as before ... */ };
    const handleBulkSubmit = (e: React.FormEvent) => { /* ... as before ... */ };
    const goToPreviousWeek = () => { setWeekOffset(prev => Math.max(0, prev - 1)); };
    const goToNextWeek = () => setWeekOffset(prev => prev + 1);
    const goToCurrentWeek = () => { /* ... as before ... */ };

    // --- Group Data ---
    const groupedData = useMemo((): GroupedWeekData => {
        if (!weekEvents || !currentWeekStart) return {};
        const groups: GroupedWeekData = {};
        const daysInWeek = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd! });
        daysInWeek.forEach(day => {
            const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
            const eventsForDay = weekEvents.filter(event => isSameDay(event.start, day));
            if (eventsForDay.length > 0) {
                groups[dayOfWeek] = {
                    date: day,
                    events: eventsForDay.sort((a, b) => a.start.getTime() - b.start.getTime()), // Sort by start time
                };
            }
        });
        return groups;
    }, [weekEvents, currentWeekStart, currentWeekEnd]);

    // --- Loading State ---
    const isLoading = isLoadingStream || (isLoadingWeek && !weekEvents.length); // Show loading if stream details or initial week data is loading

    // --- Render ---
    const weekDaysMap = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    return (
        <div className="space-y-8">
            {/* Header & Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Weekly Attendance</h1>
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
            {isLoading && <p className="text-center text-gray-500 py-10">Loading week data...</p>}
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
                                {groupedData[dayOfWeek].events.map((event, index) => (
                                    <div key={`${event.resource?.subjectName}-${index}-${event.start.toISOString()}`} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{event.resource?.subjectName}</p>
                                                {event.resource?.courseCode && <p className="text-xs text-gray-500">{event.resource.courseCode}</p>}
                                            </div>
                                            {/* Display Formatted Time */}
                                            <p className="text-xs text-gray-500 font-mono whitespace-nowrap pl-2">
                                                {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                                            </p>
                                        </div>
                                        <AttendanceButtons
                                            eventResource={event.resource}
                                            streamId={streamId!}
                                            classDate={event.start}
                                            currentStatus={event.resource?.status || AttendanceStatus.PENDING}
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
                     <span className="inline-flex items-center"><Check className="w-4 h-4 mr-1 text-green-600"/> Occurred/Attended</span>
                     <span className="inline-flex items-center"><X className="w-4 h-4 mr-1 text-red-600"/> Cancelled</span>
                     <span className="inline-flex items-center"><AlertCircle className="w-4 h-4 mr-1 text-yellow-600"/> Replaced</span>
                     <span className="inline-flex items-center"><HelpCircle className="w-4 h-4 mr-1 text-gray-500"/> Pending</span>
                 </div>
            </div>

            {/* Bulk Attendance Section */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Bulk Attendance Entry</h2>
                <p className="text-sm text-gray-600 mb-4">Enter the total classes you attended per subject for a given period. The system calculates total held classes based on the active timetable.</p>
                 <form onSubmit={handleBulkSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="bulkStartDate">Start Date <span className="text-red-500">*</span></Label>
                            <Input id="bulkStartDate" type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} required />
                        </div>
                         <div>
                            <Label htmlFor="bulkEndDate">End Date (Optional)</Label>
                            <Input id="bulkEndDate" type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} min={bulkStartDate || undefined} />
                        </div>
                    </div>
                     {subjectsForBulk.length > 0 && (
                         <div className="space-y-3 border-t pt-4">
                             <h3 className="text-lg font-medium text-gray-600">Enter Attended Classes:</h3>
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                                {subjectsForBulk.map(subject => (
                                    <div key={`bulk-${subject.name}`}>
                                        <Label htmlFor={`bulk-${subject.name}`} className="text-sm font-medium">
                                            {subject.name} {subject.code && `(${subject.code})`}
                                        </Label>
                                        <Input
                                            id={`bulk-${subject.name}`}
                                            type="number"
                                            min="0"
                                            placeholder="Attended"
                                            value={bulkAttendanceValues[subject.name] || ''}
                                            onChange={(e) => handleBulkInputChange(subject.name, e.target.value)}
                                            className="mt-1 h-9"
                                        />
                                    </div>
                                ))}
                             </div>
                         </div>
                     )}
                     {subjectsForBulk.length === 0 && !isLoading && (
                         <p className="text-sm text-gray-500 italic border-t pt-4">No subjects found based on recent calendar events. Fetching subjects based on timetable for the selected range would be more accurate.</p>
                     )}
                     <div className="flex justify-end pt-4 border-t">
                        <Button type="submit" disabled={bulkAttendanceMutation.isPending}>
                            {bulkAttendanceMutation.isPending ? 'Submitting...' : 'Submit Bulk Attendance'}
                        </Button>
                     </div>
                </form>
            </div>

            {/* Modal for Marking Attendance Status (Keep as before) */}
            <Dialog open={isMarkingModalOpen} onOpenChange={setIsMarkingModalOpen}>
                {/* ... DialogContent, Header, Footer, Buttons ... */}
            </Dialog>
        </div>
    );
};

export default AttendancePage;