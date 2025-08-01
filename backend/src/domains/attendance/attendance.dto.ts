import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';

export const MarkAttendanceSchema = z.object({
    body: z.object({
        streamId: z.string().cuid(),
        subjectName: z.string().min(1),
        courseCode: z.string().nullable().optional(),
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
        status: z.nativeEnum(AttendanceStatus, { errorMap: () => ({ message: 'Invalid attendance status' }) }),
    }),
});
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>['body'];

export const BulkAttendanceSchema = z.object({
     body: z.object({
        streamId: z.string().cuid(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }).optional(),
        attendance: z.record(
            z.string().min(1),
            z.number().int().min(0)
        ).refine(val => Object.keys(val).length > 0, { message: "Attendance data cannot be empty" }),
     })
});
export type BulkAttendanceInput = z.infer<typeof BulkAttendanceSchema>['body'];

export const CancelClassSchema = z.object({
    body: z.object({
        streamId: z.string().cuid({ message: "Stream ID is required" }),
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
        subjectName: z.string().min(1, { message: "Subject name is required" }),
        // Include startTime if needed to distinguish multiple classes of the same subject on the same day
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format (HH:MM)' }).optional().nullable(),
    })
});
export type CancelClassInput = z.infer<typeof CancelClassSchema>['body'];

export const ReplaceClassSchema = z.object({
    body: z.object({
        streamId: z.string().cuid(),
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        originalSubjectName: z.string().min(1),
        originalStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
        replacementSubjectName: z.string().min(1),
        replacementCourseCode: z.string().optional().nullable(),
        replacementStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
        replacementEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
    })
});
export type ReplaceClassInput = z.infer<typeof ReplaceClassSchema>['body'];

export const AttendanceRecordOutputSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    streamId: z.string().cuid(),
    subjectName: z.string(),
    courseCode: z.string().nullable(),
    classDate: z.string().datetime({ message: "Invalid ISO datetime format" }),
    status: z.nativeEnum(AttendanceStatus),
    markedAt: z.string().datetime({ message: "Invalid ISO datetime format" }),
    isReplacement: z.boolean(),
    originalSubjectName: z.string().nullable(),
    originalCourseCode: z.string().nullable(),
    originalStartTime: z.string().nullable(),
    originalEndTime: z.string().nullable(),
});
export type AttendanceRecordOutput = z.infer<typeof AttendanceRecordOutputSchema>;

export type WeeklyAttendanceViewEntry = {
    date: string;
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: AttendanceStatus;
    recordId?: string;
    isReplacement?: boolean;
    originalSubjectName?: string | null;
    isCancelled?: boolean;
};

export const GetCalendarDataSchema = z.object({
    query: z.object({
        streamId: z.string().cuid(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }),
    }),
});

export const GetAttendanceRecordsSchema = z.object({
    query: z.object({
        streamId: z.string().cuid(),
        subjectName: z.string().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }).optional(),
    }),
});