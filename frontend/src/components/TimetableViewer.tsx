import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, eachDayOfInterval, endOfWeek, format, isSameDay, parseISO, startOfWeek, subDays } from 'date-fns';
import { ArrowLeft, ArrowRight, Loader2, Plus, Repeat, XCircle } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useOptimisticAttendanceUpdates } from '../hooks/useOptimisticAttendanceUpdates';
import {
  AddSubjectInput,
  attendanceService,
  AttendanceStatus,
  CancelClassInput,
  ReplaceClassInput,
  WeeklyAttendanceViewEntry,
} from '../services/attendance.service';
import { TimetableOutput, timetableService } from '../services/timetable.service';
import { generateEntryKey, generateMutationKey } from '../utils/simpleIndexing';

interface TimetableViewerProps {
    streamId: string;
    isAdmin: boolean;
}

interface GroupedViewData {
    [dayOfWeek: number]: { date: Date; entries: WeeklyAttendanceViewEntry[] };
}

interface SubjectOption {
    name: string;
    code: string | null;
}

const TimetableViewer: React.FC<TimetableViewerProps> = ({ streamId, isAdmin }) => {
    const queryClient = useQueryClient();
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [mutatingEntryKey, setMutatingEntryKey] = useState<string | null>(null);

    const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    const [entryToReplace, setEntryToReplace] = useState<{entry: WeeklyAttendanceViewEntry, subjectIndex: number} | null>(null);
    const [replacementSubjectName, setReplacementSubjectName] = useState('');

    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [entryToCancel, setEntryToCancel] = useState<{entry: WeeklyAttendanceViewEntry, subjectIndex: number} | null>(null);

    const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
    const [addSubjectDate, setAddSubjectDate] = useState<Date | null>(null);
    const [addSubjectName, setAddSubjectName] = useState('');

    const currentWeekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 1 }), [currentWeekStart]);

    const queryKey = useMemo(() => ['weeklyAttendanceView', streamId, format(currentWeekStart, 'yyyy-MM-dd')], [streamId, currentWeekStart]);
    const { data: weekAttendance = [], isLoading, error, isFetching } = useQuery<WeeklyAttendanceViewEntry[], Error>({
        queryKey: queryKey,
        queryFn: async () => {
            const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endDateStr = format(currentWeekEnd, 'yyyy-MM-dd');
            return await attendanceService.getWeeklyAttendanceView(streamId, startDateStr, endDateStr);
        },
        enabled: !!streamId && !!currentWeekStart && !!currentWeekEnd
    });

    const optimisticUpdates = useOptimisticAttendanceUpdates({
        queryClient,
        queryKey
    });

    const { data: activeTimetable } = useQuery<TimetableOutput | null, Error>({
        queryKey: ['activeTimetable', streamId, format(currentWeekStart, 'yyyy-MM-dd')],
        queryFn: () => {
            if (!currentWeekStart) return null;
            return timetableService.getActiveTimetableForDate(streamId, format(currentWeekStart, 'yyyy-MM-dd'));
        },
        enabled: !!streamId && (isReplaceModalOpen || isAddSubjectModalOpen)
    });

    const availableReplacementSubjects = useMemo((): SubjectOption[] => {
        if (!activeTimetable?.entries || !entryToReplace) return [];
        const subjects = activeTimetable.entries
            .filter(entry => entry.subjectName !== entryToReplace.entry.subjectName)
            .map(entry => ({ name: entry.subjectName, code: entry.courseCode || null }));
        return Array.from(new Map(subjects.map(s => [`${s.name}::${s.code}`, s])).values())
               .sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTimetable, entryToReplace]);

    const availableAddSubjects = useMemo((): SubjectOption[] => {
        if (!activeTimetable?.entries) return [];
        const subjects = activeTimetable.entries
            .map(entry => ({ name: entry.subjectName, code: entry.courseCode || null }));
        return Array.from(new Map(subjects.map(s => [`${s.name}::${s.code}`, s])).values())
               .sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTimetable]);

    const cancelClassMutation = useMutation<unknown, Error, CancelClassInput>({
        mutationFn: attendanceService.cancelClassGlobally,
        onMutate: async (variables) => {
            if (!entryToCancel) return null;
            return await optimisticUpdates.optimisticallyCancelClass({
                date: variables.classDate,
                subjectName: variables.subjectName,
                entryIndex: variables.entryIndex
            });
        },
        onSuccess: async (data: any) => {
            optimisticUpdates.handleOptimisticSuccess(data?.message || "Class cancelled for all students.");
        },
        onError: (err: Error, _variables, previousData: any) => {
            optimisticUpdates.handleOptimisticError(err, previousData);
        },
        onSettled: () => { setMutatingEntryKey(null); setIsCancelConfirmOpen(false); setEntryToCancel(null); }
    });    const replaceClassMutation = useMutation<unknown, Error, ReplaceClassInput>({
         mutationFn: attendanceService.replaceClassGlobally,
         onMutate: async (variables) => {
            if (!entryToReplace) return null;
            return await optimisticUpdates.optimisticallyReplaceClass({
                date: variables.classDate,
                originalSubjectName: variables.originalSubjectName,
                replacementSubjectName: variables.replacementSubjectName,
                replacementCourseCode: variables.replacementCourseCode,
                entryIndex: variables.entryIndex,
                startTime: variables.originalStartTime,
                endTime: entryToReplace.entry.endTime,
                dayOfWeek: entryToReplace.entry.dayOfWeek,
            });
        },
         onSuccess: async (data: any) => {
            optimisticUpdates.handleOptimisticSuccess(data?.message || "Class replaced successfully.");
            handleCloseReplaceModal();

            if (data?.replacementSubjectIndex !== undefined) {
                console.log(' Backend calculated replacement index:', data.replacementSubjectIndex);
                queryClient.invalidateQueries({ queryKey: ['weeklyAttendanceView', streamId] });
            }
        },
        onError: (err: Error, _variables, previousData: any) => {
            optimisticUpdates.handleOptimisticError(err, previousData);
        },
        onSettled: () => setMutatingEntryKey(null),
    });

    const addSubjectMutation = useMutation<unknown, Error, AddSubjectInput>({
        mutationFn: attendanceService.addSubjectGlobally,
        onMutate: async (variables) => {
            if (!addSubjectDate) return null;
            const dayOfWeek = addSubjectDate.getDay() === 0 ? 7 : addSubjectDate.getDay();
            return await optimisticUpdates.optimisticallyAddSubject({
                date: variables.classDate,
                subjectName: variables.subjectName,
                courseCode: variables.courseCode,
                dayOfWeek: dayOfWeek,
                startTime: variables.startTime,
                endTime: variables.endTime,
                entryIndex: variables.entryIndex
            });
        },
        onSuccess: async (data: any) => {
            optimisticUpdates.handleOptimisticSuccess(data?.message || "Subject added successfully.");
            handleCloseAddSubjectModal();
        },
        onError: (err: Error, _variables, previousData: any) => {
            optimisticUpdates.handleOptimisticError(err, previousData);
        },
        onSettled: () => setMutatingEntryKey(null),
    });

    const goToPreviousWeek = () => {
        queryClient.invalidateQueries({ queryKey: ['weeklyAttendanceView', streamId], exact: false });
        setCurrentWeekStart(prev => subDays(prev, 7));
    };
    const goToNextWeek = () => {
        queryClient.invalidateQueries({ queryKey: ['weeklyAttendanceView', streamId], exact: false });
        setCurrentWeekStart(prev => addDays(prev, 7));
    };

    const openCancelConfirm = (entry: WeeklyAttendanceViewEntry) => {
        if (!isAdmin) return;

        if (entry.subjectIndex === undefined) {
            console.error('Missing subjectIndex for cancel operation:', entry);
        }
        const subjectIndex = entry.subjectIndex ?? 0;

        setEntryToCancel({entry, subjectIndex});
        setIsCancelConfirmOpen(true);
    };

    const handleConfirmCancel = () => {
        if (!entryToCancel || !streamId || cancelClassMutation.isPending) return;
        const {entry, subjectIndex} = entryToCancel;

        const mutationKey = generateMutationKey(entry);
        setMutatingEntryKey(mutationKey);
        
        const mutationPayload = {
            streamId,
            classDate: entry.date,
            subjectName: entry.isReplacement ? entry.originalSubjectName! : entry.subjectName,
            startTime: entry.startTime,
            entryIndex: subjectIndex
        };
        
        cancelClassMutation.mutate(mutationPayload);
    };

    const openReplaceModal = (entry: WeeklyAttendanceViewEntry) => {
        if (!isAdmin || entry.isReplacement) return;

        if (entry.subjectIndex === undefined) {
            console.error('Missing subjectIndex for replace operation:', entry);
        }
        const subjectIndex = entry.subjectIndex ?? 0;

        setEntryToReplace({entry, subjectIndex});
        setReplacementSubjectName('');
        setIsReplaceModalOpen(true);
    };

    const handleCloseReplaceModal = () => {
        setIsReplaceModalOpen(false); setEntryToReplace(null); setReplacementSubjectName('');
    };

    const handleReplaceSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!entryToReplace || !replacementSubjectName || !streamId || replaceClassMutation.isPending) return;
        const {entry, subjectIndex} = entryToReplace;
        const selectedSubjectData = availableReplacementSubjects.find(s => s.name === replacementSubjectName);

        const mutationKey = generateMutationKey(entry);
        setMutatingEntryKey(mutationKey);
        const payload: ReplaceClassInput = {
            streamId,
            classDate: entry.date,
            originalSubjectName: entry.subjectName,
            originalStartTime: entry.startTime,
            replacementSubjectName: replacementSubjectName,
            replacementCourseCode: selectedSubjectData?.code,
            entryIndex: subjectIndex
        };
        replaceClassMutation.mutate(payload);
    };

    const openAddSubjectModal = (date: Date) => {
        if (!isAdmin) return;
        setAddSubjectDate(date);
        setAddSubjectName('');
        setIsAddSubjectModalOpen(true);
    };

    const handleCloseAddSubjectModal = () => {
        setIsAddSubjectModalOpen(false);
        setAddSubjectDate(null);
        setAddSubjectName('');
    };

    const handleAddSubjectSubmit = () => {
        if (!addSubjectDate || !addSubjectName || !streamId || addSubjectMutation.isPending) return;

        const selectedSubject = availableAddSubjects.find(subject => subject.name === addSubjectName);
        if (!selectedSubject) return;

        const dateStr = format(addSubjectDate, 'yyyy-MM-dd');

        const allInstancesOnDate = weekAttendance?.filter(entry =>
            entry.date === dateStr && (
                entry.subjectName === selectedSubject.name ||
                entry.originalSubjectName === selectedSubject.name
            )
        ) || [];

        const existingIndices = allInstancesOnDate
            .map(entry => entry.subjectIndex)
            .filter(index => index !== undefined) as number[];

        const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;


        const entryKey = `${dateStr}_ADD_${addSubjectName}_${nextIndex}`;
        setMutatingEntryKey(entryKey);
        const payload: AddSubjectInput = {
            streamId,
            classDate: dateStr,
            subjectName: selectedSubject.name,
            courseCode: selectedSubject.code,
            startTime: null,
            endTime: null,
            entryIndex: nextIndex,
        };
        addSubjectMutation.mutate(payload);
    };

    const groupedData = useMemo((): GroupedViewData => {
        if (!weekAttendance) return {};
        const groups: GroupedViewData = {};
        const daysInWeek = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

        daysInWeek.forEach((day: Date) => {
            const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
            const entriesForDay = weekAttendance.filter((entry: WeeklyAttendanceViewEntry) => isSameDay(parseISO(entry.date), day));

            if (entriesForDay.length > 0) {
                const sortedEntries = entriesForDay.sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
                groups[dayOfWeek] = {
                    date: day,
                    entries: sortedEntries,
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
                                {groupedData[dayOfWeek].entries.map((entry, localIndex) => {
                                    const entryKey = generateEntryKey(entry, localIndex);
                                    const mutationKey = generateMutationKey(entry);

                                    const isMutatingThis = mutatingEntryKey === mutationKey;
                                    const isCancelled = entry.status === AttendanceStatus.CANCELLED;

                                    const isReplacement = entry.isReplacement;
                                    
                                    
                                    let borderColor = 'border-blue-300';
                                    if (isCancelled) borderColor = 'border-red-300';
                                    if (isReplacement && !entry.isAdded) borderColor = 'border-green-400';
                                    if (entry.isAdded) borderColor = 'border-blue-400';

                                    return (
                                        <div key={entryKey} className={`border-l-4 ${borderColor} pl-2 py-1 transition-colors duration-200 ${isCancelled ? 'bg-red-50/50 opacity-70' : entry.isAdded ? 'bg-blue-50/50' : isReplacement ? 'bg-green-50/50' : ''}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    {/* Show Replacement Indicator */}
                                                    {isReplacement && !entry.isAdded && (
                                                        <span className="text-xs text-green-700 font-medium flex items-center">
                                                            <Repeat size={12} className="mr-1"/> Replacement
                                                        </span>
                                                    )}
                                                    {/* Show Added Indicator */}
                                                    {entry.isAdded && (
                                                        <span className="text-xs text-blue-700 font-medium flex items-center">
                                                            <Plus size={12} className="mr-1"/> Added
                                                        </span>
                                                    )}
                                                    {/* Show Subject Name */}
                                                    <p className={`font-medium text-sm ${isCancelled ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                        {entry.subjectName}
                                                    </p>
                                                    {entry.courseCode && <p className="text-xs text-gray-500">{entry.courseCode}</p>}
                                                    {/* Show Original Subject if Replacement */}
                                                    {isReplacement && !entry.isAdded && entry.originalSubjectName && (
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
                                                    {/* Show Cancel/Replace only for non-cancelled, non-replacement, non-added entries */}
                                                    {!isCancelled && !isReplacement && !entry.isAdded && (
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
                                                    {isReplacement && !entry.isAdded && <p className="text-xs text-green-700 italic">Replacement Added</p>}
                                                    {entry.isAdded && <p className="text-xs text-blue-700 italic">Added</p>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Add Subject Button - Admin Only */}
                                {isAdmin && (
                                    <div className="mt-3 pt-2 border-t border-gray-200">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="w-full text-blue-600 hover:bg-blue-50 border-blue-200"
                                            onClick={() => openAddSubjectModal(groupedData[dayOfWeek].date)}
                                            title="Add Subject"
                                        >
                                            <Plus size={14} className="mr-1" /> Add Subject
                                        </Button>
                                    </div>
                                )}
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
                            Are you sure you want to cancel the class "{entryToCancel?.entry.subjectName}"
                            on {entryToCancel ? format(parseISO(entryToCancel.entry.date), 'MMM dd, yyyy') : ''}
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
             <Dialog open={isReplaceModalOpen} onOpenChange={handleCloseReplaceModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Replace Class</DialogTitle>
                        <DialogDescription>
                            Replace "{entryToReplace?.entry.subjectName}" on {entryToReplace ? format(parseISO(entryToReplace.entry.date), 'MMM dd, yyyy') : ''}.
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
                         <DialogFooter>
                            <Button type="button" variant="ghost" onClick={handleCloseReplaceModal} disabled={replaceClassMutation.isPending}>Cancel</Button>
                            <Button type="submit" disabled={!replacementSubjectName || replaceClassMutation.isPending}>
                                {replaceClassMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Replacing...</> : 'Confirm Replacement'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
             </Dialog>

            {/* Add Subject Modal */}
            <Dialog open={isAddSubjectModalOpen} onOpenChange={setIsAddSubjectModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Subject</DialogTitle>
                        <DialogDescription>
                            Add a subject for {addSubjectDate ? format(addSubjectDate, 'MMM dd, yyyy') : ''}.
                            Select from subjects in your timetable.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                         <div>
                            <Label htmlFor="addSubjectSelect">Subject <span className="text-red-500">*</span></Label>
                            <Select
                                onValueChange={setAddSubjectName}
                                value={addSubjectName}
                                required
                                disabled={addSubjectMutation.isPending}
                            >
                                <SelectTrigger id="addSubjectSelect">
                                    <SelectValue placeholder="Select subject..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableAddSubjects.length === 0 && <SelectItem value="loading" disabled>No subjects found in timetable</SelectItem>}
                                    {availableAddSubjects.map(sub => (
                                        <SelectItem key={`${sub.name}-${sub.code}`} value={sub.name}>
                                            {sub.name} {sub.code && `(${sub.code})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                         <DialogFooter>
                            <Button type="button" variant="ghost" onClick={handleCloseAddSubjectModal} disabled={addSubjectMutation.isPending}>Cancel</Button>
                            <Button onClick={handleAddSubjectSubmit} disabled={!addSubjectName || addSubjectMutation.isPending}>
                                {addSubjectMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Adding...</> : 'Add Subject'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TimetableViewer;