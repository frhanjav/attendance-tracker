import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { timetableService } from '../services/timetable.service'; // Import the service
import { Button } from '../components/ui/button'; // Use shadcn Button
import { Input } from '../components/ui/input'; // Use shadcn Input
import { Label } from '../components/ui/label'; // Use shadcn Label
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'; // Use shadcn Select
import { Trash2, PlusCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns'; // For displaying dates
import toast from 'react-hot-toast'; // Import toast

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const invalidTimeMessage = "Invalid time (HH:MM)";

// Schema for a single time slot for a subject
const timeSlotSchema = z.object({
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    // Optional times, validated only if not empty
    startTime: z.string().optional().refine((val) => !val || timeRegex.test(val), {
        message: invalidTimeMessage,
    }),
    endTime: z.string().optional().refine((val) => !val || timeRegex.test(val), {
        message: invalidTimeMessage,
    }),
    // Optional: Add validation that endTime is after startTime if both provided
}).refine(data => {
    if (data.startTime && data.endTime) {
        // Basic time comparison (doesn't handle crossing midnight)
        return data.endTime > data.startTime;
    }
    return true;
}, {
    message: "End time must be after start time",
    path: ["endTime"],
});

// Schema for a subject, containing its details and time slots
const subjectSchema = z.object({
    subjectName: z.string().min(1, { message: 'Subject name is required' }),
    courseCode: z.string().optional(),
    timeSlots: z.array(timeSlotSchema).min(1, { message: 'Add at least one time slot for the subject' })
});

// // --- Zod Schemas (defined above or import from separate file) ---
// const timetableEntrySchema = z.object({
//     dayOfWeek: z.coerce.number().int().min(1).max(7),
//     subjectName: z.string().min(1, { message: 'Subject name is required' }),
//     courseCode: z.string().optional(),
//     // Apply regex only if the string is not empty
//     startTime: z.string().optional().refine((val) => !val || timeRegex.test(val), {
//         message: invalidTimeMessage,
//     }),
//     endTime: z.string().optional().refine((val) => !val || timeRegex.test(val), {
//         message: invalidTimeMessage,
//     }),
// });

const createTimetableFormSchema = z.object({
    name: z.string().min(1, { message: 'Timetable name is required' }),
    validFrom: z.string().min(1, { message: 'Valid from date is required' }),
    validUntil: z.string().optional().nullable(),
    // Array of subjects
    subjects: z.array(subjectSchema).min(1, { message: 'Add at least one subject' })
}).refine(data => {
    if (data.validUntil && data.validFrom) {
        return new Date(data.validUntil) >= new Date(data.validFrom);
    }
    return true;
}, {
    message: "Valid until date must be on or after the valid from date",
    path: ["validUntil"],
});

// Infer types
type CreateTimetableFormInputs = z.infer<typeof createTimetableFormSchema>;
type SubjectFormInput = z.infer<typeof subjectSchema>;
type TimeSlotFormInput = z.infer<typeof timeSlotSchema>;

// --- End Schemas ---

const weekDays = [
    { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
]; // Shortened labels

const TimetablePage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const queryClient = useQueryClient();
    const [formError, setFormError] = useState<string | null>(null);

    // --- React Hook Form Setup ---
    const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<CreateTimetableFormInputs>({
        resolver: zodResolver(createTimetableFormSchema),
        defaultValues: {
            name: '',
            validFrom: '',
            validUntil: '',
            subjects: [{ // Start with one subject block
                subjectName: '',
                courseCode: '',
                timeSlots: [{ dayOfWeek: 1, startTime: '', endTime: '' }] // Start with one time slot
            }]
        },
        mode: 'onSubmit', // Validate on submit
    });

    // Field Array for Subjects
    const { fields: subjectFields, append: appendSubject, remove: removeSubject } = useFieldArray({
        control,
        name: "subjects"
    });

    // --- React Query: Fetch Existing Timetables ---
    const { data: existingTimetables = [], isLoading: isLoadingList, error: listError } = useQuery({
        queryKey: ['timetables', streamId],
        queryFn: () => timetableService.getTimetablesForStream(streamId!),
        enabled: !!streamId,
    });

    // --- React Query: Create Timetable Mutation ---
    const createTimetableMutation = useMutation({
        mutationFn: timetableService.createTimetable,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetables', streamId] });
            reset(); // Reset form to default values
            setFormError(null);
            toast.success("Timetable created successfully!");
        },
        onError: (error) => {
            setFormError(error.message || "Failed to create timetable.");
            toast.error(error.message || "Failed to create timetable.");
        },
    });

    // --- Form Submit Handler ---
    const onSubmit = (data: CreateTimetableFormInputs) => {
        if (!streamId) return;
        setFormError(null);
        // The service function now expects the nested structure
        createTimetableMutation.mutate({ streamId, ...data });
    };

    // --- Delete Handler (from previous step) ---
    // Delete Mutation
    const deleteTimetableMutation = useMutation({
        mutationFn: timetableService.deleteTimetable,
        onSuccess: (_, deletedTimetableId) => { // Second arg is the variable passed to mutate
            console.log(`Timetable ${deletedTimetableId} deleted`);
            queryClient.invalidateQueries({ queryKey: ['timetables', streamId] });
            toast.success("Timetable deleted!");
            // Add success notification
        },
        onError: (error, deletedTimetableId) => {
            console.error(`Error deleting timetable ${deletedTimetableId}:`, error);
            // Add error notification
            toast.error(`Failed to delete timetable: ${error.message}`);
        },
    });
    
    const handleDeleteClick = (timetableId: string, timetableName: string) => {
        if (window.confirm(`Are you sure you want to delete the timetable "${timetableName}"?`)) {
            deleteTimetableMutation.mutate(timetableId);
        }
    };

    // // --- Form Submit Handler ---
    // const onSubmit = (data: CreateTimetableFormInputs) => {
    //     console.log("Data received from RHF:", data); // <-- Add this log
    //     if (!streamId) return;
    //     setFormError(null); // Clear error before submitting

    //     // Prepare data for the service (ensure optional fields are null if empty)
    //     const apiPayload = {
    //         streamId: streamId,
    //         name: data.name,
    //         validFrom: data.validFrom, // Backend expects YYYY-MM-DD string
    //         validUntil: data.validUntil || null,
    //         entries: data.entries.map(entry => ({
    //             dayOfWeek: entry.dayOfWeek,
    //             subjectName: entry.subjectName,
    //             courseCode: entry.courseCode || null,
    //             startTime: entry.startTime || null,
    //             endTime: entry.endTime || null,
    //         }))
    //     };
    //     console.log("Submitting timetable data:", apiPayload);
    //     createTimetableMutation.mutate(apiPayload);
    // };

    return (
        <div className="space-y-8"> {/* Add spacing between sections */}
            <h1 className="text-3xl font-bold text-gray-800">Timetables for Stream {streamId}</h1>

            {/* Create New Timetable Form Section */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-5 border-b pb-3">Create New Timetable</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* General Timetable Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="name">Timetable Name <span className="text-red-500">*</span></Label>
                            <Input id="name" {...register('name')} placeholder="e.g., Sem 1 (Fall 2024)" className={errors.name ? 'border-red-500' : ''} />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="validFrom">Valid From <span className="text-red-500">*</span></Label>
                            <Input id="validFrom" type="date" {...register('validFrom')} className={errors.validFrom ? 'border-red-500' : ''} />
                             {errors.validFrom && <p className="text-red-500 text-xs mt-1">{errors.validFrom.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="validUntil">Valid Until (Optional)</Label>
                            <Input id="validUntil" type="date" {...register('validUntil')} className={errors.validUntil ? 'border-red-500' : ''} />
                             {errors.validUntil && <p className="text-red-500 text-xs mt-1">{errors.validUntil.message}</p>}
                        </div>
                    </div>

                    {/* Subjects Section */}
                    <div className="space-y-6 border-t pt-6">
                        <h3 className="text-lg font-medium text-gray-700">Subjects & Schedules <span className="text-red-500">*</span></h3>
                        {subjectFields.map((subjectField, subjectIndex) => (
                            <SubjectInputBlock
                                key={subjectField.id}
                                subjectIndex={subjectIndex}
                                control={control}
                                register={register}
                                removeSubject={removeSubject}
                                errors={errors} // Pass errors down
                            />
                        ))}
                        {/* Add Subject Button */}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendSubject({ subjectName: '', courseCode: '', timeSlots: [{ dayOfWeek: 1, startTime: '', endTime: '' }] })}
                            className="mt-2 inline-flex items-center"
                        >
                           <PlusCircle size={16} className="mr-1"/> Add Subject
                        </Button>
                        {errors.subjects?.root && <p className="text-red-500 text-xs mt-1">{errors.subjects.root.message}</p>}
                        {errors.subjects?.message && <p className="text-red-500 text-xs mt-1">{errors.subjects.message}</p>}
                    </div>

                    {/* Form Error Display */}
                    {formError && ( <div className="text-red-600 text-sm mt-4">{formError}</div> )}

                    {/* Submit Button */}
                    <div className="flex justify-end pt-6 border-t">
                        <Button type="submit" disabled={isSubmitting || createTimetableMutation.isPending} className="min-w-[120px]">
                            {createTimetableMutation.isPending ? 'Saving...' : 'Save Timetable'}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Existing Timetables Section */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-3">Existing Timetables</h2>
                {isLoadingList && <p className="text-gray-500">Loading...</p>}
                {listError && <p className="text-red-500">Error loading timetables: {listError.message}</p>}
                {!isLoadingList && !listError && existingTimetables.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No timetables found for this stream yet.</p>
                )}
                {!isLoadingList && !listError && existingTimetables.length > 0 && (
                    <div className="space-y-3">
                        {existingTimetables.map(tt => (
                            <div key={tt.id} className="border p-4 rounded-md bg-gray-50 flex justify-between items-start">
                                <div>
                                    <h3 className="font-medium text-gray-800">{tt.name}</h3>
                                    <p className="text-sm text-gray-600">
                                        Valid: {format(parseISO(tt.validFrom), 'MMM dd, yyyy')}
                                        {tt.validUntil ? ` to ${format(parseISO(tt.validUntil), 'MMM dd, yyyy')}` : ' onwards'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{tt.entries.length} entries</p>
                                </div>
                                <div>
                                    {/* TODO: Add View/Edit/Delete buttons later */}
                                    <Button variant="outline" size="sm" className="mr-2" asChild>
                                        <Link to={`/streams/${streamId}/timetables/${tt.id}`}>View</Link>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:bg-red-100 hover:text-red-700"
                                        onClick={() => handleDeleteClick(tt.id, tt.name)} // Call handler
                                        disabled={deleteTimetableMutation.isPending && deleteTimetableMutation.variables === tt.id} // Disable while deleting this specific one
                                    >
                                        {deleteTimetableMutation.isPending && deleteTimetableMutation.variables === tt.id ? 'Deleting...' : 'Delete'}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-Component for Subject Input Block ---
// This helps manage the nested field array complexity
interface SubjectInputBlockProps {
    subjectIndex: number;
    control: any; // Control object from useForm
    register: any; // Register function from useForm
    removeSubject: (index: number) => void;
    errors: any; // Errors object from formState
}

const SubjectInputBlock: React.FC<SubjectInputBlockProps> = ({ subjectIndex, control, register, removeSubject, errors }) => {
    // Nested Field Array for Time Slots within this subject
    const { fields: timeSlotFields, append: appendTimeSlot, remove: removeTimeSlot } = useFieldArray({
        control,
        name: `subjects.${subjectIndex}.timeSlots`
    });

    return (
        <div className="p-4 border rounded-md bg-gray-50 space-y-4 relative">
             {/* Remove Subject Button (Top Right) */}
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSubject(subjectIndex)}
                className="absolute top-2 right-2 text-gray-400 hover:bg-red-100 hover:text-red-600 h-7 w-7"
                title="Remove Subject Block"
             >
                 <Trash2 size={14} />
             </Button>

            {/* Subject Name and Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor={`subjects.${subjectIndex}.subjectName`}>Subject Name <span className="text-red-500">*</span></Label>
                    <Input
                        id={`subjects.${subjectIndex}.subjectName`}
                        {...register(`subjects.${subjectIndex}.subjectName`)}
                        placeholder="e.g., Advanced Algorithms"
                        className={errors.subjects?.[subjectIndex]?.subjectName ? 'border-red-500' : ''}
                    />
                    {errors.subjects?.[subjectIndex]?.subjectName && <p className="text-red-500 text-xs mt-1">{errors.subjects?.[subjectIndex]?.subjectName?.message}</p>}
                </div>
                 <div>
                    <Label htmlFor={`subjects.${subjectIndex}.courseCode`}>Course Code (Optional)</Label>
                    <Input
                        id={`subjects.${subjectIndex}.courseCode`}
                        {...register(`subjects.${subjectIndex}.courseCode`)}
                        placeholder="e.g., CS501"
                    />
                </div>
            </div>

             {/* Time Slots for this Subject */}
             <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                 <Label className="text-sm font-medium text-gray-600">Scheduled Times <span className="text-red-500">*</span></Label>
                 {timeSlotFields.map((slotField, slotIndex) => (
                     <div key={slotField.id} className="flex flex-wrap items-end gap-2">
                         {/* Day Select */}
                         <div className="flex-grow min-w-[90px]">
                             <Label htmlFor={`subjects.${subjectIndex}.timeSlots.${slotIndex}.dayOfWeek`} className="text-xs">Day</Label>
                             <Controller
                                control={control}
                                name={`subjects.${subjectIndex}.timeSlots.${slotIndex}.dayOfWeek`}
                                render={({ field: controllerField }) => (
                                    <Select onValueChange={controllerField.onChange} defaultValue={String(controllerField.value)}>
                                        <SelectTrigger id={`subjects.${subjectIndex}.timeSlots.${slotIndex}.dayOfWeek`} className="h-9 text-xs">
                                            <SelectValue placeholder="Day" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {weekDays.map(day => (
                                                <SelectItem key={day.value} value={String(day.value)} className="text-xs">{day.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                         </div>
                         {/* Start Time */}
                         <div className="flex-grow min-w-[95px]">
                             <Label htmlFor={`subjects.${subjectIndex}.timeSlots.${slotIndex}.startTime`} className="text-xs">Start (Opt.)</Label>
                             <Input
                                id={`subjects.${subjectIndex}.timeSlots.${slotIndex}.startTime`}
                                type="time"
                                {...register(`subjects.${subjectIndex}.timeSlots.${slotIndex}.startTime`)}
                                className={`h-9 text-xs ${errors.subjects?.[subjectIndex]?.timeSlots?.[slotIndex]?.startTime ? 'border-red-500' : ''}`}
                            />
                             {errors.subjects?.[subjectIndex]?.timeSlots?.[slotIndex]?.startTime && <p className="text-red-500 text-xs mt-1">{errors.subjects?.[subjectIndex]?.timeSlots?.[slotIndex]?.startTime?.message}</p>}
                         </div>
                         {/* End Time */}
                         <div className="flex-grow min-w-[95px]">
                             <Label htmlFor={`subjects.${subjectIndex}.timeSlots.${slotIndex}.endTime`} className="text-xs">End (Opt.)</Label>
                             <Input
                                id={`subjects.${subjectIndex}.timeSlots.${slotIndex}.endTime`}
                                type="time"
                                {...register(`subjects.${subjectIndex}.timeSlots.${slotIndex}.endTime`)}
                                className={`h-9 text-xs ${errors.subjects?.[subjectIndex]?.timeSlots?.[slotIndex]?.endTime ? 'border-red-500' : ''}`}
                            />
                             {errors.subjects?.[subjectIndex]?.timeSlots?.[slotIndex]?.endTime && <p className="text-red-500 text-xs mt-1">{errors.subjects?.[subjectIndex]?.timeSlots?.[slotIndex]?.endTime?.message}</p>}
                         </div>
                         {/* Remove Time Slot Button */}
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTimeSlot(slotIndex)}
                            className="text-red-500 hover:bg-red-100 hover:text-red-600 h-8 w-8 self-end" // Align button
                            disabled={timeSlotFields.length <= 1} // Disable removing if only one slot left
                            title="Remove Time Slot"
                         >
                             <Trash2 size={14} />
                         </Button>
                     </div>
                 ))}
                 {/* Add Time Slot Button */}
                 <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => appendTimeSlot({ dayOfWeek: 1, startTime: '', endTime: '' })}
                    className="text-xs text-blue-600 hover:text-blue-800 px-0"
                 >
                     <PlusCircle size={14} className="mr-1"/> Add another time for this subject
                 </Button>
                 {errors.subjects?.[subjectIndex]?.timeSlots?.root && <p className="text-red-500 text-xs mt-1">{errors.subjects?.[subjectIndex]?.timeSlots?.root.message}</p>}
                 {errors.subjects?.[subjectIndex]?.timeSlots?.message && <p className="text-red-500 text-xs mt-1">{errors.subjects?.[subjectIndex]?.timeSlots?.message}</p>}
             </div>
        </div>
    );
}


export default TimetablePage;