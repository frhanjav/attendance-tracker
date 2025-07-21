import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const invalidTimeMessage = "Invalid time format (HH:MM)";

// Input for a single timetable entry (subject on a specific day)
export const TimetableEntryRepositoryInputSchema = z.object({
    dayOfWeek: z.number().int().min(1).max(7, { message: 'Day must be between 1 (Monday) and 7 (Sunday)' }),
    subjectName: z.string().min(1, { message: 'Subject name is required' }),
    // Allow string OR null for optional fields coming from frontend
    courseCode: z.string().nullable().optional(),
    startTime: z.string().regex(timeRegex, { message: invalidTimeMessage }).nullable().optional(),
    endTime: z.string().regex(timeRegex, { message: invalidTimeMessage }).nullable().optional(),
});

export type TimetableEntryRepositoryInput = z.infer<typeof TimetableEntryRepositoryInputSchema>;

// --- Schema for nested time slot from frontend ---
const TimeSlotFrontendSchema = z.object({
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
});

// --- Schema for nested subject from frontend ---
const SubjectFrontendSchema = z.object({
    subjectName: z.string().min(1, { message: 'Subject name is required' }),
    courseCode: z.string().optional(),
    timeSlots: z.array(TimeSlotFrontendSchema).min(1, { message: 'Add at least one time slot' })
});

// --- Schema specifically for the request BODY ---
export const TimetableBodySchema = z.object({
    name: z.string().min(1, { message: 'Timetable name is required' }),
    validFrom: z.string().min(1, { message: 'Valid from date required' })
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" })
        .nullable().optional().or(z.literal("")),
    subjects: z.array(SubjectFrontendSchema).min(1, { message: 'Add at least one subject' })
}).refine(data => {
    if (data.validUntil && data.validFrom) {
        if (data.validUntil === "") return true;
        try {
             return new Date(data.validUntil) >= new Date(data.validFrom);
        } catch (e) { return false; }
    }
    return true;
}, {
    message: "Valid until date must be on or after the valid from date",
    path: ["validUntil"],
});

// --- Schema specifically for PARAMS (Example for create) ---
export const TimetableStreamParamsSchema = z.object({
    streamId: z.string().cuid({ message: 'Invalid Stream ID format' }),
});

// --- Schema specifically for PARAMS (Example for update/delete/get) ---
export const TimetableIdParamsSchema = z.object({
    timetableId: z.string().cuid({ message: 'Invalid Timetable ID format' }),
});

// --- Schema specifically for the QUERY parameters of the 'active' route ---
export const TimetableActiveQuerySchema = z.object({
    date: z.string()
             .min(1, { message: "Date query parameter is required"})
             .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
});

export type CreateTimetableFrontendInput = z.infer<typeof TimetableBodySchema>;

// --- DTO for Timetable List (for import feature) ---
export const TimetableBasicInfoSchema = z.object({
    id: z.string().cuid(),
    name: z.string(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime().nullable(),
});
export type TimetableBasicInfo = z.infer<typeof TimetableBasicInfoSchema>;

// Output DTO for a timetable entry
export const TimetableEntryOutputSchema = TimetableEntryRepositoryInputSchema.extend({
    id: z.string().cuid(),
    timetableId: z.string().cuid(),
});
export type TimetableEntryOutput = z.infer<typeof TimetableEntryOutputSchema>;

// Output DTO for a timetable
export const TimetableOutputSchema = z.object({
    id: z.string().cuid(),
    streamId: z.string().cuid(),
    name: z.string(),
    // The service layer should format Date objects from Prisma before sending
    validFrom: z.string().datetime({ message: "Invalid ISO date format" }),
    validUntil: z.string().datetime({ message: "Invalid ISO date format" }).nullable(),
    createdAt: z.string().datetime({ message: "Invalid ISO date format" }),
    entries: z.array(TimetableEntryOutputSchema),
});
export type TimetableOutput = z.infer<typeof TimetableOutputSchema>;

// Schema for querying active timetable
export const GetActiveTimetableSchema = z.object({
    params: z.object({
        streamId: z.string().cuid(),
    }),
    query: z.object({
        // Date string in YYYY-MM-DD format
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
    }),
});

export const SetEndDateSchema = z.object({
    body: z.object({
        // Expect a YYYY-MM-DD string
        validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
    })
});
export type SetEndDateInput = z.infer<typeof SetEndDateSchema>['body'];