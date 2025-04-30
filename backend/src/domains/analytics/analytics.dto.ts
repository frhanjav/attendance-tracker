import { z } from 'zod';

// Output for subject-wise attendance statistics
export const SubjectStatsOutputSchema = z.object({
    subjectName: z.string(),
    courseCode: z.string().nullable(),
    totalScheduled: z.number().int().min(0),
    totalMarked: z.number().int().min(0),
    totalHeldClasses: z.number().int().min(0), // Renamed from totalOccurred
    attended: z.number().int().min(0),
    attendancePercentage: z.number().min(0).max(100).nullable(),
});
export type SubjectStatsOutput = z.infer<typeof SubjectStatsOutputSchema>;

// Output for overall stream attendance statistics
export const StreamAnalyticsOutputSchema = z.object({
    streamId: z.string().cuid(),
    userId: z.string().cuid(),
    startDate: z.string().datetime(), // Keep as ISO string
    endDate: z.string().datetime(),   // Keep as ISO string
    overallAttendancePercentage: z.number().min(0).max(100).nullable(),
    totalAttendedClasses: z.number().int().min(0),
    totalHeldClasses: z.number().int().min(0), // Renamed from totalOccurredClasses
    subjectStats: z.array(SubjectStatsOutputSchema),
});
export type StreamAnalyticsOutput = z.infer<typeof StreamAnalyticsOutputSchema>;

// Input for the attendance calculator
export const AttendanceCalculatorInputSchema = z.object({
    body: z.object({
        streamId: z.string().cuid(),
        targetPercentage: z.number().min(0).max(100),
        // Date string (YYYY-MM-DD) up to which future classes should be considered
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid target date format (YYYY-MM-DD)" }),
        // Optional: Calculate for a specific subject
        subjectName: z.string().optional(),
        currentAttendedInput: z.number().int().min(0).optional(), // Manually provided attended count
        currentHeldInput: z.number().int().min(0).optional(),     // Manually provided held count
    }),
});
export type AttendanceCalculatorInput = z.infer<typeof AttendanceCalculatorInputSchema>['body'];

// Output for the attendance calculator
export const AttendanceProjectionOutputSchema = z.object({
    currentAttended: z.number().int(),
    currentHeld: z.number().int(), // Renamed from currentOccurred
    currentPercentage: z.number().nullable(),
    futureHeld: z.number().int(), // Renamed from futureScheduled
    targetPercentage: z.number(),
    neededToAttend: z.number().int(),
    canSkip: z.number().int(),
    message: z.string(),
});
export type AttendanceProjectionOutput = z.infer<typeof AttendanceProjectionOutputSchema>;


// // Schema for querying analytics
// export const GetAnalyticsSchema = z.object({
//     params: z.object({
//         streamId: z.string().cuid(),
//     }),
//     query: z.object({
//          // Optional: Specify user ID (e.g., for admins viewing others)
//         userId: z.string().cuid().optional(),
//         // Optional: Date range for calculation (defaults could be stream start/today)
//         startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }).optional(),
//         endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }).optional(),
//         subjectName: z.string().optional(), // For subject-specific stats
//     }),
// });