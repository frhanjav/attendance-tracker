// frontend/src/components/CreateTimetableModal.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form'; // Ensure imports
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { timetableService, TimetableOutput, TimetableBasicInfo, CreateTimetableFrontendInput } from '../services/timetable.service';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Trash2, PlusCircle, Import, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseISO, format} from 'date-fns';
import { SubjectInputBlockProps, SubjectInputBlock } from '../pages/TimetableDetailPage';
import { ApiError } from '../lib/apiClient'; // Import the standardized ApiError type


// --- Zod Schemas (Define or Import) ---
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const invalidTimeMessage = "Invalid time (HH:MM)";
const timeSlotSchema = z.object({
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startTime: z.string().optional().refine((val) => !val || timeRegex.test(val), { message: invalidTimeMessage }),
    endTime: z.string().optional().refine((val) => !val || timeRegex.test(val), { message: invalidTimeMessage }),
}).refine(data => !data.startTime || !data.endTime || data.endTime > data.startTime, { message: "End time must be after start time", path: ["endTime"] });

const subjectSchema = z.object({
    subjectName: z.string().min(1, { message: 'Subject name is required' }),
    courseCode: z.string().optional(),
    timeSlots: z.array(timeSlotSchema).min(1, { message: 'Add at least one time slot' })
});

const createTimetableFormSchema = z.object({
    name: z.string().min(1, { message: 'Timetable name is required' }),
    validFrom: z.string().min(1, { message: 'Valid from date is required' }),
    validUntil: z.string().optional().nullable(),
    subjects: z.array(subjectSchema).min(1, { message: 'Add at least one subject' })
}).refine(data => !data.validUntil || !data.validFrom || new Date(data.validUntil) >= new Date(data.validFrom), { message: "Valid until must be on or after valid from", path: ["validUntil"] });

type CreateTimetableFormInputs = z.infer<typeof createTimetableFormSchema>;
// --- End Schemas ---

const weekDays = [
    { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
];

interface CreateTimetableModalProps {
    isOpen: boolean;
    onClose: () => void;
    streamId: string;
}

const CreateTimetableModal: React.FC<CreateTimetableModalProps> = ({ isOpen, onClose, streamId }) => {
    const queryClient = useQueryClient();
    const [formError, setFormError] = useState<string | null>(null);
    const [selectedImportId, setSelectedImportId] = useState<string>("");

    // --- Form Setup ---
    const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<CreateTimetableFormInputs>({
        resolver: zodResolver(createTimetableFormSchema),
        defaultValues: { name: '', validFrom: '', validUntil: '', subjects: [{ subjectName: '', courseCode: '', timeSlots: [{ dayOfWeek: 1, startTime: '', endTime: '' }] }] },
        mode: 'onSubmit',
    });
    const { fields: subjectFields, append: appendSubject, remove: removeSubject, replace: replaceSubjects } = useFieldArray({ control, name: "subjects" });

    // --- Fetch Timetable List for Import ---
    const { data: importableTimetables = [], isLoading: isLoadingImportList } = useQuery<TimetableBasicInfo[], Error>({
        queryKey: ['timetableList', streamId],
        queryFn: () => timetableService.getTimetableListForImport(streamId),
        enabled: isOpen && !!streamId, // Fetch only when modal is open
        staleTime: 1000 * 60 * 10, // Cache list for 10 mins
    });

    // --- Fetch Details of Timetable to Import ---
    // Use a separate query, enabled only when an import ID is selected
    const { data: timetableToImport, isFetching: isFetchingImportDetails } = useQuery<TimetableOutput, Error>({
        queryKey: ['timetableDetails', selectedImportId],
        queryFn: () => timetableService.getTimetableDetails(selectedImportId),
        enabled: !!selectedImportId, // Only run when an ID is selected
        staleTime: Infinity, // Cache indefinitely once fetched
    });

    // --- Effect to Populate Form When Import Data is Ready ---
    useEffect(() => {
        if (timetableToImport) {
            // Transform the flat entries of the imported timetable into nested subjects
            const formData = transformApiDataToFormData(timetableToImport); // Reuse transformer
            if (formData) {
                // Reset the form with data from the imported timetable
                // Keep name/dates potentially empty for user to fill
                reset({
                    name: '', // Let user name the new one
                    validFrom: '', // Let user set new dates
                    validUntil: '',
                    subjects: formData.subjects, // Populate subjects/timeslots
                });
                toast.success(`Imported schedule from "${timetableToImport.name}". Please set a new name and validity dates.`);
            } else {
                 toast.error("Failed to process data from timetable to import.");
            }
            setSelectedImportId(""); // Clear selection after import
        }
    }, [timetableToImport, reset]);

    // --- Create Mutation ---
    const createTimetableMutation = useMutation<TimetableOutput, Error, { streamId: string } & CreateTimetableFrontendInput>({
        mutationFn: timetableService.createTimetable,
        onSuccess: () => {
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ['timetables', streamId] });
            queryClient.invalidateQueries({ queryKey: ['timetableList', streamId] });
            queryClient.invalidateQueries({ queryKey: ['weeklySchedule', streamId] }); // Invalidate viewer on main page
            queryClient.invalidateQueries({ queryKey: ['attendanceWeek', streamId] }); // Invalidate attendance page week view
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] }); // Invalidate analytics

            reset(); // Reset form
            setFormError(null);
            onClose(); // Close modal
            toast.success("Timetable created successfully!");
        },
        // --- CORRECTED onError ---
        onError: (error: Error | ApiError) => { // Expect Error or our custom ApiError
            console.error("Create Timetable Mutation failed:", error);
            let displayMessage = "An unknown error occurred.";

            // Check if it's our standardized ApiError from the interceptor
            if (error && typeof error === 'object' && 'message' in error) {
                 // It might be ApiError OR a standard Error with a message
                 // Prioritize the message property if it exists
                 displayMessage = (error as ApiError).message;
            }
            // No need for instanceof Error check if the primary check covers it

            setFormError(displayMessage); // Set local form error state if desired
            toast.error(`Failed to create timetable: ${displayMessage}`);
        },
        // --- End Correction ---
    });

    // --- Form Submit Handler ---
    const onSubmit = (data: CreateTimetableFormInputs) => {
        setFormError(null);
        createTimetableMutation.mutate({ streamId, ...data });
    };

    // --- Close Handler ---
    const handleClose = () => {
        reset(); // Reset form on close
        setFormError(null);
        setSelectedImportId("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Create New Timetable</DialogTitle>
                    <DialogDescription>
                        Define the schedule for this stream. New timetables override older ones for future dates.
                    </DialogDescription>
                </DialogHeader>

                {/* Import Section */}
                <div className="flex items-end gap-2 border-b pb-4 mb-4">
                    <div className="flex-grow">
                        <Label htmlFor="importSelect" className="text-xs font-medium">Import Schedule From (Optional)</Label>
                        <Select onValueChange={setSelectedImportId} value={selectedImportId} disabled={isLoadingImportList || isFetchingImportDetails}>
                            <SelectTrigger id="importSelect" className="h-9">
                                <SelectValue placeholder="Select previous timetable..." />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoadingImportList && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                                {importableTimetables.map(tt => (
                                    <SelectItem key={tt.id} value={tt.id}>{tt.name} ({format(parseISO(tt.validFrom), 'MMM yyyy')})</SelectItem>
                                ))}
                                {importableTimetables.length === 0 && !isLoadingImportList && <SelectItem value="none" disabled>No previous timetables</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={!selectedImportId || isFetchingImportDetails}>
                        {isFetchingImportDetails ? <Loader2 className="h-4 w-4 animate-spin"/> : <Import size={16}/>}
                    </Button>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 overflow-y-auto flex-grow pr-2">
                    {/* General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Name, ValidFrom, ValidUntil fields */}
                         <div>
                            <Label htmlFor="create-name">Timetable Name <span className="text-red-500">*</span></Label>
                            <Input id="create-name" {...register('name')} placeholder="e.g., Sem 1 (Fall 2024)" className={errors.name ? 'border-red-500' : ''} />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="create-validFrom">Valid From <span className="text-red-500">*</span></Label>
                            <Input id="create-validFrom" type="date" {...register('validFrom')} className={errors.validFrom ? 'border-red-500' : ''} />
                             {errors.validFrom && <p className="text-red-500 text-xs mt-1">{errors.validFrom.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="create-validUntil">Valid Until (Optional)</Label>
                            <Input id="create-validUntil" type="date" {...register('validUntil')} className={errors.validUntil ? 'border-red-500' : ''} />
                             {errors.validUntil && <p className="text-red-500 text-xs mt-1">{errors.validUntil.message}</p>}
                        </div>
                    </div>

                    {/* Subjects Section */}
                    <div className="space-y-4 border-t pt-4">
                        <h3 className="text-base font-medium text-gray-700">Subjects & Schedules <span className="text-red-500">*</span></h3>
                        {subjectFields.map((subjectField, subjectIndex) => (
                            <SubjectInputBlock
                                key={subjectField.id}
                                subjectIndex={subjectIndex}
                                control={control}
                                register={register}
                                removeSubject={removeSubject}
                                errors={errors}
                            />
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => appendSubject({ subjectName: '', courseCode: '', timeSlots: [{ dayOfWeek: 1, startTime: '', endTime: '' }] })} className="inline-flex items-center">
                           <PlusCircle size={16} className="mr-1"/> Add Subject
                        </Button>
                        {errors.subjects?.root && <p className="text-red-500 text-xs mt-1">{errors.subjects.root.message}</p>}
                        {errors.subjects?.message && <p className="text-red-500 text-xs mt-1">{errors.subjects.message}</p>}
                    </div>

                    {/* Form Error Display */}
                    {formError && (
                         <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">{formError}</p>
                    )}


                     {/* Footer with Submit Button */}
                    <DialogFooter className="mt-6 pt-4 border-t">
                         <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                         <Button type="submit" disabled={isSubmitting || createTimetableMutation.isPending}>
                            {createTimetableMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Timetable'}
                        </Button>
                    </DialogFooter>
                </form>

            </DialogContent>
        </Dialog>
    );
};

// Helper function to transform flat API data to nested form data (needed for import)
// Ensure this function exists and is correct
const transformApiDataToFormData = (apiData: TimetableOutput | null): CreateTimetableFormInputs | null => {
    if (!apiData) return null;
    const subjectsMap = new Map<string, { subjectName: string; courseCode?: string; timeSlots: any[] }>();
    apiData.entries.forEach((entry: any) => {
        const key = `${entry.subjectName}-${entry.courseCode || ''}`;
        if (!subjectsMap.has(key)) {
            subjectsMap.set(key, { subjectName: entry.subjectName, courseCode: entry.courseCode || '', timeSlots: [] });
        }
        subjectsMap.get(key)?.timeSlots.push({
            dayOfWeek: entry.dayOfWeek, startTime: entry.startTime || '', endTime: entry.endTime || '',
        });
    });
    return {
        name: apiData.name, // Or maybe clear name for import?
        validFrom: format(parseISO(apiData.validFrom), 'yyyy-MM-dd'),
        validUntil: apiData.validUntil ? format(parseISO(apiData.validUntil), 'yyyy-MM-dd') : '',
        subjects: Array.from(subjectsMap.values()),
    };
};

export default CreateTimetableModal;