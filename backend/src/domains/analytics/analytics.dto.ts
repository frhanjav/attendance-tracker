import { z } from 'zod';

// Output for subject-wise attendance statistics
export const SubjectStatsSchema = z.object({
    subjectName: z.string(),
    courseCode: z.string().optional().nullable(),
    totalScheduled: z.number().int().min(0), // Total classes scheduled based on timetable
    totalMarked: z.number().int().min(0), // Total classes marked (occurred, cancelled, replaced)
    totalOccurred: z.number().int().min(0), // Total marked as OCCURRED
    attended: z.number().int().min(0), // User's attended count (OCCURRED records for user)
    attendancePercentage: z.number().min(0).max(100).nullable(), // (attended / totalOccurred) * 100
});
export type SubjectStatsOutput = z.infer<typeof SubjectStatsSchema>;

// Output for overall stream attendance statistics
export const StreamAnalyticsOutputSchema = z.object({
    streamId: z.string().cuid(),
    userId: z.string().cuid(),
    startDate: z.date(),
    endDate: z.date(),
    overallAttendancePercentage: z.number().min(0).max(100).nullable(),
    totalAttendedClasses: z.number().int().min(0),
    totalOccurredClasses: z.number().int().min(0),
    subjectStats: z.array(SubjectStatsSchema),
});
export type StreamAnalyticsOutput = z.infer<typeof StreamAnalyticsOutputSchema>;

// Input for the attendance calculator
export const AttendanceCalculatorSchema = z.object({
    body: z.object({
        streamId: z.string().cuid(),
        targetPercentage: z.number().min(0).max(100),
        // Date string (YYYY-MM-DD) up to which future classes should be considered
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid target date format (YYYY-MM-DD)" }),
        // Optional: Calculate for a specific subject
        subjectName: z.string().optional(),
    }),
});
export type AttendanceCalculatorInput = z.infer<typeof AttendanceCalculatorSchema>['body'];

// Output for the attendance calculator
export const AttendanceProjectionOutputSchema = z.object({
    currentAttended: z.number().int(),
    currentOccurred: z.number().int(),
    currentPercentage: z.number().nullable(),
    futureScheduled: z.number().int(), // Classes scheduled from tomorrow until targetDate
    targetPercentage: z.number(),
    neededToAttend: z.number().int(), // How many future classes must be attended
    canSkip: z.number().int(), // How many future classes can be skipped
    message: z.string(), // User-friendly message
});
export type AttendanceProjectionOutput = z.infer<typeof AttendanceProjectionOutputSchema>;


// Schema for querying analytics
export const GetAnalyticsSchema = z.object({
    params: z.object({
        streamId: z.string().cuid(),
    }),
    query: z.object({
         // Optional: Specify user ID (e.g., for admins viewing others)
        userId: z.string().cuid().optional(),
        // Optional: Date range for calculation (defaults could be stream start/today)
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }).optional(),
        subjectName: z.string().optional(), // For subject-specific stats
    }),
});