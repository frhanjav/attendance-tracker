import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useForm,
    useFieldArray,
    Controller,
    Control,
    FieldErrors,
    UseFormRegister,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// Import necessary types/service from service file
import {
    timetableService,
    TimetableOutput,
    TimetableBasicInfo,
    CreateTimetableFrontendInput // Type for the payload expected by the service function
} from '../services/timetable.service';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '../components/ui/dialog';
import { Trash2, PlusCircle, Import, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseISO, format } from 'date-fns';
import SubjectInputBlock from '../components/forms/SubjectInputBlock'; // Import the sub-component
import { ApiError } from '../lib/apiClient';

// --- Zod Schemas and Inferred Types Defined LOCALLY ---
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const invalidTimeMessage = 'Invalid time (HH:MM)';
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const invalidDateMessage = 'Invalid date format (YYYY-MM-DD)';

const timeSlotFormSchema = z.object({
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startTime: z.string().optional().refine((val) => !val || timeRegex.test(val), { message: invalidTimeMessage }),
    endTime: z.string().optional().refine((val) => !val || timeRegex.test(val), { message: invalidTimeMessage }),
}).refine(data => !data.startTime || !data.endTime || data.endTime > data.startTime, { message: "End time must be after start time", path: ["endTime"] });

const subjectFormSchema = z.object({
    subjectName: z.string().min(1, { message: 'Subject name is required' }),
    courseCode: z.string().optional(),
    timeSlots: z.array(timeSlotFormSchema).min(1, { message: 'Add at least one time slot' })
});

const createTimetableFormSchema = z.object({
    name: z.string().min(1, { message: 'Timetable name is required' }),
    validFrom: z.string().min(1).regex(dateRegex, { message: invalidDateMessage }),
    validUntil: z.string().regex(dateRegex, { message: invalidDateMessage }).optional().or(z.literal("")).nullable(),
    subjects: z.array(subjectFormSchema).min(1, { message: 'Add at least one subject' })
}).refine(data => !data.validUntil || data.validUntil === "" || !data.validFrom || new Date(data.validUntil) >= new Date(data.validFrom), { message: "Valid until must be on or after valid from", path: ["validUntil"] });

// This type is for the form's state and data structure
type CreateTimetableFormInputs = z.infer<typeof createTimetableFormSchema>;
// --- End Local Schemas/Types ---

// Helper function to transform flat API data to nested form data (needed for import)
// Ensure this function exists and is correct
const transformApiDataToFormData = (
    apiData: TimetableOutput | null,
): CreateTimetableFormInputs | null => {
    if (!apiData) return null;

    const subjectsMap = new Map<
        string,
        { subjectName: string; courseCode?: string; timeSlots: any[] }
    >();

    apiData.entries.forEach((entry: any) => {
        const key = `${entry.subjectName}-${entry.courseCode || ''}`;
        if (!subjectsMap.has(key)) {
            subjectsMap.set(key, {
                subjectName: entry.subjectName,
                courseCode: entry.courseCode || '',
                timeSlots: [],
            });
        }
        subjectsMap.get(key)?.timeSlots.push({
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime || '',
            endTime: entry.endTime || '',
        });
    });
    
    return {
        name: apiData.name, // Or maybe clear name for import?
        validFrom: format(parseISO(apiData.validFrom), 'yyyy-MM-dd'),
        validUntil: apiData.validUntil ? format(parseISO(apiData.validUntil), 'yyyy-MM-dd') : '',
        subjects: Array.from(subjectsMap.values()),
    };
};

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
    const [selectedImportId, setSelectedImportId] = useState<string>('');

    // --- Form Setup ---
    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateTimetableFormInputs>({
        resolver: zodResolver(createTimetableFormSchema),
        defaultValues: {
            name: '',
            validFrom: '',
            validUntil: '',
            subjects: [
                {
                    subjectName: '',
                    courseCode: '',
                    timeSlots: [{ dayOfWeek: 1, startTime: '', endTime: '' }],
                },
            ],
        },
        mode: 'onSubmit',
    });
    const {
        fields: subjectFields,
        append: appendSubject,
        remove: removeSubject,
    } = useFieldArray({ control, name: 'subjects' });

    // --- Queries ---
    const { data: importableTimetables = [], isLoading: isLoadingImportList } = useQuery<
        TimetableBasicInfo[],
        Error
    >({
        queryKey: ['timetableList', streamId],
        queryFn: () => timetableService.getTimetableListForImport(streamId),
        enabled: isOpen && !!streamId,
        staleTime: 1000 * 60 * 10,
    });

    const { data: timetableToImport, isFetching: isFetchingImportDetails } = useQuery<
        TimetableOutput,
        Error
    >({
        queryKey: ['timetableDetails', selectedImportId],
        queryFn: () => timetableService.getTimetableDetails(selectedImportId),
        enabled: !!selectedImportId,
        staleTime: Infinity,
    });

    // --- Effect for Import ---
    useEffect(() => {
        if (timetableToImport) {
            const formData = transformApiDataToFormData(timetableToImport);
            if (formData) {
                reset({
                    name: '', // Clear name/dates for the new timetable
                    validFrom: '',
                    validUntil: '',
                    subjects: formData.subjects, // Use imported subjects/slots
                });
                toast.success(
                    `Imported schedule from "${timetableToImport.name}". Set name & dates.`,
                );
            } else {
                toast.error('Failed to process data from timetable to import.');
            }
            setSelectedImportId('');
        }
    }, [timetableToImport, reset]);

    // --- Create Mutation ---
    // The mutation function expects the type defined in the service: { streamId: string } & CreateTimetableFrontendInput
    const createTimetableMutation = useMutation<
        TimetableOutput,
        Error,
        { streamId: string } & CreateTimetableFrontendInput // Matches service input type
    >({
        mutationFn: timetableService.createTimetable,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetables', streamId] });
            queryClient.invalidateQueries({ queryKey: ['timetableList', streamId] });
            queryClient.invalidateQueries({ queryKey: ['weeklySchedule', streamId] });
            queryClient.invalidateQueries({ queryKey: ['attendanceWeek', streamId] });
            queryClient.invalidateQueries({ queryKey: ['streamAnalytics', streamId] });
            reset();
            setFormError(null);
            onClose();
            toast.success('Timetable created successfully!');
        },
        onError: (error: Error | ApiError) => {
            console.error('Create Timetable Mutation failed:', error);
            let displayMessage = 'An unknown error occurred.';
            if (error && typeof error === 'object' && 'message' in error) {
                displayMessage = (error as ApiError).message;
            }
            setFormError(displayMessage);
            toast.error(`Failed to create timetable: ${displayMessage}`);
        },
    });

    // --- Form Submit Handler ---
    const onSubmit = (data: CreateTimetableFormInputs) => { // data is type CreateTimetableFormInputs
        if (!streamId) return;
        setFormError(null);

        // Construct the payload matching the type expected by the mutation/service
        // CreateTimetableFrontendInput includes name, validFrom, validUntil?, subjects
        const mutationPayload: { streamId: string } & CreateTimetableFrontendInput = {
            streamId: streamId,
            name: data.name,
            validFrom: data.validFrom,
            validUntil: data.validUntil || null, // Map empty string to null
            subjects: data.subjects.map(subject => ({ // Ensure nested structure matches SubjectInput
                subjectName: subject.subjectName,
                courseCode: subject.courseCode || undefined, // Map empty string to undefined if service type expects optional string
                timeSlots: subject.timeSlots.map(slot => ({ // Ensure nested structure matches TimeSlotInput
                    dayOfWeek: slot.dayOfWeek,
                    startTime: slot.startTime || undefined, // Map empty string to undefined
                    endTime: slot.endTime || undefined,   // Map empty string to undefined
                }))
            })),
        };
        console.log('Submitting timetable data (payload for service):', mutationPayload);
        createTimetableMutation.mutate(mutationPayload);
    };

    // --- Close Handlers ---
    const handleClose = () => {
        reset();
        setFormError(null);
        setSelectedImportId('');
        onClose();
    };
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            handleClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Create New Timetable</DialogTitle>
                    <DialogDescription>
                        Define the schedule for this stream. New timetables override older ones for
                        future dates.
                    </DialogDescription>
                </DialogHeader>

                {/* Import Section */}
                <div className="flex items-end gap-2 border-b pb-4 mb-4">
                    <div className="flex-grow">
                        <Label htmlFor="importSelect" className="text-xs font-medium">
                            Import Schedule From (Optional)
                        </Label>
                        <Select
                            onValueChange={setSelectedImportId}
                            value={selectedImportId}
                            disabled={isLoadingImportList || isFetchingImportDetails}
                        >
                            <SelectTrigger id="importSelect" className="h-9">
                                <SelectValue placeholder="Select previous timetable..." />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoadingImportList && ( <SelectItem value="loading" disabled> Loading... </SelectItem> )}
                                {importableTimetables.map((tt) => (
                                    <SelectItem key={tt.id} value={tt.id}>
                                        {tt.name} ({format(parseISO(tt.validFrom), 'MMM yyyy')})
                                    </SelectItem>
                                ))}
                                {importableTimetables.length === 0 && !isLoadingImportList && ( <SelectItem value="none" disabled> No previous timetables </SelectItem> )}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={!selectedImportId || isFetchingImportDetails} className="h-9 w-9 p-0">
                        {isFetchingImportDetails ? ( <Loader2 className="h-4 w-4 animate-spin" /> ) : ( <Import size={16} /> )}
                    </Button>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 overflow-y-auto flex-grow pr-2">
                    {/* General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="create-modal-name"> Timetable Name <span className="text-red-500">*</span> </Label>
                            <Input id="create-modal-name" {...register('name')} placeholder="e.g., Sem 1 (Fall 2024)" className={errors.name ? 'border-red-500' : ''} />
                            {errors.name && ( <p className="text-red-500 text-xs mt-1">{errors.name.message}</p> )}
                        </div>
                        <div>
                            <Label htmlFor="create-modal-validFrom"> Valid From <span className="text-red-500">*</span> </Label>
                            <Input id="create-modal-validFrom" type="date" {...register('validFrom')} className={errors.validFrom ? 'border-red-500' : ''} />
                            {errors.validFrom && ( <p className="text-red-500 text-xs mt-1"> {errors.validFrom.message} </p> )}
                        </div>
                        <div>
                            <Label htmlFor="create-modal-validUntil">Valid Until (Optional)</Label>
                            <Input id="create-modal-validUntil" type="date" {...register('validUntil')} className={errors.validUntil ? 'border-red-500' : ''} />
                            {errors.validUntil && ( <p className="text-red-500 text-xs mt-1"> {errors.validUntil.message} </p> )}
                        </div>
                    </div>

                    {/* Subjects Section */}
                    <div className="space-y-4 border-t pt-4">
                        <h3 className="text-base font-medium text-gray-700"> Subjects & Schedules <span className="text-red-500">*</span> </h3>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => appendSubject({ subjectName: '', courseCode: '', timeSlots: [{ dayOfWeek: 1, startTime: '', endTime: '' }] })} className="inline-flex items-center" >
                           <PlusCircle size={16} className="mr-1"/> Add Subject
                        </Button>
                        {errors.subjects?.root && ( <p className="text-red-500 text-xs mt-1"> {errors.subjects.root.message} </p> )}
                        {errors.subjects?.message && ( <p className="text-red-500 text-xs mt-1">{errors.subjects.message}</p> )}
                    </div>

                    {/* Form Error Display */}
                    {formError && ( <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">{formError}</p> )}

                     {/* Footer with Submit Button */}
                    <DialogFooter className="mt-6 pt-4 border-t sticky bottom-0 bg-white py-3 -mx-6 px-6">
                         <Button type="button" variant="ghost" onClick={handleClose} disabled={createTimetableMutation.isPending}>Cancel</Button>
                         <Button type="submit" disabled={isSubmitting || createTimetableMutation.isPending} >
                            {createTimetableMutation.isPending ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> ) : ( 'Save Timetable' )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CreateTimetableModal;