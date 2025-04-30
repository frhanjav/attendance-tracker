import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { timetableService, TimetableOutput } from '../services/timetable.service';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Trash2, PlusCircle, Edit, X, Check, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { z } from 'zod';
import toast from 'react-hot-toast'; // Import toast

// --- Re-use or import Zod Schemas ---
// It's better to define these in a central place and import them
// For brevity, assuming they are available here or imported

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const invalidTimeMessage = "Invalid time (HH:MM)";
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
const subjectSchema = z.object({
    subjectName: z.string().min(1, { message: 'Subject name is required' }),
    courseCode: z.string().optional(),
    timeSlots: z.array(timeSlotSchema).min(1, { message: 'Add at least one time slot for the subject' })
});
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
type CreateTimetableFormInputs = z.infer<typeof createTimetableFormSchema>;
// --- End Schemas ---

const weekDays = [
    { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
];

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

// Helper function to transform flat entries from API to nested subjects for the form
const transformApiDataToFormData = (apiData: TimetableOutput | null): CreateTimetableFormInputs | null => {
    if (!apiData) return null;

    const subjectsMap = new Map<string, { subjectName: string; courseCode?: string; timeSlots: any[] }>();

    apiData.entries.forEach((entry: any) => {
        const key = `${entry.subjectName}-${entry.courseCode || ''}`;
        if (!subjectsMap.has(key)) {
            subjectsMap.set(key, {
                subjectName: entry.subjectName,
                courseCode: entry.courseCode || '',
                timeSlots: []
            });
        }
        subjectsMap.get(key)?.timeSlots.push({
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime || '',
            endTime: entry.endTime || '',
        });
    });

    return {
        name: apiData.name,
        // Format dates for input type="date" (YYYY-MM-DD)
        validFrom: format(parseISO(apiData.validFrom), 'yyyy-MM-dd'),
        validUntil: apiData.validUntil ? format(parseISO(apiData.validUntil), 'yyyy-MM-dd') : '',
        subjects: Array.from(subjectsMap.values()),
    };
};

const DisplayTimetableEntries: React.FC<{ entries: any[] }> = ({ entries }) => {
    if (!entries || entries.length === 0) {
        return <p className="text-gray-500 italic text-center py-4">No schedule entries found for this timetable.</p>;
    }

    const groupedEntries: { [key: number]: any[] } = {};
    entries.forEach(entry => {
        if (!groupedEntries[entry.dayOfWeek]) {
            groupedEntries[entry.dayOfWeek] = [];
        }
        // Sort entries within a day by start time if available
        groupedEntries[entry.dayOfWeek].push(entry);
        groupedEntries[entry.dayOfWeek].sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
    });

    const weekDayMap = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    return (
        <div className="space-y-5">
            {Object.keys(groupedEntries).sort().map(dayKey => {
                const dayNum = parseInt(dayKey, 10);
                const dayEntries = groupedEntries[dayNum];
                return (
                    <div key={dayKey}>
                        <h4 className="font-semibold text-md mb-2 text-gray-700 border-b pb-1">{weekDayMap[dayNum]}</h4>
                        <ul className="space-y-2 pl-2">
                            {dayEntries.map(entry => (
                                <li key={entry.id} className="text-sm text-gray-800 bg-gray-50 p-2 rounded border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="font-medium">{entry.subjectName}</span>
                                            {entry.courseCode && <span className="text-gray-500 text-xs ml-1">({entry.courseCode})</span>}
                                        </div>
                                        {(entry.startTime || entry.endTime) && (
                                            <span className="text-gray-600 text-xs font-mono bg-gray-200 px-1.5 py-0.5 rounded">
                                                {entry.startTime || '--:--'} - {entry.endTime || '--:--'}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
};

const TimetableDetailPage: React.FC = () => {
    const { streamId, timetableId } = useParams<{ streamId: string; timetableId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // --- Fetch Timetable Details ---
    const { data: timetableData, isLoading, error } = useQuery({
        queryKey: ['timetable', timetableId],
        queryFn: () => timetableService.getTimetableDetails(timetableId!),
        enabled: !!timetableId,
    });

    // --- Form Setup (for editing) ---
    const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<CreateTimetableFormInputs>({
        resolver: zodResolver(createTimetableFormSchema),
        defaultValues: { name: '', validFrom: '', validUntil: '', subjects: [] }, // Initial empty defaults
        mode: 'onSubmit',
    });

    // Field Array for Subjects (needed for edit form)
    const { fields: subjectFields, append: appendSubject, remove: removeSubject, replace: replaceSubjects } = useFieldArray({
        control,
        name: "subjects"
    });

    // --- Populate form when data loads or edit mode starts ---
    useEffect(() => {
        if (timetableData && isEditing) {
            const formData = transformApiDataToFormData(timetableData);
            if (formData) {
                reset(formData); // Reset form with fetched & transformed data
            }
        } else if (!isEditing && timetableData) {
             // Reset to display data if cancelling edit (optional)
             const formData = transformApiDataToFormData(timetableData);
             if (formData) reset(formData);
        }
    }, [timetableData, isEditing, reset]);


    // --- Update Mutation ---
    const updateTimetableMutation = useMutation({
        mutationFn: timetableService.updateTimetable, // <-- Use the actual service function
        // mutationFn: async (data: { timetableId: string } & CreateTimetableFormInputs) => {
        //      // Placeholder: Replace with actual service call
        //      console.log("Updating timetable:", data.timetableId, data);
        //      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        //      // Assume success for now
        //      return { ...timetableData, ...data }; // Return mock updated data
        //      // throw new Error("Update failed (placeholder)"); // Simulate error
        //  },
        // onSuccess: (updatedDataFromApi) => { // Data returned by the API
        onSuccess: () => { // updatedDataFromApi is available but we won't use it directly for reset here
            // Option 1: Invalidate and let useQuery handle update (Simpler)
            queryClient.invalidateQueries({ queryKey: ['timetable', timetableId] });
            queryClient.invalidateQueries({ queryKey: ['timetables', streamId] });
            setIsEditing(false); // Exit edit mode
            setFormError(null);
            toast.success("Timetable updated successfully!");
            // Don't reset here, let the useEffect handle it when timetableData updates
    
            // Option 2: Manually update cache and reset (More complex, faster UI update)
            // queryClient.setQueryData(['timetable', timetableId], updatedDataFromApi);
            // queryClient.invalidateQueries({ queryKey: ['timetables', streamId] }); // Still invalidate list
            // setIsEditing(false);
            // setFormError(null);
            // reset(transformApiDataToFormData(updatedDataFromApi)); // Reset with API data
            // toast.success("Timetable updated successfully!");
        },
        onError: (error) => {
            setFormError(error.message || "Failed to update timetable.");
        },
    });

    // useEffect handles resetting the form based on timetableData changes
    useEffect(() => {
        // Only reset if we have data AND we are in edit mode (to load initial)
        // OR if we are NOT in edit mode (to show display view based on latest data)
        if (timetableData && (isEditing || !isEditing)) {
            const formData = transformApiDataToFormData(timetableData);
            if (formData) {
                console.log("Resetting form with data:", formData); // Add log
                reset(formData);
            }
        }
    }, [timetableData, isEditing, reset]); // Depend on timetableData and isEditing

    // --- Edit Form Submit Handler ---
    const onEditSubmit = (data: CreateTimetableFormInputs) => {
        console.log("Data from RHF before submit:", data); // Add this log

        if (!timetableId) return;
        setFormError(null);
        // Pass timetableId along with form data
        updateTimetableMutation.mutate({ timetableId, ...data });
    };

    // --- Render Logic ---
    if (isLoading) return <div className="text-center p-10">Loading timetable...</div>;
    if (error) return <div className="text-center p-10 text-red-500">Error loading timetable: {error.message}</div>;
    if (!timetableData) return <div className="text-center p-10">Timetable not found.</div>;

    // --- Display Mode ---
    if (!isEditing) {
        return (
            <div className="space-y-6">
                 <Link to={`/streams/${streamId}/timetable`} className="inline-flex items-center text-sm text-blue-600 hover:underline mb-4">
                    <ArrowLeft size={16} className="mr-1"/> Back to Timetables List
                </Link>
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-800">{timetableData.name}</h1>
                    <Button onClick={() => setIsEditing(true)} size="sm">
                        <Edit size={16} className="mr-1"/> Edit
                    </Button>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <p className="text-sm text-gray-600 mb-4">
                        Valid: <span className="font-medium">{format(parseISO(timetableData.validFrom), 'MMM dd, yyyy')}</span>
                        {timetableData.validUntil ? ` to ${format(parseISO(timetableData.validUntil), 'MMM dd, yyyy')}` : ' onwards'}
                    </p>
                    <h3 className="text-lg font-semibold mb-3 border-t pt-3">Schedule</h3>
                    {/* TODO: Display the timetable entries nicely (e.g., grouped by day) */}
                    {/* <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
                        {JSON.stringify(timetableData.entries, null, 2)}
                    </pre>
                    <p className="text-gray-500 text-center mt-4">[Timetable display placeholder - needs better formatting]</p> */}

                    <DisplayTimetableEntries entries={timetableData.entries} />     
                </div>
            </div>
        );
    }

    // --- Edit Mode ---
    return (
         <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Edit Timetable</h1>
                {/* Cancel Button */}
                <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" disabled={updateTimetableMutation.isPending}>
                    <X size={16} className="mr-1"/> Cancel
                </Button>
             </div>

             {/* Re-use the form structure from Create */}
             <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-6">
                    {/* General Timetable Info Inputs (Name, ValidFrom, ValidUntil) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {/* ... Input fields for name, validFrom, validUntil using register ... */}
                         <div>
                            <Label htmlFor="name">Timetable Name <span className="text-red-500">*</span></Label>
                            <Input id="name" {...register('name')} className={errors.name ? 'border-red-500' : ''} />
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

                    {/* Subjects Section (using SubjectInputBlock) */}
                    <div className="space-y-6 border-t pt-6">
                        <h3 className="text-lg font-medium text-gray-700">Subjects & Schedules <span className="text-red-500">*</span></h3>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => appendSubject({ /* default subject */ })} className="mt-2 inline-flex items-center">
                           <PlusCircle size={16} className="mr-1"/> Add Subject
                        </Button>
                        {/* ... Subject array errors ... */}
                    </div>

                    {/* Form Error Display */}
                    {formError && ( <div className="text-red-600 text-sm mt-4">{formError}</div> )}

                    {/* Save Changes Button */}
                    <div className="flex justify-end pt-6 border-t">
                        <Button type="submit" disabled={isSubmitting || updateTimetableMutation.isPending} className="min-w-[140px]">
                            <Check size={16} className="mr-1"/>
                            {updateTimetableMutation.isPending ? 'Saving Changes...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
             </div>
         </div>
    );
};

// --- SubjectInputBlock Component (needs to be defined here or imported) ---

// const SubjectInputBlock: React.FC<SubjectInputBlockProps> = ({ /* ... */ }) => { /* ... implementation ... */ };


export default TimetableDetailPage;