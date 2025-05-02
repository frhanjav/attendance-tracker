import React from 'react';
import { useFieldArray, Controller, Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select';
import { Trash2, PlusCircle } from 'lucide-react';
import { z } from 'zod'; // Import Zod if needed for inferred types below

// --- Re-define or Import Form Schema/Types ---
// It's best practice to define these centrally and import them
// For simplicity here, we might redefine parts or assume they are passed via generics
// Let's assume the main form input type is passed via generic or defined here
// Example using inline definition (better to import):
const timeSlotSchema = z
    .object({
        dayOfWeek: z.coerce.number().int().min(1).max(7),
        startTime: z
            .string()
            .optional()
            .refine((val) => !val || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val), {
                message: 'Invalid time (HH:MM)',
            }),
        endTime: z
            .string()
            .optional()
            .refine((val) => !val || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val), {
                message: 'Invalid time (HH:MM)',
            }),
    })
    .refine((data) => !data.startTime || !data.endTime || data.endTime > data.startTime, {
        message: 'End time must be after start time',
        path: ['endTime'],
    });

const subjectSchema = z.object({
    subjectName: z.string().min(1, { message: 'Subject name is required' }),
    courseCode: z.string().optional(),
    timeSlots: z.array(timeSlotSchema).min(1, { message: 'Add at least one time slot' }),
});

const createTimetableFormSchema = z.object({
    name: z.string().min(1),
    validFrom: z.string().min(1),
    validUntil: z.string().optional().nullable(),
    subjects: z.array(subjectSchema).min(1),
});
type CreateTimetableFormInputs = z.infer<typeof createTimetableFormSchema>;
// --- End Schema/Types ---

const weekDays = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
];

// --- Component Props Interface ---
interface SubjectInputBlockProps {
    subjectIndex: number;
    control: Control<CreateTimetableFormInputs>; // Use the specific form type
    register: UseFormRegister<CreateTimetableFormInputs>;
    removeSubject: (index: number) => void;
    errors: FieldErrors<CreateTimetableFormInputs>;
}

// --- Component Definition ---
const SubjectInputBlock: React.FC<SubjectInputBlockProps> = ({
    subjectIndex,
    control,
    register,
    removeSubject,
    errors,
}) => {
    // Nested Field Array for Time Slots within this subject
    const {
        fields: timeSlotFields,
        append: appendTimeSlot,
        remove: removeTimeSlot,
    } = useFieldArray({
        control,
        name: `subjects.${subjectIndex}.timeSlots`,
    });

    // Get potential errors for this specific subject block
    const subjectErrors = errors.subjects?.[subjectIndex];

    return (
        <div className="p-4 border rounded-md bg-gray-50/80 space-y-4 relative shadow-sm">
            {/* Remove Subject Button */}
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSubject(subjectIndex)}
                className="absolute top-2 right-2 text-gray-400 hover:bg-red-100 hover:text-red-600 h-7 w-7 z-10" // Ensure button is clickable
                title="Remove Subject Block"
            >
                <Trash2 size={14} />
            </Button>

            {/* Subject Name and Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor={`subjects.${subjectIndex}.subjectName`}>
                        Subject Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id={`subjects.${subjectIndex}.subjectName`}
                        {...register(`subjects.${subjectIndex}.subjectName`)}
                        placeholder="e.g., Advanced Algorithms"
                        className={subjectErrors?.subjectName ? 'border-red-500' : ''}
                    />
                    {subjectErrors?.subjectName && (
                        <p className="text-red-500 text-xs mt-1">
                            {subjectErrors.subjectName.message}
                        </p>
                    )}
                </div>
                <div>
                    <Label htmlFor={`subjects.${subjectIndex}.courseCode`}>
                        Course Code (Optional)
                    </Label>
                    <Input
                        id={`subjects.${subjectIndex}.courseCode`}
                        {...register(`subjects.${subjectIndex}.courseCode`)}
                        placeholder="e.g., CS501"
                    />
                    {/* No error display needed for optional field unless specific validation added */}
                </div>
            </div>

            {/* Time Slots for this Subject */}
            <div className="space-y-3 pl-4 border-l-2 border-blue-200 ml-1">
                {' '}
                {/* Added ml-1 for spacing */}
                <Label className="text-sm font-medium text-gray-600 block mb-1">
                    Scheduled Times <span className="text-red-500">*</span>
                </Label>
                {timeSlotFields.map((slotField, slotIndex) => {
                    const timeSlotErrors = subjectErrors?.timeSlots?.[slotIndex];
                    return (
                        <div
                            key={slotField.id}
                            className="flex flex-wrap items-end gap-2 bg-white p-2 rounded border border-gray-200"
                        >
                            {/* Day Select */}
                            <div className="flex-grow min-w-[90px]">
                                <Label
                                    htmlFor={`subjects.${subjectIndex}.timeSlots.${slotIndex}.dayOfWeek`}
                                    className="text-xs"
                                >
                                    Day
                                </Label>
                                <Controller
                                    control={control}
                                    name={`subjects.${subjectIndex}.timeSlots.${slotIndex}.dayOfWeek`}
                                    render={({ field: controllerField }) => (
                                        <Select
                                            onValueChange={controllerField.onChange}
                                            defaultValue={String(controllerField.value)}
                                        >
                                            <SelectTrigger
                                                id={`subjects.${subjectIndex}.timeSlots.${slotIndex}.dayOfWeek`}
                                                className="h-9 text-xs"
                                            >
                                                <SelectValue placeholder="Day" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {weekDays.map((day) => (
                                                    <SelectItem
                                                        key={day.value}
                                                        value={String(day.value)}
                                                        className="text-xs"
                                                    >
                                                        {day.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {/* No error display needed for select with default */}
                            </div>
                            {/* Start Time */}
                            <div className="flex-grow min-w-[95px]">
                                <Label
                                    htmlFor={`subjects.${subjectIndex}.timeSlots.${slotIndex}.startTime`}
                                    className="text-xs"
                                >
                                    Start (Opt.)
                                </Label>
                                <Input
                                    id={`subjects.${subjectIndex}.timeSlots.${slotIndex}.startTime`}
                                    type="time"
                                    {...register(
                                        `subjects.${subjectIndex}.timeSlots.${slotIndex}.startTime`,
                                    )}
                                    className={`h-9 text-xs ${timeSlotErrors?.startTime ? 'border-red-500' : ''}`}
                                />
                                {timeSlotErrors?.startTime && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {timeSlotErrors.startTime.message}
                                    </p>
                                )}
                            </div>
                            {/* End Time */}
                            <div className="flex-grow min-w-[95px]">
                                <Label
                                    htmlFor={`subjects.${subjectIndex}.timeSlots.${slotIndex}.endTime`}
                                    className="text-xs"
                                >
                                    End (Opt.)
                                </Label>
                                <Input
                                    id={`subjects.${subjectIndex}.timeSlots.${slotIndex}.endTime`}
                                    type="time"
                                    {...register(
                                        `subjects.${subjectIndex}.timeSlots.${slotIndex}.endTime`,
                                    )}
                                    className={`h-9 text-xs ${timeSlotErrors?.endTime ? 'border-red-500' : ''}`}
                                />
                                {timeSlotErrors?.endTime && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {timeSlotErrors.endTime.message}
                                    </p>
                                )}
                            </div>
                            {/* Remove Time Slot Button */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTimeSlot(slotIndex)}
                                className="text-red-500 hover:bg-red-100 hover:text-red-600 h-8 w-8 self-end"
                                disabled={timeSlotFields.length <= 1}
                                title="Remove Time Slot"
                            >
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    );
                })}
                {/* Add Time Slot Button */}
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => appendTimeSlot({ dayOfWeek: 1, startTime: '', endTime: '' })} // Add default slot
                    className="text-xs text-blue-600 hover:text-blue-800 px-1 h-auto" // Adjust styling
                >
                    <PlusCircle size={14} className="mr-1" /> Add another time for this subject
                </Button>
                {/* Display errors related to the timeSlots array itself (e.g., min length) */}
                {subjectErrors?.timeSlots?.root && (
                    <p className="text-red-500 text-xs mt-1">
                        {subjectErrors.timeSlots.root.message}
                    </p>
                )}
                {subjectErrors?.timeSlots?.message && (
                    <p className="text-red-500 text-xs mt-1">{subjectErrors.timeSlots.message}</p>
                )}
            </div>
        </div>
    );
};

export default SubjectInputBlock; // Export the component
