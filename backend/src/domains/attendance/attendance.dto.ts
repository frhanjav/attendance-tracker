import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client'; // Import enum from Prisma

// Input for marking attendance for a single class on a specific date
export const MarkAttendanceSchema = z.object({
    body: z.object({
        streamId: z.string().cuid(),
        subjectName: z.string().min(1),
        courseCode: z.string().nullable().optional(), // <-- Add .nullable()
        // Date string in YYYY-MM-DD format
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
        status: z.nativeEnum(AttendanceStatus, { errorMap: () => ({ message: 'Invalid attendance status' }) }),
    }),
});
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>['body'];

// Input for bulk attendance entry
export const BulkAttendanceSchema = z.object({
     body: z.object({
        streamId: z.string().cuid(),
        // Date string in YYYY-MM-DD format for the period start
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }),
        // Optional: defaults to today if not provided
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }).optional(),
        // Attendance per subject
        attendance: z.record(
            z.string().min(1), // Subject Name (key)
            z.number().int().min(0) // Attended Classes (value)
        ).refine(val => Object.keys(val).length > 0, { message: "Attendance data cannot be empty" }),
     })
});
export type BulkAttendanceInput = z.infer<typeof BulkAttendanceSchema>['body'];

// --- NEW: Schema for Cancel Class Request Body ---
export const CancelClassSchema = z.object({
    body: z.object({
        streamId: z.string().cuid({ message: "Stream ID is required" }),
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
        subjectName: z.string().min(1, { message: "Subject name is required" }),
        // Optional: Include startTime if needed to distinguish multiple classes of the same subject on the same day
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format (HH:MM)' }).optional().nullable(),
    })
});
export type CancelClassInput = z.infer<typeof CancelClassSchema>['body'];
// --- End Cancel Class Schema ---

// Output DTO for a single attendance record
export const AttendanceRecordOutputSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    streamId: z.string().cuid(),
    subjectName: z.string(),
    courseCode: z.string().nullable(),
    classDate: z.date(),
    status: z.nativeEnum(AttendanceStatus),
    markedAt: z.date(),
});
export type AttendanceRecordOutput = z.infer<typeof AttendanceRecordOutputSchema>;

// Output DTO for calendar view events
// Tailor this to what your calendar component needs (e.g., react-big-calendar)
export const CalendarEventOutputSchema = z.object({
    title: z.string(), // e.g., "CS101 - Occurred" or "MATH202 - Cancelled"
    start: z.date(),   // Start date/time of the event
    end: z.date(),     // End date/time of the event (can be same as start for all-day)
    allDay: z.boolean().optional().default(true),
    resource: z.object({ // Optional: Additional data associated with the event
        recordId: z.string().cuid().optional(),
        streamId: z.string().cuid(),
        subjectName: z.string(),
        courseCode: z.string().optional().nullable(),
        status: z.nativeEnum(AttendanceStatus),
    }).optional(),
});
export type CalendarEventOutput = z.infer<typeof CalendarEventOutputSchema>;


// Schema for querying calendar data
export const GetCalendarDataSchema = z.object({
    query: z.object({
        streamId: z.string().cuid(),
        // Date strings in YYYY-MM-DD format
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }),
    }),
});

// Schema for querying attendance records (can add more filters)
export const GetAttendanceRecordsSchema = z.object({
    query: z.object({
        streamId: z.string().cuid(),
        subjectName: z.string().optional(),
        // Date strings in YYYY-MM-DD format
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }).optional(),
        // Add pagination, sorting etc. later if needed
    }),
});